import { redirect } from "next/navigation";
import { getInstructorDetail } from "@/lib/instructors/queries";
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

  return <InstructorDetail instructor={instructor} />;
}
