import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (typeof key !== "string" || !/^(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+$/.test(key.trim())) {
      return NextResponse.json({ error: "Contributions are not configured yet. Please check back soon." }, { status: 503 });
    }
    const origin = new URL(request.url).origin;
    const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://cric4all.app");
    if (origin !== siteUrl.origin && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Invalid checkout origin." }, { status: 403 });
    }
    const body = await request.json();
    const amount = body?.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return NextResponse.json({ error: "Invalid contribution amount." }, { status: 400 });
    }
    const cents = Math.round(amount * 100);
    if (cents < 300 || cents > 50000 || Math.abs(cents / 100 - amount) > 0.000001) {
      return NextResponse.json({ error: "Amount must be between $3 and $500 with up to two decimal places." }, { status: 400 });
    }
    const params = new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(cents),
      "line_items[0][price_data][product_data][name]": "Voluntary support for Cric4All",
      "line_items[0][quantity]": "1",
      success_url: `${siteUrl.origin}/support/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl.origin}/support?canceled=1`,
      "metadata[purpose]": "Cric4All development and operations support",
    });
    const stripe = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST", headers: { Authorization: `Bearer ${key.trim()}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(), cache: "no-store",
    });
    const data = await stripe.json();
    if (!stripe.ok || !data?.url || !/^https:\/\/checkout\.stripe\.com\//.test(data.url)) {
      console.error("Stripe checkout failed", { status: stripe.status, code: data?.error?.code, type: data?.error?.type });
      return NextResponse.json({ error: "Secure checkout could not be started. Please try again later." }, { status: 502 });
    }
    return NextResponse.json({ url: data.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Support checkout error", error?.message);
    return NextResponse.json({ error: "Unable to start checkout. Please try again." }, { status: 500 });
  }
}
