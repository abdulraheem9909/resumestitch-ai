import mongoose from 'mongoose';

const personalInfoSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: '' },
    title: { type: String, default: '' },
    location: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    portfolio: { type: String, default: '' },
  },
  { _id: false }
);

const educationEntrySchema = new mongoose.Schema({
  degree: { type: String, default: '' },
  institution: { type: String, default: '' },
  location: { type: String, default: '' },
  dateRange: { type: String, default: '' },
});

const projectEntrySchema = new mongoose.Schema({
  name: { type: String, default: '' },
  description: { type: String, default: '' },
  // Extracted the same way a resume bullet's skills are (tagBullet, read-only,
  // never rephrased) — feeds gap analysis and the role-fit gate alongside
  // resumeBullets' own canonicalSkills, but is never itself eligible for
  // node 5's tailoring/selection pool. See key-decisions-log.md.
  canonicalSkills: { type: [String], default: [] },
});

// Certifications and volunteer work: static, verbatim, never tailored per JD —
// same category as education/projects. Deliberately no canonicalSkills here
// (unlike projectEntrySchema): neither is skill-tagged, so neither feeds gap
// analysis, ATS scoring, or fabrication verification. See key-decisions-log.md.
const certificationEntrySchema = new mongoose.Schema({
  name: { type: String, default: '' },
  issuer: { type: String, default: '' },
  date: { type: String, default: '' },
});

const volunteerWorkEntrySchema = new mongoose.Schema({
  role: { type: String, default: '' },
  organization: { type: String, default: '' },
  dateRange: { type: String, default: '' },
  description: { type: String, default: '' },
});

const masterResumeSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['active', 'deleted'],
    default: 'active',
  },
  personalInfo: {
    type: personalInfoSchema,
    default: () => ({}),
  },
  summary: {
    type: String,
    default: '',
  },
  education: {
    type: [educationEntrySchema],
    default: [],
  },
  projects: {
    type: [projectEntrySchema],
    default: [],
  },
  certifications: {
    type: [certificationEntrySchema],
    default: [],
  },
  volunteerWork: {
    type: [volunteerWorkEntrySchema],
    default: [],
  },
  skills: {
    type: [String],
    default: [],
  },
});

export default mongoose.model('MasterResume', masterResumeSchema);
