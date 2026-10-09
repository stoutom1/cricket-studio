import prisma from "@/lib/prisma";
import {
  absoluteCric4AllUrl,
} from "@/lib/seo";

export const dynamic =
  "force-dynamic";

function latestDate(values = []) {
  const dates =
    values
      .filter(Boolean)
      .map(
        (value) =>
          value instanceof Date
            ? value
            : new Date(value)
      )
      .filter(
        (value) =>
          !Number.isNaN(
            value.getTime()
          )
      );

  if (
    dates.length === 0
  ) {
    return new Date();
  }

  return new Date(
    Math.max(
      ...dates.map(
        (date) =>
          date.getTime()
      )
    )
  );
}

export default async function sitemap() {
  const leagues =
    await prisma.league.findMany({
      where: {
        visibility:
          "PUBLIC",
        slug: {
          not: null,
        },
      },
      select: {
        slug: true,
        createdAt: true,
        teams: {
          select: {
            id: true,
            players: {
              select: {
                id: true,
              },
            },
          },
        },
        matches: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            scheduledAt: true,
            endedAt: true,
            lockedAt: true,
            _count: {
              select: {
                balls: true,
              },
            },
          },
        },
      },
    });

  const entries = [
    {
      url:
        absoluteCric4AllUrl(
          "/"
        ),
      lastModified:
        new Date(),
      changeFrequency:
        "weekly",
      priority:
        1,
    },
    {
      url:
        absoluteCric4AllUrl(
          "/explore"
        ),
      lastModified:
        new Date(),
      changeFrequency:
        "daily",
      priority:
        0.9,
    },
    {
      url:
        absoluteCric4AllUrl(
          "/score-now"
        ),
      lastModified:
        new Date(),
      changeFrequency:
        "monthly",
      priority:
        0.8,
    },
    ...[
      ["/about", 0.7],
      ["/help", 0.7],
      ["/guides", 0.9],
      ["/guides/cricket-scoring", 0.8],
      ["/guides/league-management", 0.8],
      ["/guides/cricket-extras", 0.8],
      ["/guides/net-run-rate", 0.8],
      ["/guides/rain-dls", 0.8],
      ["/guides/super-over", 0.8],
      ["/guides/cricket-statistics", 0.8],
      ["/guides/match-day", 0.8],
      ["/contact", 0.5],
      ["/privacy", 0.4],
      ["/terms", 0.4],
    ].map(([path, priority]) => ({
      url: absoluteCric4AllUrl(path),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority,
    })),
  ];

  for (
    const league of
    leagues
  ) {
    const leagueLastModified =
      latestDate([
        league.createdAt,
        ...league.matches.flatMap(
          (match) => [
            match.createdAt,
            match.scheduledAt,
            match.endedAt,
            match.lockedAt,
          ]
        ),
      ]);

    entries.push({
      url:
        absoluteCric4AllUrl(
          `/leagues/${league.slug}`
        ),
      lastModified:
        leagueLastModified,
      changeFrequency:
        "daily",
      priority:
        0.9,
    });

    /*
     * Keep thin roster/profile URLs out of the sitemap. Completed match pages are
     * included only when they have a more substantial ball-by-ball record. This
     * is a conservative discovery threshold, not a guarantee of search quality;
     * pages should still be reviewed for unique, useful public information.
     */
    const indexableMatches = league.matches.filter((match) => {
      const status = String(match.status || "").toUpperCase();
      return (
        ["COMPLETED", "COMPLETED_LOCKED", "COMPLETED_CORRECTED"].includes(status) &&
        Number(match._count?.balls || 0) >= 30
      );
    });

    for (const match of indexableMatches) {
      entries.push({
        url: absoluteCric4AllUrl(
          `/leagues/${league.slug}/matches/${match.id}`
        ),
        lastModified: latestDate([
          match.createdAt,
          match.scheduledAt,
          match.endedAt,
          match.lockedAt,
        ]),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  const unique =
    new Map();

  for (
    const entry of
    entries
  ) {
    unique.set(
      entry.url,
      entry
    );
  }

  return Array.from(
    unique.values()
  );
}
