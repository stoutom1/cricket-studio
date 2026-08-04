"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./resources.module.css";

export default function ResourceCollectionsModal({
  collections,
  resource,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onSaveMemberships,
}) {
  const [
    selectedIds,
    setSelectedIds,
  ] = useState(
    () =>
      new Set(
        resource
          ?.collectionIds ||
        []
      )
  );

  const [
    newName,
    setNewName,
  ] = useState("");

  const [
    editingId,
    setEditingId,
  ] = useState(null);

  const [
    editingName,
    setEditingName,
  ] = useState("");

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    setSelectedIds(
      new Set(
        resource
          ?.collectionIds ||
        []
      )
    );
  }, [resource]);

  const orderedCollections =
    useMemo(
      () =>
        [...collections].sort(
          (left, right) =>
            left.name.localeCompare(
              right.name
            )
        ),
      [collections]
    );

  function toggleCollection(
    collectionId
  ) {
    setSelectedIds(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(
            collectionId
          )
        ) {
          next.delete(
            collectionId
          );
        } else {
          next.add(
            collectionId
          );
        }

        return next;
      }
    );
  }

  async function createCollection() {
    const name =
      newName
        .replace(/\s+/g, " ")
        .trim();

    if (!name) {
      setError(
        "Enter a collection name."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const collection =
        await onCreate(
          name
        );

      setNewName("");

      if (
        resource &&
        collection?.id
      ) {
        setSelectedIds(
          (current) => {
            const next =
              new Set(current);

            next.add(
              collection.id
            );

            return next;
          }
        );
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to create the collection."
      );
    } finally {
      setBusy(false);
    }
  }

  async function renameCollection(
    collectionId
  ) {
    const name =
      editingName
        .replace(/\s+/g, " ")
        .trim();

    if (!name) {
      setError(
        "Enter a collection name."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      await onRename(
        collectionId,
        name
      );

      setEditingId(null);
      setEditingName("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to rename the collection."
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteCollection(
    collection
  ) {
    const confirmed =
      window.confirm(
        `Delete “${collection.name}”? The resources themselves will not be deleted.`
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await onDelete(
        collection.id
      );

      setSelectedIds(
        (current) => {
          const next =
            new Set(current);

          next.delete(
            collection.id
          );

          return next;
        }
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to delete the collection."
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveMemberships() {
    if (!resource) {
      onClose();
      return;
    }

    setBusy(true);
    setError("");

    try {
      await onSaveMemberships(
        resource.id,
        Array.from(
          selectedIds
        )
      );

      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to update the collections."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={styles.personalModalBackdrop}
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className={styles.personalModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="personal-collections-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className={styles.personalModalHeader}>
          <div>
            <span>
              PRIVATE TO YOU
            </span>

            <h2 id="personal-collections-title">
              {resource
                ? "Save to collections"
                : "Manage collections"}
            </h2>

            <p>
              {resource
                ? resource.title
                : "Create private groups for match-day documents, restaurants, venues, forms, and more."}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close collections"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.personalCreateRow}>
          <input
            value={newName}
            maxLength={80}
            placeholder="New collection name"
            aria-label="New collection name"
            onChange={(event) =>
              setNewName(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                "Enter"
              ) {
                event.preventDefault();
                createCollection();
              }
            }}
          />

          <button
            type="button"
            disabled={busy}
            onClick={
              createCollection
            }
          >
            ＋ Create
          </button>
        </div>

        {error && (
          <div className={styles.personalModalError}>
            {error}
          </div>
        )}

        <div className={styles.personalCollectionList}>
          {orderedCollections.length ? (
            orderedCollections.map(
              (collection) => (
                <article
                  key={
                    collection.id
                  }
                  className={styles.personalCollectionRow}
                >
                  {resource ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.has(
                            collection.id
                          )
                        }
                        onChange={() =>
                          toggleCollection(
                            collection.id
                          )
                        }
                      />

                      <span
                        className={styles.personalCollectionIcon}
                        aria-hidden="true"
                      >
                        🗂️
                      </span>
                    </label>
                  ) : (
                    <span
                      className={styles.personalCollectionIcon}
                      aria-hidden="true"
                    >
                      🗂️
                    </span>
                  )}

                  <div className={styles.personalCollectionCopy}>
                    {editingId ===
                    collection.id ? (
                      <input
                        autoFocus
                        value={
                          editingName
                        }
                        maxLength={80}
                        aria-label="Rename collection"
                        onChange={(event) =>
                          setEditingName(
                            event.target.value
                          )
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key ===
                            "Enter"
                          ) {
                            event.preventDefault();
                            renameCollection(
                              collection.id
                            );
                          }

                          if (
                            event.key ===
                            "Escape"
                          ) {
                            setEditingId(
                              null
                            );
                          }
                        }}
                      />
                    ) : (
                      <strong>
                        {collection.name}
                      </strong>
                    )}

                    <small>
                      {collection.itemCount || 0}{" "}
                      {(collection.itemCount || 0) === 1
                        ? "resource"
                        : "resources"}
                    </small>
                  </div>

                  <div className={styles.personalCollectionActions}>
                    {editingId ===
                    collection.id ? (
                      <>
                        <button
                          type="button"
                          title="Save collection name"
                          disabled={busy}
                          onClick={() =>
                            renameCollection(
                              collection.id
                            )
                          }
                        >
                          ✓
                        </button>

                        <button
                          type="button"
                          title="Cancel rename"
                          onClick={() =>
                            setEditingId(
                              null
                            )
                          }
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          title="Rename collection"
                          aria-label={`Rename ${collection.name}`}
                          onClick={() => {
                            setEditingId(
                              collection.id
                            );

                            setEditingName(
                              collection.name
                            );
                          }}
                        >
                          ✎
                        </button>

                        <button
                          type="button"
                          title="Delete collection"
                          aria-label={`Delete ${collection.name}`}
                          disabled={busy}
                          onClick={() =>
                            deleteCollection(
                              collection
                            )
                          }
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </article>
              )
            )
          ) : (
            <div className={styles.personalCollectionsEmpty}>
              <span aria-hidden="true">
                🗂️
              </span>

              <strong>
                No personal collections yet
              </strong>

              <p>
                Create one above. Your collections are visible only to you.
              </p>
            </div>
          )}
        </div>

        <footer className={styles.personalModalFooter}>
          <button
            type="button"
            className={styles.personalCancelButton}
            onClick={onClose}
          >
            Close
          </button>

          {resource && (
            <button
              type="button"
              className={styles.personalSaveButton}
              disabled={busy}
              onClick={
                saveMemberships
              }
            >
              {busy
                ? "Saving…"
                : "Save collections"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
