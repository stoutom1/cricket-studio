import MatchRepairClient from "./MatchRepairClient";

export default async function MatchRepairPage({
  params,
}) {
  const {
    id,
  } = await params;

  return (
    <MatchRepairClient
      matchId={
        Number(id)
      }
    />
  );
}
