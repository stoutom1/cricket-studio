import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LoginForm from "@/components/login-form";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;

  const session = await getServerSession(authOptions);

  const callbackUrl = params?.callbackUrl || "/dashboard";

  if (session) {
    redirect(callbackUrl || "/dashboard");
  }

  return <LoginForm callbackUrl={callbackUrl} />;
}