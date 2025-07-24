// netlify/functions/get-available-colors.js
const fs = require('fs').promises;
const path = require('path');

const AVAILABLE_COLORS = [
  '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
  '#E6B3FF', '#FFB3E6', '#FFD1DC', '#B3E5D1', '#D1B3FF',
  '#E6CCB3', '#B3CCE6', '#FFE6B3', '#E6FFB3', '#B3FFE6',
  '#FFC3A0', '#D4A5A5', '#A0E7E5', '#B4F8C8', '#F0E68C',
  '#DDA0DD', '#98FB98', '#F0E68C', '#FFA07A', '#20B2AA',
  '#87CEEB', '#DEB887', '#5F9EA0', '#FF6347', '#40E0D0'
];

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get currently used colors from presence data
    const presenceDir = path.join(process.cwd(), 'data', 'presence');
    const presenceFile = path.join(presenceDir, 'online-users.json');
    
    let usedColors = [];
    try {
      const fileContent = await fs.readFile(presenceFile, 'utf8');
      const presenceData = JSON.parse(fileContent);
      
      // Clean up old users first
      const now = Date.now();
      const PRESENCE_TIMEOUT = 60000; // 1 minute
      
      Object.keys(presenceData.users || {}).forEach(userId => {
        const user = presenceData.users[userId];
        if (now - user.lastSeen < PRESENCE_TIMEOUT) {
          usedColors.push(user.color);
        }
      });
    } catch (error) {
      // No presence file exists yet
    }

    // Filter out used colors
    const availableColors = AVAILABLE_COLORS.filter(color => !usedColors.includes(color));
    
    // If no colors available, allow duplicates but mark them
    const hasAvailableColors = availableColors.length > 0;
    const colorsToReturn = hasAvailableColors ? availableColors : AVAILABLE_COLORS;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        availableColors: colorsToReturn,
        usedColors: usedColors,
        hasAvailableColors: hasAvailableColors,
        totalOnline: usedColors.length
      })
    };

  } catch (error) {
    console.error('Error getting available colors:', error);
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