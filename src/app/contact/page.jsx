export default function ContactPage() {
  return (
    <div className="container">
      <div className="card">
        <h1>📧 Contact Us</h1>

        <p>
          We'd love to hear from you.
        </p>

        <div style={{ marginTop: 24 }}>
          <h3>General Support</h3>

          <p>
            Email:
            {" "}
            <a href="mailto:surprisecricket11@gmail.com">
              surprisecricket11@gmail.com
            </a>
          </p>
        </div>

        <div style={{ marginTop: 24 }}>
          <h3>League Registration</h3>

          <p>
            For league onboarding, tournament setup, and scoring support,
            contact our team using the email above.
          </p>
        </div>

        <div style={{ marginTop: 24 }}>
          <h3>Report Issues</h3>

          <p>
            Found a bug or scoring issue? Please include:
          </p>

          <ul>
            <li>League name</li>
            <li>Match ID</li>
            <li>Description of the issue</li>
            <li>Screenshots (if available)</li>
          </ul>
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "#f8fafc",
            borderRadius: 8
          }}
        >
          <strong>Response Time:</strong> Usually within 24–48 hours.
        </div>
      </div>
    </div>
  );
}