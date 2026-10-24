import { getInstructorsList } from "@/lib/instructors/queries";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";
import InstructorsList from "./InstructorsList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Instructors | Admin | Shape Your Destiny",
};

export default async function AdminInstructorsPage() {
  const supabase = await createClient();

  const [instructors, districtsResult] = await Promise.all([
    getInstructorsList(),
    supabase.from("districts").select("id, name, color").order("name"),
  ]);

  const districts = districtsResult?.data || [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Instructors</h1>
        <p>Every instructor across every district.</p>
      </div>

      {instructors.length > 0 ? (
        <InstructorsList instructors={instructors} districts={districts} />
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
