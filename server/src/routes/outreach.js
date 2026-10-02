import { Router } from 'express';
import mongoose from 'mongoose';
import OutreachCompany from '../models/OutreachCompany.js';
import MasterResume from '../models/MasterResume.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateOutreachCompany, normalizeOutreachCompanyPayload } from '../services/validateOutreachCompany.js';
import { buildOutreachListQuery } from '../services/buildOutreachQuery.js';
import { generateOutreachEmail } from '../services/generateOutreachEmail.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const match = buildOutreachListQuery(req.user.id, req.query);
    const companies = await OutreachCompany.find(match).sort({ updatedAt: -1 });
    return res.json({ companies });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list outreach companies.' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid outreach company id.' });
  }
  try {
    const company = await OutreachCompany.findOne({ _id: id, userId: req.user.id });
    if (!company) return res.status(404).json({ error: 'Outreach company not found.' });
    return res.json({ company });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load outreach company.' });
  }
});

router.post('/', async (req, res) => {
  const { valid, errors } = validateOutreachCompany(req.body);
  if (!valid) return res.status(400).json({ error: errors[0], errors });

  try {
    const company = await OutreachCompany.create({
      ...normalizeOutreachCompanyPayload(req.body),
      userId: req.user.id,
    });
    return res.status(201).json({ company });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create outreach company.' });
  }
});

// The Add/Edit dialog always submits the whole record, so this is a full
// replace against the same validator POST uses — not a narrow partial-field
// patch like applications.js's PATCH /:id/summary-style routes.
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid outreach company id.' });
  }
  const { valid, errors } = validateOutreachCompany(req.body);
  if (!valid) return res.status(400).json({ error: errors[0], errors });

  try {
    const company = await OutreachCompany.findOne({ _id: id, userId: req.user.id });
    if (!company) return res.status(404).json({ error: 'Outreach company not found.' });

    Object.assign(company, normalizeOutreachCompanyPayload(req.body));
    await company.save();
    return res.json({ company });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update outreach company.' });
  }
});

// No cascade needed — this model has no LangGraph thread or generated files,
// unlike Application.
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid outreach company id.' });
  }
  try {
    const company = await OutreachCompany.findOne({ _id: id, userId: req.user.id });
    if (!company) return res.status(404).json({ error: 'Outreach company not found.' });

    await OutreachCompany.deleteOne({ _id: id });
    return res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete outreach company.' });
  }
});

// One-shot, draft-only generation — nothing is ever sent by the app. See
// key-decisions-log.md for why this has no GenerationCache, unlike the
// resume pipeline's LLM nodes.
router.post('/:id/contacts/:contactId/generate-email', async (req, res) => {
  const { id, contactId } = req.params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(contactId)) {
    return res.status(400).json({ error: 'Invalid outreach company or contact id.' });
  }

  const { goal, referralRole } = req.body;
  if (!['speculative', 'referral'].includes(goal)) {
    return res.status(400).json({ error: 'goal must be "speculative" or "referral".' });
  }
  if (goal === 'referral' && (typeof referralRole !== 'string' || !referralRole.trim())) {
    return res.status(400).json({ error: 'referralRole is required when goal is "referral".' });
  }

  try {
    const company = await OutreachCompany.findOne({ _id: id, userId: req.user.id });
    if (!company) return res.status(404).json({ error: 'Outreach company not found.' });

    const contact = company.contacts.find((c) => String(c._id) === contactId);
    if (!contact) return res.status(404).json({ error: 'Contact not found on this company.' });

    // Graceful degradation: a stale/invalid link (e.g. the linked resume was
    // since deleted) just means no resume context, not a failed request.
    let resume = null;
    if (company.masterResumeId && mongoose.isValidObjectId(company.masterResumeId)) {
      resume = await MasterResume.findOne({ _id: company.masterResumeId, userId: req.user.id });
    }

    const { subject, body } = await generateOutreachEmail({
      goal,
      referralRole: referralRole ? referralRole.trim() : '',
      companyName: company.companyName,
      contact: { name: contact.name, role: contact.role, category: contact.category },
      resume,
    });

    contact.lastGeneratedEmail = { subject, body, generatedAt: new Date() };
    await company.save();

    return res.json({ subject, body });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate this email.' });
  }
});

export default router;
