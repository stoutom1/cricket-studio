import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function getPlayerColumns() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Player'`
  );

  return new Set(
    rows.map((row) => String(row.column_name))
  );
}

async function getContext(leagueId, session) {
  const email = normalizeEmail(
    session?.user?.email
  );

  if (!email) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const currentUser =
    await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

  if (!currentUser) {
    return {
      error: NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      ),
    };
  }

  const league =
    await prisma.league.findUnique({
      where: {
        id: leagueId,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
      },
    });

  if (!league) {
    return {
      error: NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      ),
    };
  }

  const membership =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: currentUser.id,
          leagueId,
        },
      },
      select: {
        id: true,
        role: true,
      },
    });

  const superAdmin = isSuperAdmin(session);
  const owner =
    league.ownerId === currentUser.id;

  if (!membership && !owner && !superAdmin) {
    return {
      error: NextResponse.json(
        {
          error:
            "You do not have access to this league.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    currentUser,
    league,
    membership,
    superAdmin,
    owner,
    canManageLinks:
      owner ||
      superAdmin,
  };
}

async function readLeaguePlayers(
  leagueId,
  columns
) {
  const hasUserId =
    columns.has("userId");

  const hasEmail =
    columns.has("email");

  /*
   * userId is the authoritative account link whenever that column exists.
   * Player.email may be a player's contact email and therefore is not treated
   * as an account link in a schema that already has userId.
   */
  const userJoin =
    hasUserId
      ? `LEFT JOIN "User" u
           ON u."id" = p."userId"`
      : hasEmail
        ? `LEFT JOIN "User" u
             ON LOWER(TRIM(u."email")) =
                LOWER(TRIM(p."email"))`
        : "";

  const linkColumns =
    hasUserId
      ? `,
         p."userId" AS "linkedUserId",
         u."name" AS "linkedUserName",
         u."email" AS "linkedUserEmail"`
      : hasEmail
        ? `,
           NULL::text AS "linkedUserId",
           u."name" AS "linkedUserName",
           p."email" AS "linkedUserEmail"`
        : `,
           NULL::text AS "linkedUserId",
           NULL::text AS "linkedUserName",
           NULL::text AS "linkedUserEmail"`;

  return prisma.$queryRawUnsafe(
    `SELECT
       p."id",
       p."name",
       p."teamId",
       t."name" AS "teamName"
       ${linkColumns}
     FROM "Player" p
     JOIN "Team" t
       ON t."id" = p."teamId"
     ${userJoin}
     WHERE t."leagueId" = $1
     ORDER BY
       t."name" ASC,
       p."name" ASC,
       p."id" ASC`,
    leagueId
  );
}

function isLinkedPlayer(
  player,
  columns
) {
  if (columns.has("userId")) {
    return Boolean(player.linkedUserId);
  }

  if (columns.has("email")) {
    return Boolean(
      normalizeEmail(
        player.linkedUserEmail
      )
    );
  }

  return false;
}

function isLinkedToUser(
  player,
  user,
  columns
) {
  if (columns.has("userId")) {
    return (
      String(player.linkedUserId || "") ===
      String(user.id)
    );
  }

  if (columns.has("email")) {
    return (
      normalizeEmail(
        player.linkedUserEmail
      ) ===
      normalizeEmail(user.email)
    );
  }

  return false;
}

async function leagueUsers(
  league,
  canManageLinks
) {
  if (!canManageLinks) {
    return [];
  }

  const members =
    await prisma.leagueMember.findMany({
      where: {
        leagueId: league.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        joinedAt: "asc",
      },
    });

  const users = new Map();

  for (const member of members) {
    if (member.user?.id) {
      users.set(
        String(member.user.id),
        member.user
      );
    }
  }

  if (
    league.ownerId &&
    !users.has(String(league.ownerId))
  ) {
    const owner =
      await prisma.user.findUnique({
        where: {
          id: league.ownerId,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

    if (owner) {
      users.set(
        String(owner.id),
        owner
      );
    }
  }

  return [...users.values()].sort(
    (a, b) =>
      String(a.name || a.email)
        .localeCompare(
          String(b.name || b.email)
        )
  );
}

async function targetUserAllowed(
  league,
  targetUserId
) {
  if (
    String(league.ownerId || "") ===
    String(targetUserId)
  ) {
    return true;
  }

  const membership =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId: targetUserId,
          leagueId: league.id,
        },
      },
      select: {
        id: true,
      },
    });

  return Boolean(membership);
}

async function updatePlayerLink({
  playerId,
  user,
  columns,
}) {
  if (columns.has("userId")) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Player"
          SET "userId" = $1
        WHERE "id" = $2`,
      user.id,
      playerId
    );

    return;
  }

  if (columns.has("email")) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Player"
          SET "email" = $1
        WHERE "id" = $2`,
      normalizeEmail(user.email),
      playerId
    );

    return;
  }

  throw new Error(
    "Player table does not support account linking."
  );
}

