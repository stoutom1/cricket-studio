import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";
import { growthInternalLeagueIds } from "@/lib/growth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pct(part, total) {
  return total > 0
    ? Math.round((part / total) * 1000) / 10
    : 0;
}

function daysAgo(days) {
  const d = new Date();

  d.setHours(0, 0, 0, 0);
  d.setDate(
    d.getDate() - days + 1
  );

  return d;
}

function isCompletedMatch(match) {
  return Boolean(
    match?.endedAt ||
      ["COMPLETED", "COMPLETED_LOCKED"].includes(
        String(match?.status || "").toUpperCase()
      )
  );
}

function isStartedMatch(match) {
  return Boolean(
    match?.startedAt ||
      Number(match?._count?.balls || 0) > 0
  );
}

async function buildLeagueCohort({
  since,
  internalLeagueIds,
  externalOnly,
}) {
  /*
   * TRUE COHORT FUNNEL
   * ==================
   * Cohort = leagues CREATED during the selected period.
   *
   * We then ask how many of those SAME leagues:
   *   created >= 1 match
   *   started >= 1 match
   *   completed >= 1 match
   *   completed >= 2 matches
   *
   * This avoids misleading figures such as:
   *   23 matches / 3 leagues = 766.7%
   *
   * A league can only advance once at each stage, so every displayed
   * conversion remains between 0% and 100%.
   */
  const leagueWhere = {
    createdAt: {
      gte: since,
    },
  };

  if (
    externalOnly &&
    internalLeagueIds.length > 0
  ) {
    leagueWhere.id = {
      notIn: internalLeagueIds,
    };
  }

  const cohortLeagues =
    await prisma.league.findMany({
      where: leagueWhere,
      select: {
        id: true,
        ownerId: true,
      },
    });

  const leagueIds =
    cohortLeagues.map(
      (league) =>
        Number(league.id)
    );

  const organizers =
    new Set(
      cohortLeagues
        .map((league) =>
          String(league.ownerId || "")
        )
        .filter(Boolean)
    ).size;

  if (
    leagueIds.length === 0
  ) {
    return {
      organizers,
      leagues: 0,
      withMatch: 0,
      started: 0,
      completed: 0,
      repeat: 0,
      conversion: {
        leagueToMatch: 0,
        matchToStart: 0,
        startToComplete: 0,
        completeToRepeat: 0,
      },
    };
  }

  /*
   * Once a league enters the cohort, use all of its matches up to "now".
   * That answers the useful activation question:
   * "Did a league created in this period ever make it to the next stage?"
   *
   * We do not require the match itself to have been created on the league's
   * creation date.
   */
  const cohortMatches =
    await prisma.match.findMany({
      where: {
        leagueId: {
          in: leagueIds,
        },
      },
      select: {
        id: true,
        leagueId: true,
        startedAt: true,
        endedAt: true,
        status: true,
        _count: {
          select: {
            balls: true,
          },
        },
      },
    });

  const withMatch =
    new Set();

  const started =
    new Set();

  const completed =
    new Set();

  const completedCounts =
    new Map();

  for (
    const match of
    cohortMatches
  ) {
    const leagueId =
      Number(match.leagueId);

    if (
      !Number.isInteger(leagueId)
    ) {
      continue;
    }

    withMatch.add(
      leagueId
    );

    if (
      isStartedMatch(match)
    ) {
      started.add(
        leagueId
      );
    }

    if (
      isCompletedMatch(match)
    ) {
      completed.add(
        leagueId
      );

      completedCounts.set(
        leagueId,
        Number(
          completedCounts.get(
            leagueId
          ) || 0
        ) + 1
      );
    }
  }

  const repeat =
    Array.from(
      completedCounts.values()
    ).filter(
      (count) =>
        count >= 2
    ).length;

  return {
    organizers,
    leagues:
      cohortLeagues.length,
    withMatch:
      withMatch.size,
    started:
      started.size,
    completed:
      completed.size,
    repeat,
    conversion: {
      leagueToMatch:
        pct(
          withMatch.size,
          cohortLeagues.length
        ),
      matchToStart:
        pct(
          started.size,
          withMatch.size
        ),
      startToComplete:
        pct(
          completed.size,
          started.size
        ),
      completeToRepeat:
        pct(
          repeat,
          completed.size
        ),
    },
  };
}

async function buildPeriodActivity({
  since,
  internalLeagueIds,
  externalOnly,
}) {
  const matchWhere = {
    createdAt: {
      gte: since,
    },
  };

  if (
    externalOnly &&
    internalLeagueIds.length > 0
  ) {
    matchWhere.leagueId = {
      notIn:
        internalLeagueIds,
    };
  }

  const matches =
    await prisma.match.findMany({
      where:
        matchWhere,
      select: {
        id: true,
        leagueId: true,
        startedAt: true,
        endedAt: true,
        status: true,
        _count: {
          select: {
            balls: true,
          },
        },
      },
    });

  let startedMatches =
    0;

  let completedMatches =
    0;

  const completedCounts =
    new Map();

  for (
    const match of
    matches
  ) {
    if (
      isStartedMatch(match)
    ) {
      startedMatches +=
        1;
    }

    if (
      isCompletedMatch(match)
    ) {
      completedMatches +=
        1;

      const leagueId =
        Number(match.leagueId);

      if (
        Number.isInteger(
          leagueId
        )
      ) {
        completedCounts.set(
          leagueId,
          Number(
            completedCounts.get(
              leagueId
            ) || 0
          ) + 1
        );
      }
    }
  }

  const repeatLeagues =
    Array.from(
      completedCounts.values()
    ).filter(
      (count) =>
        count >= 2
    ).length;

  return {
    matches:
      matches.length,
    startedMatches,
    completedMatches,
    repeatLeagues,
  };
}

