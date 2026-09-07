import { Router } from 'express';
import User from '../models/User.js';
import { hashPassword, comparePassword, signToken } from '../services/authTokens.js';
import { generateResetToken, hashResetToken } from '../services/passwordResetTokens.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/signup', async (req, res) => {
  const { email, password, fullName } = req.body || {};
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof fullName !== 'string' ||
    !email.trim() ||
    !password.trim() ||
    !fullName.trim()
  ) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }
  try {
    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await User.create({ email, passwordHash, fullName: String(fullName).trim() });
    } catch (err) {
      if (err.code === 11000) {
        // Lost the TOCTOU race against a concurrent signup for the same
        // email. Never hand back the winner's account — same 409 the
        // pre-check above already uses.
        return res.status(409).json({ error: 'An account with that email already exists.' });
      }
      throw err;
    }
    const token = signToken(user._id);
    return res.status(201).json({ token, user: { id: user._id, email: user.email, fullName: user.fullName } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Invalid email or password.' });
  }
  try {
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      // Generic message on any mismatch — never reveal whether the email itself exists.
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = signToken(user._id);
    return res.json({ token, user: { id: user._id, email: user.email, fullName: user.fullName } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to log in.' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    return res.json({ user: { id: user._id, email: user.email, fullName: user.fullName } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.patch('/me', authenticate, async (req, res) => {
  const { fullName } = req.body || {};
  if (typeof fullName !== 'string' || !fullName.trim()) {
    return res.status(400).json({ error: 'fullName is required.' });
  }
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { fullName: fullName.trim() }, { new: true });
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    return res.json({ user: { id: user._id, email: user.email, fullName: user.fullName } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (
    typeof currentPassword !== 'string' ||
    typeof newPassword !== 'string' ||
    !currentPassword ||
    !newPassword
  ) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  try {
    const user = await User.findById(req.user.id);
    if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to change password.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  const genericResponse = { message: 'If that email exists, a reset link has been sent.' };
  if (typeof email !== 'string' || !email.trim()) {
    return res.json(genericResponse);
  }
  try {
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (user) {
      const { token, tokenHash, expiresAt } = generateResetToken();
      user.resetPasswordTokenHash = tokenHash;
      user.resetPasswordExpires = expiresAt;
      await user.save();
      const resetUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/reset-password/${token}`;
      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (err) {
        // A delivery failure (SMTP down, bad creds, etc.) is an external
        // hiccup, not a client-visible fault — log it, but the response
        // below must stay identical either way to preserve the
        // no-enumeration guarantee this endpoint exists for.
        console.error(err);
      }
    }
    // Always the same response, regardless of whether the user exists — no enumeration.
    return res.json(genericResponse);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Password is required.' });
  }
  try {
    const tokenHash = hashResetToken(req.params.token);
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired link.' });
    }
    user.passwordHash = await hashPassword(password);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();
    return res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

export default router;
