"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pencil,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Trash2,
  LoaderCircle,
} from "lucide-react";

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

function normalizePlayerName(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}

function getUniqueSurprisePlayers(players) {
  const uniquePlayers = new Map();

  for (const player of players) {
    if (!player?.id || !player?.name?.trim()) {
      continue;
    }

    const normalizedName = normalizePlayerName(
      player.name
    );

    const existingPlayer =
      uniquePlayers.get(normalizedName);

    /*
     * Keep only one record for players with the same name.
     *
     * Prefer the record containing WhatsApp information.
     * Otherwise retain the first record returned by the API.
     */
    if (!existingPlayer) {
      uniquePlayers.set(normalizedName, player);
      continue;
    }

    const existingHasWhatsApp =
      Boolean(
        existingPlayer.whatsappNumber?.trim()
      );

    const currentHasWhatsApp =
      Boolean(player.whatsappNumber?.trim());

    if (
      !existingHasWhatsApp &&
      currentHasWhatsApp
    ) {
      uniquePlayers.set(normalizedName, player);
    }
  }

  return [...uniquePlayers.values()];
}

const MONTH_NAME_TO_NUMBER = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function normalizeBulkPlayerName(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}

function parseBirthdayImportLine(line, lineNumber) {
  const cleanedLine = String(line ?? "").trim();

  if (!cleanedLine) {
    return null;
  }

  /*
   * Expected examples:
   *
   * Shiva Love - Jan 01
   * Kasa Dove - Dec 24
   * Sai Jove - February 26
   */
  const match = cleanedLine.match(
    /^(.+?)\s*-\s*([A-Za-z]+)\s+(\d{1,2})\s*$/
  );

  if (!match) {
    return {
      valid: false,
      lineNumber,
      originalLine: cleanedLine,
      error:
        "Invalid format. Use: Player Name - Jan 01",
    };
  }

  const playerName = match[1].trim();
  const monthText = match[2]
    .trim()
    .toLocaleLowerCase("en-US");
  const birthDay = Number(match[3]);
  const birthMonth =
    MONTH_NAME_TO_NUMBER[monthText];

  if (!birthMonth) {
    return {
      valid: false,
      lineNumber,
      originalLine: cleanedLine,
      playerName,
      error: `Invalid month: ${match[2]}`,
    };
  }

  const maximumDay =
    DAYS_BY_MONTH[birthMonth];

  if (
    !Number.isInteger(birthDay) ||
    birthDay < 1 ||
    birthDay > maximumDay
  ) {
    return {
      valid: false,
      lineNumber,
      originalLine: cleanedLine,
      playerName,
      error: `Invalid day for ${match[2]}: ${match[3]}`,
    };
  }

  return {
    valid: true,
    lineNumber,
    originalLine: cleanedLine,
    playerName,
    normalizedPlayerName:
      normalizeBulkPlayerName(playerName),
    birthMonth,
    birthDay,
  };
}

function parseBirthdayImportText(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line, index) =>
      parseBirthdayImportLine(
        line,
        index + 1
      )
    )
    .filter(Boolean);
}

