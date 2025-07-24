// netlify/functions/archive-floor.js
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { floorNumber, sessionEndReason } = JSON.parse(event.body || '{}');
    
    if (!floorNumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'floorNumber is required' })
      };
    }

    // Paths
    const dataDir = path.join(process.cwd(), 'data', `floor${floorNumber}`);
    const archiveDir = path.join(process.cwd(), 'data', 'archived-floors');
    const archiveFile = path.join(archiveDir, `floor${floorNumber}.html`);

    // Ensure archive directory exists
    await fs.mkdir(archiveDir, { recursive: true });

    // Read all room data for this floor
    const roomFiles = [
      'room0-0.json', 'room1-0.json', 'room2-0.json',
      'room0-1.json', 'room1-1.json', 'room2-1.json', 
      'room0-2.json', 'room1-2.json', 'room2-2.json'
    ];

    const floorData = {
      floorNumber: floorNumber,
      archivedAt: new Date().toISOString(),
      sessionEndReason: sessionEndReason || 'Timer expired',
      rooms: {},
      totalMessages: 0,
      totalVisitors: 0,
      sessionDuration: null
    };

    let sessionStart = null;
    let sessionEnd = new Date();

    // Collect data from all rooms
    for (const roomFile of roomFiles) {
      const roomPath = path.join(dataDir, roomFile);
      try {
        const roomContent = await fs.readFile(roomPath, 'utf8');
        const roomData = JSON.parse(roomContent);
        
        // Extract room coordinates from filename (room1-2.json -> "1-2")
        const roomId = roomFile.replace('room', '').replace('.json', '');
        floorData.rooms[roomId] = roomData;
        
        // Aggregate statistics
        floorData.totalMessages += roomData.statistics?.totalMessages || 0;
        floorData.totalVisitors += roomData.statistics?.totalVisitors || 0;
        
        // Track session timing
        if (roomData.sessionStart) {
          const roomStart = new Date(roomData.sessionStart);
          if (!sessionStart || roomStart < sessionStart) {
            sessionStart = roomStart;
          }
        }

        // Mark room as locked
        roomData.isLocked = true;
        roomData.sessionEnd = sessionEnd.toISOString();
        await fs.writeFile(roomPath, JSON.stringify(roomData, null, 2));
        
      } catch (error) {
        console.log(`Room file ${roomFile} not found or invalid, skipping`);
      }
    }

    // Calculate session duration
    if (sessionStart) {
      floorData.sessionDuration = Math.round((sessionEnd - sessionStart) / (1000 * 60 * 60 * 24)); // days
    }

    // Generate static HTML archive
    const archiveHTML = generateFloorHTML(floorData);
    await fs.writeFile(archiveFile, archiveHTML);

    // Save floor metadata
    const metadataFile = path.join(archiveDir, `floor${floorNumber}.json`);
    await fs.writeFile(metadataFile, JSON.stringify(floorData, null, 2));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: `Floor ${floorNumber} archived successfully`,
        archiveUrl: `/data/archived-floors/floor${floorNumber}.html`,
        statistics: {
          totalMessages: floorData.totalMessages,
          totalVisitors: floorData.totalVisitors,
          sessionDuration: floorData.sessionDuration
        }
      })
    };

  } catch (error) {
    console.error('Error archiving floor:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};

function generateFloorHTML(floorData) {
  const roomNames = {
    '0-0': 'Northwest Room', '1-0': 'Elevator', '2-0': 'Northeast Room',
    '0-1': 'West Wing', '1-1': 'Courtyard', '2-1': 'East Wing',
    '0-2': 'Southwest Room', '1-2': 'Foyer', '2-2': 'Southeast Room'
  };

  let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Archived Floor ${floorData.floorNumber} - Text Rooms</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background: #0a0a0a;
            color: #00ff00;
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            border: 2px solid #00ff00;
            padding: 20px;
            margin-bottom: 30px;
        }
        .room {
            border: 2px solid #333;
            margin: 20px 0;
            padding: 20px;
            background: #1a1a1a;
        }
        .room h2 {
            color: #00ffff;
            border-bottom: 1px solid #333;
            padding-bottom: 10px;
        }
        .message {
            margin: 15px 0;
            padding: 10px;
            border-left: 3px solid;
            background: rgba(0, 0, 0, 0.5);
        }
        .message-meta {
            font-size: 10px;
            color: #666;
            margin-top: 5px;
        }
        .stats {
            background: #2a2a2a;
            padding: 15px;
            border: 1px solid #444;
            margin-bottom: 20px;
        }
        .position {
            font-size: 10px;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📚 ARCHIVED FLOOR ${floorData.floorNumber} 📚</h1>
        <p>Preserved on ${new Date(floorData.archivedAt).toLocaleDateString()}</p>
        <p>Reason: ${floorData.sessionEndReason}</p>
    </div>

    <div class="stats">
        <h3>Session Statistics</h3>
        <p><strong>Total Messages:</strong> ${floorData.totalMessages}</p>
        <p><strong>Unique Visitors:</strong> ${floorData.totalVisitors}</p>
        <p><strong>Session Duration:</strong> ${floorData.sessionDuration} days</p>
        <p><strong>Archive Date:</strong> ${new Date(floorData.archivedAt).toLocaleString()}</p>
    </div>
`;

  // Generate room sections
  Object.entries(floorData.rooms).forEach(([roomId, roomData]) => {
    const roomName = roomNames[roomId] || `Room ${roomId}`;
    htmlContent += `
    <div class="room">
        <h2>${roomName}</h2>`;
    
    if (roomData.textEntries && roomData.textEntries.length > 0) {
      roomData.textEntries.forEach(entry => {
        htmlContent += `
        <div class="message" style="border-left-color: ${entry.author.color}">
            <div style="color: ${entry.author.color}">${entry.text}</div>
            <div class="message-meta">
                <span class="position">Position: (${entry.position.x}, ${entry.position.y})</span>
                • ${new Date(entry.author.timestamp).toLocaleString()}
                • Visitor: ${entry.author.id.substring(0, 12)}...
            </div>
        </div>`;
      });
    } else {
      htmlContent += `<p style="color: #666; font-style: italic;">No messages were left in this room.</p>`;
    }
    
    htmlContent += `</div>`;
  });

  htmlContent += `
    <div class="header" style="margin-top: 40px;">
        <p>This floor has been preserved as a digital time capsule.</p>
        <p><a href="/" style="color: #00ffff;">← Return to Current Floor</a></p>
    </div>
</body>
</html>`;

  return htmlContent;
}