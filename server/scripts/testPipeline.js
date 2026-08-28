import 'dotenv/config';
import mongoose from 'mongoose';
import MasterResume from '../src/models/MasterResume.js';
import ResumeBullet from '../src/models/ResumeBullet.js';
import { extractJdKeywords } from '../src/services/extractJdKeywords.js';
import { normalizeSkills } from '../src/services/normalizeSkills.js';
import { gapAnalysis } from '../src/services/gapAnalysis.js';
import { roleFitGate } from '../src/services/roleFitGate.js';
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

  const resumeRawSkills = bullets.flatMap((bullet) => bullet.skills);
  const resumeCanonical = normalizeSkills(resumeRawSkills);
  console.log('Resume canonical skills:', resumeCanonical);

  for (const { company, text } of JD_SAMPLES) {
    console.log('\n=====', company, '=====');

    const applicationId = new mongoose.Types.ObjectId().toString();
    const jdKeywords = await extractJdKeywords({ jdText: text, applicationId, resumeVersion: resume._id.toString() });
    console.log('JD keywords:', jdKeywords);

    const jdCanonical = normalizeSkills([...jdKeywords.skills, ...jdKeywords.tools]);
    console.log('JD canonical skills:', jdCanonical);

    const gaps = gapAnalysis(jdCanonical, resumeCanonical);
    console.log('Keyword gaps:', gaps);

    const fit = await roleFitGate({
      jdText: text,
      jdCanonicalSkills: jdCanonical,
      resumeCanonicalSkills: resumeCanonical,
      resumeSummary: resume.summary,
      resumeTitle: resume.personalInfo?.title,
    });
    console.log('Role fit:', fit);
  }

  await mongoose.disconnect();
  console.log('\ndone');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
