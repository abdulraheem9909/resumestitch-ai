import mongoose from 'mongoose';

// No `{ _id: false }` here — unlike a single embedded object, this is an
// array of subdocuments, same shape as MasterResume's educationEntrySchema/
// projectEntrySchema, which also omit it so each entry gets its own real
// Mongo `_id`.
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  role: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  // Sets tone for a generated outreach email. Auto-guessed client-side the
  // moment Role is typed (client/src/lib/guessContactCategory.js), always
  // overridable — never silently trusted. See key-decisions-log.md.
  category: {
    type: String,
    enum: ['Leadership', 'Talent & HR', 'Employee', 'Other'],
    default: 'Other',
  },
  // Only the most recent draft — no version history, since nothing
  // downstream (export, approval) depends on tracking every past
  // generation the way the resume pipeline's tailoredBullets does.
  lastGeneratedEmail: {
    subject: { type: String },
    body: { type: String },
    generatedAt: { type: Date },
  },
});

const outreachCompanySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    companyName: { type: String, required: true, trim: true },
    location: { type: String, trim: true, default: '' },
    // Free text, optional, never fetched server-side — same treatment as
    // Application.referenceUrl (see key-decisions-log.md): just saved and
    // rendered as a clickable link client-side when it looks like a real URL.
    websiteUrl: { type: String, trim: true, default: '' },
    // Plain string, not a Mongoose ObjectId/ref — looked up manually (with
    // ownership checked) only when actually generating a Speculative email.
    // Keeping it a plain string avoids a CastError when the field is an
    // empty string (the "no resume linked" case), and keeps
    // validateOutreachCompany.js dependency-free.
    masterResumeId: { type: String, trim: true, default: '' },
    contacts: { type: [contactSchema], default: [] },
    notes: { type: String, default: '' },
    applied: { type: Boolean, default: false },
    response: {
      type: String,
      enum: ['No reply', 'Replied', 'Interview', 'Offer', 'Rejected'],
      default: 'No reply',
    },
  },
  { timestamps: true }
);

export default mongoose.model('OutreachCompany', outreachCompanySchema);
