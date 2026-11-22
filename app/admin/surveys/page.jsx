import { listSurveys } from "@/lib/surveys";
import { getAllSurveysStats } from "@/lib/surveys/queries";
import SurveysListClient from "./SurveysListClient";
import styles from "./page.module.css";

export const metadata = {
  title: "Surveys | Admin | Shape Your Destiny",
};

export default async function SurveysPage() {
  const surveys = listSurveys();
  const allStats = await getAllSurveysStats();

  // Enrich surveys with stats
  const enrichedSurveys = surveys.map((survey) => {
    const stats = allStats[survey.slug] || {};

    return {
      slug: survey.slug,
      title: survey.title,
      responseCount: stats.totalResponses || 0,
      avgOverall: stats.avgOverall,
      districtCount: stats.districtCount || 0,
    };
  });

  return (
    <div className={styles.page}>
      <SurveysListClient surveys={enrichedSurveys} />
    </div>
  );
}
