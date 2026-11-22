import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Check if a response has low ratings (1 or 2 stars)
 */
export function hasLowRating(answers) {
  const result = { hasLow: false, lowItems: [], overallLow: false };

  // Check overall rating
  if (typeof answers?.overall === "number" && answers.overall <= 2) {
    result.hasLow = true;
    result.overallLow = true;
  }

  // Check grid ratings
  if (answers?.ratings && typeof answers.ratings === "object") {
    for (const [row, value] of Object.entries(answers.ratings)) {
      if (typeof value === "number" && value <= 2) {
        result.hasLow = true;
        result.lowItems.push({ row, value });
      }
    }
  }

  return result;
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date string with time for display
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateStr);
}

/**
 * Get all responses for a survey
 */
export async function getSurveyResponses(surveySlug) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("survey_responses")
    .select("*")
    .eq("survey_slug", surveySlug)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch survey responses:", error);
    return [];
  }

  return data || [];
}

/**
 * Get a single response by ID
 */
export async function getSurveyResponse(responseId) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("survey_responses")
    .select("*")
    .eq("id", responseId)
    .single();

  if (error) {
    console.error("Failed to fetch survey response:", error);
    return null;
  }

  return data;
}

/**
 * Get basic stats for all surveys (for listing page)
 */
export async function getAllSurveysStats() {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("survey_responses")
    .select("survey_slug, answers, submitted_at");

  if (error) {
    console.error("Failed to fetch all survey stats:", error);
    return {};
  }

  const statsBySurvey = {};

  for (const response of data || []) {
    const slug = response.survey_slug;
    if (!statsBySurvey[slug]) {
      statsBySurvey[slug] = {
        totalResponses: 0,
        overallSum: 0,
        overallCount: 0,
        recommendSum: 0,
        recommendCount: 0,
        lastResponseAt: null,
      };
    }

    statsBySurvey[slug].totalResponses++;

    const answers = response.answers || {};

    if (typeof answers.overall === "number") {
      statsBySurvey[slug].overallSum += answers.overall;
      statsBySurvey[slug].overallCount++;
    }

    if (typeof answers.recommend === "number") {
      statsBySurvey[slug].recommendSum += answers.recommend;
      statsBySurvey[slug].recommendCount++;
    }

    const submittedAt = new Date(response.submitted_at);
    if (!statsBySurvey[slug].lastResponseAt || submittedAt > new Date(statsBySurvey[slug].lastResponseAt)) {
      statsBySurvey[slug].lastResponseAt = response.submitted_at;
    }
  }

  // Calculate averages
  for (const slug of Object.keys(statsBySurvey)) {
    const stats = statsBySurvey[slug];
    stats.avgOverall = stats.overallCount > 0
      ? parseFloat((stats.overallSum / stats.overallCount).toFixed(1))
      : null;
    stats.avgRecommend = stats.recommendCount > 0
      ? parseFloat((stats.recommendSum / stats.recommendCount).toFixed(1))
      : null;
  }

  return statsBySurvey;
}

/**
 * Get detailed survey stats
 */
