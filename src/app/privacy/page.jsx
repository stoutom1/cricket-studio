export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <section className="privacy-hero">
        <span className="privacy-badge">🔒 Privacy & Security</span>

        <h1>Privacy Policy</h1>

        <p className="privacy-updated">
          Last Updated: <strong>August 2026</strong>
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

      <section className="privacy-card" id="advertising-and-cookies">
        <h2>📢 Advertising & Cookies</h2>

        <p>
          Cric4All may display advertising on selected public web pages using
          Google AdSense. We do not place web advertisements inside live
          scoring controls, TV Mode, account authentication or league
          administration workflows.
        </p>

        <p>
          Google and its advertising partners may use cookies, device
          identifiers or similar technologies to deliver, measure and improve
          advertisements. Depending on your location and consent choices, ads
          may be personalized or non-personalized.
        </p>

        <p>
          You can learn more about how Google uses information from sites and
          apps that use its services at{" "}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noreferrer"
          >
            Google&apos;s partner sites policy
          </a>.
        </p>
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
<section id="mobile-messaging-privacy">
  <h2>Mobile messaging information</h2>

  <p>
    Cric4All may collect a mobile phone number,
    messaging preferences, opt-in status, opt-in
    date and time, opt-out date and time, and
    related consent records when a user chooses
    to receive SMS or WhatsApp notifications.
  </p>

  <p>
    Cric4All uses this information to provide
    requested match reminders, schedule updates,
    kit reminders, league announcements, account
    notifications, security notices, and other
    Cric4All service communications.
  </p>

  <p>
    Mobile information, including mobile phone
    numbers, SMS opt-in data, and SMS consent,
    will not be shared, sold, rented, or
    transferred to third parties or affiliates
    for their own marketing or promotional
    purposes.
  </p>

  <p>
    Cric4All may disclose limited mobile
    information to service providers that help
    deliver Cric4All communications. Those
    providers may use the information only to
    provide services to Cric4All and may not use
    it for their own marketing or promotional
    purposes.
  </p>

  <p>
    Message frequency varies. Message and data
    rates may apply. Users may reply STOP to opt
    out of SMS messages or reply HELP for
    assistance.
  </p>
</section>
      <section className="privacy-card">
        <h2>📧 Contact Us</h2>

        <p>
          If you have any questions about this Privacy Policy or your personal
          information, please contact us at:
        </p>

        <a
          href="mailto:surprisecricket11@gmail.com"
          className="privacy-email"
        >
          surprisecricket11@gmail.com
        </a>
      </section>
    </main>
  );
}