"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRelativeTime, formatDateTime, hasLowRating } from "@/lib/surveys/queries";
import styles from "./page.module.css";

export default function SurveyResultsClient({ survey, stats, responses }) {
  const [activeTab, setActiveTab] = useState("summary");
  const [expandedResponse, setExpandedResponse] = useState(null);
  const [filterLowRating, setFilterLowRating] = useState(false);

  const statusLabel =
    survey.status === "open"
      ? "Open"
      : survey.status === "draft"
      ? "Draft"
      : "Closed";

  return (
    <>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/admin/surveys" className={styles.backLink}>
            ← All surveys
          </Link>
          <h1>{survey.title}</h1>
          <div className={styles.headerMeta}>
            <span className={`${styles.statusPill} ${styles[`status${survey.status}`]}`}>
              {statusLabel}
            </span>
            <span className={styles.metaText}>{survey.audience}</span>
            {survey.closesAt && (
              <span className={styles.metaText}>
                Closes {new Date(survey.closesAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
        <a
          href={`/survey/${survey.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.viewSurveyBtn}
        >
          View survey ↗
        </a>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.totalResponses}</span>
          <span className={styles.statLabel}>Responses</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.uniqueSchools}</span>
          <span className={styles.statLabel}>Schools</span>
        </div>
        {stats.avgRatings?.overall && (
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.avgRatings.overall.value}</span>
            <span className={styles.statLabel}>Avg Rating</span>
          </div>
        )}
        {stats.scaleStats?.recommend && stats.scaleStats.recommend.avg !== undefined && (
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.scaleStats.recommend.avg}</span>
            <span className={styles.statLabel}>Recommend</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "summary" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          Summary
        </button>
        <button
          className={`${styles.tab} ${activeTab === "responses" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("responses")}
        >
          Responses ({responses.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "summary" ? (
        <SummaryTab stats={stats} survey={survey} />
      ) : (
        <ResponsesTab
          responses={responses}
          survey={survey}
          expandedResponse={expandedResponse}
          setExpandedResponse={setExpandedResponse}
          filterLowRating={filterLowRating}
          setFilterLowRating={setFilterLowRating}
        />
      )}
    </>
  );
}

function SummaryTab({ stats, survey }) {
  if (stats.totalResponses === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📊</div>
        <h3>No responses yet</h3>
        <p>Share the survey link to start collecting feedback.</p>
        <a
          href={`/survey/${survey.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.emptyBtn}
        >
          View survey
        </a>
      </div>
    );
  }

  return (
    <div className={styles.summaryGrid}>
      {/* Rating Stats */}
      {Object.keys(stats.avgRatings).length > 0 && (
        <div className={styles.summaryCard}>
          <h3 className={styles.cardTitle}>Ratings</h3>
          <div className={styles.ratingsList}>
            {Object.entries(stats.avgRatings).map(([key, data]) => (
              <div key={key} className={styles.ratingRow}>
                <span className={styles.ratingLabel}>
                  {data.label || key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
                <div className={styles.ratingBar}>
                  <div
                    className={styles.ratingFill}
                    style={{ width: `${(data.value / 5) * 100}%` }}
                  />
                </div>
                <span className={styles.ratingValue}>{data.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scale Stats (NPS-style) */}
      {Object.keys(stats.scaleStats).length > 0 && (
        <div className={styles.summaryCard}>
          <h3 className={styles.cardTitle}>Scales</h3>
          <div className={styles.scalesList}>
            {Object.entries(stats.scaleStats).map(([key, data]) => (
              <div key={key} className={styles.scaleItem}>
                <div className={styles.scaleHeader}>
                  <span className={styles.scaleLabel}>{data.label}</span>
                  <span className={styles.scaleAvg}>
                    {data.avg !== undefined ? data.avg : "—"} avg
                  </span>
                </div>
                <div className={styles.scaleDistribution}>
                  {Object.entries(data.distribution).map(([score, count]) => (
                    <div key={score} className={styles.scaleBar}>
                      <div className={styles.scaleBarLabel}>{score}</div>
                      <div className={styles.scaleBarTrack}>
                        <div
                          className={styles.scaleBarFill}
                          style={{
                            width: data.count > 0 ? `${(count / data.count) * 100}%` : "0%",
                          }}
                        />
                      </div>
                      <div className={styles.scaleBarCount}>{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Choice Stats */}
      {Object.keys(stats.choiceStats).length > 0 && (
        <div className={styles.summaryCard}>
          <h3 className={styles.cardTitle}>Multiple Choice</h3>
          <div className={styles.choicesList}>
            {Object.entries(stats.choiceStats).map(([key, data]) => (
              <div key={key} className={styles.choiceItem}>
                <h4 className={styles.choiceLabel}>{data.label}</h4>
                <div className={styles.choiceOptions}>
                  {data.options.map((opt) => {
                    const count = data.counts[opt] || 0;
                    const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
                    return (
                      <div key={opt} className={styles.choiceOption}>
                        <div className={styles.choiceBar}>
                          <div
                            className={styles.choiceFill}
                            style={{ width: `${pct}%` }}
                          />
                          <span className={styles.choiceText}>{opt}</span>
                        </div>
                        <span className={styles.choiceCount}>
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checkbox Stats */}
      {Object.keys(stats.checkboxStats).length > 0 && (
        <div className={styles.summaryCard}>
          <h3 className={styles.cardTitle}>Checkboxes</h3>
          <div className={styles.checkboxList}>
            {Object.entries(stats.checkboxStats).map(([key, data]) => (
              <div key={key} className={styles.checkboxItem}>
                <h4 className={styles.checkboxLabel}>{data.label}</h4>
                {data.sortedCounts && data.sortedCounts.length > 0 ? (
                  <div className={styles.checkboxOptions}>
                    {data.sortedCounts.map(([opt, count]) => (
                      <div key={opt} className={styles.checkboxOption}>
                        <span className={styles.checkboxText}>{opt}</span>
                        <span className={styles.checkboxCount}>{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noData}>No selections yet</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stories */}
      {stats.stories && stats.stories.length > 0 && (
        <div className={styles.summaryCard + " " + styles.storiesCard}>
          <h3 className={styles.cardTitle}>
            Stories & Comments ({stats.stories.length})
          </h3>
          <div className={styles.storiesList}>
            {stats.stories.map((story) => (
              <div key={story.id} className={styles.storyItem}>
                <div className={styles.storyMeta}>
                  <span className={styles.storySchool}>{story.school}</span>
                  <span className={styles.storyDate}>
                    {formatRelativeTime(story.submittedAt)}
                  </span>
                  {story.shareOk && (
                    <span className={styles.shareOk}>Can share</span>
                  )}
                </div>
                <p className={styles.storyText}>{story.story}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResponsesTab({ responses, survey, expandedResponse, setExpandedResponse, filterLowRating, setFilterLowRating }) {
  if (responses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📋</div>
        <h3>No responses yet</h3>
        <p>Share the survey link to start collecting feedback.</p>
      </div>
    );
  }

  // Build a flat list of questions for display
  const questions = [];
  for (const section of survey.sections || []) {
    for (const q of section.questions) {
      questions.push(q);
    }
  }

  // Filter responses if needed
  const filteredResponses = filterLowRating
    ? responses.filter((r) => hasLowRating(r.answers || {}).hasLow)
    : responses;

  const lowRatingCount = responses.filter((r) => hasLowRating(r.answers || {}).hasLow).length;

  return (
    <div>
      {/* Filter chips */}
      <div className={styles.filterChips}>
        <button
          className={`${styles.filterChip} ${filterLowRating ? styles.filterChipActive : ""}`}
          onClick={() => setFilterLowRating(!filterLowRating)}
        >
          Low rating ({lowRatingCount})
        </button>
      </div>

      <div className={styles.responsesList}>
        {filteredResponses.map((response) => {
          const isExpanded = expandedResponse === response.id;
          const answers = response.answers || {};
          const lowRating = hasLowRating(answers);
          const improveWasFollowUp = lowRating.hasLow && answers.improve;

          return (
            <div key={response.id} className={styles.responseCard}>
              <button
                className={styles.responseHeader}
                onClick={() => setExpandedResponse(isExpanded ? null : response.id)}
              >
                <div className={styles.responseInfo}>
                  <span className={styles.responseName}>
                    {answers.name || "Anonymous"}
                  </span>
                  <span className={styles.responseSchool}>
                    {response.school || "No school"}
                  </span>
                  {lowRating.hasLow && (
                    <span className={styles.lowRatingTag}>Low rating</span>
                  )}
                  <span className={styles.responseDate}>
                    {formatDateTime(response.submitted_at)}
                  </span>
                </div>
                <div className={styles.responseQuickStats}>
                  {answers.overall && (
                    <span className={`${styles.quickStat} ${answers.overall <= 2 ? styles.quickStatLow : ""}`}>
                      Overall: {answers.overall}/5
                    </span>
                  )}
                  {answers.recommend !== undefined && (
                    <span className={styles.quickStat}>
                      Recommend: {answers.recommend}/10
                    </span>
                  )}
                </div>
                <span className={styles.expandIcon}>{isExpanded ? "−" : "+"}</span>
              </button>

              {isExpanded && (
                <div className={styles.responseBody}>
                  {/* Show improve first if it was a follow-up */}
                  {improveWasFollowUp && (
                    <div className={styles.answerRow}>
                      <span className={styles.answerLabel}>What could we do better?</span>
                      <span className={styles.answerValue}>{answers.improve}</span>
                    </div>
                  )}

                  {questions.map((q) => {
                    const value = answers[q.id];
                    if (value === undefined || value === null || value === "") {
                      return null;
                    }

                    // Skip improve if already shown as follow-up
                    if (q.id === "improve" && improveWasFollowUp) {
                      return null;
                    }

                    return (
                      <div key={q.id} className={styles.answerRow}>
                        <span className={styles.answerLabel}>{q.label}</span>
                        <span className={styles.answerValue}>
                          {formatAnswer(q, value)}
                        </span>
                      </div>
                    );
                  })}

                  {/* Grid ratings */}
                  {answers.ratings && (
                    <div className={styles.answerRow}>
                      <span className={styles.answerLabel}>Ratings</span>
                      <div className={styles.gridRatings}>
                        {Object.entries(answers.ratings).map(([row, val]) => (
                          <span key={row} className={`${styles.gridRating} ${val <= 2 ? styles.gridRatingLow : ""}`}>
                            {row}: {val}/5
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatAnswer(q, value) {
  if (q.type === "checkboxes" && Array.isArray(value)) {
    return value.join(", ");
  }
  if (q.type === "consent") {
    return value ? "Yes" : "No";
  }
  if (q.type === "stars") {
    return `${value}/5`;
  }
  if (q.type === "scale") {
    return `${value}/${q.max}`;
  }
  if (q.type === "grid" && typeof value === "object") {
    return Object.entries(value)
      .map(([row, v]) => `${row}: ${v}/5`)
      .join(", ");
  }
  return String(value);
}
