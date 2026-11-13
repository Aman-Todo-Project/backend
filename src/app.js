const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const taskRoutes = require('./routes/taskRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { CLIENT_URL, NODE_ENV } = require('./config/env');

// Production frontend is always allowed, so a stale CLIENT_URL on the host can't break CORS.
// Extra origins (comma-separated) come from CLIENT_URL.
const DEFAULT_ORIGINS = ['https://front-beta-eight-12.vercel.app'];

const allowedOrigins = [...DEFAULT_ORIGINS, ...CLIENT_URL.split(',')]
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// vite falls back to 5174, 5175 etc. when 5173 is taken, so allow any localhost port in dev
const localhostRegex = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true;
  if (origin === 'http://localhost:5173') return true;
  return NODE_ENV !== 'production' && localhostRegex.test(origin);
}

// No cookies/auth headers are used, so credentials stay off (keeps '*' in CLIENT_URL safe).
const corsOptions = {
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

function createApp() {
  const app = express();

  if (NODE_ENV !== 'test') app.use(requestLogger);
  // CORS first so preflights are answered before helmet or the routes run
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));
  // API-only server: let the browser read responses cross-origin
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
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
