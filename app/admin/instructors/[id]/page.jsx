import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getInstructorDetail } from "@/lib/instructors/queries";
import { getInstructorFile } from "@/lib/instructor-notes/queries";
import InstructorDetail from "./InstructorDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const instructor = await getInstructorDetail(id);

  if (!instructor) {
    return { title: "Instructor Not Found | Admin" };
  }

  return {
    title: `${instructor.full_name} | Instructors | Admin`,
  };
}

export default async function InstructorDetailPage({ params }) {
  const { id } = await params;

  const instructor = await getInstructorDetail(id);

  if (!instructor) {
    redirect("/admin/instructors");
  }

  // Only fetch notes data if on notes tab (or fetch always for summary data)
  let notesData = null;
  try {
    notesData = await getInstructorFile(id);
  } catch (err) {
    console.error("Error fetching instructor file:", err);
    // Notes data may not exist if tables haven't been created yet
    notesData = {
      notes: [],
      attendance: [],
      summary: {
        pay: { currentRate: null, effectiveDate: null, previousRate: null },
        attendance: { total: 0, byReason: {}, withoutSub: 0 },
        reviews: { nextReviewDate: null, lastReviewDate: null, averageRating: null, isOverdue: false },
        latestDisciplinary: null,
        openFollowUpCount: 0,
        openFollowUps: [],
        expiringTraining: [],
      },
    };
  }

  return (
    <Suspense fallback={null}>
      <InstructorDetail instructor={instructor} notesData={notesData} />
    </Suspense>
  );
}
