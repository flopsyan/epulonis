// Edit protection with multiple user accounts. The site is public and
// read-only by default; mutations (recipes, pantry, user management) require a
// logged-in account. All accounts have the same rights.
//
// Login is only possible once at least one account exists. The first admin is
// bootstrapped from AUTH_USER/AUTH_PASSWORD; further accounts are created in the
// UI. Sessions are stateless, signed cookies (HMAC-SHA256) – no server-side
// store. The signature binds the account's password hash, so changing a
// password invalidates that account's existing sessions.

import crypto from 'node:crypto';
import { getMeta, setMeta } from '../db.js';
import {
  getUserById,
  getUserByUsername,
  verifyPassword,
  createUser,
  countUsers,
  publicUser,
} from '../models/users.js';

const COOKIE = 'epulonis-session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Stable signing secret: AUTH_SECRET if set, otherwise a random one persisted
// in the database (survives restarts; rotating it logs everyone out).
function sessionSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  let s = getMeta('session_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    setMeta('session_secret', s);
  }
  return s;
}

function sign(payload) {
  return crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

// Token layout: "<userId>.<issuedAt>.<signature>"
function makeToken(user) {
  const payload = `${user.id}.${Date.now()}`;
  return `${payload}.${sign(`${payload}.${user.pass_hash.slice(0, 16)}`)}`;
}

function userFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [idStr, issued, sig] = parts;
  const ts = Number(issued);
  if (!Number.isInteger(Number(idStr)) || !Number.isFinite(ts)) return null;
  if (Date.now() - ts >= MAX_AGE_MS) return null;

  const user = getUserById(Number(idStr));
  if (!user) return null;

  const expected = sign(`${idStr}.${issued}.${user.pass_hash.slice(0, 16)}`);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return user;
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

// Editing is only available once an account exists.
export function loginPossible() {
  return countUsers() > 0;
}

// Returns the full user row for a request (cached on req), or null.
export function currentUser(req) {
  if (req._user !== undefined) return req._user;
  req._user = userFromToken(readCookie(req, COOKIE)) || null;
  return req._user;
}

// Verifies credentials and returns the user row, or null.
export function authenticate(username, password) {
  const user = getUserByUsername(username);
  if (!user) {
    // Equalize timing a little so missing vs. wrong-password look similar.
    crypto.scryptSync(String(password ?? ''), 'x', 64);
    return null;
  }
  return verifyPassword(user, password) ? user : null;
}

export function setSessionCookie(res, req, user) {
  const secure = req.secure ? ' Secure;' : '';
  res.append(
    'Set-Cookie',
    `${COOKIE}=${makeToken(user)}; Path=/; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}; HttpOnly; SameSite=Lax;${secure}`
  );
}

export function clearSessionCookie(res, req) {
  const secure = req.secure ? ' Secure;' : '';
  res.append('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax;${secure}`);
}

// Middleware: expose the auth state to every view.
export function attachAuth(req, res, next) {
  const user = currentUser(req);
  req.user = user;
  res.locals.user = publicUser(user);
  res.locals.authed = !!user;
  res.locals.loginAvailable = loginPossible();
  next();
}

// Middleware: guard a mutating page route.
export function requireAuth(req, res, next) {
  if (currentUser(req)) return next();
  if (!loginPossible()) return res.redirect('/');
  return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || '/')}`);
}

// Middleware: guard a mutating API route (JSON instead of a redirect).
export function requireAuthApi(req, res, next) {
  if (currentUser(req)) return next();
  return res.status(loginPossible() ? 401 : 403).json({ ok: false, error: 'auth_required' });
}

// Create the first admin from AUTH_USER/AUTH_PASSWORD if it doesn't exist yet.
// Once created, the account is managed through the UI (env no longer overrides).
export function bootstrapAdmin() {
  const password = process.env.AUTH_PASSWORD;
  if (!password) return; // no bootstrap -> read-only until an account exists
  const username = (process.env.AUTH_USER || 'admin').trim();
  if (getUserByUsername(username)) return;
  const res = createUser({ username, password, display_name: username });
  if (res.user) console.log(`Bootstrapped admin account "${username}" from AUTH_PASSWORD.`);
  else console.error('Could not bootstrap admin account:', res.error);
}