export async function GET(
  request
) {
  const session =
    await getServerSession(
      authOptions
    );

  if (
    !session?.user ||
    !isSuperAdmin(
      session
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Forbidden",
      },
      {
        status:
          403,
      }
    );
  }

  const url =
    new URL(
      request.url
    );

  const requestedDays =
    Number(
      url.searchParams.get(
        "days"
      ) || 30
    );

  const days =
    [7, 30, 90].includes(
      requestedDays
    )
      ? requestedDays
      : 30;

  const since =
    daysAgo(
      days
    );

  const internalLeagueIds =
    growthInternalLeagueIds();

  const [
    visitors,
    signups,
    allCohort,
    externalCohort,
    allActivity,
    externalActivity,
    spectatorViews,
    spectatorCtaClicks,
    spectatorScoreNowViews,
    spectatorQuickMatchStarts,
    spectatorQuickMatchCreated,
    quickMatchViews,
    quickMatchStarts,
    quickMatchAuthClicks,
    quickMatchCreated,
    recentEvents,
  ] =
    await Promise.all([
      prisma.growthEvent.groupBy({
        by: [
          "visitorId",
        ],
        where: {
          eventType:
            "LANDING_VIEW",
          createdAt: {
            gte: since,
          },
          visitorId: {
            not: null,
          },
        },
      }),

      prisma.user.count({
        where: {
          createdAt: {
            gte: since,
          },
        },
      }),

      buildLeagueCohort({
        since,
        internalLeagueIds,
        externalOnly:
          false,
      }),

      buildLeagueCohort({
        since,
        internalLeagueIds,
        externalOnly:
          true,
      }),

      buildPeriodActivity({
        since,
        internalLeagueIds,
        externalOnly:
          false,
      }),

      buildPeriodActivity({
        since,
        internalLeagueIds,
        externalOnly:
          true,
      }),

      prisma.growthEvent.count({
        where: {
          eventType:
            "SPECTATOR_VIEW",
          createdAt: {
            gte: since,
          },
        },
      }),

      prisma.growthEvent.count({
        where: {
          eventType:
            "SPECTATOR_CTA_CLICKED",
          createdAt: {
            gte: since,
          },
        },
      }),

      prisma.growthEvent.count({
        where: {
          eventType:
            "QUICK_MATCH_VIEW",
          source:
            "SPECTATOR_SCORE_NOW",
          createdAt: {
            gte: since,
          },
        },
      }),

      prisma.growthEvent.count({
        where: {
          eventType:
            "QUICK_MATCH_STARTED",
          source:
            "SPECTATOR_SCORE_NOW",
          createdAt: {
            gte: since,
          },
        },
      }),

      prisma.growthEvent.count({
        where: {
          eventType:
            "QUICK_MATCH_CREATED",
          source:
            "SPECTATOR_SCORE_NOW_CREATED",
          createdAt: {
            gte: since,
          },
        },
      }),

      prisma.growthEvent.count({
        where: {
          eventType:
            "QUICK_MATCH_VIEW",
          createdAt: {
            gte: since,
          },
        },
      }),

      prisma.growthEvent.count({
        where: {
          eventType:
            "QUICK_MATCH_STARTED",
          createdAt: {
            gte: since,
          },
        },
      }),

      prisma.growthEvent.count({
        where: {
          eventType:
            "QUICK_MATCH_AUTH_CLICKED",
          createdAt: {
            gte: since,
          },
        },
      }),

      prisma.growthEvent.count({
        where: {
          eventType:
            "QUICK_MATCH_CREATED",
          createdAt: {
            gte: since,
          },
        },
      }),

      prisma.growthEvent.findMany({
        where: {
          createdAt: {
            gte: since,
          },
        },
        orderBy: {
          createdAt:
            "desc",
        },
        take: 12,
      }),
    ]);

  return NextResponse.json({
    days,
    since:
      since.toISOString(),
    internalLeagueIds,

    all: {
      /*
       * Acquisition-wide counters. These are intentionally not represented
       * as a fabricated "external visitor" count because an anonymous visitor
       * has no league affiliation yet.
       */
      visitors:
        visitors.length,
      signups,

      cohort:
        allCohort,

      activity:
        allActivity,

      spectatorViews,
      spectatorCtaClicks,
      spectatorScoreNowViews,
      spectatorQuickMatchStarts,
      spectatorQuickMatchCreated,
      quickMatchViews,
      quickMatchStarts,
      quickMatchAuthClicks,
      quickMatchCreated,

      conversion: {
        visitorToSignup:
          pct(
            signups,
            visitors.length
          ),

        spectatorToCta:
          pct(
            spectatorCtaClicks,
            spectatorViews
          ),

        spectatorCtaToScoreNow:
          pct(
            spectatorScoreNowViews,
            spectatorCtaClicks
          ),

        spectatorScoreNowToStart:
          pct(
            spectatorQuickMatchStarts,
            spectatorScoreNowViews
          ),

        spectatorStartToCreated:
          pct(
            spectatorQuickMatchCreated,
            spectatorQuickMatchStarts
          ),

        spectatorViewToCreated:
          pct(
            spectatorQuickMatchCreated,
            spectatorViews
          ),

        quickViewToStart:
          pct(
            quickMatchStarts,
            quickMatchViews
          ),

        quickStartToCreated:
          pct(
            quickMatchCreated,
            quickMatchStarts
          ),
      },
    },

    external: {
      cohort:
        externalCohort,

      activity:
        externalActivity,
    },

    recentEvents:
      recentEvents.map(
        (event) => ({
          ...event,
          id:
            String(
              event.id
            ),
        })
      ),
  });
}
