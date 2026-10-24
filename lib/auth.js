// Passwords and sessions. Passwords are stored as salted scrypt hashes. A session is a signed token, so the server
// keeps no session table and any server instance can check it.
const crypto = require("crypto");

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const COOKIE_NAME = "sm_session";

function secret(env = process.env) {
  // A fixed value is only for local runs. A deployed copy sets SESSION_SECRET.
  return env.SESSION_SECRET || "shelfmate-local-secret";
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function passwordMatches(password, { salt, hash }) {
  const candidate = Buffer.from(hashPassword(password, salt).hash, "hex");
  const stored = Buffer.from(hash, "hex");
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

function sign(payload, env) {
  return crypto.createHmac("sha256", secret(env)).update(payload).digest("base64url");
}

function makeToken(userId, env, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: now + SESSION_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${sign(payload, env)}`;
}

// Returns the user id inside a valid, unexpired token, or null.
function readToken(token, env, now = Date.now()) {
  if (typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, env));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof sub === "string" && exp > now ? sub : null;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function sessionCookie(token, { secure }) {
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`;
  return `${COOKIE_NAME}=${token}; ${flags}`;
}

function clearCookie({ secure }) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

// The signed-in user id from the cookie or an "Authorization: Bearer" header, or null.
function userIdFrom(headers, env) {
  const bearer = /^Bearer (.+)$/.exec(String(headers.authorization || ""));
  const token = bearer ? bearer[1] : parseCookies(headers.cookie)[COOKIE_NAME];
  return readToken(token, env);
}

module.exports = {
  hashPassword, passwordMatches, makeToken, readToken, parseCookies, sessionCookie, clearCookie, userIdFrom,
};
