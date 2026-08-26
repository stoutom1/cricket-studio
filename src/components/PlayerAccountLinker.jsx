"use client";

import { useEffect, useMemo, useState } from "react";

import styles from "./PlayerAccountLinker.module.css";

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function normalizeEmailForUi(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function PlayerAccountLinker({
  leagueId,
  linked = false,
  onChanged,
}) {
  const numericLeagueId = Number(leagueId);

  const [open, setOpen] = useState(!linked);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [data, setData] = useState(null);

  const [selfPlayerId, setSelfPlayerId] = useState("");
  const [adminPlayerId, setAdminPlayerId] = useState("");
  const [adminUserId, setAdminUserId] = useState("");

  async function load() {
    if (
      !Number.isInteger(numericLeagueId) ||
      numericLeagueId <= 0
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/leagues/${numericLeagueId}/player-account-links`,
        {
          cache: "no-store",
        }
      );

      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(
          payload?.error ||
          "Unable to load player-account links."
        );
      }

      setData(payload);

      if (!selfPlayerId && payload?.selfCandidates?.length === 1) {
        setSelfPlayerId(
          String(payload.selfCandidates[0].id)
        );
      }
    } catch (err) {
      setError(
        err?.message ||
        "Unable to load player-account links."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      load();
    }
    // Deliberately keyed only to the selected league/open state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericLeagueId, open]);

  const selectedSelf = useMemo(
    () =>
      data?.selfCandidates?.find(
        (player) =>
          String(player.id) === String(selfPlayerId)
      ) || null,
    [data?.selfCandidates, selfPlayerId]
  );

  async function mutate(method, body, busyKey) {
    setBusy(busyKey);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/leagues/${numericLeagueId}/player-account-links`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(
          payload?.error ||
          "Unable to update the player-account link."
        );
      }

      setMessage(payload?.message || "Link updated.");
      await load();
      await onChanged?.();

      return payload;
    } catch (err) {
      setError(
        err?.message ||
        "Unable to update the player-account link."
      );
      return null;
    } finally {
      setBusy("");
    }
  }

  async function linkMine() {
    if (!selfPlayerId) {
      setError("Choose your player profile first.");
      return;
    }

    const confirmed = window.confirm(
      `Link "${selectedSelf?.name || "this player"}" to your Cric4All account? Only choose your own cricket profile. Historical scores will stay unchanged.`
    );

    if (!confirmed) return;

    const result = await mutate(
      "POST",
      {
        playerId: Number(selfPlayerId),
      },
      "self-link"
    );

    if (result?.ok) {
      setOpen(false);
    }
  }

  async function unlinkMine(playerId) {
    const confirmed = window.confirm(
      "Unlink this player profile from your Cric4All account? Your historical scores will not be deleted."
    );

    if (!confirmed) return;

    await mutate(
      "DELETE",
      {
        playerId: Number(playerId),
      },
      `self-unlink-${playerId}`
    );
  }

  async function adminLink() {
    if (!adminPlayerId || !adminUserId) {
      setError("Choose both a player and a registered league member.");
      return;
    }

    const player =
      data?.adminPlayers?.find(
        (row) =>
          String(row.id) === String(adminPlayerId)
      );

    const user =
      data?.adminUsers?.find(
        (row) =>
          String(row.id) === String(adminUserId)
      );

    if (
      player?.linkedUserEmail &&
      normalizeEmailForUi(player.linkedUserEmail) !==
        normalizeEmailForUi(user?.email)
    ) {
      const confirmed = window.confirm(
        `${player.name} is currently linked to ${player.linkedUserEmail}. Replace that link with ${user?.email || "the selected account"}? Historical scores will not be changed.`
      );

      if (!confirmed) return;
    }

    await mutate(
      "POST",
      {
        playerId: Number(adminPlayerId),
        userId: adminUserId,
      },
      "admin-link"
    );
  }

  async function adminUnlink(playerId) {
    const confirmed = window.confirm(
      "Remove this player-account link? Historical match scores and statistics will remain unchanged."
    );

    if (!confirmed) return;

    await mutate(
      "DELETE",
      {
        playerId: Number(playerId),
        admin: true,
      },
      `admin-unlink-${playerId}`
    );
  }

  if (!open && linked) {
    return (
      <div className={styles.closedBar}>
        <div>
          <span>🔗</span>
          <p>
            <strong>Player account linked</strong>
            <small>
              Your Cricket is connected to your player profile.
            </small>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
        >
          Manage link
        </button>
      </div>
    );
  }

  return (
    <section className={styles.shell}>
      <div className={styles.head}>
        <div>
          <small>🔗 PLAYER ↔ ACCOUNT</small>
          <strong>
            {linked
              ? "Manage player profile link"
              : "Link My Player Profile"}
          </strong>
          <p>
            Linking connects your login to your existing cricket history.
            It does not move, recreate, or delete any match statistics.
          </p>
        </div>

        {linked ? (
          <button
            type="button"
            className={styles.close}
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className={styles.loading}>
          Checking available player profiles…
        </div>
      ) : null}

      {error ? (
        <div className={styles.error}>{error}</div>
      ) : null}

      {message ? (
        <div className={styles.success}>{message}</div>
      ) : null}

      {!loading && data ? (
        <>
          {!data.linkSupported ? (
            <div className={styles.warning}>
              This database does not currently expose a Player.userId or
              Player.email link column. No data was changed.
            </div>
          ) : (
            <>
              <div className={styles.selfArea}>
                <div className={styles.sectionTitle}>
                  <div>
                    <small>YOUR ACCOUNT</small>
                    <strong>
                      {data.currentUser?.name ||
                        data.currentUser?.email}
                    </strong>
                    <span>{data.currentUser?.email}</span>
                  </div>

                  {data.selfLinks?.length ? (
                    <em>Linked</em>
                  ) : (
                    <em className={styles.needsLink}>
                      Needs link
                    </em>
                  )}
                </div>

                {data.selfLinks?.length ? (
                  <div className={styles.linkedList}>
                    {data.selfLinks.map((player) => (
                      <article key={player.id}>
                        <span className={styles.avatar}>
                          {String(player.name || "?")
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <div>
                          <strong>{player.name}</strong>
                          <small>{player.teamName}</small>
                        </div>

                        <button
                          type="button"
                          disabled={
                            busy === `self-unlink-${player.id}`
                          }
                          onClick={() =>
                            unlinkMine(player.id)
                          }
                        >
                          {busy === `self-unlink-${player.id}`
                            ? "Removing…"
                            : "Unlink"}
                        </button>
                      </article>
                    ))}
                  </div>
                ) : null}

                {data.selfCandidates?.length ? (
                  <div className={styles.claimArea}>
                    <label>
                      <span>
                        {data.selfLinks?.length
                          ? "Link another player profile"
                          : "Choose your player"}
                      </span>

                      <select
                        value={selfPlayerId}
                        onChange={(event) =>
                          setSelfPlayerId(event.target.value)
                        }
                      >
                        <option value="">
                          Select your player profile
                        </option>

                        {data.selfCandidates.map((player) => (
                          <option
                            key={player.id}
                            value={player.id}
                          >
                            {player.name} · {player.teamName}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedSelf ? (
                      <div className={styles.selection}>
                        <span className={styles.avatar}>
                          {String(selectedSelf.name || "?")
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <p>
                          <strong>{selectedSelf.name}</strong>
                          <small>{selectedSelf.teamName}</small>
                        </p>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className={styles.primary}
                      disabled={
                        !selfPlayerId ||
                        busy === "self-link"
                      }
                      onClick={linkMine}
                    >
                      {busy === "self-link"
                        ? "Linking…"
                        : data.selfLinks?.length
                          ? "Link Another Profile"
                          : "Link My Player Profile"}
                    </button>

                    <p className={styles.safety}>
                      Only currently unclaimed players are shown here.
                      Linking changes only the account relationship; it never
                      changes or deletes historical match scores.
                    </p>
                  </div>
                ) : !data.selfLinks?.length ? (
                  <div className={styles.warning}>
                    No unlinked player profiles are available in this league.
                    Ask the league owner to review the account links below.
                  </div>
                ) : null}
              </div>

              {data.canManageLinks ? (
                <div className={styles.adminArea}>
                  <div className={styles.adminHead}>
                    <span>🛡️</span>
                    <div>
                      <small>OWNER / SUPERADMIN</small>
                      <strong>Player Account Management</strong>
                      <p>
                        Link a player to an existing registered member of
                        this league, or remove an incorrect link.
                      </p>
                    </div>
                  </div>

                  <div className={styles.adminForm}>
                    <label>
                      <span>Player</span>
                      <select
                        value={adminPlayerId}
                        onChange={(event) =>
                          setAdminPlayerId(event.target.value)
                        }
                      >
                        <option value="">Choose player</option>
                        {data.adminPlayers?.map((player) => (
                          <option
                            key={player.id}
                            value={player.id}
                          >
                            {player.name} · {player.teamName}
                            {player.linkedUserEmail
                              ? ` · linked to ${player.linkedUserEmail}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Registered league member</span>
                      <select
                        value={adminUserId}
                        onChange={(event) =>
                          setAdminUserId(event.target.value)
                        }
                      >
                        <option value="">Choose account</option>
                        {data.adminUsers?.map((user) => (
                          <option
                            key={user.id}
                            value={user.id}
                          >
                            {user.name || user.email} · {user.email}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className={styles.primary}
                      disabled={
                        !adminPlayerId ||
                        !adminUserId ||
                        busy === "admin-link"
                      }
                      onClick={adminLink}
                    >
                      {busy === "admin-link"
                        ? "Saving…"
                        : "Link Account"}
                    </button>
                  </div>

                  <div className={styles.adminLinks}>
                    <div className={styles.sectionTitle}>
                      <div>
                        <small>CURRENT LINKS</small>
                        <strong>
                          {data.currentLinks?.length || 0} linked profile
                          {data.currentLinks?.length === 1 ? "" : "s"}
                        </strong>
                      </div>
                    </div>

                    {data.currentLinks?.length ? (
                      data.currentLinks.map((player) => (
                        <article key={player.id}>
                          <span className={styles.avatar}>
                            {String(player.name || "?")
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </span>

                          <div>
                            <strong>
                              {player.name} · {player.teamName}
                            </strong>
                            <small>
                              {player.linkedUserName ||
                                player.linkedUserEmail ||
                                "Linked account"}{" "}
                              · {player.linkedUserEmail}
                            </small>
                          </div>

                          <button
                            type="button"
                            disabled={
                              busy ===
                              `admin-unlink-${player.id}`
                            }
                            onClick={() =>
                              adminUnlink(player.id)
                            }
                          >
                            {busy ===
                            `admin-unlink-${player.id}`
                              ? "Removing…"
                              : "Unlink"}
                          </button>
                        </article>
                      ))
                    ) : (
                      <p className={styles.muted}>
                        No player profiles are linked yet.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </section>
  );
}
