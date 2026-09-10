import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  adminIsConfigured,
  createAdminSession,
  passwordIsValid,
  requestIsAdmin,
} from "@/lib/admin-auth";

export async function GET(request: Request) {
  return NextResponse.json({
    authenticated: requestIsAdmin(request),
    configured: adminIsConfigured(),
  });
}

export async function POST(request: Request) {
  if (!adminIsConfigured()) {
    return NextResponse.json(
      { error: "A senha administrativa ainda não foi configurada no servidor." },
      { status: 503 },
    );
  }
  const body = await request.json().catch(() => ({}));
  if (!passwordIsValid(body.password)) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_COOKIE, createAdminSession(), adminCookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions, maxAge: 0 });
  return response;
}
