const serverless = require('serverless-http');
const { ensureDbReady } = require('../../backend/db');
const app = require('../../backend/server');

const apiHandler = serverless(app);

exports.handler = async (event, context) => {
  try {
    await ensureDbReady();
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
