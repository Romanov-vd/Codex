import {
  scrypt as scryptCallback,
  randomBytes,
  createHash,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
export async function passwordMatches(password, encoded) {
  const [salt, key] = encoded.split(":");
  if (!salt || !key) return false;
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}
export function fail(status, message, code) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
}
export function string(value, { min = 0, max = 200 } = {}) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, "Проверьте заполненные поля.", "VALIDATION");
  return value.trim();
}
export function email(value) {
  const v = string(value, { min: 5, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    fail(400, "Введите корректный email.", "VALIDATION");
  return v;
}
export function phone(value) {
  const v = string(value, { max: 30 });
  if (
    v &&
    (!/^[+\d\s()\-]+$/.test(v) ||
      v.replace(/\D/g, "").length < 10 ||
      v.replace(/\D/g, "").length > 15)
  )
    fail(400, "Проверьте номер телефона.", "VALIDATION");
  return v;
}
export async function issueSession(db, user, res) {
  const token = randomBytes(32).toString("hex"),
    expires = new Date(Date.now() + 30 * 86400000).toISOString();
  await db.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
    [hash(token), user.id, expires],
  );
  res.setHeader(
    "Set-Cookie",
    `clinic_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.VERCEL || process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`,
  );
}
export async function currentUser(db, req) {
  const cookies = Object.fromEntries(
    (req.headers.cookie || "").split(";").map((x) => x.trim().split("=")),
  );
  const token = cookies.clinic_session;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    (
      await db.query(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>$2",
        [hash(token), new Date().toISOString()],
      )
    )[0] || null
  );
}
export async function rateLimit(db, req, limit = 12) {
  const ip = process.env.VERCEL
    ? String(req.headers["x-forwarded-for"] || "unknown").split(",")[0]
    : req.socket?.remoteAddress || "unknown";
  const ipHash = hash(ip),
    since = new Date(Date.now() - 15 * 60000).toISOString();
  await db.query("DELETE FROM auth_attempts WHERE created_at<$1", [since]);
  const [row] = await db.query(
    "SELECT COUNT(*) AS count FROM auth_attempts WHERE ip_hash=$1 AND created_at>$2",
    [ipHash, since],
  );
  if (Number(row.count) >= limit)
    fail(429, "Слишком много попыток. Повторите через 15 минут.", "RATE_LIMIT");
  await db.query(
    "INSERT INTO auth_attempts(id,ip_hash,created_at) VALUES($1,$2,$3)",
    [randomUUID(), ipHash, new Date().toISOString()],
  );
}
