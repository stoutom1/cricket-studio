import crypto from "crypto";
import { normalizeLeagueRole } from "@/lib/league-role-permissions";

const VERSION = "c4a1";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("Cric4All invite signing secret is not configured.");
  return secret;
}

function sign(payloadPart) {
  return crypto.createHmac("sha256", getSecret()).update(`${VERSION}.${payloadPart}`).digest("base64url");
}

export function createLeagueInviteToken({ leagueId, role, inviterUserId, expiresAt } = {}) {
  const now = Date.now();
  const payload = {
    nonce: crypto.randomUUID(),
    leagueId: Number(leagueId),
    role: normalizeLeagueRole(role),
    inviterUserId: String(inviterUserId || ""),
    issuedAt: now,
    expiresAt: expiresAt instanceof Date ? expiresAt.getTime() : Number(expiresAt || now + DEFAULT_TTL_MS),
  };
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${VERSION}.${payloadPart}.${sign(payloadPart)}`;
}

export function verifyLeagueInviteToken(token) {
  const [version, payloadPart, signature, ...extra] = String(token || "").split(".");
  if (version !== VERSION || !payloadPart || !signature || extra.length) return { valid: false, reason: "INVALID_FORMAT" };

  const expected = Buffer.from(sign(payloadPart));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return { valid: false, reason: "INVALID_SIGNATURE" };

  let payload;
  try { payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")); }
  catch { return { valid: false, reason: "INVALID_PAYLOAD" }; }

  if (!Number.isInteger(Number(payload?.leagueId)) || Number(payload.leagueId) <= 0 || !payload?.inviterUserId || !payload?.role) {
    return { valid: false, reason: "INVALID_PAYLOAD" };
  }
  if (Number(payload.expiresAt || 0) <= Date.now()) return { valid: false, reason: "EXPIRED", payload };

  return { valid: true, payload: { ...payload, leagueId: Number(payload.leagueId), role: normalizeLeagueRole(payload.role) } };
}
