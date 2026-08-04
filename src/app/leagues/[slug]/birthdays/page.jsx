import {
  getServerSession,
} from "next-auth";
import {
  notFound,
  redirect,
} from "next/navigation";

import prisma from "@/lib/prisma";
import {
  authOptions,
} from "@/lib/auth";
import {
  requireBirthdayViewer,
} from "@/lib/leagueBirthdayAccess";

import BirthdayManager from "./BirthdayManager";

export default async function BirthdayManagementPage({
  params,
}) {
  const {
    slug,
  } = await params;

  const leagueId =
    Number(slug);

  if (
    !Number.isInteger(
      leagueId
    ) ||
    leagueId <= 0
  ) {
    notFound();
  }

  const session =
    await getServerSession(
      authOptions
    );

  if (
    !session?.user?.email
  ) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(
        `/leagues/${leagueId}/birthdays`
      )}`
    );
  }

  const access =
    await requireBirthdayViewer({
      userId:
        session.user.id,

      email:
        session.user.email,

      leagueId,
    });

  if (!access.allowed) {
    return (
      <main className="birthday-page">
        <section className="birthday-card">
          <h1>
            Birthday access unavailable
          </h1>

          <p>
            {access.error}
          </p>
        </section>
      </main>
    );
  }

  const league =
    await prisma.league
      .findUnique({
        where: {
          id:
            leagueId,
        },

        select: {
          id: true,
          name: true,
          ownerWhatsAppNumber:
            true,
          whatsappNotificationsEnabled:
            true,
        },
      });

  if (!league) {
    notFound();
  }

  return (
    <BirthdayManager
      leagueId={
        league.id
      }
      leagueName={
        league.name
      }
      readOnly={
        access.isReadOnly
      }
      accessRole={
        access.role
      }
      initialOwnerWhatsAppNumber={
        league
          .ownerWhatsAppNumber ||
        ""
      }
      initialWhatsAppNotificationsEnabled={
        Boolean(
          league
            .whatsappNotificationsEnabled
        )
      }
    />
  );
}
