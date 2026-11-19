import { createAdminClient } from "@/lib/supabase/admin";

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
 * Get survey stats
 */
export async function getSurveyStats(surveySlug) {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("survey_responses")
    .select("school, is_anonymous, answers")
    .eq("survey_slug", surveySlug);

  if (error) {
    console.error("Failed to fetch survey stats:", error);
    return {
      totalResponses: 0,
      uniqueSchools: 0,
      anonymousCount: 0,
      attendanceUp: { total: 0, aLot: 0, aLittle: 0 },
      confidenceImproved: { total: 0, aLot: 0, aLittle: 0 },
      avgRecommend: 0,
      avgOverall: 0,
      avgRatings: {},
      parentRequests: {},
      stories: [],
    };
  }

  const responses = data || [];
  const totalResponses = responses.length;
  const uniqueSchools = new Set(responses.map((r) => r.school).filter(Boolean)).size;
  const anonymousCount = responses.filter((r) => r.is_anonymous).length;

  // Attendance stats
  let attendanceTotal = 0;
  let attendanceALot = 0;
  let attendanceALittle = 0;

  // Confidence stats
  let confidenceTotal = 0;
  let confidenceALot = 0;
  let confidenceALittle = 0;

  // Recommend scores
  let recommendSum = 0;
  let recommendCount = 0;

  // Overall scores
  let overallSum = 0;
  let overallCount = 0;

  // Ratings breakdown
  const ratingsSum = {};
  const ratingsCount = {};

  // Parent requests
  const parentRequests = {};

  // Stories
  const stories = [];

  for (const response of responses) {
    const answers = response.answers || {};

    // Attendance
    if (answers.attendance) {
      if (answers.attendance === "Gone up a lot") {
        attendanceALot++;
        attendanceTotal++;
      } else if (answers.attendance === "Gone up a little") {
        attendanceALittle++;
        attendanceTotal++;
      }
    }

    // Confidence
    if (answers.confidence) {
      if (answers.confidence === "Yes, a lot") {
        confidenceALot++;
        confidenceTotal++;
      } else if (answers.confidence === "A little") {
        confidenceALittle++;
        confidenceTotal++;
      }
    }

    // Recommend
    if (typeof answers.recommend === "number") {
      recommendSum += answers.recommend;
      recommendCount++;
    }

    // Overall
    if (typeof answers.overall === "number") {
      overallSum += answers.overall;
      overallCount++;
    }

    // Grid ratings
    if (answers.ratings && typeof answers.ratings === "object") {
      for (const [row, value] of Object.entries(answers.ratings)) {
        if (typeof value === "number") {
          ratingsSum[row] = (ratingsSum[row] || 0) + value;
          ratingsCount[row] = (ratingsCount[row] || 0) + 1;
        }
      }
    }

    // Parent requests
    if (Array.isArray(answers.parent_requests)) {
      for (const request of answers.parent_requests) {
        parentRequests[request] = (parentRequests[request] || 0) + 1;
      }
    }

    // Stories
    if (answers.story && answers.story.trim()) {
      stories.push({
        id: response.id,
        school: response.school || "Anonymous",
        story: answers.story,
        submittedAt: response.submitted_at,
      });
    }
  }

  // Calculate averages
  const avgRecommend = recommendCount > 0 ? (recommendSum / recommendCount).toFixed(1) : 0;
  const avgOverall = overallCount > 0 ? (overallSum / overallCount).toFixed(1) : 0;

  const avgRatings = { overall: parseFloat(avgOverall) };
  for (const [row, sum] of Object.entries(ratingsSum)) {
    avgRatings[row] = parseFloat((sum / ratingsCount[row]).toFixed(1));
  }

  // Sort parent requests by count
  const sortedParentRequests = Object.entries(parentRequests)
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  return {
    totalResponses,
    uniqueSchools,
    anonymousCount,
    attendanceUp: {
      total: attendanceTotal,
      aLot: attendanceALot,
      aLittle: attendanceALittle,
    },
    confidenceImproved: {
      total: confidenceTotal,
      aLot: confidenceALot,
      aLittle: confidenceALittle,
    },
    avgRecommend: parseFloat(avgRecommend),
    avgOverall: parseFloat(avgOverall),
    avgRatings,
    parentRequests: sortedParentRequests,
    stories: stories.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)),
  };
}

/**
 * Export survey responses to CSV format
 */
export function exportSurveyToCSV(responses, survey) {
  // Build header row
  const headers = ["School", "Role", "Name", "Anonymous", "Submitted At"];

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
    const row = [
      response.school || "Prefer not to say",
      answers.role || "",
      answers.name || "Anonymous",
      response.is_anonymous ? "Yes" : "No",
      new Date(response.submitted_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
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
