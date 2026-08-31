import { getInstructorSchools } from "@/lib/incidents/queries";
import IncidentReportForm from "./IncidentReportForm";
import styles from "./page.module.css";

export const metadata = {
  title: "Report an Incident | Shape Your Destiny",
};

export default async function IncidentReportPage() {
  const schools = await getInstructorSchools();

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <h1>Report an Incident</h1>
        <p>File this as soon as possible after anything happens, even if it seems minor.</p>
      </div>

      <IncidentReportForm schools={schools} />
    </div>
  );
}
