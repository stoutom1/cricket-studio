"use client";

import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(
          `/api/leagues/${leagueId}/birthdays/today`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to load birthdays."
          );
        }

        setLeague(data.league);
        setBirthdays(data.birthdays ?? []);

        if (!selectedId && data.birthdays?.length > 0) {
          setSelectedId(data.birthdays[0].id);
        }
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [leagueId, selectedId]);

  const selectedBirthday = birthdays.find(
    (birthday) => birthday.id === selectedId
  );

  function buildMessage() {
    if (!selectedBirthday) {
      return "";
    }

    return [
      `🎉 Happy Birthday, ${selectedBirthday.name}! 🎂`,
      "",
      `Wishing you a wonderful year filled with happiness, good health, runs, wickets and victories!`,
      "",
      `Best wishes from ${league?.name ?? "your cricket league"} and the Cric4All family. 🏏`,
      "",
      "https://cric4all.app",
    ].join("\n");
  }

  async function shareBirthday() {
    if (!selectedBirthday) {
      return;
    }

    const message = buildMessage();

    try {
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
      alert(
        "Birthday message copied. Open WhatsApp and paste it into the group."
      );
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        console.error("Birthday share failed:", shareError);
        alert("Unable to open the sharing options.");
      }
    }
  }

  async function markShared() {
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

  if (loading) {
    return <main className="birthday-page">Loading...</main>;
  }

  if (error) {
    return (
      <main className="birthday-page">
        <p className="birthday-error">{error}</p>
      </main>
    );
  }

  return (
    <main className="birthday-page">
      <section className="birthday-header">
        <h1>🎂 Today’s Birthdays</h1>
        <p>{league?.name}</p>
      </section>

      {birthdays.length === 0 ? (
        <section className="birthday-card">
          <p>There are no active birthdays today.</p>
        </section>
      ) : (
        <>
          <section className="birthday-card">
            <label>
              Select birthday
              <select
                value={selectedId ?? ""}
                onChange={(event) =>
                  setSelectedId(Number(event.target.value))
                }
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
            </label>
          </section>

          <section className="birthday-card">
            <div className="birthday-preview">
              <div className="birthday-preview-icon">🎂</div>

              <h2>
                Happy Birthday,
                <br />
                {selectedBirthday?.name}!
              </h2>

              <p>
                Wishing you happiness, good health, runs,
                wickets and victories.
              </p>

              <strong>{league?.name}</strong>
              <span>Powered by Cric4All</span>
            </div>

            <button
              type="button"
              onClick={shareBirthday}
              className="share-birthday-button"
            >
              Share to WhatsApp
            </button>
          </section>
        </>
      )}
    </main>
  );
}