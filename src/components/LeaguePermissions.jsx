"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function LeaguePermissions({
  leagueId
}) {
  const { data: session } =
    useSession();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [unregisteringUserId, setUnregisteringUserId] =
    useState(null);

  async function loadMembers() {
    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/members`
      );

      const data = await res.json();

      setMembers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (leagueId) {
      loadMembers();
    }
  }, [leagueId]);

  async function savePermissions(
    member
  ) {
    try {
      setSaving(true);

      const res = await fetch(
        `/api/leagues/${leagueId}/permissions`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            userId: member.userId,

            role: member.role,

            canViewDashboard:
              member.canViewDashboard,

            canViewManagement:
              member.canViewManagement,

            canViewMatches:
              member.canViewMatches,

            canViewScoring:
              member.canViewScoring,

            canViewStats:
              member.canViewStats,

            canCreateLeague:
              member.canCreateLeague,

            canCreateTeam:
              member.canCreateTeam,

            canCreateMatch:
              member.canCreateMatch,

            canDeleteLeague:
              member.canDeleteLeague,

            canDeleteTeam:
              member.canDeleteTeam,

            canDeletePlayer:
              member.canDeletePlayer,

            canDeleteMatch:
              member.canDeleteMatch,

            canScoreMatch:
              member.canScoreMatch,

            canEditScore:
              member.canEditScore,

            canUndoBall:
              member.canUndoBall
          })
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to save permissions"
        );
      }

      alert(
        "Permissions updated successfully"
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateMember(
    index,
    field,
    value
  ) {
    setMembers((prev) =>
      prev.map((m, i) =>
        i === index
          ? {
              ...m,
              [field]: value
            }
          : m
      )
    );
  }

  const sessionEmail =
    String(
      session?.user?.email ||
      ""
    )
      .trim()
      .toLowerCase();

  const currentMember =
    members.find(
      (member) =>
        String(
          member.user?.email ||
          ""
        )
          .trim()
          .toLowerCase() ===
        sessionEmail
    ) ||
    null;

  const canUnregisterMembers =
    sessionEmail ===
      "surprisecricket11@gmail.com" ||
    String(
      currentMember?.role ||
      ""
    ).toUpperCase() ===
      "OWNER";

  async function unregisterMember(
    member
  ) {
    if (
      !canUnregisterMembers ||
      !member?.userId ||
      unregisteringUserId
    ) {
      return;
    }

    const name =
      member.user?.name ||
      member.user?.email ||
      "this user";

    if (
      !window.confirm(
        `Unregister ${name} from this league?\n\nThe Cric4All account and all historical scores/statistics will be preserved.`
      )
    ) {
      return;
    }

    try {
      setUnregisteringUserId(
        member.userId
      );

      const response =
        await fetch(
          `/api/leagues/${leagueId}/members?userId=${encodeURIComponent(member.userId)}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Unable to unregister league member."
        );
      }

      setMembers((previous) =>
        previous.filter(
          (existing) =>
            String(
              existing.userId
            ) !==
            String(
              member.userId
            )
        )
      );

      alert(
        data?.message ||
        `${name} was unregistered from the league.`
      );
    } catch (
      error
    ) {
      alert(
        error?.message ||
        "Unable to unregister league member."
      );
    } finally {
      setUnregisteringUserId(
        null
      );
    }
  }

  if (loading) {
    return <p>Loading members...</p>;
  }

  return (
    <div>
      <h2>
        League Members & Permissions
      </h2>

      {members.map(
        (member, index) => (
          <div
            key={member.userId}
            style={{
              border:
                "1px solid #ddd",
              borderRadius: 12,
              padding: 16,
              marginBottom: 20
            }}
          >
            <h3>
              {member.user?.name ||
                member.user?.email}
            </h3>

            <p>
              {member.user?.email}
            </p>

            <label>
              Role
            </label>

            <select
              value={member.role}
              onChange={(e) =>
                updateMember(
                  index,
                  "role",
                  e.target.value
                )
              }
            >
              <option value="OWNER">
                OWNER
              </option>

              <option value="ADMIN">
                ADMIN
              </option>

              <option value="CAPTAIN">
                CAPTAIN
              </option>

              <option value="SCORER">
                SCORER
              </option>

              <option value="VIEWER">
                VIEWER
              </option>
            </select>

            <hr />

            {[
              "canViewDashboard",
              "canViewManagement",
              "canViewMatches",
              "canViewScoring",
              "canViewStats",

              "canCreateLeague",
              "canCreateTeam",
              "canCreateMatch",

              "canDeleteLeague",
              "canDeleteTeam",
              "canDeletePlayer",
              "canDeleteMatch",

              "canScoreMatch",
              "canEditScore",
              "canUndoBall"
            ].map((permission) => (
              <div
                key={permission}
                style={{
                  marginBottom: 8
                }}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={
                      member[
                        permission
                      ]
                    }
                    onChange={(e) =>
                      updateMember(
                        index,
                        permission,
                        e.target
                          .checked
                      )
                    }
                  />

                  {" "}
                  {permission}
                </label>
              </div>
            ))}

            <div
              style={{
                display:
                  "flex",
                flexWrap:
                  "wrap",
                gap:
                  10,
                marginTop:
                  12,
              }}
            >
              <button
                className="btn"
                disabled={saving}
                onClick={() =>
                  savePermissions(
                    member
                  )
                }
              >
                Save Permissions
              </button>

              {canUnregisterMembers &&
                String(
                  member.user?.email ||
                  ""
                )
                  .trim()
                  .toLowerCase() !==
                  sessionEmail && (
                  <button
                    type="button"
                    className="member-unregister-btn"
                    disabled={
                      String(
                        unregisteringUserId ||
                        ""
                      ) ===
                      String(
                        member.userId
                      )
                    }
                    onClick={() =>
                      unregisterMember(
                        member
                      )
                    }
                  >
                    {String(
                      unregisteringUserId ||
                      ""
                    ) ===
                    String(
                      member.userId
                    )
                      ? "Unregistering…"
                      : "🚪 Unregister from League"}
                  </button>
                )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
