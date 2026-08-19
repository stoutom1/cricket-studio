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
  isSuperAdmin,
} from "@/lib/superAdmin";
import {
  logAudit,
} from "@/lib/audit";
import {
  recordGrowthEvent,
} from "@/lib/growth";

export const runtime =
  "nodejs";

function cleanText(
  value,
  maxLength
) {
  return String(
    value ||
    ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(
      0,
      maxLength
    );
}

function normalizeKey(
  value
) {
  return cleanText(
    value,
    300
  ).toLocaleLowerCase();
}

function normalizePhone(
  value
) {
  const raw =
    cleanText(
      value,
      40
    );

  if (!raw) {
    return null;
  }

  /*
   * Preserve a user-provided E.164-like number when possible.
   * Importing a phone number NEVER grants WhatsApp/SMS consent.
   */
  const plus =
    raw.startsWith("+");

  const digits =
    raw.replace(
      /\D/g,
      ""
    );

  if (
    digits.length <
      7 ||
    digits.length >
      15
  ) {
    return raw;
  }

  return `${plus ? "+" : ""}${digits}`;
}

async function authorizeImport({
  session,
  userId,
  leagueId,
}) {
  if (
    isSuperAdmin(
      session
    )
  ) {
    return true;
  }

  const league =
    await prisma.league.findUnique({
      where: {
        id:
          leagueId,
      },
      select: {
        ownerId: true,
      },
    });

  if (
    !league
  ) {
    return false;
  }

  if (
    league.ownerId &&
    String(
      league.ownerId
    ) ===
      String(
        userId
      )
  ) {
    return true;
  }

  const membership =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId,
        },
      },
      select: {
        role: true,
        canCreateTeam:
          true,
        canCreatePlayer:
          true,
        canManagePermissions:
          true,
      },
    });

  if (
    !membership
  ) {
    return false;
  }

  const role =
    String(
      membership.role ||
      ""
    ).toUpperCase();

  return Boolean(
    [
      "OWNER",
      "ADMIN",
    ].includes(
      role
    ) ||
    membership
      .canManagePermissions ===
      true ||
    (
      membership
        .canCreateTeam ===
        true &&
      membership
        .canCreatePlayer ===
        true
    )
  );
}

