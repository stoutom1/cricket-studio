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
            createdAt: true,
            scheduledAt: true,
            endedAt: true,
            lockedAt: true,
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

    for (
      const team of
      league.teams
    ) {
      entries.push({
        url:
          absoluteCric4AllUrl(
            `/leagues/${league.slug}/teams/${team.id}`
          ),
        lastModified:
          leagueLastModified,
        changeFrequency:
          "weekly",
        priority:
          0.7,
      });

      for (
        const player of
        team.players
      ) {
        entries.push({
          url:
            absoluteCric4AllUrl(
              `/leagues/${league.slug}/players/${player.id}`
            ),
          lastModified:
            leagueLastModified,
          changeFrequency:
            "weekly",
          priority:
            0.65,
        });
      }
    }

    for (
      const match of
      league.matches
    ) {
      entries.push({
        url:
          absoluteCric4AllUrl(
            `/leagues/${league.slug}/matches/${match.id}`
          ),
        lastModified:
          latestDate([
            match.createdAt,
            match.scheduledAt,
            match.endedAt,
            match.lockedAt,
          ]),
        changeFrequency:
          match.endedAt
            ? "monthly"
            : "hourly",
        priority:
          match.endedAt
            ? 0.7
            : 0.85,
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
