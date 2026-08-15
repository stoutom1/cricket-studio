import prisma from "@/lib/prisma";

import {
  formatMatchDateTime,
  isTomorrowInTimeZone,
  isWithinLeadTimeWindow,
  minutesUntilMatch,
  validTimeZone,
} from "@/lib/kit/reminder-time";

import {
  normalizeInternationalPhone,
} from "@/lib/notifications/phone";

import {
  sendKitReminderWhatsApp,
} from "@/lib/notifications/send-whatsapp";

import {
  sendAssignedCarrierKitWhatsApp,
  sendCurrentHolderKitWhatsApp,
} from "@/lib/notifications/send-kit-role-whatsapp";

import {
  sendPlayerCommunication,
} from "@/lib/communications/sendPlayerCommunication";

import {
  buildKitReminderCommunicationContent,
} from "@/lib/communications/templates/kitReminder";

import {
  buildAssignedCarrierKitContent,
  buildCurrentHolderKitContent,
} from "@/lib/communications/templates/kitRoleReminders";

import {
  getKitRotationKey,
} from "@/lib/kit/rotation-scope";

const REMINDER_CHANNEL =
  "WHATSAPP";

const SUPPORTED_REMINDER_TYPES =
  new Set([
    "DAY_BEFORE",
    "TWO_HOURS_BEFORE",
  ]);

const ACTIVE_ASSIGNMENT_STATUSES = [
  "SUGGESTED",
  "ASSIGNED",
  "CONFIRMED",
];

const CLOSED_MATCH_STATUSES =
  new Set([
    "COMPLETED",
    "COMPLETED_LOCKED",
    "COMPLETED_CORRECTED",
    "ABANDONED",
    "CANCELLED",
    "CANCELED",
  ]);

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isClosedMatch(match) {
  return CLOSED_MATCH_STATUSES.has(
    normalizeStatus(
      match?.status
    )
  );
}

function getOpponentName(
  match,
  assignedTeamId
) {
  const teamId =
    Number(assignedTeamId);

  if (
    teamId ===
    Number(match.teamAId)
  ) {
    return (
      match.teamB?.name ||
      "the opponent"
    );
  }

  if (
    teamId ===
    Number(match.teamBId)
  ) {
    return (
      match.teamA?.name ||
      "the opponent"
    );
  }

  return "the opponent";
}

function contactFromRotationMember(
  rotationMember
) {
  const player =
    rotationMember?.player ||
    null;

  return {
    name:
      player?.name ||
      rotationMember
        ?.displayName ||
      "Player",

    phone:
      player
        ?.whatsappNumber ||
      rotationMember
        ?.whatsappNumber ||
      null,

    optedIn:
      player
        ?.whatsappOptIn ===
        true ||
      rotationMember
        ?.whatsappOptIn ===
        true,
  };
}

function getAssignedPlayer(
  assignment
) {
  const rotationMember =
    assignment.rotationMember;

  const matchKitPlayer =
    assignment.matchKitPlayer;

  const player =
    rotationMember?.player ||
    matchKitPlayer?.player ||
    null;

  return {
    name:
      player?.name ||
      rotationMember
        ?.displayName ||
      matchKitPlayer
        ?.displayName ||
      "Player",

    phone:
      player
        ?.whatsappNumber ||
      rotationMember
        ?.whatsappNumber ||
      matchKitPlayer
        ?.whatsappNumber ||
      null,

    optedIn:
      player
        ?.whatsappOptIn ===
        true ||
      rotationMember
        ?.whatsappOptIn ===
        true ||
      matchKitPlayer
        ?.whatsappOptIn ===
        true,
  };
}

function parsePositiveInteger(
  value,
  fallback
) {
  const parsed =
    Number(value);

  return (
    Number.isInteger(parsed) &&
    parsed > 0
      ? parsed
      : fallback
  );
}

function getTwoHourWindowMinutes() {
  return parsePositiveInteger(
    process.env
      .KIT_TWO_HOUR_REMINDER_WINDOW_MINUTES,
    60
  );
}

function getReminderEligibility({
  reminderType,
  match,
  now,
  timeZone,
}) {
  if (
    reminderType ===
    "DAY_BEFORE"
  ) {
    const eligible =
      isTomorrowInTimeZone({
        scheduledAt:
          match.scheduledAt,

        now,
        timeZone,
      });

    return {
      eligible,

      minutesUntilMatch:
        minutesUntilMatch({
          scheduledAt:
            match.scheduledAt,

          now,
          timeZone,
        }),
    };
  }

  if (
    reminderType ===
    "TWO_HOURS_BEFORE"
  ) {
    const windowMinutes =
      getTwoHourWindowMinutes();

    const remainingMinutes =
      minutesUntilMatch({
        scheduledAt:
          match.scheduledAt,

        now,
        timeZone,
      });

    return {
      eligible:
        isWithinLeadTimeWindow({
          scheduledAt:
            match.scheduledAt,

          now,
          timeZone,

          leadMinutes:
            120,

          windowMinutes,
        }),

      minutesUntilMatch:
        remainingMinutes,
    };
  }

  throw new Error(
    `Unsupported kit reminder type: ${reminderType}`
  );
}

function getReminderScheduledFor({
  reminderType,
  match,
  now,
}) {
  if (
    reminderType ===
    "TWO_HOURS_BEFORE"
  ) {
    return new Date(
      new Date(
        match.scheduledAt
      ).getTime() -
        120 *
          60 *
          1000
    );
  }

  return new Date(now);
}

function getReminderLogLabel(
  reminderType
) {
  return (
    reminderType ===
    "TWO_HOURS_BEFORE"
      ? "two-hours-before"
      : "day-before"
  );
}

function holderNeedsTwoHourReminder(
  leagueKit
) {
  if (!leagueKit) {
    return false;
  }

  if (
    leagueKit
      .venueConfirmedAt
  ) {
    return false;
  }

  if (
    normalizeStatus(
      leagueKit.status
    ) === "AT_VENUE"
  ) {
    return false;
  }

  const handoverStatus =
    normalizeStatus(
      leagueKit
        .handoverStatus
    );

  return ![
    "COORDINATED",
    "HANDED_OVER",
  ].includes(
    handoverStatus
  );
}

async function createOrLoadReminder({
  assignment,
  recipientType,
  recipientName,
  recipientPhone,
  scheduledFor,
  reminderType,
}) {
  return prisma
    .kitReminderLog
    .upsert({
      where: {
        assignmentId_reminderType_channel_recipientType:
          {
            assignmentId:
              assignment.id,

            reminderType,

            channel:
              REMINDER_CHANNEL,

            recipientType,
          },
      },

      update: {
        leagueId:
          assignment.leagueId,

        matchId:
          assignment.matchId,

        teamId:
          assignment.teamId,

        recipientName,

        recipientPhone,

        scheduledFor,
      },

      create: {
        leagueId:
          assignment.leagueId,

        matchId:
          assignment.matchId,

        teamId:
          assignment.teamId,

        assignmentId:
          assignment.id,

        recipientType,

        reminderType,

        channel:
          REMINDER_CHANNEL,

        recipientName,

        recipientPhone,

        status:
          "PENDING",

        scheduledFor,

        attemptCount:
          0,
      },
    });
}

async function markReminderSkipped(
  reminderId,
  reason
) {
  return prisma
    .kitReminderLog
    .update({
      where: {
        id:
          reminderId,
      },

      data: {
        status:
          "SKIPPED",

        errorMessage:
          reason,

        providerStatus:
          "SKIPPED",

        processingStartedAt:
          null,

        failedAt:
          null,
      },
    });
}

async function resetReminderToPending(
  reminderId
) {
  return prisma
    .kitReminderLog
    .update({
      where: {
        id:
          reminderId,
      },

      data: {
        status:
          "PENDING",

        providerStatus:
          null,

        errorMessage:
          null,

        processingStartedAt:
          null,

        failedAt:
          null,
      },
    });
}

async function claimReminder(
  reminderId
) {
  return prisma
    .kitReminderLog
    .updateMany({
      where: {
        id:
          reminderId,

        status:
          "PENDING",
      },

      data: {
        status:
          "PROCESSING",

        processingStartedAt:
          new Date(),

        providerStatus:
          "PROCESSING",

        errorMessage:
          null,

        attemptCount: {
          increment:
            1,
        },
      },
    });
}

