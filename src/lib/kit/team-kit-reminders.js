import prisma from "@/lib/prisma";

const FINAL_MATCH_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_LOCKED",
  "COMPLETED_CORRECTED",
  "ABANDONED",
  "NO_RESULT",
  "CANCELLED_AFTER_START",
  "CANCELED_AFTER_START",
]);

const REMINDER_ACTIONS = {
  DAY_BEFORE:
    "REMINDER_DAY_BEFORE_SENT",
  TWO_HOURS_BEFORE:
    "REMINDER_TWO_HOURS_SENT",
  POST_MATCH:
    "REMINDER_POST_MATCH_SENT",
  CUSTODY_OVERDUE:
    "REMINDER_CUSTODY_OVERDUE_SENT",
};

const CONTENT_SID_ENV = {
  DAY_BEFORE:
    "TWILIO_KIT_DAY_BEFORE_CONTENT_SID",
  TWO_HOURS_BEFORE:
    "TWILIO_KIT_TWO_HOURS_CONTENT_SID",
  POST_MATCH:
    "TWILIO_KIT_POST_MATCH_CONTENT_SID",
  CUSTODY_OVERDUE:
    "TWILIO_KIT_OVERDUE_CONTENT_SID",
};

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function isFinalStatus(value) {
  return FINAL_MATCH_STATUSES.has(
    normalizeStatus(value)
  );
}

function cleanPhone(value) {
  const input = String(value || "").trim();

  if (!input) {
    return "";
  }

  const normalized = input.replace(
    /[^\d+]/g,
    ""
  );

  if (normalized.startsWith("+")) {
    return normalized;
  }

  if (normalized.length === 10) {
    return `+1${normalized}`;
  }

  return normalized
    ? `+${normalized}`
    : "";
}

function whatsappAddress(value) {
  const phone = cleanPhone(value);

  return phone
    ? `whatsapp:${phone}`
    : "";
}

function appUrl(path = "") {
  const root = String(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "https://cric4all.app"
  ).replace(/\/+$/, "");

  return `${root}${path}`;
}

function matchLabel(row) {
  return `${row.teamAName || "Team A"} vs ${
    row.teamBName || "Team B"
  }`;
}

function matchStart(row) {
  const value = row.scheduledAt;

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function finalReferenceTime(row) {
  const value =
    row.lockedAt ||
    row.endedAt ||
    row.scheduledAt ||
    row.taskCreatedAt ||
    null;

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatDateTime(value) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone:
        process.env.TEAM_KIT_TIME_ZONE ||
        "America/Phoenix",
    }
  ).format(value);
}

function messageBody({
  reminderType,
  holderName,
  scopeName,
  matchName,
  scheduledAt,
  leagueName,
  kitUrl,
}) {
  if (reminderType === "DAY_BEFORE") {
    return [
      "🏏 Cric4All Kit Reminder",
      "",
      `${matchName} is scheduled for ${formatDateTime(
        scheduledAt
      )}.`,
      "",
      `${holderName}, you are the current recorded holder of ${scopeName}. Please coordinate bringing the kit.`,
      "",
      `League: ${leagueName}`,
      `Update kit details: ${kitUrl}`,
      "",
      "Reply STOP to opt out.",
    ].join("\n");
  }

  if (
    reminderType ===
    "TWO_HOURS_BEFORE"
  ) {
    return [
      "⏰ Cric4All Kit Reminder",
      "",
      `${matchName} starts in about 2 hours.`,
      "",
      `${holderName}, please make sure ${scopeName} reaches the venue.`,
      "",
      `Update kit details: ${kitUrl}`,
      "",
      "Reply STOP to opt out.",
    ].join("\n");
  }

  if (reminderType === "POST_MATCH") {
    return [
      "✅ Match completed",
      "",
      `${matchName} has ended.`,
      "",
      `Please record who actually took ${scopeName} home.`,
      "",
      `Record kit custody: ${kitUrl}`,
      "",
      "Reply STOP to opt out.",
    ].join("\n");
  }

  return [
    "⚠️ Kit custody still needs attention",
    "",
    `${matchName} ended more than 24 hours ago, but the final holder of ${scopeName} has not been recorded.`,
    "",
    `Record kit custody: ${kitUrl}`,
    "",
    "Reply STOP to opt out.",
  ].join("\n");
}

