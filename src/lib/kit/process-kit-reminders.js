import prisma from "@/lib/prisma";
import {
  formatMatchDateTime,
  isTomorrowInTimeZone,
  validTimeZone,
} from "@/lib/kit/reminder-time";
import {
  normalizeInternationalPhone,
} from "@/lib/notifications/phone";
import {
  sendKitReminderWhatsApp,
} from "@/lib/notifications/send-whatsapp";
import {
  sendPlayerCommunication,
} from "@/lib/communications/sendPlayerCommunication";
import {
  buildKitReminderCommunicationContent,
} from "@/lib/communications/templates/kitReminder";

/**
 * Reminder configuration.
 */
const REMINDER_TYPE = "DAY_BEFORE";
const REMINDER_CHANNEL = "WHATSAPP";
const RECIPIENT_TYPE = "PLAYER";

const ACTIVE_ASSIGNMENT_STATUSES = [
  "SUGGESTED",
  "ASSIGNED",
  "CONFIRMED",
];

const CLOSED_MATCH_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
  "ABANDONED",
  "CANCELLED",
  "CANCELED",
]);

/**
 * Normalizes a match status because your Match.status field may contain
 * either lowercase or uppercase values.
 */
function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

/**
 * Returns true when reminders should not be sent for the match.
 */
function isClosedMatch(match) {
  return CLOSED_MATCH_STATUSES.has(
    normalizeStatus(match?.status)
  );
}

/**
 * Returns the opponent's team name for a kit assignment.
 */
function getOpponentName(match, assignedTeamId) {
  const teamId = Number(assignedTeamId);

  if (teamId === Number(match.teamAId)) {
    return match.teamB?.name || "the opponent";
  }

  if (teamId === Number(match.teamBId)) {
    return match.teamA?.name || "the opponent";
  }

  return "the opponent";
}

/**
 * Gets the player information associated with the assignment.
 *
 * KitRotationMember is preferred because it represents the persistent
 * rotation member. MatchKitPlayer is used as a fallback.
 */
function getAssignedPlayer(assignment) {
  const rotationMember = assignment.rotationMember;
  const matchKitPlayer = assignment.matchKitPlayer;

  const player =
    rotationMember?.player ||
    matchKitPlayer?.player ||
    null;

  const name =
    player?.name ||
    rotationMember?.displayName ||
    matchKitPlayer?.displayName ||
    "Player";

  return {
    name,
    phone: player?.whatsappNumber || null,
    optedIn: player?.whatsappOptIn === true,
  };
}

/**
 * Creates the reminder log if it does not already exist.
 *
 * Your Prisma unique constraint is:
 *
 * @@unique([
 *   assignmentId,
 *   reminderType,
 *   channel,
 *   recipientType
 * ])
 *
 * Therefore Prisma generates:
 *
 * assignmentId_reminderType_channel_recipientType
 */
async function createOrLoadReminder({
  assignment,
  playerName,
  phoneNumber,
  scheduledFor,
}) {
  return prisma.kitReminderLog.upsert({
    where: {
      assignmentId_reminderType_channel_recipientType:
        {
          assignmentId: assignment.id,
          reminderType: REMINDER_TYPE,
          channel: REMINDER_CHANNEL,
          recipientType: RECIPIENT_TYPE,
        },
    },

    /**
     * Keep the recipient information synchronized in case the kit
     * assignment is edited before the reminder is sent.
     */
    update: {
      leagueId: assignment.leagueId,
      matchId: assignment.matchId,
      teamId: assignment.teamId,
      recipientName: playerName,
      recipientPhone: phoneNumber,
      scheduledFor,
    },

    create: {
      leagueId: assignment.leagueId,
      matchId: assignment.matchId,
      teamId: assignment.teamId,
      assignmentId: assignment.id,

      recipientType: RECIPIENT_TYPE,
      reminderType: REMINDER_TYPE,
      channel: REMINDER_CHANNEL,

      recipientName: playerName,
      recipientPhone: phoneNumber,

      status: "PENDING",
      scheduledFor,
      attemptCount: 0,
    },
  });
}

/**
 * Marks a reminder as skipped.
 *
 * Your current schema has no skippedAt field, so the reason is stored in
 * errorMessage and the status is set to SKIPPED.
 */
async function markReminderSkipped(
  reminderId,
  reason
) {
  return prisma.kitReminderLog.update({
    where: {
      id: reminderId,
    },
    data: {
      status: "SKIPPED",
      errorMessage: reason,
      providerStatus: "SKIPPED",
      processingStartedAt: null,
      failedAt: null,
    },
  });
}

/**
 * Resets a skipped or failed reminder when its data is now valid.
 *
 * Examples:
 * - The player previously had no phone number.
 * - The player previously had WhatsApp opt-in disabled.
 * - A temporary provider error caused a failure.
 */
