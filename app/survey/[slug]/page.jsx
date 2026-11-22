import { notFound } from "next/navigation";
import { getSurvey } from "@/lib/surveys";
import styles from "./survey.module.css";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const survey = getSurvey(slug);

  if (!survey) {
    return { title: "Survey Not Found" };
  }

  return {
    title: `${survey.title} - Shape Your Destiny`,
    description: survey.intro,
    robots: { index: false, follow: false },
  };
}

export default async function SurveyPage({ params }) {
  const { slug } = await params;
  const survey = getSurvey(slug);

  if (!survey) {
    notFound();
  }

  // Base URL without district - show message to use district link
  return (
    <div className={styles.surveyContainer}>
      <div className={styles.districtRequired}>
        <div className={styles.districtRequiredCard}>
          <h1>Survey Link Required</h1>
          <p>This survey is shared by link. Please use the link from your school district.</p>
          <p className={styles.districtRequiredSmall}>
            If you received a link and it&apos;s not working, please contact your school administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
