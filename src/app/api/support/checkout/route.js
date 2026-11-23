import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (typeof key !== "string" || !/^(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+$/.test(key.trim())) {
      return NextResponse.json({ error: "Contributions are not configured yet. Please check back soon." }, { status: 503 });
    }
    // Only allow checkout from Cric4All's explicitly approved production domains.
    // The return URL stays on the domain where the supporter began checkout.
    const requestOrigin = new URL(request.url).origin;
    const approvedOrigins = new Set(["https://cric4all.app", "https://cric4all.com"]);
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && !approvedOrigins.has(requestOrigin)) {
      return NextResponse.json({ error: "Invalid checkout origin." }, { status: 403 });
    }
    const siteOrigin = isProduction ? requestOrigin : new URL(process.env.NEXT_PUBLIC_SITE_URL || requestOrigin).origin;
    const body = await request.json();
    const amount = body?.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return NextResponse.json({ error: "Invalid contribution amount." }, { status: 400 });
    }
    const cents = Math.round(amount * 100);
    if (cents < 300 || !Number.isSafeInteger(cents) || Math.abs(cents / 100 - amount) > 0.000001) {
      return NextResponse.json({ error: "Amount must be at least $3 with up to two decimal places. Stripe may enforce transaction limits." }, { status: 400 });
    }
    const method = body?.paymentMethod;
    const coverFees = body?.coverFees === true;
    if (method !== "card" && method !== "ach") {
      return NextResponse.json({ error: "Choose card or bank payment." }, { status: 400 });
    }
    // Estimates based on standard US processing rates; actual fees may differ.
    // Gross-up ensures the requested contribution remains after estimated fees.
    const grossUpCard = (net) => Math.ceil((net + 30) / (1 - 0.029));
    const grossUpAch = (net) => net <= 62500 ? Math.ceil(net / (1 - 0.008)) : net + 500;
    const totalCents = coverFees ? (method === "card" ? grossUpCard(cents) : grossUpAch(cents)) : cents;
    // Stripe's USD maximum unit amount for a Checkout line item is 99,999,999 cents.
    if (!Number.isSafeInteger(totalCents) || totalCents > 99999999) {
      return NextResponse.json({ error: "This amount exceeds Stripe's supported checkout limit. Please enter a smaller amount." }, { status: 400 });
    }
    const params = new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(totalCents),
      "line_items[0][price_data][product_data][name]": "Voluntary support for Cric4All",
      "line_items[0][quantity]": "1",
      success_url: `${siteOrigin}/support/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteOrigin}/support?canceled=1`,
      "metadata[purpose]": "Cric4All development and operations support",
      "metadata[contribution_cents]": String(cents),
      "metadata[estimated_fee_cover_cents]": String(totalCents - cents),
      "metadata[payment_method_choice]": method,
      "metadata[cover_fees]": String(coverFees),
    });
    // Current Stripe API uses allowed_payment_method_types, not the retired
    // payment_method_types parameter. ACH must be enabled in Stripe Dashboard.
    params.set("allowed_payment_method_types[0]", method === "ach" ? "us_bank_account" : "card");
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
