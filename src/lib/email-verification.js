import crypto from "crypto";

import prisma from "@/lib/prisma";
import {
  claimLeagueInviteForUser,
  getLeagueInviteDetails,
} from "@/lib/league-invite-claim";

export const EMAIL_VERIFICATION_REQUIRED =
  "EMAIL_VERIFICATION_REQUIRED";
export const EMAIL_VERIFICATION_TOKEN_ISSUED =
  "EMAIL_VERIFICATION_TOKEN_ISSUED";
export const EMAIL_VERIFIED =
  "EMAIL_VERIFIED";
export const EMAIL_VERIFICATION_TOKEN_USED =
  "EMAIL_VERIFICATION_TOKEN_USED";
export const EMAIL_PENDING_INVITE =
  "EMAIL_PENDING_INVITE";
export const EMAIL_PENDING_INVITE_CLAIMED =
  "EMAIL_PENDING_INVITE_CLAIMED";
export const EMAIL_PENDING_INVITE_FAILED =
  "EMAIL_PENDING_INVITE_FAILED";

export const EMAIL_VERIFICATION_TTL_MS =
  24 * 60 * 60 * 1000;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS =
  60 * 1000;

function cleanString(value) {
  return String(value || "").trim();
}

export function normalizeEmailAddress(value) {
  return cleanString(value).toLowerCase();
}

export function isReasonableEmailAddress(value) {
  const email = normalizeEmailAddress(value);

  if (
    !email ||
    email.length > 254 ||
    email.includes(" ") ||
    email.includes("..")
  ) {
    return false;
  }

  const atIndex = email.indexOf("@");

  if (
    atIndex <= 0 ||
    atIndex !== email.lastIndexOf("@")
  ) {
    return false;
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (
    !local ||
    local.length > 64 ||
    !domain ||
    domain.length > 253 ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    !domain.includes(".")
  ) {
    return false;
  }

  return /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
    email
  );
}

export function maskEmailAddress(value) {
  const email = normalizeEmailAddress(value);
  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return email;
  }

  const visible = local.slice(0, Math.min(2, local.length));
  const hidden = "*".repeat(Math.max(3, local.length - visible.length));

  return `${visible}${hidden}@${domain}`;
}

function hashVerificationToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

function createRawVerificationToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function getRequestMetadata(request) {
  const forwardedFor = request?.headers?.get?.("x-forwarded-for");

  return {
    ipAddress:
      forwardedFor?.split(",")?.[0]?.trim() ||
      request?.headers?.get?.("x-real-ip") ||
      null,
    userAgent:
      request?.headers?.get?.("user-agent") ||
      null,
  };
}

async function createEmailAudit({
  client = prisma,
  action,
  userId,
  email,
  description,
  afterData = null,
  request = null,
}) {
  const metadata = getRequestMetadata(request);

  return client.auditLog.create({
    data: {
      action,
      entityType: "USER_EMAIL",
      entityId: null,
      actorName: null,
      actorEmail: normalizeEmailAddress(email) || null,
      description,
      afterData: {
        userId: String(userId),
        email: normalizeEmailAddress(email),
        ...(afterData || {}),
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    },
  });
}

export async function markEmailVerificationRequired({
  client = prisma,
  userId,
  email,
  request = null,
}) {
  return createEmailAudit({
    client,
    action: EMAIL_VERIFICATION_REQUIRED,
    userId,
    email,
    description: "Email verification required for newly created password account.",
    request,
  });
}

export async function getEmailVerificationState({
  userId,
  email = null,
  client = prisma,
}) {
  const userKey = String(userId || "");

  if (!userKey) {
    return {
      required: false,
      verified: true,
      requiredAt: null,
      verifiedAt: null,
    };
  }

  let normalizedEmail = normalizeEmailAddress(email);

  if (!normalizedEmail) {
    const user = await client.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        email: true,
      },
    });

    normalizedEmail = normalizeEmailAddress(user?.email);
  }

  if (!normalizedEmail) {
    return {
      required: false,
      verified: true,
      requiredAt: null,
      verifiedAt: null,
    };
  }

  const required = await client.auditLog.findFirst({
    where: {
      action: EMAIL_VERIFICATION_REQUIRED,
      entityType: "USER_EMAIL",
      actorEmail: normalizedEmail,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
      afterData: true,
    },
  });

  /*
   * Backward compatibility:
   * Existing Cric4All users have no EMAIL_VERIFICATION_REQUIRED audit row.
   * They remain valid and are not suddenly locked out by this deployment.
   */
  if (!required) {
    return {
      required: false,
      verified: true,
      requiredAt: null,
      verifiedAt: null,
    };
  }

  const verified = await client.auditLog.findFirst({
    where: {
      action: EMAIL_VERIFIED,
      entityType: "USER_EMAIL",
      actorEmail: normalizedEmail,
      createdAt: {
        gte: required.createdAt,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
    },
  });

  return {
    required: true,
    verified: Boolean(verified),
    requiredAt: required.createdAt,
    verifiedAt: verified?.createdAt || null,
  };
}

