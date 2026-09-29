'use strict';

// Load variables from a local .env file (no-op if the file is absent).
require('dotenv').config();

const rawOrigins = process.env.ALLOWED_ORIGINS || '*';

// Normalise the allowed-origin list. '*' enables all origins (local dev only).
const allowedOrigins = rawOrigins.trim() === '*'
  ? '*'
  : rawOrigins.split(',').map((s) => s.trim()).filter(Boolean);

module.exports = {
  port: Number(process.env.PORT) || 4000,
  isProd: process.env.NODE_ENV === 'production',
  // cors origin config shared by Express and Socket.io.
  // true  => reflect any origin (used when ALLOWED_ORIGINS='*')
  // array => allow exactly those origins
  corsOrigin: allowedOrigins === '*' ? true : allowedOrigins,
  rawAllowedOrigins: allowedOrigins,
};
