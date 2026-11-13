const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const taskRoutes = require('./routes/taskRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { CLIENT_URL, NODE_ENV } = require('./config/env');

const allowedOrigins = CLIENT_URL.split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

// vite falls back to 5174, 5175 etc. when 5173 is taken, so allow any localhost port in dev
const localhostRegex = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true;
  return NODE_ENV !== 'production' && localhostRegex.test(origin);
}

function createApp() {
  const app = express();

  if (NODE_ENV !== 'test') app.use(requestLogger);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    })
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    res.json({ status: 'ok', db: dbConnected ? 'connected' : 'disconnected' });
  });

  app.use('/api/tasks', taskRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