function contentVariables({
  holderName,
  scopeName,
  matchName,
  scheduledAt,
  leagueName,
  kitUrl,
}) {
  return {
    "1": holderName,
    "2": scopeName,
    "3": matchName,
    "4": formatDateTime(scheduledAt),
    "5": leagueName,
    "6": kitUrl,
  };
}

async function sendTwilioMessage({
  to,
  reminderType,
  body,
  variables,
}) {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID;
  const authToken =
    process.env.TWILIO_AUTH_TOKEN;
  const from =
    process.env.TWILIO_WHATSAPP_FROM ||
    process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error(
      "Twilio environment variables are incomplete."
    );
  }

  const contentSid =
    process.env[
      CONTENT_SID_ENV[reminderType]
    ] || "";

  const form = new URLSearchParams();

  form.set("From", from);
  form.set("To", to);

  if (contentSid) {
    form.set("ContentSid", contentSid);
    form.set(
      "ContentVariables",
      JSON.stringify(variables)
    );
  } else {
    form.set("Body", body);
  }

  const credentials = Buffer.from(
    `${accountSid}:${authToken}`
  ).toString("base64");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        "Twilio rejected the kit reminder."
    );
  }

  return payload;
}

async function reminderAlreadySent({
  leagueId,
  scopeKey,
  matchId,
  action,
}) {
  const rows = await prisma.$queryRaw`
    SELECT "id"
    FROM "TeamKitCustodyEvent"
    WHERE "leagueId" = ${leagueId}
      AND "scopeKey" = ${scopeKey}
      AND "matchId" = ${matchId}
      AND "action" = ${action}
    LIMIT 1
  `;

  return rows.length > 0;
}

async function recordReminderEvent({
  leagueId,
  scopeKey,
  teamId,
  matchId,
  holderPlayerId,
  holderName,
  action,
  note,
}) {
  await prisma.$executeRaw`
    INSERT INTO "TeamKitCustodyEvent"
      (
        "leagueId",
        "scopeKey",
        "teamId",
        "matchId",
        "holderPlayerId",
        "holderName",
        "action",
        "note",
        "recordedByUserId"
      )
    VALUES
      (
        ${leagueId},
        ${scopeKey},
        ${teamId},
        ${matchId},
        ${holderPlayerId},
        ${holderName},
        ${action},
        ${note},
        NULL
      )
  `;
}

async function currentHolderRecipient(
  state
) {
  if (!state.currentHolderPlayerId) {
    return null;
  }

  const player =
    await prisma.player.findUnique({
      where: {
        id: Number(
          state.currentHolderPlayerId
        ),
      },
      select: {
        id: true,
        name: true,
        whatsappNumber: true,
        whatsappOptIn: true,
      },
    });

  if (
    !player ||
    !player.whatsappOptIn ||
    !player.whatsappNumber
  ) {
    return null;
  }

  const to = whatsappAddress(
    player.whatsappNumber
  );

  return to
    ? {
        ...player,
        to,
      }
    : null;
}

async function sendReminder({
  reminderType,
  row,
  state,
}) {
  const action =
    REMINDER_ACTIONS[reminderType];

  if (
    await reminderAlreadySent({
      leagueId: Number(row.leagueId),
      scopeKey: state.scopeKey,
      matchId: Number(row.matchId),
      action,
    })
  ) {
    return {
      status: "alreadySent",
    };
  }

  const recipient =
    await currentHolderRecipient(state);

  if (!recipient) {
    return {
      status: "noRecipient",
    };
  }

  const scopeName = state.teamId
    ? `${row.scopeTeamName || "Team"} kit`
    : "the shared league kit";

  const kitUrl = appUrl(
    `/dashboard?tab=kit&leagueId=${row.leagueId}`
  );

  const values = {
    holderName:
      recipient.name ||
      state.currentHolderName ||
      "Current holder",
    scopeName,
    matchName: matchLabel(row),
    scheduledAt:
      matchStart(row) ||
      finalReferenceTime(row),
    leagueName:
      row.leagueName || "Cric4All",
    kitUrl,
  };

  const result =
    await sendTwilioMessage({
      to: recipient.to,
      reminderType,
      body: messageBody({
        reminderType,
        ...values,
      }),
      variables:
        contentVariables(values),
    });

  await recordReminderEvent({
    leagueId: Number(row.leagueId),
    scopeKey: state.scopeKey,
    teamId: state.teamId
      ? Number(state.teamId)
      : null,
    matchId: Number(row.matchId),
    holderPlayerId:
      recipient.id,
    holderName:
      recipient.name,
    action,
    note:
      `Twilio message ${result.sid || "submitted"}; status ${result.status || "queued"}.`,
  });

  return {
    status: "queued",
    sid: result.sid || null,
  };
}

