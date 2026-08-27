import 'dotenv/config';
import mongoose from 'mongoose';
import MasterResume from '../src/models/MasterResume.js';
import ResumeBullet from '../src/models/ResumeBullet.js';
import { normalizeSkills } from '../src/services/normalizeSkills.js';
import { createJobAgentGraph } from '../src/graph/jobAgentGraph.js';
import { JD_SAMPLES } from './jdSamples.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('connected');

  const resume = await MasterResume.findOne({ status: 'active' }).sort({ uploadedAt: -1 });
  if (!resume) {
    throw new Error('No active master resume found — upload one via the app first.');
  }

  const bullets = await ResumeBullet.find({ masterResumeId: resume._id });
  if (bullets.length === 0) {
    throw new Error('Active resume has no bullets — check the upload flow.');
  }

  console.log('Loaded resume:', resume.label, '| bullets:', bullets.length);

  const resumeCanonicalSkills = normalizeSkills(bullets.flatMap((bullet) => bullet.skills));

  const { graph, client } = createJobAgentGraph(process.env.MONGODB_URI, mongoose.connection.name);

  // One thread_id per JD, each a stand-in for a future applications._id
  // (section 8) — no Application model exists yet to draw a real one from.
  const runs = [];

  try {
    for (const { company, text } of JD_SAMPLES) {
      const threadId = new mongoose.Types.ObjectId().toString();

      const result = await graph.invoke(
        {
          jdText: text,
          resumeSummary: resume.summary,
          resumeTitle: resume.personalInfo?.title,
          resumeCanonicalSkills,
        },
        { configurable: { thread_id: threadId } }
      );

      console.log('\n=====', company, '=====');
      console.log('thread_id:', threadId);
      console.log('JD canonical skills:', result.jdCanonicalSkills);
      console.log('Keyword gaps:', result.keywordGaps);
      console.log('Role fit:', result.roleFit);

      runs.push({ company, threadId, fit: result.roleFit.fit });
    }

    console.log('\n===== Checkpoint verification (checkpoints collection) =====');
    const checkpoints = client.db(mongoose.connection.name).collection('checkpoints');
    for (const { company, threadId, fit } of runs) {
      const count = await checkpoints.countDocuments({ thread_id: threadId });
      console.log(`${company} — branch: ${fit} — checkpoint docs for thread ${threadId}: ${count}`);
    }
  } finally {
    await client.close();
  }

  await mongoose.disconnect();
  console.log('\ndone');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
