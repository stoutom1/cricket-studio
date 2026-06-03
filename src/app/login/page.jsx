import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LoginForm from "@/components/login-form";

export default async function LoginPage({
  searchParams
}) {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  const callbackUrl =
    searchParams?.callbackUrl ||
    "/dashboard";

  return (
    <div className="center-screen">
      <section className="card login-card">
        <h1>🔐 Sign In</h1>

        <p className="muted">
          Access Cricket Studio
        </p>

        <LoginForm
          callbackUrl={callbackUrl}
        />
      </section>
    </div>
  );
}