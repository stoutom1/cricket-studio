"use client";

import { useEffect, useState } from "react";

export default function LeaguePermissions({
  leagueId
}) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);

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

              <option value="ANALYST">
                ANALYST
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
          </div>
        )
      )}
    </div>
  );
}
