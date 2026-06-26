export default function ContactPage() {
  return (
    <main className="contact-page">
      <section className="contact-hero-card">
        <div className="contact-hero-glow" />

        <div className="contact-kicker">🏏 Cric4All Support</div>

        <h1>Contact Us</h1>

        <p>
          Need help with league setup, live scoring, match corrections, or app
          support? We are here to help.
        </p>

        <div className="contact-primary-actions">
          <a
            className="contact-email-btn"
            href="mailto:surprisecricket11@gmail.com?subject=Cric4All Support Request"
          >
            📧 Email Support
          </a>

          <a
            className="contact-outline-btn"
            href="mailto:surprisecricket11@gmail.com?subject=League Registration Help"
          >
            🏆 League Onboarding
          </a>
        </div>
      </section>

      <section className="contact-grid">
        <div className="contact-info-card featured">
          <span>📧</span>
          <h3>General Support</h3>
          <p>
            Questions about login, setup, scoring, teams, matches, or your
            account.
          </p>
          <a href="mailto:surprisecricket11@gmail.com">
            surprisecricket11@gmail.com
          </a>
        </div>

        <div className="contact-info-card">
          <span>🏆</span>
          <h3>League Registration</h3>
          <p>
            Get help onboarding your league, setting up teams, creating
            tournaments, and inviting scorers.
          </p>
        </div>

        <div className="contact-info-card">
          <span>🐞</span>
          <h3>Report Scoring Issues</h3>
          <p>
            Found a scoring bug or incorrect scorecard? Send league name, match
            ID, issue details, and screenshots.
          </p>
        </div>

        <div className="contact-info-card">
          <span>⚡</span>
          <h3>Response Time</h3>
          <p>
            We usually respond within <strong>24–48 hours</strong>. Critical
            match-scoring issues are prioritized.
          </p>
        </div>
      </section>

      <section className="contact-checklist-card">
        <div>
          <h2>Help us solve your issue faster</h2>
          <p>When reporting a match or scoring issue, please include:</p>
        </div>

        <div className="contact-checklist">
          <span>✅ League name</span>
          <span>✅ Match ID</span>
          <span>✅ Issue description</span>
          <span>✅ Screenshots if available</span>
        </div>
      </section>
    </main>
  );
}