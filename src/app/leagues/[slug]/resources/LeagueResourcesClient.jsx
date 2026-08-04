"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ResourceCollectionsModal from "./ResourceCollectionsModal";
import styles from "./resources.module.css";

const CATEGORIES = [
  ["ALL", "Everything", "✨"],
  ["FAVORITES", "My Favorites", "⭐"],
  ["RULES", "Rules", "📘"],
  ["VENUES", "Venues", "📍"],
  ["RESTAURANTS", "Restaurants", "🍽️"],
  ["HOTELS", "Hotels", "🏨"],
  ["CONTACTS", "Contacts", "☎️"],
  ["FORMS", "Forms", "📝"],
  ["SPONSORS", "Sponsors", "🤝"],
  ["TRAINING", "Training", "🏏"],
  ["DOCUMENTS", "Documents", "📄"],
  ["IMAGES", "Images", "🖼️"],
  ["VIDEOS", "Videos", "🎥"],
  ["LINKS", "Links", "🔗"],
  ["OTHER", "Other", "📦"],
];

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "RULES",
  visibility: "LEAGUE",
  externalUrl: "",
  isPinned: false,
};

function categoryMeta(category) {
  return (
    CATEGORIES.find(([value]) => value === category) ||
    CATEGORIES[CATEGORIES.length - 1]
  );
}

function formatBytes(value) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getResourceIcon(resource) {
  if (resource.resourceType === "LINK") {
    const linkIcons = {
      RESTAURANTS: "🍽️",
      HOTELS: "🏨",
      VENUES: "📍",
      CONTACTS: "☎️",
      VIDEOS: "🎥",
    };

    return linkIcons[resource.category] || "🔗";
  }

  const type = String(resource.contentType || "").toLowerCase();

  if (type.includes("pdf")) return "📕";
  if (type.includes("image")) return "🖼️";
  if (type.includes("video")) return "🎥";
  if (type.includes("audio")) return "🎧";
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) {
    return "📊";
  }
  if (type.includes("presentation") || type.includes("powerpoint")) return "📽️";
  if (type.includes("word") || type.includes("document")) return "📄";
  if (type.includes("zip")) return "🗜️";
  return "📎";
}

