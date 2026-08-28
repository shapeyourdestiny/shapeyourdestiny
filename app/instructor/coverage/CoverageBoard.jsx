"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./CoverageBoard.module.css";
import Modal from "@/app/admin/components/Modal";
import {
  claimCoverageRequest,
  cancelCoverageRequest,
  unclaimCoverageRequest,
  createCoverageRequest,
} from "@/lib/coverage/actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Avatar colors
const AVATAR_COLORS = [
  "#D8AE4B", "#6FCB55", "#3FC0E8", "#2B4FA3", "#3E8FA0", "#F2A65E",
];

function getAvatarColor(name) {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDateBlock(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  return {
    dow: DAYS[date.getDay()].toUpperCase(),
    dom: date.getDate(),
    month: MONTHS[date.getMonth()],
  };
}

function formatFullDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function getUrgency(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));

  if (diff <= 3) return { label: "Soon", className: "soon" };
  if (diff <= 7) return { label: "This Week", className: "soon" };
  if (diff <= 14) return { label: "Next Week", className: "week" };
  return null;
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// The reminder text - used in both entry points (Coverage Board and Schedule view)
const COVERAGE_REMINDER_TEXT = "A quick reminder: most of our programs only run 4 to 8 weeks, so having the same instructor each week really matters for the kids in this class. We know life happens, and coverage is here for real situations — we just want to keep it as a last resort rather than a first option. Thanks for everything you do for these kids.";

