import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LoginForm from "@/components/login-form";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="center-screen">
      <section className="card login-card">
        <h1>🔐 Sign in</h1>
        <p className="muted">Access the cricket scorer dashboard.</p>
        <LoginForm />
      </section>
    </div>
  );
}