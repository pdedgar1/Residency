// netlify/functions/save-text.js
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { roomId, text, position, spriteColor } = JSON.parse(event.body);
    
    // Validate input
    if (!roomId || !text || !position || !spriteColor) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Create visitor ID and hash IP for privacy
    const visitorId = 'visitor_' + Math.random().toString(36).substr(2, 9);
    const ipHash = crypto.createHash('sha256')
      .update(event.headers['x-forwarded-for'] || 'unknown')
      .digest('hex');

    // File path for room data
    const dataDir = path.join(process.cwd(), 'data', 'floor1');
    const roomFile = path.join(dataDir, `room${roomId}.json`);

    // Ensure directory exists
    await fs.mkdir(dataDir, { recursive: true });

    // Load existing room data or create new
    let roomData;
    try {
      const fileContent = await fs.readFile(roomFile, 'utf8');
      roomData = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist, create new room data
      roomData = {
        roomId: roomId,
        roomName: getRoomName(roomId),
        floorNumber: 1,
        sessionStart: new Date().toISOString(),
        sessionEnd: null,
        isLocked: false,
        textEntries: [],
        statistics: {
          totalVisitors: 0,
          totalMessages: 0,
          lastActivity: null
        }
      };
    }

    // Check if session is locked
    if (roomData.isLocked) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'This floor session has been locked' })
      };
    }

    // Create new text entry
    const newEntry = {
      id: `entry_${Date.now()}`,
      text: text.substring(0, 200), // Limit text length
      position: {
        x: Math.max(30, Math.min(770, position.x)),
        y: Math.max(30, Math.min(770, position.y))
      },
      author: {
        id: visitorId,
        color: spriteColor,
        timestamp: new Date().toISOString()
      },
      metadata: {
        ipHash: ipHash,
        userAgent: (event.headers['user-agent'] || '').substring(0, 100)
      }
    };

    // Add entry to room data
    roomData.textEntries.push(newEntry);
    roomData.statistics.totalMessages++;
    roomData.statistics.lastActivity = new Date().toISOString();

    // Save updated room data
    await fs.writeFile(roomFile, JSON.stringify(roomData, null, 2));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        entryId: newEntry.id,
        message: 'Text saved successfully'
      })
    };

  } catch (error) {
    console.error('Error saving text:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

function getRoomName(roomId) {
  const roomNames = {
    '0-0': 'Northwest Room',
    '1-0': 'Elevator', 
    '2-0': 'Northeast Room',
    '0-1': 'West Wing',
    '1-1': 'Courtyard',
    '2-1': 'East Wing',
    '0-2': 'Southwest Room',
    '1-2': 'Foyer',
    '2-2': 'Southeast Room'
  };
  return roomNames[roomId] || 'Unknown Room';
}