async function resetReminderToPending(reminderId) {
  return prisma.kitReminderLog.update({
    where: {
      id: reminderId,
    },
    data: {
      status: "PENDING",
      providerStatus: null,
      errorMessage: null,
      processingStartedAt: null,
      failedAt: null,
    },
  });
}

/**
 * Attempts to claim a reminder before contacting WhatsApp.
 *
 * updateMany makes the claim atomic. If two cron executions overlap,
 * only one execution can change the same PENDING record to PROCESSING.
 */
async function claimReminder(reminderId) {
  return prisma.kitReminderLog.updateMany({
    where: {
      id: reminderId,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
      processingStartedAt: new Date(),
      providerStatus: "PROCESSING",
      errorMessage: null,
      attemptCount: {
        increment: 1,
      },
    },
  });
}

/**
 * Saves a successful WhatsApp result.
 */
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

  return prisma.kitReminderLog.update({
    where: {
      id: reminderId,
    },
    data: {
      status: "PROCESSING",

      sentAt: null,
      failedAt: null,

      processingStartedAt:
        new Date(),

      errorMessage: null,

      providerStatus,

      providerMessageId:
        result?.providerMessageId ||
        null,

      ...(result?.providerResponse
        ? {
            providerResponse:
              result.providerResponse,
          }
        : {}),
    },
  });
}

/**
 * Converts an error into JSON-safe provider data.
 */
function getProviderResponse(error) {
  const providerResponse =
    error?.providerResponse;

  if (
    providerResponse &&
    typeof providerResponse === "object"
  ) {
    return providerResponse;
  }

  return null;
}

/**
 * Saves a failed WhatsApp result.
 */
async function markReminderFailed(
  reminderId,
  error
) {
  const providerResponse =
    getProviderResponse(error);

  return prisma.kitReminderLog.update({
    where: {
      id: reminderId,
    },
    data: {
      status: "FAILED",
      failedAt: new Date(),
      processingStartedAt: null,
      providerStatus:
        error?.httpStatus
          ? `HTTP_${error.httpStatus}`
          : "FAILED",
      errorMessage:
        error?.message ||
        "Unable to send the WhatsApp reminder.",

      ...(providerResponse !== null
        ? {
            providerResponse,
          }
        : {}),
    },
  });
}

/**
 * Processes kit reminders for matches occurring tomorrow in each
 * league's configured timezone.
 *
 * A dry run:
 * - performs all eligibility checks;
 * - creates or updates the reminder log;
 * - does not call WhatsApp;
 * - leaves the reminder available for a later real send.
 */
