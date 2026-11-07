"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./ComposeShoutOut.module.css";
import { getTeammates, sendShoutOut } from "@/lib/instructor/actions";

const TAGS = [
  { value: "saved_the_day", label: "Saved the day", emoji: "🦸" },
  { value: "great_with_kids", label: "Great with the kids", emoji: "👏" },
  { value: "team_player", label: "Team player", emoji: "🤝" },
  { value: "made_it_fun", label: "Made it fun", emoji: "🎉" },
  { value: "super_prepared", label: "Super prepared", emoji: "📋" },
];

export default function ComposeShoutOut({ isOpen, onClose, preselectedRecipient = null }) {
  const router = useRouter();
  const [teammates, setTeammates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [message, setMessage] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const prevIsOpenRef = useRef(false);

  // Load teammates once on first open
  useEffect(() => {
    let cancelled = false;

    async function fetchTeammates() {
      setLoading(true);
      const result = await getTeammates();
      if (!cancelled) {
        setLoading(false);
        if (result.error) {
          setError(result.error);
        } else {
          setTeammates(result.teammates || []);
        }
      }
    }

    // Only fetch when transitioning from closed to open
    if (isOpen && !prevIsOpenRef.current) {
      // Reset form state
      setSelectedRecipient(preselectedRecipient);
      setMessage("");
      setSelectedTag(null);
      setSearchQuery("");
      setError("");
      fetchTeammates();
    }

    prevIsOpenRef.current = isOpen;

    return () => {
      cancelled = true;
    };
  }, [isOpen, preselectedRecipient]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape" && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSend = async () => {
    if (!selectedRecipient) {
      setError("Please select a teammate");
      return;
    }
    if (!message.trim()) {
      setError("Please write a message");
      return;
    }

    setSending(true);
    setError("");
    const result = await sendShoutOut(selectedRecipient.id, message, selectedTag);
    setSending(false);

    if (result.error) {
      setError(result.error);
    } else {
      onClose();
      router.refresh();
    }
  };

  const filteredTeammates = teammates.filter((t) =>
    t.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <h2>Send a shout-out</h2>
          <p className={styles.headerSub}>Thank a teammate for their help.</p>
        </div>

        <div className={styles.body}>
          {error && <div className={styles.error}>{error}</div>}

          {/* Recipient Selection */}
          <div className={styles.field}>
            <label>To</label>
            {selectedRecipient ? (
              <div className={styles.selectedRecipient}>
                {selectedRecipient.avatar_url ? (
                  <Image
                    src={selectedRecipient.avatar_url}
                    alt=""
                    width={36}
                    height={36}
                    className={styles.recipientAvatar}
                  />
                ) : (
                  <div className={styles.recipientAvatarPlaceholder}>
                    {selectedRecipient.full_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
                <span className={styles.recipientName}>{selectedRecipient.full_name}</span>
                <button
                  type="button"
                  className={styles.changeBtn}
                  onClick={() => setSelectedRecipient(null)}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className={styles.recipientPicker}>
                <input
                  type="text"
                  placeholder="Search teammates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                {loading ? (
                  <div className={styles.loadingList}>Loading teammates...</div>
                ) : (
                  <div className={styles.teammateList}>
                    {filteredTeammates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={styles.teammateRow}
                        onClick={() => setSelectedRecipient(t)}
                      >
                        {t.avatar_url ? (
                          <Image
                            src={t.avatar_url}
                            alt=""
                            width={32}
                            height={32}
                            className={styles.teammateAvatar}
                          />
                        ) : (
                          <div className={styles.teammateAvatarPlaceholder}>
                            {t.full_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                        )}
                        <span>{t.full_name}</span>
                      </button>
                    ))}
                    {filteredTeammates.length === 0 && !loading && (
                      <div className={styles.noResults}>No teammates found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tag Selection */}
          <div className={styles.field}>
            <label>What for? (optional)</label>
            <div className={styles.tagGrid}>
              {TAGS.map((tag) => (
                <button
                  key={tag.value}
                  type="button"
                  className={`${styles.tagBtn} ${selectedTag === tag.value ? styles.selected : ""}`}
                  onClick={() => setSelectedTag(selectedTag === tag.value ? null : tag.value)}
                >
                  <span className={styles.tagEmoji}>{tag.emoji}</span>
                  <span className={styles.tagLabel}>{tag.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className={styles.field}>
            <label>Your message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What did they do that made a difference?"
              maxLength={300}
              className={styles.messageInput}
            />
            <div className={styles.charCount}>{message.length}/300</div>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={sending || !selectedRecipient || !message.trim()}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
