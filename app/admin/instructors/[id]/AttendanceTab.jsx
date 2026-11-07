"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./AttendanceTab.module.css";
import {
  logTimeOffRequest,
  approveTimeOffRequest,
  declineTimeOffRequest,
  cancelTimeOffRequest,
} from "@/lib/instructors/time-off-actions";

const MONTH_LABELS = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

const REASON_LABELS = {
  vacation: "Vacation",
  sick: "Sick",
  appointment: "Appointment",
  personal: "Personal",
  emergency: "Emergency",
  other: "Other",
};

function formatDateShort(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function formatDateRange(start, end) {
  if (start === end) {
    return formatDateShort(start);
  }
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (startDate.getMonth() === endDate.getMonth()) {
    return `${months[startDate.getMonth()]} ${startDate.getDate()} - ${endDate.getDate()}`;
  }
  return `${months[startDate.getMonth()]} ${startDate.getDate()} - ${months[endDate.getMonth()]} ${endDate.getDate()}`;
}

function formatFullDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function getDateParts(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    month: months[date.getMonth()],
    day: date.getDate(),
  };
}

function getTodayStr() {
  const now = new Date();
  const laDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const y = laDate.getFullYear();
  const m = String(laDate.getMonth() + 1).padStart(2, "0");
  const d = String(laDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AttendanceTab({ instructor, attendanceData, onRefresh }) {
  const router = useRouter();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(null);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [showAllCovered, setShowAllCovered] = useState(false);
  const [loading, setLoading] = useState(false);

  // Request form state
  const [requestStartDate, setRequestStartDate] = useState(getTodayStr);
  const [requestEndDate, setRequestEndDate] = useState(getTodayStr);
  const [requestReason, setRequestReason] = useState("vacation");
  const [requestNote, setRequestNote] = useState("");
  const [requestedOn, setRequestedOn] = useState(getTodayStr);

  // Decline note
  const [declineNote, setDeclineNote] = useState("");

  const { daysOut, stats, monthByMonth, byReason, coveredForOthers, requests } = attendanceData;
  const firstName = instructor.full_name.split(" ")[0];

  const handleLogRequest = async () => {
    setLoading(true);
    const result = await logTimeOffRequest({
      profileId: instructor.id,
      startDate: requestStartDate,
      endDate: requestEndDate,
      reason: requestReason,
      note: requestNote,
      requestedOn,
    });
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      setShowRequestModal(false);
      setRequestStartDate(getTodayStr());
      setRequestEndDate(getTodayStr());
      setRequestReason("vacation");
      setRequestNote("");
      setRequestedOn(getTodayStr());
      if (onRefresh) onRefresh();
    }
  };

  const handleApprove = async (requestId) => {
    if (!confirm("Approve this time off request? This will mark them out on the Schedule Board for all affected classes.")) {
      return;
    }
    setLoading(true);
    const result = await approveTimeOffRequest(requestId);
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      if (onRefresh) onRefresh();
    }
  };

  const handleDecline = async (requestId) => {
    setLoading(true);
    const result = await declineTimeOffRequest(requestId, declineNote);
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      setShowDeclineModal(null);
      setDeclineNote("");
      if (onRefresh) onRefresh();
    }
  };

  const handleCancel = async (requestId) => {
    if (!confirm("Cancel this time off? Future classes marked out will be restored.")) {
      return;
    }
    setLoading(true);
    const result = await cancelTimeOffRequest(requestId);
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      if (onRefresh) onRefresh();
    }
  };

  // Filter requests for display
  const visibleRequests = showAllRequests ? requests : requests.slice(0, 5);
  const visibleCovered = showAllCovered ? coveredForOthers : coveredForOthers.slice(0, 6);

  // Calculate max for reason bars
  const maxReasonCount = Math.max(...Object.values(byReason), 1);

  return (
    <div className={styles.container}>
      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statTile}>
          <div className={styles.statValue}>{stats.totalDaysOut}</div>
          <div className={styles.statLabel}>Days out</div>
          <div className={styles.statSub}>
            {stats.totalDaysOut === 0
              ? "No days out this school year"
              : `Since Aug 1 ${stats.oneInN ? `· about 1 in ${stats.oneInN} classes` : ""}`}
          </div>
        </div>

        <div className={styles.statTile}>
          <div className={`${styles.statValue} ${stats.withWeekNotice === stats.totalWithNotice && stats.totalDaysOut > 0 ? styles.green : ""}`}>
            {stats.withWeekNotice} of {stats.totalWithNotice}
          </div>
          <div className={styles.statLabel}>With a week or more notice</div>
          <div className={styles.statSub}>
            {stats.sameDayByReason.length > 0
              ? stats.sameDayByReason.map((s, i) => (
                  <span key={s.reason}>
                    {i > 0 ? ", " : ""}
                    {s.count} was same day ({s.reason})
                  </span>
                ))
              : stats.totalDaysOut > 0
              ? "All had advance notice"
              : ""}
          </div>
        </div>

        <div className={styles.statTile}>
          <div className={`${styles.statValue} ${stats.classesWithoutSub === 0 ? styles.green : styles.red}`}>
            {stats.classesWithoutSub}
          </div>
          <div className={styles.statLabel}>Classes left without a sub</div>
          <div className={styles.statSub}>
            {stats.classesWithoutSub === 0 && stats.totalDaysOut > 0
              ? "Every day out was covered"
              : stats.classesWithoutSub > 0
              ? `${stats.classesWithoutSub} classes ran short`
              : ""}
          </div>
        </div>

        <div className={styles.statTile}>
          <div className={styles.statValue}>{stats.timesSubbed}</div>
          <div className={styles.statLabel}>Times subbed for others</div>
          <div className={styles.statSub}>Since Aug 1</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className={styles.columns}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          {/* Time Off Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Time off</h3>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => setShowRequestModal(true)}
              >
                + Log a request
              </button>
            </div>

            {requests.length === 0 ? (
              <div className={styles.emptyState}>
                No time off logged. When {firstName} texts asking for time off, log it here.
              </div>
            ) : (
              <div className={styles.requestList}>
                {visibleRequests.map((req) => (
                  <div key={req.id} className={styles.requestRow}>
                    <div className={styles.requestMain}>
                      <div className={styles.requestLine1}>
                        <span className={styles.requestDates}>
                          {formatDateRange(req.startDate, req.endDate)}
                        </span>
                        <span className={`${styles.statusPill} ${styles[req.status]}`}>
                          {req.status === "pending" ? "Waiting on you" : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </div>
                      <div className={styles.requestLine2}>
                        {REASON_LABELS[req.reason] || req.reason} · texted {formatFullDate(req.requestedOn)} · {req.noticeText} notice
                        {req.status === "approved" && req.deciderName && (
                          <> · approved by {req.deciderName}</>
                        )}
                        {req.status === "declined" && (
                          <> · declined{req.decisionNote ? `, ${req.decisionNote}` : ""}</>
                        )}
                      </div>
                      <div className={styles.requestLine3}>
                        {req.affectedClasses.length === 0 ? (
                          <span className={styles.textGreen}>No classes affected</span>
                        ) : req.status === "declined" ? (
                          <span className={styles.textMuted}>Taught as scheduled</span>
                        ) : req.classesNeedingSub > 0 ? (
                          <span className={styles.textRed}>
                            {req.classesNeedingSub} class{req.classesNeedingSub > 1 ? "es" : ""} need{req.classesNeedingSub === 1 ? "s" : ""} a sub
                          </span>
                        ) : (
                          <span>
                            {req.affectedClasses.length} class{req.affectedClasses.length > 1 ? "es" : ""}
                            {req.affectedClasses.length <= 3 && (
                              <>: {req.affectedClasses.map(c => c.schoolName).join(", ")}</>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.requestActions}>
                      {req.status === "pending" && (
                        <>
                          <button
                            type="button"
                            className={styles.primaryBtn}
                            onClick={() => handleApprove(req.id)}
                            disabled={loading}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            onClick={() => setShowDeclineModal(req.id)}
                            disabled={loading}
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {req.status === "approved" && req.classesNeedingSub > 0 && (
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          onClick={() => router.push(`/admin/schedule?absence=${req.absenceGroupId}`)}
                        >
                          Find subs
                        </button>
                      )}
                      {req.status === "approved" && req.startDate >= getTodayStr() && (
                        <div className={styles.menuWrap}>
                          <button type="button" className={styles.menuBtn}>⋯</button>
                          <div className={styles.menuDropdown}>
                            <button onClick={() => handleCancel(req.id)} disabled={loading}>
                              Cancel time off
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {requests.length > 5 && !showAllRequests && (
                  <button
                    type="button"
                    className={styles.showAllBtn}
                    onClick={() => setShowAllRequests(true)}
                  >
                    Show all
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Days Out Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Days out</h3>
              <span className={styles.cardHeaderSub}>This school year, newest first</span>
            </div>

            {daysOut.length === 0 ? (
              <div className={styles.emptyState}>No days out this school year.</div>
            ) : (
              <div className={styles.daysOutList}>
                {daysOut.map((day) => {
                  const parts = getDateParts(day.date);
                  return (
                    <div key={day.date} className={styles.dayOutRow}>
                      <div className={styles.dateTile}>
                        <span className={styles.dateMonth}>{parts.month}</span>
                        <span className={styles.dateDay}>{parts.day}</span>
                      </div>
                      <div className={styles.dayOutMain}>
                        <div className={styles.dayOutTitle}>
                          Out · {REASON_LABELS[day.reason] || day.reason}
                        </div>
                        <div className={styles.dayOutSub}>
                          {day.sessions.map((s, i) => (
                            <span key={s.id}>
                              {i > 0 ? " · " : ""}
                              {s.schoolName} {s.time}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={styles.dayOutRight}>
                        <span className={`${styles.noticePill} ${styles[day.noticeLevel]}`}>
                          {day.noticeText}
                        </span>
                        {day.sessions.some(s => s.hasSub) ? (
                          <span className={styles.subText}>
                            {day.sessions.find(s => s.subName)?.subName || "Sub"} subbed
                          </span>
                        ) : (
                          <span className={styles.noSubText}>No sub</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          {/* Month by Month */}
          <div className={styles.card}>
            <h3>Month by month</h3>
            <div className={styles.monthGrid}>
              {MONTH_LABELS.map((label, idx) => {
                const count = monthByMonth[idx];
                const isFuture = count === null;
                const hasCount = count !== null && count > 0;
                return (
                  <div
                    key={label}
                    className={`${styles.monthTile} ${isFuture ? styles.future : ""} ${hasCount ? styles.hasCount : ""}`}
                  >
                    <span className={styles.monthLabel}>{label}</span>
                    <span className={styles.monthValue}>
                      {isFuture ? "·" : count}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className={styles.monthCaption}>
              Days out each month. Blank months have not happened yet.
            </div>
          </div>

          {/* Why They Were Out */}
          {Object.keys(byReason).length > 0 && (
            <div className={styles.card}>
              <h3>Why they were out</h3>
              <div className={styles.reasonList}>
                {Object.entries(byReason).map(([reason, count]) => (
                  <div key={reason} className={styles.reasonRow}>
                    <span className={styles.reasonLabel}>
                      {REASON_LABELS[reason] || reason}
                    </span>
                    <div className={styles.reasonBar}>
                      <div
                        className={styles.reasonBarFill}
                        style={{ width: `${(count / maxReasonCount) * 100}%` }}
                      />
                    </div>
                    <span className={styles.reasonCount}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Covered for Others */}
          {coveredForOthers.length > 0 && (
            <div className={styles.card}>
              <h3>Covered for others</h3>
              <div className={styles.coveredList}>
                {visibleCovered.map((c) => (
                  <div key={c.id} className={styles.coveredRow}>
                    <span>{formatDateShort(c.date)} · {c.schoolName}</span>
                    <span className={styles.coveredFor}>for {c.forName}</span>
                  </div>
                ))}
                {coveredForOthers.length > 6 && !showAllCovered && (
                  <button
                    type="button"
                    className={styles.showAllBtn}
                    onClick={() => setShowAllCovered(true)}
                  >
                    Show all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Log Request Modal */}
      {showRequestModal && (
        <div className={styles.modalOverlay} onClick={() => setShowRequestModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Log time off request</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowRequestModal(false)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label>First day out</label>
                  <input
                    type="date"
                    value={requestStartDate}
                    onChange={(e) => setRequestStartDate(e.target.value)}
                  />
                </div>
                <div className={styles.formField}>
                  <label>Last day out</label>
                  <input
                    type="date"
                    value={requestEndDate}
                    onChange={(e) => setRequestEndDate(e.target.value)}
                    min={requestStartDate}
                  />
                </div>
              </div>
              <div className={styles.formField}>
                <label>Reason</label>
                <div className={styles.reasonChips}>
                  {Object.entries(REASON_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.reasonChip} ${requestReason === value ? styles.active : ""}`}
                      onClick={() => setRequestReason(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formField} style={{ flex: 1 }}>
                  <label>Note (optional)</label>
                  <input
                    type="text"
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder="Any details..."
                  />
                </div>
                <div className={styles.formField}>
                  <label>They texted on</label>
                  <input
                    type="date"
                    value={requestedOn}
                    onChange={(e) => setRequestedOn(e.target.value)}
                    max={getTodayStr()}
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => setShowRequestModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleLogRequest}
                disabled={loading}
              >
                {loading ? "Saving..." : "Log request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeclineModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Decline request</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowDeclineModal(null)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.formField}>
                <label>Reason (optional)</label>
                <input
                  type="text"
                  value={declineNote}
                  onChange={(e) => setDeclineNote(e.target.value)}
                  placeholder="e.g., only instructor that day"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => setShowDeclineModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => handleDecline(showDeclineModal)}
                disabled={loading}
              >
                {loading ? "Declining..." : "Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