async function markReminderQueued(
  reminderId,
  result
) {
  const providerStatus =
    String(
      result?.providerStatus ||
        "ACCEPTED"
    )
      .trim()
      .toUpperCase();

  const immediateSmsFallback =
    result?.transport ===
      "SMS" &&
    result?.fallbackUsed ===
      true;

  if (
    immediateSmsFallback
  ) {
    return prisma
      .kitReminderLog
      .update({
        where: {
          id:
            reminderId,
        },

        data: {
          /*
           * WhatsApp failed synchronously, so there will be no WhatsApp
           * callback for this request. SMS was already accepted.
           */
          status:
            "SENT",

          sentAt:
            new Date(),

          failedAt:
            null,

          processingStartedAt:
            null,

          errorMessage:
            result
              ?.primaryError ||
            null,

          providerStatus:
            "WHATSAPP_IMMEDIATE_FAILURE",

          providerMessageId:
            null,

          fallbackSmsAllowed:
            true,

          fallbackSmsBody:
            result
              ?.fallbackMessageBody ||
            null,

          fallbackSmsStatus:
            String(
              result
                ?.actualProviderStatus ||
              "ACCEPTED"
            )
              .trim()
              .toUpperCase(),

          fallbackSmsMessageId:
            result
              ?.providerMessageId ||
            null,

          fallbackSmsAttemptedAt:
            new Date(),

          fallbackSmsQueuedAt:
            new Date(),

          fallbackSmsError:
            null,

          ...(result
            ?.providerResponse
            ? {
                providerResponse:
                  result
                    .providerResponse,
              }
            : {}),
        },
      });
  }

  return prisma
    .kitReminderLog
    .update({
      where: {
        id:
          reminderId,
      },

      data: {
        status:
          "PROCESSING",

        sentAt:
          null,

        failedAt:
          null,

        processingStartedAt:
          new Date(),

        errorMessage:
          null,

        providerStatus,

        providerMessageId:
          result
            ?.providerMessageId ||
          null,

        fallbackSmsAllowed:
          result
            ?.fallbackEligible ===
          true,

        fallbackSmsBody:
          result
            ?.fallbackMessageBody ||
          result
            ?.fallbackBody ||
          null,

        fallbackSmsStatus:
          null,

        fallbackSmsMessageId:
          null,

        fallbackSmsAttemptedAt:
          null,

        fallbackSmsQueuedAt:
          null,

        fallbackSmsError:
          null,

        ...(result
          ?.providerResponse
          ? {
              providerResponse:
                result
                  .providerResponse,
            }
          : {}),
      },
    });
}

async function markReminderFailed(
  reminderId,
  error
) {
  return prisma
    .kitReminderLog
    .update({
      where: {
        id:
          reminderId,
      },

      data: {
        status:
          "FAILED",

        failedAt:
          new Date(),

        processingStartedAt:
          null,

        providerStatus:
          error?.httpStatus
            ? `HTTP_${error.httpStatus}`
            : "FAILED",

        errorMessage:
          error?.message ||
          "Unable to send the WhatsApp reminder.",

        ...(error
          ?.providerResponse &&
        typeof error
          .providerResponse ===
          "object"
          ? {
              providerResponse:
                error
                  .providerResponse,
            }
          : {}),
      },
    });
}

function createSummary({
  reminderType,
  checkedMatches,
}) {
  return {
    reminderType,

    checkedMatches,

    closedMatches:
      0,

    eligibleMatches:
      0,

    checkedAssignments:
      0,

    checkedRecipients:
      0,

    assignedCarrierQueued:
      0,

    currentHolderQueued:
      0,

    holderNotRequired:
      0,

    alreadySent:
      0,

    dryRun:
      0,

    skipped:
      0,

    failed:
      0,

    queued:
      0,

    sent:
      0,

    submittedToProvider:
      0,

    awaitingDeliveryCallback:
      0,

    immediatelySentByProvider:
      0,

    notClaimed:
      0,

    notDueTomorrow:
      0,

    notInTwoHourWindow:
      0,

    matchesAlreadyStarted:
      0,
  };
}

function addProviderResultToSummary(
  summary,
  result,
  recipientType
) {
  const providerStatus =
    String(
      result?.providerStatus ||
        "ACCEPTED"
    )
      .trim()
      .toUpperCase();

  summary.queued +=
    1;

  summary
    .submittedToProvider +=
    1;

  if (
    recipientType ===
    "ASSIGNED_CARRIER"
  ) {
    summary
      .assignedCarrierQueued +=
      1;
  }

  if (
    recipientType ===
    "CURRENT_HOLDER"
  ) {
    summary
      .currentHolderQueued +=
      1;
  }

  if (
    [
      "SENT",
      "DELIVERED",
      "READ",
    ].includes(
      providerStatus
    )
  ) {
    summary.sent +=
      1;

    summary
      .immediatelySentByProvider +=
      1;
  } else {
    summary
      .awaitingDeliveryCallback +=
      1;
  }
}

function finalizeSummary(
  summary
) {
  summary.deliveryStatusNote =
    summary
      .awaitingDeliveryCallback >
    0
      ? `${summary.awaitingDeliveryCallback} role-specific kit reminder request(s) were accepted by Twilio and are awaiting asynchronous delivery callbacks.`
      : "No role-specific kit reminder requests are currently awaiting delivery callbacks.";

  return summary;
}


async function loadLegacyAssignmentMatches() {
  return prisma.match.findMany({
    where: {
      scheduledAt: {
        not:
          null,
      },

      kitAssignments: {
        some: {
          status: {
            in:
              ACTIVE_ASSIGNMENT_STATUSES,
          },
        },
      },
    },

    select: {
      id:
        true,

      leagueId:
        true,

      teamAId:
        true,

      teamBId:
        true,

      scheduledAt:
        true,

      status:
        true,

      league: {
        select: {
          id:
            true,

          name:
            true,

          timeZone:
            true,

          kitRotationMode:
            true,
        },
      },

      teamA: {
        select: {
          id:
            true,

          name:
            true,
        },
      },

      teamB: {
        select: {
          id:
            true,

          name:
            true,
        },
      },

      kitAssignments: {
        where: {
          status: {
            in:
              ACTIVE_ASSIGNMENT_STATUSES,
          },
        },

        orderBy: {
          id:
            "asc",
        },

        select: {
          id:
            true,

          leagueId:
            true,

          matchId:
            true,

          teamId:
            true,

          leagueKitId:
            true,

          status:
            true,

          rotationMemberId:
            true,

          matchKitPlayerId:
            true,

          team: {
            select: {
              id:
                true,

              name:
                true,
            },
          },

          leagueKit: {
            select: {
              id:
                true,

              status:
                true,

              handoverStatus:
                true,

              venueConfirmedAt:
                true,

              currentHolderRotationMember:
                {
                  select: {
                    id:
                      true,

                    displayName:
                      true,

                    whatsappNumber:
                      true,

                    whatsappOptIn:
                      true,

                    player: {
                      select: {
                        id:
                          true,

                        name:
                          true,

                        whatsappNumber:
                          true,

                        whatsappOptIn:
                          true,
                      },
                    },
                  },
                },
            },
          },

          rotationMember: {
            select: {
              id:
                true,

              displayName:
                true,

              normalizedName:
                true,

              whatsappNumber:
                true,

              whatsappOptIn:
                true,

              playerId:
                true,

              player: {
                select: {
                  id:
                    true,

                  name:
                    true,

                  whatsappNumber:
                    true,

                  whatsappOptIn:
                    true,
                },
              },
            },
          },

          matchKitPlayer: {
            select: {
              id:
                true,

              displayName:
                true,

              normalizedName:
                true,

              whatsappNumber:
                true,

              whatsappOptIn:
                true,

              playerId:
                true,

              player: {
                select: {
                  id:
                    true,

                  name:
                    true,

                  whatsappNumber:
                    true,

                  whatsappOptIn:
                    true,
                },
              },
            },
          },
        },
      },
    },
  });
}

