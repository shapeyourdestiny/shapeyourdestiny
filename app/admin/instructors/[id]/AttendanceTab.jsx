"use client";

import { useState } from "react";
import styles from "./AttendanceTab.module.css";

const MONTH_LABELS = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

const REASON_LABELS = {
  vacation: "Vacation",
  sick: "Sick",
  appointment: "Appointment",
  personal: "Personal",
  emergency: "Emergency",
  other: "Other",
};

function formatDateShort(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function getDateParts(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    month: months[date.getMonth()],
    day: date.getDate(),
  };
}

export default function AttendanceTab({ instructor, attendanceData }) {
  const [showAllCovered, setShowAllCovered] = useState(false);

  const { daysOut, stats, monthByMonth, byReason, coveredForOthers } = attendanceData;

  const visibleCovered = showAllCovered ? coveredForOthers : coveredForOthers.slice(0, 6);

  // Calculate max for reason bars
  const maxReasonCount = Math.max(...Object.values(byReason), 1);

  return (
    <div className={styles.container}>
      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statTile}>
          <div className={styles.statValue}>{stats.totalDaysOut}</div>
          <div className={styles.statLabel}>Days out</div>
          <div className={styles.statSub}>
            {stats.totalDaysOut === 0
              ? "No days out this school year"
              : `Since Aug 1 ${stats.oneInN ? `· about 1 in ${stats.oneInN} classes` : ""}`}
          </div>
        </div>

        <div className={styles.statTile}>
          <div className={`${styles.statValue} ${stats.withWeekNotice === stats.totalWithNotice && stats.totalDaysOut > 0 ? styles.green : ""}`}>
            {stats.withWeekNotice} of {stats.totalWithNotice}
          </div>
          <div className={styles.statLabel}>With a week or more notice</div>
          <div className={styles.statSub}>
            {stats.sameDayByReason.length > 0
              ? stats.sameDayByReason.map((s, i) => (
                  <span key={s.reason}>
                    {i > 0 ? ", " : ""}
                    {s.count} was same day ({s.reason})
                  </span>
                ))
              : stats.totalDaysOut > 0
              ? "All had advance notice"
              : ""}
          </div>
        </div>

        <div className={styles.statTile}>
          <div className={`${styles.statValue} ${stats.classesWithoutSub === 0 ? styles.green : styles.red}`}>
            {stats.classesWithoutSub}
          </div>
          <div className={styles.statLabel}>Classes left without a sub</div>
          <div className={styles.statSub}>
            {stats.classesWithoutSub === 0 && stats.totalDaysOut > 0
              ? "Every day out was covered"
              : stats.classesWithoutSub > 0
              ? `${stats.classesWithoutSub} classes ran short`
              : ""}
          </div>
        </div>

        <div className={styles.statTile}>
          <div className={styles.statValue}>{stats.timesSubbed}</div>
          <div className={styles.statLabel}>Times subbed for others</div>
          <div className={styles.statSub}>Since Aug 1</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className={styles.columns}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          {/* Days Out Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>Days out</h3>
              <span className={styles.cardHeaderSub}>This school year, newest first</span>
            </div>

            {daysOut.length === 0 ? (
              <div className={styles.emptyState}>No days out this school year.</div>
            ) : (
              <div className={styles.daysOutList}>
                {daysOut.map((day) => {
                  const parts = getDateParts(day.date);
                  return (
                    <div key={day.date} className={styles.dayOutRow}>
                      <div className={styles.dateTile}>
                        <span className={styles.dateMonth}>{parts.month}</span>
                        <span className={styles.dateDay}>{parts.day}</span>
                      </div>
                      <div className={styles.dayOutMain}>
                        <div className={styles.dayOutTitle}>
                          Out · {REASON_LABELS[day.reason] || day.reason}
                        </div>
                        <div className={styles.dayOutSub}>
                          {day.sessions.map((s, i) => (
                            <span key={s.id}>
                              {i > 0 ? " · " : ""}
                              {s.schoolName} {s.time}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={styles.dayOutRight}>
                        <span className={`${styles.noticePill} ${styles[day.noticeLevel]}`}>
                          {day.noticeText}
                        </span>
                        {day.sessions.some(s => s.hasSub) ? (
                          <span className={styles.subText}>
                            {day.sessions.find(s => s.subName)?.subName || "Sub"} subbed
                          </span>
                        ) : (
                          <span className={styles.noSubText}>No sub</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          {/* Month by Month */}
          <div className={styles.card}>
            <h3>Month by month</h3>
            <div className={styles.monthGrid}>
              {MONTH_LABELS.map((label, idx) => {
                const count = monthByMonth[idx];
                const isFuture = count === null;
                const hasCount = count !== null && count > 0;
                return (
                  <div
                    key={label}
                    className={`${styles.monthTile} ${isFuture ? styles.future : ""} ${hasCount ? styles.hasCount : ""}`}
                  >
                    <span className={styles.monthLabel}>{label}</span>
                    <span className={styles.monthValue}>
                      {isFuture ? "·" : count}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className={styles.monthCaption}>
              Days out each month. Blank months have not happened yet.
            </div>
          </div>

          {/* Why They Were Out */}
          {Object.keys(byReason).length > 0 && (
            <div className={styles.card}>
              <h3>Why they were out</h3>
              <div className={styles.reasonList}>
                {Object.entries(byReason).map(([reason, count]) => (
                  <div key={reason} className={styles.reasonRow}>
                    <span className={styles.reasonLabel}>
                      {REASON_LABELS[reason] || reason}
                    </span>
                    <div className={styles.reasonBar}>
                      <div
                        className={styles.reasonBarFill}
                        style={{ width: `${(count / maxReasonCount) * 100}%` }}
                      />
                    </div>
                    <span className={styles.reasonCount}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Covered for Others */}
          {coveredForOthers.length > 0 && (
            <div className={styles.card}>
              <h3>Covered for others</h3>
              <div className={styles.coveredList}>
                {visibleCovered.map((c) => (
                  <div key={c.id} className={styles.coveredRow}>
                    <span>{formatDateShort(c.date)} · {c.schoolName}</span>
                    <span className={styles.coveredFor}>for {c.forName}</span>
                  </div>
                ))}
                {coveredForOthers.length > 6 && !showAllCovered && (
                  <button
                    type="button"
                    className={styles.showAllBtn}
                    onClick={() => setShowAllCovered(true)}
                  >
                    Show all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
