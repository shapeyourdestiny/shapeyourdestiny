"use client";

import { useState, useCallback } from "react";
import styles from "./InstructorSchedule.module.css";
import { getDirectionsUrl } from "@/lib/maps";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Get Sunday of the week containing a date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Format week range (e.g., "Aug 23-29, 2026")
function formatWeekRange(weekStart) {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);

  const startMonth = SHORT_MONTHS[start.getMonth()];
  const endMonth = SHORT_MONTHS[end.getMonth()];

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
}

export default function InstructorSchedule({
  initialNextSession,
  initialSessions,
  initialHolidays,
  initialCoverageStatuses = {},
  initialClasses = [],
  initialClassCoveringInfo = {},
}) {
  const [view, setView] = useState("week");
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);

  const [nextSession] = useState(initialNextSession);
  const [sessions, setSessions] = useState(initialSessions);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [loading, setLoading] = useState(false);
  const [coverageStatuses, setCoverageStatuses] = useState(initialCoverageStatuses);
  const [classes] = useState(initialClasses);
  const [classCoveringInfo] = useState(initialClassCoveringInfo);

  // Fetch data for a date range
  const fetchData = useCallback(async (startDate, endDate) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/instructor/schedule?start=${startDate}&end=${endDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setHolidays(data.holidays || []);
        setCoverageStatuses(data.coverageStatuses || {});
      }
    } catch (err) {
      console.error("Failed to fetch schedule:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Week navigation
  const goToPrevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);

    const endDate = new Date(newStart);
    endDate.setDate(endDate.getDate() + 6);
    fetchData(formatDate(newStart), formatDate(endDate));
  };

  const goToNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);

    const endDate = new Date(newStart);
    endDate.setDate(endDate.getDate() + 6);
    fetchData(formatDate(newStart), formatDate(endDate));
  };

  // Month navigation
  const goToPrevMonth = () => {
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);

    const startDate = `${newYear}-${String(newMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(newYear, newMonth + 1, 0).getDate();
    const endDate = `${newYear}-${String(newMonth + 1).padStart(2, "0")}-${lastDay}`;
    fetchData(startDate, endDate);
  };

  const goToNextMonth = () => {
    let newMonth = selectedMonth + 1;
    let newYear = selectedYear;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);

    const startDate = `${newYear}-${String(newMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(newYear, newMonth + 1, 0).getDate();
    const endDate = `${newYear}-${String(newMonth + 1).padStart(2, "0")}-${lastDay}`;
    fetchData(startDate, endDate);
  };

  // Get sessions for a specific date
  const getSessionsForDate = (dateStr) => {
    return sessions.filter((s) => s.date === dateStr);
  };

  // Get holiday for a specific date
  const getHolidayForDate = (dateStr) => {
    return holidays.find((h) => h.date === dateStr);
  };

  // Get unique schools from sessions (for legend)
  const getUniqueSchools = () => {
    const schoolMap = new Map();
    sessions.forEach((s) => {
      if (!schoolMap.has(s.school.id)) {
        schoolMap.set(s.school.id, s.school);
      }
    });
    return Array.from(schoolMap.values());
  };

  // Get coverage status for a session
  const getCoverageStatus = (session) => {
    const key = `${session.classId}-${session.date}`;
    return coverageStatuses[key] || null;
  };

  // Render My Classes section
  const renderMyClasses = () => {
    if (classes.length === 0) {
      return (
        <div className={styles.myClassesSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>My Classes</span>
            <span className={styles.sectionCount}>0</span>
          </div>
          <div className={styles.emptyClassesCard}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <p>No classes assigned yet</p>
            <span>Your classes will appear here once you&apos;re assigned</span>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.myClassesSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>My Classes</span>
          <span className={styles.sectionCount}>{classes.length}</span>
        </div>
        <div className={styles.myClassesList}>
          {classes.map((cls) => {
            const coveringInfo = classCoveringInfo[cls.id];
            const isCoveringSoon = !!coveringInfo;

            return (
              <div
                key={cls.id}
                className={`${styles.myClassCard} ${isCoveringSoon ? styles.coveringSoon : ""}`}
              >
                <div className={styles.mcBadgeRow}>
                  <span
                    className={styles.mcProgram}
                    data-program={cls.program}
                  >
                    {cls.program === "soccer" ? "Soccer" : "Youth Wellness"}
                  </span>
                  {isCoveringSoon && (
                    <span className={styles.mcCoveringTag}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                      COVERING {coveringInfo.dayName.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className={styles.mcSchool}>{cls.school.name}</div>
                <div className={styles.mcRow}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                  <span>{cls.daysDisplay}, {cls.time}</span>
                </div>
                <div className={styles.mcRow}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <span>{cls.durationText}</span>
                </div>
                {cls.school.address && (
                  <div className={styles.mcRow}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>
                      {cls.school.address.split(",")[0]} ·{" "}
                      <a
                        href={getDirectionsUrl(cls.school.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.mcDirectionsLink}
                      >
                        Directions
                      </a>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Week view
  const renderWeekView = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date);
      const daySessions = getSessionsForDate(dateStr);
      const holiday = getHolidayForDate(dateStr);

      days.push({
        date: dateStr,
        dayName: DAYS[i],
        dayNum: date.getDate(),
        month: SHORT_MONTHS[date.getMonth()],
        sessions: daySessions,
        holiday,
        isToday: formatDate(new Date()) === dateStr,
      });
    }

    // Check if the entire week is empty (no sessions, no holidays)
    const hasAnySessions = days.some(d => d.sessions.length > 0 || d.holiday);
    const isEmptyWeek = !hasAnySessions;

    // Format next session date for empty state
    const getNextSessionText = () => {
      if (nextSession) {
        const dateObj = new Date(nextSession.date + "T00:00:00");
        return `Your next session is ${SHORT_MONTHS[dateObj.getMonth()]} ${dateObj.getDate()}`;
      }
      return "Check back once you're assigned to a class";
    };

    return (
      <div className={styles.weekView}>
        <div className={styles.weekNav}>
          <button className={styles.navBtn} onClick={goToPrevWeek} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className={styles.navLabel}>{formatWeekRange(weekStart)}</span>
          <button className={styles.navBtn} onClick={goToNextWeek} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Empty week - show collapsed card */}
        {isEmptyWeek ? (
          <div className={styles.emptyWeekCard}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <p>Nothing scheduled this week</p>
            <span>{getNextSessionText()}</span>
          </div>
        ) : (
          /* Mixed week - compact day rows */
          <div className={styles.weekList}>
            {days.map((day) => {
              const hasSession = day.sessions.length > 0;
              const hasHoliday = !!day.holiday;
              // Check if any session on this day is a picked-up coverage
              const hasCoveringSession = day.sessions.some((s) => {
                const c = getCoverageStatus(s);
                return c?.isCoveredByMe;
              });

              return (
                <div
                  key={day.date}
                  className={`${styles.dayRow} ${hasSession ? styles.hasSession : ""} ${day.isToday ? styles.today : ""} ${hasHoliday ? styles.isHoliday : ""} ${hasCoveringSession ? styles.isCovering : ""}`}
                >
                  <div className={styles.dayBadge}>
                    <span className={styles.dayName}>{day.dayName}</span>
                    <span className={styles.dayDate}>{day.month} {day.dayNum}</span>
                  </div>

                  {hasHoliday ? (
                    <div className={styles.holidayNotice}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <div className={styles.holidayInfo}>
                        <span className={styles.holidayName}>{day.holiday.name}</span>
                      </div>
                    </div>
                  ) : hasSession ? (
                    <div className={styles.daySessionsWrap}>
                      {day.sessions.map((session) => {
                        const coverage = getCoverageStatus(session);
                        const hasCoverage = coverage?.hasCoverageRequest;
                        const isMyRequest = coverage?.isMyRequest;
                        const isCoveredByMe = coverage?.isCoveredByMe;
                        const isClaimed = coverage?.status === "claimed";

                        return (
                          <div
                            key={session.id}
                            className={`${styles.sessionCard} ${isCoveredByMe ? styles.sessionCardCovering : ""}`}
                          >
                            <div
                              className={styles.sessionColor}
                              style={{ background: isCoveredByMe ? "var(--orange)" : session.school.color }}
                            />
                            <div className={styles.sessionInfo}>
                              <span className={styles.sessionSchool}>{session.school.name}</span>
                              <span className={styles.sessionTime}>{session.time}</span>
                              {isCoveredByMe && coverage.requesterName ? (
                                <span className={styles.sessionCoveringFor}>
                                  Covering for {coverage.requesterName}
                                </span>
                              ) : session.coTeacher ? (
                                <span className={styles.sessionCoTeacher}>
                                  with {session.coTeacher.name}
                                </span>
                              ) : null}
                            </div>
                            {session.isReviewDay && (
                              <span className={styles.reviewBadge}>Review</span>
                            )}
                            {hasCoverage && isMyRequest && !isClaimed && (
                              <span className={`${styles.coverageStatus} ${styles.open}`}>
                                Seeking Coverage
                              </span>
                            )}
                            {hasCoverage && isMyRequest && isClaimed && (
                              <span className={`${styles.coverageStatus} ${styles.covered}`}>
                                Covered
                              </span>
                            )}
                            {hasCoverage && isCoveredByMe && (
                              <span className={`${styles.coverageStatus} ${styles.covering}`}>
                                Covering
                              </span>
                            )}
                            {session.school.address && (
                              <a
                                href={getDirectionsUrl(session.school.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.sessionDirections}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                </svg>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className={styles.emptyDayText}>No session</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render Month view
  const renderMonthView = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const weeks = [];
    let currentWeek = [];

    // Pad start
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const daySessions = getSessionsForDate(dateStr);
      const holiday = getHolidayForDate(dateStr);

      currentWeek.push({
        day,
        dateStr,
        sessions: daySessions,
        holiday,
        isToday: formatDate(new Date()) === dateStr,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Pad end
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const uniqueSchools = getUniqueSchools();
    const selectedDaySessions = selectedDay ? getSessionsForDate(selectedDay) : [];
    const selectedDayHoliday = selectedDay ? getHolidayForDate(selectedDay) : null;

    return (
      <div className={styles.monthView}>
        <div className={styles.monthNav}>
          <button className={styles.navBtn} onClick={goToPrevMonth} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className={styles.navLabel}>
            {MONTHS[selectedMonth]} {selectedYear}
          </span>
          <button className={styles.navBtn} onClick={goToNextMonth} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className={styles.monthContent}>
          <div className={styles.calendarWrapper}>
            <div className={styles.calendarHeader}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                <div key={d} className={styles.calendarHeaderCell}>
                  <span className={styles.dayFull}>{d}</span>
                  <span className={styles.dayShort}>{["S", "M", "T", "W", "T", "F", "S"][i]}</span>
                </div>
              ))}
            </div>

            <div className={styles.calendarGrid}>
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className={styles.calendarWeek}>
                  {week.map((cell, cellIdx) => (
                    <div
                      key={cellIdx}
                      className={`${styles.calendarCell} ${!cell ? styles.empty : ""} ${cell?.isToday ? styles.today : ""} ${cell?.dateStr === selectedDay ? styles.selected : ""}`}
                      onClick={() => cell && setSelectedDay(cell.dateStr)}
                    >
                      {cell && (
                        <>
                          <span className={styles.calendarDay}>{cell.day}</span>
                          <div className={styles.calendarDots}>
                            {cell.holiday && (
                              <span className={`${styles.calendarDot} ${styles.holidayDot}`} />
                            )}
                            {cell.sessions.slice(0, 3).map((s, i) => (
                              <span
                                key={i}
                                className={styles.calendarDot}
                                style={{ background: s.school.color }}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.holidayDot}`} />
                <span>Holiday</span>
              </div>
              {uniqueSchools.map((school) => (
                <div key={school.id} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: school.color }} />
                  <span>{school.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detail panel */}
          <div className={styles.detailPanel}>
            {selectedDay ? (
              <>
                <h3 className={styles.detailDate}>
                  {MONTHS[parseInt(selectedDay.split("-")[1]) - 1]}{" "}
                  {parseInt(selectedDay.split("-")[2])},{" "}
                  {selectedDay.split("-")[0]}
                </h3>
                {selectedDayHoliday ? (
                  <div className={styles.detailHoliday}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{selectedDayHoliday.name}</span>
                  </div>
                ) : selectedDaySessions.length > 0 ? (
                  <div className={styles.detailSessions}>
                    {selectedDaySessions.map((session) => (
                      <div key={session.id} className={styles.detailSession}>
                        <div
                          className={styles.detailColor}
                          style={{ background: session.school.color }}
                        />
                        <div className={styles.detailInfo}>
                          <span className={styles.detailSchool}>{session.school.name}</span>
                          <span className={styles.detailTime}>{session.time}</span>
                          {session.coTeacher && (
                            <span className={styles.detailCoTeacher}>
                              with {session.coTeacher.name}
                            </span>
                          )}
                        </div>
                        {session.isReviewDay && (
                          <span className={styles.reviewBadge}>Review</span>
                        )}
                        {session.school.address && (
                          <a
                            href={getDirectionsUrl(session.school.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.detailDirections}
                          >
                            Get Directions
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.detailEmpty}>No sessions scheduled</p>
                )}
              </>
            ) : (
              <p className={styles.detailPrompt}>Select a day to see details</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.schedule}>
      {renderMyClasses()}

      <div className={styles.toggleNavWrap}>
        <div className={styles.viewToggleSm}>
          <button
            className={`${styles.toggleBtnSm} ${view === "week" ? styles.active : ""}`}
            onClick={() => setView("week")}
          >
            Week
          </button>
          <button
            className={`${styles.toggleBtnSm} ${view === "month" ? styles.active : ""}`}
            onClick={() => setView("month")}
          >
            Month
          </button>
        </div>
      </div>

      {loading && <div className={styles.loading}>Loading...</div>}

      {view === "week" ? renderWeekView() : renderMonthView()}
    </div>
  );
}
