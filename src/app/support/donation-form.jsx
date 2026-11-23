"use client";
import { useEffect, useState } from "react";

const AMOUNTS = [5, 10, 25, 50];
export default function DonationForm() {
  const [amount, setAmount] = useState("10");
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
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
        body: JSON.stringify({ amount: dollars }),
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
  return <form onSubmit={donate} className="donate-form">
    <div className="donate-amounts" role="group" aria-label="Choose contribution amount">
      {AMOUNTS.map((value) => <button type="button" key={value} className={!custom && amount === String(value) ? "selected" : ""} aria-pressed={!custom && amount === String(value)} onClick={() => { setAmount(String(value)); setCustom(false); setError(""); }}>${value}</button>)}
      <button type="button" className={custom ? "selected" : ""} aria-pressed={custom} onClick={() => { setCustom(true); setAmount(""); setError(""); }}>Other amount</button>
    </div>
    {custom && <label className="donate-custom">Custom amount (USD)<input inputMode="decimal" type="number" min="3" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 15.00" /></label>}
    {status === "loading" && <p className="donate-status" role="status">Checking secure payment availability…</p>}
    {status === "unavailable" && <div className="donate-notice" role="status"><strong>Contributions are temporarily unavailable</strong><span>Secure payments are being set up. Please check back soon. You can still explore Cric4All in the meantime.</span></div>}
    {status === "unknown" && <div className="donate-notice" role="status"><strong>Unable to confirm payment availability</strong><span>Please refresh the page later. No payment has been initiated.</span></div>}
    {error && <p className="donate-error" role="alert">{error}</p>}
    <button className="donate-submit" disabled={disabled} type="submit">{busy ? "Opening secure checkout…" : status === "loading" ? "Checking availability…" : status !== "ready" ? "Contributions unavailable" : `Contribute $${amount || "…"} securely`}</button>
    <span className="donate-small">One-time contribution · No subscription · Secure checkout powered by Stripe</span>
  </form>;
}
