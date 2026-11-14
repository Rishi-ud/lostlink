/**
 * LostLink — Vercel Serverless Function Catch-All Entry Point
 * Routes any subpath under /api/* to the Express application.
 */
const app = require('../server');

module.exports = app;
