import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>© 2026 Cric4All</div>

      <div className="site-footer-links">
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/delete-account">Delete Account</Link>
        <Link href="/contact">Contact</Link>
      </div>
    </footer>
  );
}