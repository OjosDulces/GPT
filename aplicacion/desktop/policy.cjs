'use strict';
const path = require('node:path');
const ORIGIN = 'ce-app://bundle';
function internalURL(value) {
  try { const u = new URL(value); return u.protocol === 'ce-app:' && u.hostname === 'bundle' && !u.port && !u.username && !u.password; } catch { return false; }
}
function externalURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && value.length < 8192; } catch { return false; }
}
function assetPath(value, root) {
  if (!internalURL(value)) return null;
  let name;
  try { name = decodeURIComponent(new URL(value).pathname); } catch { return null; }
  if (name.includes('\\') || name.includes('\0') || name.split('/').some(p => p === '..' || p === '.')) return null;
  if (name === '/' || name === '/index.html') name = '/desktop.html';
  const result = path.resolve(root, '.' + name);
  const relative = path.relative(root, result);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return result;
}
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'";
module.exports = {ORIGIN, internalURL, externalURL, assetPath, CSP};
