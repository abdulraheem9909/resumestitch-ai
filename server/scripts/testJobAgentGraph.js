import 'dotenv/config';
import mongoose from 'mongoose';
import MasterResume from '../src/models/MasterResume.js';
import ResumeBullet from '../src/models/ResumeBullet.js';
import GenerationCache from '../src/models/GenerationCache.js';
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
  const resumeBulletsForGraph = bullets.map((bullet) => ({
    bulletId: bullet._id.toString(),
    text: bullet.text,
    role: bullet.role,
    company: bullet.company,
    dateRange: bullet.dateRange,
    canonicalSkills: bullet.canonicalSkills,
  }));

  const { graph, client } = createJobAgentGraph(process.env.MONGODB_URI, mongoose.connection.name);

  // One thread_id per JD, each a stand-in for a future applications._id
  // (section 8) — no Application model exists yet to draw a real one from.
  const runs = [];

  try {
    for (const { company, text } of JD_SAMPLES) {
      const threadId = new mongoose.Types.ObjectId().toString();

      const initialState = {
        applicationId: threadId,
        masterResumeId: resume._id.toString(),
        jdText: text,
        resumeSummary: resume.summary,
        resumeTitle: resume.personalInfo?.title,
        resumeCanonicalSkills,
        resumeBullets: resumeBulletsForGraph,
      };

      const result = await graph.invoke(initialState, { configurable: { thread_id: threadId } });

      console.log('\n=====', company, '=====');
      console.log('thread_id:', threadId);
      console.log('JD canonical skills:', result.jdCanonicalSkills);
      console.log('Keyword gaps:', result.keywordGaps);
      console.log('Role fit:', result.roleFit);

      if (result.roleFit.fit === 'plausible') {
        console.log('Years of experience:', result.yearsOfExperience);
        console.log('Matched skills:', result.matchedSkills);
        console.log('Tailored bullets:', result.tailoredBullets);
        console.log('Tailored summary:', result.tailoredSummary);
        console.log('Verification result:', JSON.stringify(result.verificationResult, null, 2));

        // Re-invoke with identical input to prove the cache path — same
        // generationId means the second call reused the cache instead of
        // calling the model again.
        const secondThreadId = new mongoose.Types.ObjectId().toString();
        const secondResult = await graph.invoke(
          { ...initialState, applicationId: threadId },
          { configurable: { thread_id: secondThreadId } }
        );
        console.log(
          'Cache check — first generationId:',
          result.generationId,
          '| second generationId:',
          secondResult.generationId,
          '| match:',
          result.generationId === secondResult.generationId
        );
      }

      runs.push({ company, threadId, fit: result.roleFit.fit });
    }

    console.log('\n===== Checkpoint verification (checkpoints collection) =====');
    const checkpoints = client.db(mongoose.connection.name).collection('checkpoints');
    for (const { company, threadId, fit } of runs) {
      const count = await checkpoints.countDocuments({ thread_id: threadId });
      console.log(`${company} — branch: ${fit} — checkpoint docs for thread ${threadId}: ${count}`);
    }

    console.log('\n===== Generation cache verification (generationCache collection) =====');
    for (const { company, threadId, fit } of runs) {
      if (fit !== 'plausible') continue;
      const count = await GenerationCache.countDocuments({ applicationId: threadId, nodeName: 'tailorContent' });
      console.log(`${company} — generationCache docs for applicationId ${threadId}: ${count}`);
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
