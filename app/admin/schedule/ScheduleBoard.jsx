"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import styles from "./ScheduleBoard.module.css";
import BottomSheet from "./BottomSheet";
import ManageModal from "./ManageModal";
import AddClassModal from "./AddClassModal";
import {
  assignInstructorAction,
  unassignInstructorAction,
} from "@/lib/schedule/actions";
import { computeClassOccurrences } from "@/lib/schedule/occurrences";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Program colors for badges
const PROGRAM_COLORS = {
  wellness: "#3E8FA0",   // teal
  soccer: "#1F3F91",     // navy
};

// Get Monday of the week containing a date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}

// Format date range for week nav (e.g., "Aug 24-28")
function formatWeekRange(weekStart) {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 4); // Friday

  const startMonth = SHORT_MONTHS[start.getMonth()];
  const endMonth = SHORT_MONTHS[end.getMonth()];

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
}

// Get date for a day column in the current week
function getDateForDay(weekStart, dayIndex) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

// Check if date is today
function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

// Format date as YYYY-MM-DD for comparison
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Check if mobile viewport
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isMobile;
}

export default function ScheduleBoard({ initialData }) {
  const [data, setData] = useState(initialData);
  const isMobile = useIsMobile(640);

  // Refetch data from API
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

  const [view, setView] = useState("week");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [manageOpen, setManageOpen] = useState(false);
  const [addClassOpen, setAddClassOpen] = useState(false);

  // Month view selected day state
  const [selectedMonthDay, setSelectedMonthDay] = useState(null);

  // Click-to-assign state
  const [pickerOpen, setPickerOpen] = useState(null); // { classId, slotType, anchorRect }
  const [pickerSearch, setPickerSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!pickerOpen || isMobile) return;

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPickerOpen(null);
        setPickerSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pickerOpen, isMobile]);

  // Get all assigned instructor IDs (for filtering available instructors)
  const assignedInstructorIds = useMemo(() => {
    const ids = new Set();
    data.districts.forEach((district) => {
      district.schools?.forEach((school) => {
        school.classes?.forEach((cls) => {
          cls.assignments?.forEach((a) => {
            if (a.profile?.id) ids.add(a.profile.id);
          });
        });
      });
    });
    return ids;
  }, [data]);

  // Get available instructors (not already assigned)
  const availableInstructors = useMemo(() => {
    return data.instructors.filter((i) => !assignedInstructorIds.has(i.id));
  }, [data.instructors, assignedInstructorIds]);

  // Get district info for an instructor
  const getInstructorDistrict = useCallback((instructor) => {
    const districtIds = instructor.district_ids || [];
    if (districtIds.length === 0) return null;
    return data.districts.find((d) => districtIds.includes(d.id));
  }, [data.districts]);

  // Week navigation
  const goToPrevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
  };

  // Open picker (click on slot)
  const openPicker = (classId, slotType, event) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setPickerOpen({ classId, slotType, anchorRect: rect });
    setPickerSearch("");
  };

  // Close picker
  const closePicker = () => {
    setPickerOpen(null);
    setPickerSearch("");
  };

  // Assign instructor
  const handleAssign = async (instructor) => {
    if (!pickerOpen || loading) return;
    setLoading(true);
    try {
      await assignInstructorAction(pickerOpen.classId, instructor.id, pickerOpen.slotType);
      await refreshData();
    } catch (err) {
      console.error("Failed to assign:", err);
    } finally {
      setLoading(false);
      closePicker();
    }
  };

  // Unassign instructor (× button)
  const handleUnassign = async (e, classId, slotType) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      await unassignInstructorAction(classId, slotType);
      await refreshData();
    } catch (err) {
      console.error("Failed to unassign:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter holidays to those applicable to a specific school
  // Includes: global holidays, district holidays, and school-specific holidays
  const getHolidaysForSchool = (districtId, schoolId) => {
    return (data.holidays || []).filter(h => {
      // Global holiday (applies to all)
      if (h.district_id === null && h.school_id === null) return true;
      // District-specific holiday (applies to all schools in district)
      if (h.district_id === districtId && h.school_id === null) return true;
      // School-specific holiday
      if (h.school_id === schoolId) return true;
      return false;
    });
  };

  // Check if a class should appear on a specific date
  const isClassActiveOnDate = (cls, dateStr, districtId, schoolId) => {
    if (!cls.start_date) return true;
    if (dateStr < cls.start_date) return false;

    const classProgram = cls.program || "wellness";
    const offDaysForProgram = (data.programOffDays || []).filter(
      od => od.program === classProgram
    );

    // Only apply holidays that are global, for this district, or for this school
    const applicableHolidays = getHolidaysForSchool(districtId, schoolId);
    const isHolidayDate = applicableHolidays.some(h => h.date === dateStr);
    const isOffDay = offDaysForProgram.some(od => od.date === dateStr);
    if (isHolidayDate || isOffDay) return false;

    if (!cls.target_sessions) return true;

    const result = computeClassOccurrences({
      startDate: cls.start_date,
      days: cls.days,
      targetSessions: cls.target_sessions,
      holidays: applicableHolidays,
      programOffDays: offDaysForProgram,
    });

    return result.occurrences.some(o => o.date === dateStr);
  };

  // Get classes for a specific day and date
  const getClassesForDay = (day, date = null) => {
    const classes = [];
    const dateStr = date ? formatDateKey(date) : null;

    data.districts.forEach((district) => {
      district.schools?.forEach((school) => {
        school.classes?.forEach((cls) => {
          if (cls.days?.includes(day)) {
            if (dateStr && !isClassActiveOnDate(cls, dateStr, district.id, school.id)) {
              return;
            }
            classes.push({
              ...cls,
              school,
              district,
            });
          }
        });
      });
    });
    return classes;
  };

  // Get holidays for a specific date
  const getHolidaysForDate = (date) => {
    const dateKey = formatDateKey(date);
    return (data.holidays || []).filter((h) => h.date === dateKey);
  };

  // Calendar utilities
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const getDayName = (dayIndex) => {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return names[dayIndex];
  };

  const getClassesForDate = (year, month, day) => {
    const date = new Date(year, month, day);
    const dayName = getDayName(date.getDay());
    if (!DAYS.includes(dayName)) return [];
    return getClassesForDay(dayName, date);
  };

  // Filter instructors by search
  const filteredInstructors = useMemo(() => {
    const search = pickerSearch.toLowerCase().trim();
    if (!search) return availableInstructors;
    return availableInstructors.filter((i) =>
      i.full_name.toLowerCase().includes(search)
    );
  }, [availableInstructors, pickerSearch]);

  // Render slot (instructor chip or empty slot)
  const renderSlot = (cls, slotType, label) => {
    const assignment = cls.assignments?.find((a) => a.slotType === slotType);
    const isThisSlotOpen = pickerOpen?.classId === cls.id && pickerOpen?.slotType === slotType;

    if (assignment?.profile) {
      const color = assignment.profile.color || cls.district?.color || "#3E8FA0";
      return (
        <div className={styles.slotWrapper}>
          <div
            className={`${styles.filledSlot} ${isThisSlotOpen ? styles.slotActive : ""}`}
            style={{ "--slot-color": color }}
            onClick={(e) => openPicker(cls.id, slotType, e)}
          >
            <span className={styles.slotName}>{assignment.profile.full_name}</span>
            <button
              className={styles.unassignBtn}
              onClick={(e) => handleUnassign(e, cls.id, slotType)}
              disabled={loading}
              aria-label="Unassign"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      );
    }

    // Empty slot
    return (
      <div className={styles.slotWrapper}>
        <div
          className={`${styles.emptySlot} ${isThisSlotOpen ? styles.slotActive : ""}`}
          onClick={(e) => openPicker(cls.id, slotType, e)}
        >
          <span className={styles.slotLabel}>{label}</span>
          <span className={styles.assignHint}>Click to assign</span>
        </div>
      </div>
    );
  };

  // Render grid class card (for Week view columns)
  const renderGridClassCard = (cls) => {
    const program = cls.program || "wellness";
    const programColor = PROGRAM_COLORS[program] || PROGRAM_COLORS.wellness;

    return (
      <div
        key={cls.id}
        className={`${styles.gridCard} ${cls.is_review_day ? styles.reviewDay : ""}`}
        style={{ "--card-accent": cls.is_review_day ? "var(--gold)" : programColor }}
      >
        <div className={styles.gridCardHeader}>
          <span
            className={styles.programBadge}
            style={{ background: programColor }}
          >
            {program}
          </span>
          <span className={styles.gridCardTime}>{cls.time}</span>
        </div>
        <div className={styles.gridCardSchool}>{cls.school?.name}</div>
        <div className={styles.gridCardDistrict}>
          <span className={styles.districtDot} style={{ background: cls.district?.color }} />
          <span>{cls.district?.name}</span>
        </div>
        {cls.is_review_day && (
          <span className={styles.reviewPill}>Review Day</span>
        )}
        <div className={styles.gridCardSlots}>
          {renderSlot(cls, "instructor_1", "Instructor 1")}
          {renderSlot(cls, "instructor_2", "Instructor 2")}
          {cls.is_review_day && renderSlot(cls, "admin_review", "Admin Review")}
        </div>
      </div>
    );
  };

  // Check if a date is in the past
  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  };

  // Render Week View - horizontal 5-column grid (no sidebar)
  const renderWeekView = () => {
    return (
      <div className={styles.weekView}>
        {/* Week navigation */}
        <div className={styles.weekNav}>
          <button className={styles.weekNavBtn} onClick={goToPrevWeek}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className={styles.weekNavLabel}>{formatWeekRange(weekStart)}</span>
          <button className={styles.weekNavBtn} onClick={goToNextWeek}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* 5-column grid */}
        <div className={styles.weekGrid}>
          {DAYS.map((day, index) => {
            const date = getDateForDay(weekStart, index);
            const dayClasses = getClassesForDay(day, date);
            const isTodayCol = isToday(date);
            const isPast = isPastDate(date);
            const dayHolidays = getHolidaysForDate(date);

            return (
              <div key={day} className={`${styles.weekColumn} ${dayHolidays.length > 0 ? styles.hasHoliday : ""} ${isPast ? styles.pastDay : ""}`}>
                <div className={`${styles.weekColumnHeader} ${isTodayCol ? styles.today : ""}`}>
                  <span className={styles.weekColumnDay}>{day}</span>
                  <span className={styles.weekColumnDate}>
                    {SHORT_MONTHS[date.getMonth()]} {date.getDate()}
                  </span>
                </div>
                <div className={styles.weekColumnContent}>
                  {/* Show holidays */}
                  {dayHolidays.length > 0 && (
                    <div className={styles.holidayBanner}>
                      {dayHolidays.map((h) => {
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
                          <div key={h.id} className={styles.holidayTag}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <span className={styles.holidayTagName}>{h.name}</span>
                            {school ? (
                              <span className={styles.holidayTagDistrict}>
                                <span className={styles.districtDot} style={{ background: district?.color || "#888" }} />
                                {school.name}
                              </span>
                            ) : district ? (
                              <span className={styles.holidayTagDistrict}>
                                <span className={styles.districtDot} style={{ background: district.color }} />
                                {district.name}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {dayClasses.length === 0 && dayHolidays.length === 0 ? (
                    <div className={styles.emptyPlaceholder}>
                      <p>Nothing scheduled</p>
                    </div>
                  ) : (
                    dayClasses.map((cls) => renderGridClassCard(cls))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Month View
  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);
    const weeks = [];
    let currentWeek = [];

    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    // Get today for highlighting
    const today = new Date();
    const isTodayInMonth = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear;
    const todayDate = today.getDate();

    // Get selected day's classes and holidays for detail panel
    const selectedClasses = selectedMonthDay
      ? getClassesForDate(selectedYear, selectedMonth, selectedMonthDay)
      : [];
    const selectedDayHolidays = selectedMonthDay
      ? getHolidaysForDate(new Date(selectedYear, selectedMonth, selectedMonthDay))
      : [];

    // Use the shared program colors constant
    const programColors = PROGRAM_COLORS;

    return (
      <div className={styles.monthView}>
        <div className={styles.monthNav}>
          <button
            className={styles.monthNavBtn}
            onClick={() => {
              if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
              setSelectedMonthDay(null);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h2 className={styles.monthTitle}>
            {MONTHS[selectedMonth]} {selectedYear}
          </h2>
          <button
            className={styles.monthNavBtn}
            onClick={() => {
              if (selectedMonth === 11) {
                setSelectedMonth(0);
                setSelectedYear(selectedYear + 1);
              } else {
                setSelectedMonth(selectedMonth + 1);
              }
              setSelectedMonthDay(null);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className={styles.monthContent}>
          {/* Calendar Grid */}
          <div className={styles.monthCalendarSide}>
            <div className={styles.calendarGrid}>
              <div className={styles.calendarHeader}>
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className={styles.calendarHeaderCell}>
                    {d}
                  </div>
                ))}
              </div>

              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className={styles.calendarWeek}>
                  {week.map((day, dayIndex) => {
                    if (!day) {
                      return <div key={dayIndex} className={styles.calendarCellEmpty} />;
                    }

                    const cellDate = new Date(selectedYear, selectedMonth, day);
                    const classes = getClassesForDate(selectedYear, selectedMonth, day);
                    const dayHolidays = getHolidaysForDate(cellDate);
                    const isSelected = selectedMonthDay === day;
                    const isTodayCell = isTodayInMonth && todayDate === day;

                    // Get unique programs for this day
                    const uniquePrograms = new Set();
                    classes.forEach((cls) => {
                      uniquePrograms.add(cls.program || "wellness");
                    });

                    // Determine day state (priority: holiday > multiple > single > empty)
                    let dayState = "empty";
                    if (dayHolidays.length > 0) {
                      dayState = "holiday";
                    } else if (uniquePrograms.size >= 2) {
                      dayState = "multiple";
                    } else if (uniquePrograms.size === 1) {
                      dayState = uniquePrograms.has("soccer") ? "soccer" : "wellness";
                    }

                    // Get program colors for dots
                    const programDots = [];
                    const seenPrograms = new Set();
                    classes.forEach((cls) => {
                      const prog = cls.program || "wellness";
                      if (!seenPrograms.has(prog)) {
                        seenPrograms.add(prog);
                        programDots.push(programColors[prog] || programColors.wellness);
                      }
                    });

                    return (
                      <div
                        key={dayIndex}
                        className={`${styles.calendarCell} ${styles[`dayState_${dayState}`]} ${isSelected ? styles.selected : ""} ${isTodayCell ? styles.today : ""}`}
                        onClick={() => setSelectedMonthDay(day)}
                      >
                        <span className={`${styles.dayNumber} ${dayState !== "empty" ? styles.dayNumberActive : ""}`}>{day}</span>
                        {(programDots.length > 0 || dayHolidays.length > 0) && (
                          <div className={styles.cellIndicators}>
                            {programDots.map((color, i) => (
                              <span
                                key={`prog-${i}`}
                                className={styles.programDot}
                                style={{ background: color }}
                              />
                            ))}
                            {dayHolidays.length > 0 && (
                              <span className={styles.holidayMarker} />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className={styles.monthLegend}>
              <div className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "rgba(62,143,160,0.5)" }} />
                <span>Wellness day</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "rgba(31,63,145,0.5)" }} />
                <span>Soccer day</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "rgba(180,91,199,0.5)" }} />
                <span>Multiple programs</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "rgba(216,174,75,0.5)" }} />
                <span>Holiday</span>
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          <div className={styles.monthDetailPanel}>
            {selectedMonthDay ? (
              <>
                <div className={styles.detailPanelHeader}>
                  <h3>
                    {MONTHS[selectedMonth]} {selectedMonthDay}, {selectedYear}
                  </h3>
                </div>
                <div className={styles.detailPanelContent}>
                  {/* Holidays */}
                  {selectedDayHolidays.length > 0 && (
                    <div className={styles.detailHolidays}>
                      {selectedDayHolidays.map((h) => {
                        const district = h.district_id
                          ? data.districts.find((d) => d.id === h.district_id)
                          : null;
                        return (
                          <div key={h.id} className={styles.detailHolidayItem}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <span className={styles.detailHolidayName}>{h.name}</span>
                            {district && (
                              <span className={styles.detailHolidayDistrict}>
                                <span className={styles.districtDot} style={{ background: district.color }} />
                                {district.name}
                              </span>
                            )}
                            {!district && (
                              <span className={styles.detailHolidayGlobal}>All districts</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Classes */}
                  {selectedClasses.length > 0 ? (
                    <div className={styles.detailClasses}>
                      {selectedClasses.map((cls) => (
                        <div key={cls.id} className={styles.detailClassCard}>
                          <div className={styles.detailClassHeader}>
                            <span
                              className={styles.detailProgramBadge}
                              style={{ background: programColors[cls.program] || "var(--teal)" }}
                            >
                              {cls.program || "wellness"}
                            </span>
                            <span className={styles.detailClassTime}>{cls.time}</span>
                          </div>
                          <div className={styles.detailClassSchool}>{cls.school?.name}</div>
                          <div className={styles.detailClassDistrict}>
                            <span className={styles.districtDot} style={{ background: cls.district?.color }} />
                            <span>{cls.district?.name}</span>
                          </div>
                          {cls.assignments && cls.assignments.length > 0 && (
                            <div className={styles.detailClassInstructors}>
                              {cls.assignments.map((a) => (
                                <span key={a.id} className={styles.detailInstructorChip}>
                                  {a.profile?.full_name}
                                </span>
                              ))}
                            </div>
                          )}
                          {(!cls.assignments || cls.assignments.length === 0) && (
                            <div className={styles.detailNoInstructors}>No instructors assigned</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : selectedDayHolidays.length === 0 ? (
                    <div className={styles.detailEmpty}>
                      <p>No classes scheduled</p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className={styles.detailPanelEmpty}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p>Select a day to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render instructor picker popover (desktop) or use bottom sheet (mobile)
  const renderPickerPopover = () => {
    if (!pickerOpen) return null;

    // On mobile, we use BottomSheet instead
    if (isMobile) return null;

    const { anchorRect } = pickerOpen;
    const popoverStyle = {
      position: "fixed",
      top: anchorRect.bottom + 8,
      left: anchorRect.left,
      minWidth: Math.max(280, anchorRect.width),
    };

    // Adjust if popover would go off-screen
    if (anchorRect.left + 280 > window.innerWidth) {
      popoverStyle.left = window.innerWidth - 290;
    }
    if (anchorRect.bottom + 300 > window.innerHeight) {
      popoverStyle.top = anchorRect.top - 308;
    }

    return (
      <div className={styles.pickerPopover} style={popoverStyle} ref={popoverRef}>
        <div className={styles.pickerSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search instructors..."
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.pickerList}>
          {filteredInstructors.length === 0 ? (
            <div className={styles.pickerEmpty}>No available instructors</div>
          ) : (
            filteredInstructors.map((instructor) => {
              const district = getInstructorDistrict(instructor);
              return (
                <button
                  key={instructor.id}
                  className={styles.pickerRow}
                  onClick={() => handleAssign(instructor)}
                  disabled={loading}
                >
                  <div
                    className={styles.pickerAvatar}
                    style={{ background: instructor.color || "#3E8FA0" }}
                  >
                    {instructor.full_name?.charAt(0) || "?"}
                  </div>
                  <span className={styles.pickerName}>{instructor.full_name}</span>
                  {district && (
                    <span className={styles.pickerDistrict}>{district.name}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Schedule Board</h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.viewToggle}>
            {["week", "month"].map((v) => (
              <button
                key={v}
                className={`${styles.viewBtn} ${view === v ? styles.active : ""}`}
                onClick={() => setView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button className={styles.addClassBtn} onClick={() => setAddClassOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Class
          </button>
          <button className={styles.manageBtn} onClick={() => setManageOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            Manage
          </button>
        </div>
      </div>

      {/* Main content based on view */}
      {view === "week" && renderWeekView()}
      {view === "month" && renderMonthView()}

      {/* Desktop popover for click-to-assign */}
      {renderPickerPopover()}

      {/* Mobile bottom sheet for click-to-assign */}
      <BottomSheet
        open={isMobile && pickerOpen !== null}
        onClose={closePicker}
        title="Select Instructor"
      >
        <div className={styles.mobilePickerContent}>
          <div className={styles.mobilePickerSearch}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search instructors..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
            />
          </div>
          <div className={styles.mobilePickerList}>
            {filteredInstructors.length === 0 ? (
              <div className={styles.pickerEmpty}>No available instructors</div>
            ) : (
              filteredInstructors.map((instructor) => {
                const district = getInstructorDistrict(instructor);
                return (
                  <button
                    key={instructor.id}
                    className={styles.mobilePickerRow}
                    onClick={() => handleAssign(instructor)}
                    disabled={loading}
                  >
                    <div
                      className={styles.pickerAvatar}
                      style={{ background: instructor.color || "#3E8FA0" }}
                    >
                      {instructor.full_name?.charAt(0) || "?"}
                    </div>
                    <div className={styles.mobilePickerInfo}>
                      <span className={styles.mobilePickerName}>{instructor.full_name}</span>
                      {district && (
                        <span className={styles.mobilePickerDistrict}>{district.name}</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Manage modal */}
      <ManageModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        data={data}
        onDataChange={refreshData}
      />

      {/* Add Class modal */}
      <AddClassModal
        open={addClassOpen}
        onClose={() => setAddClassOpen(false)}
        data={data}
        onDataChange={refreshData}
      />
    </div>
  );
}
