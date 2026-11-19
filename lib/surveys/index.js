/**
 * Central survey registry
 *
 * To add a new survey:
 * 1. Create a config file in lib/surveys/ (e.g., parent-feedback.js)
 * 2. Import it here and add to the SURVEYS object
 * 3. The survey will appear in /admin/surveys with its own results page
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
 * List all surveys
 * @returns {object[]} Array of survey configs with their slugs
 */
export function listSurveys() {
  return Object.entries(SURVEYS).map(([slug, config]) => ({
    slug,
    ...config,
  }));
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
