"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import styles from "./Inbox.module.css";
import { markNoteViewed, markInboxRead, markAllRead } from "@/lib/instructor/actions";
import ComposeShoutOut from "./ComposeShoutOut";

const TAG_LABELS = {
  saved_the_day: "Saved the day",
  great_with_kids: "Great with the kids",
  team_player: "Team player",
  made_it_fun: "Made it fun",
  super_prepared: "Super prepared",
};

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Format time for card display (e.g., "3:12 pm", "Mon", "Oct 23")
 */
function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today - dateDay) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today - show time
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    return `${displayHours}:${displayMinutes} ${ampm}`;
  } else if (diffDays < 7) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[date.getDay()];
  } else {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }
}

/**
 * Format full date/time for expanded display
 */
function formatFullDateTime(dateStr, schoolName = null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today - dateDay) / (1000 * 60 * 60 * 24));

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  const timeStr = `${displayHours}:${displayMinutes} ${ampm}`;

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let dateText;
  if (diffDays === 0) {
    dateText = `Today, ${timeStr}`;
  } else if (diffDays === 1) {
    dateText = `Yesterday, ${timeStr}`;
  } else {
    dateText = `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${timeStr}`;
  }

  if (schoolName) {
    return `${dateText} at ${schoolName}`;
  }
  return dateText;
}

/**
 * Format date for pinned until display
 */
