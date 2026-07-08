import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { OAuth2Client } from 'google-auth-library';
import { DATA } from './config-store.mjs';

const SESSION_COOKIE = 'haview_session';
const STATE_COOKIE = 'haview_oauth_state';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, in seconds
const STATE_MAX_AGE = 5 * 60; // 5 minutes, in seconds
const SECRET_FILE = join(DATA, 'session-secret');

let secretCache; // string | undefined (undefined = not loaded)

/**
 * The HMAC secret used to sign session cookies. Uses SESSION_SECRET if set,
 * otherwise generates one on first use and persists it to DATA_DIR so
 * sessions survive restarts. Cached in memory after first read.
 */
async function getSessionSecret() {
  if (secretCache !== undefined) return secretCache;
  if (process.env.SESSION_SECRET) {
    secretCache = process.env.SESSION_SECRET;
    return secretCache;
  }
  try {
    secretCache = (await readFile(SECRET_FILE, 'utf8')).trim();
    if (secretCache) return secretCache;
  } catch {
    /* not generated yet */
  }
  secretCache = randomBytes(32).toString('hex');
  await mkdir(DATA, { recursive: true });
  await writeFile(SECRET_FILE, secretCache, { mode: 0o600 });
  return secretCache;
}

/**
 * Whether OAuth is fully configured. The app fails closed: if any of these
 * are missing, every route (including /login) must refuse to serve instead
 * of running open.
 */
export function isAuthConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.ALLOWED_GOOGLE_EMAILS &&
    process.env.PUBLIC_URL
  );
}

function allowedEmails() {
  return String(process.env.ALLOWED_GOOGLE_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email) {
  return allowedEmails().includes(String(email || '').trim().toLowerCase());
}

function redirectUri() {
  return `${String(process.env.PUBLIC_URL).replace(/\/+$/, '')}/auth/google/callback`;
}

/* ---------- cookies ---------- */

/** Parse `Cookie` header into a plain object. */
export function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

/** Build a Set-Cookie header value. */
function serializeCookie(name, value, { maxAge, httpOnly = true, path = '/' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'SameSite=Lax'];
  if (httpOnly) parts.push('HttpOnly');
  parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

/** Append a Set-Cookie header to a response (preserving any already set). */
function appendSetCookie(res, cookie) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookie]);
  } else {
    res.setHeader('Set-Cookie', [existing, cookie]);
  }
}

/* ---------- session signing ---------- */

