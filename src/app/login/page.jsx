import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LoginForm from "@/components/login-form";

function safeCallbackUrl(value) {
  if (!value) return "/dashboard";

  const decoded = decodeURIComponent(String(value));

  if (
    decoded.includes("/api/auth") ||
    decoded.includes("api/auth") ||
    decoded === "/login"
  ) {
    return "/dashboard";
  }

  return decoded.startsWith("/") ? decoded : "/dashboard";
}

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);

  const callbackUrl = safeCallbackUrl(params?.callbackUrl);

  if (session) {
    redirect(callbackUrl);
  }

  return <LoginForm callbackUrl={callbackUrl} />;
}