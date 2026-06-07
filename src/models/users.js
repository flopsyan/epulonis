import crypto from 'node:crypto';
import db from '../db.js';

// Password hashing with the built-in scrypt (no extra dependency).
const KEYLEN = 64;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, KEYLEN).toString('hex');
  return { salt, hash };
}

export function verifyPassword(user, password) {
  if (!user || !user.pass_salt || !user.pass_hash) return false;
  const hash = crypto.scryptSync(String(password ?? ''), user.pass_salt, KEYLEN);
  const stored = Buffer.from(user.pass_hash, 'hex');
  return hash.length === stored.length && crypto.timingSafeEqual(hash, stored);
}

// Avatars are stored as small base64 data URLs (the browser resizes before
// upload). Anything else (e.g. javascript:/http: URLs) is rejected to keep the
// value safe to drop straight into an <img src>.
const AVATAR_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const AVATAR_MAX = 700 * 1024;
export function cleanAvatar(avatar) {
  const s = String(avatar || '').trim();
  if (!s || s.length > AVATAR_MAX) return '';
  return AVATAR_RE.test(s) ? s : '';
}

const USERNAME_RE = /^[A-Za-z0-9._-]{2,32}$/;
const MIN_PASSWORD = 4;

// Public projection (no password material) for sessions and templates.
export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, display_name: u.display_name, avatar: u.avatar };
}

export function countUsers() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim());
}

export function listUsers() {
  return db
    .prepare('SELECT id, username, display_name, avatar, created_at FROM users ORDER BY username COLLATE NOCASE ASC')
    .all();
}

export function createUser({ username, password, display_name, avatar } = {}) {
  const uname = String(username || '').trim();
  if (!USERNAME_RE.test(uname)) return { error: 'invalid_username' };
  if (String(password || '').length < MIN_PASSWORD) return { error: 'weak_password' };
  if (getUserByUsername(uname)) return { error: 'taken' };

  const { salt, hash } = hashPassword(password);
  const info = db
    .prepare(
      `INSERT INTO users (username, display_name, pass_hash, pass_salt, avatar)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(uname, String(display_name || '').trim() || uname, hash, salt, cleanAvatar(avatar));
  return { user: getUserById(info.lastInsertRowid) };
}

export function updateProfile(id, { display_name, avatar } = {}) {
  db.prepare(
    `UPDATE users SET display_name = ?, avatar = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(String(display_name || '').trim(), cleanAvatar(avatar), id);
  return getUserById(id);
}

export function changePassword(id, newPassword) {
  if (String(newPassword || '').length < MIN_PASSWORD) return { error: 'weak_password' };
  const { salt, hash } = hashPassword(newPassword);
  db.prepare(
    `UPDATE users SET pass_hash = ?, pass_salt = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(hash, salt, id);
  return { ok: true };
}

// Removes a user. Refuses to delete the last remaining account so the site can
// never lock itself out. Authored recipes are kept; author_id is cleared while
// the author_name snapshot remains, so they show a "deleted user" creator.
export const deleteUser = db.transaction((id) => {
  if (countUsers() <= 1) return { error: 'last_user' };
  db.prepare('UPDATE recipes SET author_id = NULL WHERE author_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return { ok: true };
});
