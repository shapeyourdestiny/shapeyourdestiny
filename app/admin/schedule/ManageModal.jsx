"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ManageModal.module.css";
import {
  createDistrictAction,
  createSchoolAction,
  createClassAction,
  deleteDistrictAction,
  deleteSchoolAction,
  deleteClassAction,
  toggleReviewDayAction,
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

export default function ManageModal({ open, onClose, data }) {
  const router = useRouter();
  const [tab, setTab] = useState("districts");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // District form
  const [districtName, setDistrictName] = useState("");
  const [districtColor, setDistrictColor] = useState(PRESET_COLORS[0]);

  // School form
  const [schoolName, setSchoolName] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");

  // Class form
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [classDays, setClassDays] = useState([]);
  const [classTime, setClassTime] = useState("");

  // Expanded sections
  const [expandedDistrict, setExpandedDistrict] = useState(null);
  const [expandedSchool, setExpandedSchool] = useState(null);

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
      router.refresh();
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
      await createSchoolAction(selectedDistrictId, schoolName.trim());
      setSchoolName("");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!selectedSchoolId || classDays.length === 0 || !classTime.trim()) return;
    setLoading(true);
    setError("");

    try {
      await createClassAction(selectedSchoolId, classDays, classTime.trim());
      setClassDays([]);
      setClassTime("");
      router.refresh();
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
      router.refresh();
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
      router.refresh();
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
      router.refresh();
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
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day) => {
    setClassDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
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
          {["districts", "schools", "classes"].map((t) => (
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
                          <div key={school.id} className={styles.listItem}>
                            <span className={styles.listName}>{school.name}</span>
                            <span className={styles.listCount}>
                              {school.classes?.length || 0} classes
                            </span>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDeleteSchool(school.id)}
                              disabled={loading}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            </button>
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
              <form className={styles.form} onSubmit={handleCreateClass}>
                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label>School</label>
                    <select
                      value={selectedSchoolId}
                      onChange={(e) => setSelectedSchoolId(e.target.value)}
                      required
                    >
                      <option value="">Select school...</option>
                      {data.districts.map((d) =>
                        d.schools?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {d.name} - {s.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label>Days</label>
                    <div className={styles.dayCheckboxes}>
                      {DAYS.map((day) => (
                        <label key={day} className={styles.dayCheckbox}>
                          <input
                            type="checkbox"
                            checked={classDays.includes(day)}
                            onChange={() => toggleDay(day)}
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
                      value={classTime}
                      onChange={(e) => setClassTime(e.target.value)}
                      placeholder="e.g., 2:30pm"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className={styles.addBtn} disabled={loading}>
                  {loading ? "Adding..." : "Add Class"}
                </button>
              </form>

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
                            <div key={cls.id} className={styles.listItem}>
                              <span className={styles.listName}>
                                {cls.days?.join(", ")} @ {cls.time}
                              </span>
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
                                className={styles.deleteBtn}
                                onClick={() => handleDeleteClass(cls.id)}
                                disabled={loading}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
                              </button>
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
        </div>
      </div>
    </div>
  );
}
