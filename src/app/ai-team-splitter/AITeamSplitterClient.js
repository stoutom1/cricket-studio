"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { suggestCaptainsForTeam } from "@/lib/captainSuggestions";

const STEPS = [
  { id: "SOURCE", label: "Players", icon: "1" },
  { id: "AVAILABILITY", label: "Availability", icon: "2" },
  { id: "BUILD", label: "Build", icon: "3" },
  { id: "RESULTS", label: "Results", icon: "4" },
];

function normalizeName(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function numberOrZero(value) {
  if (value === "Not out") return 50;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mergeStatsIntoPlayers(players, stats) {
  const maps = {
    batting: new Map(),
    bowling: new Map(),
    fielding: new Map(),
    wicketkeeping: new Map(),
    captaincy: new Map(),
  };

  for (const key of Object.keys(maps)) {
    for (const row of stats?.[key] || []) {
      maps[key].set(normalizeName(row.playerName), row);
    }
  }

  return players.map((player) => {
    const key = normalizeName(player.playerName || player.name);
    const bat = maps.batting.get(key);
    const bowl = maps.bowling.get(key);
    const field = maps.fielding.get(key);
    const keeper = maps.wicketkeeping.get(key);
    const captain = maps.captaincy.get(key);
    const played = Number(captain?.played || 0);

    return {
      ...player,
      playerKey: player.playerKey || player.id,
      playerName: player.playerName || player.name,
      runs: Number(bat?.runs || 0),
      average: numberOrZero(bat?.average),
      strikeRate: numberOrZero(bat?.strikeRate),
      wickets: Number(bowl?.wickets || 0),
      economy: bowl?.economy ? Number(bowl.economy) : 12,
      catches: Number(field?.catches || 0),
      runOuts: Number(field?.runOuts || 0),
      stumpings: Number(field?.stumpings || 0),
      dismissals: Number(keeper?.dismissals || 0),
      matches: Number(bat?.matches || bowl?.matches || 0),
      winPct: played ? (Number(captain?.won || 0) / played) * 100 : 0,
    };
  });
}

function statusKey(value) {
  return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function formatDate(value) {
  if (!value) return "Date not set";
  return new Date(value).toLocaleString();
}

function playerIdentity(player) {
  return String(player?.playerKey ?? player?.id ?? normalizeName(player?.playerName));
}

function matchDisplayName(match) {
  const teamA = match?.teamAName || match?.teamA?.name || "Team A";
  const teamB = match?.teamBName || match?.teamB?.name || "Team B";
  return `${teamA} vs ${teamB}`;
}

function sameMinute(first, second) {
  if (!first || !second) return false;
  const a = new Date(first);
  const b = new Date(second);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return Math.abs(a.getTime() - b.getTime()) < 60 * 1000;
}

function pollMatchesScheduledMatch(item, match) {
  if (!item || !match) return false;
  const titleMatches =
    normalizeName(item.title) === normalizeName(matchDisplayName(match));
  const dateMatches = (item.options || []).some((option) =>
    sameMinute(option.startTime, match.scheduledAt)
  );
  return titleMatches || dateMatches;
}

export default function AITeamSplitterClient() {
  const searchParams = useSearchParams();
  const requestedLeagueId = Number(searchParams.get("leagueId"));
  const uploadRef = useRef(null);
  const pollComboRef = useRef(null);

  const [activeStep, setActiveStep] = useState("SOURCE");
  const [sourceMode, setSourceMode] = useState("MATCH");
  const [leagueId, setLeagueId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [poll, setPoll] = useState(null);
  const [allPolls, setAllPolls] = useState([]);
  const [pollResponses, setPollResponses] = useState([]);
  const [pollTitle, setPollTitle] = useState("Match Availability");
  const [pollText, setPollText] = useState("Please confirm your availability for this match.");
  const [pollOptions, setPollOptions] = useState([{ label: "Match Date", startTime: "" }]);

  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");
  const [result, setResult] = useState(null);
  const [captains, setCaptains] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [screenshotImport, setScreenshotImport] = useState(null);
  const [showAllPolls, setShowAllPolls] = useState(false);
  const [pollCenterOpen, setPollCenterOpen] = useState(false);
  const [availabilitySetupCollapsed, setAvailabilitySetupCollapsed] = useState(false);
  const [showAdHocPollForm, setShowAdHocPollForm] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(requestedLeagueId) || requestedLeagueId <= 0) {
      setLoading(false);
      return;
    }
    setLeagueId(requestedLeagueId);
    loadInitial(requestedLeagueId);
  }, [requestedLeagueId]);

  useEffect(() => {
    if (!poll?.token) return;
    refreshPoll();
    const timer = setInterval(refreshPoll, 10000);
    return () => clearInterval(timer);
  }, [poll?.token]);

  const selectedPlayers = useMemo(() => {
    const ids = new Set(selectedIds.map(String));
    return players.filter((player) => ids.has(String(player.id)));
  }, [players, selectedIds]);

  const filteredPlayers = useMemo(() => {
    const query = normalizeName(search);
    if (!query) return players;
    return players.filter((player) =>
      normalizeName(`${player.playerName} ${(player.sourceTeams || []).join(" ")}`).includes(query)
    );
  }, [players, search]);

  const selectedMatch = useMemo(
    () => matches.find((match) => String(match.id) === String(selectedMatchId)) || null,
    [matches, selectedMatchId]
  );

  const scheduledMatchesWithoutPoll = useMemo(
    () =>
      matches.filter(
        (match) =>
          !allPolls.some((item) => pollMatchesScheduledMatch(item, match))
      ),
    [matches, allPolls]
  );

  const pollGroups = useMemo(() => {
    return (poll?.options || []).map((option) => {
      const responses = pollResponses.filter(
        (response) => Number(response.optionId) === Number(option.id)
      );
      return {
        option,
        yes: responses.filter((response) => response.response === "YES"),
        maybe: responses.filter((response) => response.response === "MAYBE"),
        no: responses.filter((response) => response.response === "NO"),
      };
    });
  }, [poll, pollResponses]);

  const bestPollGroup = useMemo(() => {
    return [...pollGroups].sort((a, b) => b.yes.length - a.yes.length)[0] || null;
  }, [pollGroups]);


  function pollSummary(item) {
    const responses = item?.responses || [];
    const optionIds = new Set((item?.options || []).map((option) => Number(option.id)));
    const valid = optionIds.size
      ? responses.filter((response) => optionIds.has(Number(response.optionId)))
      : responses;

    return {
      yes: valid.filter((response) => response.response === "YES").length,
      maybe: valid.filter((response) => response.response === "MAYBE").length,
      no: valid.filter((response) => response.response === "NO").length,
      total: valid.length,
    };
  }

  function openPoll(item, goToAvailability = false) {
    if (pollComboRef.current) pollComboRef.current.open = false;
    setPoll(item);
    setPollResponses(item?.responses || []);
    setSourceMode("POLL");
    setSelectedMatchId("");
    setAvailabilitySetupCollapsed(true);
    setShowAdHocPollForm(false);
    if (goToAvailability) setActiveStep("AVAILABILITY");
  }

  function changeSourceMode(nextMode) {
    setSourceMode(nextMode);
    setMessage("");
    setAvailabilitySetupCollapsed(false);
    setShowAdHocPollForm(false);

    if (nextMode !== "MATCH") {
      setSelectedMatchId("");
    }

    if (nextMode === "POLL") {
      setPollCenterOpen(true);
    }
  }

  async function loadInitial(targetLeagueId) {
    setLoading(true);
    try {
      const [playerRes, statsRes, matchRes, pollsRes] = await Promise.all([
        fetch(`/api/ai-team-splitter/players?leagueId=${targetLeagueId}`),
        fetch(`/api/leagues/${targetLeagueId}/stats`),
        fetch(`/api/matches?leagueId=${targetLeagueId}`),
        fetch(`/api/team-availability-poll/list?leagueId=${targetLeagueId}`),
      ]);

      const [playerData, statsData, matchData, pollsData] = await Promise.all([
        playerRes.json(), statsRes.json(), matchRes.json(), pollsRes.json(),
      ]);

      if (!playerRes.ok) throw new Error(playerData.error || "Failed to load players.");
      if (!statsRes.ok) throw new Error(statsData.error || "Failed to load statistics.");

      const merged = mergeStatsIntoPlayers(playerData.players || [], statsData);
      setPlayers(merged);
      setSelectedIds(merged.map((player) => player.id));
      setTeams(playerData.teams || []);
      setSelectedTeamIds((playerData.teams || []).map((team) => Number(team.id)));
      setMatches((Array.isArray(matchData) ? matchData : []).filter((match) => statusKey(match.status) === "SCHEDULED"));
      setAllPolls(pollsData.polls || []);

      const latest = (pollsData.polls || [])[0];
      if (latest) {
        setPoll(latest);
        setPollResponses(latest.responses || []);
      }
    } catch (error) {
      setMessage(error.message || "Failed to load Team Builder.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayersForTeams(nextTeamIds) {
    setWorking(true);
    try {
      const query = nextTeamIds.length ? `&teamIds=${nextTeamIds.join(",")}` : "";
      const [playerRes, statsRes] = await Promise.all([
        fetch(`/api/ai-team-splitter/players?leagueId=${leagueId}${query}`),
        fetch(`/api/leagues/${leagueId}/stats`),
      ]);
      const [playerData, statsData] = await Promise.all([playerRes.json(), statsRes.json()]);
      if (!playerRes.ok) throw new Error(playerData.error || "Failed to load players.");
      if (!statsRes.ok) throw new Error(statsData.error || "Failed to load statistics.");
      const merged = mergeStatsIntoPlayers(playerData.players || [], statsData);
      setPlayers(merged);
      setSelectedIds(merged.map((player) => player.id));
      setResult(null);
      setCaptains(null);
    } catch (error) {
      setMessage(error.message || "Failed to update player pools.");
    } finally {
      setWorking(false);
    }
  }

  function chooseMatch(matchId) {
    setSelectedMatchId(matchId);
    const match = matches.find((item) => String(item.id) === String(matchId));
    if (!match) return;
    const ids = [Number(match.teamAId), Number(match.teamBId)].filter(Boolean);
    setSelectedTeamIds(ids);
    setTeamAName(match.teamAName || match.teamA?.name || "Team A");
    setTeamBName(match.teamBName || match.teamB?.name || "Team B");
    setPollTitle(matchDisplayName(match));
    setPollText("Please confirm your availability for the scheduled match.");
    setPollOptions([{ label: "Scheduled Match", startTime: match.scheduledAt || "" }]);
    setAvailabilitySetupCollapsed(false);
    setShowAdHocPollForm(false);
    loadPlayersForTeams(ids);
  }

  function togglePool(teamId) {
    const number = Number(teamId);
    const next = selectedTeamIds.includes(number)
      ? selectedTeamIds.filter((id) => id !== number)
      : [...selectedTeamIds, number];
    setSelectedTeamIds(next);
    loadPlayersForTeams(next);
  }

  function togglePlayer(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
    setResult(null);
    setCaptains(null);
  }

  function continueFromSource() {
    setMessage("");
    setActiveStep("BUILD");
  }

  function prepareScheduledMatchPoll() {
    if (!selectedMatch) {
      setMessage("Select a scheduled match first.");
      setSourceMode("MATCH");
      setActiveStep("SOURCE");
      return;
    }

    // chooseMatch already pre-fills the poll title, message, teams, and date.
    // This action simply takes the captain to the final review/create screen.
    setPollCenterOpen(true);
    setAvailabilitySetupCollapsed(false);
    setActiveStep("AVAILABILITY");
  }

  function prepareNewPoll() {
    setSourceMode("POLL");
    setSelectedMatchId("");
    setPollTitle("Match Availability");
    setPollText("Please confirm your availability for this match.");
    setPollOptions([{ label: "Match Date", startTime: "" }]);
    setPollCenterOpen(true);
    setShowAdHocPollForm(true);
    setAvailabilitySetupCollapsed(false);
    setActiveStep("AVAILABILITY");
  }

  function createPollForScheduledMatch(match) {
    if (!match) return;
    const ids = [Number(match.teamAId), Number(match.teamBId)].filter(Boolean);
    setSourceMode("MATCH");
    setSelectedMatchId(String(match.id));
    setSelectedTeamIds(ids);
    setTeamAName(match.teamAName || match.teamA?.name || "Team A");
    setTeamBName(match.teamBName || match.teamB?.name || "Team B");
    setPollTitle(matchDisplayName(match));
    setPollText("Please confirm your availability for the scheduled match.");
    setPollOptions([
      { label: "Scheduled Match", startTime: match.scheduledAt || "" },
    ]);
    setShowAdHocPollForm(false);
    setAvailabilitySetupCollapsed(false);
    setPollCenterOpen(true);
    setActiveStep("AVAILABILITY");
    loadPlayersForTeams(ids);
  }

  function goToPreviousWorkspaceStep() {
    const currentIndex = STEPS.findIndex((item) => item.id === activeStep);
    const previous = STEPS[Math.max(0, currentIndex - 1)];
    setActiveStep(previous.id);
  }

  function buildPollWhatsAppUrl(pollToShare) {
    const url = `${window.location.origin}/team-poll/${pollToShare.token}`;
    const text = `🏏 ${pollToShare.title}\n\n${pollToShare.matchText || "Please confirm your availability."}\n\nVote here:\n${url}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  async function createPoll({ shareAfterCreate = false } = {}) {
    const cleanOptions = pollOptions.filter((option) => option.label.trim() || option.startTime);
    if (!cleanOptions.length || !selectedTeamIds.length) {
      setMessage("Choose player pools and add at least one match option.");
      return;
    }
    // Open the WhatsApp tab during the user's click so browsers do not block it
    // after the asynchronous API request finishes.
    const whatsappWindow = shareAfterCreate
      ? window.open("about:blank", "_blank")
      : null;

    setWorking(true);
    try {
      const response = await fetch("/api/team-availability-poll/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          title: pollTitle,
          matchText: pollText,
          options: cleanOptions,
          sourceTeamIds: selectedTeamIds,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create poll.");
      setPoll(data.poll);
      setPollResponses(data.poll?.responses || []);
      setAllPolls((current) => [data.poll, ...current.filter((item) => item.token !== data.poll.token)]);
      setPollCenterOpen(true);
      setAvailabilitySetupCollapsed(true);
      setShowAdHocPollForm(false);

      if (shareAfterCreate) {
        const whatsappUrl = buildPollWhatsAppUrl(data.poll);
        if (whatsappWindow) {
          whatsappWindow.location.href = whatsappUrl;
        } else {
          window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        }
        setMessage("Poll created. WhatsApp is ready for you to choose the group and send it.");
      } else {
        setMessage("Poll created. Share it to your WhatsApp group.");
      }
    } catch (error) {
      if (whatsappWindow) whatsappWindow.close();
      setMessage(error.message || "Failed to create poll.");
    } finally {
      setWorking(false);
    }
  }

  async function refreshPoll() {
    if (!poll?.token) return;
    try {
      const response = await fetch(`/api/team-availability-poll/${poll.token}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to refresh poll.");
      setPoll(data.poll);
      setPollResponses(data.poll?.responses || []);

      // Keep the compact Existing Polls cards synchronized with the
      // auto-refreshed live poll. Without this update, the Live Poll
      // section changes immediately but the poll summary card remains
      // stale until the entire browser page is refreshed.
      setAllPolls((current) => {
        const refreshedPoll = data.poll;
        const exists = current.some(
          (item) => String(item.token) === String(refreshedPoll.token)
        );

        if (!exists) {
          return [refreshedPoll, ...current];
        }

        return current.map((item) =>
          String(item.token) === String(refreshedPoll.token)
            ? refreshedPoll
            : item
        );
      });
    } catch (error) {
      setMessage(error.message || "Failed to refresh poll.");
    }
  }

  function sharePoll() {
    if (!poll?.token) return;
    window.open(buildPollWhatsAppUrl(poll), "_blank", "noopener,noreferrer");
  }

  async function copyPollLink() {
    if (!poll?.token) return;
    const url = `${window.location.origin}/team-poll/${poll.token}`;
    await navigator.clipboard.writeText(url);
    setMessage("Poll link copied.");
  }

  async function usePollPlayers(group = bestPollGroup) {
    if (!group?.yes?.length) {
      setMessage("No YES responses are available yet.");
      return;
    }

    setWorking(true);

    try {
      // The Players tab may currently contain a different team pool. Reload the
      // poll's source teams (or the whole league as a safe fallback) before
      // resolving YES responses so confirmed players are never silently lost.
      const pollTeamIds = [
        ...(Array.isArray(poll?.sourceTeamIds) ? poll.sourceTeamIds : []),
        ...(Array.isArray(poll?.teamIds) ? poll.teamIds : []),
        ...(Array.isArray(poll?.sourceTeams)
          ? poll.sourceTeams.map((team) => team?.teamId ?? team?.id)
          : []),
      ]
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0);

      const uniqueTeamIds = [...new Set(pollTeamIds)];
      const teamQuery = uniqueTeamIds.length
        ? `&teamIds=${uniqueTeamIds.join(",")}`
        : "";

      const [playerRes, statsRes] = await Promise.all([
        fetch(`/api/ai-team-splitter/players?leagueId=${leagueId}${teamQuery}`),
        fetch(`/api/leagues/${leagueId}/stats`),
      ]);

      const [playerData, statsData] = await Promise.all([
        playerRes.json(),
        statsRes.json(),
      ]);

      if (!playerRes.ok) {
        throw new Error(playerData.error || "Failed to load poll players.");
      }
      if (!statsRes.ok) {
        throw new Error(statsData.error || "Failed to load player statistics.");
      }

      const pollPlayers = mergeStatsIntoPlayers(playerData.players || [], statsData);

      const confirmedKeys = new Set();
      const confirmedNames = new Set();

      for (const response of group.yes) {
        const keyCandidates = [
          response?.playerKey,
          response?.playerId,
          response?.id,
        ];

        for (const key of keyCandidates) {
          if (key !== undefined && key !== null && String(key).trim()) {
            confirmedKeys.add(String(key));
          }
        }

        const responseName = normalizeName(
          response?.playerName || response?.name || response?.displayName
        );
        if (responseName) confirmedNames.add(responseName);
      }

      const confirmedPlayers = pollPlayers.filter((player) => {
        const playerKeys = [
          player?.playerKey,
          player?.id,
          player?.playerId,
        ]
          .filter((value) => value !== undefined && value !== null)
          .map(String);

        const keyMatches = playerKeys.some((key) => confirmedKeys.has(key));
        const nameMatches = confirmedNames.has(normalizeName(player?.playerName || player?.name));
        return keyMatches || nameMatches;
      });

      const confirmedIds = [...new Set(confirmedPlayers.map((player) => player.id))];
      const unmatchedCount = Math.max(0, group.yes.length - confirmedIds.length);

      setPlayers(pollPlayers);
      if (uniqueTeamIds.length) setSelectedTeamIds(uniqueTeamIds);
      setSelectedIds(confirmedIds);
      setResult(null);
      setCaptains(null);
      setSourceMode("POLL");
      setActiveStep("BUILD");

      if (!confirmedIds.length) {
        setMessage(
          "The YES responses could not be matched to current league players. Check whether those players were deleted or renamed."
        );
        return;
      }

      setMessage(
        unmatchedCount
          ? `${confirmedIds.length} confirmed players selected. ${unmatchedCount} YES response${unmatchedCount === 1 ? " was" : "s were"} not matched to a current league player.`
          : `${confirmedIds.length} YES players selected from ${group.option.label}. The Players and Build workspaces now use only these confirmed players.`
      );
    } catch (error) {
      setMessage(error.message || "Failed to select confirmed players.");
    } finally {
      setWorking(false);
    }
  }

  async function deletePoll(token) {
    if (!window.confirm("Delete this poll and all responses?")) return;
    const response = await fetch(`/api/team-availability-poll/${token}/delete`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Failed to delete poll.");
      return;
    }
    setAllPolls((current) => current.filter((item) => item.token !== token));
    if (poll?.token === token) {
      setPoll(null);
      setPollResponses([]);
    }
  }

  async function importPlayers(file) {
    if (!file) return;

    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);
    setWorking(true);
    setScreenshotImport(null);
    setImportSummary(null);

    try {
      let fileForMatching = file;
      let detectedScreenshot = null;

      if (isImage) {
        const screenshotForm = new FormData();
        screenshotForm.append("file", file);

        const screenshotResponse = await fetch(
          "/api/ai-team-splitter/import-screenshot",
          { method: "POST", body: screenshotForm }
        );
        const screenshotData = await screenshotResponse.json();

        if (!screenshotResponse.ok) {
          throw new Error(
            screenshotData.error || "Failed to read the uploaded screenshot."
          );
        }

        const extractedNames = [
          ...(screenshotData.teams || []).flatMap((team) => team.players || []),
          ...(screenshotData.unassignedPlayers || []),
        ]
          .map((name) => String(name || "").trim())
          .filter(Boolean);

        const uniqueNames = [...new Map(
          extractedNames.map((name) => [normalizeName(name), name])
        ).values()];

        if (!uniqueNames.length) {
          throw new Error(
            "No player names were detected. Try a clearer screenshot with visible team headings and player names."
          );
        }

        fileForMatching = new File(
          [uniqueNames.join("\n")],
          `${file.name.replace(/\.[^.]+$/, "")}-players.txt`,
          { type: "text/plain" }
        );

        detectedScreenshot = {
          fileName: file.name,
          teams: screenshotData.teams || [],
          unassignedPlayers: screenshotData.unassignedPlayers || [],
          warnings: screenshotData.warnings || [],
          detectedCount: uniqueNames.length,
        };
      }

      const formData = new FormData();
      formData.append("file", fileForMatching);
      formData.append("leagueId", String(leagueId));
      formData.append("teamIds", selectedTeamIds.join(","));

      const response = await fetch("/api/ai-team-splitter/import", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to import players.");

      const currentByKey = new Map(
        players.map((player) => [normalizeName(player.playerName), player])
      );
      const merged = (data.matchedPlayers || []).map((player) =>
        currentByKey.get(normalizeName(player.playerName)) || player
      );

      setPlayers(merged);
      setSelectedIds(merged.map((player) => player.id));
      setImportSummary(data.summary || null);
      setScreenshotImport(detectedScreenshot);
      setResult(null);
      setCaptains(null);
      setSearch("");
      setSourceMode("UPLOAD");
      setMessage(
        isImage
          ? `${merged.length} league players matched from ${detectedScreenshot.detectedCount} names detected in ${file.name}.`
          : `${merged.length} players matched from ${file.name}.`
      );
    } catch (error) {
      setMessage(error.message || "Failed to import players.");
    } finally {
      setWorking(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  async function generateTeams() {
    if (selectedPlayers.length < 4) {
      setMessage("Select at least four players.");
      return;
    }
    setWorking(true);
    try {
      const response = await fetch("/api/ai-team-splitter/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: selectedPlayers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to balance teams.");
      setResult(data);
      setCaptains({
        teamA: suggestCaptainsForTeam(data.teamA || []),
        teamB: suggestCaptainsForTeam(data.teamB || []),
      });
      setActiveStep("RESULTS");
    } catch (error) {
      setMessage(error.message || "Failed to balance teams.");
    } finally {
      setWorking(false);
    }
  }

  function shareTeams() {
    if (!result) return;
    const formatTeam = (name, list, suggestions) => {
      const captain = suggestions?.[0]?.playerName || "To be decided";
      const backup = suggestions?.[1]?.playerName || "To be decided";
      return `*${name}*\n👑 Captain: ${captain}\n⭐ Backup: ${backup}\n${list
        .map((player, index) => `${index + 1}. ${player.playerName}`)
        .join("\n")}`;
    };
    const text = `🏏 *Cric4All Balanced Teams*\n\n${formatTeam(teamAName, result.teamA || [], captains?.teamA)}\n\n${formatTeam(teamBName, result.teamB || [], captains?.teamB)}\n\n⚖️ Balance quality: ${result.balanceQuality}%`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function copyTeams() {
    if (!result) return;
    const text = [
      `${teamAName}:`,
      ...(result.teamA || []).map((player, index) => `${index + 1}. ${player.playerName}`),
      "",
      `${teamBName}:`,
      ...(result.teamB || []).map((player, index) => `${index + 1}. ${player.playerName}`),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setMessage("Team list copied.");
  }

  function renderBalanceAction({ showReview = false, label = "Generate Balanced Teams" } = {}) {
    const canBalance = selectedPlayers.length >= 4 && !working;
    const teamOneSize = Math.ceil(selectedPlayers.length / 2);
    const teamTwoSize = Math.floor(selectedPlayers.length / 2);

    return (
      <div className="c4tb-balance-action" role="region" aria-label="Generate balanced teams">
        <div className="c4tb-balance-action-copy">
          <span>{canBalance ? "Ready to balance" : "Player selection required"}</span>
          <strong>{selectedPlayers.length} selected player{selectedPlayers.length === 1 ? "" : "s"}</strong>
          <small>
            {selectedPlayers.length >= 4
              ? `Teams will be split ${teamOneSize} and ${teamTwoSize}. Availability polls are optional.`
              : `Select ${4 - selectedPlayers.length} more player${4 - selectedPlayers.length === 1 ? "" : "s"} to enable balancing.`}
          </small>
        </div>
        <div className="c4tb-balance-action-buttons">
          {showReview && (
            <button type="button" className="secondary" onClick={continueFromSource} disabled={working}>
              Review Players
            </button>
          )}
          <button type="button" className="primary" onClick={generateTeams} disabled={!canBalance}>
            {working ? "Balancing..." : `⚖️ ${label}`}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <main className="c4tb-page"><section className="c4tb-loading-card">Loading Team Builder...</section></main>;
  }

  if (!leagueId) {
    return <main className="c4tb-page"><section className="c4tb-loading-card">Open Team Builder from a league dashboard so a valid leagueId is included.</section></main>;
  }

  return (
    <main className="c4tb-page">
      <header className="c4tb-header">
        <div className="c4tb-header-top">
          <Link href="/dashboard" className="c4tb-back">← Dashboard</Link>
          <span className="c4tb-live-pill">Cric4All Smart Team Builder</span>
        </div>
        <div className="c4tb-title-row">
          <div>
            <p className="c4tb-eyebrow">Availability • Stats • Fair teams</p>
            <h1>AI Team Builder</h1>
            <p>Build match-ready teams from schedules, availability polls, player files, and live cricket statistics.</p>
          </div>
          <div className="c4tb-header-score">
            <strong>{selectedPlayers.length}</strong><span>players ready</span>
          </div>
        </div>
      </header>

      {message && <div className="c4tb-notice" role="status"><span>{message}</span><button onClick={() => setMessage("")}>×</button></div>}

      <section className="c4tb-premium-summary" aria-label="Team Builder summary">
        <div className="c4tb-match-banner">
          <div className="c4tb-match-banner-icon">🏏</div>
          <div className="c4tb-match-banner-copy">
            <span>{selectedMatch ? "Scheduled match" : poll ? "Availability poll" : "Team Builder workspace"}</span>
            <strong>{selectedMatch ? `${selectedMatch.teamAName} vs ${selectedMatch.teamBName}` : poll?.title || "Choose a player source"}</strong>
            <small>{selectedMatch?.scheduledAt ? formatDate(selectedMatch.scheduledAt) : selectedTeamIds.length ? `${selectedTeamIds.length} player pool${selectedTeamIds.length === 1 ? "" : "s"} selected` : "Start with a match, poll, upload, or manual selection"}</small>
          </div>
          <div className={`c4tb-status-chip ${activeStep.toLowerCase()}`}>
            <span>✨</span>
            <div><small>Status</small><strong>{activeStep === "RESULTS" ? "Teams ready" : activeStep === "BUILD" ? "Ready to balance" : activeStep === "AVAILABILITY" ? "Collecting availability" : "Choose a source"}</strong></div>
          </div>
        </div>

        <div className="c4tb-kpi-grid">
          <article>
            <span className="c4tb-kpi-icon pools">🏟️</span>
            <div><small>Player pools</small><strong>{selectedTeamIds.length}</strong><em>Selected sources</em></div>
          </article>
          <article>
            <span className="c4tb-kpi-icon players">👥</span>
            <div><small>Eligible players</small><strong>{players.length}</strong><em>Available to review</em></div>
          </article>
          <article>
            <span className="c4tb-kpi-icon selected">✅</span>
            <div><small>Selected players</small><strong>{selectedPlayers.length}</strong><em>Ready for teams</em></div>
          </article>
          <article>
            <span className="c4tb-kpi-icon responses">📊</span>
            <div><small>Poll responses</small><strong>{pollResponses.length}</strong><em>Recorded replies</em></div>
          </article>
        </div>
      </section>

      <section className={`c4tb-poll-dock ${pollCenterOpen ? "open" : "collapsed"}`} aria-label="Existing availability polls">
        <div className="c4tb-poll-dock-head">
          <button
            type="button"
            className="c4tb-poll-dock-toggle"
            aria-expanded={pollCenterOpen}
            aria-controls="c4tb-poll-center-content"
            onClick={() => setPollCenterOpen((value) => !value)}
          >
            <span className="c4tb-poll-dock-chevron">{pollCenterOpen ? "⌃" : "⌄"}</span>
            <div>
              <span>📊 Availability center</span>
              <h2>Existing polls & live responses</h2>
              <p>
                {allPolls.length} poll{allPolls.length === 1 ? "" : "s"}
                {poll ? ` • ${pollResponses.length} live response record${pollResponses.length === 1 ? "" : "s"}` : " • Expand to review responses"}
              </p>
            </div>
          </button>
          <div className="c4tb-poll-dock-actions">
            <button
              type="button"
              className="primary c4tb-on-demand-poll-button"
              onClick={prepareNewPoll}
              disabled={working}
            >
              ＋ Create Poll on Demand
            </button>

          </div>
        </div>

        <div id="c4tb-poll-center-content" className="c4tb-poll-dock-content" hidden={!pollCenterOpen}>
        {allPolls.length ? (
          allPolls.length === 1 ? (
            <div className="c4tb-poll-strip c4tb-single-poll-strip">
              {allPolls.map((item) => {
                const summary = pollSummary(item);
                const isActive = poll?.token === item.token;
                return (
                  <article key={item.token} className={isActive ? "active" : ""}>
                    <button type="button" className="c4tb-poll-open" onClick={() => openPoll(item)}>
                      <div className="c4tb-poll-row-title">
                        <span className="c4tb-poll-dot" />
                        <div>
                          <strong>{item.title}</strong>
                          <small>{new Date(item.createdAt).toLocaleDateString()} • {summary.total} recorded replies</small>
                        </div>
                      </div>
                      <div className="c4tb-poll-mini-stats">
                        <span className="yes">{summary.yes} YES</span>
                        <span className="maybe">{summary.maybe} MAYBE</span>
                        <span className="no">{summary.no} NO</span>
                      </div>
                      <b>{isActive ? "Open" : "View"} →</b>
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <details className="c4tb-poll-combo" ref={pollComboRef}>
              {(() => {
                const selectedPoll = poll || allPolls[0];
                const selectedSummary = pollSummary(selectedPoll);
                return (
                  <summary className="c4tb-poll-combo-trigger">
                    <div className="c4tb-poll-row-title">
                      <span className="c4tb-poll-dot" />
                      <div>
                        <strong>{selectedPoll.title}</strong>
                        <small>{new Date(selectedPoll.createdAt).toLocaleDateString()} • {selectedSummary.total} recorded replies</small>
                      </div>
                    </div>
                    <div className="c4tb-poll-mini-stats">
                      <span className="yes">{selectedSummary.yes} YES</span>
                      <span className="maybe">{selectedSummary.maybe} MAYBE</span>
                      <span className="no">{selectedSummary.no} NO</span>
                    </div>
                    <b>{allPolls.length} polls ▾</b>
                  </summary>
                );
              })()}
              <div className="c4tb-poll-combo-menu">
                {allPolls.map((item) => {
                  const summary = pollSummary(item);
                  const isActive = poll?.token === item.token;
                  return (
                    <article key={item.token} className={isActive ? "active" : ""}>
                      <button type="button" className="c4tb-poll-open" onClick={() => openPoll(item)}>
                        <div className="c4tb-poll-row-title">
                          <span className="c4tb-poll-dot" />
                          <div>
                            <strong>{item.title}</strong>
                            <small>{new Date(item.createdAt).toLocaleDateString()} • {summary.total} recorded replies</small>
                          </div>
                        </div>
                        <div className="c4tb-poll-mini-stats">
                          <span className="yes">{summary.yes} YES</span>
                          <span className="maybe">{summary.maybe} MAYBE</span>
                          <span className="no">{summary.no} NO</span>
                        </div>
                        <b>{isActive ? "Selected" : "Open"} →</b>
                      </button>
                    </article>
                  );
                })}
              </div>
            </details>
          )
        ) : (
          <div className="c4tb-poll-dock-empty">
            {selectedMatch
              ? `No poll exists yet for ${selectedMatch.teamAName || selectedMatch.teamA?.name} vs ${selectedMatch.teamBName || selectedMatch.teamB?.name}. Complete Step 2 below to create and share one.`
              : "No availability polls yet. Use Create Poll on Demand above, or choose a scheduled match below."}
          </div>
        )}

        {poll && (
          <div className="c4tb-poll-drawer">
            <div className="c4tb-poll-drawer-head">
              <div>
                <span>Live poll</span>
                <h3>{poll.title}</h3>
                <p>{pollResponses.length} response records • auto-refreshes every 10 seconds</p>
              </div>
              <div>
                <button type="button" onClick={sharePoll}>📲 WhatsApp</button>
                <button type="button" onClick={copyPollLink}>Copy Link</button>
                <button type="button" onClick={refreshPoll}>↻ Refresh</button>
                <button type="button" className="danger" onClick={() => deletePoll(poll.token)}>Delete</button>
              </div>
            </div>

            <div className="c4tb-poll-drawer-grid">
              {pollGroups.map((group) => (
                <article key={group.option.id} className={bestPollGroup?.option?.id === group.option.id ? "best" : ""}>
                  <div className="c4tb-poll-option-head">
                    <div><strong>{group.option.label}</strong><small>{formatDate(group.option.startTime)}</small></div>
                    {bestPollGroup?.option?.id === group.option.id && <b>⭐ Best option</b>}
                  </div>
                  <div className="c4tb-poll-response-cards">
                    <span className="yes"><small>YES</small><strong>{group.yes.length}</strong></span>
                    <span className="maybe"><small>MAYBE</small><strong>{group.maybe.length}</strong></span>
                    <span className="no"><small>NO</small><strong>{group.no.length}</strong></span>
                  </div>
                  <div className="c4tb-poll-player-preview">
                    {group.yes.length ? group.yes.slice(0, 6).map((response) => <span key={response.playerKey}>{response.playerName}</span>) : <em>No confirmed players yet</em>}
                    {group.yes.length > 6 && <span>+{group.yes.length - 6}</span>}
                  </div>
                  <button type="button" className="c4tb-use-yes" disabled={group.yes.length < 4} onClick={() => usePollPlayers(group)}>
                    Use {group.yes.length} YES Players →
                  </button>
                </article>
              ))}
            </div>

            <div className="c4tb-assistant-strip">
              <span className="c4tb-assistant-icon" aria-hidden="true">🤖</span>
              <div className="c4tb-assistant-copy">
                <strong>Match Assistant</strong>
                <small>
                  {bestPollGroup?.yes?.length >= 4
                    ? `${bestPollGroup.yes.length} confirmed players are ready. Use the YES Players button above to load only those players into Build.`
                    : "Keep sharing the poll until at least four players confirm YES."}
                </small>
              </div>
            </div>
          </div>
        )}
        </div>
      </section>

      <div className="c4tb-workspace-navigation">
        <div>
          <span>Workspace</span>
          <strong>{STEPS.find((step) => step.id === activeStep)?.label}</strong>
        </div>

        <nav className="c4tb-workspace-stepper" aria-label="Team Builder workspace">
          {STEPS.map((step, index) => {
            const currentIndex = STEPS.findIndex((item) => item.id === activeStep);
            const state =
              index === currentIndex
                ? "active"
                : index < currentIndex
                  ? "complete"
                  : "";

            return (
              <button
                key={step.id}
                type="button"
                className={state}
                onClick={() => index <= currentIndex && setActiveStep(step.id)}
                disabled={index > currentIndex}
              >
                <span>{state === "complete" ? "✓" : step.icon}</span>
                <b>{step.label}</b>
              </button>
            );
          })}
        </nav>

        {activeStep !== "SOURCE" && (
          <button
            type="button"
            className="c4tb-workspace-back"
            onClick={goToPreviousWorkspaceStep}
          >
            ← Back to{" "}
            {
              STEPS[
                Math.max(
                  0,
                  STEPS.findIndex((item) => item.id === activeStep) - 1
                )
              ]?.label
            }
          </button>
        )}
      </div>

      <div className="c4tb-layout">
        <section className="c4tb-main-card">
          {activeStep === "SOURCE" && (
            <>
              <div className="c4tb-section-head"><div><span>Step 1</span><h2>Choose how players enter the builder</h2><p>Choose any player source. Availability polls are optional, and balancing becomes available as soon as 4 players are selected.</p></div></div>
              <div className="c4tb-source-grid">
                {[
                  ["MATCH", "📅", "Scheduled match", "Load both match teams and balance immediately; a poll is optional."],
                  ["POLL", "📲", "WhatsApp availability", "Use an existing poll, YES voters, or the currently selected players."],
                  ["UPLOAD", "📸", "Upload file or screenshot", "Import CSV, TXT, Excel, PNG, JPG, or WebP team lists and rematch by stats."],
                  ["MANUAL", "👥", "Manual selection", "Choose league pools and individual players."],
                ].map(([id, icon, title, copy]) => (
                  <button key={id} type="button" className={sourceMode === id ? "selected" : ""} onClick={() => changeSourceMode(id)}>
                    <i>{icon}</i><strong>{title}</strong><small>{copy}</small><em>{sourceMode === id ? "Selected" : "Choose"}</em>
                  </button>
                ))}
              </div>

              {sourceMode === "MATCH" && (
                <div className="c4tb-panel">
                  <div className="c4tb-panel-title"><div><h3>Scheduled matches</h3><p>Select a match to preload its teams, player pools, date, and team names.</p></div></div>
                  <div className="c4tb-match-list">
                    {matches.length ? matches.map((match) => (
                      <button key={match.id} type="button" className={String(selectedMatchId) === String(match.id) ? "selected" : ""} onClick={() => chooseMatch(String(match.id))}>
                        <div><strong>{match.teamAName || match.teamA?.name} <span>vs</span> {match.teamBName || match.teamB?.name}</strong><small>{formatDate(match.scheduledAt)}</small></div><b>{String(selectedMatchId) === String(match.id) ? "✓" : "→"}</b>
                      </button>
                    )) : <div className="c4tb-empty">No scheduled matches found. Use WhatsApp availability or manual selection.</div>}
                  </div>
                </div>
              )}

              {(sourceMode === "MANUAL" || sourceMode === "POLL" || sourceMode === "UPLOAD") && (
                <div className="c4tb-panel">
                  <div className="c4tb-panel-title"><div><h3>Player pools</h3><p>Choose which league teams contribute eligible players.</p></div><span>{selectedTeamIds.length}/{teams.length}</span></div>
                  <div className="c4tb-pool-grid">
                    {teams.map((team) => (
                      <button key={team.id} type="button" className={selectedTeamIds.includes(Number(team.id)) ? "selected" : ""} onClick={() => togglePool(team.id)}>
                        <span>{selectedTeamIds.includes(Number(team.id)) ? "✓" : "+"}</span><div><strong>{team.name}</strong><small>{team.playerCount || 0} players</small></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sourceMode === "MATCH" && selectedMatch && (
                <div className="c4tb-source-poll-cta">
                  <div>
                    <span>Optional availability poll</span>
                    <strong>Create and share a WhatsApp poll for this scheduled match</strong>
                    <small>Balancing is still available immediately from the currently selected match players.</small>
                  </div>
                  <button type="button" onClick={prepareScheduledMatchPoll} disabled={working}>
                    📤 Create &amp; Share Poll
                  </button>
                </div>
              )}

              {sourceMode === "POLL" && (
                <div className="c4tb-source-poll-cta">
                  <div>
                    <span>WhatsApp availability</span>
                    <strong>Create a new poll or continue with an existing poll above</strong>
                    <small>The poll is optional. You can also review the current player selection and balance teams now.</small>
                  </div>
                  <button
                    type="button"
                    onClick={prepareNewPoll}
                    disabled={working || selectedTeamIds.length === 0}
                    title={selectedTeamIds.length === 0 ? "Select at least one team first" : "Create and share an availability poll"}
                  >
                    📤 Create &amp; Share Poll
                  </button>
                </div>
              )}

              {sourceMode === "UPLOAD" && (
                <>
                  <div
                    className={`c4tb-upload-zone ${working ? "working" : ""}`}
                    onClick={() => !working && uploadRef.current?.click()}
                  >
                    <input
                      ref={uploadRef}
                      hidden
                      type="file"
                      accept=".csv,.txt,.xlsx,.xls,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                      onChange={(event) => importPlayers(event.target.files?.[0])}
                    />
                    <span>{working ? "⏳" : "📸"}</span>
                    <h3>Upload a player list or team screenshot</h3>
                    <p>
                      Use CSV, TXT, Excel, PNG, JPG, or WebP. Screenshots can contain
                      team headings, numbered players, captain markers, emojis, or
                      multi-column team lists.
                    </p>
                    <button type="button" disabled={working}>
                      {working ? "Reading and matching..." : "Choose File or Screenshot"}
                    </button>
                    <small className="c4tb-upload-privacy">
                      Screenshots are analyzed securely on the server. Always review the detected names before balancing.
                    </small>
                    {importSummary && (
                      <small className="c4tb-upload-result">
                        {importSummary.matched} matched • {importSummary.unmatched} unmatched
                      </small>
                    )}
                  </div>

                  {screenshotImport && (
                    <section className="c4tb-screenshot-review" aria-label="Screenshot import review">
                      <div className="c4tb-screenshot-review-head">
                        <div>
                          <span>Screenshot review</span>
                          <h3>{screenshotImport.detectedCount} names detected</h3>
                          <p>{screenshotImport.fileName}</p>
                        </div>
                        <b>{importSummary?.matched || 0} league matches</b>
                      </div>

                      <div className="c4tb-detected-team-grid">
                        {screenshotImport.teams.map((team, teamIndex) => (
                          <article key={`${team.teamName}-${teamIndex}`}>
                            <header>
                              <strong>{team.teamName || `Detected Team ${teamIndex + 1}`}</strong>
                              <span>{team.players?.length || 0}</span>
                            </header>
                            <div>
                              {(team.players || []).map((name, playerIndex) => (
                                <span key={`${name}-${playerIndex}`}>{name}</span>
                              ))}
                            </div>
                          </article>
                        ))}

                        {!!screenshotImport.unassignedPlayers.length && (
                          <article>
                            <header>
                              <strong>Players without a team heading</strong>
                              <span>{screenshotImport.unassignedPlayers.length}</span>
                            </header>
                            <div>
                              {screenshotImport.unassignedPlayers.map((name, playerIndex) => (
                                <span key={`${name}-${playerIndex}`}>{name}</span>
                              ))}
                            </div>
                          </article>
                        )}
                      </div>

                      {!!screenshotImport.warnings.length && (
                        <div className="c4tb-screenshot-warnings">
                          <strong>Review notes</strong>
                          {screenshotImport.warnings.map((warning, index) => (
                            <p key={`${warning}-${index}`}>• {warning}</p>
                          ))}
                        </div>
                      )}

                      <p className="c4tb-screenshot-review-note">
                        The detected team grouping is shown for verification. Only names matched to current league players are selected for balancing.
                      </p>
                    </section>
                  )}
                </>
              )}

              {renderBalanceAction({ showReview: true })}
            </>
          )}

          {activeStep === "AVAILABILITY" && (
            <>
              <div className="c4tb-section-head">
                <div>
                  <span>Step 2</span>
                  <h2>Collect availability</h2>
                  <p>
                    {sourceMode === "MATCH"
                      ? "Optionally create and share a poll, or generate teams immediately from the selected match players."
                      : "Poll tools are optional. You can use YES voters, manually adjust players, or generate from the current selection."}
                  </p>
                </div>
              </div>

              {sourceMode === "MATCH" && selectedMatch && (
                <div className="c4tb-availability-workspace">
                  {availabilitySetupCollapsed && poll ? (
                    <div className="c4tb-poll-created-card">
                      <span className="c4tb-poll-created-icon">✓</span>
                      <div>
                        <small>Poll created</small>
                        <h3>{poll.title}</h3>
                        <p>The active poll and all incoming responses are now shown in the Availability Center above.</p>
                      </div>
                      <div className="c4tb-poll-created-actions">
                        <button type="button" onClick={sharePoll}>📲 Share again</button>
                        <button type="button" className="secondary" onClick={() => setAvailabilitySetupCollapsed(false)}>Edit poll details</button>
                        <button type="button" className="secondary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>View live poll ↑</button>
                      </div>
                    </div>
                  ) : (
                    <div className="c4tb-panel c4tb-full-poll-form">
                      <div className="c4tb-panel-title">
                        <div>
                          <h3>Create poll for this scheduled match</h3>
                          <p>The teams, title, and scheduled time are already filled in. Review them, then create and share.</p>
                        </div>
                      </div>

                      <div className="c4tb-scheduled-poll-context">
                        <span>🏏</span>
                        <div>
                          <small>Creating poll for</small>
                          <strong>{selectedMatch.teamAName || selectedMatch.teamA?.name} vs {selectedMatch.teamBName || selectedMatch.teamB?.name}</strong>
                          <em>{formatDate(selectedMatch.scheduledAt)}</em>
                        </div>
                      </div>

                      <label className="c4tb-field"><span>Poll title</span><input value={pollTitle} onChange={(event) => setPollTitle(event.target.value)} /></label>
                      <label className="c4tb-field"><span>WhatsApp message</span><textarea rows="3" value={pollText} onChange={(event) => setPollText(event.target.value)} /></label>

                      <div className="c4tb-options">
                        {pollOptions.map((option, index) => (
                          <div key={index} className="c4tb-option-row">
                            <input value={option.label} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} placeholder="Option name" />
                            <input type="datetime-local" value={option.startTime ? String(option.startTime).slice(0, 16) : ""} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item))} />
                            <button type="button" onClick={() => setPollOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                          </div>
                        ))}
                      </div>

                      <div className="c4tb-inline-actions c4tb-single-primary-action">
                        <button type="button" className="scheduled-create-share" onClick={() => createPoll({ shareAfterCreate: true })} disabled={working}>
                          {working ? "Creating..." : "📤 Create & Share Poll"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sourceMode === "POLL" && (
                <div className="c4tb-availability-workspace">
                  {!showAdHocPollForm ? (
                    <div className="c4tb-poll-browser">
                      <section className="c4tb-panel c4tb-existing-poll-chooser">
                        <div className="c4tb-panel-title">
                          <div>
                            <h3>Existing availability polls</h3>
                            <p>
                              Open a poll, monitor its live responses above, and
                              use its confirmed players when ready.
                            </p>
                          </div>
                          <span>{allPolls.length}</span>
                        </div>

                        {allPolls.length ? (
                          <div className="c4tb-poll-choice-grid">
                            {allPolls.map((item) => {
                              const summary = pollSummary(item);
                              const isActive = poll?.token === item.token;

                              return (
                                <button
                                  key={item.token}
                                  type="button"
                                  className={isActive ? "selected" : ""}
                                  onClick={() => openPoll(item)}
                                >
                                  <div>
                                    <strong>{item.title}</strong>
                                    <small>
                                      {new Date(item.createdAt).toLocaleString()}
                                    </small>
                                  </div>
                                  <span>
                                    {summary.yes} YES · {summary.maybe} MAYBE ·{" "}
                                    {summary.no} NO
                                  </span>
                                  <b>{isActive ? "Selected" : "Open"}</b>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="c4tb-empty">
                            No availability polls exist yet.
                          </div>
                        )}

                        <div className="c4tb-poll-source-actions">
                          {poll && bestPollGroup && (
                            <button
                              type="button"
                              className="primary"
                              disabled={bestPollGroup.yes.length < 4}
                              onClick={() => usePollPlayers(bestPollGroup)}
                            >
                              Use {bestPollGroup.yes.length} YES Players →
                            </button>
                          )}
                          <button
                            type="button"
                            className="secondary"
                            onClick={prepareNewPoll}
                          >
                            + Create an ad-hoc poll
                          </button>
                        </div>
                      </section>

                      <section className="c4tb-panel c4tb-unpolled-matches">
                        <div className="c4tb-panel-title">
                          <div>
                            <h3>Scheduled matches without a poll</h3>
                            <p>
                              Choose any upcoming match to preload its teams and
                              scheduled time into a new availability poll.
                            </p>
                          </div>
                          <span>{scheduledMatchesWithoutPoll.length}</span>
                        </div>

                        {scheduledMatchesWithoutPoll.length ? (
                          <div className="c4tb-unpolled-match-list">
                            {scheduledMatchesWithoutPoll.map((match) => (
                              <article key={match.id}>
                                <div>
                                  <strong>{matchDisplayName(match)}</strong>
                                  <small>{formatDate(match.scheduledAt)}</small>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => createPollForScheduledMatch(match)}
                                >
                                  Create Poll →
                                </button>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="c4tb-empty">
                            Every scheduled match already has an availability poll.
                          </div>
                        )}
                      </section>
                    </div>
                  ) : (
                    <div className="c4tb-panel c4tb-full-poll-form">
                      <div className="c4tb-panel-title">
                        <div>
                          <h3>Create an ad-hoc poll</h3>
                          <p>
                            Use this only when the poll is not tied to an existing
                            scheduled match.
                          </p>
                        </div>
                      </div>

                      <div className="c4tb-ad-hoc-team-selection">
                        <div className="c4tb-panel-title">
                          <div>
                            <h3>Select at least one team</h3>
                            <p>Only players from the selected team pools will be included in this availability poll.</p>
                          </div>
                          <span>{selectedTeamIds.length}/{teams.length}</span>
                        </div>
                        <div className="c4tb-pool-grid">
                          {teams.map((team) => (
                            <button
                              key={team.id}
                              type="button"
                              className={selectedTeamIds.includes(Number(team.id)) ? "selected" : ""}
                              onClick={() => togglePool(team.id)}
                              disabled={working}
                            >
                              <span>{selectedTeamIds.includes(Number(team.id)) ? "✓" : "+"}</span>
                              <div>
                                <strong>{team.name}</strong>
                                <small>{team.playerCount || 0} players</small>
                              </div>
                            </button>
                          ))}
                        </div>
                        {selectedTeamIds.length === 0 && (
                          <p className="c4tb-team-required-note">Select at least one team to enable Create &amp; Share Poll.</p>
                        )}
                      </div>

                      <label className="c4tb-field">
                        <span>Poll title</span>
                        <input
                          value={pollTitle}
                          onChange={(event) => setPollTitle(event.target.value)}
                        />
                      </label>

                      <label className="c4tb-field">
                        <span>WhatsApp message</span>
                        <textarea
                          rows="3"
                          value={pollText}
                          onChange={(event) => setPollText(event.target.value)}
                        />
                      </label>

                      <div className="c4tb-options">
                        {pollOptions.map((option, index) => (
                          <div key={index} className="c4tb-option-row">
                            <input
                              value={option.label}
                              onChange={(event) =>
                                setPollOptions((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, label: event.target.value }
                                      : item
                                  )
                                )
                              }
                              placeholder="Option name"
                            />
                            <input
                              type="datetime-local"
                              value={
                                option.startTime
                                  ? String(option.startTime).slice(0, 16)
                                  : ""
                              }
                              onChange={(event) =>
                                setPollOptions((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, startTime: event.target.value }
                                      : item
                                  )
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setPollOptions((current) =>
                                  current.filter((_, itemIndex) => itemIndex !== index)
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="c4tb-inline-actions c4tb-ad-hoc-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setShowAdHocPollForm(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            setPollOptions((current) => [
                              ...current,
                              {
                                label: `Option ${current.length + 1}`,
                                startTime: "",
                              },
                            ])
                          }
                        >
                          + Add date
                        </button>
                        <button
                          type="button"
                          onClick={() => createPoll({ shareAfterCreate: true })}
                          disabled={working || selectedTeamIds.length === 0}
                          title={selectedTeamIds.length === 0 ? "Select at least one team first" : "Create the poll and open WhatsApp"}
                        >
                          {working ? "Creating..." : "📤 Create & Share Poll"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {renderBalanceAction({ showReview: true })}
            </>
          )}

          {activeStep === "BUILD" && (
            <>
              <div className="c4tb-section-head"><div><span>Step 3</span><h2>Review players and build teams</h2><p>Make final availability adjustments, name both teams, and generate a strength-balanced split.</p></div></div>
              <div className="c4tb-build-toolbar">
                <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player or source team" /></label>
                <div><button onClick={() => setSelectedIds(players.map((player) => player.id))}>Select All</button><button onClick={() => setSelectedIds([])}>Clear</button></div>
              </div>
              <div className="c4tb-player-grid">
                {filteredPlayers.map((player) => {
                  const selected = selectedIds.includes(player.id);
                  return (
                    <button key={player.id} type="button" className={selected ? "selected" : ""} onClick={() => togglePlayer(player.id)}>
                      <span className="c4tb-check">{selected ? "✓" : "+"}</span>
                      <div><strong>{player.playerName}</strong><small>{player.sourceTeams?.join(" + ") || player.teamName || "League player"}</small><em>🏏 {player.runs || 0} runs • 🎯 {player.wickets || 0} wickets • 🧤 {(player.catches || 0) + (player.runOuts || 0)} fielding</em></div>
                    </button>
                  );
                })}
              </div>
              <div className="c4tb-team-controls">
                <label><span>Team 1 name</span><input value={teamAName} onChange={(event) => setTeamAName(event.target.value)} /></label>
                <div className="c4tb-versus"><strong>{Math.ceil(selectedPlayers.length / 2)}</strong><span>vs</span><strong>{Math.floor(selectedPlayers.length / 2)}</strong></div>
                <label><span>Team 2 name</span><input value={teamBName} onChange={(event) => setTeamBName(event.target.value)} /></label>
              </div>
              {renderBalanceAction()}
            </>
          )}

          {activeStep === "RESULTS" && result && (
            <>
              <div className="c4tb-result-hero"><div><span>Balance quality</span><strong>{result.balanceQuality}%</strong><p>Strength difference: {result.difference}</p></div><div><button onClick={shareTeams}>📲 Share Teams</button><button onClick={copyTeams}>Copy List</button><button className="secondary" onClick={() => setActiveStep("BUILD")}>Adjust Players</button></div></div>
              <div className="c4tb-results-grid">
                {[
                  { name: teamAName, team: result.teamA || [], strength: result.teamAStrength, suggestions: captains?.teamA || [], color: "blue" },
                  { name: teamBName, team: result.teamB || [], strength: result.teamBStrength, suggestions: captains?.teamB || [], color: "purple" },
                ].map((teamData) => (
                  <article key={teamData.name} className={`c4tb-team-card ${teamData.color}`}>
                    <header><div><span>{teamData.color === "blue" ? "🔵" : "🟣"} Generated team</span><h2>{teamData.name}</h2></div><b>{teamData.strength}</b></header>
                    <div className="c4tb-leaders"><div><span>👑 Captain</span><strong>{teamData.suggestions[0]?.playerName || "Not available"}</strong><small>{teamData.suggestions[0]?.reason}</small></div><div><span>⭐ Backup captain</span><strong>{teamData.suggestions[1]?.playerName || "Not available"}</strong><small>{teamData.suggestions[1]?.reason}</small></div></div>
                    <div className="c4tb-roster">{[...teamData.team].sort((a, b) => a.playerName.localeCompare(b.playerName)).map((player, index) => <div key={player.id}><span>{index + 1}</span><strong>{player.playerName}</strong><small>Skill {player.skillScore}</small></div>)}</div>
                  </article>
                ))}
              </div>
              <div className="c4tb-footer-action"><div><span>Teams are ready</span><strong>{result.teamA.length} vs {result.teamB.length}</strong></div><button type="button" onClick={generateTeams} disabled={working}>{working ? "Balancing..." : "Regenerate Teams"}</button></div>
            </>
          )}
        </section>


      </div>
    </main>
  );
}