function sign(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Set the signed session cookie for a verified, allow-listed email.
 * Stateless: the cookie itself carries the email + expiry, HMAC-signed.
 */
export async function setSessionCookie(res, email) {
  const secret = await getSessionSecret();
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${email}:${expires}`;
  const sig = sign(secret, payload);
  const token = Buffer.from(`${payload}:${sig}`, 'utf8').toString('base64url');
  appendSetCookie(res, serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_MAX_AGE }));
}

/** Clear the session cookie. */
export function clearSessionCookie(res) {
  appendSetCookie(res, serializeCookie(SESSION_COOKIE, '', { maxAge: 0 }));
}

/**
 * Verify the session cookie on a request. Returns the verified session
 * { email } if valid and not expired, otherwise null.
 */
export async function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  let decoded;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const lastColon = decoded.lastIndexOf(':');
  if (lastColon === -1) return null;
  const payload = decoded.slice(0, lastColon);
  const sig = decoded.slice(lastColon + 1);
  const parts = payload.split(':');
  if (parts.length !== 2) return null;
  const [email, expiresStr] = parts;
  const expires = Number(expiresStr);
  if (!email || !Number.isFinite(expires)) return null;

  const secret = await getSessionSecret();
  const expectedSig = sign(secret, payload);
  if (!safeEqual(sig, expectedSig)) return null;
  if (Date.now() > expires) return null;
  if (!isEmailAllowed(email)) return null; // allow-list can shrink after issue

  return { email, expires };
}

/** Whether the request carries a valid session for an allow-listed email. */
export async function isAuthed(req) {
  return (await getSession(req)) !== null;
}

/* ---------- OAuth state (CSRF) ---------- */

function setStateCookie(res, state) {
  appendSetCookie(res, serializeCookie(STATE_COOKIE, state, { maxAge: STATE_MAX_AGE }));
}

function clearStateCookie(res) {
  appendSetCookie(res, serializeCookie(STATE_COOKIE, '', { maxAge: 0 }));
}

/* ---------- routes ---------- */

const NOT_CONFIGURED_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Not configured</title></head>
<body style="background:#151312;color:#f2ede8;font-family:system-ui,sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
<div style="text-align:center;max-width:32rem;padding:2rem;">
<h1 style="color:#f28c28;">Google auth is not configured</h1>
<p>This dashboard requires Google sign-in to be configured before it can be reached.
Set <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,
<code>ALLOWED_GOOGLE_EMAILS</code>, and <code>PUBLIC_URL</code> on the server, then
restart it.</p>
</div></body></html>`;

function serveNotConfigured(res) {
  res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(NOT_CONFIGURED_HTML);
}

const LOGIN_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Sign in — Oranjehuis</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="background:#151312;color:#f2ede8;font-family:system-ui,sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
<div style="background:#201d1b;border:1px solid #383330;border-radius:12px;
padding:2.5rem 3rem;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.4);
max-width:22rem;">
<h1 style="margin:0 0 0.5rem;font-size:1.4rem;">Oranjehuis</h1>
<p style="margin:0 0 1.75rem;color:#a89e95;font-size:0.95rem;">
Sign in to view the dashboard.</p>
<a href="/auth/google" style="display:inline-block;background:#f28c28;color:#1d1206;
text-decoration:none;font-weight:600;padding:0.7rem 1.5rem;border-radius:8px;
font-size:0.95rem;">Continue with Google</a>
</div></body></html>`;

/** GET /login — unauthenticated, self-contained HTML page. */
export function handleLogin(req, res) {
  if (!isAuthConfigured()) {
    serveNotConfigured(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(LOGIN_HTML);
}

/** GET /auth/google — redirect to Google's OAuth consent screen. */
export function handleAuthGoogle(req, res) {
  if (!isAuthConfigured()) {
    serveNotConfigured(res);
    return;
  }
  const state = randomBytes(16).toString('hex');
  setStateCookie(res, state);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email',
    state,
    prompt: 'select_account',
  });
  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  res.end();
}

/** GET /auth/google/callback — exchange code, verify id_token, check allow-list. */
export async function handleAuthGoogleCallback(req, res) {
  if (!isAuthConfigured()) {
    serveNotConfigured(res);
    return;
  }
  const url = new URL(req.url, 'http://internal');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = parseCookies(req);
  const expectedState = cookies[STATE_COOKIE];

  clearStateCookie(res);

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Invalid OAuth state.');
    return;
  }

  let tokenRes;
  try {
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
  } catch {
    res.writeHead(502, { 'Content-Type': 'text/plain' }).end('Could not reach Google.');
    return;
  }

  if (!tokenRes.ok) {
    res.writeHead(401, { 'Content-Type': 'text/plain' }).end('Google sign-in failed.');
    return;
  }

  const tokens = await tokenRes.json();
  if (!tokens.id_token) {
    res.writeHead(401, { 'Content-Type': 'text/plain' }).end('Google sign-in failed.');
    return;
  }

  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    res.writeHead(401, { 'Content-Type': 'text/plain' }).end('Could not verify Google identity.');
    return;
  }

  const email = payload && payload.email && payload.email_verified ? payload.email : null;
  if (!email || !isEmailAllowed(email)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Not authorized.');
    return;
  }

  await setSessionCookie(res, email);
  res.writeHead(302, { Location: '/' });
  res.end();
}

/** GET /auth/logout — clear the session cookie and redirect to /login. */
export function handleAuthLogout(req, res) {
  clearSessionCookie(res);
  res.writeHead(302, { Location: '/login' });
  res.end();
}

export const AUTH_PATHS = new Set([
  '/login',
  '/auth/google',
  '/auth/google/callback',
  '/auth/logout',
]);
