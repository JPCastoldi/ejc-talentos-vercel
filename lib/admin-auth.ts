import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "ejc_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminIsConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && secret());
}

export function passwordIsValid(password: unknown) {
  if (!adminIsConfigured()) return false;
  return safeEqual(
    createHmac("sha256", secret()).update(String(password || "")).digest("hex"),
    createHmac("sha256", secret()).update(process.env.ADMIN_PASSWORD!).digest("hex"),
  );
}

export function createAdminSession() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = String(expires);
  return `${payload}.${sign(payload)}`;
}

export function requestIsAdmin(request: Request) {
  if (!adminIsConfigured()) return false;
  const cookie = request.headers.get("cookie") || "";
  const token = cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, sign(expires));
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
