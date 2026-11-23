import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyStripeSignature(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => part.trim().split("=", 2)));
  const timestamp = Number(parts.t);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const digest = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const signatures = header.split(",").map((p) => p.trim()).filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    return timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(signature, "hex"));
  });
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (cents, currency) => new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "usd").toUpperCase() }).format(cents / 100);

export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return NextResponse.json({ received: true });
  const session = event.data?.object;
  if (session?.mode !== "payment" || session?.payment_status !== "paid" || session?.metadata?.purpose !== "Cric4All development and operations support") return NextResponse.json({ received: true });
  if (session.metadata.receipt_email_opt_in !== "true") return NextResponse.json({ received: true });
  const email = session.customer_email || session.customer_details?.email;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ received: true });
  if (!process.env.RESEND_API_KEY || !process.env.RECEIPT_FROM_EMAIL) {
    console.error("Receipt delivery not configured: RESEND_API_KEY and RECEIPT_FROM_EMAIL required");
    return NextResponse.json({ error: "Receipt email service not configured" }, { status: 503 });
  }
  const amount = Number(session.amount_total);
  if (!Number.isSafeInteger(amount) || amount < 0) return NextResponse.json({ received: true });
  const contribution = Number(session.metadata.contribution_cents || amount);
  const fee = Number(session.metadata.estimated_fee_cover_cents || 0);
  const date = new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
  const html = `<div style="max-width:580px;margin:auto;font-family:Arial,sans-serif;color:#18304a;line-height:1.6"><h1>Cric4All · Payment receipt</h1><p>Thank you for supporting Cric4All's development, hosting and maintenance.</p><p><strong>Receipt reference:</strong> ${esc(session.id)}<br/><strong>Date:</strong> ${esc(date)}<br/><strong>Contribution:</strong> ${esc(money(contribution,session.currency))}<br/><strong>Optional processing fee support:</strong> ${esc(money(fee,session.currency))}<br/><strong>Total paid:</strong> ${esc(money(amount,session.currency))}</p><p><strong>Operated by:</strong> VSJ Serv LLC (for-profit business)</p><p style="font-size:13px;color:#596a79">This is a payment receipt, not a charitable tax-deduction certificate. VSJ Serv LLC is not a tax-exempt charitable organization. This receipt does not establish eligibility for a charitable tax deduction.</p><p>Questions? Contact Cric4All through our website.</p></div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `cric4all-receipt-${session.id}` },
    body: JSON.stringify({ from: process.env.RECEIPT_FROM_EMAIL, to: [email], subject: "Your Cric4All contribution receipt", html }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("Receipt delivery failed", { status: response.status });
    return NextResponse.json({ error: "Receipt delivery failed" }, { status: 502 });
  }
  return NextResponse.json({ received: true });
}
