const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { createApp } = require('./app');

async function start() {
  try {
    await connectDB(env.MONGODB_URI);
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  const server = createApp().listen(env.PORT, () => {
    console.log(`TaskFlow API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
