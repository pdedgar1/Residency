// netlify/functions/get-room-data.js
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
  // Allow both GET and POST requests
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get roomId from query parameters (GET) or body (POST)
    let roomId;
    if (event.httpMethod === 'GET') {
      roomId = event.queryStringParameters?.roomId;
    } else {
      const body = JSON.parse(event.body || '{}');
      roomId = body.roomId;
    }

    if (!roomId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'roomId is required' })
      };
    }

    // Validate roomId format (should be like "1-2")
    if (!/^\d-\d$/.test(roomId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid roomId format. Expected format: "x-y"' })
      };
    }

    // File path for room data
    const dataDir = path.join(process.cwd(), 'data', 'floor1');
    const roomFile = path.join(dataDir, `room${roomId}.json`);

    try {
      // Read room data
      const fileContent = await fs.readFile(roomFile, 'utf8');
      const roomData = JSON.parse(fileContent);

      // Check if session is still active
      const now = new Date();
      const isExpired = roomData.sessionEnd && new Date(roomData.sessionEnd) < now;
      
      if (isExpired && !roomData.isLocked) {
        // Session expired but not yet locked - this could trigger archiving
        console.log(`Session expired for room ${roomId}, should be archived`);
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache' // Ensure fresh data
        },
        body: JSON.stringify({
          success: true,
          roomData: roomData,
          textEntries: roomData.textEntries || [],
          isLocked: roomData.isLocked || isExpired,
          sessionActive: !isExpired && !roomData.isLocked
        })
      };

    } catch (fileError) {
      // File doesn't exist - create empty room
      console.log(`Room file not found for ${roomId}, creating new room`);
      
      const newRoomData = {
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

      // Create directory if it doesn't exist
      await fs.mkdir(dataDir, { recursive: true });
      
      // Save new room file
      await fs.writeFile(roomFile, JSON.stringify(newRoomData, null, 2));

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          roomData: newRoomData,
          textEntries: [],
          isLocked: false,
          sessionActive: true,
          created: true
        })
      };
    }

  } catch (error) {
    console.error('Error getting room data:', error);
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