export default function DeleteAccountPage() {
  return (
    <main className="delete-account-page">
      <section className="delete-account-hero">
        <span className="delete-account-badge">🗑️ Account Deletion</span>

        <h1>Delete Your Cric4All Account</h1>

        <p>
          You can request deletion of your Cric4All account and personal
          information at any time. We process deletion requests carefully to
          protect your privacy while preserving match and league integrity.
        </p>
      </section>

      <section className="delete-account-card danger-card">
        <h2>How to request account deletion</h2>

        <p>
          Send an email from the address linked to your Cric4All account to:
        </p>

        <a
          href="mailto:surprisecricket11@gmail.com?subject=Cric4All Account Deletion Request"
          className="delete-account-email"
        >
          surprisecricket11@gmail.com
        </a>

        <p className="delete-account-note">
          Please include your name, registered email address, and mention that
          you want your Cric4All account deleted.
        </p>
      </section>

      <section className="delete-account-grid">
        <div className="delete-account-card">
          <h2>✅ Data we delete</h2>

          <ul>
            <li>Your Cric4All account information.</li>
            <li>Your profile details.</li>
            <li>Personal information associated with your account.</li>
            <li>Login-related account identifiers where deletion is allowed.</li>
          </ul>
        </div>

        <div className="delete-account-card">
          <h2>🏏 Data we may retain</h2>

          <ul>
            <li>
              Match scorecards, league records, score history, and statistics
              needed to preserve tournament integrity.
            </li>
            <li>
              Records required for security, fraud prevention, legal, or
              operational purposes.
            </li>
          </ul>
        </div>
      </section>

      <section className="delete-account-card">
        <h2>Processing time</h2>

        <p>
          Account deletion requests are typically processed within{" "}
          <strong>30 days</strong>. We may contact you to verify account
          ownership before completing the request.
        </p>
      </section>
    </main>
  );
}