export default function CoverageBoard({ openRequests, myRequests, profileId, mySessions = [] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filter, setFilter] = useState("all");

  // Post modal state
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postStep, setPostStep] = useState(1); // 1 = session picker, 2 = confirmation
  const [selectedSession, setSelectedSession] = useState(null);
  const [postNote, setPostNote] = useState("");
  const [postError, setPostError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleClaimClick = (request) => {
    setSelectedRequest(request);
    setClaimModalOpen(true);
  };

  const handleConfirmClaim = async () => {
    if (!selectedRequest) return;

    setLoading(true);
    const result = await claimCoverageRequest(selectedRequest.id);
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      setClaimModalOpen(false);
      setSelectedRequest(null);
      router.refresh();
    }
  };

  const handleCancel = async (requestId) => {
    if (!confirm("Cancel this coverage request?")) return;

    setLoading(true);
    const result = await cancelCoverageRequest(requestId);
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  const handleUnclaim = async (requestId) => {
    if (!confirm("Release this coverage? The session will go back to being available for others.")) return;

    setLoading(true);
    const result = await unclaimCoverageRequest(requestId);
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  // Post modal handlers
  const handleOpenPostModal = () => {
    setPostModalOpen(true);
    setPostStep(1);
    setSelectedSession(null);
    setPostNote("");
    setPostError("");
  };

  const handleSelectSession = (session) => {
    setSelectedSession(session);
    setPostStep(2);
    setPostError("");
  };

  const handleBackToStep1 = () => {
    setPostStep(1);
    setSelectedSession(null);
    setPostNote("");
    setPostError("");
  };

  const handleSubmitPost = async () => {
    if (!selectedSession) return;

    setSubmitting(true);
    setPostError("");

    const result = await createCoverageRequest(
      selectedSession.classId,
      selectedSession.date,
      postNote.trim() || null
    );

    setSubmitting(false);

    if (result.error) {
      setPostError(result.error);
    } else {
      setPostModalOpen(false);
      setSelectedSession(null);
      setPostNote("");
      setPostStep(1);
      router.refresh();
    }
  };

  // Filter requests by program
  const filteredRequests = filter === "all"
    ? openRequests
    : openRequests.filter((r) =>
        r.program?.name?.toLowerCase().includes(filter.toLowerCase())
      );

  // Stats
  const openCount = openRequests.length;
  const claimedCount = myRequests.claimed.length;

  return (
    <div className={styles.board}>
      {/* Hero Header */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.heroEyebrow}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.6 6.6L22 9.2l-5.4 4.6L18.2 22 12 17.8 5.8 22l1.6-8.2L2 9.2l7.4-.6z" />
            </svg>
            Coverage Board
          </span>
          <h1 className={styles.heroTitle}>Pick up a session, help a fellow instructor</h1>
          <p className={styles.heroSub}>First to claim gets it. Thank you for stepping up when a teammate needs you.</p>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}>{openCount}</div>
              <div className={styles.heroStatLabel}>Open Now</div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}>{claimedCount}</div>
              <div className={styles.heroStatLabel}>You're Covering</div>
            </div>
          </div>
          <button
            type="button"
            className={styles.postSessionBtn}
            onClick={handleOpenPostModal}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Post a Session for Coverage
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={styles.bodyWrap}>
        {/* Filter Pills */}
        <div className={styles.filterRow}>
          <button
            className={`${styles.filterPill} ${filter === "all" ? styles.active : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`${styles.filterPill} ${filter === "wellness" ? styles.active : ""}`}
            onClick={() => setFilter("wellness")}
          >
            Youth Wellness
          </button>
          <button
            className={`${styles.filterPill} ${filter === "soccer" ? styles.active : ""}`}
            onClick={() => setFilter("soccer")}
          >
            Soccer
          </button>
        </div>

        {/* Open Requests */}
        <div className={styles.sectionLabel}>
          Open Requests
          <span className={styles.sectionCount}>{filteredRequests.length}</span>
        </div>

        {filteredRequests.length === 0 ? (
          <p className={styles.emptyNote}>No open coverage requests right now.</p>
        ) : (
          filteredRequests.map((request) => {
            const dateBlock = formatDateBlock(request.date);
            const urgency = getUrgency(request.date);
            const programColor = request.program?.name?.toLowerCase().includes("wellness")
              ? "#3E8FA0"
              : "#1F3F91";

            return (
              <div key={request.id} className={styles.listing}>
                <div className={styles.dateBlock}>
                  <span className={styles.dow}>{dateBlock.dow}</span>
                  <span className={styles.dom}>{dateBlock.dom}</span>
                </div>

                <div className={styles.listingTop}>
                  <div className={styles.listingSchool}>{request.school?.name}</div>
                  {urgency && (
                    <span className={`${styles.urgencyTag} ${styles[urgency.className]}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 3" />
                      </svg>
                      {urgency.label}
                    </span>
                  )}
                </div>

                <div className={styles.listingMeta}>
                  {request.program && (
                    <span
                      className={styles.programBadge}
                      style={{
                        background: `${programColor}22`,
                        color: programColor,
                      }}
                    >
                      {request.program.name}
                    </span>
                  )}
                  <span className={styles.listingTime}>{request.time}</span>
                </div>

                <div className={styles.listingFrom}>
                  <div
                    className={styles.miniAvatar}
                    style={{ background: getAvatarColor(request.requester?.name || "U") }}
                  >
                    {getInitials(request.requester?.name || "U")}
                  </div>
                  Posted by {request.requester?.name}
                  <span className={styles.postedTime}>{timeAgo(request.createdAt)}</span>
                </div>

                {request.note && (
                  <div className={styles.listingNote}>"{request.note}"</div>
                )}

                <button
                  className={styles.applyBtn}
                  onClick={() => handleClaimClick(request)}
                  disabled={loading}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Claim This Session
                </button>
              </div>
            );
          })
        )}

        {/* My Requests */}
        <div className={styles.sectionLabel}>Your Requests</div>

        {myRequests.requested.length === 0 ? (
          <p className={styles.emptyNote}>You haven't posted any requests.</p>
        ) : (
          myRequests.requested.map((request) => (
            <div key={request.id} className={styles.mineCard}>
              <div className={styles.mineInfo}>
                <div className={styles.mineSchool}>{request.school?.name}</div>
                <div className={styles.mineMeta}>
                  {formatFullDate(request.date)}
                  {request.claimer && ` · Covered by ${request.claimer.name}`}
                </div>
              </div>
              <span className={`${styles.mineStatus} ${request.status === "claimed" ? styles.covered : styles.open}`}>
                {request.status === "claimed" ? "Covered" : "Open"}
              </span>
              {request.status === "open" && (
                <button
                  className={styles.cancelBtn}
                  onClick={() => handleCancel(request.id)}
                  disabled={loading}
                >
                  Cancel
                </button>
              )}
            </div>
          ))
        )}

        {/* Sessions I'm Covering */}
        {myRequests.claimed.length > 0 && (
          <>
            <div className={styles.sectionLabel}>Sessions You're Covering</div>
            {myRequests.claimed.map((request) => (
              <div key={request.id} className={styles.mineCard}>
                <div className={styles.mineInfo}>
                  <div className={styles.mineSchool}>{request.school?.name}</div>
                  <div className={styles.mineMeta}>
                    {formatFullDate(request.date)} · For {request.requester?.name}
                  </div>
                </div>
                <button
                  className={styles.unclaimBtn}
                  onClick={() => handleUnclaim(request.id)}
                  disabled={loading}
                >
                  Release
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Claim Confirmation Modal */}
      <Modal open={claimModalOpen} onClose={() => setClaimModalOpen(false)}>
        <div className={styles.claimModal}>
          <h3>Claim this session?</h3>
          {selectedRequest && (
            <div className={styles.claimSummary}>
              <div className={styles.csSchool}>{selectedRequest.school?.name}</div>
              <div className={styles.csMeta}>
                {formatDateBlock(selectedRequest.date).dow}{" "}
                {formatDateBlock(selectedRequest.date).dom} · {selectedRequest.time}
              </div>
            </div>
          )}
          <p className={styles.claimWarning}>
            <strong>Once confirmed, this is your responsibility.</strong> It can't be un-claimed within 24 hours of the session, and the person who posted it will be notified you've got it.
          </p>
          <div className={styles.claimActions}>
            <button
              className={styles.claimCancel}
              onClick={() => setClaimModalOpen(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className={styles.claimConfirm}
              onClick={handleConfirmClaim}
              disabled={loading}
            >
              {loading ? "Claiming..." : "Yes, Claim It"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Post Session Modal (Two-Step) */}
      <Modal open={postModalOpen} onClose={() => setPostModalOpen(false)}>
        <div className={styles.postModal}>
          {postStep === 1 ? (
            <>
              <h3>Which session?</h3>
              <p className={styles.postModalSubtext}>Select the session you need coverage for</p>

              {mySessions.length === 0 ? (
                <div className={styles.noSessionsNote}>
                  You don't have any upcoming sessions to post.
                </div>
              ) : (
                <div className={styles.sessionPicker}>
                  {mySessions.map((session) => {
                    const dateBlock = formatDateBlock(session.date);
                    return (
                      <button
                        key={session.id}
                        type="button"
                        className={styles.sessionOption}
                        onClick={() => handleSelectSession(session)}
                      >
                        <div className={styles.sessionOptionDate}>
                          <span className={styles.sessionOptionDow}>{dateBlock.dow}</span>
                          <span className={styles.sessionOptionDom}>{dateBlock.dom}</span>
                        </div>
                        <div className={styles.sessionOptionInfo}>
                          <span className={styles.sessionOptionSchool}>{session.school.name}</span>
                          <span className={styles.sessionOptionMeta}>
                            {session.time}
                            {session.district && ` · ${session.district.name}`}
                          </span>
                        </div>
                        <svg className={styles.sessionOptionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <h3>Post to the board</h3>
              {selectedSession && (
                <div className={styles.claimSummary}>
                  <div className={styles.csSchool}>{selectedSession.school.name}</div>
                  <div className={styles.csMeta}>
                    {formatFullDate(selectedSession.date)} · {selectedSession.time}
                  </div>
                </div>
              )}
              <p className={styles.postReminder}>
                {COVERAGE_REMINDER_TEXT}
              </p>
              <div className={styles.postNoteField}>
                <label htmlFor="postNote">Reason (optional)</label>
                <textarea
                  id="postNote"
                  value={postNote}
                  onChange={(e) => setPostNote(e.target.value)}
                  placeholder="Let others know why you need coverage..."
                />
              </div>
              {postError && (
                <div className={styles.postError}>{postError}</div>
              )}
              <div className={styles.postActions}>
                <button
                  type="button"
                  className={styles.claimCancel}
                  onClick={handleBackToStep1}
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={styles.claimConfirm}
                  onClick={handleSubmitPost}
                  disabled={submitting}
                >
                  {submitting ? "Posting..." : "Post to Board"}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
