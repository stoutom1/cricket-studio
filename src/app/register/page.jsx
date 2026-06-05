import RegisterForm from "./register-form";

export default async function RegisterPage({
  searchParams
}) {
  const params = await searchParams;

  return (
    <RegisterForm
      callbackUrl={
        params?.callbackUrl || null
      }
    />
  );
}