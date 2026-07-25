import { notFound } from "next/navigation";

import prisma from "@/lib/prisma";
import BirthdayManager from "./BirthdayManager";

export default async function BirthdayManagementPage({
  params,
}) {
  const { slug } = await params;
  const leagueId = Number(slug);

  if (
    !Number.isInteger(leagueId) ||
    leagueId <= 0
  ) {
    notFound();
  }

  const league = await prisma.league.findUnique({
    where: {
      id: leagueId,
    },

    select: {
      id: true,
      name: true,
      ownerWhatsAppNumber: true,
      whatsappNotificationsEnabled: true,
    },
  });

  if (!league) {
    notFound();
  }

  return (
    <BirthdayManager
      leagueId={league.id}
      leagueName={league.name}
      initialOwnerWhatsAppNumber={
        league.ownerWhatsAppNumber || ""
      }
      initialWhatsAppNotificationsEnabled={
        Boolean(
          league.whatsappNotificationsEnabled
        )
      }
    />
  );
}