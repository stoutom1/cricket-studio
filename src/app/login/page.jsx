import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LoginForm from "@/components/login-form";

function safeCallbackUrl(value) {
  if (!value) return "/dashboard";

  let decoded = decodeURIComponent(String(value));

  try {
    if (decoded.startsWith("http")) {
      const url = new URL(decoded);
      decoded = url.pathname + url.search;
    }
  } catch {
    decoded = "/dashboard";
  }

  if (
    decoded.includes("/api/auth") ||
    decoded === "/login" ||
    decoded.startsWith("/login?")
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