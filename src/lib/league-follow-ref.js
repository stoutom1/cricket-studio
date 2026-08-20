import prisma from "@/lib/prisma";

export function normalizeLeagueRef(
  value
) {
  return decodeURIComponent(
    String(
      value ||
      ""
    ).trim()
  );
}

export async function resolveLeagueReference(
  leagueRef
) {
  const ref =
    normalizeLeagueRef(
      leagueRef
    );

  if (!ref) {
    return null;
  }

  const numericId =
    Number(
      ref
    );

  if (
    Number.isInteger(
      numericId
    ) &&
    numericId > 0
  ) {
    const byId =
      await prisma.league.findUnique({
        where: {
          id:
            numericId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          visibility: true,
        },
      });

    if (byId) {
      return byId;
    }
  }

  return prisma.league.findFirst({
    where: {
      slug:
        ref,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      visibility: true,
    },
  });
}

/*
 * Public league access is already decided by the page that renders the
 * Follow button. Do not independently reject the same league here because
 * legacy/older visibility values can otherwise make a visibly accessible
 * league impossible to follow.
 *
 * The API only creates/removes the follower relationship; it does not expose
 * private league data.
 */
export async function resolveFollowableLeague(
  leagueRef
) {
  return resolveLeagueReference(
    leagueRef
  );
}
