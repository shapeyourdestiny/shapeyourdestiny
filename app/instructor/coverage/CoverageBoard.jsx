"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./CoverageBoard.module.css";
import Modal from "@/app/admin/components/Modal";
import { claimCoverageRequest, unclaimCoverageRequest } from "@/lib/coverage/actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

export default function CoverageBoard({ openRequests, myRequests }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filter, setFilter] = useState("all");

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
              <div className={styles.heroStatLabel}>You&apos;re Covering</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={styles.bodyWrap}>
        {/* Reliability Note */}
        <div className={styles.reliabilityNote}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 2l2.6 6.6L22 9.2l-5.4 4.6L18.2 22 12 17.8 5.8 22l1.6-8.2L2 9.2l7.4-.6z" />
          </svg>
          <p>
            <strong>Our programs typically run just 4 to 8 weeks</strong>, so the kids in each
            class come to count on seeing the same instructors, week after week. That consistency
            is a real part of what makes this work for them—thank you for treating every session
            like it matters, because it does.
          </p>
        </div>

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

        {/* You're Covering Section */}
        {myRequests.claimed.length > 0 && (
          <>
            <div className={styles.sectionLabel}>
              You&apos;re Covering
              <span className={styles.sectionCount}>{myRequests.claimed.length}</span>
            </div>
            {myRequests.claimed.map((request) => (
              <div key={request.id} className={styles.coveringCard}>
                <div className={styles.coveringTag}>YOU&apos;RE COVERING</div>
                <div className={styles.ccSchool}>{request.school?.name}</div>
                <div className={styles.ccMeta}>
                  {formatFullDate(request.date)} · {request.time}
                </div>
                <div className={styles.ccFor}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                  Covering for {request.requester?.name}
                </div>
                <button
                  className={styles.releaseBtn}
                  onClick={() => handleUnclaim(request.id)}
                  disabled={loading}
                >
                  Release
                </button>
              </div>
            ))}
          </>
        )}

        {/* Open Requests */}
        <div className={styles.sectionLabel} style={myRequests.claimed.length > 0 ? { marginTop: 26 } : {}}>
          Open Requests
          <span className={styles.sectionCount}>{filteredRequests.length}</span>
        </div>

        {filteredRequests.length === 0 ? (
          <div className={styles.emptyCard}>
            <div className={styles.emptyIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p>Nothing open right now</p>
            <span>Every session&apos;s covered, check back anytime.</span>
          </div>
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

                {/* Posted by admin line with star icon */}
                {request.postedBy && (
                  <div className={styles.postedByAdmin}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l2.6 6.6L22 9.2l-5.4 4.6L18.2 22 12 17.8 5.8 22l1.6-8.2L2 9.2l7.4-.6z" />
                    </svg>
                    Posted by {request.postedBy.name}
                  </div>
                )}

                {request.note && (
                  <div className={styles.listingNote}>&quot;{request.note}&quot;</div>
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

        {/* Covered For You - sessions where admin posted coverage for this instructor */}
        {myRequests.coveredForYou.length > 0 && (
          <>
            <div className={styles.sectionLabel}>Covered For You</div>
            {myRequests.coveredForYou.map((request) => (
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
            <strong>Once confirmed, this is your responsibility.</strong> It can&apos;t be un-claimed within 24 hours of the session, and the person who&apos;s out will be notified you&apos;ve got it.
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
    </div>
  );
}
