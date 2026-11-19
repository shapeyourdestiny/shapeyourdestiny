import { notFound } from "next/navigation";
import { getSurvey, getSurveyStatus, countRequiredQuestions } from "@/lib/surveys";
import { getSurveyStats, getSurveyResponses } from "@/lib/surveys/queries";
import SurveyResultsClient from "./SurveyResultsClient";
import styles from "./page.module.css";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const survey = getSurvey(slug);
  if (!survey) return { title: "Survey Not Found" };
  return { title: `${survey.title} | Admin | Shape Your Destiny` };
}

export default async function SurveyResultsPage({ params }) {
  const { slug } = await params;
  const survey = getSurvey(slug);

  if (!survey) {
    notFound();
  }

  const status = getSurveyStatus(survey);
  const questionCount = countRequiredQuestions(survey);
  const [stats, responses] = await Promise.all([
    getSurveyStats(slug, survey),
    getSurveyResponses(slug),
  ]);

  const enrichedSurvey = {
    ...survey,
    status,
    questionCount,
  };

  return (
    <div className={styles.page}>
      <SurveyResultsClient
        survey={enrichedSurvey}
        stats={stats}
        responses={responses}
      />
    </div>
  );
}
