import { getInstructorsList } from "@/lib/instructors/queries";
import styles from "./page.module.css";
import InstructorsList from "./InstructorsList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Instructors | Admin | Shape Your Destiny",
};

export default async function AdminInstructorsPage() {
  const instructors = await getInstructorsList();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Instructors</h1>
        <p>Every instructor across every district.</p>
      </div>

      {instructors.length > 0 ? (
        <InstructorsList instructors={instructors} />
      ) : (
        <div className={styles.emptyCard}>
          <p>No instructors yet. Send an invite to get started.</p>
          <a href="/admin/dashboard" className={styles.link}>
            Go to Invite Codes
          </a>
        </div>
      )}
    </div>
  );
}
