import ResetPasswordForm from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams
}) {
  const params =
    await searchParams;

  const token =
    params?.token || "";

  return (
    <ResetPasswordForm
      token={token}
    />
  );
}