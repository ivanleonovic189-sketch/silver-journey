const path = require('path');
const fs = require('fs');
const serverless = require('serverless-http');

function loadApp() {
  const deployed = path.join(__dirname, 'backend', 'server.js');
  const local = path.join(__dirname, '..', '..', 'backend', 'server.js');
  const entry = fs.existsSync(deployed) ? deployed : local;
  return require(entry);
}

const apiHandler = serverless(loadApp());

exports.handler = async (event, context) => {
  try {
    return await apiHandler(event, context);
  } catch (err) {
    console.error('Netlify API error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
