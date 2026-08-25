import twilio from "twilio";

import prisma from "@/lib/prisma";
import { normalizeSmsPhoneNumber } from "@/lib/notifications/sms-phone";
import { getArchivedPlayerIds } from "@/lib/player-roster-archive";
import {
  shouldExcludePlayerFromLeagueAnalytics,
} from "@/lib/player-analytics-exclusions";

export const PLAYER_INACTIVITY_DAYS = 60;

const ELIGIBLE_MATCH_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
  "ABANDONED",
]);

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function normalizePlayerName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isSurpriseLeague(league) {
  const name = normalizePlayerName(
    league?.name
  );

  const slug = String(
    league?.slug || ""
  )
    .trim()
    .toLowerCase();

  return (
    name ===
      "surprise cricket league" ||
    slug ===
      "surprise-cricket-league"
  );
}

function getIdentityKey({
  league,
  player,
}) {
  if (
    isSurpriseLeague(league)
  ) {
    return (
      `name:${normalizePlayerName(
        player?.name
      )}`
    );
  }

  return `player:${Number(
    player?.id || 0
  )}`;
}

function getMatchActivityDate(
  match
) {
  return (
    match?.endedAt ||
    match?.startedAt ||
    match?.scheduledAt ||
    match?.createdAt ||
    null
  );
}

function getMatchRoleParticipantIds(
  match
) {
  return [
    match?.teamACaptainId,
    match?.teamBCaptainId,
    match?.teamAViceCaptainId,
    match?.teamBViceCaptainId,
    match?.teamAWicketKeeperId,
    match?.teamBWicketKeeperId,
  ]
    .map(Number)
    .filter(
      (value) =>
        Number.isInteger(
          value
        ) &&
        value > 0
    );
}

function getBallParticipantIds(
  ball
) {
  return [
    ball?.strikerId,
    ball?.nonStrikerId,
    ball?.bowlerId,
    ball?.dismissedPlayerId,
    ball?.newBatterId,
    ball?.fielderId,
  ]
    .map(Number)
    .filter(
      (value) =>
        Number.isInteger(
          value
        ) &&
        value > 0
    );
}

function getTwilioClient() {
  const accountSid =
    String(
      process.env
        .TWILIO_ACCOUNT_SID ||
        ""
    ).trim();

  const authToken =
    String(
      process.env
        .TWILIO_AUTH_TOKEN ||
        ""
    ).trim();

  if (!accountSid) {
    throw new Error(
      "TWILIO_ACCOUNT_SID is missing."
    );
  }

  if (!authToken) {
    throw new Error(
      "TWILIO_AUTH_TOKEN is missing."
    );
  }

  return twilio(
    accountSid,
    authToken
  );
}

function getSmsFromNumber() {
  const from =
    String(
      process.env
        .TWILIO_PHONE_NUMBER ||
        ""
    ).trim();

  if (!from) {
    throw new Error(
      "TWILIO_PHONE_NUMBER is missing."
    );
  }

  return from;
}

export function buildPlayerInactivityMessage({
  playerName,
  inactivityDays =
    PLAYER_INACTIVITY_DAYS,
}) {
  const safeName =
    String(
      playerName || "This player"
    ).trim() ||
    "This player";

  return [
    "Cric4All Player Activity Notice",
    "",
    `${safeName} has not recorded a qualifying match appearance in the last ${inactivityDays} days and is eligible to be removed from the group.`,
    "",
    "Please review the player before taking any action.",
    "- Cric4All",
  ].join("\n");
}


const SETTING_ACTION =
  "PLAYER_INACTIVITY_ALERT_SETTING_UPDATED";

const PENDING_ACTION =
  "PLAYER_INACTIVITY_ALERT_PENDING";

const SENT_ACTION =
  "PLAYER_INACTIVITY_ALERT_SENT";

const FAILED_ACTION =
  "PLAYER_INACTIVITY_ALERT_FAILED";

function parseSettingAudit(
  audit,
  leagueId
) {
  const data =
    audit?.afterData &&
    typeof audit.afterData ===
      "object"
      ? audit.afterData
      : {};

  return {
    leagueId:
      Number(
        leagueId
      ),
    enabled:
      data.enabled ===
      true,
    recipientPhone:
      data.recipientPhone ||
      null,
    inactivityDays:
      PLAYER_INACTIVITY_DAYS,
    consentConfirmedAt:
      data.consentConfirmedAt ||
      null,
    consentConfirmedByUserId:
      data.consentConfirmedByUserId ||
      null,
    updatedAt:
      audit?.createdAt ||
      null,
  };
}

