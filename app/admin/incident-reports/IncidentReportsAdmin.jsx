"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getIncidentReports, updateIncidentStatus } from "@/lib/incidents/queries";
import styles from "./page.module.css";

// Avatar colors
const AVATAR_COLORS = ["#D8AE4B", "#6FCB55", "#3FC0E8", "#2B4FA3", "#3E8FA0", "#F2A65E"];

function getAvatarColor(name) {
  const hash = (name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes.toString().padStart(2, "0");

  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} · ${formattedHours}:${formattedMinutes}${ampm}`;
}

export default function IncidentReportsAdmin({ initialReports, initialStats }) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [stats] = useState(initialStats);
  const [filter, setFilter] = useState("all");
  const [seriousOnly, setSeriousOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState({});

  // Toggle row expansion
  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Fetch reports with filters
  const fetchReports = async (statusFilter, serious) => {
    setLoading(true);
    try {
      const newReports = await getIncidentReports({
        status: statusFilter,
        seriousOnly: serious,
      });
      setReports(newReports);
    } catch (e) {
      console.error("Error fetching reports:", e);
    } finally {
      setLoading(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    fetchReports(newFilter, seriousOnly);
  };

  // Handle serious only toggle
  const handleSeriousToggle = () => {
    const newSerious = !seriousOnly;
    setSeriousOnly(newSerious);
    fetchReports(filter, newSerious);
  };

  // Handle status update
  const handleStatusUpdate = async (reportId, newStatus) => {
    setLoading(true);
    try {
      const notes = adminNotes[reportId] || "";
      const result = await updateIncidentStatus(reportId, newStatus, notes);
      if (result.error) {
        alert(result.error);
      } else {
        // Refresh the list
        fetchReports(filter, seriousOnly);
        router.refresh();
      }
    } catch (e) {
      console.error("Error updating status:", e);
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  // Update local admin notes
  const handleNotesChange = (reportId, notes) => {
    setAdminNotes((prev) => ({ ...prev, [reportId]: notes }));
  };

  return (
    <>
      {/* Stats Row */}
      <div className={styles.statRow}>
        <div className={`${styles.statCard} ${styles.serious}`}>
          <div className={styles.statIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 8v5M12 16h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <div>
            <div className={styles.statNum}>{stats.seriousUnreviewed}</div>
            <div className={styles.statLabel}>Serious &amp; Unreviewed</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.review}`}>
          <div className={styles.statIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </div>
          <div>
            <div className={styles.statNum}>{stats.awaitingReview}</div>
            <div className={styles.statLabel}>Awaiting Review</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.month}`}>
          <div className={styles.statIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <div className={styles.statNum}>{stats.filedThisMonth}</div>
            <div className={styles.statLabel}>Filed This Month</div>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className={styles.filterRow}>
        {["all", "open", "reviewed", "closed"].map((f) => (
          <button
            key={f}
            className={`${styles.filterPill} ${filter === f ? styles.active : ""}`}
            onClick={() => handleFilterChange(f)}
            disabled={loading}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button
          className={`${styles.filterPill} ${styles.seriousPill} ${seriousOnly ? styles.active : ""}`}
          onClick={handleSeriousToggle}
          disabled={loading}
        >
          Serious Only
        </button>
      </div>

      {/* Reports List */}
      <div className={styles.reportList}>
        {reports.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No incident reports found.</p>
          </div>
        ) : (
          reports.map((report) => {
            const isExpanded = expandedIds.has(report.id);
            const avatarColor = getAvatarColor(report.submitter?.name);
            const notes = adminNotes[report.id] ?? report.adminNotes ?? "";

            return (
              <div
                key={report.id}
                className={`${styles.reportRow} ${isExpanded ? styles.open : ""}`}
              >
                <div className={styles.reportSummary} onClick={() => toggleExpand(report.id)}>
                  <span className={`${styles.sevDot} ${styles[report.severity]}`} />
                  <div className={styles.reportInfo}>
                    <div className={styles.reportType}>
                      {report.type} · {report.school?.name || report.locationNote || "Unknown"}
                    </div>
                    <div className={styles.reportMeta}>{formatDate(report.occurredAt)}</div>
                    <div className={styles.reportBy}>
                      <div className={styles.avatar} style={{ background: avatarColor }}>
                        {getInitials(report.submitter?.name)}
                      </div>
                      Filed by {report.submitter?.name || "Unknown"}
                    </div>
                  </div>
                  <span className={`${styles.statusTag} ${styles[report.status]}`}>
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </span>
                  <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>

                {isExpanded && (
                  <div className={styles.reportDetail}>
                    {/* First Grid Row */}
                    <div className={styles.detailGrid}>
                      <div className={styles.detailBlock}>
                        <h4>Who was involved</h4>
                        <p>{report.involved || "Not specified"}</p>
                      </div>
                      <div className={styles.detailBlock}>
                        <h4>First Aid Administered</h4>
                        <p>{report.firstAidAdministered ? "Yes" : "No"}</p>
                      </div>
                    </div>

                    {/* Second Grid Row */}
                    <div className={styles.detailGrid}>
                      <div className={styles.detailBlock}>
                        <h4>Staff Notified</h4>
                        <p>
                          {report.staffNotified
                            ? report.staffNotifiedName
                              ? `Yes, ${report.staffNotifiedName}`
                              : "Yes"
                            : "No"}
                        </p>
                      </div>
                      <div className={styles.detailBlock}>
                        <h4>Parent/Guardian Notified</h4>
                        <p>
                          {report.parentNotified === "yes"
                            ? "Yes"
                            : report.parentNotified === "no"
                            ? "No"
                            : "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Full Width Blocks */}
                    <div className={styles.detailBlock}>
                      <h4>What happened</h4>
                      <p>{report.whatHappened}</p>
                    </div>

                    <div className={styles.detailBlock}>
                      <h4>Actions taken</h4>
                      <p>{report.actionsTaken}</p>
                    </div>

                    <div className={styles.detailBlock}>
                      <h4>Witnesses</h4>
                      <p>{report.witnesses || "None"}</p>
                    </div>

                    {/* Admin Notes */}
                    <div className={styles.detailBlock}>
                      <h4>Admin notes</h4>
                      <textarea
                        className={styles.adminNotes}
                        placeholder="Notes for your own records, follow-up needed, resolution, etc."
                        value={notes}
                        onChange={(e) => handleNotesChange(report.id, e.target.value)}
                      />
                    </div>

                    {/* Actions */}
                    <div className={styles.detailActions}>
                      {report.status === "open" && (
                        <button
                          className={styles.statusBtn}
                          onClick={() => handleStatusUpdate(report.id, "reviewed")}
                          disabled={loading}
                        >
                          Mark Reviewed
                        </button>
                      )}
                      {report.status !== "closed" && (
                        <button
                          className={`${styles.statusBtn} ${styles.primary}`}
                          onClick={() => handleStatusUpdate(report.id, "closed")}
                          disabled={loading}
                        >
                          Close Report
                        </button>
                      )}
                      {report.status === "closed" && (
                        <button
                          className={styles.statusBtn}
                          onClick={() => handleStatusUpdate(report.id, "open")}
                          disabled={loading}
                        >
                          Reopen Report
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
