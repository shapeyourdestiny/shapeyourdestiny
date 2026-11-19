"use client";

import { useState, useRef, useEffect } from "react";
import { exportSurveyToCSV } from "@/lib/surveys/queries";
import styles from "./page.module.css";

export default function SurveyAdmin({ initialResponses, initialStats, survey, surveyUrl }) {
  const [responses] = useState(initialResponses);
  const [stats] = useState(initialStats);
  const [filter, setFilter] = useState("all");
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  // Get unique schools for filter
  const schools = [...new Set(responses.map((r) => r.school).filter(Boolean))].sort();

  // Filter responses
  const filteredResponses = responses.filter((r) => {
    if (filter === "all") return true;
    if (filter === "anonymous") return !r.school;
    return r.school === filter;
  });

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    const csv = exportSurveyToCSV(responses, survey);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `soccer-feedback-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = "soccer-feedback-qr.png";
      link.click();
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderStars = (value, max = 5) => {
    if (!value) return null;
    return (
      <span className={styles.stars}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < value ? styles.starFilled : styles.starEmpty}>
            ★
          </span>
        ))}
      </span>
    );
  };

  return (
    <>
      {/* Action buttons */}
      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={handleCopyLink}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button className={styles.actionBtn} onClick={() => setShowQR(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          QR code
        </button>
        <button className={styles.actionBtn} onClick={handleExportCSV}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Stats tiles */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{stats.totalResponses}</div>
          <div className={styles.statLabel}>Responses</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum}>
            {stats.attendanceUp.total}
            <span className={styles.statSub}>of {stats.totalResponses}</span>
          </div>
          <div className={styles.statLabel}>Attendance went up</div>
          <div className={styles.statDetail}>
            {stats.attendanceUp.aLot} a lot, {stats.attendanceUp.aLittle} a little
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum}>
            {stats.confidenceImproved.total}
            <span className={styles.statSub}>of {stats.totalResponses}</span>
          </div>
          <div className={styles.statLabel}>Confidence improved</div>
          <div className={styles.statDetail}>
            {stats.confidenceImproved.aLot} a lot, {stats.confidenceImproved.aLittle} a little
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{stats.avgRecommend || "-"}<span className={styles.statSub}>/10</span></div>
          <div className={styles.statLabel}>Would recommend</div>
        </div>
      </div>

      {/* Charts */}
      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <h3>Ratings (out of 5)</h3>
          <div className={styles.barChart}>
            {Object.entries(stats.avgRatings).map(([label, value]) => (
              <div key={label} className={styles.barRow}>
                <span className={styles.barLabel}>{label === "overall" ? "Overall" : label}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(value / 5) * 100}%` }} />
                </div>
                <span className={styles.barValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.chartCard}>
          <h3>Programs parents ask about</h3>
          <div className={styles.barChart}>
            {Object.entries(stats.parentRequests).length === 0 ? (
              <p className={styles.emptyText}>No data yet</p>
            ) : (
              Object.entries(stats.parentRequests).map(([program, count]) => (
                <div key={program} className={styles.barRow}>
                  <span className={styles.barLabel}>{program}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(count / Math.max(...Object.values(stats.parentRequests))) * 100}%`,
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Student stories */}
      {stats.stories.length > 0 && (
        <div className={styles.storiesCard}>
          <h3>Student stories</h3>
          <div className={styles.storiesList}>
            {stats.stories.map((story) => (
              <div key={story.id} className={styles.storyItem}>
                <p className={styles.storyText}>{story.story}</p>
                <div className={styles.storyMeta}>
                  <span>{story.school}</span>
                  <span>{formatDate(story.submittedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className={styles.filterRow}>
        <button
          className={`${styles.filterChip} ${filter === "all" ? styles.filterChipActive : ""}`}
          onClick={() => setFilter("all")}
        >
          All ({responses.length})
        </button>
        {schools.map((school) => (
          <button
            key={school}
            className={`${styles.filterChip} ${filter === school ? styles.filterChipActive : ""}`}
            onClick={() => setFilter(school)}
          >
            {school}
          </button>
        ))}
        <button
          className={`${styles.filterChip} ${filter === "anonymous" ? styles.filterChipActive : ""}`}
          onClick={() => setFilter("anonymous")}
        >
          Anonymous ({responses.filter((r) => !r.school).length})
        </button>
      </div>

      {/* Responses list */}
      <div className={styles.responsesList}>
        {filteredResponses.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No responses yet</p>
          </div>
        ) : (
          filteredResponses.map((response) => (
            <div
              key={response.id}
              className={`${styles.responseRow} ${selectedResponse?.id === response.id ? styles.responseRowActive : ""}`}
              onClick={() => setSelectedResponse(selectedResponse?.id === response.id ? null : response)}
            >
              <div className={styles.responseSummary}>
                <div className={styles.responseInfo}>
                  <span className={styles.responseSchool}>
                    {response.school || "Prefer not to say"}
                  </span>
                  <span className={styles.responseMeta}>
                    {response.answers?.role || "No role"} · {response.answers?.name || "Anonymous"}
                  </span>
                </div>
                <div className={styles.responseScores}>
                  {renderStars(response.answers?.overall)}
                  <span className={styles.responseRecommend}>
                    {response.answers?.recommend !== undefined ? `${response.answers.recommend}/10` : "-"}
                  </span>
                </div>
                <span className={styles.responseDate}>{formatDate(response.submitted_at)}</span>
                <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {selectedResponse?.id === response.id && (
                <div className={styles.responseDetail}>
                  {survey.sections.map((section) => (
                    <div key={section.title} className={styles.detailSection}>
                      <h4>{section.title}</h4>
                      {section.questions.map((q) => {
                        const value = response.answers?.[q.id];
                        if (value === undefined || value === null || value === "") return null;

                        return (
                          <div key={q.id} className={styles.detailItem}>
                            <span className={styles.detailLabel}>{q.label}</span>
                            <span className={styles.detailValue}>
                              {q.type === "stars" && renderStars(value)}
                              {q.type === "grid" && (
                                <div className={styles.gridValues}>
                                  {Object.entries(value).map(([row, rating]) => (
                                    <div key={row}>
                                      {row}: {renderStars(rating)}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {q.type === "scale" && `${value}/10`}
                              {q.type === "checkboxes" && Array.isArray(value) && value.join(", ")}
                              {q.type === "consent" && (value ? "Yes" : "No")}
                              {["dropdown", "choice", "short", "long"].includes(q.type) && value}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div className={styles.detailFooter}>
                    Submitted {formatDateTime(response.submitted_at)}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* QR Modal */}
      {showQR && (
        <div className={styles.modal} onClick={() => setShowQR(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Survey QR Code</h3>
            <div ref={qrRef} className={styles.qrWrapper}>
              <QRCode url={surveyUrl} />
            </div>
            <p className={styles.qrUrl}>{surveyUrl}</p>
            <div className={styles.modalActions}>
              <button className={styles.actionBtn} onClick={handleDownloadQR}>
                Download PNG
              </button>
              <button className={styles.modalClose} onClick={() => setShowQR(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function QRCode({ url }) {
  const [loaded, setLoaded] = useState(false);
  const canvasRef = useRef(null);

  // Generate QR using external API
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use QR Server API to generate QR code
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 200, 200);
        ctx.drawImage(img, 0, 0, 200, 200);
        setLoaded(true);
      }
    };
    img.onerror = () => {
      // Show placeholder on error
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#E7EFFC";
        ctx.fillRect(0, 0, 200, 200);
        ctx.fillStyle = "#46506E";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("QR code unavailable", 100, 100);
      }
    };
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&color=1F3168&bgcolor=ffffff`;
  }, [url]);

  return <canvas ref={canvasRef} width={200} height={200} style={{ opacity: loaded ? 1 : 0.5 }} />;
}
