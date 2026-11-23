import Link from "next/link";
export const metadata = { title: "Thank You | Cric4All Support", robots: { index: false, follow: false } };
export default async function ThanksPage({ searchParams }) {
  const params = await searchParams;
  const id = params?.session_id;
  const key = process.env.STRIPE_SECRET_KEY;
  let paid = false;
  if (key && typeof id === "string" && /^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) {
    try {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
      if (response.ok) {
        const session = await response.json();
        paid = session.payment_status === "paid" && session.mode === "payment" && session.metadata?.purpose === "Cric4All development and operations support";
      }
    } catch { /* Never imply payment was confirmed without verification. */ }
  }
  return <section style={{maxWidth:650,margin:"48px auto",padding:28,borderRadius:20,background:"#0b1b2e",color:"#e7f1ff"}}>
    <h1>{paid ? "Thank you for supporting Cric4All!" : "Checkout status"}</h1>
    <p style={{lineHeight:1.7,color:"#b7cbe0"}}>{paid ? "Your contribution was confirmed by our payment provider. We appreciate your help keeping Cric4All running and improving." : "We couldn't confirm a completed contribution from this link. If you paid, check your payment receipt or contact support before trying again."}</p>
    <Link style={{color:"#8bc8ff"}} href="/support">Return to Support Cric4All</Link>
  </section>;
}
