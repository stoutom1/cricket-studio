import crypto from "crypto";
import {
  NextResponse,
} from "next/server";
import {
  getServerSession,
} from "next-auth";
import prisma from "@/lib/prisma";
import {
  authOptions,
} from "@/lib/auth";
import {
  recordGrowthEvent,
} from "@/lib/growth";

export const runtime =
  "nodejs";

function cleanName(
  value,
  fallback = "",
  max = 70
) {
  const text =
    String(
      value ||
      ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return (
    text ||
    fallback
  ).slice(
    0,
    max
  );
}

function slugify(
  value
) {
  return String(
    value ||
    ""
  )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /(^-|-$)/g,
      ""
    );
}

function normalizePlayers(
  value,
  teamName
) {
  const input =
    Array.isArray(
      value
    )
      ? value
      : [];

  const seen =
    new Set();

  const names =
    input
      .map((name) =>
        cleanName(
          name,
          "",
          70
        )
      )
      .filter(Boolean)
      .filter((name) => {
        const key =
          name.toLowerCase();

        if (
          seen.has(key)
        ) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .slice(
        0,
        25
      );

  /*
   * The normal delivery setup needs two batters and at least one bowler.
   * Two temporary players per team keeps Quick Match genuinely quick while
   * preserving the existing scorer workflow. They can be renamed later.
   */
  while (
    names.length <
    2
  ) {
    const candidate =
      `${teamName} Player ${names.length + 1}`;

    const key =
      candidate.toLowerCase();

    if (
      !seen.has(key)
    ) {
      seen.add(key);
      names.push(
        candidate
      );
    }
  }

  return names;
}

async function uniqueLeagueIdentity(
  tx,
  preferredName,
  userId
) {
  const baseName =
    cleanName(
      preferredName,
      "My Cricket League",
      70
    );

  for (
    let attempt = 0;
    attempt < 10;
    attempt += 1
  ) {
    const suffix =
      attempt === 0
        ? ""
        : ` ${attempt + 1}`;

    const name =
      `${baseName}${suffix}`
        .slice(
          0,
          80
        );

    const baseSlug =
      slugify(name) ||
      "my-cricket-league";

    const slugSuffix =
      crypto
        .randomBytes(3)
        .toString(
          "hex"
        );

    const slug =
      `${baseSlug}-${slugSuffix}`
        .slice(
          0,
          110
        );

    const conflict =
      await tx.league.findFirst({
        where: {
          OR: [
            {
              name,
            },
            {
              slug,
            },
          ],
        },
        select: {
          id: true,
        },
      });

    if (
      !conflict
    ) {
      return {
        name,
        slug,
      };
    }
  }

  const shortUser =
    String(
      userId ||
      ""
    )
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .slice(
        0,
        6
      ) ||
    Date.now()
      .toString()
      .slice(
        -6
      );

  return {
    name:
      `${baseName} ${shortUser}`
        .slice(
          0,
          80
        ),
    slug:
      `${slugify(
        baseName
      )}-${shortUser}-${crypto.randomBytes(2).toString("hex")}`
        .slice(
          0,
          110
        ),
  };
}

const OWNER_PERMISSIONS = {
  role:
    "OWNER",

  canViewDashboard:
    true,
  canViewManagement:
    true,
  canViewMatches:
    true,
  canViewScoring:
    true,
  canViewStats:
    true,

  canCreateLeague:
    true,
  canEditLeague:
    true,
  canDeleteLeague:
    true,
  canManageMembers:
    true,
  canManagePermissions:
    true,

  canCreateTeam:
    true,
  canEditTeam:
    true,
  canDeleteTeam:
    true,

  canCreatePlayer:
    true,
  canEditPlayer:
    true,
  canDeletePlayer:
    true,

  canCreateMatch:
    true,
  canEditMatch:
    true,
  canDeleteMatch:
    true,
  canEndMatch:
    true,
  canAbandonMatch:
    true,
  canLockMatch:
    true,

  canScoreMatch:
    true,
  canEditScore:
    true,
  canUndoBall:
    true,
  canSwapStrike:
    true,
  canRetirePlayer:
    true,

  canExportStats:
    true,
  canViewAuditLogs:
    true,

  canUseTeamBuilder:
    true,
  canCreateAvailabilityPoll:
    true,
};

export async function POST(
  request
) {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    if (
      !session
        ?.user
        ?.email
    ) {
      return NextResponse.json(
        {
          error:
            "Sign in to create this match. Your Quick Match setup can remain saved on the device.",
        },
        {
          status:
            401,
        }
      );
    }

    const user =
      await prisma.user.findUnique({
        where: {
          email:
            session.user.email,
        },
        select: {
          id: true,
          activeLeagueId: true,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "User account was not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const body =
      await request.json();

    const teamAName =
      cleanName(
        body?.teamAName,
        "",
        60
      );

    const teamBName =
      cleanName(
        body?.teamBName,
        "",
        60
      );

    const overs =
      Number(
        body?.overs
      );

    const useActiveLeague =
      body
        ?.useActiveLeague ===
      true;

    if (
      !teamAName ||
      !teamBName
    ) {
      return NextResponse.json(
        {
          error:
            "Enter both team names.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      teamAName
        .toLowerCase() ===
      teamBName
        .toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            "The two teams need different names.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      !Number.isInteger(
        overs
      ) ||
      overs < 1 ||
      overs > 100
    ) {
      return NextResponse.json(
        {
          error:
            "Overs per innings must be between 1 and 100.",
        },
        {
          status:
            400,
        }
      );
    }

    const teamAPlayers =
      normalizePlayers(
        body
          ?.teamAPlayers,
        teamAName
      );

    const teamBPlayers =
      normalizePlayers(
        body
          ?.teamBPlayers,
        teamBName
      );

    const result =
      await prisma.$transaction(
        async (
          tx
        ) => {
          let leagueId =
            null;

          let createdLeague =
            false;

          if (
            useActiveLeague &&
            user
              .activeLeagueId
          ) {
            const membership =
              await tx.leagueMember.findUnique({
                where: {
                  userId_leagueId: {
                    userId:
                      user.id,
                    leagueId:
                      Number(
                        user
                          .activeLeagueId
                      ),
                  },
                },
                select: {
                  role: true,
                  canCreateTeam:
                    true,
                  canCreateMatch:
                    true,
                },
              });

            if (
              !membership ||
              !(
                membership
                  .role ===
                  "OWNER" ||
                (
                  membership
                    .canCreateTeam &&
                  membership
                    .canCreateMatch
                )
              )
            ) {
              throw new Error(
                "Your active league does not allow you to create both teams and matches."
              );
            }

            leagueId =
              Number(
                user
                  .activeLeagueId
              );
          } else {
            const identity =
              await uniqueLeagueIdentity(
                tx,
                body
                  ?.leagueName,
                user.id
              );

            const league =
              await tx.league.create({
                data: {
                  name:
                    identity.name,
                  slug:
                    identity.slug,
                  ownerId:
                    user.id,
                  visibility:
                    "PRIVATE",
                },
              });

            leagueId =
              league.id;

            createdLeague =
              true;

            await tx.leagueMember.create({
              data: {
                userId:
                  user.id,
                leagueId:
                  league.id,
                ...OWNER_PERMISSIONS,
              },
            });
          }

          const existingTeam =
            await tx.team.findFirst({
              where: {
                leagueId,
                name: {
                  in: [
                    teamAName,
                    teamBName,
                  ],
                },
              },
              select: {
                id: true,
                name: true,
              },
            });

          if (
            existingTeam
          ) {
            throw new Error(
              `Team "${existingTeam.name}" already exists in this league. Use different names or create the match from the normal Matches tab.`
            );
          }

          const teamA =
            await tx.team.create({
              data: {
                leagueId,
                name:
                  teamAName,
              },
            });

          const teamB =
            await tx.team.create({
              data: {
                leagueId,
                name:
                  teamBName,
              },
            });

          await tx.player.createMany({
            data: [
              ...teamAPlayers.map(
                (
                  name
                ) => ({
                  name,
                  teamId:
                    teamA.id,
                })
              ),

              ...teamBPlayers.map(
                (
                  name
                ) => ({
                  name,
                  teamId:
                    teamB.id,
                })
              ),
            ],
          });

          const match =
            await tx.match.create({
              data: {
                leagueId,
                teamAId:
                  teamA.id,
                teamBId:
                  teamB.id,

                /*
                 * Deliberately leave batting first unset. The existing
                 * Start Match modal remains the single source of truth for
                 * toss/batting-first selection.
                 */
                battingFirstTeamId:
                  null,

                oversPerInnings:
                  overs,

                /*
                 * Do not invent a powerplay rule in the frictionless path.
                 * The scorer can edit the match later if the competition
                 * uses one.
                 */
                powerplayOversInnings:
                  0,

                maxWicketsPerInnings:
                  null,
                maxOversPerBowler:
                  null,

                status:
                  "SCHEDULED",
                statusText:
                  "SCHEDULED",
                scheduledAt:
                  new Date(),
                startedAt:
                  null,
                endedAt:
                  null,
                lockedAt:
                  null,

                shareCode:
                  crypto
                    .randomBytes(
                      5
                    )
                    .toString(
                      "base64url"
                    ),
              },
            });

          await tx.user.update({
            where: {
              id:
                user.id,
            },
            data: {
              activeLeagueId:
                leagueId,
              activeMatchId:
                match.id,
            },
          });

          return {
            leagueId,
            matchId:
              match.id,
            teamAId:
              teamA.id,
            teamBId:
              teamB.id,
            createdLeague,
            playerCount:
              teamAPlayers.length +
              teamBPlayers.length,
          };
        }
      );

    /*
     * Analytics are intentionally OUTSIDE the transaction. A tracking failure
     * must never roll back a valid match.
     */
    if (
      result
        .createdLeague
    ) {
      await recordGrowthEvent({
        eventType:
          "LEAGUE_CREATED",
        userId:
          user.id,
        leagueId:
          result
            .leagueId,
        source:
          "QUICK_MATCH",
        path:
          "/score-now",
      });
    }

    await recordGrowthEvent({
      eventType:
        "TEAM_CREATED",
      userId:
        user.id,
      leagueId:
        result
          .leagueId,
      source:
        "QUICK_MATCH",
      path:
        "/score-now",
      metadata: {
        count:
          2,
      },
    });

    await recordGrowthEvent({
      eventType:
        "PLAYER_CREATED",
      userId:
        user.id,
      leagueId:
        result
          .leagueId,
      source:
        "QUICK_MATCH",
      path:
        "/score-now",
      metadata: {
        count:
          result
            .playerCount,
      },
    });

    await recordGrowthEvent({
      eventType:
        "MATCH_CREATED",
      userId:
        user.id,
      leagueId:
        result
          .leagueId,
      matchId:
        result
          .matchId,
      source:
        "QUICK_MATCH",
      path:
        "/score-now",
    });

    await recordGrowthEvent({
      eventType:
        "QUICK_MATCH_CREATED",
      userId:
        user.id,
      leagueId:
        result
          .leagueId,
      matchId:
        result
          .matchId,
      source:
        "QUICK_MATCH_API",
      path:
        "/score-now",
      metadata: {
        createdLeague:
          result
            .createdLeague,
        playerCount:
          result
            .playerCount,
        overs,
      },
    });

    return NextResponse.json(
      {
        success:
          true,
        ...result,
      },
      {
        status:
          201,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "[QUICK_MATCH_CREATE_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          error
            ?.message ||
          "Unable to create the quick match.",
      },
      {
        status:
          400,
      }
    );
  }
}