export async function isEmailVerifiedForLogin(
  userId,
  email = null
) {
  const state = await getEmailVerificationState({
    userId,
    email,
  });

  return state.verified;
}

export async function issueEmailVerificationToken({
  client = prisma,
  userId,
  email,
  request = null,
}) {
  const rawToken = createRawVerificationToken();
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_TTL_MS
  );

  await createEmailAudit({
    client,
    action: EMAIL_VERIFICATION_TOKEN_ISSUED,
    userId,
    email,
    description: "Email verification token issued.",
    afterData: {
      tokenHash,
      expiresAt: expiresAt.toISOString(),
    },
    request,
  });

  return {
    token: rawToken,
    expiresAt,
  };
}

export async function preservePendingInviteForUser({
  client = prisma,
  userId,
  email,
  token,
  request = null,
}) {
  const inviteToken = cleanString(token);

  if (!inviteToken || !userId) {
    return null;
  }

  const details = await getLeagueInviteDetails(inviteToken);
  const inviteId = details.invite.id;
  const userKey = String(userId);

  const existing = await client.auditLog.findMany({
    where: {
      action: EMAIL_PENDING_INVITE,
      entityType: "USER_EMAIL",
      actorEmail: normalizeEmailAddress(email),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      afterData: true,
    },
  });

  const samePending = existing.find(
    (row) =>
      String(row?.afterData?.userId || "") === userKey &&
      Number(row?.afterData?.inviteId) === Number(inviteId)
  );

  if (samePending) {
    return {
      pendingAuditId: samePending.id,
      inviteId,
      leagueId: details.invite.leagueId,
      leagueName: details.invite.league.name,
      role: details.role,
      roleLabel: details.roleLabel,
    };
  }

  const pending = await createEmailAudit({
    client,
    action: EMAIL_PENDING_INVITE,
    userId,
    email,
    description: `League invite preserved until email verification: ${details.invite.league.name} / ${details.roleLabel}.`,
    afterData: {
      inviteId,
      leagueId: details.invite.leagueId,
      leagueName: details.invite.league.name,
      role: details.role,
      roleLabel: details.roleLabel,
      inviteExpiresAt: details.expiresAt,
    },
    request,
  });

  return {
    pendingAuditId: pending.id,
    inviteId,
    leagueId: details.invite.leagueId,
    leagueName: details.invite.league.name,
    role: details.role,
    roleLabel: details.roleLabel,
  };
}

async function getPendingInviteRows(user) {
  const userKey = String(user.id);
  const userEmail = normalizeEmailAddress(user.email);

  const [pendingRows, handledRows] =
    await Promise.all([
      prisma.auditLog.findMany({
        where: {
          action: EMAIL_PENDING_INVITE,
          entityType: "USER_EMAIL",
          actorEmail: userEmail,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          createdAt: true,
          afterData: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          action: EMAIL_PENDING_INVITE_CLAIMED,
          entityType: "USER_EMAIL",
          actorEmail: userEmail,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          afterData: true,
        },
      }),
    ]);

  const handledIds = new Set(
    handledRows
      .filter(
        (row) =>
          String(row?.afterData?.userId || "") === userKey
      )
      .map((row) => Number(row?.afterData?.pendingAuditId))
      .filter(Number.isFinite)
  );

  return pendingRows.filter(
    (row) =>
      String(row?.afterData?.userId || "") === userKey &&
      !handledIds.has(Number(row.id))
  );
}

async function markPendingInviteHandled({
  user,
  pending,
  success,
  result = null,
  error = null,
}) {
  return createEmailAudit({
    action: success
      ? EMAIL_PENDING_INVITE_CLAIMED
      : EMAIL_PENDING_INVITE_FAILED,
    userId: user.id,
    email: user.email,
    description: success
      ? `Preserved league invitation claimed after email verification.`
      : `Preserved league invitation could not be claimed after email verification.`,
    afterData: {
      pendingAuditId: Number(pending.id),
      inviteId: Number(pending?.afterData?.inviteId || 0) || null,
      leagueId: result?.leagueId || pending?.afterData?.leagueId || null,
      leagueName: result?.leagueName || pending?.afterData?.leagueName || null,
      role: result?.role || pending?.afterData?.role || null,
      roleLabel: result?.roleLabel || pending?.afterData?.roleLabel || null,
      error: error ? String(error).slice(0, 1000) : null,
    },
  });
}

