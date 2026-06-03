import CompleteProfileForm from "../../components/profile-form";

export default function Page({
  searchParams
}) {
  return (
    <CompleteProfileForm
      token={searchParams.token}
    />
  );
}