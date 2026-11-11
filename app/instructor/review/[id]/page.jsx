import { notFound } from "next/navigation";
import { getMyReview } from "@/lib/instructor/session-reviews";
import ReviewClient from "./ReviewClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const review = await getMyReview(id);

  if (!review) {
    return { title: "Review Not Found" };
  }

  const schoolName = review.classes?.schools?.name || "Session";
  return {
    title: `${schoolName} Session Review`,
  };
}

export default async function ReviewPage({ params }) {
  const { id } = await params;
  const review = await getMyReview(id);

  if (!review) {
    notFound();
  }

  // If already submitted, redirect or show thank you
  if (review.status === "submitted") {
    return <ReviewClient review={review} />;
  }

  return <ReviewClient review={review} />;
}
