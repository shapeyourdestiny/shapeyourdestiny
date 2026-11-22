import { notFound } from "next/navigation";
import { getSurvey } from "@/lib/surveys";
import { getSurveyStats } from "@/lib/surveys/queries";
import { getSurveySends, getAllDistricts } from "@/lib/surveys/sends";
import SurveyPageClient from "./SurveyPageClient";
import styles from "../page.module.css";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const survey = getSurvey(slug);

  if (!survey) {
    return { title: "Survey Not Found" };
  }

  return {
    title: `${survey.title} | Surveys | Admin`,
  };
}

export default async function SurveyPage({ params }) {
  const { slug } = await params;
  const survey = getSurvey(slug);

  if (!survey) {
    notFound();
  }

  const [stats, sends, allDistricts] = await Promise.all([
    getSurveyStats(slug, survey),
    getSurveySends(slug),
    getAllDistricts(),
  ]);

  // Calculate stats per send
  const sendsWithStats = sends.map((send) => {
    const districtStats = stats.districtStats?.[send.district_id] || {};
    return {
      id: send.id,
      districtId: send.district_id,
      districtName: send.districts?.name || send.link_slug,
      linkSlug: send.link_slug,
      schools: send.schools || [],
      createdAt: send.created_at,
      responseCount: districtStats.count || 0,
      avgOverall: districtStats.avgOverall,
    };
  });

  return (
    <div className={styles.page}>
      <SurveyPageClient
        survey={{
          slug: survey.slug,
          title: survey.title,
          period: survey.period,
        }}
        sends={sendsWithStats}
        allDistricts={allDistricts}
        totalResponses={stats.totalResponses}
      />
    </div>
  );
}
