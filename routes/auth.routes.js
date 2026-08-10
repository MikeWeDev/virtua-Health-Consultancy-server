const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const doctorData = require('../lib/doctorData');
const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require('../lib/auth');

const router = express.Router();

function normalizeName(value = '') {
  return value
    .toString()
    .trim()
    .replace(/^dr\.??\s*/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function getDoctorIdForName(name) {
  const normalized = normalizeName(name);
  const doctor = doctorData.find((item) => normalizeName(item.Name) === normalized);
  return doctor?.id;
}

// Cookie settings for cross-domain auth between Vercel and Render
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
});

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ error: 'Missing name or password' });
    }

    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      password: hashedPassword,
      role: 'patient',
    });

    await newUser.save();

    return res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ error: 'Missing name or password' });
    }

    const user = await User.findOne({ name });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const accessToken = signAccessToken({ name: user.name, role: user.role });
    const refreshToken = signRefreshToken({ name: user.name, role: user.role });

    user.refreshToken = refreshToken;
    await user.save();

    const baseOpts = getCookieOptions();

    // Set HTTP-only access token cookie (15 mins)
    res.cookie('token', accessToken, {
      ...baseOpts,
      maxAge: 15 * 60 * 1000,
    });

    // Set HTTP-only refresh token cookie (7 days)
    res.cookie('refreshToken', refreshToken, {
      ...baseOpts,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Set readable user info cookie (7 days)
    res.cookie(
      'user',
      JSON.stringify({
        name: user.name,
        role: user.role,
        doctorId: getDoctorIdForName(user.name),
      }),
      {
        ...baseOpts,
        httpOnly: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      }
    );

    return res.json({
      message: 'Login successful',
      role: user.role,
      name: user.name,
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/me
router.get('/me', (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const payload = verifyAccessToken(token);
    return res.json({ name: payload.name, role: payload.role });
  } catch (err) {
    console.error('[api/me] route error', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/refresh
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const payload = verifyRefreshToken(refreshToken);

    const user = await User.findOne({ name: payload.name, refreshToken });
    if (!user) {
      return res.status(401).json({ error: 'Refresh token revoked or not found' });
    }

    const newAccess = signAccessToken({ name: payload.name, role: payload.role });
    const newRefresh = signRefreshToken({ name: payload.name, role: payload.role });

    user.refreshToken = newRefresh;
    await user.save();

    const baseOpts = getCookieOptions();

    res.cookie('token', newAccess, {
      ...baseOpts,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', newRefresh, {
      ...baseOpts,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie(
      'user',
      JSON.stringify({
        name: payload.name,
        role: payload.role,
        doctorId: getDoctorIdForName(payload.name),
      }),
      {
        ...baseOpts,
        httpOnly: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      }
    );

    return res.json({
      message: 'Token refreshed',
      name: payload.name,
      role: payload.role,
    });
  } catch (err) {
    console.error('Refresh error', err);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/logout
router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    try {
      const user = await User.findOne({ refreshToken });
      if (user) {
        user.refreshToken = undefined;
        await user.save();
      }
    } catch (err) {
      console.error('Logout: failed to clear refresh token', err);
    }
  }

  const baseOpts = getCookieOptions();

  res.clearCookie('token', baseOpts);
  res.clearCookie('refreshToken', baseOpts);
  res.clearCookie('user', { ...baseOpts, httpOnly: false });

  return res.json({ message: 'Logged out' });
});

module.exports = router;