function normalizeOwnerWhatsAppNumber(
  value
) {
  const rawValue =
    String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  const digits =
    rawValue.replace(/\D/g, "");

  return `+${digits}`;
}
function BirthdayCollapsibleSection({
  icon,
  title,
  description,
  badge = null,
  accent = "default",
  children,
  className = "",
  defaultOpen = false,
  onToggle,
}) {
  return (
<details
  className={[
    "birthday-collapsible",
    `birthday-collapsible-${accent}`,
    className,
  ]
    .filter(Boolean)
    .join(" ")}
  open={defaultOpen}
  onToggle={onToggle}
>
      <summary className="birthday-collapsible-summary">
        <span
          className="birthday-collapsible-icon"
          aria-hidden="true"
        >
          {icon}
        </span>

        <span className="birthday-collapsible-heading">
          <strong>{title}</strong>

          {description && (
            <small>{description}</small>
          )}
        </span>

        {badge && (
          <span className="birthday-collapsible-badge">
            {badge}
          </span>
        )}

        <span
          className="birthday-collapsible-chevron"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </summary>

      <div className="birthday-collapsible-body">
        <div className="birthday-collapsible-body-inner">
          {children}
        </div>
      </div>
    </details>
  );
}
export default function BirthdayManager({
  leagueId,
  leagueName,
  initialOwnerWhatsAppNumber = "",
  initialWhatsAppNotificationsEnabled = false,
}) {
  const numericLeagueId = Number(leagueId);

  const isValidLeagueId =
    Number.isInteger(numericLeagueId) && numericLeagueId > 0;

  const apiBaseUrl = isValidLeagueId
    ? `/api/leagues/${numericLeagueId}/birthdays`
    : null;

  const [birthdays, setBirthdays] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  //const [form, setForm] = useState({name: "", whatsappNumber: "", whatsappOptIn: false,});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [testingBirthdayId, setTestingBirthdayId] = useState(null);
  const [bulkFile, setBulkFile] =
  useState(null);

const [bulkOwnerPhone, setBulkOwnerPhone] =
  useState("");

const [bulkImporting, setBulkImporting] =
  useState(false);

const [bulkImportResult, setBulkImportResult] =
  useState(null);

const [actionLoading, setActionLoading] = useState({
  id: null,
  action: null,
});
const [
  ownerWhatsAppNumber,
  setOwnerWhatsAppNumber,
] = useState(
  initialOwnerWhatsAppNumber
);

const [
  whatsappNotificationsEnabled,
  setWhatsappNotificationsEnabled,
] = useState(
  Boolean(
    initialWhatsAppNotificationsEnabled
  )
);

const [
  savingWhatsAppSettings,
  setSavingWhatsAppSettings,
] = useState(false);

const [
  whatsappSettingsMessage,
  setWhatsAppSettingsMessage,
] = useState("");

const [
  whatsappSettingsError,
  setWhatsAppSettingsError,
] = useState("");

const [
  birthdayFormSectionKey,
  setBirthdayFormSectionKey,
] = useState(0);

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
  setError("");

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

    const data =
      await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Unable to load players."
      );
    }

    const loadedPlayers =
      Array.isArray(data)
        ? data
        : data?.players ?? [];

    const validPlayers =
      loadedPlayers.filter(
        (player) =>
          player?.id &&
          player?.name?.trim()
      );

    /*
     * Surprise Cricket League special case.
     *
     * League 2 contains players from both
     * Surprise 1 and Surprise 2. The same person
     * can therefore have two different player IDs.
     *
     * Show each normalized player name only once.
     */
    const playersForSelector =
      numericLeagueId === 2
        ? getUniqueSurprisePlayers(
            validPlayers
          )
        : validPlayers;

    playersForSelector.sort(
      (first, second) =>
        first.name.localeCompare(
          second.name,
          undefined,
          {
            sensitivity: "base",
          }
        )
    );

    setPlayers(playersForSelector);
  } catch (playerError) {
    console.error(
      "Player loading error:",
      playerError
    );

    setPlayers([]);

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
  setBirthdayFormSectionKey(
  (current) => current + 1
);

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
  const numericPlayerId =
    Number(playerIdValue);

  const selectedPlayer = players.find(
    (player) =>
      Number(player.id) === numericPlayerId
  );

  const existingBirthday = birthdays.find(
    (birthday) =>
      Number(birthday.playerId) ===
      numericPlayerId
  );

  setForm((current) => ({
    ...current,

    playerId: playerIdValue,

    name:
      existingBirthday?.name ||
      selectedPlayer?.name ||
      "",

    birthMonth:
      existingBirthday?.birthMonth
        ? String(
            existingBirthday.birthMonth
          )
        : "",

    birthDay:
      existingBirthday?.birthDay
        ? String(
            existingBirthday.birthDay
          )
        : "",

    notes:
      existingBirthday?.notes || "",

    /*
     * These fields belong directly to
     * LeagueBirthday in your current design.
     */
    whatsappNumber:
      existingBirthday?.whatsappNumber ||
      selectedPlayer?.whatsappNumber ||
      "",

    whatsappOptIn:
      existingBirthday
        ? Boolean(
            existingBirthday.whatsappOptIn
          )
        : Boolean(
            selectedPlayer?.whatsappOptIn
          ),
  }));

  /*
   * Existing record means the form must use
   * PATCH instead of POST.
   */
  setEditingId(
    existingBirthday?.id || null
  );

  if (existingBirthday) {
    setMessage(
      `Existing birthday details loaded for ${
        existingBirthday.name ||
        selectedPlayer?.name ||
        "the selected player"
      }.`
    );
  } else {
    setMessage("");
  }

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
async function handleBulkBirthdayImport(event) {
  event.preventDefault();

  if (!apiBaseUrl) {
    setError("Invalid league ID.");
    return;
  }

  if (!bulkFile) {
    setError(
      "Please select a birthday text file."
    );
    return;
  }

  const cleanedOwnerPhone =
    String(bulkOwnerPhone ?? "").replace(
      /\D/g,
      ""
    );

  if (
    cleanedOwnerPhone.length < 10 ||
    cleanedOwnerPhone.length > 15
  ) {
    setError(
      "Please enter the owner's WhatsApp number with country code."
    );
    return;
  }

  setBulkImporting(true);
  setBulkImportResult(null);
  setMessage("");
  setError("");

  try {
    const fileText =
      await bulkFile.text();

    const parsedRows =
      parseBirthdayImportText(fileText);

    if (parsedRows.length === 0) {
      throw new Error(
        "The selected file does not contain any birthday entries."
      );
    }

    const invalidRows =
      parsedRows.filter(
        (row) => !row.valid
      );

    const validRows =
      parsedRows.filter(
        (row) => row.valid
      );

    /*
     * Create a player lookup by normalized name.
     *
     * The players array is already deduplicated
     * for Surprise Cricket League by the earlier
     * special-case fix.
     */
    const playerLookup = new Map();

    for (const player of players) {
      const normalizedName =
        normalizeBulkPlayerName(
          player.name
        );

      if (
        normalizedName &&
        !playerLookup.has(normalizedName)
      ) {
        playerLookup.set(
          normalizedName,
          player
        );
      }
    }

    /*
     * Existing birthday lookup.
     *
     * Prefer matching by playerId. The name lookup
     * is included as a fallback for older records
     * that may not contain playerId.
     */
    const birthdayByPlayerId =
      new Map();

    const birthdayByName =
      new Map();

    for (const birthday of birthdays) {
      if (birthday.playerId) {
        birthdayByPlayerId.set(
          Number(birthday.playerId),
          birthday
        );
      }

      const normalizedName =
        normalizeBulkPlayerName(
          birthday.player?.name ||
            birthday.name
        );

      if (
        normalizedName &&
        !birthdayByName.has(
          normalizedName
        )
      ) {
        birthdayByName.set(
          normalizedName,
          birthday
        );
      }
    }

    const imported = [];
    const updated = [];
    const unmatched = [];
    const failed = [];

    /*
     * Process sequentially.
     *
     * Fifty entries are small enough for sequential
     * processing, and this avoids sending fifty
     * simultaneous database requests.
     */
    for (const row of validRows) {
      const matchedPlayer =
        playerLookup.get(
          row.normalizedPlayerName
        );

      if (!matchedPlayer) {
        unmatched.push({
          lineNumber: row.lineNumber,
          playerName: row.playerName,
          reason:
            "No matching player was found in this league.",
        });

        continue;
      }

      const existingBirthday =
        birthdayByPlayerId.get(
          Number(matchedPlayer.id)
        ) ||
        birthdayByName.get(
          row.normalizedPlayerName
        );

      const endpoint =
        existingBirthday?.id
          ? `${apiBaseUrl}/${existingBirthday.id}`
          : apiBaseUrl;

      const method =
        existingBirthday?.id
          ? "PATCH"
          : "POST";

      try {
        const response = await fetch(
          endpoint,
          {
            method,
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },

            body: JSON.stringify({
              playerId: Number(
                matchedPlayer.id
              ),

              birthMonth:
                row.birthMonth,

              birthDay:
                row.birthDay,

              /*
               * Preserve an existing private note
               * when updating.
               */
              notes:
                existingBirthday?.notes ??
                "",

              whatsappNumber:
                cleanedOwnerPhone,

              /*
               * Consent is enabled by default
               * for this bulk-owner workflow.
               */
              whatsappOptIn: true,

              /*
               * Ensure an existing disabled birthday
               * becomes active again.
               */
              isActive: true,
            }),
          }
        );

        const data =
          await readJsonResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              `Unable to ${
                existingBirthday
                  ? "update"
                  : "create"
              } birthday.`
          );
        }

        const resultEntry = {
          playerId:
            matchedPlayer.id,
          playerName:
            matchedPlayer.name,
          birthMonth:
            row.birthMonth,
          birthDay:
            row.birthDay,
        };

        if (existingBirthday) {
          updated.push(resultEntry);
        } else {
          imported.push(resultEntry);
        }
      } catch (rowError) {
        failed.push({
          lineNumber:
            row.lineNumber,
          playerName:
            row.playerName,
          reason:
            rowError instanceof Error
              ? rowError.message
              : "Unknown import error.",
        });
      }
    }

    const result = {
  totalLines: parsedRows.length,
  validLines: validRows.length,

  createdCount: imported.length,
  updatedCount: updated.length,
  unmatchedCount: unmatched.length,
  invalidCount: invalidRows.length,
  failedCount: failed.length,

  importedRows: imported,
  updatedRows: updated,
  unmatchedRows: unmatched,
  invalidRows,
  failedRows: failed,
};

    setBulkImportResult(result);

    setMessage(
  `Bulk import completed: ` +
    `${result.createdCount} created, ` +
    `${result.updatedCount} updated, ` +
    `${result.unmatchedCount} unmatched, ` +
    `${result.invalidCount} invalid, ` +
    `${result.failedCount} failed.`
);

    /*
     * Reload the birthday list so the table reflects
     * all imported and updated records.
     */
    await loadBirthdays();
  } catch (importError) {
    console.error(
      "Bulk birthday import error:",
      importError
    );

    setError(
      importError instanceof Error
        ? importError.message
        : "Unable to import birthdays."
    );
  } finally {
    setBulkImporting(false);
  }
}