export async function getPlayerInactivityAlertSetting(
  leagueId
) {
  const audit =
    await prisma.auditLog.findFirst({
      where: {
        leagueId:
          Number(
            leagueId
          ),
        action:
          SETTING_ACTION,
        entityType:
          "LEAGUE",
      },
      orderBy: {
        createdAt:
          "desc",
      },
      select: {
        id:
          true,
        createdAt:
          true,
        afterData:
          true,
      },
    });

  if (!audit) {
    return {
      leagueId:
        Number(
          leagueId
        ),
      enabled:
        false,
      recipientPhone:
        null,
      inactivityDays:
        PLAYER_INACTIVITY_DAYS,
      consentConfirmedAt:
        null,
      consentConfirmedByUserId:
        null,
      updatedAt:
        null,
    };
  }

  return parseSettingAudit(
    audit,
    leagueId
  );
}

export async function savePlayerInactivityAlertSetting({
  leagueId,
  enabled,
  recipientPhone,
  consentConfirmed,
  updatedByUserId,
  updatedByName,
  updatedByEmail,
}) {
  const phone =
    normalizeSmsPhoneNumber(
      recipientPhone
    );

  if (
    enabled &&
    !phone
  ) {
    throw new Error(
      "Enter a valid SMS phone number before enabling player inactivity alerts."
    );
  }

  if (
    enabled &&
    consentConfirmed !==
      true
  ) {
    throw new Error(
      "Confirm that the recipient agreed to receive Cric4All operational SMS alerts."
    );
  }

  const afterData =
    {
      enabled:
        Boolean(
          enabled
        ),
      recipientPhone:
        phone,
      inactivityDays:
        PLAYER_INACTIVITY_DAYS,
      consentConfirmedAt:
        enabled
          ? new Date().toISOString()
          : null,
      consentConfirmedByUserId:
        enabled
          ? String(
              updatedByUserId ||
                ""
            ) ||
            null
          : null,
    };

  const audit =
    await prisma.auditLog.create({
      data: {
        action:
          SETTING_ACTION,
        entityType:
          "LEAGUE",
        entityId:
          Number(
            leagueId
          ),
        leagueId:
          Number(
            leagueId
          ),
        actorName:
          updatedByName ||
          null,
        actorEmail:
          updatedByEmail ||
          null,
        description:
          enabled
            ? `Enabled ${PLAYER_INACTIVITY_DAYS}-day player inactivity SMS alerts.`
            : "Disabled player inactivity SMS alerts.",
        afterData,
      },
      select: {
        id:
          true,
        createdAt:
          true,
        afterData:
          true,
      },
    });

  return parseSettingAudit(
    audit,
    leagueId
  );
}

