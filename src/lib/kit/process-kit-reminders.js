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

async function loadMatches() {
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
    await loadMatches();

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
