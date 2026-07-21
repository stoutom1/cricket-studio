"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const DAYS_BY_MONTH = {
  1: 31,
  2: 29,
  3: 31,
  4: 30,
  5: 31,
  6: 30,
  7: 31,
  8: 31,
  9: 30,
  10: 31,
  11: 30,
  12: 31,
};

const EMPTY_FORM = {
  playerId: "",
  name: "",
  birthMonth: "",
  birthDay: "",
  notes: "",
  whatsappNumber: "",
  whatsappOptIn: false,
};

function formatMMDD(month, day) {
  return `${String(month).padStart(2, "0")}/${String(day).padStart(
    2,
    "0"
  )}`;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();

    throw new Error(
      text || `Unexpected server response (${response.status}).`
    );
  }

  return response.json();
}

export default function BirthdayManager({ leagueId }) {
  const numericLeagueId = Number(leagueId);

  const isValidLeagueId =
    Number.isInteger(numericLeagueId) && numericLeagueId > 0;

  const apiBaseUrl = isValidLeagueId
    ? `/api/leagues/${numericLeagueId}/birthdays`
    : null;

  const [birthdays, setBirthdays] = useState([]);
  const [form, setForm] = useState({name: "", whatsappNumber: "", whatsappOptIn: false,});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [testingBirthdayId, setTestingBirthdayId] = useState(null);

  const availableDays = useMemo(() => {
    const month = Number(form.birthMonth);
    const count = DAYS_BY_MONTH[month] ?? 31;

    return Array.from({ length: count }, (_, index) => index + 1);
  }, [form.birthMonth]);

  const loadBirthdays = useCallback(async () => {
    if (!apiBaseUrl) {
      setBirthdays([]);
      setLoading(false);
      setError("Invalid league ID.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(apiBaseUrl, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load birthdays.");
      }

      setBirthdays(
        Array.isArray(data) ? data : data?.birthdays ?? []
      );
    } catch (loadError) {
      console.error("Birthday loading error:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load birthdays."
      );
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const loadPlayers = useCallback(async () => {
  if (!apiBaseUrl) {
    setPlayers([]);
    setPlayersLoading(false);
    return;
  }

  setPlayersLoading(true);

  try {
    const response = await fetch(
      `/api/leagues/${numericLeagueId}/players`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      }
    );

    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data?.error || "Unable to load players.");
    }

    const loadedPlayers = Array.isArray(data)
      ? data
      : data?.players ?? [];

    setPlayers(
      loadedPlayers
        .filter((player) => player?.id && player?.name)
        .sort((first, second) =>
          first.name.localeCompare(second.name)
        )
    );
  } catch (playerError) {
    console.error("Player loading error:", playerError);

    setError(
      playerError instanceof Error
        ? playerError.message
        : "Unable to load players."
    );
  } finally {
    setPlayersLoading(false);
  }
}, [apiBaseUrl, numericLeagueId]);

useEffect(() => {
  loadBirthdays();
  loadPlayers();
}, [loadBirthdays, loadPlayers]);

  function updateForm(field, value) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (field === "birthMonth") {
        const maximumDay = DAYS_BY_MONTH[Number(value)] ?? 31;

        if (Number(next.birthDay) > maximumDay) {
          next.birthDay = "";
        }
      }

      return next;
    });
  }

 function startEditing(birthday) {
  setEditingId(birthday.id);

  setForm({
    playerId: birthday.playerId
      ? String(birthday.playerId)
      : "",

    name: birthday.name ?? "",

    birthMonth: String(
      birthday.birthMonth ?? ""
    ),

    birthDay: String(
      birthday.birthDay ?? ""
    ),

    notes: birthday.notes ?? "",

    whatsappNumber:
      birthday.player?.whatsappNumber ?? "",

    whatsappOptIn:
      Boolean(
        birthday.player?.whatsappOptIn
      ),
  });

  setMessage("");
  setError("");

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

  function cancelEditing() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!apiBaseUrl) {
      setError("Invalid league ID.");
      return;
    }

    const playerId = Number(form.playerId);
