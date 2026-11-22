import { notFound } from "next/navigation";
import { getSurvey } from "@/lib/surveys";
import { getSurveyResponses } from "@/lib/surveys/queries";
import { getSendByLinkSlug } from "@/lib/surveys/sends";
import DistrictPageClient from "./DistrictPageClient";
import styles from "../../page.module.css";

export async function generateMetadata({ params }) {
  const { slug, district } = await params;
  const survey = getSurvey(slug);
  const send = await getSendByLinkSlug(slug, district);

  if (!survey || !send) {
    return { title: "Not Found" };
  }

  const districtName = send.districts?.name || district;
  return {
    title: `${districtName} | ${survey.title} | Admin`,
  };
}

export default async function DistrictPage({ params }) {
  const { slug, district: districtSlug } = await params;
  const survey = getSurvey(slug);

  if (!survey) {
    notFound();
  }

  const send = await getSendByLinkSlug(slug, districtSlug);

  if (!send) {
    notFound();
  }

  // Fetch responses for this district only
  const responses = await getSurveyResponses(slug, { districtId: send.district_id });

  // Calculate stats from responses
  const stats = calculateStats(responses, survey);

  return (
    <div className={styles.page}>
      <DistrictPageClient
        survey={{
          slug: survey.slug,
          title: survey.title,
          period: survey.period,
          sections: survey.sections,
        }}
        send={{
          id: send.id,
          districtId: send.district_id,
          districtName: send.districts?.name || districtSlug,
          linkSlug: send.link_slug,
          schools: send.schools || [],
          createdAt: send.created_at,
        }}
        responses={responses}
        stats={stats}
      />
    </div>
  );
}

function calculateStats(responses, survey) {
  const stats = {
    totalResponses: responses.length,
    schoolsAnswered: new Set(),
    overallSum: 0,
    overallCount: 0,
    recommendSum: 0,
    recommendCount: 0,
    gridRatings: {},
  };

  // Find grid question for rating rows
  let gridQuestion = null;
  for (const section of survey.sections || []) {
    for (const q of section.questions) {
      if (q.type === "grid") {
        gridQuestion = q;
        for (const row of q.rows) {
          stats.gridRatings[row] = { sum: 0, count: 0 };
        }
        break;
      }
    }
    if (gridQuestion) break;
  }

  for (const response of responses) {
    const answers = response.answers || {};

    if (response.school) {
      stats.schoolsAnswered.add(response.school);
    }

    if (typeof answers.overall === "number") {
      stats.overallSum += answers.overall;
      stats.overallCount++;
    }

    if (typeof answers.recommend === "number") {
      stats.recommendSum += answers.recommend;
      stats.recommendCount++;
    }

    // Grid ratings
    if (answers.ratings && typeof answers.ratings === "object") {
      for (const [row, value] of Object.entries(answers.ratings)) {
        if (typeof value === "number" && stats.gridRatings[row]) {
          stats.gridRatings[row].sum += value;
          stats.gridRatings[row].count++;
        }
      }
    }
  }

  // Calculate averages
  stats.avgOverall = stats.overallCount > 0
    ? parseFloat((stats.overallSum / stats.overallCount).toFixed(1))
    : null;

  stats.avgRecommend = stats.recommendCount > 0
    ? parseFloat((stats.recommendSum / stats.recommendCount).toFixed(1))
    : null;

  stats.schoolsAnsweredCount = stats.schoolsAnswered.size;

  // Grid averages
  stats.gridAverages = [];
  for (const [row, data] of Object.entries(stats.gridRatings)) {
    if (data.count > 0) {
      stats.gridAverages.push({
        label: row,
        avg: parseFloat((data.sum / data.count).toFixed(1)),
      });
    }
  }
  // Sort by average, highest first
  stats.gridAverages.sort((a, b) => b.avg - a.avg);

  return stats;
}