function formatPinnedUntil(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `Until ${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Get date parts for date tile display
 */
function getDateParts(dateStr) {
  if (!dateStr) return { day: "", num: "" };
  const date = new Date(dateStr + "T00:00:00");
  return {
    day: DAYS_SHORT[date.getDay()],
    num: date.getDate(),
  };
}

/**
 * Format session date for display
 */
function formatDayDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Group items by Today, This week, Earlier
 */
function groupByDate(items) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups = {
    today: [],
    thisWeek: [],
    earlier: [],
  };

  items.forEach((item) => {
    const itemDate = new Date(item.createdAt || item.sharedAt || item.reviewedAt || "");
    const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

    if (itemDay.getTime() === today.getTime()) {
      groups.today.push(item);
    } else if (itemDay > weekAgo) {
      groups.thisWeek.push(item);
    } else {
      groups.earlier.push(item);
    }
  });

  return groups;
}

/**
 * Truncate text to a certain length
 */
function truncate(text, maxLength = 60) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

export default function InboxClient({ inboxData, profile }) {
  const router = useRouter();
  const [tab, setTab] = useState("updates");
  const [expandedId, setExpandedId] = useState(null);
  const [localReads, setLocalReads] = useState({});
  const [loading, setLoading] = useState(false);
  const [pinnedExpanded, setPinnedExpanded] = useState({});
  const [showCompose, setShowCompose] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState(null);
  const [composeContext, setComposeContext] = useState(null);

  const { updates, shoutOuts, recentSessions = [] } = inboxData;

  // Calculate unread counts considering local reads
  const getUnreadCount = (items) => {
    return items.filter((item) => {
      if (item.needsYou) return false;
      if (localReads[item.id]) return false;
      return !item.isRead;
    }).length;
  };

  const currentUnreadUpdates = getUnreadCount(updates);
  const currentUnreadShoutOuts = getUnreadCount(shoutOuts);
  const totalUnread = currentUnreadUpdates + currentUnreadShoutOuts;

  // Pinned items (for Updates tab only)
  const pinnedItems = tab === "updates"
    ? updates.filter((i) => i.isPinned && !i.needsYou)
    : [];

  // Needs You items
  const needsYouItems = (tab === "updates" ? updates : shoutOuts).filter((i) => i.needsYou);

  // Regular items (not pinned, not needs you)
  const regularItems = (tab === "updates" ? updates : shoutOuts).filter(
    (i) => !i.isPinned && !i.needsYou
  );

  // Group regular items by date
  const groupedItems = groupByDate(regularItems);

  // Check if has unread items
  const hasUnread = currentUnreadUpdates > 0 || currentUnreadShoutOuts > 0;

  // Handle card toggle
  const handleToggle = async (item) => {
    const isOpening = expandedId !== item.id;

    if (isOpening) {
      // Close any open card first
      setExpandedId(item.id);

      // Mark as read if unread
      if (!item.isRead && !item.needsYou && !localReads[item.id]) {
        setLocalReads((prev) => ({ ...prev, [item.id]: true }));
        const [type, id] = item.id.split(":");
        await markInboxRead(type, id);

        // Mark note as viewed if applicable
        if (item.noteId) {
          await markNoteViewed(item.noteId);
        }
      }
    } else {
      // Close the card
      setExpandedId(null);
    }
  };

  // Handle payroll check click - navigate instead of expand
  const handlePayrollClick = async (item) => {
    if (!item.isRead && !localReads[item.id]) {
      setLocalReads((prev) => ({ ...prev, [item.id]: true }));
      await markInboxRead("payrollcheck", item.periodStart);
    }
    router.push(`/instructor/past?period=${item.periodStart}`);
  };

  // Handle payroll issue resolved click
  const handlePayrollIssueClick = async (item) => {
    if (!item.isRead && !localReads[item.id]) {
      setLocalReads((prev) => ({ ...prev, [item.id]: true }));
      await markInboxRead("payrollissue", item.issueId);
    }
    router.push("/instructor/past");
  };

  // Handle mark all read
  const handleMarkAllRead = async () => {
    setLoading(true);
    // Mark all locally immediately
    const allItems = [...updates, ...shoutOuts];
    const newReads = {};
    allItems.forEach((item) => {
      if (!item.isRead && !item.needsYou) {
        newReads[item.id] = true;
      }
    });
    setLocalReads((prev) => ({ ...prev, ...newReads }));

    // Then sync to server
    await markAllRead("all");
    setLoading(false);
    router.refresh();
  };

  // Handle pinned toggle
  const handlePinnedToggle = async (item) => {
    const wasExpanded = pinnedExpanded[item.id];
    setPinnedExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }));

    // Mark as read when expanding (not collapsing)
    if (!wasExpanded && !item.isRead && !localReads[item.id]) {
      setLocalReads((prev) => ({ ...prev, [item.id]: true }));
      const [type, id] = item.id.split(":");
      await markInboxRead(type, id);
    }
  };

  // Handle thank click
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

  // Keyboard navigation for tabs
  const handleTabKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setTab((prev) => (prev === "updates" ? "shoutouts" : "updates"));
    }
  };

  // Get avatar initial
  const getInitial = (name) => {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  };

  // Render a card item
  const renderCard = (item, isRead) => {
    const isExpanded = expandedId === item.id;
    const actuallyRead = isRead || localReads[item.id];

    // Handle special click actions
    if (item.type === "payroll_check") {
      return (
        <div
          key={item.id}
          className={`${styles.card} ${!actuallyRead ? styles.cardUnread : ""}`}
        >
          <button
            type="button"
            className={styles.cardHeader}
            onClick={() => handlePayrollClick(item)}
            aria-label={`Check your classes for ${item.periodRange}`}
          >
            <div className={styles.avatar}>
              <div className={`${styles.avatarCircle} ${styles.avatarTeal}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              {!actuallyRead && <span className={styles.unreadDot} aria-hidden="true" />}
            </div>
            <div className={styles.cardMain}>
              <div className={`${styles.cardFrom} ${styles.cardFromTeal}`}>
                Class check
              </div>
              <p className={`${styles.cardTitle} ${actuallyRead ? styles.cardTitleRead : ""}`}>
                Check your classes for {item.periodRange}
              </p>
              <p className={styles.cardPreview}>
                Due {formatDayDate(item.deadline)}. Takes a few seconds.
              </p>
            </div>
            <div className={styles.cardMeta}>
              <span className={styles.cardTime}>{formatTimeAgo(item.createdAt)}</span>
              <svg className={styles.cardChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
            {!actuallyRead && <span className={styles.srOnly}>New</span>}
          </button>
        </div>
      );
    }

    if (item.type === "payroll_issue_resolved") {
      return (
        <div
          key={item.id}
          className={`${styles.card} ${!actuallyRead ? styles.cardUnread : ""}`}
        >
          <button
            type="button"
            className={styles.cardHeader}
            onClick={() => handlePayrollIssueClick(item)}
            aria-label={`The office fixed your ${item.periodRange} classes`}
          >
            <div className={styles.avatar}>
              <div className={`${styles.avatarCircle} ${styles.avatarTeal}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              {!actuallyRead && <span className={styles.unreadDot} aria-hidden="true" />}
            </div>
            <div className={styles.cardMain}>
              <div className={`${styles.cardFrom} ${styles.cardFromTeal}`}>
                Issue resolved
              </div>
              <p className={`${styles.cardTitle} ${actuallyRead ? styles.cardTitleRead : ""}`}>
                The office fixed your {item.periodRange} classes
              </p>
              {item.resolutionNote && (
                <p className={styles.cardPreview}>{truncate(item.resolutionNote)}</p>
              )}
            </div>
            <div className={styles.cardMeta}>
              <span className={styles.cardTime}>{formatTimeAgo(item.resolvedAt)}</span>
              <svg className={styles.cardChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
            {!actuallyRead && <span className={styles.srOnly}>New</span>}
          </button>
        </div>
      );
    }

    // Session review card - special gradient card at top of Updates
    if (item.type === "session_review") {
      return (
        <div key={item.id} className={styles.sessionReviewCard}>
          <div className={styles.sessionReviewTop}>
            <div className={styles.sessionReviewIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <span className={styles.sessionReviewLabel}>SESSION REVIEW</span>
          </div>
          <h3 className={styles.sessionReviewTitle}>{item.schoolName} is a wrap!</h3>
          <p className={styles.sessionReviewText}>
            You taught {item.classesTaught} {item.classesTaught === 1 ? "class" : "classes"} this session. Tell us how it went. It takes about 2 minutes.
          </p>
          <div className={styles.sessionReviewActions}>
            <Link
              href={`/instructor/review/${item.reviewId}`}
              className={styles.sessionReviewBtn}
            >
              Start review
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <span className={`${styles.sessionReviewDue} ${item.isOverdue ? styles.sessionReviewDueOverdue : ""}`}>
              {item.isOverdue ? `Overdue` : `Due ${formatDayDate(item.dueDate)}`}
            </span>
          </div>
        </div>
      );
    }

    // Expandable cards
    const expandId = `expand-${item.id}`;

    // Get avatar style and content based on type
    let avatarClass = styles.avatarNavy;
    let avatarContent = getInitial(item.createdByName || item.fromFirstName || item.fromName);
    let fromLabel = "";
    let fromClass = styles.cardFromNavy;

    if (item.type === "announcement") {
      avatarClass = styles.avatarNavy;
      avatarContent = getInitial(item.createdByName);
      fromLabel = item.createdByName || "Team";
      fromClass = styles.cardFromNavy;
    } else if (item.type === "subbing") {
      avatarClass = styles.avatarTeal;
      avatarContent = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
      fromLabel = "Schedule change";
      fromClass = styles.cardFromTeal;
    } else if (item.type === "shoutout" || item.type === "recognition") {
      avatarClass = styles.avatarAmber;
      avatarContent = getInitial(item.fromFirstName || item.fromName);
      fromLabel = `Shout-out from ${item.fromFirstName || item.fromName || "someone"}`;
      fromClass = styles.cardFromAmber;
    } else if (item.type === "review") {
      avatarClass = styles.avatarTeal;
      avatarContent = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
      fromLabel = "Review";
      fromClass = styles.cardFromTeal;
    } else if (item.type === "needs_ack") {
      avatarClass = styles.avatarNavy;
      avatarContent = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      );
      fromLabel = item.step;
      fromClass = styles.cardFromNavy;
    }

    // Get title and preview
    let title = item.title || "";
    let preview = "";
    if (item.type === "announcement") {
      preview = truncate(item.body);
    } else if (item.type === "subbing") {
      title = `You're covering ${item.schoolName || "a class"}`;
      preview = `${formatDayDate(item.sessionDate)} at ${item.time} for ${item.forName}`;
    } else if (item.type === "shoutout") {
      title = "Shout-out";
      preview = truncate(item.message);
    } else if (item.type === "recognition") {
      preview = truncate(item.body);
    } else if (item.type === "review") {
      title = `Your ${item.title || "review"} is ready`;
      preview = "Tap to read and reply.";
    } else if (item.type === "needs_ack") {
      title = "Please read and acknowledge";
      preview = formatDayDate(item.sharedAt);
    }

    return (
      <div
        key={item.id}
        className={`${styles.card} ${!actuallyRead ? styles.cardUnread : ""} ${isExpanded ? styles.cardExpanded : ""} ${item.needsYou ? styles.needsYouCard : ""}`}
      >
        <button
          type="button"
          className={styles.cardHeader}
          onClick={() => handleToggle(item)}
          aria-expanded={isExpanded}
          aria-controls={expandId}
        >
          <div className={styles.avatar}>
            <div className={`${styles.avatarCircle} ${avatarClass}`}>
              {typeof avatarContent === "string" ? avatarContent : avatarContent}
            </div>
            {!actuallyRead && !item.needsYou && <span className={styles.unreadDot} aria-hidden="true" />}
          </div>
          <div className={styles.cardMain}>
            <div className={`${styles.cardFrom} ${fromClass}`}>
              {fromLabel}
            </div>
            <p className={`${styles.cardTitle} ${actuallyRead && !item.needsYou ? styles.cardTitleRead : ""}`}>
              {title}
            </p>
            {!isExpanded && preview && (
              <p className={styles.cardPreview}>{preview}</p>
            )}
          </div>
          <div className={styles.cardMeta}>
            <span className={styles.cardTime}>
              {formatTimeAgo(item.createdAt || item.sharedAt || item.reviewedAt)}
            </span>
            {item.needsYou ? (
              <span className={styles.needsYouBadge}>Needs you</span>
            ) : (
              <svg
                className={`${styles.cardChevron} ${isExpanded ? styles.cardChevronOpen : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </div>
          {!actuallyRead && !item.needsYou && <span className={styles.srOnly}>New</span>}
        </button>

        {/* Expanded content */}
        {isExpanded && (
        <div
          id={expandId}
          className={styles.expandWrapper}
          aria-hidden={!isExpanded}
        >
          <div className={styles.expandContent}>
            {item.type === "announcement" && (
              <>
                <p className={styles.expandMessage}>{item.body}</p>
                <div className={styles.expandFooter}>
                  <span className={styles.expandDate}>
                    {formatFullDateTime(item.createdAt)}
                    {item.editedAt && " (Edited)"}
                  </span>
                </div>
              </>
            )}

            {item.type === "subbing" && (
              <>
                <div className={styles.scheduleBox}>
                  <p className={styles.scheduleInfo}>
                    <strong>{formatDayDate(item.sessionDate)}</strong> at {item.time}
                    <br />
                    Covering for {item.forName} at {item.schoolName}
                  </p>
                </div>
                <div className={styles.expandFooter}>
                  <span className={styles.expandDate}>
                    {formatFullDateTime(item.createdAt)}
                  </span>
                  <Link href="/instructor/dashboard" className={styles.expandLink}>
                    View schedule
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </div>
              </>
            )}

            {(item.type === "shoutout" || item.type === "recognition") && (
              <>
                <div className={styles.quoteBox}>
                  <svg className={styles.quoteIcon} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                  <p className={styles.quoteText}>
                    {item.message || item.body}
                  </p>
                </div>
                <div className={styles.expandFooter}>
                  <span className={styles.expandDate}>
                    {formatFullDateTime(item.reviewedAt || item.sharedAt || item.createdAt)}
                    {item.tag && ` - ${TAG_LABELS[item.tag] || item.tag}`}
                  </span>
                </div>
              </>
            )}

            {item.type === "review" && (
              <>
                <p className={styles.expandMessage}>
                  Your review is ready to read. Tap below to see it and add your thoughts.
                </p>
                <div className={styles.expandFooter}>
                  <span className={styles.expandDate}>
                    {formatFullDateTime(item.sharedAt)}
                  </span>
                  <Link href="/instructor/profile" className={styles.expandLink}>
                    View review
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </div>
              </>
            )}

            {item.type === "needs_ack" && (
              <>
                <p className={styles.expandMessage}>
                  Please read and acknowledge this notice.
                </p>
                <div className={styles.expandFooter}>
                  <span className={styles.expandDate}>
                    {formatFullDateTime(item.sharedAt)}
                  </span>
                  <Link href="/instructor/profile" className={styles.expandLink}>
                    View and acknowledge
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </div>
    );
  };

  // Render group section
  const renderGroup = (items, label) => {
    if (items.length === 0) return null;

    return (
      <div className={styles.group}>
        <div className={styles.groupHeader}>
          <span className={styles.groupLabel}>{label}</span>
          <div className={styles.groupLine} />
        </div>
        {items.map((item) => renderCard(item, item.isRead))}
      </div>
    );
  };

  // Render empty state
  const renderEmpty = () => (
    <div className={styles.emptyCard}>
      <div className={styles.emptyIcon}>
        {tab === "updates" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )}
      </div>
      <h2 className={styles.emptyTitle}>
        {tab === "updates" ? "No updates yet" : "No shout-outs yet"}
      </h2>
      <p className={styles.emptySub}>
        {tab === "updates"
          ? "News from the team shows up here."
          : "When a teammate sends you one, it shows up here."}
      </p>
    </div>
  );

  // Render recent classes card (for shout-outs)
  const renderRecentClasses = () => {
    if (recentSessions.length === 0) return null;

    return (
      <div className={styles.recentCard}>
        <h3 className={styles.recentTitle}>From your recent classes</h3>
        <p className={styles.recentSub}>Thank someone you taught with or who covered for you.</p>
        <div className={styles.recentList}>
          {recentSessions.slice(0, 3).map((session, idx) => {
            const dateParts = getDateParts(session.date);
            return (
              <div key={`${session.classId}-${session.date}-${idx}`} className={styles.recentRow}>
                <div className={styles.recentDateTile}>
                  <span className={styles.recentDateDay}>{dateParts.day}</span>
                  <span className={styles.recentDateNum}>{dateParts.num}</span>
                </div>
                <div className={styles.recentInfo}>
                  <div className={styles.recentSchool}>{session.schoolName}</div>
                  <div className={styles.recentWith}>
                    {session.otherPersonAvatar ? (
                      <Image
                        src={session.otherPersonAvatar}
                        alt=""
                        width={18}
                        height={18}
                        className={styles.recentAvatarSmall}
                      />
                    ) : (
                      <div className={styles.recentAvatarPlaceholder}>
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
                    onClick={() => handleThankClick(session)}
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
        <Link href="/instructor/past" className={styles.pastLink}>
          Past classes
        </Link>
      </div>
    );
  };

  // Check if any content exists
  const currentItems = tab === "updates" ? updates : shoutOuts;
  const hasContent = currentItems.length > 0 || (tab === "shoutouts" && recentSessions.length > 0);

  return (
    <div className={styles.page}>
      {/* Header with navy band */}
      <div className={styles.header}>
        {/* Desktop only: logo and avatar (mobile shows shell header) */}
        <div className={styles.headerTop}>
          <Image
            src="/Images/footer_logo_gold.webp"
            alt="Shape Your Destiny"
            width={120}
            height={22}
            className={styles.headerLogo}
          />
          <Link href="/instructor/profile" className={styles.headerAvatar}>
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt="Profile"
                width={36}
                height={36}
                className={styles.headerAvatarImg}
              />
            ) : (
              <span className={styles.headerAvatarInitial}>
                {profile?.full_name?.charAt(0)?.toUpperCase() || "I"}
              </span>
            )}
          </Link>
        </div>

        <div className={styles.headerTitle}>
          <div>
            <h1>Inbox</h1>
            <p className={`${styles.headerSub} ${totalUnread === 0 ? styles.headerSubCaughtUp : ""}`}>
              {totalUnread === 0
                ? "You're all caught up"
                : totalUnread === 1
                ? "1 new message"
                : `${totalUnread} new messages`}
            </p>
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
      </div>

      {/* Tab card */}
      <div className={styles.tabCard} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "updates"}
          className={`${styles.tab} ${tab === "updates" ? styles.tabActive : ""}`}
          onClick={() => setTab("updates")}
          onKeyDown={handleTabKeyDown}
        >
          Updates
          {currentUnreadUpdates > 0 && (
            <span className={styles.tabBadge} aria-label={`${currentUnreadUpdates} unread`}>
              {currentUnreadUpdates}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "shoutouts"}
          className={`${styles.tab} ${tab === "shoutouts" ? styles.tabActive : ""}`}
          onClick={() => setTab("shoutouts")}
          onKeyDown={handleTabKeyDown}
        >
          Shout-outs
          {currentUnreadShoutOuts > 0 && (
            <span className={styles.tabBadge} aria-label={`${currentUnreadShoutOuts} unread`}>
              {currentUnreadShoutOuts}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {!hasContent && renderEmpty()}

        {hasContent && (
          <>
            {/* Pinned items */}
            {pinnedItems.map((item) => {
              const isExpanded = pinnedExpanded[item.id];
              const previewText = item.body?.split("\n")[0] || "";
              const hasMore = item.body && item.body.length > previewText.length;

              return (
                <div key={item.id} className={styles.pinnedCard}>
                  <div className={styles.pinnedTop}>
                    <svg className={styles.pinnedIcon} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 4l3 3-2 2-3-3v3l-4 4-2-2 4-4h-3l-3-3 2-2 8 2z" />
                      <path d="M10 14l-6 6" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                    <span className={styles.pinnedLabel}>Pinned</span>
                    <span className={styles.pinnedUntil}>{formatPinnedUntil(item.pinnedUntil)}</span>
                  </div>
                  <h3 className={styles.pinnedTitle}>{item.title}</h3>
                  {isExpanded ? (
                    <p className={styles.pinnedFull}>
                      {item.body}
                      {hasMore && (
                        <button
                          type="button"
                          className={styles.pinnedToggle}
                          onClick={() => handlePinnedToggle(item)}
                        >
                          Show less
                        </button>
                      )}
                    </p>
                  ) : (
                    <p className={styles.pinnedPreview}>
                      {truncate(previewText, 100)}
                      {hasMore && (
                        <button
                          type="button"
                          className={styles.pinnedToggle}
                          onClick={() => handlePinnedToggle(item)}
                        >
                          Read more
                        </button>
                      )}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Needs You section */}
            {needsYouItems.length > 0 && renderGroup(needsYouItems, "Needs you")}

            {/* Date groups */}
            {renderGroup(groupedItems.today, "Today")}
            {renderGroup(groupedItems.thisWeek, "This week")}
            {renderGroup(groupedItems.earlier, "Earlier")}

            {/* Recent classes for shout-outs tab */}
            {tab === "shoutouts" && renderRecentClasses()}
          </>
        )}
      </div>

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
