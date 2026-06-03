import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  console.log("Session in HomePage:", session);
  redirect(session ? "/dashboard" : "/login");
}