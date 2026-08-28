import mongoose from 'mongoose';

const generationCacheSchema = new mongoose.Schema({
  applicationId: { type: String, required: true },
  nodeName: { type: String, required: true },
  inputHash: { type: String, required: true },
  promptVersion: { type: String, required: true },
  model: { type: String, required: true },
  resumeVersion: { type: String },
  graphVersion: { type: String },
  generationId: { type: String, required: true },
  output: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
});

generationCacheSchema.index(
  { applicationId: 1, nodeName: 1, inputHash: 1, promptVersion: 1, model: 1 },
  { unique: true }
);

export default mongoose.model('GenerationCache', generationCacheSchema, 'generationCache');
