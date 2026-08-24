import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  LeagueInviteClaimError,
  getLeagueInviteDetails,
} from "@/lib/league-invite-claim";
import {
  ROLE_LABELS,
  isLeagueRolePromotion,
} from "@/lib/league-role-permissions";

const FRIENDLY_PERMISSION_LABELS = {
  canViewDashboard: "View league dashboard",
  canViewManagement: "Open league management",
  canViewMatches: "View matches",
  canViewScoring: "Open scoring workspace",
  canViewStats: "View statistics",
  canCreateLeague: "Create leagues",
  canEditLeague: "Edit league settings",
  canDeleteLeague: "Delete league",
  canManageMembers: "Manage members",
  canManagePermissions: "Manage member permissions",
  canCreateTeam: "Create teams",
  canEditTeam: "Edit teams",
  canDeleteTeam: "Delete teams",
  canCreatePlayer: "Create players",
  canEditPlayer: "Edit players",
  canDeletePlayer: "Delete players",
  canCreateMatch: "Create matches",
  canEditMatch: "Edit matches",
  canDeleteMatch: "Delete matches",
  canScoreMatch: "Score live matches",
  canEditScore: "Edit scoring",
  canUndoBall: "Undo deliveries",
  canSwapStrike: "Swap strike",
  canRetirePlayer: "Retire / replace players",
  canEndMatch: "End matches",
  canAbandonMatch: "Abandon matches",
  canLockMatch: "Lock completed matches",
  canExportStats: "Export statistics",
  canViewAuditLogs: "View audit logs",
};

export default async function InvitePage({ params }) {
  const { token } = await params;

  let details;

  try {
    details = await getLeagueInviteDetails(token);
  } catch (error) {
    const message =
      error instanceof LeagueInviteClaimError
        ? error.message
        : "Unable to load this invitation.";

    return (
      <main style={{ maxWidth: 680, margin: "48px auto", padding: 24 }}>
        <h1>Invitation unavailable</h1>
        <p>{message}</p>
        <Link href="/">Return to Cric4All</Link>
      </main>
    );
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    redirect(`/complete-profile?token=${encodeURIComponent(token)}`);
  }

  const existingMembership = await prisma.leagueMember.findUnique({
    where: {
      userId_leagueId: {
        userId: user.id,
        leagueId: details.invite.leagueId,
      },
    },
    select: { role: true },
  });

  const shouldOfferPromotion = Boolean(
    existingMembership &&
      !details.legacy &&
      isLeagueRolePromotion(existingMembership.role, details.role)
  );

  const enabledPermissions = Object.entries(details.permissions || {})
    .filter(([, enabled]) => enabled === true)
    .map(([field]) => FRIENDLY_PERMISSION_LABELS[field] || field);

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "48px auto",
        padding: 24,
        lineHeight: 1.5,
      }}
    >
      <section
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <p style={{ marginTop: 0, fontWeight: 700 }}>🏏 Cric4All League Invitation</p>
        <h1 style={{ marginBottom: 8 }}>{details.invite.league.name}</h1>

        {existingMembership && !shouldOfferPromotion ? (
          <>
            <p>
              You are already a member of this league as{" "}
              <strong>{ROLE_LABELS[existingMembership.role] || existingMembership.role}</strong>.
            </p>
            <p>
              This invite does not grant a higher role, so your existing role and customized
              permissions will remain unchanged.
            </p>
            <Link href={`/dashboard?leagueId=${details.invite.leagueId}`}>
              Open league dashboard
            </Link>
          </>
        ) : (
          <>
            {shouldOfferPromotion ? (
              <p>
                You are currently a{" "}
                <strong>{ROLE_LABELS[existingMembership.role] || existingMembership.role}</strong>{" "}
                in this league. This signed invite will promote you to{" "}
                <strong>{details.roleLabel}</strong>.
              </p>
            ) : (
              <p>
                You have been invited to join as <strong>{details.roleLabel}</strong>.
              </p>
            )}

            {details.legacy && (
              <p>
                This is an older Cric4All registration link. For backward compatibility it will
                join you as <strong>Viewer / Member</strong>.
              </p>
            )}

            <div
              style={{
                margin: "20px 0",
                padding: 16,
                borderRadius: 12,
                background: "rgba(148,163,184,.12)",
              }}
            >
              <strong>Default access for {details.roleLabel}</strong>
              <ul style={{ marginBottom: 0 }}>
                {enabledPermissions.slice(0, 12).map((label) => (
                  <li key={label}>✓ {label}</li>
                ))}
                {enabledPermissions.length > 12 && (
                  <li>+ {enabledPermissions.length - 12} additional role permissions</li>
                )}
              </ul>
            </div>

            <Link
              href={`/invite/${token}/join`}
              style={{
                display: "inline-block",
                padding: "10px 16px",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 700,
                border: "1px solid currentColor",
              }}
            >
              {shouldOfferPromotion ? `Accept Promotion to ${details.roleLabel}` : `Accept ${details.roleLabel} Invite`}
            </Link>

            {details.expiresAt && (
              <p style={{ marginTop: 16, fontSize: 13, opacity: 0.75 }}>
                This role-bound invite expires on {new Date(details.expiresAt).toLocaleString()}.
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
