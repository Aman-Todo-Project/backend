require('dotenv').config({ quiet: true });

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  MONGODB_URI: process.env.MONGODB_URI || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'UTC',
};
