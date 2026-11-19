import { getSurveyResponses, getSurveyStats } from "@/lib/surveys/queries";
import soccerFeedbackSurvey from "@/lib/surveys/soccer-feedback";
import SurveyAdmin from "./SurveyAdmin";
import styles from "./page.module.css";

export const metadata = {
  title: "Soccer Feedback | Surveys | Admin",
};

export default async function SoccerFeedbackAdminPage() {
  const [responses, stats] = await Promise.all([
    getSurveyResponses("soccer-feedback"),
    getSurveyStats("soccer-feedback"),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shapeyourdestiny.co";
  const surveyUrl = `${baseUrl}/survey/soccer-feedback`;

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div className={styles.pageHeadLeft}>
          <h1>Intramural Soccer: school feedback</h1>
          <p>
            {stats.totalResponses} response{stats.totalResponses !== 1 ? "s" : ""} ·{" "}
            {stats.uniqueSchools} school{stats.uniqueSchools !== 1 ? "s" : ""} ·{" "}
            {stats.anonymousCount} anonymous
          </p>
        </div>
      </div>

      <SurveyAdmin
        initialResponses={responses}
        initialStats={stats}
        survey={soccerFeedbackSurvey}
        surveyUrl={surveyUrl}
      />
    </div>
  );
}
