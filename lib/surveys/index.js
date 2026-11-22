/**
 * Central survey registry
 *
 * To add a new survey:
 * 1. Create a config file in lib/surveys/ (e.g., parent-feedback.js)
 * 2. Import it here and add to the SURVEYS object
 * 3. The survey will appear in /admin/surveys with its own results page
 *
 * PERIODS: Each survey has an optional `period` field (e.g., "Nov 2024").
 * To run the same survey again in a new period, create a new survey config
 * with a new slug (e.g., "soccer-feedback-2025") rather than reusing the
 * existing one. This keeps historical data separate and allows comparing
 * results across periods.
 */

import soccerFeedbackSurvey from "./soccer-feedback";

// All surveys, keyed by slug
export const SURVEYS = {
  "soccer-feedback": {
    ...soccerFeedbackSurvey,
    // Add required fields if missing
    audience: soccerFeedbackSurvey.audience || "For schools",
    status: soccerFeedbackSurvey.status || "open",
    icon: soccerFeedbackSurvey.icon || "ball",
  },
};

/**
 * Get a survey by slug
 * @param {string} slug
 * @returns {object|null}
 */
export function getSurvey(slug) {
  return SURVEYS[slug] || null;
}

/**
 * List all surveys, sorted by period (newest first)
 * @returns {object[]} Array of survey configs with their slugs
 */
export function listSurveys() {
  const surveys = Object.entries(SURVEYS).map(([slug, config]) => ({
    slug,
    ...config,
  }));

  // Sort by period descending (newest first)
  // Periods like "Nov 2024" are compared as strings which works for same-year months,
  // but for cross-year comparison we parse the year
  surveys.sort((a, b) => {
    if (!a.period && !b.period) return 0;
    if (!a.period) return 1; // No period goes last
    if (!b.period) return -1;

    // Extract year from period (e.g., "Nov 2024" -> 2024)
    const yearA = parseInt(a.period.match(/\d{4}/)?.[0] || "0", 10);
    const yearB = parseInt(b.period.match(/\d{4}/)?.[0] || "0", 10);

    if (yearA !== yearB) return yearB - yearA; // Newer year first

    // Same year: compare full string (months will sort alphabetically)
    return b.period.localeCompare(a.period);
  });

  return surveys;
}

/**
 * Check if a survey accepts responses
 * @param {object} survey
 * @returns {boolean}
 */
export function isSurveyOpen(survey) {
  if (!survey) return false;
  if (survey.status === "draft") return false;
  if (survey.status === "closed") return false;
  if (survey.closesAt && new Date() > new Date(survey.closesAt)) return false;
  return true;
}

/**
 * Get display status for a survey
 * @param {object} survey
 * @returns {"open"|"draft"|"closed"}
 */
export function getSurveyStatus(survey) {
  if (!survey) return "closed";
  if (survey.status === "draft") return "draft";
  if (survey.status === "closed") return "closed";
  if (survey.closesAt && new Date() > new Date(survey.closesAt)) return "closed";
  return "open";
}

// Re-export helpers from soccer-feedback for backward compatibility
export { getRequiredQuestionIds, getQuestionMap, countRequiredQuestions } from "./soccer-feedback";
