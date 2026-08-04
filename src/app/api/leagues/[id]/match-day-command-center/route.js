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

function normalizedKitName(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isSurpriseSharedKitMatch(
  match,
  leagueName
) {
  const normalizedLeague =
    normalizedKitName(
      leagueName
    );

  if (
    normalizedLeague !==
    "surprisecricketleague"
  ) {
    return false;
  }

  const teamNames =
    new Set([
      normalizedKitName(
        match.teamA?.name
      ),
      normalizedKitName(
        match.teamB?.name
      ),
    ]);

  return (
    teamNames.size === 2 &&
    teamNames.has(
      "surprise1"
    ) &&
    teamNames.has(
      "surprise2"
    )
  );
}

function summarizeKit(
  match,
  teamKitStates = [],
  kitRotationMode = "TEAM",
  leagueName = ""
) {
  const sharedBecauseLeagueMode =
    normalizeStatus(
      kitRotationMode
    ) ===
    "LEAGUE_PLAYER";

  const sharedBecauseSurprisePair =
    isSurpriseSharedKitMatch(
      match,
      leagueName
    );

  const sharedKit =
    sharedBecauseLeagueMode ||
    sharedBecauseSurprisePair;

  const formalAssignments =
    Array.isArray(
      match.kitAssignments
    )
      ? match.kitAssignments
      : [];

  const states =
    Array.isArray(
      teamKitStates
    )
      ? teamKitStates
      : [];

  function cleanName(value) {
    const name =
      String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    return name || null;
  }

  function timestampOf(value) {
    const parsed =
      new Date(value || 0)
        .getTime();

    return Number.isFinite(
      parsed
    )
      ? parsed
      : 0;
  }

  function isMatchTeam(
    teamId
  ) {
    return (
      teamId ===
        match.teamAId ||
      teamId ===
        match.teamBId
    );
  }

  function teamNameFor(
    teamId
  ) {
    if (
      teamId ===
      match.teamAId
    ) {
      return (
        match.teamA?.name ||
        "Team A"
      );
    }

    if (
      teamId ===
      match.teamBId
    ) {
      return (
        match.teamB?.name ||
        "Team B"
      );
    }

    return "League Kit";
  }

  function scopeKeyFor(
    teamId
  ) {
    if (sharedKit) {
      return "LEAGUE";
    }

    return `TEAM:${teamId}`;
  }

  const grouped =
    new Map();

  function ensureGroup({
    teamId,
    teamName,
  }) {
    const key =
      scopeKeyFor(
        teamId
      );

    if (!grouped.has(key)) {
      grouped.set(
        key,
        {
          id: key,
          key,

          teamId:
            sharedKit
              ? null
              : teamId,

          teamName:
            sharedKit
              ? "League Kit"
              : teamName ||
                teamNameFor(
                  teamId
                ),

          currentHolderName:
            null,

          suggestedHolderName:
            null,

          assignedName:
            null,

          actualName:
            null,

          status:
            "PENDING",

          pickupStatus:
            "PENDING",

          reminderStatus:
            null,

          source:
            "NONE",

          suggestionNote:
            null,

          /*
           * Suggestions created by older Kit workflow versions may not
           * contain suggestedForMatchId. Keep priority metadata internally
           * so the selected match gets the best available team suggestion.
           */
          suggestionPriority:
            -1,

          suggestionTimestamp:
            0,

          latestTimestamp:
            0,
        }
      );
    }

    return grouped.get(key);
  }

  /*
   * Team-kit mode:
   *   include only the two teams playing this match.
   *
   * Shared-kit mode:
   *   include only the league-wide scope.
   *
   * Current holder is always relevant.
   * Suggested holder is relevant only when the suggestion belongs
   * to the selected match.
   */
  const relevantStates =
    states
      .filter(
        (state) => {
          if (sharedKit) {
            const leagueScope =
              state.teamId == null ||
              String(
                state.scopeKey || ""
              )
                .trim()
                .toUpperCase()
                .includes(
                  "LEAGUE"
                );

            /*
             * Surprise 1 and Surprise 2 share one physical kit even though
             * older/current records may still be stored against either team.
             * Include those two team rows and merge them into one League Kit.
             */
            if (
              sharedBecauseSurprisePair
            ) {
              return (
                leagueScope ||
                isMatchTeam(
                  state.teamId
                )
              );
            }

            return leagueScope;
          }

          return isMatchTeam(
            state.teamId
          );
        }
      )
      .sort(
        (left, right) =>
          timestampOf(
            left.updatedAt ||
            left.suggestedAt
          ) -
          timestampOf(
            right.updatedAt ||
            right.suggestedAt
          )
      );

  for (
    const state of
    relevantStates
  ) {
    const group =
      ensureGroup({
        teamId:
          state.teamId,

        teamName:
          teamNameFor(
            state.teamId
          ),
      });

    const currentHolder =
      cleanName(
        state.currentHolderName
      );

    if (currentHolder) {
      group.currentHolderName =
        currentHolder;
    }

    const stateTimestamp =
      timestampOf(
        state.updatedAt ||
        state.suggestedAt
      );

    const suggestedHolder =
      cleanName(
        state.suggestedHolderName
      );

    if (suggestedHolder) {
      /*
       * Priority:
       * 3 = suggestion explicitly created for this match
       * 2 = legacy/current suggestion with no match ID
       * 1 = latest team suggestion from an older/different match
       *
       * The final fallback is necessary because older Kit workflow
       * versions stored one active suggested carrier per team without
       * reliably updating suggestedForMatchId.
       */
      const suggestionPriority =
        state.suggestedForMatchId ===
          match.id
          ? 3
          : state.suggestedForMatchId ==
              null
            ? 2
            : 1;

      const shouldUseSuggestion =
        suggestionPriority >
          group.suggestionPriority ||
        (
          suggestionPriority ===
            group.suggestionPriority &&
          stateTimestamp >=
            group.suggestionTimestamp
        );

      if (shouldUseSuggestion) {
        group.suggestedHolderName =
          suggestedHolder;

        group.suggestionNote =
          state.suggestionNote ||
          null;

        group.suggestionPriority =
          suggestionPriority;

        group.suggestionTimestamp =
          stateTimestamp;
      }
    }

    group.source =
      "TEAM_KIT_STATE";

    group.latestTimestamp =
      Math.max(
        group.latestTimestamp,
        stateTimestamp
      );
  }

  /*
   * Formal assignments are match-specific and authoritative.
   * In team mode, ignore assignments for teams outside this match.
   * In shared mode, merge every shared-kit assignment into one row.
   */
  for (
    const assignment of
    formalAssignments
  ) {
    if (
      !sharedKit &&
      !isMatchTeam(
        assignment.teamId
      )
    ) {
      continue;
    }

    const group =
      ensureGroup({
        teamId:
          assignment.teamId,

        teamName:
          assignment.team
            ?.name ||
          teamNameFor(
            assignment.teamId
          ),
      });

    const assignedName =
      cleanName(
        assignment
          .rotationMember
          ?.displayName ||
        assignment
          .rotationMember
          ?.normalizedName ||
        assignment
          .matchKitPlayer
          ?.playerName ||
        assignment
          .matchKitPlayer
          ?.name
      );

    const actualName =
      cleanName(
        assignment
          .actualDisplayName ||
        assignment
          .actualRotationMember
          ?.displayName ||
        assignment
          .actualRotationMember
          ?.normalizedName ||
        assignment
          .actualMatchKitPlayer
          ?.playerName ||
        assignment
          .actualMatchKitPlayer
          ?.name
      );

    if (assignedName) {
      group.assignedName =
        assignedName;

      group.suggestedHolderName =
        group.suggestedHolderName ||
        assignedName;
    }

    if (actualName) {
      group.actualName =
        actualName;

      group.currentHolderName =
        actualName;
    }

    group.status =
      normalizeStatus(
        assignment.status
      );

    group.pickupStatus =
      normalizeStatus(
        assignment.pickupStatus
      );

    group.reminderStatus =
      assignment
        .reminderLogs?.[0]
        ?.status ||
      null;

    group.source =
      group.source ===
        "TEAM_KIT_STATE"
        ? "MERGED"
        : "KIT_ASSIGNMENT";

    group.latestTimestamp =
      Math.max(
        group.latestTimestamp,
        timestampOf(
          assignment.updatedAt ||
          assignment.createdAt
        )
      );
  }

  /*
   * Always create the two team rows in TEAM mode so a scheduled match
   * can show each team's current holder even before an assignment is made.
   */
  if (!sharedKit) {
    ensureGroup({
      teamId:
        match.teamAId,

      teamName:
        match.teamA?.name ||
        "Team A",
    });

    ensureGroup({
      teamId:
        match.teamBId,

      teamName:
        match.teamB?.name ||
        "Team B",
    });
  }

  const assignments =
    Array.from(
      grouped.values()
    )
      .sort(
        (left, right) => {
          if (sharedKit) {
            return 0;
          }

          const leftRank =
            left.teamId ===
            match.teamAId
              ? 0
              : 1;

          const rightRank =
            right.teamId ===
            match.teamAId
              ? 0
              : 1;

          return (
            leftRank -
            rightRank
          );
        }
      )
      .map(
        (assignment) => {
          const status =
            normalizeStatus(
              assignment.status
            );

          const rejected =
            [
              "DECLINED",
              "MISSED",
              "CANCELLED",
            ].includes(status);

          const currentHolderName =
            cleanName(
              assignment.actualName ||
              assignment.currentHolderName
            );

          const suggestedHolderName =
            cleanName(
              assignment.suggestedHolderName ||
              assignment.assignedName
            );

          const {
            suggestionPriority,
            suggestionTimestamp,
            ...publicAssignment
          } = assignment;

          return {
            ...publicAssignment,

            currentHolderName,

            suggestedHolderName,

            ready:
              !rejected &&
              Boolean(
                currentHolderName ||
                suggestedHolderName
              ),
          };
        }
      );

  const readyAssignments =
    assignments.filter(
      (assignment) =>
        assignment.ready
    );

  return {
    mode:
      sharedBecauseSurprisePair
        ? "SHARED_MATCH_PAIR"
        : sharedBecauseLeagueMode
          ? "LEAGUE_PLAYER"
          : "TEAM",

    total:
      assignments.length,

    confirmed:
      readyAssignments.length,

    pending:
      assignments.length -
      readyAssignments.length,

    hasCarrier:
      readyAssignments.length > 0,

    assignments,
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
    kit.hasCarrier ===
      true &&
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
            kitRotationMode: true,
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
      teamKitStates,
    ] =
      await Promise.all([
        prisma.match.findMany({
          where: {
            leagueId,

            status: {
              in: [
                "SCHEDULED",
                "scheduled",
                "UPCOMING",
                "upcoming",
                "LIVE",
                "live",
                "IN_PROGRESS",
                "in_progress",
                "IN PROGRESS",
                "in progress",
              ],
            },
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

          take: 200,

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

                matchKitPlayer: true,
                actualMatchKitPlayer: true,

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

                matchKitPlayer: true,

                actualMatchKitPlayer: true,

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

        prisma
          .teamKitState
          .findMany({
            where: {
              leagueId,
            },

            select: {
              id: true,
              teamId: true,
              scopeKey: true,
              currentHolderName: true,
              suggestedHolderName: true,
              suggestedForMatchId: true,
              suggestionNote: true,
              suggestedAt: true,
              updatedAt: true,
            },
          }),
      ]);

    const safeManualStatuses =
      Array.isArray(
        manualStatuses
      )
        ? manualStatuses
        : [];

    const safeTeamKitStates =
      Array.isArray(
        teamKitStates
      )
        ? teamKitStates
        : [];


    const activeMatches =
      matches.filter(
        (match) =>
          ![
            "COMPLETED",
            "FINISHED",
            "CANCELLED",
            "ABANDONED",
          ].includes(
            normalizeStatus(
              match.status
            )
          )
      );

    const commandMatches =
      activeMatches.map(
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
            safeManualStatuses.find(
              (status) =>
                status.matchId ===
                match.id
            ) ||
            null;

          const kit =
            summarizeKit(
              match,
              safeTeamKitStates,
              league.kitRotationMode,
              league.name
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
