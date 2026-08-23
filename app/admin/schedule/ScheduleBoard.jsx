"use client";

import { useState, useCallback, useMemo } from "react";
import styles from "./ScheduleBoard.module.css";
import BottomSheet from "./BottomSheet";
import ManageModal from "./ManageModal";
import {
  assignInstructorAction,
  unassignInstructorAction,
} from "@/lib/schedule/actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

export default function ScheduleBoard({ initialData }) {
  const [data, setData] = useState(initialData);

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
  const [activeDay, setActiveDay] = useState("Mon");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [manageOpen, setManageOpen] = useState(false);

  // Instructor pool state
  const [poolSearch, setPoolSearch] = useState("");
  const [expandedDistricts, setExpandedDistricts] = useState(new Set());

  // Mobile state
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
  const [mobilePickerSlot, setMobilePickerSlot] = useState(null);
  const [mobileDayDetailOpen, setMobileDayDetailOpen] = useState(false);
  const [mobileDayDetail, setMobileDayDetail] = useState(null);

  // Drag state
  const [draggedInstructor, setDraggedInstructor] = useState(null);
  const [loading, setLoading] = useState(false);

  // Get all assigned instructor IDs
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

  // Group instructors by district (instructors can belong to multiple districts)
  const instructorsByDistrict = useMemo(() => {
    const grouped = {};
    data.instructors.forEach((instructor) => {
      const districtIds = instructor.district_ids || [];
      if (districtIds.length === 0) {
        if (!grouped["unassigned"]) grouped["unassigned"] = [];
        grouped["unassigned"].push(instructor);
      } else {
        districtIds.forEach((districtId) => {
          if (!grouped[districtId]) grouped[districtId] = [];
          grouped[districtId].push(instructor);
        });
      }
    });
    return grouped;
  }, [data.instructors]);

  // Toggle district expansion
  const toggleDistrictExpanded = (districtId) => {
    setExpandedDistricts((prev) => {
      const next = new Set(prev);
      if (next.has(districtId)) {
        next.delete(districtId);
      } else {
        next.add(districtId);
      }
      return next;
    });
  };

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

  // Drag handlers
  const handleDragStart = (e, instructor) => {
    setDraggedInstructor(instructor);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, classId, slotType) => {
    e.preventDefault();
    if (!draggedInstructor || loading) return;

    setLoading(true);
    try {
      await assignInstructorAction(classId, draggedInstructor.id, slotType);
      await refreshData();
    } catch (err) {
      console.error("Failed to assign:", err);
    } finally {
      setLoading(false);
      setDraggedInstructor(null);
    }
  };

  const handleUnassign = async (classId, slotType) => {
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

  // Mobile tap-to-assign
  const openMobilePicker = (classId, slotType) => {
    setMobilePickerSlot({ classId, slotType });
    setMobilePickerOpen(true);
  };

  const handleMobileAssign = async (instructor) => {
    if (!mobilePickerSlot || loading) return;
    setLoading(true);
    try {
      await assignInstructorAction(
        mobilePickerSlot.classId,
        instructor.id,
        mobilePickerSlot.slotType
      );
      await refreshData();
    } catch (err) {
      console.error("Failed to assign:", err);
    } finally {
      setLoading(false);
      setMobilePickerOpen(false);
      setMobilePickerSlot(null);
    }
  };

  // Get classes for a specific day
  const getClassesForDay = (day) => {
    const classes = [];
    data.districts.forEach((district) => {
      district.schools?.forEach((school) => {
        school.classes?.forEach((cls) => {
          if (cls.days?.includes(day)) {
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

  // Check if a date is a holiday (optionally for a specific district)
  const isHoliday = (date, districtId = null) => {
    const holidays = getHolidaysForDate(date);
    if (districtId) {
      // Check for global holidays or district-specific
      return holidays.some((h) => h.district_id === null || h.district_id === districtId);
    }
    return holidays.length > 0;
  };

  // Calendar utilities for Month/Year views
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
    return getClassesForDay(dayName);
  };

  // Render slot (instructor chip or drop zone)
  const renderSlot = (cls, slotType, label) => {
    const assignment = cls.assignments?.find((a) => a.slotType === slotType);

    if (assignment?.profile) {
      const color = assignment.profile.color || cls.district?.color || "#3E8FA0";
      return (
        <div className={styles.filledSlot} style={{ "--slot-color": color }}>
          <span className={styles.slotName}>{assignment.profile.full_name}</span>
          <button
            className={styles.unassignBtn}
            onClick={() => handleUnassign(cls.id, slotType)}
            disabled={loading}
            aria-label="Unassign"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      );
    }

    // Empty slot
    return (
      <div
        className={styles.emptySlot}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, cls.id, slotType)}
        onClick={() => openMobilePicker(cls.id, slotType)}
      >
        <span className={styles.slotLabel}>{label}</span>
        <span className={styles.dropHint}>
          <span className={styles.desktopHint}>Drop here</span>
          <span className={styles.mobileHint}>Tap to assign</span>
        </span>
      </div>
    );
  };

  // Render grid class card (for Week view columns)
  const renderGridClassCard = (cls) => {
    return (
      <div
        key={cls.id}
        className={`${styles.gridCard} ${cls.is_review_day ? styles.reviewDay : ""}`}
        style={{ "--card-accent": cls.is_review_day ? "var(--gold)" : "var(--teal)" }}
      >
        <div className={styles.gridCardTime}>{cls.time}</div>
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

  // Render instructor chip (draggable)
  const renderInstructorChip = (instructor, isAssigned) => {
    const color = instructor.color || "#3E8FA0";
    return (
      <div
        key={instructor.id}
        className={`${styles.instructorChip} ${isAssigned ? styles.assigned : ""}`}
        style={{ "--chip-color": color }}
        draggable={!isAssigned}
        onDragStart={(e) => handleDragStart(e, instructor)}
        onClick={() => {
          if (mobilePickerOpen && !isAssigned) {
            handleMobileAssign(instructor);
          }
        }}
      >
        <span className={styles.chipName}>{instructor.full_name}</span>
        {isAssigned && <span className={styles.chipAssigned}>Assigned</span>}
      </div>
    );
  };

  // Render instructor pool (shared between Day and Week views)
  const renderInstructorPool = () => {
    const searchLower = poolSearch.toLowerCase().trim();
    const isSearching = searchLower.length > 0;

    // Filter and prepare district groups
    const districtGroups = [];

    data.districts.forEach((district) => {
      const districtInstructors = instructorsByDistrict[district.id] || [];
      if (districtInstructors.length === 0) return;

      const filtered = isSearching
        ? districtInstructors.filter((i) =>
            i.full_name.toLowerCase().includes(searchLower)
          )
        : districtInstructors;

      if (isSearching && filtered.length === 0) return;

      const availableCount = districtInstructors.filter(
        (i) => !assignedInstructorIds.has(i.id)
      ).length;

      const isExpanded = isSearching || expandedDistricts.has(district.id);

      districtGroups.push({
        id: district.id,
        name: district.name,
        color: district.color,
        instructors: filtered,
        availableCount,
        isExpanded,
      });
    });

    // Handle "No District" group
    const unassignedInstructors = instructorsByDistrict["unassigned"] || [];
    if (unassignedInstructors.length > 0) {
      const filtered = isSearching
        ? unassignedInstructors.filter((i) =>
            i.full_name.toLowerCase().includes(searchLower)
          )
        : unassignedInstructors;

      if (!isSearching || filtered.length > 0) {
        const availableCount = unassignedInstructors.filter(
          (i) => !assignedInstructorIds.has(i.id)
        ).length;

        districtGroups.push({
          id: "unassigned",
          name: "No District",
          color: "#999",
          instructors: filtered,
          availableCount,
          isExpanded: isSearching || expandedDistricts.has("unassigned"),
        });
      }
    }

    const hasAnyResults = districtGroups.length > 0;

    return (
      <aside className={styles.instructorPool}>
        <h3 className={styles.poolTitle}>Instructors</h3>
        <div className={styles.poolSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search instructors..."
            value={poolSearch}
            onChange={(e) => setPoolSearch(e.target.value)}
          />
        </div>
        <div className={styles.poolContent}>
          {!hasAnyResults && isSearching ? (
            <p className={styles.poolNoMatch}>No instructors match</p>
          ) : (
            districtGroups.map((group) => (
              <div key={group.id} className={styles.poolGroup}>
                <button
                  className={styles.poolGroupHeader}
                  onClick={() => !isSearching && toggleDistrictExpanded(group.id)}
                >
                  <span className={styles.districtDot} style={{ background: group.color }} />
                  <span className={styles.poolGroupName}>{group.name}</span>
                  <span className={styles.poolGroupCount}>{group.availableCount} available</span>
                  <svg
                    className={`${styles.poolChevron} ${group.isExpanded ? styles.expanded : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {group.isExpanded && (
                  <div className={styles.poolGroupContent}>
                    {group.instructors.map((instructor) =>
                      renderInstructorChip(
                        instructor,
                        assignedInstructorIds.has(instructor.id)
                      )
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    );
  };

  // Render Day View
  const renderDayView = () => {
    const dayClasses = getClassesForDay(activeDay);
    const dayIndex = DAYS.indexOf(activeDay);
    const currentDate = getDateForDay(weekStart, dayIndex);
    const dayHolidays = getHolidaysForDate(currentDate);

    return (
      <div className={styles.dayView}>
        {/* Week nav for day view */}
        <div className={styles.dayNav}>
          <button className={styles.weekNavBtn} onClick={goToPrevWeek}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className={styles.dayNavDate}>
            {SHORT_MONTHS[currentDate.getMonth()]} {currentDate.getDate()}, {currentDate.getFullYear()}
          </span>
          <button className={styles.weekNavBtn} onClick={goToNextWeek}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className={styles.dayTabs}>
          {DAYS.map((day, idx) => {
            const tabDate = getDateForDay(weekStart, idx);
            const tabHolidays = getHolidaysForDate(tabDate);
            return (
              <button
                key={day}
                className={`${styles.dayTab} ${activeDay === day ? styles.active : ""} ${tabHolidays.length > 0 ? styles.hasHoliday : ""}`}
                onClick={() => setActiveDay(day)}
              >
                {day}
                {tabHolidays.length > 0 && <span className={styles.holidayDot} />}
              </button>
            );
          })}
        </div>

        <div className={styles.dayContent}>
          {renderInstructorPool()}

          <main className={styles.dayMain}>
            {/* Show holidays */}
            {dayHolidays.length > 0 && (
              <div className={styles.holidayBanner}>
                {dayHolidays.map((h) => {
                  const district = h.district_id
                    ? data.districts.find((d) => d.id === h.district_id)
                    : null;
                  return (
                    <div key={h.id} className={styles.holidayTag}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span className={styles.holidayTagName}>{h.name}</span>
                      {district && (
                        <span className={styles.holidayTagDistrict}>
                          <span className={styles.districtDot} style={{ background: district.color }} />
                          {district.name}
                        </span>
                      )}
                      {!district && (
                        <span className={styles.holidayTagGlobal}>All districts</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {dayClasses.length === 0 ? (
              <div className={styles.emptyPlaceholder}>
                <p>Nothing scheduled</p>
              </div>
            ) : (
              <div className={styles.dayClassesList}>
                {dayClasses.map((cls) => renderGridClassCard(cls))}
              </div>
            )}
          </main>
        </div>
      </div>
    );
  };

  // Render Week View - horizontal 5-column grid
  const renderWeekView = () => {
    return (
      <div className={styles.weekView}>
        {renderInstructorPool()}

        <main className={styles.weekMain}>
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
              const dayClasses = getClassesForDay(day);
              const isTodayCol = isToday(date);
              const dayHolidays = getHolidaysForDate(date);

              return (
                <div key={day} className={`${styles.weekColumn} ${dayHolidays.length > 0 ? styles.hasHoliday : ""}`}>
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
                          const district = h.district_id
                            ? data.districts.find((d) => d.id === h.district_id)
                            : null;
                          return (
                            <div key={h.id} className={styles.holidayTag}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                              <span className={styles.holidayTagName}>{h.name}</span>
                              {district && (
                                <span className={styles.holidayTagDistrict}>
                                  <span className={styles.districtDot} style={{ background: district.color }} />
                                  {district.name}
                                </span>
                              )}
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
        </main>
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
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className={styles.calendarGrid}>
          <div className={styles.calendarHeader}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className={styles.calendarHeaderCell}>
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

                const classes = getClassesForDate(selectedYear, selectedMonth, day);
                const districtColors = [
                  ...new Set(classes.map((c) => c.district?.color).filter(Boolean)),
                ];
                const hasReviewDay = classes.some((c) => c.is_review_day);

                return (
                  <div
                    key={dayIndex}
                    className={`${styles.calendarCell} ${classes.length > 0 ? styles.hasClasses : ""}`}
                    onClick={() => {
                      if (classes.length > 0) {
                        setMobileDayDetail({ year: selectedYear, month: selectedMonth, day, classes });
                        setMobileDayDetailOpen(true);
                      }
                    }}
                  >
                    <span className={`${styles.dayNumber} ${hasReviewDay ? styles.reviewRing : ""}`}>
                      {day}
                    </span>
                    {districtColors.length > 0 && (
                      <div className={styles.districtDots}>
                        {districtColors.slice(0, 3).map((color, i) => (
                          <span
                            key={i}
                            className={styles.calendarDot}
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render Year View
  const renderYearView = () => {
    return (
      <div className={styles.yearView}>
        <div className={styles.yearNav}>
          <button
            className={styles.monthNavBtn}
            onClick={() => setSelectedYear(selectedYear - 1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h2 className={styles.yearTitle}>{selectedYear}</h2>
          <button
            className={styles.monthNavBtn}
            onClick={() => setSelectedYear(selectedYear + 1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className={styles.miniMonthsGrid}>
          {MONTHS.map((monthName, monthIndex) => {
            const daysInMonth = getDaysInMonth(selectedYear, monthIndex);
            const firstDay = getFirstDayOfMonth(selectedYear, monthIndex);

            return (
              <div
                key={monthIndex}
                className={styles.miniMonth}
                onClick={() => {
                  setSelectedMonth(monthIndex);
                  setView("month");
                }}
              >
                <h4 className={styles.miniMonthTitle}>{monthName}</h4>
                <div className={styles.miniMonthGrid}>
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className={styles.miniDayEmpty} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const classes = getClassesForDate(selectedYear, monthIndex, day);
                    const hasClasses = classes.length > 0;
                    const hasReviewDay = classes.some((c) => c.is_review_day);
                    const color = classes[0]?.district?.color;

                    return (
                      <div
                        key={day}
                        className={`${styles.miniDay} ${hasClasses ? styles.hasClasses : ""} ${hasReviewDay ? styles.reviewDay : ""}`}
                        style={hasClasses && color ? { "--dot-color": color } : {}}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
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
            {["day", "week", "month", "year"].map((v) => (
              <button
                key={v}
                className={`${styles.viewBtn} ${view === v ? styles.active : ""}`}
                onClick={() => setView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
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
      {view === "day" && renderDayView()}
      {view === "week" && renderWeekView()}
      {view === "month" && renderMonthView()}
      {view === "year" && renderYearView()}

      {/* Mobile instructor picker bottom sheet */}
      <BottomSheet
        open={mobilePickerOpen}
        onClose={() => {
          setMobilePickerOpen(false);
          setMobilePickerSlot(null);
        }}
        title="Select Instructor"
      >
        <div className={styles.pickerContent}>
          {data.districts.map((district) => {
            const districtInstructors = instructorsByDistrict[district.id] || [];
            const available = districtInstructors.filter(
              (i) => !assignedInstructorIds.has(i.id)
            );
            if (available.length === 0) return null;

            return (
              <div key={district.id} className={styles.pickerGroup}>
                <div className={styles.pickerGroupHeader}>
                  <span
                    className={styles.districtDot}
                    style={{ background: district.color }}
                  />
                  <span>{district.name}</span>
                </div>
                <div className={styles.pickerGroupContent}>
                  {available.map((instructor) => (
                    <button
                      key={instructor.id}
                      className={styles.pickerItem}
                      onClick={() => handleMobileAssign(instructor)}
                      disabled={loading}
                    >
                      {instructor.full_name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {instructorsByDistrict["unassigned"]?.filter(
            (i) => !assignedInstructorIds.has(i.id)
          ).length > 0 && (
            <div className={styles.pickerGroup}>
              <div className={styles.pickerGroupHeader}>
                <span className={styles.districtDot} style={{ background: "#999" }} />
                <span>No District</span>
              </div>
              <div className={styles.pickerGroupContent}>
                {instructorsByDistrict["unassigned"]
                  .filter((i) => !assignedInstructorIds.has(i.id))
                  .map((instructor) => (
                    <button
                      key={instructor.id}
                      className={styles.pickerItem}
                      onClick={() => handleMobileAssign(instructor)}
                      disabled={loading}
                    >
                      {instructor.full_name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Mobile day detail bottom sheet */}
      <BottomSheet
        open={mobileDayDetailOpen}
        onClose={() => {
          setMobileDayDetailOpen(false);
          setMobileDayDetail(null);
        }}
        title={
          mobileDayDetail
            ? `${MONTHS[mobileDayDetail.month]} ${mobileDayDetail.day}, ${mobileDayDetail.year}`
            : ""
        }
      >
        <div className={styles.dayDetailContent}>
          {mobileDayDetail?.classes.map((cls) => (
            <div key={cls.id} className={styles.dayDetailClass}>
              <div className={styles.dayDetailHeader}>
                <span
                  className={styles.districtDot}
                  style={{ background: cls.district?.color }}
                />
                <span className={styles.dayDetailTime}>{cls.time}</span>
                <span className={styles.dayDetailSchool}>{cls.school?.name}</span>
              </div>
              <div className={styles.dayDetailAssignments}>
                {cls.assignments?.map((a) => (
                  <span key={a.id} className={styles.dayDetailInstructor}>
                    {a.profile?.full_name}
                  </span>
                ))}
                {(!cls.assignments || cls.assignments.length === 0) && (
                  <span className={styles.dayDetailEmpty}>No instructors assigned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* Manage modal */}
      <ManageModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        data={data}
        onDataChange={refreshData}
      />
    </div>
  );
}
