"use client";

import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

export default function BirthdayTodayClient({
  leagueId,
  initialBirthdayId,
}) {
  const [league, setLeague] = useState(null);
  const [birthdays, setBirthdays] = useState([]);
  const [selectedId, setSelectedId] = useState(
    initialBirthdayId
  );
  const [birthdayDate, setBirthdayDate] =
    useState("");
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/leagues/${leagueId}/birthdays/today`,
          {
            cache: "no-store",
          }
        );

        const responseText = await response.text();

        let data = {};

        if (responseText) {
          try {
            data = JSON.parse(responseText);
          } catch {
            throw new Error(
              "The birthday service returned an invalid response."
            );
          }
        }

        if (!response.ok) {
          throw new Error(
            data?.error || "Unable to load birthdays."
          );
        }

        if (cancelled) {
          return;
        }

        const birthdayRows = Array.isArray(
          data.birthdays
        )
          ? data.birthdays
          : [];

        setLeague(data.league ?? null);
        setBirthdays(birthdayRows);
        setBirthdayDate(data.date ?? "");

        setSelectedId((currentSelectedId) => {
          const requestedId = Number(
            currentSelectedId
          );

          const requestedBirthdayExists =
            birthdayRows.some(
              (birthday) =>
                birthday.id === requestedId
            );

          if (requestedBirthdayExists) {
            return requestedId;
          }

          return birthdayRows[0]?.id ?? null;
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load birthdays."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const numericLeagueId = Number(leagueId);

    if (
      !Number.isInteger(numericLeagueId) ||
      numericLeagueId <= 0
    ) {
      setError("Invalid league ID.");
      setLoading(false);

      return () => {
        cancelled = true;
      };
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const selectedBirthday = useMemo(
    () =>
      birthdays.find(
        (birthday) =>
          birthday.id === Number(selectedId)
      ) ?? null,
    [birthdays, selectedId]
  );

  const formattedDate = useMemo(() => {
    if (!birthdayDate) {
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date());
    }

    const parsedDate = new Date(
      `${birthdayDate}T12:00:00`
    );

    if (Number.isNaN(parsedDate.getTime())) {
      return birthdayDate;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(parsedDate);
  }, [birthdayDate]);

  function buildMessage() {
    if (!selectedBirthday) {
      return "";
    }

    return [
      `🎉 Happy Birthday, ${selectedBirthday.name}! 🎂`,
      "",
      "Wishing you a wonderful year filled with happiness, good health, runs, wickets and victories!",
      "",
      `Best wishes from ${
        league?.name ?? "your cricket league"
      } and the Cric4All family. 🏏`,
      "",
      //"https://cric4all.app",
    ].join("\n");
  }

  async function markShared() {
    if (!selectedBirthday) {
      return;
    }

    try {
      await fetch(
        `/api/leagues/${leagueId}/birthdays/${selectedBirthday.id}/shared`,
        {
          method: "POST",
        }
      );
    } catch (markError) {
      console.error(
        "Unable to record birthday share:",
        markError
      );
    }
  }

  async function shareBirthday() {
    if (!selectedBirthday || sharing) {
      return;
    }

    const message = buildMessage();

    try {
      setSharing(true);

      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: `Happy Birthday ${selectedBirthday.name}`,
          text: message,
          dialogTitle: "Share birthday wish",
        });

        await markShared();
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: `Happy Birthday ${selectedBirthday.name}`,
          text: message,
        });

        await markShared();
        return;
      }

      await navigator.clipboard.writeText(message);

      window.alert(
        "Birthday message copied. Open WhatsApp and paste it into the group."
      );

      await markShared();
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        console.error(
          "Birthday share failed:",
          shareError
        );

        window.alert(
          "Unable to open the sharing options."
        );
      }
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <main className="birthday-page">
        <section className="birthday-loading-card">
          <span className="birthday-loader" />
          <h2>Preparing today’s celebration</h2>
          <p>Loading birthday details...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="birthday-page">
        <section className="birthday-error-card">
          <div className="birthday-error-icon">
            !
          </div>

          <div>
            <h2>Unable to load birthdays</h2>
            <p>{error}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="birthday-page">
      <section className="birthday-hero">
        <div className="birthday-confetti birthday-confetti-one" />
        <div className="birthday-confetti birthday-confetti-two" />
        <div className="birthday-confetti birthday-confetti-three" />

        <div className="birthday-hero-visual">
          <div className="birthday-cake-glow" />

          <div className="birthday-cake">
            <div className="birthday-candles">
              <span>🔥</span>
              <span>🔥</span>
              <span>🔥</span>
            </div>

            <span className="birthday-cake-emoji">
              🎂
            </span>
          </div>
        </div>

        <div className="birthday-hero-content">
          <span className="birthday-eyebrow">
            Cric4All Celebrations
          </span>

          <h1>Today’s Birthdays</h1>

          <p>
            Celebrate your teammates and make their
            special day unforgettable.
          </p>

          <div className="birthday-hero-meta">
            <span>
              <span aria-hidden="true">📅</span>
              {formattedDate}
            </span>

            <span>
              <span aria-hidden="true">🎉</span>
              {birthdays.length}{" "}
              {birthdays.length === 1
                ? "birthday"
                : "birthdays"}{" "}
              today
            </span>
          </div>
        </div>

        <div
          className="birthday-gift"
          aria-hidden="true"
        >
          🎁
        </div>
      </section>

      {birthdays.length === 0 ? (
        <section className="birthday-empty-card">
          <div className="birthday-empty-icon">
            📅
          </div>

          <h2>No birthdays today</h2>

          <p>
            There are no active birthdays scheduled
            for today in {league?.name ?? "this league"}.
          </p>
        </section>
      ) : (
        <>
          <section className="birthday-selector-card">
            <div className="birthday-section-heading">
              <span className="birthday-heading-icon">
                👥
              </span>

              <div>
                <h2>Select birthday</h2>
                <p>
                  Choose the player whose birthday wish
                  you would like to share.
                </p>
              </div>
            </div>

            <div className="birthday-select-wrapper">
              <span className="birthday-avatar">
                {selectedBirthday?.name
                  ?.slice(0, 2)
                  .toUpperCase() ?? "🎂"}
              </span>

              <select
                value={selectedId ?? ""}
                onChange={(event) =>
                  setSelectedId(
                    Number(event.target.value)
                  )
                }
                aria-label="Select birthday"
              >
                {birthdays.map((birthday) => (
                  <option
                    key={birthday.id}
                    value={birthday.id}
                  >
                    {birthday.name}
                  </option>
                ))}
              </select>

              <span
                className="birthday-select-arrow"
                aria-hidden="true"
              >
               ⌄
              </span>
            </div>
          </section>

          <section className="birthday-celebration-card">
            <div className="birthday-celebration-art">
              <div className="birthday-art-ring">
                <span className="birthday-crown">
                  👑
                </span>

                <span className="birthday-main-emoji">
                  🎂
                </span>
              </div>
            </div>

            <div className="birthday-celebration-content">
              <span className="birthday-wish-label">
                A special Cric4All wish
              </span>

              <h2>
                Happy Birthday,
                <span>
                  {selectedBirthday?.name}! 🎉
                </span>
              </h2>

              <div className="birthday-divider">
                <span />
                <strong>♥</strong>
                <span />
              </div>

              <p className="birthday-wish-copy">
                Wishing you happiness, good health,
                runs, wickets and victories. May this
                year bring many unforgettable moments
                both on and off the cricket field.
              </p>

              <div className="birthday-league-signature">
                <strong>
                  {league?.name ??
                    "Your cricket league"}
                </strong>

                <span>
                  With best wishes from the Cric4All
                  family
                </span>
              </div>
            </div>

            <div className="birthday-share-panel">
              <div
                className="birthday-cricket-art"
                aria-hidden="true"
              >
                🏏
              </div>

              <button
                type="button"
                onClick={shareBirthday}
                disabled={
                  !selectedBirthday || sharing
                }
                className="share-birthday-button"
              >
                <span className="whatsapp-icon">
                  ◉
                </span>

                <span>
                  {sharing
                    ? "Opening Share..."
                    : "Share to WhatsApp"}
                </span>

                <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        </>
      )}

      <section className="birthday-privacy-note">
        <span aria-hidden="true">🛡️</span>

        <p>
          Birthday details are visible only to
          authorized league members.
        </p>
      </section>
    </main>
  );
}