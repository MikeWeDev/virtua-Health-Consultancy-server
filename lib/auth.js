const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || 'your_access_secret_key';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your_refresh_secret_key';

function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};