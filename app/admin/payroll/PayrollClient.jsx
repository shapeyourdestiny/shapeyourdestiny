"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import styles from "./Payroll.module.css";
import Modal from "@/app/admin/components/Modal";
import {
  setLinePay,
  setLineClasses,
  addAdjustment,
  removeAdjustment,
  changeRate,
  approvePeriod,
  markPaid,
  saveSettings,
  resolveIssue,
  logActivity,
} from "@/lib/payroll/actions.js";

const ISSUE_KINDS = {
  missing: "Missing class",
  wrong: "Wrong info",
  other: "Other",
};

function formatMoney(amount) {
  if (amount === null || amount === undefined) return "–";
  return `$${parseFloat(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function formatDateFull(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function formatPeriodRange(startDate, endDate) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${months[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  } else if (start.getFullYear() === end.getFullYear()) {
    return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
  } else {
    return `${months[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} – ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
}

export default function PayrollClient({
  today,
  period,
  periodData,
  prevPeriod,
  nextPeriod,
  history,
  settings,
  periodsNeedingApproval,
}) {
  const router = useRouter();
  const [view, setView] = useState("current"); // "current" | "history"
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);
  const [selectedInstructor, setSelectedInstructor] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showApproveWarning, setShowApproveWarning] = useState(null);

  const isPeriodEnded = period.endDate < today;
  const isPeriodApproved = periodData.period?.status === "approved";
  const isPeriodPaid = periodData.period?.status === "paid";
  const isNothingToPay = periodData.period?.status === "nothing_to_pay";

  const handleNavigate = useCallback((targetPeriod) => {
    if (targetPeriod) {
      router.push(`/admin/payroll?period=${targetPeriod.startDate}`);
    }
  }, [router]);

  const handleApprove = async () => {
    setLoading((prev) => ({ ...prev, approve: true }));
    setError(null);

    const result = await approvePeriod(periodData.period.id);

    if (result.warning) {
      setShowApproveWarning(result);
      setLoading((prev) => ({ ...prev, approve: false }));
      return;
    }

    if (result.error) {
      setError(result.error);
      setLoading((prev) => ({ ...prev, approve: false }));
      return;
    }

    setLoading((prev) => ({ ...prev, approve: false }));
    router.refresh();
  };

  const handleApproveAnyway = async () => {
    setLoading((prev) => ({ ...prev, approve: true }));
    setShowApproveWarning(null);

    const result = await approvePeriod(periodData.period.id, true);

    if (result.error) {
      setError(result.error);
    }

    setLoading((prev) => ({ ...prev, approve: false }));
    router.refresh();
  };

  const handleMarkPaid = async () => {
    setLoading((prev) => ({ ...prev, paid: true }));

    const result = await markPaid(periodData.period.id);

    if (result.error) {
      setError(result.error);
    }

    setLoading((prev) => ({ ...prev, paid: false }));
    router.refresh();
  };

  const handleExport = async () => {
    setLoading((prev) => ({ ...prev, export: true }));

    // Log the export
    await logActivity(periodData.period.id, "export", "CSV exported");

    // Open export URL
    window.open(`/api/admin/payroll/export?period=${period.startDate}`, "_blank");

    setLoading((prev) => ({ ...prev, export: false }));
    router.refresh();
  };

  const renderStatusBadge = (status) => {
    const statusConfig = {
      open: { label: "Open", className: styles.statusOpen },
      approved: { label: "Approved", className: styles.statusApproved },
      paid: { label: "Paid", className: styles.statusPaid },
      nothing_to_pay: { label: "Nothing to pay", className: styles.statusNothingToPay },
    };

    const config = statusConfig[status] || statusConfig.open;
    return <span className={`${styles.statusBadge} ${config.className}`}>{config.label}</span>;
  };

  const renderCheckStatus = (instructor) => {
    if (!instructor.checkStatus) return null;

    switch (instructor.checkStatus) {
      case "confirmed":
        return (
          <span className={styles.checkConfirmed}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Confirmed
          </span>
        );
      case "flagged":
        return (
          <button
            className={styles.checkFlagged}
            onClick={() => setSelectedInstructor(instructor)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {instructor.issueCount} issue{instructor.issueCount !== 1 ? "s" : ""}
          </button>
        );
      case "no_reply":
        return (
          <span className={styles.checkNoReply} title="Went with what's listed">
            No reply
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Payroll</h1>
          {periodsNeedingApproval > 1 && (
            <span className={styles.needsApprovalBadge}>
              {periodsNeedingApproval} periods need approval
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.settingsBtn}
            onClick={() => setShowSettingsModal(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            Settings
          </button>
        </div>
      </header>

      {/* View Toggle */}
      <div className={styles.viewToggle}>
        <button
          className={`${styles.viewBtn} ${view === "current" ? styles.viewBtnActive : ""}`}
          onClick={() => setView("current")}
        >
          Current Period
        </button>
        <button
          className={`${styles.viewBtn} ${view === "history" ? styles.viewBtnActive : ""}`}
          onClick={() => setView("history")}
        >
          History
        </button>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {view === "current" ? (
        <>
          {/* Period Navigation */}
          <div className={styles.periodNav}>
            <button
              className={styles.periodNavBtn}
              onClick={() => handleNavigate(prevPeriod)}
              disabled={!prevPeriod}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className={styles.periodInfo}>
              <h2>{formatPeriodRange(period.startDate, period.endDate)}</h2>
              <div className={styles.periodMeta}>
                {renderStatusBadge(periodData.period?.status)}
                <span>Due {formatDateFull(period.dueDate)}</span>
                <span>Payday {formatDateFull(period.payday)}</span>
              </div>
            </div>
            <button
              className={styles.periodNavBtn}
              onClick={() => handleNavigate(nextPeriod)}
              disabled={!nextPeriod}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Check Banner */}
          {periodData.isCheckOpen && (
            <div className={styles.checkBanner}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>
                Class check open until {formatDateFull(periodData.checkDeadline)}.{" "}
                {periodData.checkCounts?.confirmed || 0} confirmed ·{" "}
                {periodData.checkCounts?.flagged || 0} flagged ·{" "}
                {periodData.checkCounts?.noReply || 0} waiting
              </span>
            </div>
          )}

          {/* Period Summary */}
          {!periodData.anyoneHasWork && isPeriodEnded && (
            <div className={styles.emptyPeriod}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <h3>No classes this period</h3>
              <p>This is a break period with nothing to pay.</p>
            </div>
          )}

          {periodData.instructors?.length > 0 && (
            <>
              {/* Summary Card */}
              <div className={styles.summaryCard}>
                <div className={styles.summaryRow}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Instructors</span>
                    <span className={styles.summaryValue}>
                      {periodData.instructors.length}
                    </span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Total Classes</span>
                    <span className={styles.summaryValue}>
                      {periodData.instructors.reduce((sum, i) => sum + i.totalClasses, 0)}
                    </span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Total Pay</span>
                    <span className={`${styles.summaryValue} ${styles.summaryTotal}`}>
                      {formatMoney(periodData.period?.total || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instructor Table */}
              <div className={styles.tableCard}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Instructor</th>
                      <th>Classes</th>
                      <th>Rate</th>
                      <th>Adjustments</th>
                      <th>Total</th>
                      <th>Class Check</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodData.instructors.map((instructor) => (
                      <tr
                        key={instructor.profileId}
                        className={instructor.needsReview ? styles.needsReview : ""}
                      >
                        <td>
                          <div className={styles.instructorCell}>
                            {instructor.avatarUrl ? (
                              <Image
                                src={instructor.avatarUrl}
                                alt=""
                                width={32}
                                height={32}
                                className={styles.avatar}
                              />
                            ) : (
                              <div className={styles.avatarPlaceholder}>
                                {instructor.fullName?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                            )}
                            <span>{instructor.fullName}</span>
                            {instructor.needsReview && (
                              <span className={styles.reviewDot} title="Needs review" />
                            )}
                          </div>
                        </td>
                        <td>{instructor.totalClasses}</td>
                        <td>
                          {instructor.hasNoRate ? (
                            <span className={styles.noRate}>No rate</span>
                          ) : instructor.rates.length === 1 ? (
                            formatMoney(instructor.rates[0])
                          ) : (
                            <span title={instructor.rates.map(formatMoney).join(", ")}>
                              Multiple
                            </span>
                          )}
                        </td>
                        <td>
                          {instructor.adjustments.length > 0 ? (
                            <span className={styles.adjBadge}>
                              {instructor.adjustments.length} adj
                            </span>
                          ) : (
                            "–"
                          )}
                        </td>
                        <td className={styles.totalCell}>
                          {formatMoney(instructor.totalAmount)}
                        </td>
                        <td>{renderCheckStatus(instructor)}</td>
                        <td>
                          <button
                            className={styles.viewBtn}
                            onClick={() => setSelectedInstructor(instructor)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* No Classes Note */}
              {periodData.noClassesCount > 0 && (
                <p className={styles.noClassesNote}>
                  {periodData.noClassesCount} instructor{periodData.noClassesCount !== 1 ? "s" : ""} had no classes this period.
                </p>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className={styles.actions}>
            {isPeriodPaid ? (
              <div className={styles.paidStatus}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Paid {periodData.period.paidAt && formatDateFull(periodData.period.paidAt.split("T")[0])}
              </div>
            ) : isPeriodApproved ? (
              <>
                <button
                  className={styles.exportBtn}
                  onClick={handleExport}
                  disabled={loading.export}
                >
                  {loading.export ? "Exporting..." : "Export CSV"}
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={handleMarkPaid}
                  disabled={loading.paid}
                >
                  {loading.paid ? "..." : "Mark Paid"}
                </button>
              </>
            ) : isNothingToPay ? (
              <div className={styles.nothingToPayStatus}>
                Nothing to pay for this period
              </div>
            ) : isPeriodEnded && periodData.anyoneHasWork ? (
              <button
                className={styles.primaryBtn}
                onClick={handleApprove}
                disabled={loading.approve}
              >
                {loading.approve ? "Approving..." : `Approve ${formatPeriodRange(period.startDate, period.endDate).split(",")[0]}`}
              </button>
            ) : null}
          </div>

          {/* Activity Log */}
          {periodData.activity?.length > 0 && (
            <div className={styles.activitySection}>
              <h3>Activity</h3>
              <ul className={styles.activityList}>
                {periodData.activity.map((item) => (
                  <li key={item.id}>
                    <span className={styles.activityText}>{item.text}</span>
                    <span className={styles.activityMeta}>
                      {item.actor && `${item.actor} · `}
                      {formatDateFull(item.created_at?.split("T")[0])}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        /* History View */
        <div className={styles.historySection}>
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Approved</th>
                  <th>Paid</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr
                    key={p.id}
                    className={p.status === "nothing_to_pay" ? styles.mutedRow : ""}
                  >
                    <td>{p.range}</td>
                    <td>{renderStatusBadge(p.status)}</td>
                    <td>{formatMoney(p.total)}</td>
                    <td>{p.approvedAt ? formatDate(p.approvedAt.split("T")[0]) : "–"}</td>
                    <td>{p.paidAt ? formatDate(p.paidAt.split("T")[0]) : "–"}</td>
                    <td>
                      <Link
                        href={`/admin/payroll?period=${p.startDate}`}
                        className={styles.viewBtn}
                        onClick={() => setView("current")}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.emptyTable}>
                      No payroll history yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instructor Drawer */}
      {selectedInstructor && (
        <InstructorDrawer
          instructor={selectedInstructor}
          period={periodData.period}
          isOpen={!!selectedInstructor}
          onClose={() => setSelectedInstructor(null)}
          onRefresh={() => router.refresh()}
        />
      )}

      {/* Approve Warning Modal */}
      <Modal open={!!showApproveWarning} onClose={() => setShowApproveWarning(null)}>
        <div className={styles.warningModal}>
          <h3>Approve with open items?</h3>
          <p>
            {showApproveWarning?.openIssues > 0 && (
              <span>{showApproveWarning.openIssues} open issue{showApproveWarning.openIssues !== 1 ? "s" : ""} </span>
            )}
            {showApproveWarning?.checkOpen && (
              <span>Class check is still open</span>
            )}
          </p>
          <div className={styles.warningActions}>
            <button
              className={styles.cancelBtn}
              onClick={() => setShowApproveWarning(null)}
            >
              Cancel
            </button>
            <button
              className={styles.primaryBtn}
              onClick={handleApproveAnyway}
              disabled={loading.approve}
            >
              Approve Anyway
            </button>
          </div>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal open={showSettingsModal} onClose={() => setShowSettingsModal(false)}>
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettingsModal(false)}
          onSave={() => {
            setShowSettingsModal(false);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

/**
 * Instructor Detail Drawer
 */
function InstructorDrawer({ instructor, period, isOpen, onClose, onRefresh }) {
  const [loading, setLoading] = useState({});

  const handleResolveIssue = async (issueId, note) => {
    setLoading((prev) => ({ ...prev, [issueId]: true }));
    await resolveIssue(issueId, note);
    setLoading((prev) => ({ ...prev, [issueId]: false }));
    onRefresh();
  };

  if (!isOpen) return null;

  const taughtLines = instructor.lines.filter((l) => l.source === "taught" && !l.isUpcoming);
  const subbedLines = instructor.lines.filter((l) => l.source === "subbed" && !l.isUpcoming);
  const upcomingLines = instructor.lines.filter((l) => l.isUpcoming);

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitle}>
            <div className={styles.instructorCell}>
              {instructor.avatarUrl ? (
                <Image
                  src={instructor.avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {instructor.fullName?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
              <div>
                <h3>{instructor.fullName}</h3>
                <span className={styles.drawerSubtitle}>
                  {instructor.totalClasses} class{instructor.totalClasses !== 1 ? "es" : ""} ·{" "}
                  {formatMoney(instructor.totalAmount)}
                </span>
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.drawerBody}>
          {/* Rate Info */}
          <div className={styles.drawerSection}>
            <h4>Pay Rate</h4>
            {instructor.hasNoRate ? (
              <div className={styles.noRateAlert}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                No rate set.{" "}
                <Link href={`/admin/instructors/${instructor.profileId}?tab=notes`}>
                  Add a pay note
                </Link>
              </div>
            ) : (
              <p>
                {instructor.rates.length === 1
                  ? `${formatMoney(instructor.rates[0])} per class`
                  : `Multiple rates: ${instructor.rates.map(formatMoney).join(", ")}`}
              </p>
            )}
          </div>

          {/* Issues Section */}
          {instructor.issueCount > 0 && (
            <div className={styles.drawerSection}>
              <h4>Open Issues</h4>
              <p className={styles.issuesNote}>
                Resolve these before approving payroll.
              </p>
              {/* Issues would be loaded here */}
            </div>
          )}

          {/* Taught Classes */}
          {taughtLines.length > 0 && (
            <div className={styles.drawerSection}>
              <h4>Taught ({taughtLines.length})</h4>
              <div className={styles.linesList}>
                {taughtLines.map((line) => (
                  <div key={line.id} className={`${styles.lineItem} ${!line.paid ? styles.lineNotPaid : ""}`}>
                    <div className={styles.lineMain}>
                      <span className={styles.lineDate}>{formatDate(line.date)}</span>
                      <span className={styles.lineSchool}>{line.schoolName}</span>
                      <span className={styles.lineTime}>{line.time}</span>
                    </div>
                    <div className={styles.lineRight}>
                      <span className={styles.lineClasses}>{line.classes} class{line.classes !== 1 ? "es" : ""}</span>
                      <span className={styles.lineAmount}>{line.paid ? formatMoney(line.amount) : "Not paid"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subbed Classes */}
          {subbedLines.length > 0 && (
            <div className={styles.drawerSection}>
              <h4>Subbed ({subbedLines.length})</h4>
              <div className={styles.linesList}>
                {subbedLines.map((line) => (
                  <div key={line.id} className={styles.lineItem}>
                    <div className={styles.lineMain}>
                      <span className={styles.lineDate}>{formatDate(line.date)}</span>
                      <span className={styles.lineSchool}>{line.schoolName}</span>
                      {line.coveredFor && (
                        <span className={styles.lineCoveredFor}>for {line.coveredFor}</span>
                      )}
                    </div>
                    <div className={styles.lineRight}>
                      <span className={styles.lineClasses}>{line.classes} class{line.classes !== 1 ? "es" : ""}</span>
                      <span className={styles.lineAmount}>{formatMoney(line.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Classes */}
          {upcomingLines.length > 0 && (
            <div className={styles.drawerSection}>
              <h4>Coming Up ({upcomingLines.length})</h4>
              <div className={`${styles.linesList} ${styles.linesUpcoming}`}>
                {upcomingLines.map((line) => (
                  <div key={line.id} className={styles.lineItem}>
                    <div className={styles.lineMain}>
                      <span className={styles.lineDate}>{formatDate(line.date)}</span>
                      <span className={styles.lineSchool}>{line.schoolName}</span>
                    </div>
                    <div className={styles.lineRight}>
                      <span className={styles.lineAmount}>{formatMoney(line.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adjustments */}
          {instructor.adjustments.length > 0 && (
            <div className={styles.drawerSection}>
              <h4>Adjustments</h4>
              <div className={styles.linesList}>
                {instructor.adjustments.map((adj) => (
                  <div key={adj.id} className={styles.lineItem}>
                    <div className={styles.lineMain}>
                      <span className={styles.adjLabel}>{adj.label}</span>
                      {adj.note && <span className={styles.adjNote}>{adj.note}</span>}
                    </div>
                    <div className={styles.lineRight}>
                      <span className={`${styles.lineAmount} ${parseFloat(adj.amount) < 0 ? styles.negative : ""}`}>
                        {formatMoney(adj.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.drawerFooter}>
          <div className={styles.drawerTotal}>
            <span>Total</span>
            <span>{formatMoney(instructor.totalAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Settings Modal
 */
function SettingsModal({ settings, onClose, onSave }) {
  const [formData, setFormData] = useState({
    anchorDate: settings.anchorDate || "2026-09-05",
    periodDays: settings.periodDays || 14,
    dueOffsetDays: settings.dueOffsetDays || 7,
    paydayOffsetDays: settings.paydayOffsetDays || 14,
    reminderEmails: (settings.reminderEmails || []).join(", "),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await saveSettings({
      anchorDate: formData.anchorDate,
      periodDays: parseInt(formData.periodDays),
      dueOffsetDays: parseInt(formData.dueOffsetDays),
      paydayOffsetDays: parseInt(formData.paydayOffsetDays),
      reminderEmails: formData.reminderEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    onSave();
  };

  return (
    <div className={styles.settingsModal}>
      <h2>Pay Schedule & Reminders</h2>

      {error && <div className={styles.errorAlert}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className={styles.formSection}>
          <h3>Pay Schedule</h3>

          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>Anchor Date</label>
              <input
                type="date"
                value={formData.anchorDate}
                onChange={(e) => setFormData({ ...formData, anchorDate: e.target.value })}
              />
              <span className={styles.formHint}>First day of the first pay period</span>
            </div>

            <div className={styles.formField}>
              <label>Period Length</label>
              <select
                value={formData.periodDays}
                onChange={(e) => setFormData({ ...formData, periodDays: e.target.value })}
              >
                <option value={7}>7 days (weekly)</option>
                <option value={14}>14 days (bi-weekly)</option>
              </select>
            </div>

            <div className={styles.formField}>
              <label>Due After</label>
              <select
                value={formData.dueOffsetDays}
                onChange={(e) => setFormData({ ...formData, dueOffsetDays: e.target.value })}
              >
                <option value={3}>3 days</option>
                <option value={5}>5 days</option>
                <option value={7}>7 days</option>
                <option value={10}>10 days</option>
              </select>
              <span className={styles.formHint}>Days after period ends</span>
            </div>

            <div className={styles.formField}>
              <label>Payday After</label>
              <select
                value={formData.paydayOffsetDays}
                onChange={(e) => setFormData({ ...formData, paydayOffsetDays: e.target.value })}
              >
                <option value={7}>7 days</option>
                <option value={10}>10 days</option>
                <option value={14}>14 days</option>
              </select>
              <span className={styles.formHint}>Days after period ends</span>
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Reminders</h3>

          <div className={styles.formField}>
            <label>Reminder Emails</label>
            <input
              type="text"
              value={formData.reminderEmails}
              onChange={(e) => setFormData({ ...formData, reminderEmails: e.target.value })}
              placeholder="email1@example.com, email2@example.com"
            />
            <span className={styles.formHint}>Comma-separated email addresses</span>
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.primaryBtn} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
