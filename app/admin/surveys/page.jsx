import { listSurveys, getSurveyStatus } from "@/lib/surveys";
import { getAllSurveysStats } from "@/lib/surveys/queries";
import { countRequiredQuestions } from "@/lib/surveys";
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
    const status = getSurveyStatus(survey);
    const questionCount = countRequiredQuestions(survey);

    return {
      ...survey,
      status,
      responseCount: stats.totalResponses || 0,
      avgOverall: stats.avgOverall,
      avgRecommend: stats.avgRecommend,
      lastResponseAt: stats.lastResponseAt,
      questionCount,
    };
  });

  return (
    <div className={styles.page}>
      <SurveysListClient surveys={enrichedSurveys} />
    </div>
  );
}
