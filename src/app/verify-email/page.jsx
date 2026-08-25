import VerifyEmailClient from "./verify-email-client";

export default async function VerifyEmailPage({
  searchParams,
}) {
  const params = await searchParams;

  return (
    <VerifyEmailClient
      initialStatus={
        params?.status || "pending"
      }
      email={params?.email || ""}
      maskedEmail={
        params?.maskedEmail || ""
      }
      callbackUrl={
        params?.callbackUrl || "/dashboard"
      }
      leagueId={params?.leagueId || ""}
      leagueName={
        params?.leagueName || ""
      }
      roleLabel={
        params?.roleLabel || ""
      }
      inviteApplied={
        params?.inviteApplied === "1"
      }
      message={params?.message || ""}
      code={params?.code || ""}
      emailSent={
        params?.emailSent !== "0"
      }
    />
  );
}