export async function findInactivePlayerIdentities({
  league,
  now =
    new Date(),
  inactivityDays =
    PLAYER_INACTIVITY_DAYS,
}) {
  const cutoff =
    new Date(
      now.getTime() -
        inactivityDays *
          24 *
          60 *
          60 *
          1000
    );

  const identityMap =
    new Map();

  const archivedPlayerIds =
    await getArchivedPlayerIds(
      league?.id
    );

  const players =
    (league?.teams || [])
      .flatMap(
        (team) =>
          (team.players || []).map(
            (player) => ({
              ...player,
              teamId:
                player.teamId ||
                team.id,
              teamName:
                team.name,
            })
          )
      )
      .filter(
        (player) =>
          !archivedPlayerIds.has(
            Number(
              player.id
            )
          ) &&
          !shouldExcludePlayerFromLeagueAnalytics(
            league,
            player
          )
      );

  for (
    const player
    of players
  ) {
    const key =
      getIdentityKey({
        league,
        player,
      });

    if (
      !identityMap.has(
        key
      )
    ) {
      identityMap.set(
        key,
        {
          identityKey:
            key,
          playerName:
            player.name,
          playerIds:
            new Set(),
          createdAt:
            player.createdAt
              ? new Date(
                  player.createdAt
                )
              : null,
          lastPlayedAt:
            null,
        }
      );
    }

    const identity =
      identityMap.get(
        key
      );

    identity.playerIds.add(
      Number(
        player.id
      )
    );

    if (
      player.createdAt
    ) {
      const created =
        new Date(
          player.createdAt
        );

      if (
        !identity.createdAt ||
        created <
          identity.createdAt
      ) {
        identity.createdAt =
          created;
      }
    }
  }

  const playerIdToIdentity =
    new Map();

  for (
    const identity
    of identityMap.values()
  ) {
    for (
      const playerId
      of identity.playerIds
    ) {
      playerIdToIdentity.set(
        Number(playerId),
        identity.identityKey
      );
    }
  }


  for (
    const match
    of league?.matches || []
  ) {
    if (
      !ELIGIBLE_MATCH_STATUSES.has(
        normalizeStatus(
          match.status
        )
      )
    ) {
      continue;
    }

    const matchDateValue =
      getMatchActivityDate(
        match
      );

    if (
      !matchDateValue
    ) {
      continue;
    }

    const matchDate =
      new Date(
        matchDateValue
      );

    const participatingKeys =
      new Set();

    /*
     * ABANDONED counts as an inactivity-attendance status only when Cric4All
     * has player-level evidence that this player participated in that match:
     * a match role assignment or recorded delivery involvement.
     *
     * Do NOT mark an entire team roster present just because its team appeared
     * in an abandoned fixture. That would incorrectly reset the 60-day clock
     * for players who did not attend.
     */
    for (
      const playerId
      of getMatchRoleParticipantIds(
        match
      )
    ) {
      const identityKey =
        playerIdToIdentity.get(
          playerId
        );

      if (
        identityKey
      ) {
        participatingKeys.add(
          identityKey
        );
      }
    }

    for (
      const ball
      of match.balls || []
    ) {
      for (
        const playerId
        of getBallParticipantIds(
          ball
        )
      ) {
        const identityKey =
          playerIdToIdentity.get(
            playerId
          );

        if (
          identityKey
        ) {
          participatingKeys.add(
            identityKey
          );
        }
      }
    }

    for (
      const identityKey
      of participatingKeys
    ) {
      const identity =
        identityMap.get(
          identityKey
        );

      if (
        !identity
      ) {
        continue;
      }

      if (
        !identity.lastPlayedAt ||
        matchDate >
          identity.lastPlayedAt
      ) {
        identity.lastPlayedAt =
          matchDate;
      }
    }
  }

  const inactive =
    [];

  for (
    const identity
    of identityMap.values()
  ) {
    const activityAnchorAt =
      identity.lastPlayedAt ||
      identity.createdAt;

    /*
     * A brand-new roster entry does not become inactive immediately.
     * It must first exist for the full 60-day policy window.
     */
    if (
      !activityAnchorAt ||
      activityAnchorAt >
        cutoff
    ) {
      continue;
    }

    const eligibleAt =
      new Date(
        activityAnchorAt.getTime() +
          inactivityDays *
            24 *
            60 *
            60 *
            1000
      );

    const activityAnchorKey =
      activityAnchorAt.toISOString();

    inactive.push({
      identityKey:
        identity.identityKey,
      playerName:
        identity.playerName,
      playerIds:
        [
          ...identity.playerIds,
        ],
      lastPlayedAt:
        identity.lastPlayedAt,
      activityAnchorAt,
      activityAnchorKey,
      eligibleAt,
      inactivityDays,
    });
  }

  inactive.sort(
    (left, right) =>
      left.activityAnchorAt -
        right.activityAnchorAt ||
      left.playerName.localeCompare(
        right.playerName
      )
  );

  return inactive;
}


