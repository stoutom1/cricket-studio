import Link from "next/link";
import PrintButton from "./print-button";
export const metadata = { title: "Thank You | Cric4All Support", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ThanksPage({ searchParams }) {
  const params = await searchParams;
  const id = params?.session_id;
  const key = process.env.STRIPE_SECRET_KEY;
  let session = null;
  if (key && typeof id === "string" && /^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) {
    try {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
      if (response.ok) {
        const result = await response.json();
        if (result.mode === "payment" && result.metadata?.purpose === "Cric4All development and operations support") session = result;
      }
    } catch { /* No unverified payment confirmation. */ }
  }
  const paid = session?.payment_status === "paid";
  const pending = session?.payment_status === "unpaid" && session?.status === "complete";
  const fmt = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: (session?.currency || "usd").toUpperCase() }).format(Number(cents || 0) / 100);
  return <section style={{maxWidth:650,margin:"48px auto",padding:28,borderRadius:20,background:"#0b1b2e",color:"#e7f1ff",lineHeight:1.7}}>
    <h1>{paid ? "Thank you for supporting Cric4All!" : pending ? "Your bank payment is processing" : "Checkout status"}</h1>
    <p style={{color:"#b7cbe0"}}>{paid ? "Stripe has confirmed your payment. You can save this confirmation for your records." : pending ? "ACH payments may take several business days. A receipt will be sent after Stripe confirms payment, if you provided an email." : "We couldn't confirm a completed contribution from this link. If you paid, contact support before trying again."}</p>
    {paid && <div style={{background:"#132c43",padding:18,borderRadius:12,marginBottom:18}}>
      <h2 style={{marginTop:0}}>Cric4All · Payment receipt</h2>
      <p>Receipt reference: {session.id}</p>
      <p>Contribution: {fmt(session.metadata?.contribution_cents ?? session.amount_total)}</p>
      <p>Optional processing fee support: {fmt(session.metadata?.estimated_fee_cover_cents)}</p>
      <p><strong>Total paid: {fmt(session.amount_total)}</strong></p>
      <p>Operated by VSJ Serv LLC, a for-profit business.</p>
      <p style={{fontSize:13}}>This receipt confirms payment only. It is not a charitable tax-deduction certificate, and does not establish eligibility for a charitable tax deduction.</p>
      <PrintButton />
    </div>}
    <Link style={{color:"#8bc8ff"}} href="/support">Return to Support Cric4All</Link>
  </section>;
}
