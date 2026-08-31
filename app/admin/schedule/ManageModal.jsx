"use client";

import { useState } from "react";
import styles from "./ManageModal.module.css";
import {
  createDistrictAction,
  createSchoolAction,
  updateSchoolAction,
  updateClassAction,
  deleteDistrictAction,
  deleteSchoolAction,
  deleteClassAction,
  toggleReviewDayAction,
  addInstructorToDistrictAction,
  removeInstructorFromDistrictAction,
  createHolidayAction,
  deleteHolidayAction,
  addTypicalHolidaysAction,
} from "@/lib/schedule/actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PRESET_COLORS = [
  "#3E8FA0", // teal
  "#1F3F91", // navy
  "#D8AE4B", // gold
  "#F2A65E", // orange
  "#6FCB55", // green
  "#9B59B6", // purple
  "#E74C3C", // red
  "#34495E", // dark gray
];

// Get current school year (Aug-Jul)
function getCurrentSchoolYear() {
  const now = new Date();
  const month = now.getMonth();
  // If August or later, school year starts this year
  // If before August, school year started last year
  return month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

export default function ManageModal({ open, onClose, data, onDataChange }) {
  const [tab, setTab] = useState("districts");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // District form
  const [districtName, setDistrictName] = useState("");
  const [districtColor, setDistrictColor] = useState(PRESET_COLORS[0]);

  // School form
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");

  // Holiday form
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayDistrictId, setHolidayDistrictId] = useState("");
  const [holidaySchoolId, setHolidaySchoolId] = useState("");

  // Expanded sections
  const [expandedDistrict, setExpandedDistrict] = useState(null);
  const [expandedSchool, setExpandedSchool] = useState(null);

  // Edit class state
  const [editingClassId, setEditingClassId] = useState(null);
  const [editDays, setEditDays] = useState([]);
  const [editTime, setEditTime] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editTargetSessions, setEditTargetSessions] = useState(null);
  const [editProgram, setEditProgram] = useState("wellness");

  // Edit school state
  const [editingSchoolId, setEditingSchoolId] = useState(null);
  const [editSchoolName, setEditSchoolName] = useState("");
  const [editSchoolAddress, setEditSchoolAddress] = useState("");

  if (!open) return null;

  const handleCreateDistrict = async (e) => {
    e.preventDefault();
    if (!districtName.trim()) return;
    setLoading(true);
    setError("");

    try {
      await createDistrictAction(districtName.trim(), districtColor);
      setDistrictName("");
      setDistrictColor(PRESET_COLORS[0]);
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    if (!schoolName.trim() || !selectedDistrictId) return;
    setLoading(true);
    setError("");

    try {
      await createSchoolAction(selectedDistrictId, schoolName.trim(), schoolAddress.trim() || null);
      setSchoolName("");
      setSchoolAddress("");
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDistrict = async (id) => {
    if (!confirm("Delete this district and all its schools/classes?")) return;
    setLoading(true);
    try {
      await deleteDistrictAction(id);
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchool = async (id) => {
    if (!confirm("Delete this school and all its classes?")) return;
    setLoading(true);
    try {
      await deleteSchoolAction(id);
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClass = async (id) => {
    if (!confirm("Delete this class?")) return;
    setLoading(true);
    try {
      await deleteClassAction(id);
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReviewDay = async (classId, currentValue) => {
    setLoading(true);
    try {
      await toggleReviewDayAction(classId, !currentValue);
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleInstructorDistrict = async (profileId, districtId, isCurrentlyAssigned) => {
    setLoading(true);
    try {
      if (isCurrentlyAssigned) {
        await removeInstructorFromDistrictAction(profileId, districtId);
      } else {
        await addInstructorToDistrictAction(profileId, districtId);
      }
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) return;
    setLoading(true);
    setError("");

    try {
      // If school is selected, use its district; otherwise use selected district
      let districtId = holidayDistrictId || null;
      let schoolId = holidaySchoolId || null;

      // If a school is selected, we need to ensure the district is correct
      if (schoolId) {
        const school = data.districts
          .flatMap(d => d.schools || [])
          .find(s => s.id === schoolId);
        if (school) {
          // School-specific holiday doesn't need district_id (it's implicit)
          districtId = null;
        }
      }

      await createHolidayAction(
        holidayDate,
        holidayName.trim(),
        districtId,
        schoolId
      );
      setHolidayDate("");
      setHolidayName("");
      setHolidayDistrictId("");
      setHolidaySchoolId("");
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHoliday = async (id) => {
    setLoading(true);
    try {
      await deleteHolidayAction(id);
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTypicalHolidays = async () => {
    const schoolYear = getCurrentSchoolYear();
    if (!confirm(`Add typical school holidays for ${schoolYear}-${schoolYear + 1}? This includes Labor Day, Thanksgiving, Winter Break, MLK Day, Presidents' Day, Spring Break, and Memorial Day.`)) {
      return;
    }
    setLoading(true);
    setError("");

    try {
      await addTypicalHolidaysAction(schoolYear);
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleEditDay = (day) => {
    setEditDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const startEditingSchool = (school) => {
    setEditingSchoolId(school.id);
    setEditSchoolName(school.name || "");
    setEditSchoolAddress(school.address || "");
  };

  const cancelEditingSchool = () => {
    setEditingSchoolId(null);
  };

  const handleUpdateSchool = async (schoolId) => {
    if (!editSchoolName.trim()) {
      setError("School name is required");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await updateSchoolAction(schoolId, {
        name: editSchoolName.trim(),
        address: editSchoolAddress.trim() || null,
      });
      setEditingSchoolId(null);
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditingClass = (cls) => {
    setEditingClassId(cls.id);
    setEditDays(cls.days || []);
    setEditTime(cls.time || "");
    setEditStartDate(cls.start_date || "");
    setEditTargetSessions(cls.target_sessions);
    setEditProgram(cls.program || "wellness");
  };

  const cancelEditingClass = () => {
    setEditingClassId(null);
  };

  const handleUpdateClass = async (classId) => {
    if (editDays.length === 0 || !editTime.trim()) {
      setError("Days and time are required");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await updateClassAction(classId, {
        days: editDays,
        time: editTime.trim(),
        start_date: editStartDate || null,
        target_sessions: editTargetSessions,
        program: editProgram,
      });
      setEditingClassId(null);
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Group holidays by month for display
  const groupHolidaysByMonth = (holidays) => {
    const grouped = {};
    holidays.forEach((h) => {
      const date = new Date(h.date + "T00:00:00");
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!grouped[key]) {
        grouped[key] = { label, holidays: [] };
      }
      grouped[key].holidays.push(h);
    });
    return Object.values(grouped).sort((a, b) => a.label.localeCompare(b.label));
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Manage Schedule</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {["districts", "schools", "classes", "holidays", "instructors"].map((t) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.active : ""}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {error && <p className={styles.error}>{error}</p>}

          {/* Districts Tab */}
          {tab === "districts" && (
            <>
              <form className={styles.form} onSubmit={handleCreateDistrict}>
                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label>District Name</label>
                    <input
                      type="text"
                      value={districtName}
                      onChange={(e) => setDistrictName(e.target.value)}
                      placeholder="e.g., North District"
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Color</label>
                    <div className={styles.colorPicker}>
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`${styles.colorSwatch} ${districtColor === color ? styles.selected : ""}`}
                          style={{ background: color }}
                          onClick={() => setDistrictColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <button type="submit" className={styles.addBtn} disabled={loading}>
                  {loading ? "Adding..." : "Add District"}
                </button>
              </form>

              <div className={styles.list}>
                {data.districts.map((district) => (
                  <div key={district.id} className={styles.listItem}>
                    <span
                      className={styles.districtDot}
                      style={{ background: district.color }}
                    />
                    <span className={styles.listName}>{district.name}</span>
                    <span className={styles.listCount}>
                      {district.schools?.length || 0} schools
                    </span>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteDistrict(district.id)}
                      disabled={loading}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                ))}
                {data.districts.length === 0 && (
                  <p className={styles.empty}>No districts yet</p>
                )}
              </div>
            </>
          )}

          {/* Schools Tab */}
          {tab === "schools" && (
            <>
              <form className={styles.form} onSubmit={handleCreateSchool}>
                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label>District</label>
                    <select
                      value={selectedDistrictId}
                      onChange={(e) => setSelectedDistrictId(e.target.value)}
                      required
                    >
                      <option value="">Select district...</option>
                      {data.districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>School Name</label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="e.g., Lincoln Elementary"
                      required
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Address (for directions)</label>
                  <input
                    type="text"
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    placeholder="e.g., 123 Main St, City, CA 90210"
                  />
                </div>
                <button type="submit" className={styles.addBtn} disabled={loading}>
                  {loading ? "Adding..." : "Add School"}
                </button>
              </form>

              <div className={styles.list}>
                {data.districts.map((district) => (
                  <div key={district.id} className={styles.listGroup}>
                    <div
                      className={styles.listGroupHeader}
                      onClick={() =>
                        setExpandedDistrict(
                          expandedDistrict === district.id ? null : district.id
                        )
                      }
                    >
                      <span
                        className={styles.districtDot}
                        style={{ background: district.color }}
                      />
                      <span>{district.name}</span>
                      <svg
                        className={`${styles.chevron} ${expandedDistrict === district.id ? styles.expanded : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                    {expandedDistrict === district.id && (
                      <div className={styles.listGroupContent}>
                        {district.schools?.map((school) => (
                          <div key={school.id} className={`${styles.schoolItem} ${editingSchoolId === school.id ? styles.classItemEditing : ""}`}>
                            {editingSchoolId === school.id ? (
                              <div className={styles.editClassForm}>
                                <div className={styles.editRow}>
                                  <div className={styles.field}>
                                    <label>School Name</label>
                                    <input
                                      type="text"
                                      value={editSchoolName}
                                      onChange={(e) => setEditSchoolName(e.target.value)}
                                      placeholder="School name"
                                    />
                                  </div>
                                </div>
                                <div className={styles.editRow}>
                                  <div className={styles.field}>
                                    <label>Address</label>
                                    <input
                                      type="text"
                                      value={editSchoolAddress}
                                      onChange={(e) => setEditSchoolAddress(e.target.value)}
                                      placeholder="e.g., 123 Main St, City, CA 90210"
                                    />
                                  </div>
                                </div>
                                <div className={styles.editActions}>
                                  <button
                                    type="button"
                                    className={styles.cancelEditBtn}
                                    onClick={cancelEditingSchool}
                                    disabled={loading}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.saveEditBtn}
                                    onClick={() => handleUpdateSchool(school.id)}
                                    disabled={loading}
                                  >
                                    {loading ? "Saving..." : "Save"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className={styles.schoolInfo}>
                                  <span className={styles.listName}>{school.name}</span>
                                  {school.address && (
                                    <span className={styles.schoolAddress}>{school.address}</span>
                                  )}
                                  {!school.address && (
                                    <span className={styles.schoolNoAddress}>No address</span>
                                  )}
                                </div>
                                <span className={styles.listCount}>
                                  {school.classes?.length || 0} classes
                                </span>
                                <button
                                  className={styles.editBtn}
                                  onClick={() => startEditingSchool(school)}
                                  disabled={loading}
                                  title="Edit school"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button
                                  className={styles.deleteBtn}
                                  onClick={() => handleDeleteSchool(school.id)}
                                  disabled={loading}
                                  title="Delete school"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                        {(!district.schools || district.schools.length === 0) && (
                          <p className={styles.empty}>No schools in this district</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Classes Tab */}
          {tab === "classes" && (
            <>
              <p className={styles.tabDescription}>
                Use the &quot;+ Add Class&quot; button on the Schedule Board to create new classes. Here you can view and edit existing classes.
              </p>

              <div className={styles.list}>
                {data.districts.map((district) =>
                  district.schools?.map((school) => (
                    <div key={school.id} className={styles.listGroup}>
                      <div
                        className={styles.listGroupHeader}
                        onClick={() =>
                          setExpandedSchool(
                            expandedSchool === school.id ? null : school.id
                          )
                        }
                      >
                        <span
                          className={styles.districtDot}
                          style={{ background: district.color }}
                        />
                        <span>
                          {district.name} - {school.name}
                        </span>
                        <svg
                          className={`${styles.chevron} ${expandedSchool === school.id ? styles.expanded : ""}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                      {expandedSchool === school.id && (
                        <div className={styles.listGroupContent}>
                          {school.classes?.map((cls) => (
                            <div key={cls.id} className={`${styles.classItem} ${editingClassId === cls.id ? styles.classItemEditing : ""}`}>
                              {editingClassId === cls.id ? (
                                <div className={styles.editClassForm}>
                                  <div className={styles.editRow}>
                                    <div className={styles.field}>
                                      <label>Days</label>
                                      <div className={styles.dayCheckboxes}>
                                        {DAYS.map((day) => (
                                          <label key={day} className={styles.dayCheckbox}>
                                            <input
                                              type="checkbox"
                                              checked={editDays.includes(day)}
                                              onChange={() => toggleEditDay(day)}
                                            />
                                            <span>{day}</span>
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                    <div className={styles.field}>
                                      <label>Time</label>
                                      <input
                                        type="text"
                                        value={editTime}
                                        onChange={(e) => setEditTime(e.target.value)}
                                        placeholder="e.g., 2:30pm"
                                      />
                                    </div>
                                  </div>
                                  <div className={styles.editRow}>
                                    <div className={styles.field}>
                                      <label>Start Date</label>
                                      <input
                                        type="date"
                                        value={editStartDate}
                                        onChange={(e) => setEditStartDate(e.target.value)}
                                      />
                                    </div>
                                    <div className={styles.field}>
                                      <label>Sessions</label>
                                      <input
                                        type="number"
                                        value={editTargetSessions || ""}
                                        onChange={(e) => setEditTargetSessions(e.target.value ? parseInt(e.target.value) : null)}
                                        placeholder="Ongoing"
                                        min="1"
                                      />
                                    </div>
                                    <div className={styles.field}>
                                      <label>Program</label>
                                      <select
                                        value={editProgram}
                                        onChange={(e) => setEditProgram(e.target.value)}
                                      >
                                        <option value="wellness">Wellness</option>
                                        <option value="soccer">Soccer</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className={styles.editActions}>
                                    <button
                                      type="button"
                                      className={styles.cancelEditBtn}
                                      onClick={cancelEditingClass}
                                      disabled={loading}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.saveEditBtn}
                                      onClick={() => handleUpdateClass(cls.id)}
                                      disabled={loading}
                                    >
                                      {loading ? "Saving..." : "Save"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className={styles.classInfo}>
                                    <span className={styles.listName}>
                                      {cls.days?.join(", ")} @ {cls.time}
                                    </span>
                                    <span className={styles.classMeta}>
                                      {cls.program === "soccer" ? "Soccer" : "Wellness"}
                                      {cls.start_date && (
                                        <> · starts {new Date(cls.start_date + "T00:00:00").toLocaleDateString()}</>
                                      )}
                                      {cls.target_sessions && (
                                        <> · {cls.target_sessions} sessions</>
                                      )}
                                      {!cls.target_sessions && cls.start_date && (
                                        <> · ongoing</>
                                      )}
                                    </span>
                                  </div>
                                  <label className={styles.reviewToggle}>
                                    <input
                                      type="checkbox"
                                      checked={cls.is_review_day}
                                      onChange={() =>
                                        handleToggleReviewDay(cls.id, cls.is_review_day)
                                      }
                                    />
                                    <span>Review</span>
                                  </label>
                                  <button
                                    className={styles.editBtn}
                                    onClick={() => startEditingClass(cls)}
                                    disabled={loading}
                                    title="Edit class"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    className={styles.deleteBtn}
                                    onClick={() => handleDeleteClass(cls.id)}
                                    disabled={loading}
                                    title="Delete class"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                          {(!school.classes || school.classes.length === 0) && (
                            <p className={styles.empty}>No classes at this school</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Holidays Tab */}
          {tab === "holidays" && (
            <>
              <p className={styles.tabDescription}>
                Add school holidays and off-days. Classes scheduled on these dates will be automatically skipped when calculating program end dates.
              </p>

              <div className={styles.holidayActions}>
                <button
                  type="button"
                  className={styles.autoHolidayBtn}
                  onClick={handleAddTypicalHolidays}
                  disabled={loading}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Add Typical School Holidays ({getCurrentSchoolYear()}-{getCurrentSchoolYear() + 1})
                </button>
              </div>

              <form className={styles.form} onSubmit={handleCreateHoliday}>
                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label>Date</label>
                    <input
                      type="date"
                      value={holidayDate}
                      onChange={(e) => setHolidayDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Holiday Name</label>
                    <input
                      type="text"
                      value={holidayName}
                      onChange={(e) => setHolidayName(e.target.value)}
                      placeholder="e.g., Teacher Workday"
                      required
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label>Applies To</label>
                    <select
                      value={holidaySchoolId ? `school:${holidaySchoolId}` : (holidayDistrictId ? `district:${holidayDistrictId}` : "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setHolidayDistrictId("");
                          setHolidaySchoolId("");
                        } else if (val.startsWith("district:")) {
                          setHolidayDistrictId(val.replace("district:", ""));
                          setHolidaySchoolId("");
                        } else if (val.startsWith("school:")) {
                          setHolidaySchoolId(val.replace("school:", ""));
                          setHolidayDistrictId("");
                        }
                      }}
                    >
                      <option value="">All Districts</option>
                      {data.districts.map((d) => (
                        <optgroup key={d.id} label={d.name}>
                          <option value={`district:${d.id}`}>
                            All schools in {d.name}
                          </option>
                          {d.schools?.map((s) => (
                            <option key={s.id} value={`school:${s.id}`}>
                              {s.name} only
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className={styles.addBtn} disabled={loading}>
                  {loading ? "Adding..." : "Add Holiday"}
                </button>
              </form>

              <div className={styles.holidayList}>
                {data.holidays && data.holidays.length > 0 ? (
                  groupHolidaysByMonth(data.holidays).map((group) => (
                    <div key={group.label} className={styles.holidayMonth}>
                      <h4 className={styles.holidayMonthTitle}>{group.label}</h4>
                      <div className={styles.holidayMonthItems}>
                        {group.holidays.map((h) => {
                          // Find school and district for display
                          let school = null;
                          let district = null;
                          if (h.school_id) {
                            for (const d of data.districts) {
                              const s = d.schools?.find((s) => s.id === h.school_id);
                              if (s) {
                                school = s;
                                district = d;
                                break;
                              }
                            }
                          } else if (h.district_id) {
                            district = data.districts.find((d) => d.id === h.district_id);
                          }
                          return (
                            <div key={h.id} className={styles.holidayItem}>
                              <span className={styles.holidayDate}>
                                {formatDate(h.date)}
                              </span>
                              <span className={styles.holidayName}>{h.name}</span>
                              {school ? (
                                <span className={styles.holidayDistrict}>
                                  <span
                                    className={styles.districtDot}
                                    style={{ background: district?.color || "#888" }}
                                  />
                                  {school.name}
                                </span>
                              ) : district ? (
                                <span className={styles.holidayDistrict}>
                                  <span
                                    className={styles.districtDot}
                                    style={{ background: district.color }}
                                  />
                                  {district.name}
                                </span>
                              ) : (
                                <span className={styles.holidayGlobal}>All districts</span>
                              )}
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
                    </div>
                  ))
                ) : (
                  <p className={styles.empty}>No holidays added yet</p>
                )}
              </div>
            </>
          )}

          {/* Instructors Tab */}
          {tab === "instructors" && (
            <>
              <p className={styles.tabDescription}>
                Assign instructors and admins to districts. Each person can belong to multiple districts.
              </p>
              <div className={styles.list}>
                {data.instructors?.map((instructor) => {
                  const assignedDistricts = instructor.district_ids || [];
                  return (
                    <div key={instructor.id} className={styles.instructorItem}>
                      <div className={styles.instructorHeader}>
                        <span className={styles.listName}>{instructor.full_name}</span>
                        <span className={styles.roleBadge}>{instructor.role}</span>
                      </div>
                      <div className={styles.districtCheckboxes}>
                        {data.districts.map((d) => {
                          const isAssigned = assignedDistricts.includes(d.id);
                          return (
                            <label key={d.id} className={styles.districtCheckbox}>
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() =>
                                  handleToggleInstructorDistrict(instructor.id, d.id, isAssigned)
                                }
                                disabled={loading}
                              />
                              <span
                                className={styles.districtDot}
                                style={{ background: d.color }}
                              />
                              <span>{d.name}</span>
                            </label>
                          );
                        })}
                        {data.districts.length === 0 && (
                          <span className={styles.noDistricts}>No districts created yet</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!data.instructors || data.instructors.length === 0) && (
                  <p className={styles.empty}>No instructors or admins found</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
