import pool from '../lib/db';
import jwt from 'jsonwebtoken';

// Simple in-memory store for rate-limiting counts and temporary blocks.
// For production use, replace with Redis or another shared store.
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT = 100; // requests per window per IP

const stores = {
  counts: new Map(), // ip -> { firstTs, count }
  blocked: new Map(), // ip -> unblockTimestamp
};

function getIpFromReq(req) {
  // Next.js Request doesn't expose ip easily; try common headers fallback
  try {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const cf = req.headers.get('cf-connecting-ip');
    if (cf) return cf;
  } catch (e) {
    // ignore
  }
  // last resort: return unknown
  return 'unknown';
}

async function logTraffic({ userId = null, ip, route, requestCount = 1, status = 'allowed' }) {
  try {
    await pool.query(
      `INSERT INTO traffic_logs (user_id, ip_address, route, request_count, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, ip, route, requestCount, status]
    );
  } catch (err) {
    console.warn('traffic log failed', err?.message || err);
  }
}

function decodeToken(token) {
  if (!token) return null;
  try {
    // try to decode without verifying signature to get user id
    const payload = jwt.decode(token);
    return payload?.sub || payload?.userId || payload?.id || null;
  } catch (e) {
    return null;
  }
}

export async function checkTraffic(req) {
  const ip = getIpFromReq(req) || 'unknown';
  const now = Date.now();

  // check blocked
  const blockedUntil = stores.blocked.get(ip);
  if (blockedUntil && blockedUntil > now) {
    await logTraffic({ ip, route: new URL(req.url).pathname, requestCount: 0, status: 'blocked' });
    return { allowed: false, status: 429, reason: 'Temporarily blocked due to excessive requests' };
  }

  // update counts
  let entry = stores.counts.get(ip);
  if (!entry || now - entry.firstTs > RATE_WINDOW_MS) {
    entry = { firstTs: now, count: 0 };
  }
  entry.count += 1;
  stores.counts.set(ip, entry);

  // If over limit
  if (entry.count > RATE_LIMIT) {
    // block for the remainder of the window
    const unblockAt = entry.firstTs + RATE_WINDOW_MS;
    stores.blocked.set(ip, unblockAt);
    await logTraffic({ ip, route: new URL(req.url).pathname, requestCount: entry.count, status: 'throttled' });
    return { allowed: false, status: 429, reason: 'Rate limit exceeded' };
  }

  // allowed
  await logTraffic({ ip, route: new URL(req.url).pathname, requestCount: entry.count, status: 'allowed' });
  return { allowed: true };
}

// Wrapper to use in route handlers: await withTrafficHandler(req) before main logic.
export async function withTrafficHandler(req) {
  // extract token from Authorization header
  let token = null;
  try { token = req.headers.get('authorization')?.split(' ')[1] ?? null; } catch (e) { token = null; }
  const userId = decodeToken(token);
  const check = await checkTraffic(req);
  return { ...check, userId };
}

export function resetTrafficStores() {
  stores.counts.clear();
  stores.blocked.clear();
}

export default { withTrafficHandler, checkTraffic, resetTrafficStores };
