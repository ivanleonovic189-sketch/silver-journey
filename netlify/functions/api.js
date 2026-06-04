const serverless = require('serverless-http');
const app = require('../../backend/server');

const apiHandler = serverless(app);

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