export async function processDayBeforeKitReminders({
  now = new Date(),
  dryRun =
    String(
      process.env.KIT_REMINDER_DRY_RUN ||
        "false"
    )
      .trim()
      .toLowerCase() === "true",
} = {}) {
  const matches = await prisma.match.findMany({
    where: {
      scheduledAt: {
        not: null,
      },

      kitAssignments: {
        some: {
          status: {
            in: ACTIVE_ASSIGNMENT_STATUSES,
          },
        },
      },
    },

    select: {
      id: true,
      leagueId: true,
      teamAId: true,
      teamBId: true,
      scheduledAt: true,
      status: true,

      league: {
        select: {
          id: true,
          name: true,
          timeZone: true,
        },
      },

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

      kitAssignments: {
        where: {
          status: {
            in: ACTIVE_ASSIGNMENT_STATUSES,
          },
        },

        select: {
          id: true,
          leagueId: true,
          matchId: true,
          teamId: true,
          status: true,
          rotationMemberId: true,
          matchKitPlayerId: true,

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
                playerId: true,

                player: {
                  select: {
                    id: true,
                    name: true,
                    whatsappNumber: true,
                    whatsappOptIn: true,
                  },
                },
              },
            },

            matchKitPlayer: {
              select: {
                id: true,
                displayName: true,
                normalizedName: true,
                playerId: true,

                player: {
                  select: {
                    id: true,
                    name: true,
                    whatsappNumber: true,
                    whatsappOptIn: true,
                  },
                },
              },
            },
        },
      },
    },
  });

  const summary = {
    checkedMatches: matches.length,
    closedMatches: 0,
    eligibleMatches: 0,
    checkedAssignments: 0,
    alreadySent: 0,
    dryRun: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    queued: 0,
    notDueTomorrow: 0,
    notClaimed: 0,
  };

  for (const match of matches) {
    if (isClosedMatch(match)) {
      summary.closedMatches += 1;
      continue;
    }

    const timeZone = validTimeZone(
      match.league?.timeZone
    );

    const dueTomorrow =
      isTomorrowInTimeZone({
        scheduledAt: match.scheduledAt,
        now,
        timeZone,
      });

    if (!dueTomorrow) {
      summary.notDueTomorrow += 1;
      continue;
    }

    summary.eligibleMatches += 1;

    const formattedMatch =
      formatMatchDateTime(
        match.scheduledAt,
        timeZone
      );

    for (const assignment of
      match.kitAssignments) {
      summary.checkedAssignments += 1;

      const assignedPlayer =
        getAssignedPlayer(assignment);

      const normalizedPhone =
        normalizeInternationalPhone(
          assignedPlayer.phone
        );

      let reminder =
        await createOrLoadReminder({
          assignment,
          playerName: assignedPlayer.name,
          phoneNumber:
            normalizedPhone ||
            assignedPlayer.phone ||
            null,
          scheduledFor: now,
        });

      /**
       * A successfully sent reminder must never be sent again.
       */
      if (reminder.status === "SENT") {
        summary.alreadySent += 1;
        continue;
      }

      /**
       * Do not take over a reminder that another process is currently
       * sending.
       */
      if (
        reminder.status === "PROCESSING"
      ) {
        summary.notClaimed += 1;
        continue;
      }

      if (!assignedPlayer.optedIn) {
        await markReminderSkipped(
          reminder.id,
          "The assigned player has not opted in to WhatsApp reminders."
        );

        summary.skipped += 1;
        continue;
      }

      if (!normalizedPhone) {
        await markReminderSkipped(
          reminder.id,
          "The assigned player does not have a valid international WhatsApp number."
        );

        summary.skipped += 1;
        continue;
      }

      /**
       * A reminder may previously have been skipped because the player
       * had no number or had not opted in. It may also have failed due
       * to a temporary provider problem.
       */
      if (
        reminder.status === "SKIPPED" ||
        reminder.status === "FAILED"
      ) {
        reminder =
          await resetReminderToPending(
            reminder.id
          );
      }

      /**
       * Dry-run mode never sends a real message.
       *
       * The record stays PENDING so changing
       * KIT_REMINDER_DRY_RUN to false later will allow the same reminder
       * to be sent.
       */
      if (dryRun) {
        await prisma.kitReminderLog.update({
  where: {
    id: reminder.id,
  },

  data: {
    status: "PROCESSING",

    providerMessageId:
      result.providerMessageId,

    providerStatus:
      result.providerStatus,

    processingStartedAt:
      new Date(),

    attemptCount: {
      increment: 1,
    },

    fallbackSmsAllowed:
      result.fallbackEligible,

    fallbackSmsBody:
      result.fallbackMessageBody,

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

    errorMessage: null,
  },
});
        summary.dryRun += 1;
        continue;
      }

      const claim =
        await claimReminder(reminder.id);

      if (claim.count !== 1) {
        summary.notClaimed += 1;
        continue;
      }

      try {
        const communicationContent =
          buildKitReminderCommunicationContent({
            playerName:
              assignedPlayer.name,

            teamName:
              assignment.team?.name ||
              "Your team",

            opponentName:
              getOpponentName(
                match,
                assignment.teamId
              ),

            leagueName:
              match.league?.name ||
              "Your league",

            matchDateText:
              formattedMatch.dateText,

            matchTimeText:
              formattedMatch.timeText,
          });

        const whatsappVariables =
          communicationContent.whatsappVariables;

        const result =
          await sendPlayerCommunication({
            type: "KIT_REMINDER",

            consentGranted:
              assignedPlayer.optedIn,

            recipientPhone:
              normalizedPhone,

            /*
             * This PR migrates the primary WhatsApp send to the
             * shared communication service. SMS fallback remains
             * disabled until KitReminderLog receives dedicated,
             * duplicate-protected fallback fields.
             */
            fallbackEligible: false,

            fallbackBody:
              communicationContent.fallbackSmsBody,

            context: {
              assignmentId:
                assignment.id,

              reminderId:
                reminder.id,

              reminderType:
                REMINDER_TYPE,

              matchId:
                assignment.matchId,

              leagueId:
                assignment.leagueId,

              teamId:
                assignment.teamId,

              playerName:
                assignedPlayer.name,
            },

            sendPrimary: () =>
              sendKitReminderWhatsApp({
                phoneNumber:
                  normalizedPhone,

                playerName:
                  whatsappVariables.playerName,

                teamName:
                  whatsappVariables.teamName,

                opponentName:
                  whatsappVariables.opponentName,

                leagueName:
                  whatsappVariables.leagueName,

                matchDateText:
                  whatsappVariables.matchDateText,

                matchTimeText:
                  whatsappVariables.matchTimeText,
              }),
          });

        await markReminderQueued(
          reminder.id,
          result
        );

        summary.queued =
          (summary.queued || 0) + 1;
      } catch (error) {
        console.error(
          `Kit reminder failed for assignment ${assignment.id}:`,
          error
        );

        await markReminderFailed(
          reminder.id,
          error
        );

        summary.failed += 1;
      }
    }
  }

  return summary;
}