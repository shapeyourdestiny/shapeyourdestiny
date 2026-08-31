import { getIncidentReports, getIncidentStats } from "@/lib/incidents/queries";
import IncidentReportsAdmin from "./IncidentReportsAdmin";
import styles from "./page.module.css";

export const metadata = {
  title: "Incident Reports | Admin | Shape Your Destiny",
};

export default async function IncidentReportsPage() {
  const [reports, stats] = await Promise.all([
    getIncidentReports(),
    getIncidentStats(),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <h1>Incident Reports</h1>
        <p>Everything instructors have filed, most recent first.</p>
      </div>

      <IncidentReportsAdmin initialReports={reports} initialStats={stats} />
    </div>
  );
}
