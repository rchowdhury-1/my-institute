const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { sendVerificationEmail } = require('../email');
const { requireAuth } = require('../middleware/auth');
const { hashPassword } = require('../utils/password');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function signAccess(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function signRefresh(userId) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

// POST /auth/register
router.post('/register', async (req, res) => {
  const { display_name, email, password, role: requestedRole, phone } = req.body;
  if (!display_name || !email || !password)
    return res.status(400).json({ error: 'display_name, email and password are required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  let role = 'student';
  if (requestedRole === 'teacher' || requestedRole === 'admin' || requestedRole === 'supervisor') {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(403).json({ error: 'Only admins can create teacher or admin accounts' });
    try {
      const payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      if (payload.role !== 'admin')
        return res.status(403).json({ error: 'Only admins can create teacher or admin accounts' });
      role = requestedRole;
    } catch {
      return res.status(403).json({ error: 'Only admins can create teacher or admin accounts' });
    }
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const verificationToken = uuidv4();
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

    await pool.query(
      'INSERT INTO users (id, display_name, email, password_hash, role, phone, email_verified, verification_token) VALUES ($1,$2,$3,$4,$5,$6,false,$7)',
      [id, display_name, email, hash, role, phone || null, verificationToken]
    );

    const verificationUrl = `${backendUrl}/auth/verify-email?token=${verificationToken}`;
    await sendVerificationEmail({ to: email, name: display_name, verificationUrl });

    res.status(201).json({ message: 'Registration successful. Please check your email to verify your account.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.email_verified)
      return res.status(403).json({ error: 'Please verify your email before logging in.' });

    if (user.is_active === false)
      return res.status(401).json({ error: 'Your account has been turned off. Please contact the institute.' });

    const accessToken = signAccess(user.id, user.role);
    const refreshToken = signRefresh(user.id);
    const refreshId = uuidv4();
    const now = new Date().toISOString();
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await pool.query(
      'INSERT INTO refresh_tokens (id, token, user_id, expires_at, created_at) VALUES ($1,$2,$3,$4,$5)',
      [refreshId, refreshToken, user.id, refreshExpiry, now]
    );

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.json({
      accessToken,
      user: {
        id: user.id, display_name: user.display_name, email: user.email, role: user.role,
        must_change_password: user.must_change_password || false,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /auth/verify-email?token=...
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  if (!token) return res.redirect(`${clientUrl}/login?verified=invalid`);

  try {
    const result = await pool.query('SELECT id FROM users WHERE verification_token=$1', [token]);
    if (result.rows.length === 0) return res.redirect(`${clientUrl}/login?verified=invalid`);

    await pool.query('UPDATE users SET email_verified=true, verification_token=NULL WHERE id=$1', [result.rows[0].id]);
    res.redirect(`${clientUrl}/login?verified=true`);
  } catch (err) {
    console.error(err);
    res.redirect(`${clientUrl}/login?verified=invalid`);
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const result = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2',
      [token, payload.userId]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid refresh token' });

    const stored = result.rows[0];
    if (new Date(stored.expires_at) < new Date()) {
      await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [stored.id]);
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [payload.userId]);
    const role = userResult.rows[0]?.role || 'student';

    res.json({ accessToken: signAccess(payload.userId, role) });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]).catch(() => {});
  }
  res.clearCookie('refreshToken', COOKIE_OPTIONS);
  res.json({ message: 'Logged out' });
});

// POST /auth/change-password — requires valid JWT; flips must_change_password to false
router.post('/change-password', requireAuth, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });

  try {
    const hash = await hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash=$1, must_change_password=false WHERE id=$2',
      [hash, req.userId]
    );
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /auth/me
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT id, display_name, email, role, phone, created_at FROM users WHERE id = $1',
      [payload.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
