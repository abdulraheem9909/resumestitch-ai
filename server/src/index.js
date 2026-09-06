import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { initJobAgentGraph } from './graph/graphInstance.js';
import authRouter from './routes/auth.js';
import resumesRouter from './routes/resumes.js';
import applicationsRouter from './routes/applications.js';

// A missing/guessable JWT secret is a silent security hole, not just a
// broken feature — fail loudly instead of the "warn and continue" style
// used for MONGODB_URI in config/db.js.
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    // Downloads are fetched via apiFetch (for the Authorization header) rather
    // than a plain <a href>, so the client needs to read the real filename
    // back off the response — browsers don't expose this header to JS on a
    // cross-origin response unless it's explicitly allow-listed here.
    exposedHeaders: ['Content-Disposition'],
  })
);
// A pasted JD is normally a few KB; 2mb leaves generous headroom for an
// unusually long posting while still bounding the request body.
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/resumes', resumesRouter);
app.use('/api/applications', applicationsRouter);

// Catches body-parser/multer failures (an oversized JSON body, an oversized
// file upload, malformed JSON) before Express's default HTML error page
// would — keeps every error response in the same {error} JSON shape the
// rest of the API uses, and never leaks a server filesystem path in a
// stack trace back to the client.
app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'That request is too large.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body.' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Unexpected server error.' });
});

async function start() {
  await connectDB();
  initJobAgentGraph(process.env.MONGODB_URI, mongoose.connection.name);
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