const name = form.name.trim();
const birthMonth = Number(form.birthMonth);
const birthDay = Number(form.birthDay);
    const maximumDay = DAYS_BY_MONTH[birthMonth];

    if (!name) {
      setError("Please enter the person's name.");
      return;
    }

    if (!Number.isInteger(birthMonth) || !maximumDay) {
      setError("Please select a valid birth month.");
      return;
    }
    if (!Number.isInteger(playerId) || playerId <= 0) {
  setError("Please select a player.");
  return;
}
if (!name) {
  setError("The selected player does not have a valid name.");
  return;
}

    if (
      !Number.isInteger(birthDay) ||
      birthDay < 1 ||
      birthDay > maximumDay
    ) {
      setError("Please select a valid birth day.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const endpoint = editingId
        ? `${apiBaseUrl}/${editingId}`
        : apiBaseUrl;

      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
body: JSON.stringify({
  playerId: Number(form.playerId),

  birthMonth:
    Number(form.birthMonth),

  birthDay:
    Number(form.birthDay),

  notes:
    String(form.notes ?? "").trim(),

  whatsappNumber:
    String(
      form.whatsappNumber ?? ""
    ).replace(/\D/g, "") || null,

  whatsappOptIn:
    Boolean(form.whatsappOptIn),
}),
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save birthday.");
      }

      setMessage(
        data?.message ||
          (editingId
            ? "Birthday updated successfully."
            : "Birthday added successfully.")
      );

      setEditingId(null);
      setForm(EMPTY_FORM);

      await loadBirthdays();
    } catch (saveError) {
      console.error("Birthday saving error:", saveError);

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save birthday."
      );
    } finally {
      setSaving(false);
    }
  }

 function selectPlayer(playerIdValue) {
  const selectedPlayer = players.find(
    (player) =>
      Number(player.id) ===
      Number(playerIdValue)
  );

  setForm((current) => ({
    ...current,

    playerId: playerIdValue,

    name:
      selectedPlayer?.name ?? "",

    whatsappNumber:
      selectedPlayer?.whatsappNumber ?? "",

    whatsappOptIn:
      Boolean(
        selectedPlayer?.whatsappOptIn
      ),
  }));

  setMessage("");
  setError("");
}

  async function toggleBirthday(birthday) {
    if (!apiBaseUrl) {
      setError("Invalid league ID.");
      return;
    }

    setWorkingId(birthday.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/${birthday.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            isActive: !birthday.isActive,
          }),
        }
      );

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to update birthday."
        );
      }

      setMessage(
        data?.message || "Birthday status updated successfully."
      );

      await loadBirthdays();
    } catch (toggleError) {
      console.error("Birthday status error:", toggleError);

      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update birthday."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteBirthday(birthday) {
    if (!apiBaseUrl) {
      setError("Invalid league ID.");
      return;
    }

    const confirmed = window.confirm(
      `Delete the birthday entry for ${birthday.name}?`
    );

    if (!confirmed) {
      return;
    }

    setWorkingId(birthday.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/${birthday.id}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to delete birthday."
        );
      }

      setMessage(
        data?.message || "Birthday deleted successfully."
      );

      if (editingId === birthday.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }

      await loadBirthdays();
    } catch (deleteError) {
      console.error("Birthday deletion error:", deleteError);

      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete birthday."
      );
    } finally {
      setWorkingId(null);
    }
  }

  if (!isValidLeagueId) {
    return (
      <main className="birthday-page">
        <section className="birthday-card">
          <h1>Invalid league</h1>
          <p>A valid league ID was not provided.</p>

          <Link href="/dashboard">
            Return to Dashboard
          </Link>
        </section>
      </main>
    );
  }

  async function testWhatsAppBirthday(birthday) {
  const recipientPhone = window.prompt(
    "Enter your WhatsApp test number with country code:",
    ""
  );

  if (!recipientPhone) {
    return;
  }

  setTestingBirthdayId(birthday.id);
  setMessage("");
  setError("");

  try {
    const response = await fetch(
      `/api/leagues/${numericLeagueId}/birthdays/test-whatsapp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          birthdayId: birthday.id,
          recipientPhone,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Unable to send the WhatsApp test."
      );
    }

    setMessage(
      data?.message ||
        "WhatsApp test message sent successfully."
    );
  } catch (testError) {
    console.error(
      "WhatsApp birthday test error:",
      testError
    );

    setError(
      testError instanceof Error
        ? testError.message
        : "Unable to send the WhatsApp test."
    );
  } finally {
    setTestingBirthdayId(null);
  }
}

function shareBirthdayToWhatsApp(birthday) {
  const message = [
    `🎂 Happy Birthday, ${birthday.name}! 🥳`,
    "",
    "Wishing you happiness, good health, and many memorable cricket moments.",
    "",
    "Best wishes from the entire league and Cric4All! 🏏",
  ].join("\n");

  const shareUrl =
    `https://wa.me/?text=${encodeURIComponent(message)}`;

  window.open(
    shareUrl,
    "_blank",
    "noopener,noreferrer"
  );
}

  return (
    <main className="birthday-page">
      <section className="birthday-header">
        <div>
          <p className="birthday-eyebrow">
            League Management
          </p>

          <h1>🎂 Birthday Center</h1>

          <p>
            Maintain birthday names and month/day values for this
            league. Birth years are never requested.
          </p>

          <p>
            <strong>League ID:</strong> {numericLeagueId}
          </p>
        </div>

        <div className="birthday-header-actions">
          <Link
            href="/dashboard"
            className="secondary"
          >
            ← Back to Dashboard
          </Link>

          <Link
            href={`/leagues/${numericLeagueId}/birthdays/today`}
            className="secondary"
          >
            Today&apos;s Birthdays
          </Link>
        </div>
      </section>

      <section className="birthday-card">
        <h2>
          {editingId ? "Edit birthday" : "Add birthday"}
        </h2>

        <form
          onSubmit={handleSubmit}
          className="birthday-form"
        >
<label>
  Player

<select
  value={form.playerId}
  required
  onChange={(event) =>
    selectPlayer(event.target.value)
  }
>
  <option value="">Select a player</option>

  {players.map((player) => (
    <option key={player.id} value={player.id}>
      {player.name}
    </option>
  ))}
</select>
</label>
{form.name && (
  <p className="selected-player-name">
    Selected player: <strong>{form.name}</strong>
  </p>
)}

          <div className="birthday-date-row">
            <label>
              Month

              <select
                value={form.birthMonth}
                required
                onChange={(event) =>
                  updateForm(
                    "birthMonth",
                    event.target.value
                  )
                }
              >
                <option value="">Select month</option>

                {MONTHS.map((month) => (
                  <option
                    key={month.value}
                    value={month.value}
                  >
                    {month.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Day

              <select
                value={form.birthDay}
                required
                disabled={!form.birthMonth}
                onChange={(event) =>
                  updateForm(
                    "birthDay",
                    event.target.value
                  )
                }
              >
                <option value="">Select day</option>

                {availableDays.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label>
  WhatsApp number

  <input
    type="tel"
    value={form.whatsappNumber}
    placeholder="Example: 16104252773"
    onChange={(event) =>
      setForm((current) => ({
        ...current,
        whatsappNumber: event.target.value.replace(/\D/g, ""),
      }))
    }
  />
</label>

<label className="checkbox-label">
  <input
    type="checkbox"
    checked={form.whatsappOptIn}
    onChange={(event) =>
      setForm((current) => ({
        ...current,
        whatsappOptIn: event.target.checked,
      }))
    }
  />

  Player consented to receive WhatsApp messages
</label>
          </div>

          <label>
            Private admin note

            <textarea
              value={form.notes}
              maxLength={500}
              rows={3}
              placeholder="Optional. This note will not appear in the birthday wish."
              onChange={(event) =>
                updateForm("notes", event.target.value)
              }
            />
          </label>

          <div className="birthday-actions">
            <button
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Add Birthday"}
            </button>

            {editingId && (
              <button
                type="button"
                className="secondary"
                onClick={cancelEditing}
                disabled={saving}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {message && (
          <p
            className="birthday-success"
            role="status"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            className="birthday-error"
            role="alert"
          >
            {error}
          </p>
        )}
      </section>

      <section className="birthday-card">
        <div className="birthday-list-heading">
          <h2>League birthday list</h2>

          <span>
            {birthdays.length}{" "}
            {birthdays.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {loading ? (
          <p>Loading birthdays...</p>
        ) : birthdays.length === 0 ? (
          <p>
            No birthdays have been added to this league.
          </p>
        ) : (
          <div className="birthday-table-wrapper">
            <table className="birthday-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Birthday</th>
                  <th>Status</th>
                  <th aria-label="Actions">Actions</th>
                </tr>
              </thead>

              <tbody>
                {birthdays.map((birthday) => {
                  const isWorking =
                    workingId === birthday.id;

                  return (
                    <tr key={birthday.id}>
                      <td>{birthday.name}</td>

                      <td>
                        {formatMMDD(
                          birthday.birthMonth,
                          birthday.birthDay
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            birthday.isActive
                              ? "status-active"
                              : "status-inactive"
                          }
                        >
                          {birthday.isActive
                            ? "Active"
                            : "Disabled"}
                        </span>
                      </td>

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            disabled={isWorking || saving}
                            onClick={() =>
                              startEditing(birthday)
                            }
                          >
                            Edit
                          </button>
                          <button
  type="button"
  disabled={
    testingBirthdayId === birthday.id ||
    !birthday.isActive
  }
  onClick={() =>
    testWhatsAppBirthday(birthday)
  }
>
  {testingBirthdayId === birthday.id
    ? "Sending..."
    : "Test WhatsApp"}
</button>
<button
  type="button"
  onClick={() =>
    shareBirthdayToWhatsApp(birthday)
  }
>
  Share to WhatsApp Group
</button>

                          <button
                            type="button"
                            disabled={isWorking || saving}
                            onClick={() =>
                              toggleBirthday(birthday)
                            }
                          >
                            {isWorking
                              ? "Updating..."
                              : birthday.isActive
                                ? "Disable"
                                : "Enable"}
                          </button>

                          <button
                            type="button"
                            className="danger"
                            disabled={isWorking || saving}
                            onClick={() =>
                              deleteBirthday(birthday)
                            }
                          >
                            {isWorking
                              ? "Working..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}