async function clearPlayerLink({
  playerId,
  columns,
}) {
  if (columns.has("userId")) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Player"
          SET "userId" = NULL
        WHERE "id" = $1`,
      playerId
    );

    return;
  }

  if (columns.has("email")) {
    /*
     * Email is only cleared in legacy/email-only schemas because, in that
     * schema, email itself is the account link. When userId exists we never
     * modify Player.email.
     */
    await prisma.$executeRawUnsafe(
      `UPDATE "Player"
          SET "email" = NULL
        WHERE "id" = $1`,
      playerId
    );

    return;
  }

  throw new Error(
    "Player table does not support account linking."
  );
}

export async function GET(
  request,
  { params }
) {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    const { id } = await params;
    const leagueId = Number(id);

    if (
      !Number.isInteger(leagueId) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid league id",
        },
        {
          status: 400,
        }
      );
    }

    const context =
      await getContext(
        leagueId,
        session
      );

    if (context.error) {
      return context.error;
    }

    const columns =
      await getPlayerColumns();

    const linkSupported =
      columns.has("userId") ||
      columns.has("email");

    const players =
      await readLeaguePlayers(
        leagueId,
        columns
      );

    const selfLinks =
      players.filter(
        (player) =>
          isLinkedToUser(
            player,
            context.currentUser,
            columns
          )
      );

    /*
     * A Cric4All account can legitimately represent more than one Player row
     * (for example the same real player appearing on multiple teams/leagues).
     * Therefore keep showing other currently-unclaimed player rows even after
     * the first profile has been linked.
     */
    const selfCandidates =
      players.filter(
        (player) =>
          !isLinkedPlayer(
            player,
            columns
          )
      );

    const adminUsers =
      await leagueUsers(
        context.league,
        context.canManageLinks
      );

    return NextResponse.json({
      linkSupported,
      linkMode:
        columns.has("userId")
          ? "USER_ID"
          : columns.has("email")
            ? "EMAIL"
            : "NONE",

      canManageLinks:
        context.canManageLinks,

      currentUser: {
        id:
          context.currentUser.id,
        name:
          context.currentUser.name,
        email:
          context.currentUser.email,
      },

      selfLinks,
      selfCandidates,

      adminPlayers:
        context.canManageLinks
          ? players
          : [],

      adminUsers,

      currentLinks:
        context.canManageLinks
          ? players.filter(
              (player) =>
                isLinkedPlayer(
                  player,
                  columns
                )
            )
          : [],
    });
  } catch (error) {
    console.error(
      "[PLAYER_ACCOUNT_LINKS_GET_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load player-account links.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request,
  { params }
) {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    const { id } = await params;
    const leagueId = Number(id);

    if (
      !Number.isInteger(leagueId) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid league id",
        },
        {
          status: 400,
        }
      );
    }

    const context =
      await getContext(
        leagueId,
        session
      );

    if (context.error) {
      return context.error;
    }

    const body =
      await request.json();

    const playerId =
      Number(body?.playerId);

    if (
      !Number.isInteger(playerId) ||
      playerId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Choose a valid player.",
        },
        {
          status: 400,
        }
      );
    }

    const columns =
      await getPlayerColumns();

    if (
      !columns.has("userId") &&
      !columns.has("email")
    ) {
      return NextResponse.json(
        {
          error:
            "This Player table does not support account links yet.",
        },
        {
          status: 409,
        }
      );
    }

    const players =
      await readLeaguePlayers(
        leagueId,
        columns
      );

    const targetPlayer =
      players.find(
        (player) =>
          Number(player.id) ===
          playerId
      );

    if (!targetPlayer) {
      return NextResponse.json(
        {
          error:
            "Player does not belong to this league.",
        },
        {
          status: 404,
        }
      );
    }

    const requestedUserId =
      body?.userId
        ? String(body.userId)
        : "";

    const isAdminOperation =
      Boolean(requestedUserId);

    let targetUser =
      context.currentUser;

    if (isAdminOperation) {
      if (!context.canManageLinks) {
        return NextResponse.json(
          {
            error:
              "Only the league owner or SuperAdmin can link another user's account.",
          },
          {
            status: 403,
          }
        );
      }

      targetUser =
        await prisma.user.findUnique({
          where: {
            id: requestedUserId,
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

      if (!targetUser) {
        return NextResponse.json(
          {
            error:
              "Registered user not found.",
          },
          {
            status: 404,
          }
        );
      }

      const allowed =
        await targetUserAllowed(
          context.league,
          targetUser.id
        );

      if (!allowed) {
        return NextResponse.json(
          {
            error:
              "That account is not a registered member or owner of this league.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * Do not enforce one Player row per account. A single registered person
     * can legitimately have multiple Player rows across teams/leagues.
     * Each individual Player row can still belong to only one account.
     */

    const currentlyLinked =
      isLinkedPlayer(
        targetPlayer,
        columns
      );

    const linkedToTarget =
      isLinkedToUser(
        targetPlayer,
        targetUser,
        columns
      );

    if (
      currentlyLinked &&
      !linkedToTarget &&
      !context.canManageLinks
    ) {
      return NextResponse.json(
        {
          error:
            "That player profile is already linked to another Cric4All account.",
        },
        {
          status: 409,
        }
      );
    }

    await updatePlayerLink({
      playerId,
      user: targetUser,
      columns,
    });

    return NextResponse.json({
      ok: true,
      playerId,
      userId:
        targetUser.id,
      message:
        isAdminOperation
          ? `${targetPlayer.name} is now linked to ${targetUser.name || targetUser.email}.`
          : `${targetPlayer.name} is now linked to your Cric4All account.`,
    });
  } catch (error) {
    console.error(
      "[PLAYER_ACCOUNT_LINKS_POST_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to link the player account.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  request,
  { params }
) {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    const { id } = await params;
    const leagueId = Number(id);

    if (
      !Number.isInteger(leagueId) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid league id",
        },
        {
          status: 400,
        }
      );
    }

    const context =
      await getContext(
        leagueId,
        session
      );

    if (context.error) {
      return context.error;
    }

    const body =
      await request.json();

    const playerId =
      Number(body?.playerId);

    if (
      !Number.isInteger(playerId) ||
      playerId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Choose a valid player.",
        },
        {
          status: 400,
        }
      );
    }

    const columns =
      await getPlayerColumns();

    const players =
      await readLeaguePlayers(
        leagueId,
        columns
      );

    const targetPlayer =
      players.find(
        (player) =>
          Number(player.id) ===
          playerId
      );

    if (!targetPlayer) {
      return NextResponse.json(
        {
          error:
            "Player does not belong to this league.",
        },
        {
          status: 404,
        }
      );
    }

    const selfOwned =
      isLinkedToUser(
        targetPlayer,
        context.currentUser,
        columns
      );

    if (
      !selfOwned &&
      !context.canManageLinks
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot unlink another player's account.",
        },
        {
          status: 403,
        }
      );
    }

    await clearPlayerLink({
      playerId,
      columns,
    });

    return NextResponse.json({
      ok: true,
      playerId,
      message:
        `${targetPlayer.name} is no longer linked to that account. Historical scores were not changed.`,
    });
  } catch (error) {
    console.error(
      "[PLAYER_ACCOUNT_LINKS_DELETE_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to remove the player-account link.",
      },
      {
        status: 500,
      }
    );
  }
}