export async function POST(
  request,
  {
    params,
  }
) {
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
          "Unauthorized",
      },
      {
        status:
          401,
      }
    );
  }

  const {
    leagueId:
      leagueIdParam,
  } = await params;

  const leagueId =
    Number(
      leagueIdParam
    );

  if (
    !Number.isInteger(
      leagueId
    ) ||
    leagueId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid league id.",
      },
      {
        status:
          400,
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
      },
    });

  if (!user) {
    return NextResponse.json(
      {
        error:
          "User account not found.",
      },
      {
        status:
          404,
      }
    );
  }

  const allowed =
    await authorizeImport({
      session,
      userId:
        user.id,
      leagueId,
    });

  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to import teams and players into this league.",
      },
      {
        status:
          403,
      }
    );
  }

  const body =
    await request.json();

  const rows =
    Array.isArray(
      body?.rows
    )
      ? body.rows
      : [];

  if (
    rows.length ===
    0
  ) {
    return NextResponse.json(
      {
        error:
          "No import rows were provided.",
      },
      {
        status:
          400,
      }
    );
  }

  if (
    rows.length >
    1000
  ) {
    return NextResponse.json(
      {
        error:
          "A single import is limited to 1,000 rows.",
      },
      {
        status:
          400,
      }
    );
  }

  const normalizedRows =
    [];

  const inputRowKeys =
    new Set();

  for (
    let index = 0;
    index <
    rows.length;
    index += 1
  ) {
    const row =
      rows[index] ||
      {};

    const teamName =
      cleanText(
        row.teamName ??
        row.team ??
        "",
        100
      );

    const playerName =
      cleanText(
        row.playerName ??
        row.player ??
        "",
        100
      );

    const whatsappNumber =
      normalizePhone(
        row.whatsappNumber ??
        row.phone ??
        ""
      );

    if (!teamName) {
      return NextResponse.json(
        {
          error:
            `Row ${index + 1}: Team is required.`,
        },
        {
          status:
            400,
        }
      );
    }

    const rowKey =
      `${normalizeKey(teamName)}::${normalizeKey(playerName)}`;

    if (
      inputRowKeys.has(
        rowKey
      )
    ) {
      continue;
    }

    inputRowKeys.add(
      rowKey
    );

    normalizedRows.push({
      teamName,
      playerName,
      whatsappNumber,
      inputRow:
        index + 1,
    });
  }

  const uniqueTeamKeys =
    new Set(
      normalizedRows.map(
        (row) =>
          normalizeKey(
            row.teamName
          )
      )
    );

  if (
    uniqueTeamKeys.size >
    100
  ) {
    return NextResponse.json(
      {
        error:
          "A single import is limited to 100 teams.",
      },
      {
        status:
          400,
      }
    );
  }

  await recordGrowthEvent({
    eventType:
      "LEAGUE_IMPORT_STARTED",
    userId:
      user.id,
    leagueId,
    source:
      "LEAGUE_IMPORT",
    path:
      `/dashboard?tab=management&leagueId=${leagueId}`,
    metadata: {
      rows:
        normalizedRows.length,
      teams:
        uniqueTeamKeys.size,
    },
  });

  const result =
    await prisma.$transaction(
      async (
        tx
      ) => {
        const existingTeams =
          await tx.team.findMany({
            where: {
              leagueId,
            },
            include: {
              players: {
                select: {
                  id: true,
                  name: true,
                  whatsappNumber:
                    true,
                },
              },
            },
          });

        const teamByKey =
          new Map(
            existingTeams.map(
              (team) => [
                normalizeKey(
                  team.name
                ),
                team,
              ]
            )
          );

        const createdTeamIds =
          [];

        const createdPlayerIds =
          [];

        const skippedTeams =
          new Set();

        const skippedPlayers =
          [];

        /*
         * First create every missing team once.
         */
        for (
          const row of
          normalizedRows
        ) {
          const teamKey =
            normalizeKey(
              row.teamName
            );

          if (
            teamByKey.has(
              teamKey
            )
          ) {
            skippedTeams.add(
              teamKey
            );
            continue;
          }

          const team =
            await tx.team.create({
              data: {
                leagueId,
                name:
                  row.teamName,
              },
              include: {
                players: {
                  select: {
                    id: true,
                    name: true,
                    whatsappNumber:
                      true,
                  },
                },
              },
            });

          createdTeamIds.push(
            team.id
          );

          teamByKey.set(
            teamKey,
            team
          );
        }

        /*
         * Then create players for each team.
         * A blank Player cell means "create/keep the team only".
         */
        for (
          const row of
          normalizedRows
        ) {
          if (
            !row.playerName
          ) {
            continue;
          }

          const team =
            teamByKey.get(
              normalizeKey(
                row.teamName
              )
            );

          if (!team) {
            continue;
          }

          const playerKey =
            normalizeKey(
              row.playerName
            );

          const duplicate =
            (team.players ||
              []).find(
                (
                  player
                ) =>
                  normalizeKey(
                    player.name
                  ) ===
                  playerKey
              );

          if (
            duplicate
          ) {
            skippedPlayers.push({
              row:
                row.inputRow,
              teamName:
                row.teamName,
              playerName:
                row.playerName,
              reason:
                "Player already exists in this team",
            });

            continue;
          }

          const created =
            await tx.player.create({
              data: {
                teamId:
                  team.id,
                name:
                  row.playerName,

                whatsappNumber:
                  row.whatsappNumber,

                /*
                 * IMPORTANT:
                 * Imported contact data does NOT constitute consent.
                 */
                whatsappOptIn:
                  false,
                smsOptIn:
                  false,
              },
              select: {
                id: true,
                name: true,
                whatsappNumber:
                  true,
              },
            });

          createdPlayerIds.push(
            created.id
          );

          if (
            !Array.isArray(
              team.players
            )
          ) {
            team.players =
              [];
          }

          team.players.push(
            created
          );
        }

        return {
          createdTeams:
            createdTeamIds.length,
          createdPlayers:
            createdPlayerIds.length,
          existingTeams:
            skippedTeams.size,
          skippedPlayers,
        };
      }
    );

  const league =
    await prisma.league.findUnique({
      where: {
        id:
          leagueId,
      },
      select: {
        name: true,
      },
    });

  try {
    await logAudit({
      action:
        "LEAGUE_ROSTER_IMPORTED",
      entityType:
        "LEAGUE",
      entityId:
        leagueId,
      leagueId,
      actor:
        session.user,
      description:
        `Imported teams/players into ${league?.name || `league ${leagueId}`}.`,
      afterData: {
        inputRows:
          normalizedRows.length,
        createdTeams:
          result.createdTeams,
        createdPlayers:
          result.createdPlayers,
        existingTeams:
          result.existingTeams,
        skippedPlayers:
          result.skippedPlayers.length,
      },
      request,
    });
  } catch (
    auditError
  ) {
    console.error(
      "[LEAGUE_IMPORT_AUDIT_FAILED]",
      auditError
    );
  }

  await recordGrowthEvent({
    eventType:
      "LEAGUE_IMPORT_COMPLETED",
    userId:
      user.id,
    leagueId,
    source:
      "LEAGUE_IMPORT",
    path:
      `/dashboard?tab=management&leagueId=${leagueId}`,
    metadata: {
      inputRows:
        normalizedRows.length,
      createdTeams:
        result.createdTeams,
      createdPlayers:
        result.createdPlayers,
      existingTeams:
        result.existingTeams,
      skippedPlayers:
        result.skippedPlayers.length,
    },
  });

  return NextResponse.json({
    success:
      true,

    inputRows:
      normalizedRows.length,

    createdTeams:
      result.createdTeams,

    createdPlayers:
      result.createdPlayers,

    existingTeams:
      result.existingTeams,

    skippedPlayers:
      result.skippedPlayers,

    note:
      "Imported phone numbers remain opted out until each user provides valid messaging consent.",
  });
}
