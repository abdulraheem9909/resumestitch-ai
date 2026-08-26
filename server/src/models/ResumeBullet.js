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
