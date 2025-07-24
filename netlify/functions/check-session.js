// netlify/functions/check-session.js
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const floorNumber = event.queryStringParameters?.floor || '1';
    const dataDir = path.join(process.cwd(), 'data', `floor${floorNumber}`);
    
    // Check session status by looking at a key room (courtyard)
    const courtyardFile = path.join(dataDir, 'room1-1.json');
    
    try {
      const fileContent = await fs.readFile(courtyardFile, 'utf8');
      const roomData = JSON.parse(fileContent);
      
      const now = new Date();
      const sessionEnd = roomData.sessionEnd ? new Date(roomData.sessionEnd) : null;
      const isExpired = sessionEnd && sessionEnd < now;
      const isLocked = roomData.isLocked;
      
      // Calculate time remaining
      let timeRemaining = null;
      if (sessionEnd && !isExpired) {
        timeRemaining = Math.max(0, sessionEnd - now);
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          floorNumber: parseInt(floorNumber),
          sessionActive: !isExpired && !isLocked,
          isLocked: isLocked,
          isExpired: isExpired,
          sessionStart: roomData.sessionStart,
          sessionEnd: roomData.sessionEnd,
          timeRemaining: timeRemaining,
          shouldArchive: isExpired && !isLocked
        })
      };

    } catch (fileError) {
      // No session file exists - this is a new session
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          floorNumber: parseInt(floorNumber),
          sessionActive: true,
          isLocked: false,
          isExpired: false,
          sessionStart: null,
          sessionEnd: null,
          timeRemaining: null,
          shouldArchive: false,
          newSession: true
        })
      };
    }

  } catch (error) {
    console.error('Error checking session:', error);
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