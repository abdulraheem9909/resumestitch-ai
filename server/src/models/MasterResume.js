import mongoose from 'mongoose';

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
});

export default mongoose.model('MasterResume', masterResumeSchema);