function safePathName(fileName) {
  return String(fileName || "resource-file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "resource-file";
}

export default function LeagueResourcesClient({ leagueId }) {
  const fileInputRef = useRef(null);
  const [resources, setResources] = useState([]);
  const [league, setLeague] = useState(null);
  const [
    canAdd,
    setCanAdd,
  ] = useState(false);

  const [
    canDelete,
    setCanDelete,
  ] = useState(false);

  const [
    collections,
    setCollections,
  ] = useState([]);

  const [
    activeCollectionId,
    setActiveCollectionId,
  ] = useState(null);

  const [
    collectionsModalResource,
    setCollectionsModalResource,
  ] = useState(null);

  const [
    collectionsManagerOpen,
    setCollectionsManagerOpen,
  ] = useState(false);

  const [
    favoriteBusyId,
    setFavoriteBusyId,
  ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reactionBusyId, setReactionBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [
    searchResults,
    setSearchResults,
  ] = useState([]);

  const [
    searchLoading,
    setSearchLoading,
  ] = useState(false);

  const [
    searchError,
    setSearchError,
  ] = useState("");

  const [
    searchRequestId,
    setSearchRequestId,
  ] = useState(0);

  const [category, setCategory] = useState("ALL");

  const [
    searchHealthOpen,
    setSearchHealthOpen,
  ] = useState(false);

  const [
    searchHealth,
    setSearchHealth,
  ] = useState(null);

  const [
    searchHealthLoading,
    setSearchHealthLoading,
  ] = useState(false);

  const [
    searchHealthError,
    setSearchHealthError,
  ] = useState("");

  const [
    reindexingResourceId,
    setReindexingResourceId,
  ] = useState(null);

  const [
    rebuildingSearch,
    setRebuildingSearch,
  ] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState("LINK");
  const [editing, setEditing] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadResources = useCallback(async () => {
    if (!Number.isInteger(Number(leagueId)) || Number(leagueId) <= 0) {
      setError("A valid league is required.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/leagues/${leagueId}/resources`, {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to load league resources.");
      }

      setResources(result.resources || []);
      setLeague(result.league || null);
      setCollections(
        result.collections || []
      );
      setCanAdd(
        result.canAdd === true ||
        result.permissions
          ?.canAdd === true ||
        result.canAddEdit ===
          true ||
        result.canManage ===
          true
      );

      setCanDelete(
        result.canDelete === true
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load league resources."
      );
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const normalizedSearch =
    search.trim();

  const serverSearchActive =
    normalizedSearch.length >= 2;

  useEffect(() => {
    if (!serverSearchActive) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError("");
      return;
    }

    const requestId =
      searchRequestId + 1;

    setSearchRequestId(
      requestId
    );

    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        async () => {
          setSearchLoading(true);
          setSearchError("");

          try {
            const response =
              await fetch(
                `/api/leagues/${leagueId}/resources/search?q=${encodeURIComponent(
                  normalizedSearch
                )}&limit=60`,
                {
                  cache: "no-store",
                  signal:
                    controller.signal,
                }
              );

            const result =
              await response.json();

            if (!response.ok) {
              throw new Error(
                result?.error ||
                "Unable to search league resources."
              );
            }

            setSearchResults(
              result.resources || []
            );
          } catch (searchFailure) {
            if (
              searchFailure?.name ===
              "AbortError"
            ) {
              return;
            }

            setSearchResults([]);
            setSearchError(
              searchFailure instanceof Error
                ? searchFailure.message
                : "Unable to search league resources."
            );
          } finally {
            setSearchLoading(false);
          }
        },
        320
      );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    leagueId,
    normalizedSearch,
    serverSearchActive,
  ]);

  const filteredResources =
    useMemo(() => {
      if (serverSearchActive) {
        return searchResults;
      }

      const term =
        normalizedSearch
          .toLowerCase();

      return resources.filter(
        (resource) => {
          if (
            activeCollectionId
          ) {
            return (
              resource.collectionIds ||
              []
            ).includes(
              activeCollectionId
            );
          }

          if (
            category ===
            "FAVORITES"
          ) {
            return (
              resource.isFavorite ===
              true
            );
          }

          if (
            category !== "ALL" &&
            resource.category !==
              category
          ) {
            return false;
          }

          if (!term) {
            return true;
          }

          return [
            resource.title,
            resource.description,
            resource.originalFileName,
            resource.externalUrl,
            resource.category,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(term)
            );
        }
      );
    }, [
      resources,
      searchResults,
      normalizedSearch,
      serverSearchActive,
      category,
      activeCollectionId,
    ]);

  const categoryCounts = useMemo(() => {
    const counts = {
      ALL:
        resources.length,

      FAVORITES:
        resources.filter(
          (resource) =>
            resource.isFavorite ===
            true
        ).length,
    };

    for (const resource of resources) {
      counts[resource.category] = (counts[resource.category] || 0) + 1;
    }

    return counts;
  }, [resources]);

  function resetModal() {
    setShowModal(false);
    setEditing(null);
    setSelectedFile(null);
    setMode("LINK");
    setForm(EMPTY_FORM);
    setError("");
  }

  function openCreate(nextMode) {
    if (!canAdd) {
      setError(
        "You do not have permission to add Knowledge Center resources."
      );
      return;
    }

    setEditing(null);
    setSelectedFile(null);
    setMode(nextMode);
    setForm({
      ...EMPTY_FORM,
      category: nextMode === "LINK" ? "LINKS" : "DOCUMENTS",
    });
    setMessage("");
    setError("");
    setShowModal(true);
  }

  function openEdit(resource) {
    if (
      resource?.canEdit !==
      true
    ) {
      setError(
        resource?.isOwnResource
          ? "You cannot edit this resource."
          : "You can edit only resources that you added."
      );
      return;
    }

    setEditing(resource);
    setMode(resource.resourceType);
    setSelectedFile(null);
    setForm({
      title: resource.title || "",
      description: resource.description || "",
      category: resource.category || "OTHER",
      visibility: resource.visibility || "LEAGUE",
      externalUrl: resource.externalUrl || "",
      isPinned: resource.isPinned === true,
    });
    setMessage("");
    setError("");
    setShowModal(true);
  }

  async function saveResource(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (!form.title.trim()) {
        throw new Error("Enter a clear resource title.");
      }

      if (editing) {
        const response = await fetch(
          `/api/leagues/${leagueId}/resources/${editing.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          }
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || "Unable to update the resource.");
        }

        setResources((current) =>
          current.map((item) =>
            item.id === result.resource.id
              ? { ...item, ...result.resource }
              : item
          )
        );
        setMessage("Resource updated successfully.");
        resetModal();
        return;
      }

      let payload = {
        ...form,
        resourceType: mode,
      };

      if (mode === "FILE") {
        if (!selectedFile) {
          throw new Error("Choose a file to upload.");
        }

        const pathname =
          `league-resources/${leagueId}/${Date.now()}-` +
          safePathName(selectedFile.name);

        const blob = await upload(pathname, selectedFile, {
          access: "private",
          handleUploadUrl: `/api/leagues/${leagueId}/resources/upload`,
          multipart: selectedFile.size > 5 * 1024 * 1024,
        });

        payload = {
          ...payload,
          blobUrl: blob.url,
          blobPathname: blob.pathname,
          originalFileName: selectedFile.name,
          contentType: selectedFile.type || blob.contentType || "",
          fileSize: selectedFile.size,
        };
      }

      const response = await fetch(`/api/leagues/${leagueId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to save the resource.");
      }

      setResources((current) => [result.resource, ...current]);
      setMessage(
        mode === "FILE"
          ? "Document uploaded successfully."
          : "Useful link added successfully."
      );
      resetModal();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the resource."
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteResource(resource) {
    if (!canDelete) {
      setError(
        "Deleting Knowledge Center resources requires permission-management access."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete “${resource.title}”? This cannot be undone.`
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/resources/${resource.id}`,
        { method: "DELETE" }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to delete the resource.");
      }

      setResources((current) =>
        current.filter((item) => item.id !== resource.id)
      );
      setMessage("Resource deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the resource."
      );
    } finally {
      setBusy(false);
    }
  }

  function openResource(resource, download = false) {
    const url =
      resource.resourceType === "LINK"
        ? resource.externalUrl
        : `/api/leagues/${leagueId}/resources/${resource.id}/file?download=${
            download ? "1" : "0"
          }`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function toggleReaction(resource, reaction) {
    if (reactionBusyId === resource.id) return;

    setReactionBusyId(resource.id);
    setError("");

    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/resources/${resource.id}/reaction`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reaction }),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to save your reaction.");
      }

      setResources((current) =>
        current.map((item) =>
          item.id === resource.id
            ? {
                ...item,
                upCount: result.upCount || 0,
                downCount: result.downCount || 0,
                myReaction: result.myReaction || null,
              }
            : item
        )
      );
    } catch (reactionError) {
      setError(
        reactionError instanceof Error
          ? reactionError.message
          : "Unable to save your reaction."
      );
    } finally {
      setReactionBusyId(null);
    }
  }

  function updateResourcePersonalState(
    resourceId,
    patch
  ) {
    setResources(
      (current) =>
        current.map(
          (resource) =>
            resource.id ===
            resourceId
              ? {
                  ...resource,
                  ...patch,
                }
              : resource
        )
    );

    setSearchResults(
      (current) =>
        current.map(
          (resource) =>
            resource.id ===
            resourceId
              ? {
                  ...resource,
                  ...patch,
                }
              : resource
        )
    );
  }

  async function toggleFavorite(
    resource
  ) {
    if (
      favoriteBusyId ===
      resource.id
    ) {
      return;
    }

    const nextValue =
      resource.isFavorite !==
      true;

    setFavoriteBusyId(
      resource.id
    );

    updateResourcePersonalState(
      resource.id,
      {
        isFavorite:
          nextValue,
      }
    );

    try {
      const response =
        await fetch(
          `/api/leagues/${leagueId}/resources/${resource.id}/favorite`,
          {
            method:
              nextValue
                ? "PUT"
                : "DELETE",
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
          "Unable to update your favorite."
        );
      }
    } catch (favoriteFailure) {
      updateResourcePersonalState(
        resource.id,
        {
          isFavorite:
            !nextValue,
        }
      );

      setError(
        favoriteFailure instanceof Error
          ? favoriteFailure.message
          : "Unable to update your favorite."
      );
    } finally {
      setFavoriteBusyId(
        null
      );
    }
  }

  async function createCollection(
    name
  ) {
    const response =
      await fetch(
        `/api/leagues/${leagueId}/resources/collections`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              name,
            }),
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error ||
        "Unable to create the collection."
      );
    }

    setCollections(
      (current) => [
        result.collection,
        ...current,
      ]
    );

    return result.collection;
  }

  async function renameCollection(
    collectionId,
    name
  ) {
    const response =
      await fetch(
        `/api/leagues/${leagueId}/resources/collections/${collectionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              name,
            }),
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error ||
        "Unable to rename the collection."
      );
    }

    setCollections(
      (current) =>
        current.map(
          (collection) =>
            collection.id ===
            collectionId
              ? result.collection
              : collection
        )
    );

    return result.collection;
  }

  async function deleteCollection(
    collectionId
  ) {
    const response =
      await fetch(
        `/api/leagues/${leagueId}/resources/collections/${collectionId}`,
        {
          method: "DELETE",
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error ||
        "Unable to delete the collection."
      );
    }

    setCollections(
      (current) =>
        current.filter(
          (collection) =>
            collection.id !==
            collectionId
        )
    );

    setResources(
      (current) =>
        current.map(
          (resource) => ({
            ...resource,
            collectionIds:
              (
                resource
                  .collectionIds ||
                []
              ).filter(
                (id) =>
                  id !==
                  collectionId
              ),
          })
        )
    );

    setSearchResults(
      (current) =>
        current.map(
          (resource) => ({
            ...resource,
            collectionIds:
              (
                resource
                  .collectionIds ||
                []
              ).filter(
                (id) =>
                  id !==
                  collectionId
              ),
          })
        )
    );

    if (
      activeCollectionId ===
      collectionId
    ) {
      setActiveCollectionId(
        null
      );
    }
  }

  async function saveResourceCollections(
    resourceId,
    collectionIds
  ) {
    const response =
      await fetch(
        `/api/leagues/${leagueId}/resources/${resourceId}/collections`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              collectionIds,
            }),
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error ||
        "Unable to update the collections."
      );
    }

    updateResourcePersonalState(
      resourceId,
      {
        collectionIds:
          result.collectionIds ||
          [],
      }
    );

    await loadResources();
  }

  const loadSearchHealth =
    useCallback(async () => {
      if (!canDelete) {
        return;
      }

      setSearchHealthLoading(true);
      setSearchHealthError("");

      try {
        const response =
          await fetch(
            `/api/leagues/${leagueId}/resources/search-health`,
            {
              cache: "no-store",
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result?.error ||
            "Unable to load search health."
          );
        }

        setSearchHealth(
          result
        );
      } catch (healthFailure) {
        setSearchHealthError(
          healthFailure instanceof Error
            ? healthFailure.message
            : "Unable to load search health."
        );
      } finally {
        setSearchHealthLoading(false);
      }
    }, [
      canDelete,
      leagueId,
    ]);

  useEffect(() => {
    if (
      searchHealthOpen &&
      canDelete
    ) {
      loadSearchHealth();
    }
  }, [
    searchHealthOpen,
    canDelete,
    loadSearchHealth,
  ]);

  async function reindexOneResource(
    resourceId
  ) {
    setReindexingResourceId(
      resourceId
    );

    setSearchHealthError("");
    setMessage("");

    try {
      const response =
        await fetch(
          `/api/leagues/${leagueId}/resources/${resourceId}/index`,
          {
            method: "POST",
          }
        );

      const rawText =
        await response.text();

      let result = null;

      try {
        result = rawText
          ? JSON.parse(rawText)
          : null;
      } catch {
        result = {
          error:
            rawText ||
            "The server returned an invalid response.",
        };
      }

      if (!response.ok) {
        throw new Error(
          result?.error ||
          "Unable to reindex this resource."
        );
      }

      setMessage(
        "Search index updated successfully."
      );

      await Promise.all([
        loadResources(),
        loadSearchHealth(),
      ]);
    } catch (indexFailure) {
      setSearchHealthError(
        indexFailure instanceof Error
          ? indexFailure.message
          : "Unable to reindex this resource."
      );
    } finally {
      setReindexingResourceId(
        null
      );
    }
  }

  async function rebuildLeagueSearch() {
    if (rebuildingSearch) {
      return;
    }

    setRebuildingSearch(true);
    setSearchHealthError("");
    setMessage("");

    try {
      let afterId = 0;
      let indexed = 0;
      let metadataOnly = 0;
      let failed = 0;
      let hasMore = true;

      while (hasMore) {
        const response =
          await fetch(
            `/api/leagues/${leagueId}/resources/reindex?limit=20&afterId=${afterId}`,
            {
              method: "POST",
            }
          );

        const rawText =
          await response.text();

        let result = null;

        try {
          result = rawText
            ? JSON.parse(rawText)
            : null;
        } catch {
          result = {
            error:
              rawText ||
              "The server returned an invalid response.",
          };
        }

        if (!response.ok) {
          throw new Error(
            result?.error ||
            "Unable to rebuild the search index."
          );
        }

        indexed +=
          result?.summary?.indexed ||
          0;

        metadataOnly +=
          result?.summary
            ?.metadataOnly ||
          0;

        failed +=
          result?.summary?.failed ||
          0;

        hasMore =
          result?.pagination
            ?.hasMore === true;

        afterId =
          Number(
            result?.pagination
              ?.nextAfterId ||
            0
          );

        if (
          hasMore &&
          afterId <= 0
        ) {
          throw new Error(
            "Search rebuild pagination could not continue."
          );
        }
      }

      setMessage(
        `Search rebuild completed: ${indexed} indexed, ${metadataOnly} metadata-only, ${failed} failed.`
      );

      await Promise.all([
        loadResources(),
        loadSearchHealth(),
      ]);
    } catch (rebuildFailure) {
      setSearchHealthError(
        rebuildFailure instanceof Error
          ? rebuildFailure.message
          : "Unable to rebuild the search index."
      );
    } finally {
      setRebuildingSearch(false);
    }
  }

  return (
    <div className={styles.resourcesApp}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />

        <div className={styles.heroTopRow}>
          <Link href="/dashboard" className={styles.backButton}>
            <span aria-hidden="true">←</span>
            Dashboard
          </Link>

          <span className={styles.secureBadge}>
            <span aria-hidden="true">🔒</span>
            Private & permission-aware
          </span>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroIcon} aria-hidden="true">
            📚
          </div>

          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>CRIC4ALL KNOWLEDGE CENTER</span>
            <h1>{league?.name || "League Knowledge Center"}</h1>
            <p>
              Your league’s organized home for rules, venue directions, nearby
              restaurants and hotels, forms, contacts, training material, media,
              and every document members need.
            </p>
          </div>
        </div>

        <div className={styles.heroStats}>
          <div>
            <strong>{resources.length}</strong>
            <span>Total resources</span>
          </div>
          <div>
            <strong>{resources.filter((item) => item.resourceType === "FILE").length}</strong>
            <span>Stored files</span>
          </div>
          <div>
            <strong>{resources.filter((item) => item.resourceType === "LINK").length}</strong>
            <span>Useful links</span>
          </div>
        </div>
      </header>

      <section className={styles.controlPanel}>
        <div className={styles.smartSearchShell}>
          <label className={styles.searchBox}>
            <span aria-hidden="true">⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search titles, links and words inside documents..."
              aria-label="Search all league resources and indexed document contents"
              autoComplete="off"
            />

            {search && (
              <button
                type="button"
                className={styles.searchClearButton}
                aria-label="Clear search"
                title="Clear search"
                onClick={() =>
                  setSearch("")
                }
              >
                ×
              </button>
            )}

            {searchLoading && (
              <span
                className={styles.searchSpinner}
                aria-label="Searching"
              />
            )}
          </label>

          {serverSearchActive && (
            <div className={styles.smartSearchStatus}>
              <span>
                {searchLoading
                  ? "Searching all categories and indexed document contents…"
                  : `${filteredResources.length} best ${
                      filteredResources.length === 1
                        ? "match"
                        : "matches"
                    } for “${normalizedSearch}”`}
              </span>

              <small>
                Category filters are temporarily ignored while searching.
              </small>
            </div>
          )}

          {searchError && (
            <div className={styles.smartSearchError}>
              {searchError}
            </div>
          )}
        </div>

        {canAdd && (
          <div className={styles.primaryActions}>
            <button
              type="button"
              className={styles.addLinkButton}
              onClick={() => openCreate("LINK")}
            >
              <span aria-hidden="true">🔗</span>
              <span>Add link or place</span>
            </button>

            <button
              type="button"
              className={styles.uploadButton}
              onClick={() => openCreate("FILE")}
            >
              <span aria-hidden="true">⬆</span>
              <span>Upload file</span>
            </button>

            {canDelete && (
              <button
                type="button"
                className={styles.searchHealthButton}
                aria-expanded={searchHealthOpen}
                aria-controls="knowledge-search-health"
                onClick={() =>
                  setSearchHealthOpen(
                    (current) =>
                      !current
                  )
                }
              >
                <span aria-hidden="true">⌕</span>
                <span>Search health</span>
                <b aria-hidden="true">
                  {searchHealthOpen
                    ? "⌃"
                    : "⌄"}
                </b>
              </button>
            )}
          </div>
        )}
      </section>

      {canDelete &&
        searchHealthOpen && (
          <section
            id="knowledge-search-health"
            className={styles.searchHealthPanel}
            aria-labelledby="knowledge-search-health-title"
          >
            <div className={styles.searchHealthHeader}>
              <div>
                <span className={styles.searchHealthEyebrow}>
                  SEARCH OPERATIONS
                </span>

                <h2 id="knowledge-search-health-title">
                  Search health
                </h2>

                <p>
                  See which files are searchable, fix failed indexing, and rebuild the league search index without developer tools.
                </p>
              </div>

              <div className={styles.searchHealthHeaderActions}>
                <button
                  type="button"
                  className={styles.searchHealthRefreshButton}
                  disabled={
                    searchHealthLoading ||
                    rebuildingSearch
                  }
                  onClick={
                    loadSearchHealth
                  }
                >
                  <span aria-hidden="true">↻</span>
                  Refresh
                </button>

                <button
                  type="button"
                  className={styles.searchHealthRebuildButton}
                  disabled={
                    rebuildingSearch ||
                    searchHealthLoading
                  }
                  onClick={
                    rebuildLeagueSearch
                  }
                >
                  <span aria-hidden="true">
                    {rebuildingSearch
                      ? "◌"
                      : "⚡"}
                  </span>

                  {rebuildingSearch
                    ? "Rebuilding…"
                    : "Rebuild all"}
                </button>
              </div>
            </div>

            {searchHealthError && (
              <div className={styles.searchHealthError}>
                {searchHealthError}
              </div>
            )}

            {searchHealthLoading &&
            !searchHealth ? (
              <div className={styles.searchHealthLoading}>
                <span
                  className={styles.searchSpinner}
                  aria-hidden="true"
                />
                Checking search health…
              </div>
            ) : (
              <>
                <div className={styles.searchHealthStats}>
                  <div>
                    <span className={styles.searchHealthReadyDot} />
                    <strong>
                      {searchHealth?.summary?.ready || 0}
                    </strong>
                    <small>Ready</small>
                  </div>

                  <div>
                    <span className={styles.searchHealthPendingDot} />
                    <strong>
                      {(searchHealth?.summary?.pending || 0) +
                        (searchHealth?.summary?.indexing || 0)}
                    </strong>
                    <small>Pending</small>
                  </div>

                  <div>
                    <span className={styles.searchHealthMetadataDot} />
                    <strong>
                      {searchHealth?.summary?.metadataOnly || 0}
                    </strong>
                    <small>Metadata only</small>
                  </div>

                  <div>
                    <span className={styles.searchHealthFailedDot} />
                    <strong>
                      {searchHealth?.summary?.failed || 0}
                    </strong>
                    <small>Failed</small>
                  </div>
                </div>

                {searchHealth?.resources?.length ? (
                  <div className={styles.searchHealthList}>
                    {searchHealth.resources.map(
                      (item) => {
                        const status =
                          item.searchStatus ||
                          "PENDING";

                        const needsAttention =
                          [
                            "FAILED",
                            "PENDING",
                            "INDEXING",
                            "METADATA_ONLY",
                          ].includes(
                            status
                          );

                        return (
                          <article
                            key={item.id}
                            className={`${styles.searchHealthItem} ${
                              needsAttention
                                ? styles.searchHealthItemAttention
                                : ""
                            }`}
                          >
                            <span
                              className={styles.searchHealthFileIcon}
                              aria-hidden="true"
                            >
                              {item.resourceType === "FILE"
                                ? "📄"
                                : "🔗"}
                            </span>

                            <div className={styles.searchHealthItemCopy}>
                              <div className={styles.searchHealthItemTitleRow}>
                                <strong title={item.title}>
                                  {item.title}
                                </strong>

                                <span
                                  className={`${styles.searchHealthStatus} ${
                                    styles[
                                      `searchHealthStatus${status
                                        .toLowerCase()
                                        .replace(
                                          /(^|_)([a-z])/g,
                                          (_, __, letter) =>
                                            letter.toUpperCase()
                                        )}`
                                    ] || ""
                                  }`}
                                >
                                  {status.replaceAll(
                                    "_",
                                    " "
                                  )}
                                </span>
                              </div>

                              <span className={styles.searchHealthFileName}>
                                {item.originalFileName ||
                                  item.externalUrl ||
                                  "Resource metadata"}
                              </span>

                              {item.searchError && (
                                <p>
                                  {item.searchError}
                                </p>
                              )}

                              <small>
                                {item.searchIndexedAt
                                  ? `Last indexed ${new Date(
                                      item.searchIndexedAt
                                    ).toLocaleString()}`
                                  : "Not indexed yet"}
                              </small>
                            </div>

                            <button
                              type="button"
                              className={styles.searchHealthRetryButton}
                              disabled={
                                reindexingResourceId === item.id ||
                                rebuildingSearch
                              }
                              onClick={() =>
                                reindexOneResource(
                                  item.id
                                )
                              }
                            >
                              {reindexingResourceId === item.id
                                ? "Indexing…"
                                : needsAttention
                                  ? "Fix now"
                                  : "Reindex"}
                            </button>
                          </article>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div className={styles.searchHealthEmpty}>
                    No Knowledge Center resources have been added yet.
                  </div>
                )}

                <div className={styles.searchHealthLegend}>
                  <span>
                    <i className={styles.searchHealthReadyDot} />
                    Ready means searchable inside supported documents.
                  </span>

                  <span>
                    <i className={styles.searchHealthMetadataDot} />
                    Metadata-only means title, description, filename, and URL remain searchable.
                  </span>
                </div>
              </>
            )}
          </section>
        )}

      <section
        className={styles.personalShelf}
        aria-label="Your private resource shortcuts"
      >
        <div className={styles.personalShelfHeader}>
          <div>
            <span aria-hidden="true">⭐</span>
            <strong>My library</strong>
            <small>Private to you</small>
          </div>

          <button
            type="button"
            className={styles.manageCollectionsButton}
            onClick={() =>
              setCollectionsManagerOpen(
                true
              )
            }
          >
            ⚙ Manage collections
          </button>
        </div>

        <div className={styles.personalShelfRail}>
          <button
            type="button"
            className={
              category ===
                "FAVORITES" &&
              !activeCollectionId
                ? styles.personalShelfActive
                : ""
            }
            onClick={() => {
              setCategory(
                "FAVORITES"
              );
              setActiveCollectionId(
                null
              );
            }}
          >
            <span aria-hidden="true">
              ★
            </span>
            <span>My Favorites</span>
            <b>
              {categoryCounts.FAVORITES ||
                0}
            </b>
          </button>

          {collections.map(
            (collection) => (
              <button
                key={
                  collection.id
                }
                type="button"
                className={
                  activeCollectionId ===
                  collection.id
                    ? styles.personalShelfActive
                    : ""
                }
                title={
                  collection.name
                }
                onClick={() => {
                  setActiveCollectionId(
                    collection.id
                  );
                  setCategory(
                    "ALL"
                  );
                }}
              >
                <span aria-hidden="true">
                  🗂️
                </span>

                <span>
                  {collection.name}
                </span>

                <b>
                  {collection.itemCount ||
                    0}
                </b>
              </button>
            )
          )}

          {(category ===
            "FAVORITES" ||
            activeCollectionId) && (
            <button
              type="button"
              className={styles.personalShelfClear}
              onClick={() => {
                setCategory(
                  "ALL"
                );
                setActiveCollectionId(
                  null
                );
              }}
            >
              × Show everything
            </button>
          )}
        </div>
      </section>

      <section
        className={styles.categoryNavShell}
        aria-label="Browse resource categories"
      >
        <div className={styles.categoryNavHeader}>
          <span>Browse categories</span>

          <span className={styles.categorySwipeHint}>
            Swipe to see more
            <b aria-hidden="true">→</b>
          </span>
        </div>

        <div className={styles.categoryRailViewport}>
          <nav
            className={styles.categoryRail}
            aria-label="Resource categories"
          >
            {CATEGORIES.map(([value, label, icon]) => (
              <button
                key={value}
                type="button"
                className={
                  category === value
                    ? styles.categoryActive
                    : ""
                }
                onClick={() => {
                  setCategory(value);
                  setActiveCollectionId(
                    null
                  );
                }}
              >
                <span aria-hidden="true">{icon}</span>
                <span>{label}</span>
                <b>{categoryCounts[value] || 0}</b>
              </button>
            ))}
          </nav>

          <span
            className={styles.categoryScrollCue}
            aria-hidden="true"
          >
            →
          </span>
        </div>
      </section>

      {message && <div className={styles.successBanner}>{message}</div>}
      {error && !showModal && <div className={styles.errorBanner}>{error}</div>}

      {loading ? (
        <div className={styles.loadingState}>
          <span className={styles.spinner} aria-hidden="true" />
          <strong>Opening your knowledge center...</strong>
        </div>
      ) : filteredResources.length === 0 ? (
        <section className={styles.emptyState}>
          <div aria-hidden="true">📚</div>
          <h2>{resources.length ? "No matching resources" : "Build your league knowledge center"}</h2>
          <p>
            {resources.length
              ? serverSearchActive
                ? "Try fewer words, a different spelling, or rebuild the document search index."
                : "Try another search or category."
              : "Upload league rules, add venue, restaurant or hotel links, and keep important forms and contacts easy to find."}
          </p>
          {canAdd && !resources.length && (
            <div className={styles.emptyActions}>
              <button type="button" onClick={() => openCreate("FILE")}>Upload first file</button>
              <button type="button" onClick={() => openCreate("LINK")}>Add first link</button>
            </div>
          )}
        </section>
      ) : (
        <section className={styles.resourceGrid} aria-live="polite">
          {filteredResources.map((resource) => {
            const [, categoryLabel, categoryIcon] = categoryMeta(resource.category);

            return (
              <article
                key={resource.id}
                className={styles.resourceCardV3}
              >
                <div
                  className={styles.resourceCardV3Accent}
                  aria-hidden="true"
                />

                <header className={styles.resourceCardV3Header}>
                  <span
                    className={styles.resourceCardV3Icon}
                    aria-hidden="true"
                  >
                    {getResourceIcon(resource)}
                  </span>

                  <div className={styles.resourceCardV3Heading}>
                    <div className={styles.resourceCardV3Badges}>
                      <span className={styles.resourceCardV3Category}>
                        <span aria-hidden="true">{categoryIcon}</span>
                        <span>{categoryLabel}</span>
                      </span>

                      {resource.isPinned && (
                        <span
                          className={styles.resourceCardV3StatusIcon}
                          title="Pinned resource"
                          aria-label="Pinned resource"
                        >
                          📌
                        </span>
                      )}

                      <span
                        className={styles.resourceCardV3StatusIcon}
                        title={
                          resource.visibility === "PUBLIC"
                            ? "Public resource"
                            : "League members only"
                        }
                        aria-label={
                          resource.visibility === "PUBLIC"
                            ? "Public resource"
                            : "League members only"
                        }
                      >
                        {resource.visibility === "PUBLIC" ? "🌍" : "👥"}
                      </span>

                      <button
                        type="button"
                        className={`${styles.resourceFavoriteButton} ${
                          resource.isFavorite
                            ? styles.resourceFavoriteButtonActive
                            : ""
                        }`}
                        title={
                          resource.isFavorite
                            ? "Remove from My Favorites"
                            : "Add to My Favorites"
                        }
                        aria-label={
                          resource.isFavorite
                            ? `Remove ${resource.title} from My Favorites`
                            : `Add ${resource.title} to My Favorites`
                        }
                        aria-pressed={
                          resource.isFavorite === true
                        }
                        disabled={
                          favoriteBusyId === resource.id
                        }
                        onClick={() =>
                          toggleFavorite(
                            resource
                          )
                        }
                      >
                        {resource.isFavorite
                          ? "★"
                          : "☆"}
                      </button>

                      <button
                        type="button"
                        className={styles.resourceCollectionButton}
                        title="Save to personal collections"
                        aria-label={`Save ${resource.title} to personal collections`}
                        onClick={() =>
                          setCollectionsModalResource(
                            resource
                          )
                        }
                      >
                        🗂️
                      </button>
                    </div>

                    <h2 title={resource.title}>
                      {resource.title}
                    </h2>
                  </div>
                </header>

                <div className={styles.resourceCardV3Body}>
                  <p className={styles.resourceCardV3Description}>
                    {serverSearchActive &&
                    resource.searchSnippet
                      ? resource.searchSnippet
                      : resource.description ||
                        (resource.resourceType === "FILE"
                          ? "Open this stored league document."
                          : "Open this useful league link.")}
                  </p>

                  <div className={styles.resourceCardV3Meta}>
                    {resource.resourceType === "FILE" ? (
                      <button
                        type="button"
                        className={styles.resourceCardV3MetaLink}
                        title={resource.originalFileName || "Open stored file"}
                        onClick={() => openResource(resource)}
                      >
                        <span>
                          {[resource.originalFileName, formatBytes(resource.fileSize)]
                            .filter(Boolean)
                            .join(" • ") || "Open stored file"}
                        </span>
                        <b aria-hidden="true">↗</b>
                      </button>
                    ) : (
                      <a
                        className={styles.resourceCardV3MetaLink}
                        href={resource.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={resource.externalUrl || "Open external link"}
                      >
                        <span>
                          {(() => {
                            try {
                              return new URL(resource.externalUrl).hostname;
                            } catch {
                              return "Open external link";
                            }
                          })()}
                        </span>
                        <b aria-hidden="true">↗</b>
                      </a>
                    )}

                    <time
                      className={styles.resourceCardV3Date}
                      dateTime={resource.updatedAt || undefined}
                    >
                      {formatDate(resource.updatedAt)}
                    </time>

                    {resource.isOwnResource && (
                      <span
                        className={styles.resourceCardV3OwnerBadge}
                        title="You added this resource"
                      >
                        Yours
                      </span>
                    )}
                  </div>
                </div>

                <footer className={styles.resourceCardV3Footer}>
                  <button
                    type="button"
                    className={styles.resourceCardV3Primary}
                    onClick={() => openResource(resource)}
                  >
                    <span>
                      {resource.resourceType === "FILE" ? "Open" : "Visit"}
                    </span>
                    <b aria-hidden="true">↗</b>
                  </button>

                  <button
                    type="button"
                    className={`${styles.resourceCardV3Reaction} ${
                      resource.myReaction === "UP"
                        ? styles.resourceCardV3ReactionUpActive
                        : ""
                    }`}
                    aria-label={`Like ${resource.title}`}
                    aria-pressed={resource.myReaction === "UP"}
                    title="Like"
                    disabled={reactionBusyId === resource.id}
                    onClick={() => toggleReaction(resource, "UP")}
                  >
                    <span aria-hidden="true">👍</span>
                    <strong>{resource.upCount || 0}</strong>
                  </button>

                  <button
                    type="button"
                    className={`${styles.resourceCardV3Reaction} ${
                      resource.myReaction === "DOWN"
                        ? styles.resourceCardV3ReactionDownActive
                        : ""
                    }`}
                    aria-label={`Dislike ${resource.title}`}
                    aria-pressed={resource.myReaction === "DOWN"}
                    title="Dislike"
                    disabled={reactionBusyId === resource.id}
                    onClick={() => toggleReaction(resource, "DOWN")}
                  >
                    <span aria-hidden="true">👎</span>
                    <strong>{resource.downCount || 0}</strong>
                  </button>

                  {resource.resourceType === "FILE" && (
                    <button
                      type="button"
                      className={styles.resourceCardV3IconButton}
                      title="Download file"
                      aria-label={`Download ${resource.title}`}
                      onClick={() => openResource(resource, true)}
                    >
                      ⬇
                    </button>
                  )}

                  {resource.canEdit ===
                    true && (
                    <button
                      type="button"
                      className={styles.resourceCardV3IconButton}
                      title={
                        resource.isOwnResource
                          ? "Edit your resource"
                          : "Edit resource"
                      }
                      aria-label={`Edit ${resource.title}`}
                      onClick={() =>
                        openEdit(
                          resource
                        )
                      }
                    >
                      ✎
                    </button>
                  )}

                  {resource.canDelete ===
                    true && (
                    <button
                      type="button"
                      className={styles.resourceCardV3DeleteButton}
                      title="Delete resource"
                      aria-label={`Delete ${resource.title}`}
                      onClick={() => deleteResource(resource)}
                      disabled={busy}
                    >
                      🗑
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </section>
      )}

      {(collectionsModalResource ||
        collectionsManagerOpen) && (
        <ResourceCollectionsModal
          collections={collections}
          resource={
            collectionsModalResource
          }
          onClose={() => {
            setCollectionsModalResource(
              null
            );
            setCollectionsManagerOpen(
              false
            );
          }}
          onCreate={
            createCollection
          }
          onRename={
            renameCollection
          }
          onDelete={
            deleteCollection
          }
          onSaveMemberships={
            saveResourceCollections
          }
        />
      )}

      {showModal && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={resetModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="league-resource-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHeader}>
              <div>
                <span>{editing ? "UPDATE RESOURCE" : mode === "FILE" ? "NEW FILE" : "NEW LINK OR PLACE"}</span>
                <h2 id="league-resource-modal-title">
                  {editing
                    ? `Edit ${editing.title}`
                    : mode === "FILE"
                      ? "Upload to the knowledge center"
                      : "Add a link, venue, restaurant, hotel or contact"}
                </h2>
              </div>
              <button type="button" onClick={resetModal} aria-label="Close dialog">×</button>
            </header>

            <form className={styles.resourceForm} onSubmit={saveResource}>
              {!editing && (
                <div className={styles.modeSwitch}>
                  <button
                    type="button"
                    className={mode === "FILE" ? styles.modeActive : ""}
                    onClick={() => setMode("FILE")}
                  >
                    ⬆ Upload file
                  </button>
                  <button
                    type="button"
                    className={mode === "LINK" ? styles.modeActive : ""}
                    onClick={() => setMode("LINK")}
                  >
                    🔗 Add link or place
                  </button>
                </div>
              )}

              <label>
                <span>Resource title *</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Example: 2026 League Playing Rules"
                  maxLength={160}
                  required
                />
              </label>

              <label>
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Explain what members will find in this resource."
                  rows={3}
                  maxLength={1200}
                />
              </label>

              <div className={styles.formGrid}>
                <label>
                  <span>Category</span>
                  <select
                    value={form.category}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  >
                    {CATEGORIES.filter(([value]) => value !== "ALL").map(([value, label, icon]) => (
                      <option key={value} value={value}>{icon} {label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Who can access it?</span>
                  <select
                    value={form.visibility}
                    onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}
                  >
                    <option value="LEAGUE">👥 League members only</option>
                    <option value="PUBLIC">🌍 Anyone with the resource page</option>
                  </select>
                </label>
              </div>

              {mode === "LINK" ? (
                <label>
                  <span>Website or map link *</span>
                  <input
                    type="url"
                    value={form.externalUrl}
                    onChange={(event) => setForm((current) => ({ ...current, externalUrl: event.target.value }))}
                    placeholder="https://..."
                    required
                  />
                </label>
              ) : !editing ? (
                <button
                  type="button"
                  className={styles.filePicker}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.jpg,.jpeg,.png,.webp,.gif"
                  />
                  <span className={styles.filePickerIcon} aria-hidden="true">{selectedFile ? "✅" : "☁️"}</span>
                  <strong>{selectedFile ? selectedFile.name : "Choose a document or image"}</strong>
                  <small>
                    {selectedFile
                      ? formatBytes(selectedFile.size)
                      : "PDF, Office files, CSV, ZIP, JPG, PNG or WebP • up to 25 MB"}
                  </small>
                </button>
              ) : (
                <div className={styles.existingFileNotice}>
                  <span aria-hidden="true">📎</span>
                  <div>
                    <strong>{editing.originalFileName}</strong>
                    <small>To replace a file, delete this resource and upload the new version.</small>
                  </div>
                </div>
              )}

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(event) => setForm((current) => ({ ...current, isPinned: event.target.checked }))}
                />
                <span>
                  <strong>Pin this resource</strong>
                  <small>Keep it at the top for quick access.</small>
                </span>
              </label>

              {error && <div className={styles.formError}>{error}</div>}

              <footer className={styles.modalFooter}>
                <button type="button" className={styles.cancelButton} onClick={resetModal} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveButton} disabled={busy}>
                  {busy ? "Saving..." : editing ? "Save changes" : mode === "FILE" ? "Upload resource" : "Add resource"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
