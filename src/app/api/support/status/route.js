import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.STRIPE_SECRET_KEY;
  const available = typeof key === "string" && /^sk_(test|live)_[A-Za-z0-9]+$/.test(key.trim());
  return NextResponse.json({ available }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
