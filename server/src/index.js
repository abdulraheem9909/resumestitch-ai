import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { initJobAgentGraph } from './graph/graphInstance.js';
import resumesRouter from './routes/resumes.js';
import applicationsRouter from './routes/applications.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/resumes', resumesRouter);
app.use('/api/applications', applicationsRouter);

async function start() {
  await connectDB();
  initJobAgentGraph(process.env.MONGODB_URI, mongoose.connection.name);
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
