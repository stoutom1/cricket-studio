import LoginForm from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="center-screen">
      <section className="card login-card">
        <h1>🔐 Sign In</h1>

        <p className="muted">
          Access the Cricket Scoring Dashboard
        </p>

        <LoginForm />
      </section>
    </div>
  );
}