async function loadUpcomingRows(now) {
  const lower = new Date(
    now.getTime() +
      90 * 60 * 1000
  );
  const upper = new Date(
    now.getTime() +
      26 * 60 * 60 * 1000
  );

  return prisma.$queryRaw`
    SELECT
      m."id" AS "matchId",
      m."leagueId",
      m."teamAId",
      m."teamBId",
      m."status",
      m."scheduledAt",
      l."name" AS "leagueName",
      l."kitRotationMode",
      ta."name" AS "teamAName",
      tb."name" AS "teamBName"
    FROM "Match" m
    JOIN "League" l
      ON l."id" = m."leagueId"
    LEFT JOIN "Team" ta
      ON ta."id" = m."teamAId"
    LEFT JOIN "Team" tb
      ON tb."id" = m."teamBId"
    WHERE m."scheduledAt" >= ${lower}
      AND m."scheduledAt" <= ${upper}
    ORDER BY m."scheduledAt" ASC
  `;
}

async function loadPendingRows(now) {
  const recentThreshold = new Date(
    now.getTime() -
      48 * 60 * 60 * 1000
  );

  return prisma.$queryRaw`
    SELECT
      task."id" AS "taskId",
      task."leagueId",
      task."scopeKey",
      task."teamId",
      task."matchId",
      task."createdAt" AS "taskCreatedAt",
      m."status",
      m."scheduledAt",
      m."endedAt",
      m."lockedAt",
      l."name" AS "leagueName",
      ta."name" AS "teamAName",
      tb."name" AS "teamBName",
      scope_team."name" AS "scopeTeamName"
    FROM "TeamKitCustodyTask" task
    JOIN "Match" m
      ON m."id" = task."matchId"
    JOIN "League" l
      ON l."id" = task."leagueId"
    LEFT JOIN "Team" ta
      ON ta."id" = m."teamAId"
    LEFT JOIN "Team" tb
      ON tb."id" = m."teamBId"
    LEFT JOIN "Team" scope_team
      ON scope_team."id" = task."teamId"
    WHERE task."status" = 'PENDING'
      AND task."createdAt" >= ${recentThreshold}
    ORDER BY task."createdAt" ASC
  `;
}

async function loadState({
  leagueId,
  scopeKey,
}) {
  const rows = await prisma.$queryRaw`
    SELECT *
    FROM "TeamKitState"
    WHERE "leagueId" = ${leagueId}
      AND "scopeKey" = ${scopeKey}
    LIMIT 1
  `;

  return rows[0] || null;
}

function sharedMode(value) {
  const mode = String(
    value || ""
  ).toUpperCase();

  return (
    mode === "LEAGUE_PLAYER" ||
    mode === "SHARED" ||
    mode === "LEAGUE"
  );
}

function upcomingScopes(row) {
  if (sharedMode(row.kitRotationMode)) {
    return [
      {
        scopeKey: "LEAGUE",
        teamId: null,
        scopeTeamName: null,
      },
    ];
  }

  return [
    {
      scopeKey:
        `TEAM:${row.teamAId}`,
      teamId: Number(row.teamAId),
      scopeTeamName:
        row.teamAName,
    },
    {
      scopeKey:
        `TEAM:${row.teamBId}`,
      teamId: Number(row.teamBId),
      scopeTeamName:
        row.teamBName,
    },
  ];
}

function dueUpcomingReminder(
  now,
  start
) {
  const minutes =
    (start.getTime() -
      now.getTime()) /
    60000;

  if (
    minutes >= 90 &&
    minutes <= 150
  ) {
    return "TWO_HOURS_BEFORE";
  }

  if (
    minutes >= 20 * 60 &&
    minutes <= 26 * 60
  ) {
    return "DAY_BEFORE";
  }

  return null;
}

