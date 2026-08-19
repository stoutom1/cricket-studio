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
  sendWebPushNotification,
} from "@/lib/web-push";
import {
  buildPublicMatchResult,
} from "@/lib/public-match-result";

export const runtime =
  "nodejs";

const ALERT_TYPES =
  new Set([
    "MATCH_START",
    "MATCH_RESULT",
  ]);

function liveUrlForMatch(
  match
) {
  if (
    match.shareCode
  ) {
    return `/live/${encodeURIComponent(
      match.shareCode
    )}/share-v1`;
  }

  if (
    match.league
      ?.slug
  ) {
    return `/leagues/${match.league.slug}/matches/${match.id}`;
  }

  return "/";
}

function resultUrlForMatch(
  match
) {
  if (
    match.league
      ?.slug
  ) {
    return `/leagues/${match.league.slug}/matches/${match.id}`;
  }

  return liveUrlForMatch(
    match
  );
}

async function canDispatch({
  session,
  userId,
  match,
}) {
  if (
    isSuperAdmin(
      session
    )
  ) {
    return true;
  }

  if (
    match.league
      ?.ownerId &&
    String(
      match.league
        .ownerId
    ) ===
      String(
        userId
      )
  ) {
    return true;
  }

  if (
    !match.leagueId
  ) {
    return false;
  }

  const membership =
    await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId:
            Number(
              match.leagueId
            ),
        },
      },
      select: {
        role: true,
        canScoreMatch:
          true,
        canEditMatch:
          true,
        canManagePermissions:
          true,
      },
    });

  const role =
    String(
      membership?.role ||
      ""
    ).toUpperCase();

  return Boolean(
    membership &&
    (
      [
        "OWNER",
        "ADMIN",
        "SCORER",
      ].includes(
        role
      ) ||
      membership
        .canScoreMatch ===
        true ||
      membership
        .canEditMatch ===
        true ||
      membership
        .canManagePermissions ===
        true
    )
  );
}

