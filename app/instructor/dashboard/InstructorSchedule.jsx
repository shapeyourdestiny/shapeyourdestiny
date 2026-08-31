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

  // Render Next Session hero card
  const renderNextSessionCard = () => {
    if (!nextSession) {
      return (
        <div className={styles.heroCard}>
          <div className={styles.heroEmpty}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <h2>Nothing scheduled yet</h2>
            <p>Your upcoming sessions will appear here</p>
          </div>
        </div>
      );
    }

    const countdownText =
      nextSession.daysUntil === 0
        ? "Today"
        : nextSession.daysUntil === 1
        ? "Tomorrow"
        : `In ${nextSession.daysUntil} days`;

    return (
      <div className={styles.heroCard}>
        <div className={styles.heroContent}>
          <span className={styles.heroLabel}>Next Session</span>
          <span className={styles.heroCountdown}>{countdownText}</span>

          <div className={styles.heroDetails}>
            <h2 className={styles.heroSchool}>{nextSession.school.name}</h2>
            <div className={styles.heroMeta}>
              <span className={styles.heroTime}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {nextSession.time}
              </span>
              <span className={styles.heroDate}>
                {SHORT_MONTHS[new Date(nextSession.date + "T00:00:00").getMonth()]}{" "}
                {new Date(nextSession.date + "T00:00:00").getDate()}
              </span>
            </div>

            {nextSession.coTeacher && (
              <div className={styles.heroCoTeacher}>
                <div className={styles.coTeacherAvatar}>
                  {nextSession.coTeacher.name.charAt(0)}
                </div>
                <span>with {nextSession.coTeacher.name}</span>
              </div>
            )}

            {nextSession.isReviewDay && (
              <span className={styles.reviewPill}>Review Day</span>
            )}
          </div>

          <div className={styles.heroActions}>
            {nextSession.school.address && (
              <a
                href={getDirectionsUrl(nextSession.school.address)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.directionsBtn}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                Get Directions
              </a>
            )}
            <button
              className={styles.viewWeekBtn}
              onClick={() => setView("week")}
            >
              View Full Week
            </button>
          </div>
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

              return (
                <div
                  key={day.date}
                  className={`${styles.dayRow} ${hasSession ? styles.hasSession : ""} ${day.isToday ? styles.today : ""} ${hasHoliday ? styles.isHoliday : ""}`}
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
                          <div key={session.id} className={styles.sessionCard}>
                            <div
                              className={styles.sessionColor}
                              style={{ background: session.school.color }}
                            />
                            <div className={styles.sessionInfo}>
                              <span className={styles.sessionSchool}>{session.school.name}</span>
                              <span className={styles.sessionTime}>{session.time}</span>
                              {session.coTeacher && (
                                <span className={styles.sessionCoTeacher}>
                                  with {session.coTeacher.name}
                                </span>
                              )}
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
                                You&apos;re Covering
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
      {renderNextSessionCard()}

      <div className={styles.viewToggle}>
        <button
          className={`${styles.toggleBtn} ${view === "week" ? styles.active : ""}`}
          onClick={() => setView("week")}
        >
          Week
        </button>
        <button
          className={`${styles.toggleBtn} ${view === "month" ? styles.active : ""}`}
          onClick={() => setView("month")}
        >
          Month
        </button>
      </div>

      {loading && <div className={styles.loading}>Loading...</div>}

      {view === "week" ? renderWeekView() : renderMonthView()}
    </div>
  );
}
