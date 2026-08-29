import mongoose from 'mongoose';

const tailoredBulletSchema = new mongoose.Schema(
  {
    bulletId: String,
    sourceBulletId: String,
    generatedText: String,
    humanEditedText: { type: String, default: null },
    finalText: String,
    editSource: { type: String, enum: ['ai', 'human'] },
    rephraseIntensity: Number,
  },
  { _id: false }
);

const tailoredSummarySchema = new mongoose.Schema(
  {
    generatedText: String,
    humanEditedText: { type: String, default: null },
    finalText: String,
    editSource: { type: String, enum: ['ai', 'human'] },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    masterResumeId: { type: String, required: true },
    companyName: { type: String, required: true },
    jobTitle: { type: String, required: true },
    referenceUrl: String,
    jdSnapshot: { type: String, required: true },
    jdTextHash: { type: String, required: true },
    jdKeywords: {
      skills: [String],
      tools: [String],
      seniority: String,
    },
    jdCanonicalSkills: [String],
    keywordGaps: [String],
    coverLetterRequested: { type: Boolean, default: false },
    tailoredBullets: [tailoredBulletSchema],
    tailoredSummary: tailoredSummarySchema,
    coverLetterText: String,
    atsScore: Number,
    atsFlags: [String],
    humanRecheckAtsScore: { type: Number, default: null },
    humanRecheckAtsFlags: { type: [String], default: undefined },
    recruiterFeedback: String,
    resumeFilename: String,
    coverLetterFilename: String,
    status: {
      type: String,
      enum: ['queued', 'in_progress', 'role_mismatch', 'pending_approval', 'approved', 'logged'],
      default: 'in_progress',
    },
    retryCount: { type: Number, default: 0 },
    // section 8 has no field for human "send back with notes" text — a
    // history array so notes are never silently overwritten/dropped.
    retryNotes: { type: [{ notes: String, createdAt: { type: Date, default: Date.now } }], default: [] },
    generationMeta: {
      resumeVersion: String,
      promptVersion: String,
      model: String,
      graphVersion: String,
      generationId: String,
    },
    // Not in section 8's canonical schema (only in section 7's illustrative
    // block) — kept anyway since node 10's whole job is approval.
    approvedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

applicationSchema.index({ masterResumeId: 1, jdTextHash: 1 }, { unique: true });

export default mongoose.model('Application', applicationSchema, 'applications');
