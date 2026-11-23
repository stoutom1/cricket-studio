"use client";
import { useEffect, useState } from "react";

const AMOUNTS = [5, 10, 25, 50];
export default function DonationForm() {
  const [amount, setAmount] = useState("10");
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [coverFees, setCoverFees] = useState(false);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/support/status", { cache: "no-store" })
      .then((res) => { if (!res.ok) throw new Error("status unavailable"); return res.json(); })
      .then((data) => { if (active) setStatus(data.available === true ? "ready" : "unavailable"); })
      .catch(() => { if (active) setStatus("unknown"); });
    return () => { active = false; };
  }, []);

  async function donate(event) {
    event.preventDefault();
    setError("");
    if (status !== "ready") return;
    const dollars = Number(amount);
    if (!amount || !Number.isFinite(dollars) || dollars < 3 || !Number.isSafeInteger(Math.round(dollars * 100)) || Math.abs(Math.round(dollars * 100) / 100 - dollars) > 0.000001) {
      setError("Enter an amount of at least $3, with no more than two decimal places. Stripe may apply transaction limits.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/support/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: dollars, paymentMethod, coverFees }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        if (response.status === 503) setStatus("unavailable");
        throw new Error(response.status === 503 ? "Contributions are temporarily unavailable. Please check back later." : (data.error || "Checkout is temporarily unavailable."));
      }
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message || "Unable to start checkout. Please try again.");
      setBusy(false);
    }
  }
  const disabled = busy || status !== "ready";
  const cents = Math.round(Number(amount || 0) * 100);
  const estimatedTotalCents = paymentMethod === "card"
    ? Math.ceil((cents + 30) / (1 - 0.029))
    : cents <= 62500 ? Math.ceil(cents / (1 - 0.008)) : cents + 500;
  const feeCents = coverFees && cents >= 300 ? Math.max(0, estimatedTotalCents - cents) : 0;
  const usd = (value) => (value / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  return <form onSubmit={donate} className="donate-form">
    <div className="donate-amounts" role="group" aria-label="Choose contribution amount">
      {AMOUNTS.map((value) => <button type="button" key={value} className={!custom && amount === String(value) ? "selected" : ""} aria-pressed={!custom && amount === String(value)} onClick={() => { setAmount(String(value)); setCustom(false); setError(""); }}>${value}</button>)}
      <button type="button" className={custom ? "selected" : ""} aria-pressed={custom} onClick={() => { setCustom(true); setAmount(""); setError(""); }}>Other amount</button>
    </div>
    {custom && <label className="donate-custom">Custom amount (USD)<input inputMode="decimal" type="number" min="3" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 15.00" /></label>}
    <fieldset className="donate-payment-method"><legend>Payment method</legend>
      <label><input type="radio" name="paymentMethod" value="card" checked={paymentMethod === "card"} onChange={() => { setPaymentMethod("card"); setError(""); }} /> Credit or debit card</label>
      <label><input type="radio" name="paymentMethod" value="ach" checked={paymentMethod === "ach"} onChange={() => { setPaymentMethod("ach"); setError(""); }} /> US bank account (ACH)</label>
    </fieldset>
    <p className="donate-small">ACH uses secure bank authorization through Stripe and may take several business days to settle. Availability depends on your Stripe account and the donor's bank.</p>
    <label className="donate-cover-fees"><input type="checkbox" checked={coverFees} onChange={(event) => setCoverFees(event.target.checked)} /> <span>I'd like to help cover estimated payment processing fees (optional)</span></label>
    {Number.isFinite(cents) && cents >= 300 && <div className="donate-total" aria-live="polite"><div><span>Contribution</span><strong>{usd(cents)}</strong></div><div><span>Optional fee contribution</span><strong>{usd(feeCents)}</strong></div><div><span>Total charged</span><strong>{usd(cents + feeCents)}</strong></div></div>}
    <p className="donate-small">Fee contribution is estimated using standard US rates; actual Stripe fees may vary. Any difference remains with Cric4All.</p>
    {status === "loading" && <p className="donate-status" role="status">Checking secure payment availability…</p>}
    {status === "unavailable" && <div className="donate-notice" role="status"><strong>Contributions are temporarily unavailable</strong><span>Secure payments are being set up. Please check back soon. You can still explore Cric4All in the meantime.</span></div>}
    {status === "unknown" && <div className="donate-notice" role="status"><strong>Unable to confirm payment availability</strong><span>Please refresh the page later. No payment has been initiated.</span></div>}
    {error && <p className="donate-error" role="alert">{error}</p>}
    <button className="donate-submit" disabled={disabled} type="submit">{busy ? "Opening secure checkout…" : status === "loading" ? "Checking availability…" : status !== "ready" ? "Contributions unavailable" : `Continue to secure checkout · ${Number.isFinite(cents) && cents >= 300 ? usd(cents + feeCents) : "Choose amount"}`}</button>
    <span className="donate-small">One-time contribution · No subscription · Secure checkout powered by Stripe</span>
  </form>;
}
