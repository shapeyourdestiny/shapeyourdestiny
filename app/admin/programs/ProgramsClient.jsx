"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import styles from "./ProgramsClient.module.css";
import ClassPanel from "./ClassPanel";
import SchoolPanel from "./SchoolPanel";
import ConfirmModal from "./ConfirmModal";
import {
  createDistrictAction,
  deleteDistrictAction,
  createSchoolAction,
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
  "#F2A65E", // orange
  "#E74C3C", // red
  "#3498DB", // blue
  "#1ABC9C", // turquoise
  "#E91E63", // pink
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

export default function ProgramsClient({ initialData, progressMap, today }) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState("classes");
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("current");

  // Panel state
  const [classPanel, setClassPanel] = useState(null); // { mode: 'create'|'edit', classId?, schoolId?, districtId? }
  const [schoolPanel, setSchoolPanel] = useState(null); // { schoolId, districtId }

  // Inline forms
  const [addingDistrict, setAddingDistrict] = useState(false);
  const [newDistrictName, setNewDistrictName] = useState("");
  const [newDistrictColor, setNewDistrictColor] = useState(DISTRICT_COLORS[0]);
  const [addingSchoolTo, setAddingSchoolTo] = useState(null); // districtId
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolAddress, setNewSchoolAddress] = useState("");

  // Collapsed districts (localStorage)
  const [collapsedDistricts, setCollapsedDistricts] = useState(() => {
    try {
      const saved = localStorage.getItem("programs_collapsed_districts");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Holidays tab state
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayScope, setHolidayScope] = useState("all");
  const [offDayProgram, setOffDayProgram] = useState("wellness");
  const [offDayDate, setOffDayDate] = useState("");
  const [offDayReason, setOffDayReason] = useState("");
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

  // Save collapsed state
  useEffect(() => {
    try {
      localStorage.setItem("programs_collapsed_districts", JSON.stringify(collapsedDistricts));
    } catch {
      // ignore
    }
  }, [collapsedDistricts]);

  const toggleDistrictCollapse = (districtId) => {
    setCollapsedDistricts((prev) => ({
      ...prev,
      [districtId]: !prev[districtId],
    }));
  };

  // Show save message briefly
  const showSaved = (message = "Saved") => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const showError = (message) => {
    setSaveMessage({ error: true, text: message });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Compute stats
  const stats = useMemo(() => {
    let currentClasses = 0;
    let endedClasses = 0;
    let needInstructor = 0;
    let totalSchools = 0;

    for (const district of data.districts) {
      totalSchools += district.schools?.length || 0;
      for (const school of district.schools || []) {
        for (const cls of school.classes || []) {
          const progress = progressMap[cls.id] || {};
          if (progress.status === "ended") {
            endedClasses++;
          } else {
            currentClasses++;
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
      endedClasses,
      needInstructor,
      totalSchools,
      totalDistricts: data.districts.length,
    };
  }, [data, progressMap]);

  // Filter classes
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return data.districts
      .map((district) => {
        const filteredSchools = (district.schools || [])
          .map((school) => {
            const filteredClasses = (school.classes || []).filter((cls) => {
              const progress = progressMap[cls.id] || {};

              // Status filter
              if (statusFilter === "current" && progress.status === "ended") return false;
              if (statusFilter === "ended" && progress.status !== "ended") return false;
              if (statusFilter === "needInstructor") {
                if (progress.status === "ended") return false;
                const hasInstructor = cls.assignments?.some(
                  (a) => a.slotType === "instructor_1" || a.slotType === "instructor_2"
                );
                if (hasInstructor) return false;
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
          .filter((school) => school.classes.length > 0 || (!query && statusFilter !== "ended"));

        return { ...district, schools: filteredSchools };
      })
      .filter((district) => district.schools.length > 0);
  }, [data, progressMap, searchQuery, programFilter, statusFilter]);

  // Add district
  const handleAddDistrict = async () => {
    if (!newDistrictName.trim()) return;
    setLoading(true);
    try {
      await createDistrictAction(newDistrictName.trim(), newDistrictColor);
      await refreshData();
      setAddingDistrict(false);
      setNewDistrictName("");
      setNewDistrictColor(DISTRICT_COLORS[0]);
      showSaved();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

  // Add school
  const handleAddSchool = async (districtId) => {
    if (!newSchoolName.trim()) return;
    setLoading(true);
    try {
      await createSchoolAction(districtId, newSchoolName.trim(), newSchoolAddress.trim() || null);
      await refreshData();
      setAddingSchoolTo(null);
      setNewSchoolName("");
      setNewSchoolAddress("");
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
      await createHolidayAction(holidayDate, holidayName.trim(), districtId, schoolId);
      await refreshData();
      setHolidayDate("");
      setHolidayName("");
      setHolidayScope("all");
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
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1>Programs</h1>
          <p>Every district, school and class in one place. Set things up here, then assign on the Schedule Board.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.addDistrictBtn}
            onClick={() => setAddingDistrict(true)}
          >
            + Add district
          </button>
          <button
            className={styles.addClassBtn}
            onClick={() => setClassPanel({ mode: "create" })}
          >
            + Add class
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "classes" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("classes")}
        >
          Districts, schools & classes
        </button>
        <button
          className={`${styles.tab} ${activeTab === "holidays" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("holidays")}
        >
          Holidays & days off
        </button>
      </div>

      {/* Save message */}
      {saveMessage && (
        <div className={`${styles.saveMessage} ${saveMessage.error ? styles.saveError : ""}`}>
          {saveMessage.error ? saveMessage.text : saveMessage}
        </div>
      )}

      {/* Tab 1: Classes */}
      {activeTab === "classes" && (
        <div className={styles.classesTab}>
          {/* Stat cards */}
          <div className={styles.statCards}>
            <button
              className={`${styles.statCard} ${statusFilter === "current" ? styles.statCardActive : ""}`}
              onClick={() => setStatusFilter(statusFilter === "current" ? "current" : "current")}
            >
              <span className={styles.statNumber}>{stats.currentClasses}</span>
              <span className={styles.statLabel}>Current classes</span>
            </button>
            <button
              className={`${styles.statCard} ${statusFilter === "all" ? styles.statCardActive : ""}`}
              onClick={() => setStatusFilter(statusFilter === "all" ? "current" : "all")}
            >
              <span className={styles.statNumber}>{stats.totalSchools}</span>
              <span className={styles.statLabel}>Schools in {stats.totalDistricts} districts</span>
            </button>
            <button
              className={`${styles.statCard} ${statusFilter === "needInstructor" ? styles.statCardActive : ""}`}
              onClick={() => setStatusFilter(statusFilter === "needInstructor" ? "current" : "needInstructor")}
            >
              <span className={`${styles.statNumber} ${stats.needInstructor > 0 ? styles.statOrange : styles.statGreen}`}>
                {stats.needInstructor}
              </span>
              <span className={styles.statLabel}>Need an instructor</span>
            </button>
            <button
              className={`${styles.statCard} ${statusFilter === "ended" ? styles.statCardActive : ""}`}
              onClick={() => setStatusFilter(statusFilter === "ended" ? "current" : "ended")}
            >
              <span className={styles.statNumber}>{stats.endedClasses}</span>
              <span className={styles.statLabel}>Ended</span>
            </button>
          </div>

          {/* Search and filter */}
          <div className={styles.filterBar}>
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
            <div className={styles.programPills}>
              {["all", "wellness", "soccer"].map((p) => (
                <button
                  key={p}
                  className={`${styles.programPill} ${programFilter === p ? styles.programPillActive : ""}`}
                  onClick={() => setProgramFilter(p)}
                >
                  {p === "all" ? "All programs" : p === "wellness" ? "Youth Wellness" : "Soccer"}
                </button>
              ))}
            </div>
          </div>

          {/* Add district inline */}
          {addingDistrict && (
            <div className={styles.addDistrictCard}>
              <div className={styles.addDistrictForm}>
                <div className={styles.field}>
                  <label>District name</label>
                  <input
                    type="text"
                    value={newDistrictName}
                    onChange={(e) => setNewDistrictName(e.target.value)}
                    placeholder="e.g., Fontana"
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <label>Color</label>
                  <div className={styles.colorPicker}>
                    {DISTRICT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`${styles.colorSwatch} ${newDistrictColor === color ? styles.colorSelected : ""}`}
                        style={{ background: color }}
                        onClick={() => setNewDistrictColor(color)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.addDistrictActions}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => {
                    setAddingDistrict(false);
                    setNewDistrictName("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={handleAddDistrict}
                  disabled={loading || !newDistrictName.trim()}
                >
                  Add district
                </button>
              </div>
            </div>
          )}

          {/* Districts list */}
          <div className={styles.districtsList}>
            {filteredData.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Nothing matches that. Try another search or clear the filter.</p>
              </div>
            ) : (
              filteredData.map((district) => (
                <DistrictCard
                  key={district.id}
                  district={district}
                  progressMap={progressMap}
                  collapsed={collapsedDistricts[district.id]}
                  onToggleCollapse={() => toggleDistrictCollapse(district.id)}
                  onAddSchool={() => {
                    setAddingSchoolTo(district.id);
                    setNewSchoolName("");
                    setNewSchoolAddress("");
                  }}
                  onEditSchool={(school) => setSchoolPanel({ schoolId: school.id, districtId: district.id })}
                  onAddClass={(school) => setClassPanel({ mode: "create", schoolId: school.id, districtId: district.id })}
                  onEditClass={(cls) => setClassPanel({ mode: "edit", classId: cls.id })}
                  onDeleteDistrict={() => handleDeleteDistrict(district)}
                  addingSchool={addingSchoolTo === district.id}
                  newSchoolName={newSchoolName}
                  setNewSchoolName={setNewSchoolName}
                  newSchoolAddress={newSchoolAddress}
                  setNewSchoolAddress={setNewSchoolAddress}
                  onCancelAddSchool={() => setAddingSchoolTo(null)}
                  onConfirmAddSchool={() => handleAddSchool(district.id)}
                  loading={loading}
                  statusFilter={statusFilter}
                />
              ))
            )}
          </div>

          {/* Footer note */}
          <p className={styles.footerNote}>
            Ended classes stay here for payroll and history. Turn them off with the filter above.
          </p>
        </div>
      )}

      {/* Tab 2: Holidays */}
      {activeTab === "holidays" && (
        <div className={styles.holidaysTab}>
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
                      <span className={styles.holidayDate}>{formatDateFull(h.date)}</span>
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
                        <span className={styles.holidayDate}>{formatDateFull(h.date)}</span>
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
                          <span className={styles.offDayDate}>{formatDateFull(od.date)}</span>
                          <span className={styles.offDayReason}>{od.reason}</span>
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
          onSave={async () => {
            await refreshData();
            showSaved();
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

// District card component
function DistrictCard({
  district,
  progressMap,
  collapsed,
  onToggleCollapse,
  onAddSchool,
  onEditSchool,
  onAddClass,
  onEditClass,
  onDeleteDistrict,
  addingSchool,
  newSchoolName,
  setNewSchoolName,
  newSchoolAddress,
  setNewSchoolAddress,
  onCancelAddSchool,
  onConfirmAddSchool,
  loading,
  statusFilter,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const currentClassCount = (district.schools || []).reduce((sum, school) => {
    return sum + (school.classes || []).filter((cls) => {
      const progress = progressMap[cls.id] || {};
      return progress.status !== "ended";
    }).length;
  }, 0);

  return (
    <div className={styles.districtCard} style={{ "--district-color": district.color }}>
      <div className={styles.districtHeader} onClick={onToggleCollapse}>
        <button className={`${styles.collapseBtn} ${collapsed ? styles.collapsed : ""}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <h3 className={styles.districtName}>{district.name}</h3>
        <span className={styles.districtMeta}>
          {district.schools?.length || 0} schools · {currentClassCount} classes
        </span>
        <button
          className={styles.addSchoolPill}
          onClick={(e) => {
            e.stopPropagation();
            onAddSchool();
          }}
        >
          + Add school
        </button>
        <div className={styles.menuWrapper}>
          <button
            className={styles.menuBtn}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          {menuOpen && (
            <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
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

      {!collapsed && (
        <div className={styles.districtContent}>
          {/* Add school inline */}
          {addingSchool && (
            <div className={styles.addSchoolInline}>
              <input
                type="text"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                placeholder="School name"
                autoFocus
              />
              <input
                type="text"
                value={newSchoolAddress}
                onChange={(e) => setNewSchoolAddress(e.target.value)}
                placeholder="Address, for directions"
              />
              <button className={styles.cancelBtn} onClick={onCancelAddSchool}>
                Cancel
              </button>
              <button
                className={styles.primaryBtn}
                onClick={onConfirmAddSchool}
                disabled={loading || !newSchoolName.trim()}
              >
                Add school
              </button>
            </div>
          )}

          {/* Schools */}
          {(district.schools || []).map((school) => (
            <SchoolSection
              key={school.id}
              school={school}
              progressMap={progressMap}
              onEditSchool={() => onEditSchool(school)}
              onAddClass={() => onAddClass(school)}
              onEditClass={onEditClass}
              statusFilter={statusFilter}
            />
          ))}

          {(!district.schools || district.schools.length === 0) && !addingSchool && (
            <p className={styles.noSchools}>No schools yet</p>
          )}
        </div>
      )}
    </div>
  );
}

// School section within a district
function SchoolSection({ school, progressMap, onEditSchool, onAddClass, onEditClass, statusFilter }) {
  const visibleClasses = (school.classes || []).filter((cls) => {
    const progress = progressMap[cls.id] || {};
    if (statusFilter === "ended") return progress.status === "ended";
    if (statusFilter === "current" || statusFilter === "needInstructor") return progress.status !== "ended";
    return true;
  });

  return (
    <div className={styles.schoolSection}>
      <div className={styles.schoolHeader}>
        <div className={styles.schoolInfo}>
          <span className={styles.schoolName}>{school.name}</span>
          {school.address && <span className={styles.schoolAddress}>{school.address}</span>}
        </div>
        {!school.instructions && (
          <span className={styles.noInstructionsPill}>No instructions yet</span>
        )}
        <button className={styles.editSchoolLink} onClick={onEditSchool}>
          Edit school
        </button>
        <button className={styles.addClassPill} onClick={onAddClass}>
          + Add class here
        </button>
      </div>

      {visibleClasses.length === 0 ? (
        <p className={styles.noClasses}>No classes yet.</p>
      ) : (
        <div className={styles.classesList}>
          {visibleClasses.map((cls) => (
            <ClassRow
              key={cls.id}
              cls={cls}
              progress={progressMap[cls.id] || {}}
              onClick={() => onEditClass(cls)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Class row
function ClassRow({ cls, progress, onClick }) {
  const isEnded = progress.status === "ended";
  const program = cls.program || "wellness";
  const daysDisplay = cls.days?.join(" & ") || "";

  // Instructors
  const instructor1 = cls.assignments?.find((a) => a.slotType === "instructor_1")?.profile;
  const instructor2 = cls.assignments?.find((a) => a.slotType === "instructor_2")?.profile;
  const hasInstructor = instructor1 || instructor2;

  // Date display
  let dateDisplay = "";
  if (progress.status === "starts_soon") {
    dateDisplay = `Starts ${formatDateShort(cls.start_date)}`;
    if (progress.totalSessions) {
      dateDisplay += ` · ${progress.totalSessions} sessions`;
    }
  } else if (progress.totalSessions) {
    dateDisplay = `${formatDateShort(cls.start_date)} - ${formatDateShort(progress.endDate)}`;
  } else {
    dateDisplay = `Since ${formatDateShort(cls.start_date)} · ongoing`;
  }

  // Status pill
  let statusPill = null;
  if (progress.status === "starts_soon") {
    statusPill = <span className={`${styles.statusPill} ${styles.statusStartsSoon}`}>Starts soon</span>;
  } else if (progress.status === "ended") {
    statusPill = <span className={`${styles.statusPill} ${styles.statusEnded}`}>Ended</span>;
  } else {
    statusPill = <span className={`${styles.statusPill} ${styles.statusRunning}`}>Running</span>;
  }

  return (
    <button
      className={`${styles.classRow} ${isEnded ? styles.classRowEnded : ""}`}
      onClick={onClick}
    >
      <span className={`${styles.programPillSmall} ${styles[`program_${program}`]}`}>
        {program === "wellness" ? "Wellness" : "Soccer"}
      </span>
      <span className={styles.classDaysTime}>
        {daysDisplay} · {cls.time}
      </span>
      <div className={styles.classDateProgress}>
        <span className={styles.classDateText}>{dateDisplay}</span>
        {progress.totalSessions && progress.status !== "starts_soon" && (
          <div className={styles.progressBarWrapper}>
            <div
              className={styles.progressBar}
              style={{ width: `${Math.min(100, (progress.sessionsDone / progress.totalSessions) * 100)}%` }}
            />
          </div>
        )}
        {progress.totalSessions && progress.status !== "starts_soon" && (
          <span className={styles.sessionCount}>
            {progress.sessionsDone} of {progress.totalSessions} sessions
          </span>
        )}
      </div>
      <div className={styles.instructorChips}>
        {hasInstructor ? (
          <>
            {instructor1 && (
              <span className={styles.instructorChip}>
                <span className={styles.instructorInitial}>{instructor1.full_name?.charAt(0)}</span>
                {instructor1.full_name}
              </span>
            )}
            {instructor2 && (
              <span className={styles.instructorChip}>
                <span className={styles.instructorInitial}>{instructor2.full_name?.charAt(0)}</span>
                {instructor2.full_name}
              </span>
            )}
          </>
        ) : (
          <span className={`${styles.instructorChip} ${styles.noInstructor}`}>No instructor</span>
        )}
      </div>
      {statusPill}
      <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