async function saveWhatsAppSettings(
  event
) {
  event.preventDefault();

  if (!isValidLeagueId) {
    setWhatsAppSettingsError(
      "Invalid league ID."
    );
    return;
  }

  setSavingWhatsAppSettings(true);
  setWhatsAppSettingsMessage("");
  setWhatsAppSettingsError("");

  try {
    const normalizedNumber =
      normalizeOwnerWhatsAppNumber(
        ownerWhatsAppNumber
      );

    if (
      whatsappNotificationsEnabled &&
      !normalizedNumber
    ) {
      throw new Error(
        "Enter the owner's WhatsApp number before enabling automatic WhatsApp reminders."
      );
    }

    if (
      normalizedNumber &&
      !/^\+[1-9]\d{7,14}$/.test(
        normalizedNumber
      )
    ) {
      throw new Error(
        "Enter a valid WhatsApp number with country code, for example +16025551234."
      );
    }

    const response = await fetch(
      `/api/leagues/${numericLeagueId}/whatsapp-settings`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",
          Accept:
            "application/json",
        },

        body: JSON.stringify({
          ownerWhatsAppNumber:
            normalizedNumber ||
            null,

          whatsappNotificationsEnabled:
            Boolean(
              whatsappNotificationsEnabled
            ),
        }),
      }
    );

    const data =
      await readJsonResponse(
        response
      );

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Unable to save WhatsApp settings."
      );
    }

    setOwnerWhatsAppNumber(
      data?.league
        ?.ownerWhatsAppNumber ||
        normalizedNumber
    );

    setWhatsappNotificationsEnabled(
      Boolean(
        data?.league
          ?.whatsappNotificationsEnabled
      )
    );

    setWhatsAppSettingsMessage(
      data?.message ||
        "WhatsApp birthday settings saved successfully."
    );
  } catch (saveError) {
    console.error(
      "WhatsApp settings save error:",
      saveError
    );

    setWhatsAppSettingsError(
      saveError instanceof Error
        ? saveError.message
        : "Unable to save WhatsApp settings."
    );
  } finally {
    setSavingWhatsAppSettings(false);
  }
}

