"use client";
import { useState } from "react";

const AMOUNTS = [5, 10, 25, 50];
export default function DonationForm() {
  const [amount, setAmount] = useState("10");
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function donate(event) {
    event.preventDefault();
    setError("");
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 3 || dollars > 500 || Math.round(dollars * 100) !== dollars * 100) {
      setError("Enter an amount between $3 and $500, with no more than two decimal places.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/support/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: dollars }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Checkout is temporarily unavailable.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message || "Unable to start checkout. Please try again.");
      setBusy(false);
    }
  }
  return <form onSubmit={donate} className="donate-form">
    <div className="donate-amounts" aria-label="Choose contribution amount">
      {AMOUNTS.map((value) => <button type="button" key={value} className={!custom && amount === String(value) ? "selected" : ""} aria-pressed={!custom && amount === String(value)} onClick={() => { setAmount(String(value)); setCustom(false); }}>${value}</button>)}
      <button type="button" className={custom ? "selected" : ""} aria-pressed={custom} onClick={() => { setCustom(true); setAmount(""); }}>Other</button>
    </div>
    {custom && <label className="donate-custom">Custom amount (USD)<input inputMode="decimal" type="number" min="3" max="500" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 15.00" /></label>}
    {error && <p className="donate-error" role="alert">{error}</p>}
    <button className="donate-submit" disabled={busy} type="submit">{busy ? "Opening secure checkout…" : `Contribute $${amount || "…"} securely`}</button>
    <span className="donate-small">One-time payment · No recurring subscription</span>
  </form>;
}
