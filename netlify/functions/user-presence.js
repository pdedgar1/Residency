// netlify/functions/user-presence.js
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { action, userId, username, roomId, position, color } = JSON.parse(event.body || '{}');
    
    if (!action || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'action and userId are required' })
      };
    }

    // File path for presence data
    const presenceDir = path.join(process.cwd(), 'data', 'presence');
    const presenceFile = path.join(presenceDir, 'online-users.json');
    
    // Ensure directory exists
    await fs.mkdir(presenceDir, { recursive: true });

    // Load existing presence data
    let presenceData = { users: {}, lastCleanup: Date.now() };
    try {
      const fileContent = await fs.readFile(presenceFile, 'utf8');
      presenceData = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist, use default
    }

    const now = Date.now();
    const PRESENCE_TIMEOUT = 60000; // 1 minute timeout

    // Clean up old users (haven't been seen in over 1 minute)
    if (now - presenceData.lastCleanup > 30000) { // Clean every 30 seconds
      Object.keys(presenceData.users).forEach(uid => {
        if (now - presenceData.users[uid].lastSeen > PRESENCE_TIMEOUT) {
          delete presenceData.users[uid];
        }
      });
      presenceData.lastCleanup = now;
    }

    switch (action) {
      case 'heartbeat':
        // Update user presence
        if (presenceData.users[userId]) {
          presenceData.users[userId] = {
            ...presenceData.users[userId],
            roomId: roomId || presenceData.users[userId].roomId,
            position: position || presenceData.users[userId].position,
            lastSeen: now
          };
        } else if (username && color && roomId) {
          // New user joining
          presenceData.users[userId] = {
            userId,
            username,
            color,
            roomId,
            position: position || { x: 400, y: 400 },
            joinedAt: now,
            lastSeen: now
          };
        }
        break;

      case 'leave':
        // User leaving
        delete presenceData.users[userId];
        break;

      case 'get':
        // Just return current presence data
        break;

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }

    // Save updated presence data
    await fs.writeFile(presenceFile, JSON.stringify(presenceData, null, 2));

    // Return current users in requested room (or all if no room specified)
    const targetRoom = roomId || event.queryStringParameters?.roomId;
    const roomUsers = targetRoom 
      ? Object.values(presenceData.users).filter(user => user.roomId === targetRoom)
      : Object.values(presenceData.users);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        users: roomUsers,
        totalOnline: Object.keys(presenceData.users).length,
        roomCount: roomUsers.length
      })
    };

  } catch (error) {
    console.error('Error managing user presence:', error);
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