async function claimInactivityEpisode({
  leagueId,
  player,
  recipientPhone,
}) {
  const lockKey =
    [
      "player-inactivity",
      Number(
        leagueId
      ),
      player.identityKey,
      player.activityAnchorKey,
    ].join(":");

  return prisma.$transaction(
    async (
      tx
    ) => {
      /*
       * Serialize duplicate cron/manual attempts for the same player episode.
       * This protects against concurrent Vercel invocations without requiring
       * a new Prisma model or schema migration.
       */
      await tx.$queryRawUnsafe(
        `
          SELECT
            pg_advisory_xact_lock(
              hashtext($1)
            )::text
              AS "lockResult"
        `,
        lockKey
      );

      const existing =
        await tx.$queryRawUnsafe(
          `
            SELECT
              "id",
              "action",
              "afterData",
              "createdAt"
            FROM "AuditLog"
            WHERE
              "leagueId" = $1
              AND "action" IN (
                $2,
                $3,
                $4
              )
              AND COALESCE(
                "afterData"->>'identityKey',
                ''
              ) = $5
              AND COALESCE(
                "afterData"->>'activityAnchorKey',
                ''
              ) = $6
            ORDER BY
              "createdAt" DESC,
              "id" DESC
            LIMIT 1
          `,
          Number(
            leagueId
          ),
          PENDING_ACTION,
          SENT_ACTION,
          FAILED_ACTION,
          String(
            player.identityKey
          ),
          String(
            player.activityAnchorKey
          )
        );

      const latest =
        existing?.[0] ||
        null;

      if (
        latest &&
        [
          PENDING_ACTION,
          SENT_ACTION,
        ].includes(
          latest.action
        )
      ) {
        return null;
      }

      const audit =
        await tx.auditLog.create({
          data: {
            action:
              PENDING_ACTION,
            entityType:
              "PLAYER",
            entityId:
              player.playerIds?.[0]
                ? Number(
                    player.playerIds[0]
                  )
                : null,
            leagueId:
              Number(
                leagueId
              ),
            playerId:
              player.playerIds?.[0]
                ? Number(
                    player.playerIds[0]
                  )
                : null,
            description:
              `${player.playerName} reached the ${PLAYER_INACTIVITY_DAYS}-day player inactivity alert threshold.`,
            afterData: {
              identityKey:
                player.identityKey,
              playerName:
                player.playerName,
              playerIds:
                player.playerIds,
              recipientPhone,
              inactivityDays:
                PLAYER_INACTIVITY_DAYS,
              activityAnchorKey:
                player.activityAnchorKey,
              activityAnchorAt:
                player.activityAnchorAt?.toISOString?.() ||
                String(
                  player.activityAnchorAt ||
                    ""
                ),
              eligibleAt:
                player.eligibleAt?.toISOString?.() ||
                String(
                  player.eligibleAt ||
                    ""
                ),
              providerStatus:
                "PENDING",
            },
          },
          select: {
            id:
              true,
          },
        });

      return audit.id;
    }
  );
}

async function updateInactivityLog(
  logId,
  {
    success,
    providerMessageId =
      null,
    providerStatus =
      null,
    errorMessage =
      null,
  }
) {
  const current =
    await prisma.auditLog.findUnique({
      where: {
        id:
          Number(
            logId
          ),
      },
      select: {
        afterData:
          true,
      },
    });

  const prior =
    current?.afterData &&
    typeof current.afterData ===
      "object"
      ? current.afterData
      : {};

  await prisma.auditLog.update({
    where: {
      id:
        Number(
          logId
        ),
    },
    data: {
      action:
        success
          ? SENT_ACTION
          : FAILED_ACTION,
      description:
        success
          ? `${prior.playerName || "Player"} inactivity SMS alert submitted to Twilio.`
          : `${prior.playerName || "Player"} inactivity SMS alert failed.`,
      afterData: {
        ...prior,
        providerMessageId,
        providerStatus:
          providerStatus ||
          (
            success
              ? "SUBMITTED"
              : "FAILED"
          ),
        errorMessage,
        sentAt:
          success
            ? new Date().toISOString()
            : null,
        failedAt:
          success
            ? null
            : new Date().toISOString(),
      },
    },
  });
}

export async function sendPlayerInactivitySms({
  to,
  playerName,
  inactivityDays =
    PLAYER_INACTIVITY_DAYS,
}) {
  const phone =
    normalizeSmsPhoneNumber(
      to
    );

  if (!phone) {
    throw new Error(
      "A valid recipient SMS phone number is required."
    );
  }

  const body =
    buildPlayerInactivityMessage({
      playerName,
      inactivityDays,
    });

  const message =
    await getTwilioClient()
      .messages.create({
        from:
          getSmsFromNumber(),
        to:
          phone,
        body,
      });

  return {
    messageSid:
      message.sid,
    status:
      message.status,
    to:
      message.to,
    body,
  };
}

