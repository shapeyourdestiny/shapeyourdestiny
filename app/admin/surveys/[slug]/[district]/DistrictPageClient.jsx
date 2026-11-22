"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { exportSurveyToCSV } from "@/lib/surveys/queries";
import styles from "./district.module.css";
import sharedStyles from "../../page.module.css";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(dateStr);
}

export default function DistrictPageClient({ survey, send, responses, stats }) {
  const searchParams = useSearchParams();
  const [showMore, setShowMore] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [expandedResponseId, setExpandedResponseId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(20);

  // Check for ?r=ID in URL to auto-expand a response
  const responseIdFromUrl = searchParams.get("r");
  useEffect(() => {
    if (responseIdFromUrl) {
      const timer = setTimeout(() => {
        setExpandedResponseId(responseIdFromUrl);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [responseIdFromUrl]);

  // Build question map for display
  const questionMap = useMemo(() => {
    const map = {};
    for (const section of survey.sections || []) {
      for (const q of section.questions) {
        map[q.id] = q;
      }
    }
    return map;
  }, [survey.sections]);

  // Get ordered question IDs for display
  const orderedQuestionIds = useMemo(() => {
    const ids = [];
    for (const section of survey.sections || []) {
      for (const q of section.questions) {
        ids.push(q.id);
      }
    }
    return ids;
  }, [survey.sections]);

  // Filter responses
  const filteredResponses = useMemo(() => {
    let filtered = responses;

    if (schoolFilter) {
      filtered = filtered.filter((r) => r.school === schoolFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => {
        const answers = r.answers || {};
        // Search in all text answers
        for (const [_key, value] of Object.entries(answers)) {
          if (typeof value === "string" && value.toLowerCase().includes(query)) {
            return true;
          }
        }
        return false;
      });
    }

    return filtered;
  }, [responses, schoolFilter, searchQuery]);

  const visibleResponses = filteredResponses.slice(0, visibleCount);
  const hasMore = filteredResponses.length > visibleCount;

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/survey/${survey.slug}/${send.linkSlug}`;
    await navigator.clipboard.writeText(url);
    // Brief feedback would go here
  };

  const handleExportCSV = () => {
    const csv = exportSurveyToCSV(responses, survey);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${survey.slug}-${send.linkSlug}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format school list for display
  const schoolListText = send.schools.length <= 3
    ? send.schools.join(", ")
    : `${send.schools.slice(0, 3).join(", ")} and ${send.schools.length - 3} more`;

  return (
    <>
      <div className={sharedStyles.crumb}>
        <Link href="/admin/surveys">Surveys</Link> &rsaquo;{" "}
        <Link href={`/admin/surveys/${survey.slug}`}>{survey.title}</Link> &rsaquo;
      </div>

      <div className={sharedStyles.header}>
        <div>
          <h1>{send.districtName}</h1>
          <div className={sharedStyles.sub}>
            {schoolListText} · sent {formatDate(send.createdAt)}
          </div>
        </div>

        <div className={sharedStyles.headerButtonsWrap}>
          <div className={sharedStyles.headerButtons}>
            <button
              type="button"
              className={`${sharedStyles.btnGhost} ${sharedStyles.btnSm}`}
              onClick={() => setShowEditModal(true)}
            >
              Edit schools
            </button>
            <button
              type="button"
              className={`${sharedStyles.btnGhost} ${sharedStyles.btnSm}`}
              onClick={handleExportCSV}
            >
              Export CSV
            </button>
            <button
              type="button"
              className={sharedStyles.btnPrimary}
              onClick={handleCopyLink}
            >
              Copy link
            </button>

            {/* Mobile more button */}
            <button
              type="button"
              className={`${sharedStyles.btnGhost} ${sharedStyles.moreBtn}`}
              onClick={() => setShowMore(!showMore)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="20" height="20">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
          </div>

          {showMore && (
            <div className={sharedStyles.moreDropdown}>
              <button onClick={() => { setShowEditModal(true); setShowMore(false); }}>
                Edit schools
              </button>
              <button onClick={() => { handleExportCSV(); setShowMore(false); }}>
                Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Averages Card */}
      <div className={styles.avgCard}>
        <div className={styles.avgTop}>
          <div className={styles.avgItem}>
            <small>Responses</small>
            <b>{stats.totalResponses}</b>
          </div>
          {stats.avgOverall !== null && (
            <div className={styles.avgItem}>
              <small>Overall</small>
              <b>{stats.avgOverall} <span className={styles.star}>&#9733;</span></b>
            </div>
          )}
          {stats.avgRecommend !== null && (
            <div className={styles.avgItem}>
              <small>Would recommend</small>
              <b>{stats.avgRecommend}<span className={styles.muted}> / 10</span></b>
            </div>
          )}
          <div className={styles.avgItem}>
            <small>Schools answered</small>
            <b>{stats.schoolsAnsweredCount}<span className={styles.muted}> of {send.schools.length}</span></b>
          </div>
        </div>

        {stats.gridAverages.length > 0 && (
          <div className={styles.ratingRows}>
            {stats.gridAverages.map((item) => (
              <div key={item.label} className={styles.ratingRow}>
                <span>{item.label}</span>
                <div className={styles.ratingTrack}>
                  <div
                    className={styles.ratingBar}
                    style={{ width: `${(item.avg / 5) * 100}%` }}
                  />
                </div>
                <b>{item.avg}</b>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Responses Card */}
      <div className={styles.responsesCard}>
        <div className={styles.responsesHeader}>
          <h2>Responses <span className={styles.muted}>{filteredResponses.length}</span></h2>
        </div>

        <div className={styles.searchRow}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search what people wrote"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className={styles.schoolSelect}
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
          >
            <option value="">All schools</option>
            {send.schools.map((school) => (
              <option key={school} value={school}>{school}</option>
            ))}
          </select>
        </div>

        <div className={styles.responsesList}>
          {visibleResponses.map((response) => (
            <ResponseRow
              key={response.id}
              response={response}
              questionMap={questionMap}
              orderedQuestionIds={orderedQuestionIds}
              isExpanded={expandedResponseId === response.id}
              onToggle={() => setExpandedResponseId(
                expandedResponseId === response.id ? null : response.id
              )}
            />
          ))}

          {visibleResponses.length === 0 && (
            <div className={styles.noResults}>
              No responses match your search.
            </div>
          )}
        </div>

        {hasMore && (
          <button
            type="button"
            className={styles.showMoreBtn}
            onClick={() => setVisibleCount((c) => c + 20)}
          >
            Show more
          </button>
        )}
      </div>

      {showEditModal && (
        <EditSchoolsModal
          survey={survey}
          send={send}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  );
}

function ResponseRow({ response, questionMap, orderedQuestionIds, isExpanded, onToggle }) {
  const answers = response.answers || {};

  // Get stars display
  const overallStars = typeof answers.overall === "number" ? answers.overall : null;

  // Get answer chips (recommend, attendance, confidence)
  const chips = [];
  if (typeof answers.recommend === "number") {
    chips.push(`Recommend ${answers.recommend}`);
  }
  if (answers.attendance) {
    const attendanceMap = {
      "Gone up a lot": "Attendance up a lot",
      "Gone up a little": "Attendance up a little",
      "Stayed the same": "Attendance same",
      "Not sure": "Attendance unsure",
    };
    chips.push(attendanceMap[answers.attendance] || answers.attendance);
  }
  if (answers.confidence) {
    const confidenceMap = {
      "Yes, a lot": "Confidence: yes, a lot",
      "A little": "Confidence: a little",
      "Not really": "Confidence: not really",
      "Not sure": "Confidence: unsure",
    };
    chips.push(confidenceMap[answers.confidence] || answers.confidence);
  }

  // Get quote (story first, then other long text, then enjoyed)
  let quote = answers.story?.trim() || answers.improve?.trim() || answers.enjoyed?.trim() || answers.bring_next?.trim() || answers.anything_else?.trim() || "";
  if (quote.length > 150) {
    quote = quote.substring(0, 150) + "...";
  }

  return (
    <div className={styles.responseRow}>
      <div className={styles.responseTop}>
        <div className={styles.responseWho}>
          {response.school || "Anonymous"}
          <span>
            {answers.role ? `${answers.role} · ` : ""}
            {formatRelativeDate(response.submitted_at)}
          </span>
        </div>
        {overallStars !== null && (
          <span className={styles.responseStars}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} style={{ opacity: i < overallStars ? 1 : 0.3 }}>&#9733;</span>
            ))}
          </span>
        )}
      </div>

      {chips.length > 0 && (
        <div className={styles.responseChips}>
          {chips.slice(0, 3).map((chip, i) => (
            <span key={i} className={styles.chip}>{chip}</span>
          ))}
        </div>
      )}

      {quote && (
        <p className={styles.responseQuote}>&ldquo;{quote}&rdquo;</p>
      )}

      {isExpanded ? (
        <>
          <div className={styles.fullAnswers}>
            {orderedQuestionIds.map((qId) => {
              const q = questionMap[qId];
              if (!q) return null;

              let displayValue = null;
              const value = answers[qId];

              if (q.type === "grid" && answers.ratings) {
                // Show grid ratings
                return (
                  <div key={qId} className={styles.answerItem}>
                    <small>{q.label}</small>
                    <span>
                      {q.rows.map((row) => {
                        const rowVal = answers.ratings[row];
                        return rowVal !== undefined ? `${row}: ${rowVal}` : null;
                      }).filter(Boolean).join(", ") || <span className={styles.noAnswer}>No answer</span>}
                    </span>
                  </div>
                );
              }

              if (value === undefined || value === null || value === "") {
                displayValue = <span className={styles.noAnswer}>No answer</span>;
              } else if (q.type === "stars") {
                displayValue = `${value} stars`;
              } else if (q.type === "scale") {
                displayValue = `${value} / ${q.max}`;
              } else if (q.type === "checkboxes" && Array.isArray(value)) {
                displayValue = value.join(", ");
              } else {
                displayValue = String(value);
              }

              return (
                <div key={qId} className={styles.answerItem}>
                  <small>{q.label}</small>
                  <span>{displayValue}</span>
                </div>
              );
            })}
          </div>
          <button type="button" className={styles.toggleBtn} onClick={onToggle}>
            Hide answers
          </button>
        </>
      ) : (
        <button type="button" className={styles.toggleBtn} onClick={onToggle}>
          See all answers &rsaquo;
        </button>
      )}
    </div>
  );
}

function EditSchoolsModal({ survey, send, onClose }) {
  const [selectedSchools, setSelectedSchools] = useState(send.schools);
  const [otherSchools, setOtherSchools] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSchoolToggle = (school) => {
    setSelectedSchools((prev) =>
      prev.includes(school)
        ? prev.filter((s) => s !== school)
        : [...prev, school]
    );
  };

  const handleSubmit = async () => {
    const otherList = otherSchools
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const allSchools = [...selectedSchools, ...otherList];

    if (allSchools.length === 0) {
      setError("Please select at least one school.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/surveys/${survey.slug}/sends/${send.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schools: allSchools }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${sharedStyles.scrim} ${sharedStyles.open}`} onClick={onClose}>
      <div className={sharedStyles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={sharedStyles.modalHeader}>
          <h2>Edit schools</h2>
          <div className={sharedStyles.sub}>{send.districtName}</div>
        </div>

        <div className={sharedStyles.modalBody}>
          <div className={sharedStyles.formGroup}>
            <label className={sharedStyles.formLabel}>Schools on this link</label>
            <div className={sharedStyles.checks}>
              {send.schools.map((school) => (
                <label key={school} className={sharedStyles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={selectedSchools.includes(school)}
                    onChange={() => handleSchoolToggle(school)}
                  />
                  {school}
                </label>
              ))}
            </div>

            <p className={sharedStyles.formNote}>
              Add more schools:
            </p>
            <textarea
              className={sharedStyles.textarea}
              placeholder="Other schools, one per line"
              value={otherSchools}
              onChange={(e) => setOtherSchools(e.target.value)}
            />
          </div>

          {error && (
            <p style={{ color: "#c00", fontSize: 14, marginTop: 12 }}>{error}</p>
          )}
        </div>

        <div className={sharedStyles.modalFooter}>
          <button type="button" className={sharedStyles.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={sharedStyles.btnPrimary}
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