export async function claimPendingInvitesAfterVerification(user) {
  const pendingRows = await getPendingInviteRows(user);
  const results = [];

  for (const pending of pendingRows) {
    try {
      const inviteId = Number(pending?.afterData?.inviteId);

      if (!Number.isInteger(inviteId) || inviteId <= 0) {
        throw new Error("Stored invitation reference is invalid.");
      }

      const invite = await prisma.leagueInvite.findUnique({
        where: {
          id: inviteId,
        },
        select: {
          token: true,
        },
      });

      if (!invite?.token) {
        throw new Error("The invitation is no longer available.");
      }

      const result = await claimLeagueInviteForUser({
        token: invite.token,
        userId: user.id,
        userEmail: user.email,
      });

      await markPendingInviteHandled({
        user,
        pending,
        success: true,
        result,
      });

      results.push({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "Pending invite claim after email verification failed:",
        error
      );

      await markPendingInviteHandled({
        user,
        pending,
        success: false,
        error: error?.message || error,
      });

      results.push({
        success: false,
        leagueId: pending?.afterData?.leagueId || null,
        leagueName: pending?.afterData?.leagueName || null,
        role: pending?.afterData?.role || null,
        roleLabel: pending?.afterData?.roleLabel || null,
        error:
          error?.message ||
          "The league invitation could not be applied.",
      });
    }
  }

  return results;
}

async function findIssuedTokenByHash(tokenHash) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT
        "id",
        "createdAt",
        "afterData"
      FROM "AuditLog"
      WHERE
        "action" = $1
        AND "entityType" = 'USER_EMAIL'
        AND COALESCE(
          "afterData"->>'tokenHash',
          ''
        ) = $2
      ORDER BY
        "createdAt" DESC,
        "id" DESC
      LIMIT 1
    `,
    EMAIL_VERIFICATION_TOKEN_ISSUED,
    tokenHash
  );

  return rows?.[0] || null;
}

export async function verifyEmailToken(rawToken, request = null) {
  const token = cleanString(rawToken);

  if (!token || token.length < 20) {
    return {
      success: false,
      code: "INVALID_TOKEN",
      message: "This verification link is invalid.",
    };
  }

  const tokenHash = hashVerificationToken(token);
  const issued = await findIssuedTokenByHash(tokenHash);

  if (!issued) {
    return {
      success: false,
      code: "INVALID_TOKEN",
      message: "This verification link is invalid or no longer available.",
    };
  }

  const userId = String(issued?.afterData?.userId || "");
  const expiresAt = new Date(issued?.afterData?.expiresAt || 0);

  if (
    !userId ||
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getTime() < Date.now()
  ) {
    return {
      success: false,
      code: "EXPIRED_TOKEN",
      message: "This verification link has expired. Request a new verification email.",
      email: issued?.afterData?.email || null,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      `
        SELECT
          pg_advisory_xact_lock(
            hashtext($1)
          )::text AS "lockResult"
      `,
      `email-verify:${tokenHash}`
    );

    const user = await tx.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return {
        success: false,
        code: "USER_NOT_FOUND",
        message: "The account for this verification link no longer exists.",
      };
    }

    const state = await getEmailVerificationState({
      userId: user.id,
      client: tx,
    });

    if (!state.verified) {
      await createEmailAudit({
        client: tx,
        action: EMAIL_VERIFIED,
        userId: user.id,
        email: user.email,
        description: "Email ownership verified successfully.",
        afterData: {
          tokenIssueAuditId: Number(issued.id),
        },
        request,
      });
    }

    await createEmailAudit({
      client: tx,
      action: EMAIL_VERIFICATION_TOKEN_USED,
      userId: user.id,
      email: user.email,
      description: "Email verification token consumed.",
      afterData: {
        tokenIssueAuditId: Number(issued.id),
        tokenHash,
      },
      request,
    });

    return {
      success: true,
      alreadyVerified: state.verified,
      user,
    };
  });

  if (!result.success) {
    return result;
  }

  const inviteResults =
    await claimPendingInvitesAfterVerification(result.user);

  const successfulInvite =
    [...inviteResults]
      .reverse()
      .find((item) => item.success) || null;

  return {
    success: true,
    alreadyVerified: result.alreadyVerified,
    user: result.user,
    inviteResults,
    primaryInvite: successfulInvite,
  };
}

export async function getResendEligibility(
  userId,
  email = null
) {
  let userEmail = normalizeEmailAddress(email);

  if (!userEmail) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        email: true,
      },
    });

    userEmail = normalizeEmailAddress(user?.email);
  }

  if (!userEmail) {
    return {
      allowed: false,
      retryAfterSeconds: 60,
    };
  }

  const latest = await prisma.auditLog.findFirst({
    where: {
      action: EMAIL_VERIFICATION_TOKEN_ISSUED,
      entityType: "USER_EMAIL",
      actorEmail: userEmail,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
    },
  });

  if (!latest) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  const elapsed = Date.now() - new Date(latest.createdAt).getTime();
  const remaining = EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - elapsed;

  return {
    allowed: remaining <= 0,
    retryAfterSeconds:
      remaining > 0 ? Math.ceil(remaining / 1000) : 0,
  };
}

