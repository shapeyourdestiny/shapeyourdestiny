"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import styles from "./ProgramsClient.module.css";
import ClassPanel from "./ClassPanel";
import SchoolPanel from "./SchoolPanel";
import ConfirmModal from "./ConfirmModal";
import {
  deleteDistrictAction,
  renameDistrictAction,
  updateDistrictColorAction,
  createHolidayAction,
  deleteHolidayAction,
  addTypicalHolidaysAction,
} from "@/lib/schedule/actions";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DISTRICT_COLORS = [
  "#3E8FA0", // teal
  "#6FCB55", // green
  "#9B59B6", // purple
  "#2C6E7D", // dark teal
  "#E74C3C", // red
  "#3498DB", // blue
  "#1ABC9C", // turquoise
  "#E91E63", // pink
];

const AVATAR_COLORS = [
  "#3E8FA0",
  "#2B4FA3",
  "#6FCB55",
  "#2C6E7D",
  "#1F3F91",
  "#3498DB",
];

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const date = parseDate(dateStr);
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatDateFull(dateStr) {
  if (!dateStr) return "";
  const date = parseDate(dateStr);
  const dayName = DAY_NAMES[date.getDay()];
  return `${dayName}, ${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getShortName(fullName) {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

export default function ProgramsClient({ initialData, progressMap, today }) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState("classes");
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("current");

  // Panel state
  const [classPanel, setClassPanel] = useState(null);
  const [schoolPanel, setSchoolPanel] = useState(null);

  // Holidays tab state
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayScope, setHolidayScope] = useState("all");
  const [holidayTimePeriod, setHolidayTimePeriod] = useState("all_day");
  const [offDayProgram, setOffDayProgram] = useState("wellness");
  const [offDayDate, setOffDayDate] = useState("");
  const [offDayReason, setOffDayReason] = useState("");
  const [offDayTimePeriod, setOffDayTimePeriod] = useState("all_day");
  const [programOffDays, setProgramOffDays] = useState([]);
  const [showPastHolidays, setShowPastHolidays] = useState(false);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState(null);

  // Loading/saving states
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Refetch data
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/schedule");
      if (res.ok) {
        const newData = await res.json();
        setData(newData);
      }
    } catch (err) {
      console.error("Failed to refresh data:", err);
    }
  }, []);

  // Load program off days
  useEffect(() => {
    const fetchOffDays = async () => {
      try {
        const res = await fetch("/api/admin/program-off-days");
        if (res.ok) {
          const offDays = await res.json();
          setProgramOffDays(offDays);
        }
      } catch (err) {
        console.error("Failed to fetch program off days:", err);
      }
    };
    fetchOffDays();
  }, []);

  // Show save message briefly
  const showSaved = (message = "Saved") => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const showError = (message) => {
    setSaveMessage({ error: true, text: message });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Compute stats for filters
  const stats = useMemo(() => {
    let currentClasses = 0;
    let needInstructor = 0;
    let startingSoon = 0;
    let endedClasses = 0;
    const schoolsWithCurrent = new Set();

    for (const district of data.districts) {
      for (const school of district.schools || []) {
        for (const cls of school.classes || []) {
          const progress = progressMap[cls.id] || {};
          if (progress.status === "ended") {
            endedClasses++;
          } else if (progress.status === "starts_soon") {
            startingSoon++;
            currentClasses++;
            schoolsWithCurrent.add(school.id);
          } else {
            currentClasses++;
            schoolsWithCurrent.add(school.id);
            const hasInstructor = cls.assignments?.some(
              (a) => a.slotType === "instructor_1" || a.slotType === "instructor_2"
            );
            if (!hasInstructor) {
              needInstructor++;
            }
          }
        }
      }
    }

    return {
      currentClasses,
      needInstructor,
      startingSoon,
      endedClasses,
      schoolsWithCurrent: schoolsWithCurrent.size,
    };
  }, [data, progressMap]);

  // Filter classes - only show schools with matching classes
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return data.districts
      .map((district) => {
        const filteredSchools = (district.schools || [])
          .map((school) => {
            const filteredClasses = (school.classes || []).filter((cls) => {
              const progress = progressMap[cls.id] || {};

              // Status filter
              if (statusFilter === "current") {
                if (progress.status === "ended") return false;
              } else if (statusFilter === "ended") {
                if (progress.status !== "ended") return false;
              } else if (statusFilter === "needInstructor") {
                if (progress.status === "ended") return false;
                const hasInstructor = cls.assignments?.some(
                  (a) => a.slotType === "instructor_1" || a.slotType === "instructor_2"
                );
                if (hasInstructor) return false;
              } else if (statusFilter === "startingSoon") {
                if (progress.status !== "starts_soon") return false;
              }

              // Program filter
              if (programFilter !== "all" && (cls.program || "wellness") !== programFilter) {
                return false;
              }

              // Search filter
              if (query) {
                const schoolMatch = school.name.toLowerCase().includes(query);
                const instructorMatch = cls.assignments?.some((a) =>
                  a.profile?.full_name?.toLowerCase().includes(query)
                );
                if (!schoolMatch && !instructorMatch) return false;
              }

              return true;
            });

            return { ...school, classes: filteredClasses };
          })
          .filter((school) => school.classes.length > 0);

        return { ...district, schools: filteredSchools };
      })
      .filter((district) => district.schools.length > 0);
  }, [data, progressMap, searchQuery, programFilter, statusFilter]);

  // Delete district
  const handleDeleteDistrict = async (district) => {
    setConfirmModal({
      title: "Delete district?",
      message: `This will delete ${district.name} and all its ${district.schools?.length || 0} schools and ${
        district.schools?.reduce((sum, s) => sum + (s.classes?.length || 0), 0) || 0
      } classes. This cannot be undone.`,
      confirmLabel: "Delete district",
      onConfirm: async () => {
        setLoading(true);
        try {
          await deleteDistrictAction(district.id);
          await refreshData();
          showSaved("Deleted");
        } catch (err) {
          showError(err.message);
        } finally {
          setLoading(false);
          setConfirmModal(null);
        }
      },
    });
  };

  // Rename district
  const handleRenameDistrict = async (district, newName) => {
    if (!newName.trim() || newName.trim() === district.name) return;
    setLoading(true);
    try {
      await renameDistrictAction(district.id, newName.trim());
      await refreshData();
      showSaved();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Change district color
  const handleChangeDistrictColor = async (district, newColor) => {
    if (newColor === district.color) return;
    setLoading(true);
    try {
      await updateDistrictColorAction(district.id, newColor);
      await refreshData();
      showSaved();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add holiday
  const handleAddHoliday = async () => {
    if (!holidayDate || !holidayName.trim()) return;
    setLoading(true);

    let districtId = null;
    let schoolId = null;

    if (holidayScope !== "all") {
      if (holidayScope.startsWith("district:")) {
        districtId = holidayScope.replace("district:", "");
      } else if (holidayScope.startsWith("school:")) {
        schoolId = holidayScope.replace("school:", "");
      }
    }

    try {
      await createHolidayAction(holidayDate, holidayName.trim(), districtId, schoolId, holidayTimePeriod);
      await refreshData();
      setHolidayDate("");
      setHolidayName("");
      setHolidayScope("all");
      setHolidayTimePeriod("all_day");
      showSaved();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete holiday
  const handleDeleteHoliday = async (holidayId) => {
    setLoading(true);
    try {
      await deleteHolidayAction(holidayId);
      await refreshData();
      showSaved("Deleted");
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add typical holidays
  const handleAddTypicalHolidays = async () => {
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      await addTypicalHolidaysAction(year);
      await refreshData();
      showSaved("Holidays added");
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add program off day
  const handleAddOffDay = async () => {
    if (!offDayDate || !offDayReason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/program-off-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program: offDayProgram,
          date: offDayDate,
          reason: offDayReason.trim(),
          time_period: offDayTimePeriod,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add");
      }
      const newOffDay = await res.json();
      setProgramOffDays((prev) => [...prev, newOffDay].sort((a, b) => a.date.localeCompare(b.date)));
      setOffDayDate("");
      setOffDayReason("");
      setOffDayTimePeriod("all_day");
      showSaved();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update program off day time period
  const handleUpdateOffDayTimePeriod = async (id, newTimePeriod) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/program-off-days", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, time_period: newTimePeriod }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }
      const updated = await res.json();
      setProgramOffDays((prev) =>
        prev.map((od) => (od.id === id ? updated : od))
      );
      showSaved();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete program off day
  const handleDeleteOffDay = async (id) => {
    setLoading(true);
    try {
      await fetch(`/api/admin/program-off-days?id=${id}`, { method: "DELETE" });
      setProgramOffDays((prev) => prev.filter((od) => od.id !== id));
      showSaved("Deleted");
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Split holidays into upcoming and past
  const { upcomingHolidays, pastHolidays } = useMemo(() => {
    const upcoming = [];
    const past = [];
    for (const h of data.holidays || []) {
      if (h.date >= today) {
        upcoming.push(h);
      } else {
        past.push(h);
      }
    }
    return { upcomingHolidays: upcoming, pastHolidays: past.reverse() };
  }, [data.holidays, today]);

  // Group program off days by program
  const offDaysByProgram = useMemo(() => {
    const groups = { wellness: [], soccer: [] };
    for (const od of programOffDays) {
      if (groups[od.program]) {
        groups[od.program].push(od);
      }
    }
    return groups;
  }, [programOffDays]);

  // Get scope display for a holiday
  const getHolidayScope = (holiday) => {
    if (holiday.school_id) {
      for (const district of data.districts) {
        const school = district.schools?.find((s) => s.id === holiday.school_id);
        if (school) {
          return { type: "school", name: school.name, color: district.color };
        }
      }
    }
    if (holiday.district_id) {
      const district = data.districts.find((d) => d.id === holiday.district_id);
      if (district) {
        return { type: "district", name: district.name, color: district.color };
      }
    }
    return { type: "all", name: "All schools", color: null };
  };

  return (
    <div className={styles.page}>
      {/* Save message */}
      {saveMessage && (
        <div className={`${styles.saveMessage} ${saveMessage.error ? styles.saveError : ""}`}>
          {saveMessage.error ? saveMessage.text : saveMessage}
        </div>
      )}

      {/* Classes view */}
      {activeTab === "classes" && (
        <>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerText}>
              <h1>Programs</h1>
              <p className={styles.subtitle}>
                {stats.currentClasses} classes at {stats.schoolsWithCurrent} schools. Click any class to edit it.
              </p>
            </div>
            <div className={styles.headerActions}>
              <button
                className={styles.ghostBtn}
                onClick={() => setActiveTab("holidays")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Holidays & days off
              </button>
              <button
                className={styles.ghostBtn}
                onClick={() => setSchoolPanel({ mode: "create" })}
              >
                + Add school
              </button>
              <button
                className={styles.addClassBtn}
                onClick={() => setClassPanel({ mode: "create" })}
              >
                + Add class
              </button>
            </div>
          </div>

          {/* Filter bar */}
          <div className={styles.filterBar}>
            <div className={styles.segmentedControl}>
              {[
                { key: "current", label: "Current", count: stats.currentClasses },
                { key: "needInstructor", label: "Needs instructor", count: stats.needInstructor },
                { key: "startingSoon", label: "Starting soon", count: stats.startingSoon },
                { key: "ended", label: "Ended", count: stats.endedClasses },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  className={`${styles.segment} ${statusFilter === key ? styles.segmentActive : ""}`}
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                  <span
                    className={`${styles.segmentCount} ${
                      key === "needInstructor" && count > 0 && statusFilter !== key
                        ? styles.segmentCountAlert
                        : ""
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>

            <div className={styles.programChips}>
              {[
                { key: "all", label: "All", dotColor: "#9CA3AF" },
                { key: "wellness", label: "Wellness", dotColor: "var(--teal)" },
                { key: "soccer", label: "Soccer", dotColor: "var(--navy-mid)" },
              ].map(({ key, label, dotColor }) => (
                <button
                  key={key}
                  className={`${styles.programChip} ${programFilter === key ? styles.programChipActive : ""}`}
                  onClick={() => setProgramFilter(key)}
                >
                  <span className={styles.programDot} style={{ background: dotColor }} />
                  {label}
                </button>
              ))}
            </div>

            <div className={styles.searchBox}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search school or instructor"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Districts list */}
          <div className={styles.districtsList}>
            {filteredData.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Nothing matches that. Try another search or clear the filter.</p>
              </div>
            ) : (
              filteredData.map((district) => (
                <DistrictSection
                  key={district.id}
                  district={district}
                  progressMap={progressMap}
                  onEditSchool={(school) => setSchoolPanel({ mode: "edit", schoolId: school.id, districtId: district.id })}
                  onAddClass={(school) => setClassPanel({ mode: "create", schoolId: school.id, districtId: district.id })}
                  onEditClass={(cls) => setClassPanel({ mode: "edit", classId: cls.id })}
                  onDeleteDistrict={() => handleDeleteDistrict(district)}
                  onRenameDistrict={(newName) => handleRenameDistrict(district, newName)}
                  onChangeColor={(newColor) => handleChangeDistrictColor(district, newColor)}
                  statusFilter={statusFilter}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Holidays view */}
      {activeTab === "holidays" && (
        <div className={styles.holidaysTab}>
          <button
            className={styles.backLink}
            onClick={() => setActiveTab("classes")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to classes
          </button>

          <h1 className={styles.holidaysTitle}>Holidays & days off</h1>
          <p className={styles.holidaysIntro}>
            Classes skip these dates automatically, so session counts, end dates, My Schedule and payroll all stay right.
          </p>

          <div className={styles.holidaysGrid}>
            {/* School closures & holidays */}
            <div className={styles.holidayCard}>
              <h3>School closures & holidays</h3>
              <p className={styles.holidayCardDesc}>Apply to every program at the schools you pick.</p>

              {/* Add holiday form */}
              <div className={styles.addHolidayForm}>
                <input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                />
                <input
                  type="text"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="e.g., Thanksgiving"
                />
                <select
                  value={holidayScope}
                  onChange={(e) => setHolidayScope(e.target.value)}
                >
                  <option value="all">All schools</option>
                  {data.districts.map((d) => (
                    <optgroup key={d.id} label={d.name}>
                      <option value={`district:${d.id}`}>{d.name} (district)</option>
                      {d.schools?.map((s) => (
                        <option key={s.id} value={`school:${s.id}`}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <select
                  value={holidayTimePeriod}
                  onChange={(e) => setHolidayTimePeriod(e.target.value)}
                  className={styles.timePeriodSelect}
                >
                  <option value="all_day">All day</option>
                  <option value="am">AM only</option>
                  <option value="pm">PM only</option>
                </select>
                <button
                  className={styles.addBtn}
                  onClick={handleAddHoliday}
                  disabled={loading || !holidayDate || !holidayName.trim()}
                >
                  Add
                </button>
              </div>

              {/* Holidays list */}
              <div className={styles.holidaysList}>
                {upcomingHolidays.map((h) => {
                  const scope = getHolidayScope(h);
                  return (
                    <div key={h.id} className={styles.holidayRow}>
                      <span className={styles.holidayDate}>
                        {formatDateFull(h.date)}
                        {h.time_period && h.time_period !== "all_day" && (
                          <span className={styles.timePeriodBadge}>
                            {h.time_period === "am" ? "AM" : "PM"}
                          </span>
                        )}
                      </span>
                      <span className={styles.holidayName}>{h.name}</span>
                      <span className={styles.holidayScope}>
                        {scope.color && <span className={styles.scopeDot} style={{ background: scope.color }} />}
                        {scope.name}
                      </span>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteHoliday(h.id)}
                        disabled={loading}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Past holidays */}
              {pastHolidays.length > 0 && (
                <button
                  className={styles.showPastBtn}
                  onClick={() => setShowPastHolidays(!showPastHolidays)}
                >
                  {showPastHolidays ? "Hide past" : `Show past (${pastHolidays.length})`}
                </button>
              )}
              {showPastHolidays && (
                <div className={`${styles.holidaysList} ${styles.pastHolidays}`}>
                  {pastHolidays.map((h) => {
                    const scope = getHolidayScope(h);
                    return (
                      <div key={h.id} className={styles.holidayRow}>
                        <span className={styles.holidayDate}>
                          {formatDateFull(h.date)}
                          {h.time_period && h.time_period !== "all_day" && (
                            <span className={styles.timePeriodBadge}>
                              {h.time_period === "am" ? "AM" : "PM"}
                            </span>
                          )}
                        </span>
                        <span className={styles.holidayName}>{h.name}</span>
                        <span className={styles.holidayScope}>
                          {scope.color && <span className={styles.scopeDot} style={{ background: scope.color }} />}
                          {scope.name}
                        </span>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteHoliday(h.id)}
                          disabled={loading}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                className={styles.typicalHolidaysLink}
                onClick={handleAddTypicalHolidays}
                disabled={loading}
              >
                Add typical holidays for this school year
              </button>
            </div>

            {/* Program days off */}
            <div className={styles.holidayCard}>
              <h3>Program days off</h3>
              <p className={styles.holidayCardDesc}>Skip one program everywhere, like a training day or field trip.</p>

              {/* Add off day form */}
              <div className={styles.addHolidayForm}>
                <select
                  value={offDayProgram}
                  onChange={(e) => setOffDayProgram(e.target.value)}
                >
                  <option value="wellness">Youth Wellness</option>
                  <option value="soccer">Soccer</option>
                </select>
                <input
                  type="date"
                  value={offDayDate}
                  onChange={(e) => setOffDayDate(e.target.value)}
                />
                <input
                  type="text"
                  value={offDayReason}
                  onChange={(e) => setOffDayReason(e.target.value)}
                  placeholder="Reason, e.g., Field trip"
                />
                <select
                  value={offDayTimePeriod}
                  onChange={(e) => setOffDayTimePeriod(e.target.value)}
                  className={styles.timePeriodSelect}
                >
                  <option value="all_day">All day</option>
                  <option value="am">AM only</option>
                  <option value="pm">PM only</option>
                </select>
                <button
                  className={styles.addBtn}
                  onClick={handleAddOffDay}
                  disabled={loading || !offDayDate || !offDayReason.trim()}
                >
                  Add day off
                </button>
              </div>

              {/* Off days by program */}
              {["wellness", "soccer"].map((prog) => (
                <div key={prog} className={styles.offDayGroup}>
                  <span className={`${styles.offDayProgramPill} ${styles[`program_${prog}`]}`}>
                    {prog === "wellness" ? "Youth Wellness" : "Soccer"}
                  </span>
                  {offDaysByProgram[prog].length === 0 ? (
                    <p className={styles.noOffDays}>No days off scheduled</p>
                  ) : (
                    <div className={styles.offDaysList}>
                      {offDaysByProgram[prog].map((od) => (
                        <div key={od.id} className={styles.offDayRow}>
                          <span className={styles.offDayDate}>
                            {formatDateFull(od.date)}
                            {od.time_period && od.time_period !== "all_day" && (
                              <span className={styles.timePeriodBadge}>
                                {od.time_period === "am" ? "AM" : "PM"}
                              </span>
                            )}
                          </span>
                          <span className={styles.offDayReason}>{od.reason}</span>
                          <select
                            value={od.time_period || "all_day"}
                            onChange={(e) => handleUpdateOffDayTimePeriod(od.id, e.target.value)}
                            className={styles.timePeriodSelectSmall}
                            disabled={loading}
                          >
                            <option value="all_day">All day</option>
                            <option value="am">AM</option>
                            <option value="pm">PM</option>
                          </select>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteOffDay(od.id)}
                            disabled={loading}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Class panel */}
      {classPanel && (
        <ClassPanel
          {...classPanel}
          data={data}
          progressMap={progressMap}
          today={today}
          onClose={() => setClassPanel(null)}
          onSave={async () => {
            await refreshData();
            showSaved();
          }}
        />
      )}

      {/* School panel */}
      {schoolPanel && (
        <SchoolPanel
          {...schoolPanel}
          data={data}
          onClose={() => setSchoolPanel(null)}
          onSave={async (message) => {
            await refreshData();
            showSaved(message || "Saved");
          }}
          onDelete={async () => {
            await refreshData();
            showSaved("Deleted");
          }}
        />
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

// District section component
function DistrictSection({
  district,
  progressMap,
  onEditSchool,
  onAddClass,
  onEditClass,
  onDeleteDistrict,
  onRenameDistrict,
  onChangeColor,
  statusFilter,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renamingValue, setRenamingValue] = useState(district.name);
  const [changingColor, setChangingColor] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleRename = () => {
    onRenameDistrict(renamingValue);
    setRenaming(false);
  };

  const currentClassCount = (district.schools || []).reduce((sum, school) => {
    return sum + (school.classes || []).filter((cls) => {
      const progress = progressMap[cls.id] || {};
      return progress.status !== "ended";
    }).length;
  }, 0);

  const totalClassCount = (district.schools || []).reduce(
    (sum, school) => sum + (school.classes || []).length,
    0
  );

  return (
    <div className={styles.districtSection}>
      {/* District heading */}
      <div className={styles.districtHeading}>
        <span className={styles.districtDot} style={{ background: district.color }} />
        {renaming ? (
          <input
            type="text"
            value={renamingValue}
            onChange={(e) => setRenamingValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") {
                setRenamingValue(district.name);
                setRenaming(false);
              }
            }}
            className={styles.renameInput}
            autoFocus
          />
        ) : (
          <h2 className={styles.districtName}>{district.name}</h2>
        )}
        <span className={styles.districtMeta}>
          {district.schools?.length || 0} schools · {statusFilter === "ended" ? totalClassCount : currentClassCount} classes
        </span>
        <div className={styles.districtLine} />
        <div className={styles.menuWrapper} ref={menuRef}>
          <button
            className={`${styles.menuBtn} ${menuOpen ? styles.menuBtnActive : ""}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="District options"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          {menuOpen && (
            <div className={styles.menu}>
              <button onClick={() => { setRenaming(true); setMenuOpen(false); }}>
                Rename
              </button>
              <button onClick={() => { setChangingColor(true); setMenuOpen(false); }}>
                Change color
              </button>
              <button className={styles.menuDanger} onClick={() => { onDeleteDistrict(); setMenuOpen(false); }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Color picker */}
      {changingColor && (
        <div className={styles.colorPickerRow}>
          {DISTRICT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`${styles.colorSwatch} ${district.color === color ? styles.colorSelected : ""}`}
              style={{ background: color }}
              onClick={() => {
                onChangeColor(color);
                setChangingColor(false);
              }}
            />
          ))}
          <button
            className={styles.colorCancel}
            onClick={() => setChangingColor(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Schools grid */}
      <div className={styles.schoolsGrid}>
        {(district.schools || []).map((school) => (
          <SchoolCard
            key={school.id}
            school={school}
            progressMap={progressMap}
            onEditSchool={() => onEditSchool(school)}
            onAddClass={() => onAddClass(school)}
            onEditClass={onEditClass}
            statusFilter={statusFilter}
          />
        ))}
      </div>
    </div>
  );
}

// School card component
function SchoolCard({ school, progressMap, onEditSchool, onAddClass, onEditClass, statusFilter }) {
  const hasInstructions = school.instructions?.trim();
  const isEndedView = statusFilter === "ended";

  return (
    <div className={styles.schoolCard}>
      <div className={styles.schoolCardHeader}>
        <div className={styles.schoolInfo}>
          <span className={styles.schoolName}>{school.name}</span>
          {school.address && <span className={styles.schoolAddress}>{school.address}</span>}
        </div>
        <div className={styles.schoolActions}>
          <button
            className={styles.iconBtn}
            onClick={onAddClass}
            aria-label={`Add a class at ${school.name}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            className={styles.iconBtn}
            onClick={onEditSchool}
            aria-label={`Edit ${school.name}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Class rows */}
      <div className={styles.classRows}>
        {(school.classes || []).map((cls, idx) => (
          <ClassRow
            key={cls.id}
            cls={cls}
            progress={progressMap[cls.id] || {}}
            onClick={() => onEditClass(cls)}
            isFirst={idx === 0}
          />
        ))}
      </div>

      {/* Add instructions prompt */}
      {!hasInstructions && !isEndedView && (
        <button className={styles.addInstructionsBtn} onClick={onEditSchool}>
          + Add arrival instructions for instructors
        </button>
      )}
    </div>
  );
}

// Class row
function ClassRow({ cls, progress, onClick, isFirst }) {
  const isEnded = progress.status === "ended";
  const isStartingSoon = progress.status === "starts_soon";
  const program = cls.program || "wellness";
  const daysDisplay = cls.days?.join(" & ") || "";

  // Instructors
  const instructor1 = cls.assignments?.find((a) => a.slotType === "instructor_1")?.profile;
  const instructor2 = cls.assignments?.find((a) => a.slotType === "instructor_2")?.profile;
  const hasInstructor = instructor1 || instructor2;

  // Date display
  let dateDisplay = "";
  if (isStartingSoon) {
    dateDisplay = `Starts ${formatDateShort(cls.start_date)}`;
  } else if (isEnded) {
    dateDisplay = `Ended ${formatDateShort(progress.endDate || cls.start_date)}`;
  } else if (progress.totalSessions) {
    dateDisplay = `Ends ${formatDateShort(progress.endDate)}`;
  } else {
    dateDisplay = `Ongoing since ${formatDateShort(cls.start_date)}`;
  }

  return (
    <button
      className={`${styles.classRow} ${isEnded ? styles.classRowEnded : ""} ${isFirst ? "" : styles.classRowBorder}`}
      onClick={onClick}
    >
      <div
        className={styles.programStripe}
        style={{ background: program === "wellness" ? "var(--teal)" : "var(--navy-mid)" }}
      />
      <div className={styles.classMain}>
        <div className={styles.classFirstLine}>
          <span className={styles.classDaysTime}>{daysDisplay} · {cls.time}</span>
          <span
            className={styles.programLabel}
            style={{ color: program === "wellness" ? "var(--teal)" : "var(--navy-mid)" }}
          >
            {program === "wellness" ? "Wellness" : "Soccer"}
          </span>
        </div>
        <div className={styles.classSecondLine}>
          {hasInstructor ? (
            <div className={styles.instructorStack}>
              {instructor1 && (
                <span
                  className={styles.avatar}
                  style={{ background: getAvatarColor(instructor1.full_name), zIndex: 2 }}
                >
                  {instructor1.full_name?.charAt(0)}
                </span>
              )}
              {instructor2 && (
                <span
                  className={styles.avatar}
                  style={{ background: getAvatarColor(instructor2.full_name), zIndex: 1 }}
                >
                  {instructor2.full_name?.charAt(0)}
                </span>
              )}
              <span className={styles.instructorNames}>
                {[instructor1, instructor2]
                  .filter(Boolean)
                  .map((i) => getShortName(i.full_name))
                  .join(", ")}
              </span>
            </div>
          ) : (
            <div className={styles.needsInstructor}>
              <span className={styles.alertDot} />
              Needs an instructor
            </div>
          )}
        </div>
      </div>
      <div className={styles.classRight}>
        <span className={`${styles.dateDisplay} ${isStartingSoon ? styles.dateStartsSoon : ""}`}>
          {dateDisplay}
        </span>
        {progress.totalSessions && !isStartingSoon && (
          <div className={styles.progressRow}>
            <div className={styles.progressBarSmall}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.min(100, (progress.sessionsDone / progress.totalSessions) * 100)}%` }}
              />
            </div>
            <span className={styles.sessionCount}>
              {progress.sessionsDone} of {progress.totalSessions}
            </span>
          </div>
        )}
      </div>
      <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
