import CompleteProfileForm from "../../components/profile-form";

export default async function Page({ searchParams }) {
  const resolvedSearchParams = await searchParams;

  return (
    <CompleteProfileForm
      token={resolvedSearchParams?.token || ""}
    />
  );
}