export async function POST(
  request
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
          "User not found.",
      },
      {
        status:
          404,
      }
    );
  }

  const body =
    await request.json();

  const matchId =
    Number(
      body?.matchId
    );

  const alertType =
    String(
      body?.alertType ||
      ""
    ).toUpperCase();

  if (
    !Number.isInteger(
      matchId
    ) ||
    matchId <= 0 ||
    !ALERT_TYPES.has(
      alertType
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid match alert request.",
      },
      {
        status:
          400,
      }
    );
  }

  const match =
    await prisma.match.findUnique({
      where: {
        id:
          matchId,
      },
      select: {
        id: true,
        leagueId: true,
        shareCode: true,
        status: true,
        statusText: true,
        battingFirstTeamId:
          true,
        maxWicketsPerInnings:
          true,
        teamAId: true,
        teamBId: true,

        teamA: {
          select: {
            name: true,
          },
        },

        teamB: {
          select: {
            name: true,
          },
        },

        league: {
          select: {
            id: true,
            name: true,
            slug: true,
            visibility: true,
            ownerId: true,
          },
        },

        balls: {
          select: {
            inningsNo: true,
            totalRuns: true,
            isWicket: true,
            wicketType: true,
            legalDelivery: true,
          },
        },
      },
    });

  if (
    !match ||
    !match.leagueId
  ) {
    return NextResponse.json(
      {
        error:
          "Match or league was not found.",
      },
      {
        status:
          404,
      }
    );
  }

  const allowed =
    await canDispatch({
      session,
      userId:
        user.id,
      match,
    });

  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to dispatch match alerts.",
      },
      {
        status:
          403,
      }
    );
  }

  const followerWhere = {
    leagueId:
      Number(
        match.leagueId
      ),
    alertsEnabled:
      true,

    ...(alertType ===
      "MATCH_START"
      ? {
          alertMatchStart:
            true,
        }
      : {
          alertMatchResult:
            true,
        }),
  };

  const followers =
    await prisma.leagueFollower.findMany({
      where:
        followerWhere,
      select: {
        userId: true,
      },
    });

  const userIds =
    followers.map(
      (follower) =>
        follower.userId
    );

  if (
    userIds.length ===
    0
  ) {
    return NextResponse.json({
      success:
        true,
      attempted:
        0,
      sent:
        0,
      skipped:
        0,
      reason:
        "No followers have this alert enabled.",
    });
  }

  const existing =
    await prisma.leagueAlertDelivery.findMany({
      where: {
        matchId,
        alertType,
        userId: {
          in:
            userIds,
        },
      },
      select: {
        userId: true,
      },
    });

  const deliveredUsers =
    new Set(
      existing.map(
        (row) =>
          row.userId
      )
    );

  const eligibleUsers =
    userIds.filter(
      (id) =>
        !deliveredUsers.has(
          id
        )
    );

  if (
    eligibleUsers.length ===
    0
  ) {
    return NextResponse.json({
      success:
        true,
      attempted:
        0,
      sent:
        0,
      skipped:
        userIds.length,
      reason:
        "This alert was already delivered.",
    });
  }

  const subscriptions =
    await prisma.webPushSubscription.findMany({
      where: {
        userId: {
          in:
            eligibleUsers,
        },
        isActive:
          true,
      },
      select: {
        id: true,
        userId: true,
        endpoint: true,
        p256dh: true,
        auth: true,
      },
    });

  const teamA =
    match.teamA
      ?.name ||
    "Team A";

  const teamB =
    match.teamB
      ?.name ||
    "Team B";

  const result =
    alertType ===
      "MATCH_RESULT"
      ? buildPublicMatchResult(
          match
        )
      : null;

  const url =
    alertType ===
      "MATCH_START"
      ? liveUrlForMatch(
          match
        )
      : resultUrlForMatch(
          match
        );

  const payload =
    alertType ===
      "MATCH_START"
      ? {
          title:
            `🔴 ${teamA} vs ${teamB} is live`,
          body:
            `Live scoring has started in ${match.league?.name || "Cric4All"}. Tap to follow ball-by-ball.`,
          icon:
            "/icons/icon-192x192.png",
          badge:
            "/icons/icon-96x96.png",
          tag:
            `league-match-start-${matchId}`,
          renotify:
            false,
          url,
          data: {
            type:
              "LEAGUE_MATCH_START",
            leagueId:
              match.leagueId,
            matchId,
            url,
          },
        }
      : {
          title:
            `🏆 ${teamA} vs ${teamB} result`,
          body:
            `${result}. Tap to view the full Cric4All scorecard.`,
          icon:
            "/icons/icon-192x192.png",
          badge:
            "/icons/icon-96x96.png",
          tag:
            `league-match-result-${matchId}`,
          renotify:
            false,
          url,
          data: {
            type:
              "LEAGUE_MATCH_RESULT",
            leagueId:
              match.leagueId,
            matchId,
            url,
          },
        };

  let attempted = 0;
  let sent = 0;
  let failed = 0;

  const successfulUsers =
    new Set();

  for (
    const subscription
    of subscriptions
  ) {
    attempted += 1;

    try {
      await sendWebPushNotification({
        subscription,
        payload,
      });

      sent += 1;

      successfulUsers.add(
        subscription.userId
      );

      await prisma.webPushSubscription
        .update({
          where: {
            id:
              subscription.id,
          },
          data: {
            lastUsedAt:
              new Date(),
          },
        })
        .catch(
          () => {}
        );
    } catch (
      pushError
    ) {
      failed += 1;

      const statusCode =
        Number(
          pushError
            ?.statusCode
        );

      if (
        [
          404,
          410,
        ].includes(
          statusCode
        )
      ) {
        await prisma.webPushSubscription
          .update({
            where: {
              id:
                subscription.id,
            },
            data: {
              isActive:
                false,
            },
          })
          .catch(
            () => {}
          );
      }

      console.error(
        "[LEAGUE_MATCH_ALERT_PUSH_FAILED]",
        {
          matchId,
          alertType,
          subscriptionId:
            subscription.id,
          statusCode:
            statusCode ||
            null,
        }
      );
    }
  }

  for (
    const recipientUserId
    of successfulUsers
  ) {
    await prisma.leagueAlertDelivery
      .create({
        data: {
          userId:
            recipientUserId,
          leagueId:
            Number(
              match.leagueId
            ),
          matchId,
          alertType,
        },
      })
      .catch(
        () => {}
      );
  }

  return NextResponse.json({
    success:
      true,
    followerCount:
      userIds.length,
    eligibleFollowerCount:
      eligibleUsers.length,
    subscriptionCount:
      subscriptions.length,
    attempted,
    sent,
    failed,
    deliveredUsers:
      successfulUsers.size,
  });
}