function duePendingReminder(
  now,
  row
) {
  if (!isFinalStatus(row.status)) {
    return null;
  }

  const ended =
    finalReferenceTime(row);

  if (!ended) {
    return null;
  }

  const hours =
    (now.getTime() -
      ended.getTime()) /
    3600000;

  if (hours >= 24) {
    return "CUSTODY_OVERDUE";
  }

  if (hours >= 0 && hours <= 2) {
    return "POST_MATCH";
  }

  return null;
}

export async function runTeamKitReminders({
  now = new Date(),
  dryRun = false,
} = {}) {
  const summary = {
    checkedUpcomingMatches: 0,
    checkedPendingTasks: 0,
    due: 0,
    queued: 0,
    alreadySent: 0,
    noCurrentHolder: 0,
    noOptedInRecipient: 0,
    skipped: 0,
    failed: 0,
    dryRun: 0,
    details: [],
  };

  const [upcomingRows, pendingRows] =
    await Promise.all([
      loadUpcomingRows(now),
      loadPendingRows(now),
    ]);

  summary.checkedUpcomingMatches =
    upcomingRows.length;
  summary.checkedPendingTasks =
    pendingRows.length;

  for (const row of upcomingRows) {
    if (isFinalStatus(row.status)) {
      summary.skipped += 1;
      continue;
    }

    const start = matchStart(row);
    const reminderType =
      start &&
      dueUpcomingReminder(now, start);

    if (!reminderType) {
      summary.skipped += 1;
      continue;
    }

    for (const scope of upcomingScopes(row)) {
      summary.due += 1;

      const state = await loadState({
        leagueId:
          Number(row.leagueId),
        scopeKey:
          scope.scopeKey,
      });

      if (!state?.currentHolderPlayerId) {
        summary.noCurrentHolder += 1;
        continue;
      }

      if (dryRun) {
        summary.dryRun += 1;
        summary.details.push({
          reminderType,
          matchId:
            Number(row.matchId),
          scopeKey:
            scope.scopeKey,
          holderName:
            state.currentHolderName,
        });
        continue;
      }

      try {
        const result =
          await sendReminder({
            reminderType,
            row: {
              ...row,
              scopeTeamName:
                scope.scopeTeamName,
            },
            state,
          });

        if (result.status === "queued") {
          summary.queued += 1;
        } else if (
          result.status ===
          "alreadySent"
        ) {
          summary.alreadySent += 1;
        } else {
          summary.noOptedInRecipient += 1;
        }
      } catch (error) {
        summary.failed += 1;
        summary.details.push({
          reminderType,
          matchId:
            Number(row.matchId),
          scopeKey:
            scope.scopeKey,
          error:
            error?.message ||
            String(error),
        });
      }
    }
  }

  for (const row of pendingRows) {
    const reminderType =
      duePendingReminder(now, row);

    if (!reminderType) {
      summary.skipped += 1;
      continue;
    }

    summary.due += 1;

    const state = await loadState({
      leagueId:
        Number(row.leagueId),
      scopeKey:
        row.scopeKey,
    });

    if (!state?.currentHolderPlayerId) {
      summary.noCurrentHolder += 1;
      continue;
    }

    if (dryRun) {
      summary.dryRun += 1;
      summary.details.push({
        reminderType,
        matchId:
          Number(row.matchId),
        scopeKey:
          row.scopeKey,
        holderName:
          state.currentHolderName,
      });
      continue;
    }

    try {
      const result =
        await sendReminder({
          reminderType,
          row,
          state,
        });

      if (result.status === "queued") {
        summary.queued += 1;
      } else if (
        result.status ===
        "alreadySent"
      ) {
        summary.alreadySent += 1;
      } else {
        summary.noOptedInRecipient += 1;
      }
    } catch (error) {
      summary.failed += 1;
      summary.details.push({
        reminderType,
        matchId:
          Number(row.matchId),
        scopeKey:
          row.scopeKey,
        error:
          error?.message ||
          String(error),
      });
    }
  }

  return summary;
}
