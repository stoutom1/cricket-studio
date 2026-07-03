export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <section className="privacy-hero">
        <span className="privacy-badge">🔒 Privacy & Security</span>

        <h1>Privacy Policy</h1>

        <p className="privacy-updated">
          Last Updated: <strong>July 2026</strong>
        </p>

        <p className="privacy-intro">
          At <strong>Cric4All</strong>, protecting your privacy is one of our
          highest priorities. We collect only the information required to
          provide live cricket scoring, league management, statistics and
          spectator features. We never sell your personal information.
        </p>
      </section>

      <section className="privacy-card">
        <h2>📋 Information We Collect</h2>

        <div className="privacy-grid">
          <div className="privacy-item">
            <h3>👤 Account Information</h3>
            <p>
              Your name, email address and account credentials used to create
              and manage your Cric4All account.
            </p>
          </div>

          <div className="privacy-item">
            <h3>🏏 Cricket Data</h3>
            <p>
              League, team, player, match, scorecard, statistics and commentary
              information that you create while using Cric4All.
            </p>
          </div>

          <div className="privacy-item">
            <h3>📱 Device Information</h3>
            <p>
              Basic device information required for login security, application
              performance and push notifications.
            </p>
          </div>
        </div>
      </section>

      <section className="privacy-card">
        <h2>⚡ How We Use Your Information</h2>

        <ul className="privacy-list">
          <li>Provide live cricket scoring and league management.</li>
          <li>Authenticate users securely.</li>
          <li>Generate scorecards, player statistics and match summaries.</li>
          <li>Deliver live score updates and notifications.</li>
          <li>Improve application performance and reliability.</li>
          <li>Respond to customer support requests.</li>
        </ul>
      </section>

      <section className="privacy-card">
        <h2>🤝 Data Sharing</h2>

        <p>
          Cric4All <strong>does not sell</strong> your personal information.
          Information is shared only when required to provide the service (for
          example, hosting providers, authentication services or notification
          services) or when required by law.
        </p>
      </section>

      <section className="privacy-card">
        <h2>🛡️ Data Security</h2>

        <p>
          We use industry-standard security practices to help protect your
          account and cricket data. While no online service can guarantee
          absolute security, we continually improve our systems to safeguard
          your information.
        </p>
      </section>

      <section className="privacy-card">
        <h2>🗑️ Data Deletion</h2>

        <p>
          You may request deletion of your Cric4All account and associated
          personal information by contacting our support team.
        </p>
      </section>

      <section className="privacy-card">
        <h2>📧 Contact Us</h2>

        <p>
          If you have any questions about this Privacy Policy or your personal
          information, please contact us at:
        </p>

        <a
          href="mailto:support@cric4all.app"
          className="privacy-email"
        >
          support@cric4all.app
        </a>
      </section>
    </main>
  );
}