export async function getSurveyStats(surveySlug, survey) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("survey_responses")
    .select("id, school, is_anonymous, answers, submitted_at")
    .eq("survey_slug", surveySlug);

  if (error) {
    console.error("Failed to fetch survey stats:", error);
    return getEmptyStats();
  }

  const responses = data || [];
  const totalResponses = responses.length;
  const uniqueSchools = new Set(responses.map((r) => r.school).filter(Boolean)).size;
  const anonymousCount = responses.filter((r) => r.is_anonymous).length;

  // Build stats from survey config
  const choiceStats = {};
  const ratingStats = { overall: { sum: 0, count: 0 } };
  const checkboxStats = {};
  const scaleStats = {};
  const stories = [];
  let storiesWithConsent = 0;

  // Initialize from config
  if (survey?.sections) {
    for (const section of survey.sections) {
      for (const q of section.questions) {
        if (q.type === "choice") {
          choiceStats[q.id] = {
            label: q.label,
            options: q.options,
            counts: {},
            total: 0,
          };
          for (const opt of q.options) {
            choiceStats[q.id].counts[opt] = 0;
          }
        } else if (q.type === "grid") {
          for (const row of q.rows) {
            ratingStats[row] = { sum: 0, count: 0, label: row };
          }
        } else if (q.type === "checkboxes") {
          checkboxStats[q.id] = {
            label: q.label,
            options: q.options,
            counts: {},
          };
          for (const opt of q.options) {
            checkboxStats[q.id].counts[opt] = 0;
          }
        } else if (q.type === "scale") {
          scaleStats[q.id] = {
            label: q.label,
            min: q.min,
            max: q.max,
            sum: 0,
            count: 0,
            distribution: {},
          };
          for (let i = q.min; i <= q.max; i++) {
            scaleStats[q.id].distribution[i] = 0;
          }
        }
      }
    }
  }

  // Process responses
  for (const response of responses) {
    const answers = response.answers || {};

    // Overall rating
    if (typeof answers.overall === "number") {
      ratingStats.overall.sum += answers.overall;
      ratingStats.overall.count++;
    }

    // Grid ratings
    if (answers.ratings && typeof answers.ratings === "object") {
      for (const [row, value] of Object.entries(answers.ratings)) {
        if (typeof value === "number" && ratingStats[row]) {
          ratingStats[row].sum += value;
          ratingStats[row].count++;
        }
      }
    }

    // Choice questions
    for (const [qId, stats] of Object.entries(choiceStats)) {
      const value = answers[qId];
      if (value && stats.counts[value] !== undefined) {
        stats.counts[value]++;
        stats.total++;
      }
    }

    // Checkbox questions
    for (const [qId, stats] of Object.entries(checkboxStats)) {
      const values = answers[qId];
      if (Array.isArray(values)) {
        for (const val of values) {
          if (stats.counts[val] !== undefined) {
            stats.counts[val]++;
          }
        }
      }
    }

    // Scale questions
    for (const [qId, stats] of Object.entries(scaleStats)) {
      const value = answers[qId];
      if (typeof value === "number") {
        stats.sum += value;
        stats.count++;
        if (stats.distribution[value] !== undefined) {
          stats.distribution[value]++;
        }
      }
    }

    // Stories
    if (answers.story && answers.story.trim()) {
      const hasConsent = answers.share_ok === true;
      if (hasConsent) storiesWithConsent++;
      stories.push({
        id: response.id,
        school: response.school || "Anonymous",
        story: answers.story,
        submittedAt: response.submitted_at,
        shareOk: hasConsent,
      });
    }
  }

  // Calculate averages for ratings
  const avgRatings = {};
  for (const [key, stats] of Object.entries(ratingStats)) {
    if (stats.count > 0) {
      avgRatings[key] = {
        value: parseFloat((stats.sum / stats.count).toFixed(1)),
        count: stats.count,
        label: stats.label || key,
      };
    }
  }

  // Calculate averages for scales
  for (const stats of Object.values(scaleStats)) {
    if (stats.count > 0) {
      stats.avg = parseFloat((stats.sum / stats.count).toFixed(1));
    }
  }

  // Sort checkbox counts by value
  for (const stats of Object.values(checkboxStats)) {
    stats.sortedCounts = Object.entries(stats.counts)
      .sort((a, b) => b[1] - a[1])
      .filter(([, count]) => count > 0);
  }

  return {
    totalResponses,
    uniqueSchools,
    anonymousCount,
    choiceStats,
    avgRatings,
    checkboxStats,
    scaleStats,
    stories: stories.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)),
    storiesWithConsent,
  };
}

function getEmptyStats() {
  return {
    totalResponses: 0,
    uniqueSchools: 0,
    anonymousCount: 0,
    choiceStats: {},
    avgRatings: {},
    checkboxStats: {},
    scaleStats: {},
    stories: [],
    storiesWithConsent: 0,
  };
}

/**
 * Export survey responses to CSV format
 */
export function exportSurveyToCSV(responses, survey) {
  // Build header row
  const headers = ["School", "Role", "Name", "Anonymous", "Submitted At", "improve_was_followup"];

  // Add all question columns
  for (const section of survey.sections) {
    for (const q of section.questions) {
      if (q.type === "grid") {
        for (const row of q.rows) {
          headers.push(`${q.label}: ${row}`);
        }
      } else {
        headers.push(q.label);
      }
    }
  }

  // Build data rows
  const rows = responses.map((response) => {
    const answers = response.answers || {};

    // Compute improve_was_followup from ratings
    const lowRating = hasLowRating(answers);
    const improveWasFollowUp = lowRating.hasLow && answers.improve ? "Yes" : "No";

    const row = [
      response.school || "Prefer not to say",
      answers.role || "",
      answers.name || "Anonymous",
      response.is_anonymous ? "Yes" : "No",
      formatDateTime(response.submitted_at),
      improveWasFollowUp,
    ];

    for (const section of survey.sections) {
      for (const q of section.questions) {
        const value = answers[q.id];

        if (q.type === "grid") {
          for (const gridRow of q.rows) {
            row.push(value?.[gridRow] || "");
          }
        } else if (q.type === "checkboxes" && Array.isArray(value)) {
          row.push(value.join("; "));
        } else if (q.type === "consent") {
          row.push(value ? "Yes" : "No");
        } else {
          row.push(value !== undefined && value !== null ? String(value) : "");
        }
      }
    }

    return row;
  });

  // Build CSV string
  const escapeCSV = (val) => {
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ];

  return csvLines.join("\n");
}
