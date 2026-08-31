"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./AdminCoverage.module.css";
import Modal from "@/app/admin/components/Modal";
import {
  getAllCoverageRequests,
  getCoverageTrends,
  getFrequentRequesters,
  getReliableCoverers,
  adminAssignCoverage,
  getSchoolsForDistrict,
  getClassesForSchool,
  getClassOccurrenceDates,
  adminCreateCoverageRequest,
} from "@/lib/coverage/admin-queries";

// Program colors
const PROGRAM_COLORS = {
  "Youth Wellness": "#3E8FA0",
  wellness: "#3E8FA0",
  Soccer: "#1F3F91",
  soccer: "#1F3F91",
};

// Avatar colors for consistent coloring
const AVATAR_COLORS = [
  "#D8AE4B",
  "#6FCB55",
  "#3FC0E8",
  "#2B4FA3",
  "#3E8FA0",
  "#F2A65E",
];

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

// Format date for display
function formatRequestDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const dow = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const dom = date.getDate();
  return { dow, dom };
}

export default function AdminCoverage({
  initialStats,
  initialFrequentAlert,
  initialRequests,
  instructors,
  districts,
  initialTrends,
  initialChartData,
  initialFrequentRequesters,
  initialReliableCoverers,
}) {
  const router = useRouter();
  const [tab, setTab] = useState("requests");
  const [filter, setFilter] = useState("all");
  const [requests, setRequests] = useState(initialRequests);
  const [loading, setLoading] = useState(false);

  // Period toggle for trends
  const [period, setPeriod] = useState("90");
  const [trends, setTrends] = useState(initialTrends);
  const [frequentRequesters, setFrequentRequesters] = useState(initialFrequentRequesters);
  const [reliableCoverers, setReliableCoverers] = useState(initialReliableCoverers);

  // Assign popover state
  const [assignOpen, setAssignOpen] = useState(null); // { requestId, anchorRect }
  const [assignSearch, setAssignSearch] = useState("");
  const popoverRef = useRef(null);

  // Post modal state
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postDistrictId, setPostDistrictId] = useState("");
  const [postSchools, setPostSchools] = useState([]);
  const [postSchoolId, setPostSchoolId] = useState("");
  const [postClasses, setPostClasses] = useState([]);
  const [postClassId, setPostClassId] = useState("");
  const [postDates, setPostDates] = useState([]);
  const [postDate, setPostDate] = useState("");
  const [postInstructors, setPostInstructors] = useState([]);
  const [postSelectedInstructor, setPostSelectedInstructor] = useState("");
  const [postNote, setPostNote] = useState("");
  const [postError, setPostError] = useState("");
  const [postLoading, setPostLoading] = useState(false);

  // Close popover on outside click
  useEffect(() => {
    if (!assignOpen) return;

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setAssignOpen(null);
        setAssignSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [assignOpen]);

  // Filter change handler
  const handleFilterChange = async (newFilter) => {
    setFilter(newFilter);
    setLoading(true);
    try {
      const newRequests = await getAllCoverageRequests(newFilter);
      setRequests(newRequests);
    } catch (e) {
      console.error("Error fetching requests:", e);
    } finally {
      setLoading(false);
    }
  };

  // Period change handler
  const handlePeriodChange = async (newPeriod) => {
    setPeriod(newPeriod);
    setLoading(true);
    try {
      const [newTrends, newFrequentRequesters, newReliableCoverers] = await Promise.all([
        getCoverageTrends(newPeriod),
        getFrequentRequesters(newPeriod),
        getReliableCoverers(newPeriod),
      ]);
      setTrends(newTrends);
      setFrequentRequesters(newFrequentRequesters);
      setReliableCoverers(newReliableCoverers);
    } catch (e) {
      console.error("Error fetching trends:", e);
    } finally {
      setLoading(false);
    }
  };

  // Open assign popover
  const openAssignPopover = (requestId, event) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setAssignOpen({ requestId, anchorRect: rect });
    setAssignSearch("");
  };

  // Handle assign
  const handleAssign = async (instructor) => {
    if (!assignOpen || loading) return;
    setLoading(true);

    try {
      const result = await adminAssignCoverage(assignOpen.requestId, instructor.id);
      if (result.error) {
        alert(result.error);
      } else {
        // Refresh requests
        const newRequests = await getAllCoverageRequests(filter);
        setRequests(newRequests);
      }
    } catch (e) {
      console.error("Error assigning coverage:", e);
      alert("Failed to assign coverage");
    } finally {
      setLoading(false);
      setAssignOpen(null);
      setAssignSearch("");
    }
  };

  // Filter instructors by search
  const filteredInstructors = useMemo(() => {
    const search = assignSearch.toLowerCase().trim();
    if (!search) return instructors;
    return instructors.filter((i) => i.name.toLowerCase().includes(search));
  }, [instructors, assignSearch]);

  // Calculate max for chart
  const chartMax = useMemo(() => {
    return Math.max(...initialChartData.map((m) => m.total), 1);
  }, [initialChartData]);

  // Count open requests for badge
  const openCount = initialStats.open;

  // Post modal handlers
  const openPostModal = () => {
    setPostModalOpen(true);
    setPostDistrictId("");
    setPostSchools([]);
    setPostSchoolId("");
    setPostClasses([]);
    setPostClassId("");
    setPostDates([]);
    setPostDate("");
    setPostInstructors([]);
    setPostSelectedInstructor("");
    setPostNote("");
    setPostError("");
  };

  const handleDistrictChange = async (districtId) => {
    setPostDistrictId(districtId);
    setPostSchoolId("");
    setPostSchools([]);
    setPostClasses([]);
    setPostClassId("");
    setPostDates([]);
    setPostDate("");
    setPostInstructors([]);
    setPostSelectedInstructor("");

    if (!districtId) return;

    setPostLoading(true);
    try {
      const schools = await getSchoolsForDistrict(districtId);
      setPostSchools(schools);
    } catch (e) {
      console.error("Error fetching schools:", e);
    } finally {
      setPostLoading(false);
    }
  };

  const handleSchoolChange = async (schoolId) => {
    setPostSchoolId(schoolId);
    setPostClasses([]);
    setPostClassId("");
    setPostDates([]);
    setPostDate("");
    setPostInstructors([]);
    setPostSelectedInstructor("");

    if (!schoolId) return;

    setPostLoading(true);
    try {
      const classes = await getClassesForSchool(schoolId);
      setPostClasses(classes);
    } catch (e) {
      console.error("Error fetching classes:", e);
    } finally {
      setPostLoading(false);
    }
  };

  const handleClassChange = async (classId) => {
    setPostClassId(classId);
    setPostDates([]);
    setPostDate("");
    setPostInstructors([]);
    setPostSelectedInstructor("");

    if (!classId) return;

    const selectedClass = postClasses.find((c) => c.id === classId);
    if (!selectedClass) return;

    // Set instructors from the class
    setPostInstructors(selectedClass.instructors || []);

    // Fetch dates
    setPostLoading(true);
    try {
      const dates = await getClassOccurrenceDates(
        classId,
        selectedClass.startDate,
        selectedClass.targetSessions,
        selectedClass.days
      );
      setPostDates(dates);
    } catch (e) {
      console.error("Error fetching dates:", e);
    } finally {
      setPostLoading(false);
    }
  };

  const handleSubmitPost = async () => {
    if (!postClassId || !postDate || !postSelectedInstructor) {
      setPostError("Please fill in all required fields");
      return;
    }

    setPostLoading(true);
    setPostError("");

    try {
      const result = await adminCreateCoverageRequest(
        postClassId,
        postDate,
        postSelectedInstructor,
        postNote.trim() || null
      );

      if (result.error) {
        setPostError(result.error);
      } else {
        // Success - close modal and refresh
        setPostModalOpen(false);
        router.refresh();
        // Also fetch new requests
        const newRequests = await getAllCoverageRequests(filter);
        setRequests(newRequests);
      }
    } catch (e) {
      console.error("Error creating coverage request:", e);
      setPostError("Failed to post coverage opening");
    } finally {
      setPostLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1>Coverage</h1>
        <p>Open requests that need attention, and how the system&apos;s trending over time.</p>
      </div>

      {/* Tabs */}
      <div className={styles.topTabs}>
        <button
          className={`${styles.topTab} ${tab === "requests" ? styles.active : ""}`}
          onClick={() => setTab("requests")}
        >
          Requests
          {openCount > 0 && <span className={styles.tabBadge}>{openCount}</span>}
        </button>
        <button
          className={`${styles.topTab} ${tab === "trends" ? styles.active : ""}`}
          onClick={() => setTab("trends")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M7 14l4-4 3 3 5-6" />
          </svg>
          Trends
        </button>
      </div>

      {/* Requests Tab */}
      {tab === "requests" && (
        <div className={styles.tabPanel}>
          {/* Post Coverage Button */}
          <button className={styles.postBtn} onClick={openPostModal}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Post Coverage Opening
          </button>

          {/* Stats Row */}
          <div className={styles.statRow}>
            <div className={`${styles.statCard} ${styles.urgent}`}>
              <div className={styles.statIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M12 8v5M12 16h.01" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>
              <div>
                <div className={styles.statNum}>{initialStats.urgent}</div>
                <div className={styles.statLabel}>Unclaimed &amp; Within 3 Days</div>
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.open}`}>
              <div className={styles.statIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </div>
              <div>
                <div className={styles.statNum}>{initialStats.open}</div>
                <div className={styles.statLabel}>Open Right Now</div>
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.covered}`}>
              <div className={styles.statIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div>
                <div className={styles.statNum}>{initialStats.coveredThisMonth}</div>
                <div className={styles.statLabel}>Covered This Month</div>
              </div>
            </div>
          </div>

          {/* Frequent Requester Callout */}
          {initialFrequentAlert && (
            <div className={styles.calloutCard}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 9v4M12 17h.01" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <div className={styles.calloutText}>
                <strong>
                  <span className={styles.calloutName}>{initialFrequentAlert.name}</span> has
                  requested coverage {initialFrequentAlert.count} times this month.
                </strong>{" "}
                Worth a quick check-in, not a red flag on its own. See the Trends tab for the full
                pattern.
              </div>
            </div>
          )}

          {/* Filter Pills */}
          <div className={styles.filterRow}>
            {["all", "open", "covered"].map((f) => (
              <button
                key={f}
                className={`${styles.filterPill} ${filter === f ? styles.active : ""}`}
                onClick={() => handleFilterChange(f)}
                disabled={loading}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Request List */}
          <div className={styles.requestList}>
            {requests.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No coverage requests found.</p>
              </div>
            ) : (
              requests.map((req) => {
                const { dow, dom } = formatRequestDate(req.date);
                const programColor =
                  PROGRAM_COLORS[req.program?.name] || PROGRAM_COLORS.wellness;
                const requesterColor = getAvatarColor(req.requester?.name);
                const claimerColor = req.claimer ? getAvatarColor(req.claimer.name) : null;

                return (
                  <div
                    key={req.id}
                    className={`${styles.reqRow} ${req.isUrgent ? styles.urgent : ""} ${
                      req.status === "claimed" ? styles.covered : ""
                    }`}
                  >
                    <div className={styles.reqDate}>
                      <div className={styles.dow}>{dow}</div>
                      <div className={styles.dom}>{dom}</div>
                    </div>
                    <div className={styles.reqInfo}>
                      <div className={styles.reqSchool}>
                        <span
                          className={styles.programBadge}
                          style={{
                            background: `${programColor}22`,
                            color: programColor,
                          }}
                        >
                          {req.program?.name || "Wellness"}
                        </span>
                        {req.school?.name || "Unknown School"}
                      </div>
                      <div className={styles.reqMeta}>{req.time}</div>
                      <div className={styles.reqPeople}>
                        <div
                          className={styles.miniAvatar}
                          style={{ background: requesterColor }}
                        >
                          {getInitials(req.requester?.name)}
                        </div>
                        Coverage for {req.requester?.name || "Unknown"}
                        {req.postedBy && (
                          <>
                            <span className={styles.dot}>&middot;</span>
                            Posted by {req.postedBy.name}
                          </>
                        )}
                        {req.status === "claimed" && req.claimer && (
                          <>
                            <span className={styles.dot}>&middot;</span>
                            <div
                              className={styles.miniAvatar}
                              style={{ background: claimerColor }}
                            >
                              {getInitials(req.claimer.name)}
                            </div>
                            Covered by {req.claimer.name}
                          </>
                        )}
                      </div>
                    </div>
                    <div className={styles.reqActions}>
                      {req.status === "open" ? (
                        <>
                          <span className={`${styles.statusTag} ${styles.statusOpen}`}>Open</span>
                          <button
                            className={styles.assignBtn}
                            onClick={(e) => openAssignPopover(req.id, e)}
                            disabled={loading}
                          >
                            Assign Someone
                          </button>
                        </>
                      ) : (
                        <span className={`${styles.statusTag} ${styles.statusCovered}`}>
                          Covered
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {tab === "trends" && (
        <div className={styles.tabPanel}>
          {/* Period Toggle */}
          <div className={styles.trendsHead}>
            <div className={styles.periodToggle}>
              {[
                { value: "30", label: "30 Days" },
                { value: "90", label: "90 Days" },
                { value: "year", label: "School Year" },
              ].map((p) => (
                <button
                  key={p.value}
                  className={`${styles.periodBtn} ${period === p.value ? styles.active : ""}`}
                  onClick={() => handlePeriodChange(p.value)}
                  disabled={loading}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trend Stats Row */}
          <div className={styles.trendStatRow}>
            <div className={styles.trendStatCard}>
              <div className={styles.trendStatNum}>{trends.fillRate}%</div>
              <div className={styles.trendStatLabel}>Fill Rate</div>
            </div>
            <div className={styles.trendStatCard}>
              <div className={styles.trendStatNum}>{trends.avgTimeToCover} hrs</div>
              <div className={styles.trendStatLabel}>Avg Time to Cover</div>
            </div>
            <div className={styles.trendStatCard}>
              <div className={styles.trendStatNum}>{trends.totalRequests}</div>
              <div className={styles.trendStatLabel}>Total Requests</div>
            </div>
            <div className={styles.trendStatCard}>
              <div className={styles.trendStatNum}>{trends.totalCovered}</div>
              <div className={styles.trendStatLabel}>Total Covered</div>
            </div>
          </div>

          {/* Chart Card */}
          <div className={styles.chartCard}>
            <h3>Requests Per Month</h3>
            <div className={styles.barChart}>
              {initialChartData.map((month, i) => {
                const uncovered = month.total - month.covered;
                const heightPercent = (month.total / chartMax) * 100;
                const coveredPercent = month.total > 0 ? (month.covered / month.total) * 100 : 0;

                return (
                  <div key={i} className={styles.barCol}>
                    <span className={styles.barCount}>{month.total}</span>
                    <div className={styles.barStack} style={{ height: `${heightPercent}%` }}>
                      {uncovered > 0 && (
                        <div
                          className={styles.barUncovered}
                          style={{ height: `${((month.total - month.covered) / month.total) * 100}%` }}
                        />
                      )}
                      <div
                        className={styles.barCovered}
                        style={{ height: `${coveredPercent}%` }}
                      />
                    </div>
                    <span className={styles.barMonth}>{month.label}</span>
                  </div>
                );
              })}
            </div>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: "var(--teal)" }} />
                Covered
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: "var(--tint-deep)" }} />
                Went uncovered
              </div>
            </div>
          </div>

          {/* Two Column Lists */}
          <div className={styles.twoCol}>
            {/* Frequent Requesters */}
            <div className={styles.listCard}>
              <h3>Frequent Requesters</h3>
              <p className={styles.subhead}>Rate shown as % of their own sessions, not raw count.</p>
              <div className={styles.rankList}>
                {frequentRequesters.length === 0 ? (
                  <p className={styles.emptyRank}>No data available</p>
                ) : (
                  frequentRequesters.map((r, i) => (
                    <div key={r.id} className={styles.rankRow}>
                      <span className={styles.rankNum}>{i + 1}</span>
                      <div
                        className={styles.rankAvatar}
                        style={{ background: getAvatarColor(r.name) }}
                      >
                        {getInitials(r.name)}
                      </div>
                      <div className={styles.rankInfo}>
                        <div className={styles.rankName}>{r.name}</div>
                        <div className={styles.rankSub}>
                          {r.count} requests &middot; {r.rate}
                        </div>
                      </div>
                      <span className={`${styles.rankVal} ${r.isFlag ? styles.flag : ""}`}>
                        {r.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Most Reliable Coverers */}
            <div className={styles.listCard}>
              <h3>Most Reliable Coverers</h3>
              <p className={styles.subhead}>Instructors who step up most often.</p>
              <div className={styles.rankList}>
                {reliableCoverers.length === 0 ? (
                  <p className={styles.emptyRank}>No data available</p>
                ) : (
                  reliableCoverers.map((r, i) => (
                    <div key={r.id} className={styles.rankRow}>
                      <span className={styles.rankNum}>{i + 1}</span>
                      <div
                        className={styles.rankAvatar}
                        style={{ background: getAvatarColor(r.name) }}
                      >
                        {getInitials(r.name)}
                      </div>
                      <div className={styles.rankInfo}>
                        <div className={styles.rankName}>{r.name}</div>
                        <div className={styles.rankSub}>{r.count} sessions covered</div>
                      </div>
                      <span className={`${styles.rankVal} ${styles.good}`}>{r.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Popover */}
      {assignOpen && (
        <div
          ref={popoverRef}
          className={styles.assignPopover}
          style={{
            position: "fixed",
            top: assignOpen.anchorRect.bottom + 8,
            right: Math.max(10, window.innerWidth - assignOpen.anchorRect.right),
          }}
        >
          <input
            className={styles.assignSearch}
            placeholder="Search instructors..."
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            autoFocus
          />
          <div className={styles.assignList}>
            {filteredInstructors.length === 0 ? (
              <div className={styles.assignEmpty}>No instructors found</div>
            ) : (
              filteredInstructors.map((inst) => (
                <button
                  key={inst.id}
                  className={styles.assignItem}
                  onClick={() => handleAssign(inst)}
                  disabled={loading}
                >
                  <div
                    className={styles.assignAvatar}
                    style={{ background: getAvatarColor(inst.name) }}
                  >
                    {getInitials(inst.name)}
                  </div>
                  <span className={styles.assignName}>{inst.name}</span>
                  {inst.districts.length > 0 && (
                    <span className={styles.assignDistrict}>{inst.districts[0].name}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Post Coverage Modal */}
      <Modal open={postModalOpen} onClose={() => setPostModalOpen(false)}>
        <div className={styles.postModal}>
          <h3>Post a Coverage Opening</h3>
          <p className={styles.postModalSub}>
            For a session where you&apos;ve already heard from the instructor directly.
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>District &amp; School</label>
            <div className={styles.fieldRow}>
              <select
                className={styles.fieldSelect}
                value={postDistrictId}
                onChange={(e) => handleDistrictChange(e.target.value)}
                disabled={postLoading}
              >
                <option value="">Select district...</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                className={styles.fieldSelect}
                value={postSchoolId}
                onChange={(e) => handleSchoolChange(e.target.value)}
                disabled={!postDistrictId || postLoading}
              >
                <option value="">Select school...</option>
                {postSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Which Class</label>
            <select
              className={styles.fieldSelect}
              value={postClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={!postSchoolId || postLoading}
            >
              <option value="">Select class...</option>
              {postClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Which Date</label>
            <select
              className={styles.fieldSelect}
              value={postDate}
              onChange={(e) => setPostDate(e.target.value)}
              disabled={!postClassId || postDates.length === 0 || postLoading}
            >
              <option value="">Select date...</option>
              {postDates.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {postInstructors.length > 0 && (
            <div className={styles.whoOut}>
              <div className={styles.whoOutLabel}>Who&apos;s out</div>
              <div className={styles.instructorPick}>
                {postInstructors.map((inst) => (
                  <button
                    key={inst.id}
                    type="button"
                    className={`${styles.ipOption} ${postSelectedInstructor === inst.id ? styles.selected : ""}`}
                    onClick={() => setPostSelectedInstructor(inst.id)}
                  >
                    <div
                      className={styles.ipAvatar}
                      style={{ background: getAvatarColor(inst.name) }}
                    >
                      {getInitials(inst.name)}
                    </div>
                    <span className={styles.ipName}>{inst.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Note for whoever picks this up (optional)</label>
            <textarea
              className={styles.fieldTextarea}
              placeholder="Anything the covering instructor should know."
              value={postNote}
              onChange={(e) => setPostNote(e.target.value)}
            />
          </div>

          <div className={styles.postSummary}>
            <p>
              This posts <strong>immediately</strong> to the Coverage Board for all active
              instructors to see and claim. First to claim gets it.
            </p>
          </div>

          {postError && <div className={styles.postError}>{postError}</div>}

          <div className={styles.modalActions}>
            <button
              className={styles.btnCancel}
              onClick={() => setPostModalOpen(false)}
              disabled={postLoading}
            >
              Cancel
            </button>
            <button
              className={styles.btnPost}
              onClick={handleSubmitPost}
              disabled={postLoading || !postClassId || !postDate || !postSelectedInstructor}
            >
              {postLoading ? "Posting..." : "Post to Board"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