function normalizedNameKey(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizedRotationName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/*
 * Resolve a TeamKitState person back to a live Player / MatchKitPlayer /
 * KitRotationMember so reminders use the same WhatsApp number and consent
 * fields as the rest of Cric4All.
 */
async function resolveTeamKitStateContact({
  leagueId,
  matchId,
  teamIds,
  playerId,
  name,
}) {
  const cleanName =
    String(name || "")
      .trim()
      .replace(/\s+/g, " ");

  let player = null;

  if (playerId) {
    player =
      await prisma.player.findFirst({
        where: {
          id:
            Number(playerId),

          team: {
            leagueId:
              Number(leagueId),
          },
        },

        select: {
          id:
            true,

          name:
            true,

          teamId:
            true,

          whatsappNumber:
            true,

          whatsappOptIn:
            true,

          team: {
            select: {
              id:
                true,

              name:
                true,
            },
          },
        },
      });
  }

  if (
    !player &&
    cleanName
  ) {
    player =
      await prisma.player.findFirst({
        where: {
          name: {
            equals:
              cleanName,

            mode:
              "insensitive",
          },

          team: {
            leagueId:
              Number(leagueId),
          },
        },

        select: {
          id:
            true,

          name:
            true,

          teamId:
            true,

          whatsappNumber:
            true,

          whatsappOptIn:
            true,

          team: {
            select: {
              id:
                true,

              name:
                true,
            },
          },
        },

        orderBy: {
          id:
            "asc",
        },
      });
  }

  if (player) {
    return {
      playerId:
        player.id,

      name:
        player.name ||
        cleanName ||
        "Player",

      phone:
        player.whatsappNumber ||
        null,

      optedIn:
        player.whatsappOptIn ===
        true,

      teamId:
        player.teamId,

      teamName:
        player.team?.name ||
        null,
    };
  }

  /*
   * A screenshot-based playing roster may not have resolved to Player.id.
   * MatchKitPlayer is the next-best source for the upcoming carrier.
   */
  if (
    matchId &&
    cleanName
  ) {
    const matchKitPlayer =
      await prisma.matchKitPlayer.findFirst({
        where: {
          matchId:
            Number(matchId),

          ...(Array.isArray(teamIds) &&
          teamIds.length
            ? {
                teamId: {
                  in:
                    teamIds.map(Number),
                },
              }
            : {}),

          displayName: {
            equals:
              cleanName,

            mode:
              "insensitive",
          },

          isEligible:
            true,
        },

        select: {
          id:
            true,

          playerId:
            true,

          teamId:
            true,

          displayName:
            true,

          whatsappNumber:
            true,

          whatsappOptIn:
            true,

          team: {
            select: {
              id:
                true,

              name:
                true,
            },
          },

          player: {
            select: {
              id:
                true,

              name:
                true,

              whatsappNumber:
                true,

              whatsappOptIn:
                true,
            },
          },
        },

        orderBy: {
          id:
            "asc",
        },
      });

    if (matchKitPlayer) {
      return {
        playerId:
          matchKitPlayer.player?.id ||
          matchKitPlayer.playerId ||
          null,

        matchKitPlayerId:
          matchKitPlayer.id,

        name:
          matchKitPlayer.player?.name ||
          matchKitPlayer.displayName ||
          cleanName,

        phone:
          matchKitPlayer.player
            ?.whatsappNumber ||
          matchKitPlayer
            .whatsappNumber ||
          null,

        optedIn:
          matchKitPlayer.player
            ?.whatsappOptIn ===
            true ||
          matchKitPlayer
            .whatsappOptIn ===
            true,

        teamId:
          matchKitPlayer.teamId,

        teamName:
          matchKitPlayer.team?.name ||
          null,
      };
    }
  }

  /*
   * Final compatibility fallback for older custody records that were saved
   * by name and linked only through KitRotationMember.
   */
  if (cleanName) {
    const rotationMember =
      await prisma.kitRotationMember.findFirst({
        where: {
          leagueId:
            Number(leagueId),

          displayName: {
            equals:
              cleanName,

            mode:
              "insensitive",
          },

          isActive:
            true,
        },

        select: {
          id:
            true,

          playerId:
            true,

          teamId:
            true,

          displayName:
            true,

          whatsappNumber:
            true,

          whatsappOptIn:
            true,

          team: {
            select: {
              id:
                true,

              name:
                true,
            },
          },

          player: {
            select: {
              id:
                true,

              name:
                true,

              whatsappNumber:
                true,

              whatsappOptIn:
                true,
            },
          },
        },

        orderBy: {
          id:
            "asc",
        },
      });

    if (rotationMember) {
      return {
        playerId:
          rotationMember.player?.id ||
          rotationMember.playerId ||
          null,

        rotationMemberId:
          rotationMember.id,

        name:
          rotationMember.player?.name ||
          rotationMember.displayName ||
          cleanName,

        phone:
          rotationMember.player
            ?.whatsappNumber ||
          rotationMember
            .whatsappNumber ||
          null,

        optedIn:
          rotationMember.player
            ?.whatsappOptIn ===
            true ||
          rotationMember
            .whatsappOptIn ===
            true,

        teamId:
          rotationMember.teamId ||
          null,

        teamName:
          rotationMember.team?.name ||
          null,
      };
    }
  }

  return {
    playerId:
      playerId
        ? Number(playerId)
        : null,

    name:
      cleanName ||
      "Player",

    phone:
      null,

    optedIn:
      false,

    teamId:
      null,

    teamName:
      null,
  };
}

/*
 * KitReminderLog currently has a required KitAssignment foreign key.
 * The active Team Kit UI stores its live suggestion in TeamKitState.
 *
 * This compatibility assignment is therefore created/synchronized only so
 * the existing reminder log, callback, WhatsApp->SMS fallback and duplicate
 * protection can remain unchanged. TeamKitState remains the source of truth.
 */
async function ensureSharedReminderAssignment({
  match,
  state,
  assignedContact,
  now,
}) {
  const teamId =
    Number(
      assignedContact?.teamId
    );

  if (
    !Number.isInteger(teamId) ||
    teamId <= 0 ||
    ![
      Number(match.teamAId),
      Number(match.teamBId),
    ].includes(teamId)
  ) {
    return null;
  }

  const displayName =
    String(
      assignedContact?.name ||
      state?.suggestedHolderName ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const normalizedName =
    normalizedRotationName(
      displayName
    );

  if (!normalizedName) {
    return null;
  }

  const rotationKey =
    getKitRotationKey({
      leagueId:
        Number(match.leagueId),

      teamId,

      rotationMode:
        "LEAGUE_PLAYER",
    });

  const rotationMember =
    await prisma.kitRotationMember.upsert({
      where: {
        rotationKey_normalizedName: {
          rotationKey,
          normalizedName,
        },
      },

      update: {
        displayName,

        playerId:
          assignedContact
            ?.playerId ||
          undefined,

        whatsappNumber:
          assignedContact
            ?.phone ||
          undefined,

        whatsappOptIn:
          assignedContact
            ?.optedIn ===
          true,

        isActive:
          true,
      },

      create: {
        leagueId:
          Number(match.leagueId),

        rotationKey,

        teamId:
          null,

        playerId:
          assignedContact
            ?.playerId ||
          null,

        displayName,

        normalizedName,

        whatsappNumber:
          assignedContact
            ?.phone ||
          null,

        whatsappOptIn:
          assignedContact
            ?.optedIn ===
          true,

        isActive:
          true,
      },

      select: {
        id:
          true,
      },
    });

  let matchKitPlayerId =
    assignedContact
      ?.matchKitPlayerId ||
    null;

  if (
    !matchKitPlayerId
  ) {
    const matchingMatchPlayer =
      await prisma.matchKitPlayer.findFirst({
        where: {
          matchId:
            Number(match.id),

          teamId,

          OR: [
            ...(assignedContact
              ?.playerId
              ? [
                  {
                    playerId:
                      assignedContact
                        .playerId,
                  },
                ]
              : []),

            {
              displayName: {
                equals:
                  displayName,

                mode:
                  "insensitive",
              },
            },
          ],
        },

        select: {
          id:
            true,
        },

        orderBy: {
          id:
            "asc",
        },
      });

    matchKitPlayerId =
      matchingMatchPlayer?.id ||
      null;
  }

  const existing =
    await prisma.kitAssignment.findUnique({
      where: {
        matchId_teamId: {
          matchId:
            Number(match.id),

          teamId,
        },
      },

      select: {
        id:
          true,

        rotationMemberId:
          true,
      },
    });

  const assignedAt =
    state?.suggestedAt
      ? new Date(
          state.suggestedAt
        )
      : new Date(now);

  const assignment =
    await prisma.kitAssignment.upsert({
      where: {
        matchId_teamId: {
          matchId:
            Number(match.id),

          teamId,
        },
      },

      update: {
        leagueId:
          Number(match.leagueId),

        rotationKey,

        rotationMemberId:
          rotationMember.id,

        matchKitPlayerId,

        status:
          "SUGGESTED",

        assignedAt,

        assignmentReason:
          "Synced from the active TeamKitState suggestion for reminder delivery.",
      },

      create: {
        leagueId:
          Number(match.leagueId),

        matchId:
          Number(match.id),

        teamId,

        leagueKitId:
          null,

        rotationKey,

        rotationMemberId:
          rotationMember.id,

        matchKitPlayerId,

        status:
          "SUGGESTED",

        pickupStatus:
          "PENDING",

        assignedAt,

        assignmentReason:
          "Synced from the active TeamKitState suggestion for reminder delivery.",
      },

      select: {
        id:
          true,

        leagueId:
          true,

        matchId:
          true,

        teamId:
          true,
      },
    });

  /*
   * If "Suggest Another Fair Carrier" changed the carrier but reused the
   * same compatibility assignment row, allow the new recipient to receive
   * the reminder. A SENT reminder for the previous carrier must not suppress
   * the newly selected carrier.
   */
  if (
    existing &&
    Number(
      existing.rotationMemberId
    ) !==
      Number(
        rotationMember.id
      )
  ) {
    await prisma.kitReminderLog.updateMany({
      where: {
        assignmentId:
          assignment.id,

        status: {
          in: [
            "SENT",
            "SKIPPED",
            "FAILED",
          ],
        },
      },

      data: {
        status:
          "PENDING",

        providerMessageId:
          null,

        providerStatus:
          null,

        errorMessage:
          null,

        processingStartedAt:
          null,

        sentAt:
          null,

        failedAt:
          null,

        fallbackSmsStatus:
          null,

        fallbackSmsMessageId:
          null,

        fallbackSmsAttemptedAt:
          null,

        fallbackSmsQueuedAt:
          null,

        fallbackSmsError:
          null,
      },
    });
  }

  return assignment;
}


async function ensureTeamStateReminderAssignment({
  match,
  state,
  contact,
  now,
}) {
  const teamId =
    Number(state?.teamId);

  if (
    !Number.isInteger(teamId) ||
    teamId <= 0 ||
    ![
      Number(match.teamAId),
      Number(match.teamBId),
    ].includes(teamId)
  ) {
    return null;
  }

  const displayName =
    String(
      contact?.name ||
      state?.currentHolderName ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ");

  const normalizedName =
    normalizedRotationName(
      displayName
    );

  if (!normalizedName) {
    return null;
  }

  const rotationKey =
    getKitRotationKey({
      leagueId:
        Number(match.leagueId),

      teamId,

      rotationMode:
        "TEAM",
    });

  let rotationMember =
    null;

  if (contact?.playerId) {
    rotationMember =
      await prisma.kitRotationMember.findFirst({
        where: {
          rotationKey,

          playerId:
            Number(
              contact.playerId
            ),

          isActive:
            true,
        },

        select: {
          id:
            true,
        },
      });
  }

  if (!rotationMember) {
    rotationMember =
      await prisma.kitRotationMember.findFirst({
        where: {
          rotationKey,

          normalizedName,

          isActive:
            true,
        },

        select: {
          id:
            true,
        },
      });
  }

  if (!rotationMember) {
    rotationMember =
      await prisma.kitRotationMember.create({
        data: {
          leagueId:
            Number(match.leagueId),

          teamId,

          playerId:
            contact?.playerId ||
            null,

          rotationKey,

          displayName,

          normalizedName,

          whatsappNumber:
            contact?.phone ||
            null,

          whatsappOptIn:
            contact?.optedIn ===
            true,

          isActive:
            true,
        },

        select: {
          id:
            true,
        },
      });
  } else {
    await prisma.kitRotationMember.update({
      where: {
        id:
          rotationMember.id,
      },

      data: {
        displayName,

        ...(contact?.playerId
          ? {
              playerId:
                contact.playerId,
            }
          : {}),

        whatsappNumber:
          contact?.phone ||
          null,

        whatsappOptIn:
          contact?.optedIn ===
          true,

        isActive:
          true,
      },
    });
  }

  let matchKitPlayerId =
    contact?.matchKitPlayerId ||
    null;

  if (!matchKitPlayerId) {
    const matchKitPlayer =
      await prisma.matchKitPlayer.findFirst({
        where: {
          matchId:
            Number(match.id),

          teamId,

          OR: [
            ...(contact?.playerId
              ? [
                  {
                    playerId:
                      contact.playerId,
                  },
                ]
              : []),

            {
              displayName: {
                equals:
                  displayName,

                mode:
                  "insensitive",
              },
            },
          ],
        },

        select: {
          id:
            true,
        },

        orderBy: {
          id:
            "asc",
        },
      });

    matchKitPlayerId =
      matchKitPlayer?.id ||
      null;
  }

  const existing =
    await prisma.kitAssignment.findUnique({
      where: {
        matchId_teamId: {
          matchId:
            Number(match.id),

          teamId,
        },
      },

      select: {
        id:
          true,

        rotationMemberId:
          true,
      },
    });

  const assignedAt =
    state?.suggestedAt
      ? new Date(
          state.suggestedAt
        )
      : new Date(now);

  const assignment =
    await prisma.kitAssignment.upsert({
      where: {
        matchId_teamId: {
          matchId:
            Number(match.id),

          teamId,
        },
      },

      update: {
        leagueId:
          Number(match.leagueId),

        leagueKitId:
          null,

        rotationKey,

        rotationMemberId:
          rotationMember.id,

        matchKitPlayerId,

        status:
          "SUGGESTED",

        assignedAt,

        pickupStatus:
          "PENDING",

        assignmentReason:
          "Synced from TeamKitState for kit-reminder delivery.",
      },

      create: {
        leagueId:
          Number(match.leagueId),

        matchId:
          Number(match.id),

        teamId,

        leagueKitId:
          null,

        rotationKey,

        rotationMemberId:
          rotationMember.id,

        matchKitPlayerId,

        status:
          "SUGGESTED",

        assignedAt,

        pickupStatus:
          "PENDING",

        assignmentReason:
          "Synced from TeamKitState for kit-reminder delivery.",
      },

      select: {
        id:
          true,

        leagueId:
          true,

        matchId:
          true,

        teamId:
          true,
      },
    });

  /*
   * If the responsible person changed for this match, a reminder that was
   * already SENT/SKIPPED/FAILED for the old person must not suppress the
   * newly responsible person.
   */
  if (
    existing &&
    Number(
      existing.rotationMemberId
    ) !==
      Number(
        rotationMember.id
      )
  ) {
    await prisma.kitReminderLog.updateMany({
      where: {
        assignmentId:
          assignment.id,

        status: {
          in: [
            "SENT",
            "SKIPPED",
            "FAILED",
          ],
        },
      },

      data: {
        status:
          "PENDING",

        providerMessageId:
          null,

        providerStatus:
          null,

        errorMessage:
          null,

        processingStartedAt:
          null,

        sentAt:
          null,

        failedAt:
          null,

        fallbackSmsStatus:
          null,

        fallbackSmsMessageId:
          null,

        fallbackSmsAttemptedAt:
          null,

        fallbackSmsQueuedAt:
          null,

        fallbackSmsError:
          null,
      },
    });
  }

  return assignment;
}

/*
 * Load the NEXT scheduled match for each active shared-kit league from the
 * same TeamKitState row used by TeamKitManagement.jsx.
 *
 * Old ABANDONED / COMPLETED / CANCELLED matches with stale KitAssignments
 * are intentionally not candidates for this shared-kit path.
 */
async function loadSharedTeamKitStateMatches(
  now
) {
  const stateRows =
    await prisma.$queryRaw`
      SELECT
        state.*
      FROM "TeamKitState" state
      WHERE state."scopeKey" = 'LEAGUE'
        AND state."suggestedHolderName" IS NOT NULL
        AND state."suggestedForMatchId" IS NOT NULL
    `;

  if (
    !Array.isArray(stateRows) ||
    stateRows.length === 0
  ) {
    return [];
  }

  const leagueIds = [
    ...new Set(
      stateRows
        .map((row) =>
          Number(row.leagueId)
        )
        .filter(
          (leagueId) =>
            Number.isInteger(
              leagueId
            ) &&
            leagueId > 0
        )
    ),
  ];

  if (
    leagueIds.length === 0
  ) {
    return [];
  }

  const candidateMatches =
    await prisma.match.findMany({
      where: {
        leagueId: {
          in:
            leagueIds,
        },

        scheduledAt: {
          not:
            null,

          gte:
            new Date(now),
        },
      },

      orderBy: [
        {
          scheduledAt:
            "asc",
        },
        {
          id:
            "asc",
        },
      ],

      select: {
        id:
          true,

        leagueId:
          true,

        teamAId:
          true,

        teamBId:
          true,

        scheduledAt:
          true,

        status:
          true,

        league: {
          select: {
            id:
              true,

            name:
              true,

            timeZone:
              true,

            kitRotationMode:
              true,
          },
        },

        teamA: {
          select: {
            id:
              true,

            name:
              true,
          },
        },

        teamB: {
          select: {
            id:
              true,

            name:
              true,
          },
        },
      },
    });

  const statesByLeague =
    new Map(
      stateRows.map((row) => [
        Number(row.leagueId),
        row,
      ])
    );

  const nextByLeague =
    new Map();

  for (
    const match
    of candidateMatches
  ) {
    if (
      match.league
        ?.kitRotationMode !==
        "LEAGUE_PLAYER"
    ) {
      continue;
    }

    if (
      isClosedMatch(match)
    ) {
      continue;
    }

    if (
      nextByLeague.has(
        Number(match.leagueId)
      )
    ) {
      continue;
    }

    nextByLeague.set(
      Number(match.leagueId),
      match
    );
  }

  const result = [];

  for (
    const [
      leagueId,
      match,
    ]
    of nextByLeague.entries()
  ) {
    const state =
      statesByLeague.get(
        leagueId
      );

    /*
     * A suggestion belongs to one match. Never carry a stale suggestion
     * forward to a different upcoming match.
     */
    if (
      !state ||
      Number(
        state.suggestedForMatchId
      ) !==
        Number(match.id)
    ) {
      continue;
    }

    const teamIds = [
      Number(match.teamAId),
      Number(match.teamBId),
    ];

    const assignedContact =
      await resolveTeamKitStateContact({
        leagueId,

        matchId:
          match.id,

        teamIds,

        playerId:
          state
            .suggestedHolderPlayerId,

        name:
          state
            .suggestedHolderName,
      });

    const holderContact =
      state.currentHolderName
        ? await resolveTeamKitStateContact({
            leagueId,

            matchId:
              match.id,

            teamIds:
              [],

            playerId:
              state
                .currentHolderPlayerId,

            name:
              state
                .currentHolderName,
          })
        : null;

    result.push({
      ...match,

      kitAssignments:
        [],

      sharedKitState: {
        ...state,

        assignedContact,

        holderContact,
      },
    });
  }

  return result;
}


/*
 * Load upcoming matches for leagues that use separate TEAM kits.
 *
 * For each team, only its NEXT scheduled match is considered. This means an
 * old ABANDONED/COMPLETED match cannot drive reminders just because it still
 * has an old KitAssignment.
 *
 * A TeamKitState suggestion is optional. If there is no suggestion for the
 * exact upcoming match, the current physical holder is the responsible
 * person and receives the normal kit reminder.
 */
async function loadTeamKitStateMatches(
  now
) {
  const stateRows =
    await prisma.$queryRaw`
      SELECT
        state.*
      FROM "TeamKitState" state
      WHERE state."scopeKey" LIKE 'TEAM:%'
        AND state."teamId" IS NOT NULL
        AND state."currentHolderName" IS NOT NULL
    `;

  if (
    !Array.isArray(stateRows) ||
    stateRows.length === 0
  ) {
    return [];
  }

  const leagueIds = [
    ...new Set(
      stateRows
        .map((row) =>
          Number(row.leagueId)
        )
        .filter(
          (leagueId) =>
            Number.isInteger(
              leagueId
            ) &&
            leagueId > 0
        )
    ),
  ];

  if (
    leagueIds.length === 0
  ) {
    return [];
  }

  const candidateMatches =
    await prisma.match.findMany({
      where: {
        leagueId: {
          in:
            leagueIds,
        },

        scheduledAt: {
          not:
            null,

          gte:
            new Date(now),
        },
      },

      orderBy: [
        {
          scheduledAt:
            "asc",
        },
        {
          id:
            "asc",
        },
      ],

      select: {
        id:
          true,

        leagueId:
          true,

        teamAId:
          true,

        teamBId:
          true,

        scheduledAt:
          true,

        status:
          true,

        league: {
          select: {
            id:
              true,

            name:
              true,

            timeZone:
              true,

            kitRotationMode:
              true,
          },
        },

        teamA: {
          select: {
            id:
              true,

            name:
              true,
          },
        },

        teamB: {
          select: {
            id:
              true,

            name:
              true,
          },
        },
      },
    });

  const statesByTeam =
    new Map();

  for (
    const row
    of stateRows
  ) {
    const key =
      `${Number(row.leagueId)}:${Number(row.teamId)}`;

    statesByTeam.set(
      key,
      row
    );
  }

  /*
   * A team can have several future matches. Its physical kit holder should
   * be reminded for the team's NEXT match, not every later match at once.
   */
  const claimedTeams =
    new Set();

  const resultByMatch =
    new Map();

  for (
    const match
    of candidateMatches
  ) {
    if (
      match.league
        ?.kitRotationMode ===
        "LEAGUE_PLAYER"
    ) {
      continue;
    }

    if (
      isClosedMatch(match)
    ) {
      continue;
    }

    const playingTeams = [
      {
        id:
          Number(match.teamAId),

        name:
          match.teamA?.name ||
          "Team A",
      },

      {
        id:
          Number(match.teamBId),

        name:
          match.teamB?.name ||
          "Team B",
      },
    ];

    const applicableStates =
      [];

    for (
      const team
      of playingTeams
    ) {
      const teamKey =
        `${Number(match.leagueId)}:${team.id}`;

      if (
        claimedTeams.has(
          teamKey
        )
      ) {
        continue;
      }

      const state =
        statesByTeam.get(
          teamKey
        );

      if (
        !state ||
        !state.currentHolderName
      ) {
        continue;
      }

      const teamIds = [
        Number(match.teamAId),
        Number(match.teamBId),
      ];

      const holderContact =
        await resolveTeamKitStateContact({
          leagueId:
            Number(match.leagueId),

          matchId:
            match.id,

          teamIds: [
            team.id,
          ],

          playerId:
            state
              .currentHolderPlayerId,

          name:
            state
              .currentHolderName,
        });

      const suggestionMatches =
        Boolean(
          state
            .suggestedHolderName &&
          state
            .suggestedForMatchId &&
          Number(
            state
              .suggestedForMatchId
          ) ===
            Number(match.id)
        );

      const suggestedContact =
        suggestionMatches
          ? await resolveTeamKitStateContact({
              leagueId:
                Number(match.leagueId),

              matchId:
                match.id,

              teamIds: [
                team.id,
              ],

              playerId:
                state
                  .suggestedHolderPlayerId,

              name:
                state
                  .suggestedHolderName,
            })
          : null;

      applicableStates.push({
        ...state,

        teamId:
          team.id,

        teamName:
          team.name,

        holderContact,

        suggestedContact,

        suggestionMatches,
      });

      claimedTeams.add(
        teamKey
      );
    }

    if (
      applicableStates.length ===
      0
    ) {
      continue;
    }

    resultByMatch.set(
      Number(match.id),
      {
        ...match,

        kitAssignments:
          [],

        teamKitStates:
          applicableStates,
      }
    );
  }

  return [
    ...resultByMatch.values(),
  ];
}

async function loadMatches(
  now
) {
  const [
    legacyMatches,
    sharedMatches,
    teamStateMatches,
  ] = await Promise.all([
    loadLegacyAssignmentMatches(),

    loadSharedTeamKitStateMatches(
      now
    ),

    loadTeamKitStateMatches(
      now
    ),
  ]);

  /*
   * If a league has an active TeamKitState-based upcoming match, that is
   * the current Team Kit UI's source of truth. Do not also load stale old
   * KitAssignments from the same league.
   */
  const stateManagedLeagueIds =
    new Set(
      [
        ...sharedMatches,
        ...teamStateMatches,
      ].map((match) =>
        Number(match.leagueId)
      )
    );

  const legacyOnlyMatches =
    legacyMatches.filter(
      (match) =>
        !stateManagedLeagueIds.has(
          Number(match.leagueId)
        )
    );

  return [
    ...legacyOnlyMatches,
    ...sharedMatches,
    ...teamStateMatches,
  ].sort((a, b) => {
    const aTime =
      new Date(
        a.scheduledAt
      ).getTime();

    const bTime =
      new Date(
        b.scheduledAt
      ).getTime();

    return aTime - bTime;
  });
}

async function sendOneRecipient({
  assignment,
  match,
  reminderType,
  recipientType,
  recipient,
  scheduledFor,
  content,
  sendPrimary,
  summary,
  dryRun,
}) {
  summary
    .checkedRecipients +=
    1;

  const normalizedPhone =
    normalizeInternationalPhone(
      recipient.phone
    );

  let reminder =
    await createOrLoadReminder({
      assignment,

      recipientType,

      recipientName:
        recipient.name,

      recipientPhone:
        normalizedPhone ||
        recipient.phone ||
        null,

      scheduledFor,

      reminderType,
    });

  if (
    reminder.status ===
    "SENT"
  ) {
    summary
      .alreadySent +=
      1;

    return;
  }

  if (
    reminder.status ===
    "PROCESSING"
  ) {
    summary
      .notClaimed +=
      1;

    return;
  }

  if (!recipient.optedIn) {
    await markReminderSkipped(
      reminder.id,
      `${recipientType === "CURRENT_HOLDER" ? "The current kit holder" : "The assigned carrier"} has not granted Cric4All communication consent.`
    );

    summary.skipped +=
      1;

    return;
  }

  if (!normalizedPhone) {
    await markReminderSkipped(
      reminder.id,
      `${recipientType === "CURRENT_HOLDER" ? "The current kit holder" : "The assigned carrier"} does not have a valid international phone number.`
    );

    summary.skipped +=
      1;

    return;
  }

  if (
    reminder.status ===
      "SKIPPED" ||
    reminder.status ===
      "FAILED"
  ) {
    reminder =
      await resetReminderToPending(
        reminder.id
      );
  }

  if (dryRun) {
    summary.dryRun +=
      1;

    return;
  }

  const claim =
    await claimReminder(
      reminder.id
    );

  if (
    claim.count !==
    1
  ) {
    summary
      .notClaimed +=
      1;

    return;
  }

  try {
    const result =
      await sendPlayerCommunication({
        type:
          "KIT_REMINDER",

        consentGranted:
          recipient.optedIn,

        recipientPhone:
          normalizedPhone,

        fallbackEligible:
          true,

        fallbackBody:
          content
            .fallbackSmsBody,

        context: {
          assignmentId:
            assignment.id,

          reminderId:
            reminder.id,

          recipientType,

          reminderType,

          reminderTiming:
            getReminderLogLabel(
              reminderType
            ),

          matchId:
            assignment.matchId,

          leagueId:
            assignment.leagueId,

          teamId:
            assignment.teamId,

          playerName:
            recipient.name,
        },

        sendPrimary:
          () =>
            sendPrimary({
              recipientPhone:
                normalizedPhone,

              context: {
                assignmentId:
                  assignment.id,

                reminderId:
                  reminder.id,

                recipientType,

                reminderType,

                matchId:
                  assignment.matchId,

                leagueId:
                  assignment.leagueId,
              },
            }),
      });

    await markReminderQueued(
      reminder.id,
      result
    );

    addProviderResultToSummary(
      summary,
      result,
      recipientType
    );
  } catch (error) {
    console.error(
      `[KIT_ROLE_REMINDER_FAILED] ${recipientType} ${reminderType} assignment ${assignment.id}`,
      error
    );

    await markReminderFailed(
      reminder.id,
      error
    );

    summary.failed +=
      1;
  }
}


async function processTeamKitStateMatch({
  match,
  reminderType,
  now,
  summary,
  dryRun,
  timeZone,
}) {
  const formattedMatch =
    formatMatchDateTime(
      match.scheduledAt,
      timeZone
    );

  const leagueName =
    match.league?.name ||
    "Your league";

  for (
    const state
    of match.teamKitStates || []
  ) {
    const teamId =
      Number(state.teamId);

    const teamName =
      state.teamName ||
      (
        teamId ===
        Number(match.teamAId)
          ? match.teamA?.name
          : match.teamB?.name
      ) ||
      "Your team";

    const opponentName =
      getOpponentName(
        match,
        teamId
      );

    const holder =
      state.holderContact ||
      null;

    if (
      !holder ||
      !holder.name
    ) {
      summary.skipped +=
        1;

      console.warn(
        "[KIT_TEAM_REMINDER_SKIPPED]",
        {
          leagueId:
            match.leagueId,

          matchId:
            match.id,

          teamId,

          currentHolderName:
            state.currentHolderName ||
            null,

          reason:
            "CURRENT_HOLDER_NOT_RESOLVED",
        }
      );

      continue;
    }

    const suggested =
      state.suggestionMatches
        ? state.suggestedContact
        : null;

    /*
     * When an exact-match suggestion exists, the suggested player is the
     * upcoming carrier. Otherwise the current holder remains responsible
     * for bringing the team's kit to the next match.
     */
    const responsible =
      suggested?.name
        ? suggested
        : holder;

    const assignment =
      await ensureTeamStateReminderAssignment({
        match,
        state,
        contact:
          responsible,
        now,
      });

    if (!assignment) {
      summary.skipped +=
        1;

      console.warn(
        "[KIT_TEAM_REMINDER_SKIPPED]",
        {
          leagueId:
            match.leagueId,

          matchId:
            match.id,

          teamId,

          responsibleName:
            responsible.name,

          reason:
            "COMPATIBILITY_ASSIGNMENT_NOT_CREATED",
        }
      );

      continue;
    }

    summary
      .checkedAssignments +=
      1;

    const scheduledFor =
      getReminderScheduledFor({
        reminderType,

        match,
        now,
      });

    if (!suggested?.name) {
      /*
       * No explicit next carrier was selected. The physical current holder
       * is responsible for the team kit, so send the existing ordinary kit
       * reminder directly to that holder.
       */
      const content =
        buildKitReminderCommunicationContent({
          playerName:
            holder.name,

          teamName,

          opponentName,

          leagueName,

          matchDateText:
            formattedMatch
              .dateText,

          matchTimeText:
            formattedMatch
              .timeText,
        });

      const whatsappVariables =
        content
          .whatsappVariables;

      await sendOneRecipient({
        assignment,
        match,

        reminderType,

        recipientType:
          "CURRENT_HOLDER",

        recipient:
          holder,

        scheduledFor,

        content,

        summary,
        dryRun,

        sendPrimary:
          ({
            recipientPhone,
          }) =>
            sendKitReminderWhatsApp({
              phoneNumber:
                recipientPhone,

              playerName:
                whatsappVariables
                  .playerName,

              teamName:
                whatsappVariables
                  .teamName,

              opponentName:
                whatsappVariables
                  .opponentName,

              leagueName:
                whatsappVariables
                  .leagueName,

              matchDateText:
                whatsappVariables
                  .matchDateText,

              matchTimeText:
                whatsappVariables
                  .matchTimeText,
            }),
      });

      continue;
    }

    const currentHolderName =
      holder.name;

    const assignedContent =
      buildAssignedCarrierKitContent({
        assignedCarrierName:
          suggested.name,

        assignedTeamName:
          teamName,

        opponentName,

        currentHolderName,

        matchDateText:
          formattedMatch
            .dateText,

        matchTimeText:
          formattedMatch
            .timeText,

        leagueName,

        reminderType,
      });

    await sendOneRecipient({
      assignment,
      match,

      reminderType,

      recipientType:
        "ASSIGNED_CARRIER",

      recipient:
        suggested,

      scheduledFor,

      content:
        assignedContent,

      summary,
      dryRun,

      sendPrimary:
        ({
          recipientPhone,
          context,
        }) =>
          sendAssignedCarrierKitWhatsApp({
            recipientPhone,

            assignedCarrierName:
              suggested.name,

            assignedTeamName:
              teamName,

            opponentName,

            matchDateText:
              formattedMatch
                .dateText,

            matchTimeText:
              formattedMatch
                .timeText,

            currentHolderName,

            leagueName,

            context,
          }),
    });

    const samePerson =
      (
        suggested.playerId &&
        holder.playerId &&
        Number(
          suggested.playerId
        ) ===
          Number(
            holder.playerId
          )
      ) ||
      (
        normalizedNameKey(
          suggested.name
        ) &&
        normalizedNameKey(
          suggested.name
        ) ===
          normalizedNameKey(
            holder.name
          )
      );

    if (samePerson) {
      summary
        .holderNotRequired +=
        1;

      continue;
    }

    /*
     * If the current holder and next suggested carrier differ, the current
     * holder still has the physical kit and needs the coordination reminder
     * on both day-before and two-hours-before runs until custody changes.
     */
    const holderContent =
      buildCurrentHolderKitContent({
        currentHolderName:
          holder.name,

        assignedCarrierName:
          suggested.name,

        assignedTeamName:
          teamName,

        opponentName,

        matchDateText:
          formattedMatch
            .dateText,

        matchTimeText:
          formattedMatch
            .timeText,

        leagueName,

        reminderType,
      });

    await sendOneRecipient({
      assignment,
      match,

      reminderType,

      recipientType:
        "CURRENT_HOLDER",

      recipient:
        holder,

      scheduledFor,

      content:
        holderContent,

      summary,
      dryRun,

      sendPrimary:
        ({
          recipientPhone,
          context,
        }) =>
          sendCurrentHolderKitWhatsApp({
            recipientPhone,

            currentHolderName:
              holder.name,

            assignedCarrierName:
              suggested.name,

            assignedTeamName:
              teamName,

            opponentName,

            matchDateText:
              formattedMatch
                .dateText,

            matchTimeText:
              formattedMatch
                .timeText,

            leagueName,

            context,
          }),
    });
  }
}

async function processSharedTeamKitStateMatch({
  match,
  reminderType,
  now,
  summary,
  dryRun,
  timeZone,
}) {
  const state =
    match.sharedKitState;

  const assignedPlayer =
    state?.assignedContact ||
    null;

  if (
    !assignedPlayer ||
    !assignedPlayer.name
  ) {
    summary.skipped +=
      1;

    console.warn(
      "[KIT_SHARED_REMINDER_SKIPPED]",
      {
        leagueId:
          match.leagueId,

        matchId:
          match.id,

        reason:
          "SUGGESTED_CARRIER_NOT_RESOLVED",
      }
    );

    return;
  }

  const assignment =
    await ensureSharedReminderAssignment({
      match,
      state,
      assignedContact:
        assignedPlayer,
      now,
    });

  if (!assignment) {
    summary.skipped +=
      1;

    console.warn(
      "[KIT_SHARED_REMINDER_SKIPPED]",
      {
        leagueId:
          match.leagueId,

        matchId:
          match.id,

        suggestedHolderName:
          state
            ?.suggestedHolderName ||
          null,

        reason:
          "SUGGESTED_CARRIER_TEAM_NOT_RESOLVED",
      }
    );

    return;
  }

  summary
    .checkedAssignments +=
    1;

  const scheduledFor =
    getReminderScheduledFor({
      reminderType,

      match,
      now,
    });

  const formattedMatch =
    formatMatchDateTime(
      match.scheduledAt,
      timeZone
    );

  const assignedTeamName =
    assignedPlayer
      .teamName ||
    (
      Number(
        assignedPlayer.teamId
      ) ===
      Number(match.teamAId)
        ? match.teamA?.name
        : Number(
              assignedPlayer.teamId
            ) ===
            Number(match.teamBId)
          ? match.teamB?.name
          : null
    ) ||
    "Your team";

  const opponentName =
    getOpponentName(
      match,
      assignment.teamId
    );

  const leagueName =
    match.league?.name ||
    "Your league";

  const holder =
    state?.holderContact ||
    null;

  const currentHolderName =
    holder?.name ||
    state?.currentHolderName ||
    "the current holder";

  const assignedContent =
    buildAssignedCarrierKitContent({
      assignedCarrierName:
        assignedPlayer.name,

      assignedTeamName,

      opponentName,

      currentHolderName,

      matchDateText:
        formattedMatch
          .dateText,

      matchTimeText:
        formattedMatch
          .timeText,

      leagueName,

      reminderType,
    });

  await sendOneRecipient({
    assignment,
    match,

    reminderType,

    recipientType:
      "ASSIGNED_CARRIER",

    recipient:
      assignedPlayer,

    scheduledFor,

    content:
      assignedContent,

    summary,
    dryRun,

    sendPrimary:
      ({
        recipientPhone,
        context,
      }) =>
        sendAssignedCarrierKitWhatsApp({
          recipientPhone,

          assignedCarrierName:
            assignedPlayer.name,

          assignedTeamName,

          opponentName,

          matchDateText:
            formattedMatch
              .dateText,

          matchTimeText:
            formattedMatch
              .timeText,

          currentHolderName,

          leagueName,

          context,
        }),
  });

  if (
    !holder ||
    !state?.currentHolderName
  ) {
    summary
      .holderNotRequired +=
      1;

    return;
  }

  const samePerson =
    (
      assignedPlayer.playerId &&
      holder.playerId &&
      Number(
        assignedPlayer.playerId
      ) ===
        Number(
          holder.playerId
        )
    ) ||
    (
      normalizedNameKey(
        assignedPlayer.name
      ) &&
      normalizedNameKey(
        assignedPlayer.name
      ) ===
        normalizedNameKey(
          holder.name
        )
    );

  /*
   * In the active TeamKitState workflow, custody itself is the handover
   * signal. If the current holder is still different from the assigned
   * carrier, coordination is still relevant.
   *
   * Therefore:
   * - DAY_BEFORE: current holder receives the coordination reminder.
   * - TWO_HOURS_BEFORE: current holder receives it again if custody has
   *   still not moved to the assigned carrier.
   */
  const shouldSendHolder =
    reminderType ===
      "DAY_BEFORE" ||
    reminderType ===
      "TWO_HOURS_BEFORE";

  if (
    !shouldSendHolder ||
    samePerson
  ) {
    summary
      .holderNotRequired +=
      1;

    return;
  }

  const holderContent =
    buildCurrentHolderKitContent({
      currentHolderName:
        holder.name,

      assignedCarrierName:
        assignedPlayer.name,

      assignedTeamName,

      opponentName,

      matchDateText:
        formattedMatch
          .dateText,

      matchTimeText:
        formattedMatch
          .timeText,

      leagueName,

      reminderType,
    });

  await sendOneRecipient({
    assignment,
    match,

    reminderType,

    recipientType:
      "CURRENT_HOLDER",

    recipient:
      holder,

    scheduledFor,

    content:
      holderContent,

    summary,
    dryRun,

    sendPrimary:
      ({
        recipientPhone,
        context,
      }) =>
        sendCurrentHolderKitWhatsApp({
          recipientPhone,

          currentHolderName:
            holder.name,

          assignedCarrierName:
            assignedPlayer.name,

          assignedTeamName,

          opponentName,

          matchDateText:
            formattedMatch
              .dateText,

          matchTimeText:
            formattedMatch
              .timeText,

          leagueName,

          context,
        }),
  });
}

export async function processKitReminders({
  reminderType,
  now = new Date(),

  dryRun =
    String(
      process.env
        .KIT_REMINDER_DRY_RUN ||
        "false"
    )
      .trim()
      .toLowerCase() ===
    "true",
} = {}) {
  const normalizedReminderType =
    normalizeStatus(
      reminderType
    );

  if (
    !SUPPORTED_REMINDER_TYPES.has(
      normalizedReminderType
    )
  ) {
    throw new Error(
      `Unsupported kit reminder type: ${reminderType}`
    );
  }

  const matches =
    await loadMatches(
      now
    );

  const summary =
    createSummary({
      reminderType:
        normalizedReminderType,

      checkedMatches:
        matches.length,
    });

  for (
    const match
    of matches
  ) {
    if (
      isClosedMatch(match)
    ) {
      summary
        .closedMatches +=
        1;

      continue;
    }

    const timeZone =
      validTimeZone(
        match.league
          ?.timeZone
      );

    const eligibility =
      getReminderEligibility({
        reminderType:
          normalizedReminderType,

        match,
        now,
        timeZone,
      });

    if (
      !eligibility.eligible
    ) {
      if (
        eligibility
          .minutesUntilMatch !==
          null &&
        eligibility
          .minutesUntilMatch <=
          0
      ) {
        summary
          .matchesAlreadyStarted +=
          1;
      } else if (
        normalizedReminderType ===
        "DAY_BEFORE"
      ) {
        summary
          .notDueTomorrow +=
          1;
      } else {
        summary
          .notInTwoHourWindow +=
          1;
      }

      continue;
    }

    /*
     * Active per-team kit workflow:
     * TeamKitState + each playing team's NEXT match are the source of truth.
     */
    if (
      match.teamKitStates
    ) {
      summary
        .eligibleMatches +=
        1;

      await processTeamKitStateMatch({
        match,

        reminderType:
          normalizedReminderType,

        now,
        summary,
        dryRun,
        timeZone,
      });

      continue;
    }

    /*
     * Active shared-league-kit workflow:
     * TeamKitState + the next scheduled match are the source of truth.
     */
    if (
      match.sharedKitState
    ) {
      summary
        .eligibleMatches +=
        1;

      await processSharedTeamKitStateMatch({
        match,

        reminderType:
          normalizedReminderType,

        now,
        summary,
        dryRun,
        timeZone,
      });

      continue;
    }

    const activeAssignments =
      match.league
        ?.kitRotationMode ===
      "LEAGUE_PLAYER"
        ? match
            .kitAssignments
            .filter(
              (assignment) =>
                assignment
                  .leagueKitId
            )
            .slice(0, 1)
        : match
            .kitAssignments;

    if (
      activeAssignments.length ===
      0
    ) {
      continue;
    }

    summary
      .eligibleMatches +=
      1;

    const formattedMatch =
      formatMatchDateTime(
        match.scheduledAt,
        timeZone
      );

    for (
      const assignment
      of activeAssignments
    ) {
      summary
        .checkedAssignments +=
        1;

      const scheduledFor =
        getReminderScheduledFor({
          reminderType:
            normalizedReminderType,

          match,
          now,
        });

      const assignedPlayer =
        getAssignedPlayer(
          assignment
        );

      const opponentName =
        getOpponentName(
          match,
          assignment.teamId
        );

      const leagueName =
        match.league?.name ||
        "Your league";

      const teamName =
        assignment.team
          ?.name ||
        "Your team";

      /*
       * Shared league kit: two distinct operational roles.
       */
      if (
        assignment
          .leagueKitId
      ) {
        const holder =
          contactFromRotationMember(
            assignment
              .leagueKit
              ?.currentHolderRotationMember
          );

        const assignedContent =
          buildAssignedCarrierKitContent({
            assignedCarrierName:
              assignedPlayer.name,

            assignedTeamName:
              teamName,

            opponentName,

            currentHolderName:
              holder.name,

            matchDateText:
              formattedMatch
                .dateText,

            matchTimeText:
              formattedMatch
                .timeText,

            leagueName,

            reminderType:
              normalizedReminderType,
          });

        await sendOneRecipient({
          assignment,
          match,

          reminderType:
            normalizedReminderType,

          recipientType:
            "ASSIGNED_CARRIER",

          recipient:
            assignedPlayer,

          scheduledFor,

          content:
            assignedContent,

          summary,
          dryRun,

          sendPrimary:
            ({
              recipientPhone,
              context,
            }) =>
              sendAssignedCarrierKitWhatsApp({
                recipientPhone,

                assignedCarrierName:
                  assignedPlayer.name,

                assignedTeamName:
                  teamName,

                opponentName,

                matchDateText:
                  formattedMatch
                    .dateText,

                matchTimeText:
                  formattedMatch
                    .timeText,

                currentHolderName:
                  holder.name,

                leagueName,

                context,
              }),
        });

        const shouldSendHolder =
          normalizedReminderType ===
            "DAY_BEFORE" ||
          (normalizedReminderType ===
            "TWO_HOURS_BEFORE" &&
            holderNeedsTwoHourReminder(
              assignment
                .leagueKit
            ));

        const samePerson =
          assignment
            .leagueKit
            ?.currentHolderRotationMember
            ?.id &&
          Number(
            assignment
              .leagueKit
              .currentHolderRotationMember
              .id
          ) ===
            Number(
              assignment
                .rotationMemberId
            );

        if (
          shouldSendHolder &&
          !samePerson &&
          assignment
            .leagueKit
            ?.currentHolderRotationMember
        ) {
          const holderContent =
            buildCurrentHolderKitContent({
              currentHolderName:
                holder.name,

              assignedCarrierName:
                assignedPlayer.name,

              assignedTeamName:
                teamName,

              opponentName,

              matchDateText:
                formattedMatch
                  .dateText,

              matchTimeText:
                formattedMatch
                  .timeText,

              leagueName,

              reminderType:
                normalizedReminderType,
            });

          await sendOneRecipient({
            assignment,
            match,

            reminderType:
              normalizedReminderType,

            recipientType:
              "CURRENT_HOLDER",

            recipient:
              holder,

            scheduledFor,

            content:
              holderContent,

            summary,
            dryRun,

            sendPrimary:
              ({
                recipientPhone,
                context,
              }) =>
                sendCurrentHolderKitWhatsApp({
                  recipientPhone,

                  currentHolderName:
                    holder.name,

                  assignedCarrierName:
                    assignedPlayer.name,

                  assignedTeamName:
                    teamName,

                  opponentName,

                  matchDateText:
                    formattedMatch
                      .dateText,

                  matchTimeText:
                    formattedMatch
                      .timeText,

                  leagueName,

                  context,
                }),
          });
        } else {
          summary
            .holderNotRequired +=
            1;
        }

        continue;
      }

      /*
       * Ordinary team-level kit reminder:
       * preserve the existing approved template and behavior.
       */
      const content =
        buildKitReminderCommunicationContent({
          playerName:
            assignedPlayer.name,

          teamName,

          opponentName,

          leagueName,

          matchDateText:
            formattedMatch
              .dateText,

          matchTimeText:
            formattedMatch
              .timeText,
        });

      const whatsappVariables =
        content
          .whatsappVariables;

      await sendOneRecipient({
        assignment,
        match,

        reminderType:
          normalizedReminderType,

        recipientType:
          "PLAYER",

        recipient:
          assignedPlayer,

        scheduledFor,

        content,

        summary,
        dryRun,

        sendPrimary:
          ({
            recipientPhone,
          }) =>
            sendKitReminderWhatsApp({
              phoneNumber:
                recipientPhone,

              playerName:
                whatsappVariables
                  .playerName,

              teamName:
                whatsappVariables
                  .teamName,

              opponentName:
                whatsappVariables
                  .opponentName,

              leagueName:
                whatsappVariables
                  .leagueName,

              matchDateText:
                whatsappVariables
                  .matchDateText,

              matchTimeText:
                whatsappVariables
                  .matchTimeText,
            }),
      });
    }
  }

  return finalizeSummary(
    summary
  );
}

export function processDayBeforeKitReminders(
  options
) {
  return processKitReminders({
    ...options,

    reminderType:
      "DAY_BEFORE",
  });
}

export function processTwoHoursBeforeKitReminders(
  options
) {
  return processKitReminders({
    ...options,

    reminderType:
      "TWO_HOURS_BEFORE",
  });
}