export async function processPlayerInactivityAlerts({
  now =
    new Date(),
  leagueId =
    null,
  dryRun =
    false,
} = {}) {
  const settingAudits =
    await prisma.auditLog.findMany({
      where: {
        action:
          SETTING_ACTION,
        entityType:
          "LEAGUE",
        ...(
          leagueId
            ? {
                leagueId:
                  Number(
                    leagueId
                  ),
              }
            : {}
        ),
      },
      orderBy: [
        {
          createdAt:
            "desc",
        },
        {
          id:
            "desc",
        },
      ],
      select: {
        leagueId:
          true,
        createdAt:
          true,
        afterData:
          true,
      },
    });

  const latestSettingByLeague =
    new Map();

  for (
    const audit
    of settingAudits
  ) {
    const id =
      Number(
        audit.leagueId
      );

    if (
      !id ||
      latestSettingByLeague.has(
        id
      )
    ) {
      continue;
    }

    latestSettingByLeague.set(
      id,
      parseSettingAudit(
        audit,
        id
      )
    );
  }

  const settings =
    [
      ...latestSettingByLeague.values(),
    ].filter(
      (setting) =>
        setting.enabled ===
          true &&
        Boolean(
          normalizeSmsPhoneNumber(
            setting.recipientPhone
          )
        )
    );

  const summary =
    {
      enabledLeagues:
        settings.length,
      checkedPlayers:
        0,
      inactivePlayers:
        0,
      alreadyAlerted:
        0,
      sent:
        0,
      failed:
        0,
      dryRun:
        0,
    };

  for (
    const setting
    of settings
  ) {
    const league =
      await prisma.league.findUnique({
        where: {
          id:
            Number(
              setting.leagueId
            ),
        },
        select: {
          id:
            true,
          name:
            true,
          slug:
            true,
          teams: {
            select: {
              id:
                true,
              name:
                true,
              players: {
                select: {
                  id:
                    true,
                  name:
                    true,
                  teamId:
                    true,
                  createdAt:
                    true,
                },
              },
            },
          },
          matches: {
            where: {
              status: {
                in: [
                  "COMPLETED",
                  "COMPLETED_LOCKED",
                  "COMPLETED_CORRECTED",
                  "ABANDONED",
                ],
              },
            },
            select: {
              id:
                true,
              status:
                true,
              teamAId:
                true,
              teamBId:
                true,
              endedAt:
                true,
              startedAt:
                true,
              scheduledAt:
                true,
              createdAt:
                true,
              teamACaptainId:
                true,
              teamBCaptainId:
                true,
              teamAViceCaptainId:
                true,
              teamBViceCaptainId:
                true,
              teamAWicketKeeperId:
                true,
              teamBWicketKeeperId:
                true,
              balls: {
                select: {
                  strikerId:
                    true,
                  nonStrikerId:
                    true,
                  bowlerId:
                    true,
                  dismissedPlayerId:
                    true,
                  newBatterId:
                    true,
                  fielderId:
                    true,
                },
              },
            },
          },
        },
      });

    if (!league) {
      continue;
    }

    const inactive =
      await findInactivePlayerIdentities({
        league,
        now,
        inactivityDays:
          PLAYER_INACTIVITY_DAYS,
      });

    const allPlayers =
      (league.teams || [])
        .flatMap(
          (team) =>
            team.players || []
        )
        .filter(
          (player) =>
            !shouldExcludePlayerFromLeagueAnalytics(
              league,
              player
            )
        );

    summary.checkedPlayers +=
      allPlayers.length;

    summary.inactivePlayers +=
      inactive.length;

    const recipientPhone =
      normalizeSmsPhoneNumber(
        setting.recipientPhone
      );

    if (
      !recipientPhone
    ) {
      continue;
    }

    for (
      const player
      of inactive
    ) {
      if (
        dryRun
      ) {
        summary.dryRun += 1;
        continue;
      }

      const logId =
        await claimInactivityEpisode({
          leagueId:
            league.id,
          player,
          recipientPhone,
        });

      if (
        !logId
      ) {
        summary.alreadyAlerted +=
          1;
        continue;
      }

      try {
        const result =
          await sendPlayerInactivitySms({
            to:
              recipientPhone,
            playerName:
              player.playerName,
            inactivityDays:
              PLAYER_INACTIVITY_DAYS,
          });

        await updateInactivityLog(
          logId,
          {
            success:
              true,
            providerMessageId:
              result.messageSid,
            providerStatus:
              String(
                result.status ||
                  "ACCEPTED"
              ).toUpperCase(),
            errorMessage:
              null,
          }
        );

        summary.sent += 1;
      } catch (error) {
        await updateInactivityLog(
          logId,
          {
            success:
              false,
            providerStatus:
              "FAILED",
            errorMessage:
              String(
                error instanceof Error
                  ? error.message
                  : error
              ).slice(
                0,
                1000
              ),
          }
        );

        summary.failed += 1;

        console.error(
          "[PLAYER_INACTIVITY_ALERT_SEND_FAILED]",
          {
            leagueId:
              league.id,
            playerName:
              player.playerName,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          }
        );
      }
    }
  }

  return summary;
}
