"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./Inbox.module.css";
import { markNoteViewed, acknowledgeNote, markInboxRead, markAllRead } from "@/lib/instructor/actions";
import ComposeShoutOut from "./ComposeShoutOut";

const TAG_LABELS = {
  saved_the_day: "Saved the day",
  great_with_kids: "Great with the kids",
  team_player: "Team player",
  made_it_fun: "Made it fun",
  super_prepared: "Super prepared",
};

const RATING_WORDS = {
  5: "Excellent",
  4: "Strong",
  3: "Getting there",
  2: "Needs work",
  1: "Needs work",
};

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatDayDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function getDateParts(dateStr) {
  if (!dateStr) return { day: "", num: "" };
  const date = new Date(dateStr + "T00:00:00");
  return {
    day: DAYS_SHORT[date.getDay()],
    num: date.getDate(),
  };
}

function formatWeekday(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Format time for card display (e.g., "2:30 pm", "Yesterday", "Mon")
 */
function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today - show time
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    return `${displayHours}:${displayMinutes} ${ampm}`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[date.getDay()];
  } else {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }
}

/**
 * Format full date/time for sheet display (e.g., "Today, 3:12 pm")
 */
function formatFullDateTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  const timeStr = `${displayHours}:${displayMinutes} ${ampm}`;

  if (diffDays === 0) {
    return `Today, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday, ${timeStr}`;
  } else {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${timeStr}`;
  }
}

export default function InboxClient({ inboxData }) {
  const router = useRouter();
  const [tab, setTab] = useState("updates");
  const [selectedItem, setSelectedItem] = useState(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState(null);
  const [composeContext, setComposeContext] = useState(null);
  const sheetRef = useRef(null);

  const { updates, shoutOuts, unreadUpdates, unreadShoutOuts, sharedNotes, recentSessions = [], nextClass } = inboxData;

  // Focus trap for bottom sheet
  useEffect(() => {
    if (!selectedItem || !sheetRef.current) return;

    const sheet = sheetRef.current;
    const focusableElements = sheet.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement?.focus();

    const handleTabKey = (e) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    sheet.addEventListener("keydown", handleTabKey);
    return () => sheet.removeEventListener("keydown", handleTabKey);
  }, [selectedItem]);

  // Group items for current tab
  const currentItems = tab === "updates" ? updates : shoutOuts;

  // For Updates tab: Pinned, New (unread, not pinned), Earlier (read, not pinned)
  // Pinned items stay in Pinned section even after read
  const pinnedItems = tab === "updates"
    ? currentItems.filter((i) => i.isPinned && !i.needsYou)
    : [];
  const needsYouItems = currentItems.filter((i) => i.needsYou);
  const newItems = currentItems.filter((i) => !i.needsYou && !i.isRead && !i.isPinned);
  const earlierItems = currentItems.filter((i) => !i.needsYou && i.isRead && !i.isPinned);

  // Total unread for header
  const totalUnread = unreadUpdates + unreadShoutOuts;
  const hasUnread = newItems.length > 0 || (tab === "shoutouts" && shoutOuts.filter((s) => !s.isRead).length > 0);

  const handleItemClick = async (item) => {
    // Handle payroll check - navigate to past classes
    if (item.type === "payroll_check") {
      if (!item.isRead) {
        await markInboxRead("payrollcheck", item.periodStart);
      }
      router.push(`/instructor/past?period=${item.periodStart}`);
      return;
    }

    // Handle resolved payroll issue - navigate to past classes
    if (item.type === "payroll_issue_resolved") {
      if (!item.isRead) {
        await markInboxRead("payrollissue", item.issueId);
      }
      router.push("/instructor/past");
      return;
    }

    setSelectedItem(item);
    setComment("");

    // Mark as read
    if (!item.isRead && !item.needsYou) {
      const [type, id] = item.id.split(":");
      await markInboxRead(type, id);
    }

    // Mark note as viewed
    if (item.noteId) {
      await markNoteViewed(item.noteId);
    }
  };

  const handleClose = () => {
    setSelectedItem(null);
    setComment("");
  };

  const handleAcknowledge = async () => {
    if (!selectedItem?.noteId) return;
    setLoading(true);
    const result = await acknowledgeNote(selectedItem.noteId, comment);
    setLoading(false);
    if (result.error) {
      alert(result.error);
    } else {
      handleClose();
      router.refresh();
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    // Mark all read in BOTH tabs with one call
    await markAllRead("all");
    setLoading(false);
    router.refresh();
  };

  const handleThankClick = (session) => {
    setComposeRecipient({
      id: session.otherPersonId,
      full_name: session.otherPersonName,
      avatar_url: session.otherPersonAvatar,
    });
    setComposeContext({
      classId: session.classId,
      date: session.date,
      schoolName: session.schoolName,
    });
    setShowCompose(true);
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape" && selectedItem) {
      handleClose();
    }
  }, [selectedItem]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Get full note data for selected item
  const selectedNote = selectedItem?.noteId
    ? sharedNotes.find((n) => n.id === selectedItem.noteId)
    : null;

  const renderUpdateItem = (item) => {
    switch (item.type) {
      case "needs_ack":
        return (
          <div className={styles.itemContent}>
            <div className={`${styles.itemIcon} ${styles.alert}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <div className={styles.itemMain}>
              <div className={styles.itemTitle}>Please read and acknowledge</div>
              <div className={styles.itemSub}>{item.step} - {formatDate(item.sharedAt)}</div>
            </div>
            <span className={`${styles.itemPill} ${styles.needsYou}`}>Needs you</span>
          </div>
        );

      case "subbing":
        return (
          <div className={styles.itemContent}>
            <div className={`${styles.itemIcon} ${styles.calendar}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className={styles.itemMain}>
              <div className={`${styles.itemFromLine} ${styles.teal}`}>Schedule change</div>
              <div className={styles.itemTitle}>You&apos;re covering {item.schoolName}</div>
              <div className={styles.itemSub}>
                {formatDayDate(item.sessionDate)} · {item.time} · for {item.forName}
              </div>
            </div>
          </div>
        );

      case "review":
        return (
          <div className={styles.itemContent}>
            <div className={`${styles.itemIcon} ${styles.teal}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div className={styles.itemMain}>
              <div className={styles.itemTitle}>Your {item.title} is ready</div>
              <div className={styles.itemSub}>Tap to read and reply.</div>
            </div>
            <span className={`${styles.itemPill} ${item.isRead ? styles.read : styles.new}`}>
              {item.isRead ? "Read" : "New"}
            </span>
          </div>
        );

      case "announcement":
        return (
          <div className={styles.itemContent}>
            <div className={`${styles.itemIcon} ${styles.navy}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </div>
            <div className={styles.itemMain}>
              <div className={`${styles.itemFromLine} ${styles.navy}`}>
                {item.isPinned && <span className={styles.pinnedLabel}>PINNED</span>}
                From {item.createdByName}
              </div>
              <div className={styles.itemTitle}>{item.title}</div>
              <div className={styles.itemSub}>{item.body?.slice(0, 60)}...</div>
            </div>
            {item.editedAt && <span className={styles.editedBadge}>Edited</span>}
          </div>
        );

      case "payroll_check":
        return (
          <div className={styles.itemContent}>
            <div className={`${styles.itemIcon} ${styles.teal}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div className={styles.itemMain}>
              <div className={styles.itemTitle}>Check your classes for {item.periodRange}</div>
              <div className={styles.itemSub}>Due {formatWeekday(item.deadline)}. Takes a few seconds.</div>
            </div>
          </div>
        );

      case "payroll_issue_resolved":
        return (
          <div className={styles.itemContent}>
            <div className={`${styles.itemIcon} ${styles.green}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className={styles.itemMain}>
              <div className={styles.itemTitle}>The office fixed your {item.periodRange} classes</div>
              {item.resolutionNote && (
                <div className={styles.itemSub}>&ldquo;{item.resolutionNote}&rdquo;</div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderShoutOutItem = (item) => {
    if (item.type === "shoutout") {
      return (
        <div className={styles.itemContent}>
          <div className={`${styles.itemIcon} ${styles.amber}`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className={styles.itemMain}>
            <div className={`${styles.itemFromLine} ${styles.amber}`}>From {item.fromFirstName}</div>
            <div className={styles.itemTitle}>Shout-out</div>
            <div className={styles.itemSub}>&ldquo;{item.message?.slice(0, 60)}{item.message?.length > 60 ? "..." : ""}&rdquo;</div>
          </div>
          {item.tag && (
            <span className={`${styles.itemPill} ${styles.tag}`}>{TAG_LABELS[item.tag]}</span>
          )}
        </div>
      );
    }

    // Recognition note
    return (
      <div className={styles.itemContent}>
        <div className={`${styles.itemIcon} ${styles.amber}`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <div className={styles.itemMain}>
          {item.fromName && (
            <div className={`${styles.itemFromLine} ${styles.amber}`}>From {item.fromName}</div>
          )}
          <div className={styles.itemTitle}>{item.title}</div>
          <div className={styles.itemSub}>&ldquo;{item.body?.slice(0, 60)}{item.body?.length > 60 ? "..." : ""}&rdquo;</div>
        </div>
      </div>
    );
  };

  const renderItemGroup = (items, title, variant = "default") => {
    if (items.length === 0) return null;
    const cardClass = variant === "earlier" ? styles.groupCardEarlier : styles.groupCard;
    return (
      <div className={styles.itemGroup}>
        <div className={styles.groupLabel}>{title}</div>
        <div className={cardClass}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.itemRow} ${!item.isRead && !item.needsYou ? styles.unread : ""} ${item.isPinned ? styles.pinnedRow : ""}`}
              onClick={() => handleItemClick(item)}
            >
              {!item.isRead && !item.needsYou && <span className={styles.unreadDot} />}
              {tab === "updates" ? renderUpdateItem(item) : renderShoutOutItem(item)}
              {/* Time display for New items */}
              {!item.needsYou && !item.isRead && (item.createdAt || item.sharedAt || item.reviewedAt || item.decidedAt) && (
                <span className={styles.itemTime}>
                  <span className={styles.itemTimeDot} />
                  {formatTimeAgo(item.createdAt || item.sharedAt || item.reviewedAt || item.decidedAt)}
                </span>
              )}
              {/* Time display for Earlier items (no dot) */}
              {!item.needsYou && item.isRead && (item.createdAt || item.sharedAt || item.reviewedAt || item.decidedAt) && (
                <span className={styles.itemTime}>
                  {formatTimeAgo(item.createdAt || item.sharedAt || item.reviewedAt || item.decidedAt)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderRatingBar = (value) => (
    <div className={styles.ratingBarWide}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`${styles.ratingSegWide} ${i <= value ? styles.filled : ""}`} />
      ))}
    </div>
  );

  // Empty state for Shout-outs tab
  const renderShoutOutsEmpty = () => (
    <>
      {/* Hero card */}
      <div className={`${styles.emptyHero} ${styles.emptyHeroShoutouts}`}>
        <div className={styles.heroDecorations} aria-hidden="true">
          <div className={styles.heroDot1} />
          <div className={styles.heroDot2} />
          <div className={styles.heroSquare} />
        </div>
        <div className={styles.heroIllustration} aria-hidden="true">
          <div className={styles.heroTileBehind}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
          <div className={styles.heroTileFront}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
        </div>
        <h2 className={styles.heroHeading}>No shout-outs yet</h2>
        <p className={styles.heroText}>
          When a teammate thanks you, it lands here. Parent thank-yous too.
        </p>
      </div>

      {/* Recent classes card - would need data from server */}
      {recentSessions.length > 0 && (
        <RecentClassesCard
          sessions={recentSessions}
          onThankClick={handleThankClick}
        />
      )}
    </>
  );

  // Empty state for Updates tab
  const renderUpdatesEmpty = () => (
    <>
      {/* Hero card */}
      <div className={`${styles.emptyHero} ${styles.emptyHeroUpdates}`}>
        <div className={styles.heroIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
          </svg>
        </div>
        <h2 className={styles.heroHeading}>You&apos;re all caught up</h2>
        <p className={styles.heroText}>
          Classes you&apos;re covering, time off, reviews and notes from the office show up here.
        </p>
      </div>

      {/* Next class section */}
      {nextClass && (
        <div className={styles.nextClassSection}>
          <div className={styles.nextClassLabel}>Your next class</div>
          <div className={styles.nextClassCard}>
            <div className={styles.nextClassDateTile}>
              <span className={styles.nextClassDateDay}>{getDateParts(nextClass.date).day}</span>
              <span className={styles.nextClassDateNum}>{getDateParts(nextClass.date).num}</span>
            </div>
            <div className={styles.nextClassInfo}>
              <div className={styles.nextClassSchool}>{nextClass.schoolName}</div>
              <div className={styles.nextClassMeta}>{nextClass.program} · {nextClass.time}</div>
            </div>
            <svg className={styles.nextClassChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Inbox</h1>
          {totalUnread > 0 ? (
            <p className={styles.headerSub}>
              {totalUnread} new update{totalUnread !== 1 ? "s" : ""}
            </p>
          ) : (
            <p className={styles.headerSubCaughtUp}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              All caught up
            </p>
          )}
        </div>
        {hasUnread && (
          <button
            type="button"
            className={styles.markAllBtn}
            onClick={handleMarkAllRead}
            disabled={loading}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "updates"}
          className={`${styles.tab} ${tab === "updates" ? styles.active : ""}`}
          onClick={() => setTab("updates")}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              setTab("shoutouts");
            }
          }}
        >
          Updates
          {unreadUpdates > 0 && (
            <span className={styles.tabBadge}>{unreadUpdates}</span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "shoutouts"}
          className={`${styles.tab} ${tab === "shoutouts" ? styles.active : ""}`}
          onClick={() => setTab("shoutouts")}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              setTab("updates");
            }
          }}
        >
          Shout-outs
          {unreadShoutOuts > 0 && (
            <span className={styles.tabBadge}>{unreadShoutOuts}</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {tab === "updates" && currentItems.length === 0 && renderUpdatesEmpty()}
        {tab === "shoutouts" && currentItems.length === 0 && renderShoutOutsEmpty()}

        {currentItems.length > 0 && (
          <>
            {renderItemGroup(needsYouItems, "NEEDS YOU")}
            {renderItemGroup(pinnedItems, "PINNED")}
            {renderItemGroup(newItems, "NEW")}
            {renderItemGroup(earlierItems, "EARLIER", "earlier")}

            {/* Show recent classes card at bottom of shout-outs list */}
            {tab === "shoutouts" && recentSessions.length > 0 && (
              <RecentClassesCard
                sessions={recentSessions}
                onThankClick={handleThankClick}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom Sheet */}
      {selectedItem && (
        <div className={styles.sheetOverlay} onClick={handleClose}>
          <div
            ref={sheetRef}
            className={styles.sheet}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.sheetHandle} />

            {/* Review */}
            {selectedNote?.type === "review" && (
              <>
                <div className={styles.sheetHeader}>
                  <span className={`${styles.sheetPill} ${styles.review}`}>Review</span>
                  <h2>{selectedNote.title}</h2>
                  <p className={styles.sheetDate}>{formatDate(selectedNote.note_date)}</p>
                </div>

                <div className={styles.sheetBody}>
                  {selectedNote.ratings && (
                    <div className={styles.ratingsGrid}>
                      {Object.entries(selectedNote.ratings).map(([key, value]) => (
                        <div key={key} className={styles.ratingRow}>
                          <span className={styles.ratingLabel}>
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                          </span>
                          <span className={styles.ratingWord}>{RATING_WORDS[value] || ""}</span>
                          {renderRatingBar(value)}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedNote.doing_well && (
                    <div className={styles.textSection}>
                      <div className={styles.textLabel}>DOING WELL</div>
                      <p>{selectedNote.doing_well}</p>
                    </div>
                  )}

                  {selectedNote.work_on_next && (
                    <div className={styles.textSection}>
                      <div className={styles.textLabel}>WORK ON NEXT</div>
                      <p>{selectedNote.work_on_next}</p>
                    </div>
                  )}

                  {selectedNote.next_review_date && (
                    <div className={styles.nextReviewStrip}>
                      Next review around {formatDate(selectedNote.next_review_date)}
                    </div>
                  )}
                </div>

                {selectedNote.acknowledged_at ? (
                  <div className={styles.acknowledgedBox}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    You read this {formatDate(selectedNote.acknowledged_at)}
                    {selectedNote.instructor_comment && (
                      <p className={styles.yourComment}>You said: &ldquo;{selectedNote.instructor_comment}&rdquo;</p>
                    )}
                  </div>
                ) : (
                  <div className={styles.sheetFooter}>
                    <div className={styles.commentField}>
                      <label>Anything you want to say</label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Thanks, a question, or what you'll work on"
                        maxLength={500}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.ackBtn}
                      onClick={handleAcknowledge}
                      disabled={loading}
                    >
                      {loading ? "..." : "Got it"}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Disciplinary */}
            {selectedNote?.type === "disciplinary" && (
              <>
                <div className={styles.sheetHeader}>
                  <span className={`${styles.sheetPill} ${styles.disciplinary}`}>
                    {selectedNote.step}
                  </span>
                  <h2>{selectedNote.title}</h2>
                  <p className={styles.sheetDate}>{formatDate(selectedNote.note_date)}</p>
                </div>

                <div className={styles.sheetBody}>
                  <div className={styles.disciplinaryBox}>
                    {selectedNote.what_happened && (
                      <div className={styles.textSection}>
                        <div className={styles.textLabel}>WHAT HAPPENED</div>
                        <p>{selectedNote.what_happened}</p>
                      </div>
                    )}
                    {selectedNote.expectation && (
                      <div className={styles.textSection}>
                        <div className={styles.textLabel}>WHAT WE EXPECT</div>
                        <p>{selectedNote.expectation}</p>
                      </div>
                    )}
                    {selectedNote.if_repeated && (
                      <div className={styles.textSection}>
                        <div className={styles.textLabel}>IF IT HAPPENS AGAIN</div>
                        <p>{selectedNote.if_repeated}</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedNote.acknowledged_at ? (
                  <div className={styles.acknowledgedBox}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    You acknowledged this {formatDate(selectedNote.acknowledged_at)}
                    {selectedNote.instructor_comment && (
                      <p className={styles.yourComment}>You said: &ldquo;{selectedNote.instructor_comment}&rdquo;</p>
                    )}
                  </div>
                ) : (
                  <div className={styles.sheetFooter}>
                    <p className={styles.ackNote}>
                      Acknowledging means you&apos;ve read this. It doesn&apos;t mean you agree.
                      You can add your side below.
                    </p>
                    <div className={styles.commentField}>
                      <label>Anything you want to add</label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Your side, or what you'll do differently"
                        maxLength={500}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.ackBtn}
                      onClick={handleAcknowledge}
                      disabled={loading}
                    >
                      {loading ? "..." : "I've read this"}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Recognition */}
            {selectedNote?.type === "recognition" && (
              <>
                <div className={styles.sheetHeader}>
                  <div className={`${styles.sheetIconTile} ${styles.amber}`}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  {selectedNote.shout_out_from_name && (
                    <p className={`${styles.sheetFromLine} ${styles.amber}`}>
                      From {selectedNote.shout_out_from_name}
                    </p>
                  )}
                  <h2>{selectedNote.title}</h2>
                  <p className={styles.sheetDate}>
                    {formatFullDateTime(selectedNote.created_at || selectedNote.note_date)}
                    {selectedNote.shout_out_tag && ` · ${TAG_LABELS[selectedNote.shout_out_tag]}`}
                  </p>
                </div>
                <div className={styles.sheetBody}>
                  <p className={styles.sheetMessage}>{selectedNote.body}</p>
                </div>
                <div className={styles.sheetSimpleFooter}>
                  <button type="button" className={styles.sheetDoneBtn} onClick={handleClose}>
                    Done
                  </button>
                </div>
              </>
            )}

            {/* Shout-out (not from a note) */}
            {selectedItem.type === "shoutout" && !selectedNote && (
              <>
                <div className={styles.sheetHeader}>
                  <div className={`${styles.sheetIconTile} ${styles.amber}`}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <p className={`${styles.sheetFromLine} ${styles.amber}`}>
                    From {selectedItem.fromFirstName}
                  </p>
                  <h2>Shout-out</h2>
                  <p className={styles.sheetDate}>
                    {formatFullDateTime(selectedItem.createdAt)}
                    {selectedItem.tag && ` · ${TAG_LABELS[selectedItem.tag]}`}
                  </p>
                </div>
                <div className={styles.sheetBody}>
                  <p className={styles.sheetMessage}>&ldquo;{selectedItem.message}&rdquo;</p>
                </div>
                <div className={styles.sheetSimpleFooter}>
                  <button type="button" className={styles.sheetDoneBtn} onClick={handleClose}>
                    Done
                  </button>
                </div>
              </>
            )}

            {/* Announcement */}
            {selectedItem.type === "announcement" && (
              <>
                <div className={styles.sheetHeader}>
                  <div className={`${styles.sheetIconTile} ${styles.navy}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </div>
                  <p className={`${styles.sheetFromLine} ${styles.navy}`}>
                    From {selectedItem.createdByName}
                  </p>
                  <h2>{selectedItem.title}</h2>
                  <p className={styles.sheetDate}>
                    {formatFullDateTime(selectedItem.createdAt)}
                    {selectedItem.editedAt && <span className={styles.editedInline}> (Edited)</span>}
                  </p>
                </div>
                <div className={styles.sheetBody}>
                  <p className={styles.sheetMessage}>{selectedItem.body}</p>
                </div>
                <div className={styles.sheetSimpleFooter}>
                  <button type="button" className={styles.sheetDoneBtn} onClick={handleClose}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Compose Shout-out Sheet */}
      <ComposeShoutOut
        isOpen={showCompose}
        onClose={() => {
          setShowCompose(false);
          setComposeRecipient(null);
          setComposeContext(null);
        }}
        preselectedRecipient={composeRecipient}
        contextData={composeContext}
      />
    </div>
  );
}

// Recent classes card component
function RecentClassesCard({ sessions, onThankClick }) {
  const [showAll, setShowAll] = useState(false);
  const displaySessions = showAll ? sessions : sessions.slice(0, 3);

  if (sessions.length === 0) return null;

  return (
    <div className={styles.recentClassesCard}>
      <h3 className={styles.recentClassesTitle}>From your recent classes</h3>
      <p className={styles.recentClassesSub}>Thank someone you taught with or who covered for you.</p>

      <div className={styles.recentClassesList}>
        {displaySessions.map((session, idx) => {
          const dateParts = getDateParts(session.date);
          return (
            <div key={`${session.classId}-${session.date}-${idx}`} className={styles.recentClassRow}>
              <div className={styles.dateTile}>
                <span className={styles.dateTileDay}>{dateParts.day}</span>
                <span className={styles.dateTileNum}>{dateParts.num}</span>
              </div>
              <div className={styles.recentClassInfo}>
                <div className={styles.recentClassSchool}>{session.schoolName}</div>
                <div className={styles.recentClassWith}>
                  {session.otherPersonAvatar ? (
                    <Image
                      src={session.otherPersonAvatar}
                      alt=""
                      width={20}
                      height={20}
                      className={styles.recentClassAvatar}
                    />
                  ) : (
                    <div className={styles.recentClassAvatarPlaceholder}>
                      {session.otherPersonName?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                  <span>{session.relationText}</span>
                </div>
              </div>
              {session.alreadyThanked ? (
                <span className={styles.thankedLabel}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Thanked
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.thankBtn}
                  onClick={() => onThankClick(session)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Thank
                </button>
              )}
            </div>
          );
        })}
      </div>

      {sessions.length > 3 && (
        <button
          type="button"
          className={styles.showMoreBtn}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show less" : "Show older classes"}
        </button>
      )}
    </div>
  );
}
