"use client";

import { useState, useCallback } from "react";
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
  const [view, setView] = useState("week"); // week | month | year
  const [activeDay, setActiveDay] = useState("Mon");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [manageOpen, setManageOpen] = useState(false);
  const [hiddenDistricts, setHiddenDistricts] = useState(new Set());

  // Mobile state
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
  const [mobilePickerSlot, setMobilePickerSlot] = useState(null);
  const [mobileDayDetailOpen, setMobileDayDetailOpen] = useState(false);
  const [mobileDayDetail, setMobileDayDetail] = useState(null);

  // Drag state
  const [draggedInstructor, setDraggedInstructor] = useState(null);
  const [loading, setLoading] = useState(false);

  // Get all assigned instructor IDs
  const assignedInstructorIds = new Set();
  data.districts.forEach((district) => {
    district.schools?.forEach((school) => {
      school.classes?.forEach((cls) => {
        cls.assignments?.forEach((a) => {
          if (a.profile?.id) assignedInstructorIds.add(a.profile.id);
        });
      });
    });
  });

  // Group instructors by district
  const instructorsByDistrict = {};
  data.instructors.forEach((instructor) => {
    const districtId = instructor.district_id || "unassigned";
    if (!instructorsByDistrict[districtId]) {
      instructorsByDistrict[districtId] = [];
    }
    instructorsByDistrict[districtId].push(instructor);
  });

  // Toggle district visibility in sidebar
  const toggleDistrictVisibility = (districtId) => {
    setHiddenDistricts((prev) => {
      const next = new Set(prev);
      if (next.has(districtId)) {
        next.delete(districtId);
      } else {
        next.add(districtId);
      }
      return next;
    });
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

  // Calendar utilities for Month/Year views
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const getDayName = (dayIndex) => {
    // 0 = Sunday, 1 = Monday, etc.
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
    const isMobile = typeof window !== "undefined" && window.innerWidth < 760;

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

  // Render class card
  const renderClassCard = (cls) => {
    return (
      <div
        key={cls.id}
        className={`${styles.classCard} ${cls.is_review_day ? styles.reviewDay : ""}`}
        style={{ "--district-color": cls.district?.color || "#3E8FA0" }}
      >
        <div className={styles.classHeader}>
          <span className={styles.classTime}>{cls.time}</span>
          <span className={styles.schoolName}>{cls.school?.name}</span>
        </div>
        <div className={styles.slots}>
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

  // Render Week View
  const renderWeekView = () => {
    const dayClasses = getClassesForDay(activeDay);

    return (
      <div className={styles.weekView}>
        {/* Sidebar - instructor pool */}
        <aside className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>Instructors</h3>
          {data.districts.map((district) => {
            const districtInstructors = instructorsByDistrict[district.id] || [];
            if (districtInstructors.length === 0) return null;
            const isHidden = hiddenDistricts.has(district.id);

            return (
              <div key={district.id} className={styles.sidebarGroup}>
                <div className={styles.sidebarGroupHeader}>
                  <span
                    className={styles.districtDot}
                    style={{ background: district.color }}
                  />
                  <span className={styles.districtName}>{district.name}</span>
                  <button
                    className={styles.visibilityToggle}
                    onClick={() => toggleDistrictVisibility(district.id)}
                    aria-label={isHidden ? "Show" : "Hide"}
                  >
                    {isHidden ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {!isHidden && (
                  <div className={styles.sidebarGroupContent}>
                    {districtInstructors.map((instructor) =>
                      renderInstructorChip(
                        instructor,
                        assignedInstructorIds.has(instructor.id)
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Unassigned district instructors */}
          {instructorsByDistrict["unassigned"]?.length > 0 && (
            <div className={styles.sidebarGroup}>
              <div className={styles.sidebarGroupHeader}>
                <span className={styles.districtDot} style={{ background: "#999" }} />
                <span className={styles.districtName}>No District</span>
              </div>
              <div className={styles.sidebarGroupContent}>
                {instructorsByDistrict["unassigned"].map((instructor) =>
                  renderInstructorChip(
                    instructor,
                    assignedInstructorIds.has(instructor.id)
                  )
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className={styles.weekMain}>
          {/* Day tabs */}
          <div className={styles.dayTabs}>
            {DAYS.map((day) => (
              <button
                key={day}
                className={`${styles.dayTab} ${activeDay === day ? styles.active : ""}`}
                onClick={() => setActiveDay(day)}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Classes grid */}
          <div className={styles.classesGrid}>
            {data.districts.map((district) => {
              const districtClasses = dayClasses.filter(
                (c) => c.district?.id === district.id
              );
              if (districtClasses.length === 0) return null;

              return (
                <div
                  key={district.id}
                  className={styles.districtCard}
                  style={{ "--district-color": district.color }}
                >
                  <h3 className={styles.districtCardTitle}>{district.name}</h3>
                  <div className={styles.districtClasses}>
                    {districtClasses.map(renderClassCard)}
                  </div>
                </div>
              );
            })}
            {dayClasses.length === 0 && (
              <div className={styles.emptyState}>
                <p>No classes scheduled for {activeDay}</p>
              </div>
            )}
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

    // Fill in empty cells for days before the first of the month
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

    // Fill in remaining days of last week
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return (
      <div className={styles.monthView}>
        {/* Month navigation */}
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

        {/* Calendar grid */}
        <div className={styles.calendarGrid}>
          {/* Header */}
          <div className={styles.calendarHeader}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className={styles.calendarHeaderCell}>
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
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
                  {/* Empty cells before first day */}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className={styles.miniDayEmpty} />
                  ))}
                  {/* Days */}
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
            {["week", "month", "year"].map((v) => (
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
          {/* Unassigned */}
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