async function runBirthdayAction(birthdayId, actionName, callback) {
  try {
    setActionLoading({
      id: birthdayId,
      action: actionName,
    });

    await callback();
  } catch (error) {
    console.error(`Birthday ${actionName} failed:`, error);
  } finally {
    setActionLoading({
      id: null,
      action: null,
    });
  }
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
    className="header-action-btn"
  >
    ⬅️ Back to Dashboard
  </Link>

  <Link
    href={`/leagues/${numericLeagueId}/birthdays/today`}
    className="header-action-btn primary"
  >
    🎂 Today's Birthdays
  </Link>
</div>
      </section>
<BirthdayCollapsibleSection
  icon="💬"
  title="Owner WhatsApp Notifications"
  description="Configure automatic Twilio birthday wishes for the league owner"
  accent="whatsapp"
  className="league-whatsapp-settings-card"
  badge={
    <span
      className={
        whatsappNotificationsEnabled
          ? "status-active"
          : "status-inactive"
      }
    >
      {whatsappNotificationsEnabled
        ? "Enabled"
        : "Disabled"}
    </span>
  }
>
  <div className="birthday-section-intro">
    <p>
      Send automatic birthday wishes to the league
      owner through WhatsApp.
    </p>

    <p>
      Existing browser and device notifications remain
      active and operate independently.
    </p>
  </div>

  <form
    onSubmit={saveWhatsAppSettings}
    className="birthday-form"
  >
    <label>
      League

      <input
        type="text"
        value={
          leagueName ||
          `League ${numericLeagueId}`
        }
        disabled
      />
    </label>

    <label>
      Owner&apos;s WhatsApp number

      <input
        type="tel"
        value={ownerWhatsAppNumber}
        placeholder="+16025551234"
        autoComplete="tel"
        disabled={savingWhatsAppSettings}
        onChange={(event) => {
          setOwnerWhatsAppNumber(
            event.target.value
          );

          setWhatsAppSettingsMessage("");
          setWhatsAppSettingsError("");
        }}
      />

      <small>
        Include the country code. Examples: +1 for
        the United States or +91 for India.
      </small>
    </label>

<label
  className={`whatsapp-toggle-card ${
    whatsappNotificationsEnabled
      ? "is-enabled"
      : "is-disabled"
  }`}
>
  <span className="whatsapp-toggle-copy">
    <strong>
      💬 Automatic WhatsApp Wishes
    </strong>

    <small>
      {whatsappNotificationsEnabled
        ? "Birthday wishes will be sent automatically to the owner's WhatsApp number."
        : "Automatic WhatsApp birthday wishes are currently turned off."}
    </small>
  </span>

  <span className="whatsapp-toggle-control">
    <input
      type="checkbox"
      checked={
        whatsappNotificationsEnabled
      }
      disabled={
        savingWhatsAppSettings
      }
      onChange={(event) => {
        setWhatsappNotificationsEnabled(
          event.target.checked
        );

        setWhatsAppSettingsMessage("");
        setWhatsAppSettingsError("");
      }}
      aria-label="Enable automatic WhatsApp birthday wishes"
    />

    <span
      className="whatsapp-toggle-track"
      aria-hidden="true"
    >
      <span className="whatsapp-toggle-thumb" />
    </span>

    <span className="whatsapp-toggle-status">
      {whatsappNotificationsEnabled
        ? "ON"
        : "OFF"}
    </span>
  </span>
</label>

    <div className="birthday-notification-channel-note">
      <strong>
        🔔 Device notifications remain active
      </strong>

      <p>
        Turning this WhatsApp option on or off does
        not enable, disable, or modify browser and
        device notifications.
      </p>
    </div>

    <div className="birthday-actions">
      <button
        type="submit"
        disabled={
          savingWhatsAppSettings
        }
      >
        {savingWhatsAppSettings
          ? "Saving..."
          : "Save WhatsApp Settings"}
      </button>
    </div>
  </form>

  {whatsappSettingsMessage && (
    <p
      className="birthday-success"
      role="status"
    >
      {whatsappSettingsMessage}
    </p>
  )}

  {whatsappSettingsError && (
    <p
      className="birthday-error"
      role="alert"
    >
      {whatsappSettingsError}
    </p>
  )}
</BirthdayCollapsibleSection>

<BirthdayCollapsibleSection
  key={birthdayFormSectionKey}
  defaultOpen={Boolean(editingId)}
  icon={editingId ? "✏️" : "🎁"}
  title={
    editingId
      ? "Edit Birthday"
      : "Add Birthday"
  }
  description={
    editingId
      ? `Update ${form.name || "the selected player's"} birthday details`
      : "Add an individual player birthday and WhatsApp preferences"
  }
  accent="birthday"
  badge={
    editingId
      ? "Editing"
      : `${players.length} players`
  }
>

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
{form.name && editingId && (
  <p className="selected-player-name">
    Existing birthday details loaded for{" "}
    <strong>{form.name}</strong>.
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
    placeholder="Example: 12223334444"
    onChange={(event) =>
      setForm((current) => ({
        ...current,
        whatsappNumber: event.target.value.replace(/\D/g, ""),
      }))
    }
  />
</label>

<label className="whatsapp-consent-card">
    <div className="consent-text">
        <strong>
            📱 WhatsApp Consent
        </strong>

        <small>
            Player has agreed to receive birthday wishes
            through WhatsApp.
        </small>
    </div>

    <label className="switch">
        <input
            type="checkbox"
            checked={form.whatsappOptIn}
            onChange={(e) =>
                setForm((current) => ({
                    ...current,
                    whatsappOptIn: e.target.checked,
                }))
            }
        />

        <span className="slider"></span>
    </label>
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
      </BirthdayCollapsibleSection>
<BirthdayCollapsibleSection
  icon="📥"
  title="Bulk Birthday Import"
  description="Upload multiple player birthdays from one text file"
  accent="bulk"
  className="birthday-bulk-import-card"
  badge={
    bulkFile
      ? "File selected"
      : "TXT upload"
  }
>

  <form
    onSubmit={handleBulkBirthdayImport}
    className="birthday-form"
  >
    <label>
      Birthday text file

      <input
        type="file"
        accept=".txt,text/plain"
        required
        disabled={bulkImporting}
        onChange={(event) => {
          const selectedFile =
            event.target.files?.[0] ??
            null;

          setBulkFile(selectedFile);
          setBulkImportResult(null);
          setMessage("");
          setError("");
        }}
      />
    </label>

    <div className="birthday-import-example">
      <strong>Required format:</strong>

      <pre>{`Virat K - Jan 01
Dhoni - Dec 24
Rohit S - Feb 26`}</pre>
    </div>

    <label>
      Owner&apos;s WhatsApp number

      <input
        type="tel"
        required
        value={bulkOwnerPhone}
        placeholder="Example: 16105551234"
        disabled={bulkImporting}
        onChange={(event) =>
          setBulkOwnerPhone(
            event.target.value.replace(
              /\D/g,
              ""
            )
          )
        }
      />
    </label>

    <p className="birthday-import-notice">
      This number will be saved for every
      imported birthday, and WhatsApp consent
      will be enabled automatically.
    </p>

    <div className="birthday-actions">
      <button
        type="submit"
        disabled={
          bulkImporting ||
          !bulkFile ||
          !bulkOwnerPhone
        }
      >
        {bulkImporting
          ? "Importing Birthdays..."
          : "Import All Birthdays"}
      </button>
    </div>
  </form>

  {bulkImportResult && (
  <div className="birthday-import-result">
    <h3>Import results</h3>

    <div className="birthday-import-summary">
      <span>
        Created:{" "}
        <strong>
          {bulkImportResult.createdCount}
        </strong>
      </span>

      <span>
        Updated:{" "}
        <strong>
          {bulkImportResult.updatedCount}
        </strong>
      </span>

      <span>
        Unmatched:{" "}
        <strong>
          {bulkImportResult.unmatchedCount}
        </strong>
      </span>

      <span>
        Invalid:{" "}
        <strong>
          {bulkImportResult.invalidCount}
        </strong>
      </span>

      <span>
        Failed:{" "}
        <strong>
          {bulkImportResult.failedCount}
        </strong>
      </span>
    </div>

    {bulkImportResult.unmatchedRows.length > 0 && (
      <div className="birthday-import-errors">
        <h4>Players not found</h4>

        <ul>
          {bulkImportResult.unmatchedRows.map(
            (item) => (
              <li
                key={`unmatched-${item.lineNumber}-${item.playerName}`}
              >
                Line {item.lineNumber}:{" "}
                <strong>
                  {item.playerName}
                </strong>
                {" — "}
                {item.reason}
              </li>
            )
          )}
        </ul>
      </div>
    )}

    {bulkImportResult.invalidRows.length > 0 && (
      <div className="birthday-import-errors">
        <h4>Invalid lines</h4>

        <ul>
          {bulkImportResult.invalidRows.map(
            (item) => (
              <li
                key={`invalid-${item.lineNumber}`}
              >
                Line {item.lineNumber}:{" "}
                {item.originalLine}
                {" — "}
                {item.error}
              </li>
            )
          )}
        </ul>
      </div>
    )}

    {bulkImportResult.failedRows.length > 0 && (
      <div className="birthday-import-errors">
        <h4>Failed imports</h4>

        <ul>
          {bulkImportResult.failedRows.map(
            (item) => (
              <li
                key={`failed-${item.lineNumber}-${item.playerName}`}
              >
                Line {item.lineNumber}:{" "}
                <strong>
                  {item.playerName}
                </strong>
                {" — "}
                {item.reason}
              </li>
            )
          )}
        </ul>
      </div>
    )}

    {bulkImportResult.createdCount > 0 && (
      <div className="birthday-import-success-list">
        <h4>Created birthdays</h4>

        <ul>
          {bulkImportResult.importedRows.map(
            (item) => (
              <li
                key={`created-${item.playerId}`}
              >
                {item.playerName} —{" "}
                {formatMMDD(
                  item.birthMonth,
                  item.birthDay
                )}
              </li>
            )
          )}
        </ul>
      </div>
    )}

    {bulkImportResult.updatedCount > 0 && (
      <div className="birthday-import-success-list">
        <h4>Updated birthdays</h4>

        <ul>
          {bulkImportResult.updatedRows.map(
            (item) => (
              <li
                key={`updated-${item.playerId}`}
              >
                {item.playerName} —{" "}
                {formatMMDD(
                  item.birthMonth,
                  item.birthDay
                )}
              </li>
            )
          )}
        </ul>
      </div>
    )}
  </div>
)}
</BirthdayCollapsibleSection> 
<BirthdayCollapsibleSection
  icon="📅"
  title="League Birthday List"
  description="View, edit, share, enable, disable, or delete birthday records"
  accent="list"
  badge={
    loading
      ? "Loading..."
      : `${birthdays.length} ${
          birthdays.length === 1
            ? "entry"
            : "entries"
        }`
  }
>

        {loading ? (
          <p>Loading birthdays...</p>
        ) : birthdays.length === 0 ? (
          <p>
            No birthdays have been added to this league.
          </p>
        ) : (
          <><div className="birthday-swipe-hint">
                <span>🎂 Swipe to browse birthdays</span>
                <span aria-hidden="true">→</span>
              </div><div className="birthday-table-wrapper">
                  <table className="birthday-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Birthday</th>
                        <th>Status</th>
                        <th className="birthday-actions-heading">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {birthdays.map((birthday) => {
                        const isWorking = workingId === birthday.id;

                        return (
                          <tr key={birthday.id}>
                            <td data-label="Name">
                              {birthday.name}
                            </td>

                            <td data-label="Birthday">
                              {formatMMDD(
                                birthday.birthMonth,
                                birthday.birthDay
                              )}
                            </td>

                            <td data-label="Status">
                              <span
                                className={birthday.isActive
                                  ? "status-active"
                                  : "status-inactive"}
                              >
                                {birthday.isActive
                                  ? "Active"
                                  : "Disabled"}
                              </span>
                            </td>
<td className="birthday-actions-cell">
  <div className="birthday-actions">
    <button
      type="button"
      className="birthday-action-btn birthday-edit-btn"
      onClick={() =>
        runBirthdayAction(birthday.id, "edit", () =>
          startEditing(birthday)
        )
      }
      disabled={
        actionLoading.id === birthday.id &&
        actionLoading.action === "edit"
      }
      title={`Edit ${birthday.name}`}
      aria-label={`Edit birthday details for ${birthday.name}`}
    >
      {actionLoading.id === birthday.id &&
      actionLoading.action === "edit" ? (
        <LoaderCircle
          size={17}
          strokeWidth={2.2}
          className="birthday-btn-spinner"
        />
      ) : (
        <Pencil size={17} strokeWidth={2.2} />
      )}

      <span>Edit</span>
    </button>

    <button
      type="button"
      className="birthday-action-btn birthday-whatsapp-btn"
      onClick={() =>
        runBirthdayAction(birthday.id, "whatsapp", () =>
          shareBirthdayToWhatsApp(birthday)
        )
      }
      disabled={
        actionLoading.id === birthday.id &&
        actionLoading.action === "whatsapp"
      }
      title={`Share ${birthday.name}'s birthday to WhatsApp`}
      aria-label={`Share ${birthday.name}'s birthday to WhatsApp group`}
    >
      {actionLoading.id === birthday.id &&
      actionLoading.action === "whatsapp" ? (
        <LoaderCircle
          size={18}
          strokeWidth={2.2}
          className="birthday-btn-spinner"
        />
      ) : (
        <MessageCircle size={18} strokeWidth={2.2} />
      )}

      <span className="birthday-whatsapp-long-text">
        Share to WhatsApp Group
      </span>

      <span className="birthday-whatsapp-short-text">
        WhatsApp
      </span>
    </button>

    <button
      type="button"
      className={`birthday-action-btn ${
        birthday.isActive
          ? "birthday-disable-btn"
          : "birthday-enable-btn"
      }`}
      onClick={() =>
        runBirthdayAction(
          birthday.id,
          birthday.isActive ? "disable" : "enable",
          () => toggleBirthday(birthday)
        )
      }
      disabled={
        actionLoading.id === birthday.id &&
        ["disable", "enable"].includes(actionLoading.action)
      }
      title={
        birthday.isActive
          ? `Disable birthday reminders for ${birthday.name}`
          : `Enable birthday reminders for ${birthday.name}`
      }
      aria-label={
        birthday.isActive
          ? `Disable birthday reminders for ${birthday.name}`
          : `Enable birthday reminders for ${birthday.name}`
      }
    >
      {actionLoading.id === birthday.id &&
      ["disable", "enable"].includes(actionLoading.action) ? (
        <LoaderCircle
          size={17}
          strokeWidth={2.2}
          className="birthday-btn-spinner"
        />
      ) : birthday.isActive ? (
        <PauseCircle size={17} strokeWidth={2.2} />
      ) : (
        <PlayCircle size={17} strokeWidth={2.2} />
      )}

      <span>{birthday.isActive ? "Disable" : "Enable"}</span>
    </button>

    <button
      type="button"
      className="birthday-action-btn birthday-delete-btn"
      onClick={() =>
        runBirthdayAction(birthday.id, "delete", () =>
          deleteBirthday(birthday)
        )
      }
      disabled={
        actionLoading.id === birthday.id &&
        actionLoading.action === "delete"
      }
      title={`Delete ${birthday.name}`}
      aria-label={`Delete birthday entry for ${birthday.name}`}
    >
      {actionLoading.id === birthday.id &&
      actionLoading.action === "delete" ? (
        <LoaderCircle
          size={17}
          strokeWidth={2.2}
          className="birthday-btn-spinner"
        />
      ) : (
        <Trash2 size={17} strokeWidth={2.2} />
      )}

      <span>Delete</span>
    </button>
  </div>
</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div></>
        )}
      </BirthdayCollapsibleSection>
    </main>
  );
}