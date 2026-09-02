import mongoose from 'mongoose';

const resumeBulletSchema = new mongoose.Schema({
  masterResumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MasterResume',
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  role: {
    type: String,
  },
  company: {
    type: String,
  },
  dateRange: {
    type: String,
  },
  // MongoDB's natural document order is not a guaranteed read order — without
  // this, two identical resumes could come back with their bullets in a
  // different sequence than the source document, and there is no other field
  // to sort by. Populated at creation time by every route that ever creates
  // a bullet; every route that ever reads them back sorts by it.
  order: {
    type: Number,
    default: 0,
  },
  skills: {
    type: [String],
    default: [],
  },
  canonicalSkills: {
    type: [String],
    default: [],
  },
  metrics: {
    type: [String],
    default: [],
  },
});

export default mongoose.model('ResumeBullet', resumeBulletSchema);
