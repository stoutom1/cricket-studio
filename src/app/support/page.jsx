import { absoluteCric4AllUrl } from "@/lib/seo";
import DonationForm from "./donation-form";
import "./support.css";

export const metadata = {
  title: "Support Cric4All | Help Keep Community Cricket Scoring Available",
  description: "Make a voluntary contribution toward Cric4All development, hosting, maintenance, and improvements.",
  alternates: { canonical: absoluteCric4AllUrl("/support") },
};

export default function SupportPage() {
  return (
    <section className="donate-shell">
      <div className="donate-hero">
        <span className="donate-eyebrow">SUPPORT COMMUNITY CRICKET</span>
        <h1>Help Cric4All keep growing.</h1>
        <p>Every contribution helps us maintain and improve the tools that make local cricket easier to score, organize, and follow.</p>
      </div>
      <div className="donate-layout">
        <div className="donate-panel">
          <h2>Make a voluntary contribution</h2>
          <p>Choose an amount in USD. You will be redirected to Stripe for secure payment. You do not need a Cric4All account.</p>
          <DonationForm />
          <p className="donate-small">Payments are processed by Stripe. Cric4All does not collect or store your card or bank account details. Receipt email is optional. Cric4All is operated by VSJ Serv LLC, a for-profit company. Payments are not represented as tax-deductible charitable donations.</p>
        </div>
        <div className="donate-panel donate-explainer">
          <h2>What your support helps fund</h2>
          <ul>
            <li><strong>Hosting and infrastructure</strong><span>Servers, database services and the public website.</span></li>
            <li><strong>Product development</strong><span>Scoring tools, statistics, accessibility and new features.</span></li>
            <li><strong>Ongoing maintenance</strong><span>Bug fixes, security updates and reliability improvements.</span></li>
          </ul>
          <h3>Transparent contributions</h3>
          <p>Contributions support the operation and development of Cric4All, operated by VSJ Serv LLC. They are voluntary payments, not purchases of a product or service, and do not provide preferential treatment or additional app permissions.</p>
          <p>Cric4All is not representing these payments as tax-deductible charitable donations. Payment processor fees may apply. Contributions are generally non-refundable except where required by law or where a duplicate or mistaken payment is resolved by support.</p>
          <p>Questions about a contribution? <a href="/contact">Contact our team</a>.</p>
        </div>
      </div>
    </section>
  );
}
