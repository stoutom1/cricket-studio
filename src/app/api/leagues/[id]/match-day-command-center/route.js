import {
  getServerSession,
} from "next-auth";
import {
  NextResponse,
} from "next/server";

import {
  authOptions,
} from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";
export const revalidate = 0;

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function validDate(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function sameMinute(
  firstValue,
  secondValue
) {
  const first =
    validDate(firstValue);

  const second =
    validDate(secondValue);

  if (!first || !second) {
    return false;
  }

  return (
    Math.abs(
      first.getTime() -
      second.getTime()
    ) <
    60 * 1000
  );
}

function normalizedName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function matchTitle(match) {
  return `${match.teamA?.name || "Team A"} vs ${
    match.teamB?.name || "Team B"
  }`;
}

function pollMatchesMatch(
  poll,
  match
) {
  if (!poll || !match) {
    return false;
  }

  const titleMatches =
    normalizedName(
      poll.title
    ) ===
    normalizedName(
      matchTitle(match)
    );

  const optionMatches =
    (poll.options || []).some(
      (option) =>
        sameMinute(
          option.startTime,
          match.scheduledAt
        )
    );

  return (
    titleMatches ||
    optionMatches
  );
}

function summarizeAvailability(
  poll
) {
  if (!poll) {
    return {
      pollId: null,
      token: null,
      status: "NOT_CREATED",
      yes: 0,
      maybe: 0,
      no: 0,
      responses: 0,
      optionCount: 0,
    };
  }

  /*
   * A player can answer more than one option.
   * For the command center, use the strongest current answer:
   * YES > MAYBE > NO.
   */
  const priority = {
    YES: 3,
    MAYBE: 2,
    NO: 1,
  };

  const perPlayer =
    new Map();

  for (
    const response of
    poll.responses || []
  ) {
    const key =
      response.playerKey ||
      normalizedName(
        response.playerName
      );

    const answer =
      normalizeStatus(
        response.response
      );

    const existing =
      perPlayer.get(key);

    if (
      !existing ||
      (priority[answer] || 0) >
        (priority[existing] || 0)
    ) {
      perPlayer.set(
        key,
        answer
      );
    }
  }

  const summary = {
    pollId:
      poll.id,
    token:
      poll.token,
    status:
      normalizeStatus(
        poll.status
      ),
    yes: 0,
    maybe: 0,
    no: 0,
    responses:
      perPlayer.size,
    optionCount:
      poll.options?.length ||
      0,
  };

  for (
    const answer of
    perPlayer.values()
  ) {
    if (answer === "YES") {
      summary.yes += 1;
    } else if (
      answer === "MAYBE"
    ) {
      summary.maybe += 1;
    } else if (
      answer === "NO"
    ) {
      summary.no += 1;
    }
  }

  return summary;
}

function summarizeScore(match) {
  const inningsMap =
    new Map();

  for (
    const ball of
    match.balls || []
  ) {
    const inningsNo =
      Number(
        ball.inningsNo || 1
      );

    const current =
      inningsMap.get(
        inningsNo
      ) || {
        inningsNo,
        runs: 0,
        wickets: 0,
        legalBalls: 0,
      };

    current.runs +=
      Number(
        ball.totalRuns || 0
      );

    current.wickets +=
      Number(
        ball.isWicket || 0
      ) > 0
        ? 1
        : 0;

    current.legalBalls +=
      ball.legalDelivery
        ? 1
        : 0;

    inningsMap.set(
      inningsNo,
      current
    );
  }

  return Array.from(
    inningsMap.values()
  ).map(
    (innings) => ({
      ...innings,
      overs:
        `${Math.floor(
          innings.legalBalls / 6
        )}.${
          innings.legalBalls % 6
        }`,
    })
  );
}

function summarizeKit(match) {
  const assignments =
    match.kitAssignments || [];

  return {
    total:
      assignments.length,

    confirmed:
      assignments.filter(
        (assignment) =>
          normalizeStatus(
            assignment.status
          ) ===
          "CONFIRMED"
      ).length,

    pending:
      assignments.filter(
        (assignment) =>
          ![
            "CONFIRMED",
            "COMPLETED",
            "CANCELLED",
          ].includes(
            normalizeStatus(
              assignment.status
            )
          )
      ).length,

    assignments:
      assignments.map(
        (assignment) => ({
          id:
            assignment.id,

          teamId:
            assignment.teamId,

          teamName:
            assignment.team?.name ||
            "Team",

          status:
            normalizeStatus(
              assignment.status
            ),

          pickupStatus:
            normalizeStatus(
              assignment.pickupStatus
            ),

          assignedName:
            assignment
              .rotationMember
              ?.displayName ||
            assignment
              .rotationMember
              ?.normalizedName ||
            null,

          actualName:
            assignment
              .actualDisplayName ||
            assignment
              .actualRotationMember
              ?.displayName ||
            assignment
              .actualRotationMember
              ?.normalizedName ||
            null,

          reminderStatus:
            assignment
              .reminderLogs?.[0]
              ?.status ||
            null,
        })
      ),
  };
}

function readiness({
  match,
  availability,
  kit,
  manualStatus,
}) {
  const matchStatus =
    normalizeStatus(
      match.status
    );

  const hasSchedule =
    Boolean(
      validDate(
        match.scheduledAt
      )
    );

  const availabilityManuallyCompleted =
    manualStatus?.availabilityComplete ===
    true;

  const hasAvailability =
    availabilityManuallyCompleted ||
    (
      Boolean(
        availability.pollId
      ) &&
      availability.responses > 0
    );

  const teamsReady =
    Boolean(
      match.teamAId &&
      match.teamBId
    );

  const kitReady =
    kit.total === 0 ||
    kit.pending === 0;

  const scoringReady =
    Boolean(
      match.battingFirstTeamId
    ) ||
    [
      "LIVE",
      "IN_PROGRESS",
      "COMPLETED",
      "FINISHED",
    ].includes(
      matchStatus
    );

  const items = [
    {
      key: "SCHEDULE",
      label:
        "Schedule",
      complete:
        hasSchedule,
    },
    {
      key: "AVAILABILITY",
      label:
        "Availability",
      complete:
        hasAvailability,
    },
    {
      key: "TEAMS",
      label:
        "Teams",
      complete:
        teamsReady,
    },
    {
      key: "KIT",
      label:
        "Kit",
      complete:
        kitReady,
    },
    {
      key: "SCORING",
      label:
        "Scoring",
      complete:
        scoringReady,
    },
  ];

  const completed =
    items.filter(
      (item) =>
        item.complete
    ).length;

  return {
    completed,
    total:
      items.length,

    percentage:
      Math.round(
        (completed /
          items.length) *
          100
      ),

    items,

    availabilitySource:
      availabilityManuallyCompleted
        ? "MANUAL"
        : availability.pollId
          ? "POLL"
          : "NONE",
  };
}

export async function GET(
  request,
  {
    params,
  }
) {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    if (
      !session?.user?.email
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      id,
    } = await params;

    const leagueId =
      Number(id);

    if (
      !Number.isInteger(
        leagueId
      ) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid league ID.",
        },
        {
          status: 400,
        }
      );
    }

    const user =
      await prisma.user
        .findUnique({
          where: {
            email:
              String(
                session.user
                  .email
              )
                .trim()
                .toLowerCase(),
          },

          select: {
            id: true,
          },
        });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "User not found.",
        },
        {
          status: 404,
        }
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
            slug: true,
            ownerId: true,
          },
        });

    if (!league) {
      return NextResponse.json(
        {
          error:
            "League not found.",
        },
        {
          status: 404,
        }
      );
    }

    const isOwner =
      league.ownerId ===
      user.id;

    const member =
      isOwner
        ? null
        : await prisma
            .leagueMember
            .findFirst({
              where: {
                leagueId,
                userId:
                  user.id,
              },

              select: {
                role: true,
                canViewMatches:
                  true,
                canScoreMatch:
                  true,
                canCreateMatch:
                  true,
                canEditMatch:
                  true,
                canManagePermissions:
                  true,
              },
            });

    if (
      !isOwner &&
      !member
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this league.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      !isOwner &&
      member
        ?.canViewMatches !==
        true
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view match operations.",
        },
        {
          status: 403,
        }
      );
    }

    const now =
      new Date();

    const [
      matches,
      polls,
      manualStatuses,
    ] =
      await Promise.all([
        prisma.match.findMany({
          where: {
            leagueId,

            OR: [
              {
                scheduledAt: {
                  gte:
                    new Date(
                      now.getTime() -
                      12 *
                        60 *
                        60 *
                        1000
                    ),
                },
              },
              {
                status: {
                  in: [
                    "LIVE",
                    "live",
                    "IN_PROGRESS",
                    "in_progress",
                  ],
                },
              },
            ],
          },

          orderBy: [
            {
              scheduledAt:
                "asc",
            },
            {
              createdAt:
                "desc",
            },
          ],

          take: 20,

          include: {
            teamA: {
              select: {
                id: true,
                name: true,
              },
            },

            teamB: {
              select: {
                id: true,
                name: true,
              },
            },

            series: {
              select: {
                id: true,
                name: true,
                year: true,
              },
            },

            state: true,

            balls: {
              select: {
                inningsNo: true,
                totalRuns: true,
                isWicket: true,
                legalDelivery: true,
              },
            },

            kitAssignments: {
              orderBy: {
                updatedAt:
                  "desc",
              },

              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },

                rotationMember: {
                  select: {
                    id: true,
                    displayName: true,
                    normalizedName: true,
                  },
                },

                actualRotationMember: {
                  select: {
                    id: true,
                    displayName: true,
                    normalizedName: true,
                  },
                },

                reminderLogs: {
                  orderBy: {
                    createdAt:
                      "desc",
                  },
                  take: 1,
                  select: {
                    status: true,
                    channel: true,
                    providerStatus: true,
                  },
                },
              },
            },
          },
        }),

        prisma
          .teamAvailabilityPoll
          .findMany({
            where: {
              leagueId,

              OR: [
                {
                  status: "OPEN",
                },
                {
                  startTime: {
                    gte:
                      new Date(
                        now.getTime() -
                        7 *
                          24 *
                          60 *
                          60 *
                          1000
                      ),
                  },
                },
              ],
            },

            orderBy: {
              createdAt:
                "desc",
            },

            take: 50,

            include: {
              options: {
                orderBy: {
                  sortOrder:
                    "asc",
                },
              },

              responses: {
                select: {
                  playerKey: true,
                  playerName: true,
                  response: true,
                  updatedAt: true,
                },
              },
            },
          }),

        prisma
          .matchDayManualStatus
          .findMany({
            where: {
              leagueId,
            },

            select: {
              matchId: true,
              availabilityComplete: true,
              availabilityNote: true,
              completedByUserId: true,
              updatedAt: true,
            },
          }),
      ]);

    const commandMatches =
      matches.map(
        (match) => {
          const poll =
            polls.find(
              (candidate) =>
                pollMatchesMatch(
                  candidate,
                  match
                )
            ) ||
            null;

          const availability =
            summarizeAvailability(
              poll
            );

          const manualStatus =
            (
              manualStatuses ||
              []
            ).find(
              (status) =>
                status.matchId ===
                match.id
            ) ||
            null;

          const kit =
            summarizeKit(
              match
            );

          return {
            id:
              match.id,

            shareCode:
              match.shareCode,

            teamAId:
              match.teamAId,

            teamBId:
              match.teamBId,

            teamAName:
              match.teamA
                ?.name ||
              "Team A",

            teamBName:
              match.teamB
                ?.name ||
              "Team B",

            scheduledAt:
              match.scheduledAt,

            startedAt:
              match.startedAt,

            endedAt:
              match.endedAt,

            status:
              normalizeStatus(
                match.status
              ),

            statusText:
              match.statusText,

            oversPerInnings:
              match
                .oversPerInnings,

            battingFirstTeamId:
              match
                .battingFirstTeamId,

            series:
              match.series,

            score:
              summarizeScore(
                match
              ),

            availability: {
              ...availability,

              manuallyCompleted:
                manualStatus
                  ?.availabilityComplete ===
                true,

              manualNote:
                manualStatus
                  ?.availabilityNote ||
                null,

              manualUpdatedAt:
                manualStatus
                  ?.updatedAt ||
                null,
            },

            kit,

            readiness:
              readiness({
                match,
                availability,
                kit,
                manualStatus,
              }),
          };
        }
      );

    return NextResponse.json({
      success: true,

      league: {
        id:
          league.id,
        name:
          league.name,
        slug:
          league.slug,
      },

      permissions: {
        isOwner,

        role:
          isOwner
            ? "OWNER"
            : member?.role ||
              "MEMBER",

        canScoreMatch:
          isOwner ||
          member
            ?.canScoreMatch ===
            true,

        canCreateMatch:
          isOwner ||
          member
            ?.canCreateMatch ===
            true,

        canEditMatch:
          isOwner ||
          member
            ?.canEditMatch ===
            true,

        canManagePermissions:
          isOwner ||
          member
            ?.canManagePermissions ===
            true,
      },

      matches:
        commandMatches,

      generatedAt:
        new Date()
          .toISOString(),
    });
  } catch (error) {
    console.error(
      "[MATCH_DAY_COMMAND_CENTER_FAILED]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to load Match Day Command Center.",
      },
      {
        status: 500,
      }
    );
  }
}
