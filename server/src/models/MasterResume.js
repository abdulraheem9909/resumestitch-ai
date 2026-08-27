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
  skills: {
    type: [String],
    default: [],
  },
});

export default mongoose.model('MasterResume', masterResumeSchema);
