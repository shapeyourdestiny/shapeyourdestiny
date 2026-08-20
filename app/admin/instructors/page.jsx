import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const metadata = {
  title: "Instructors | Admin | Shape Your Destiny",
};

export default async function AdminInstructorsPage() {
  const supabase = await createClient();

  const { data: instructors } = await supabase
    .from("profiles")
    .select("id, full_name, created_at")
    .eq("role", "instructor")
    .order("created_at", { ascending: false });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Instructors</h1>
        <p>View all registered instructors.</p>
      </div>

      <div className={styles.tableCard}>
        {instructors && instructors.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {instructors.map((instructor) => (
                  <tr key={instructor.id}>
                    <td className={styles.name}>{instructor.full_name}</td>
                    <td className={styles.date}>
                      {new Date(instructor.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>
            <p>No instructors yet. Send an invite to get started.</p>
            <a href="/admin/dashboard" className={styles.link}>
              Go to Invite Codes
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
