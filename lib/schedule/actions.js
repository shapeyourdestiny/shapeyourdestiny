"use server";

import {
  assignInstructor as assignInstructorQuery,
  unassignInstructor as unassignInstructorQuery,
  createDistrict as createDistrictQuery,
  createSchool as createSchoolQuery,
  createClass as createClassQuery,
  toggleReviewDay as toggleReviewDayQuery,
  deleteDistrict as deleteDistrictQuery,
  deleteSchool as deleteSchoolQuery,
  deleteClass as deleteClassQuery,
  updateInstructorDistrict as updateInstructorDistrictQuery,
} from "./queries";
import { revalidatePath } from "next/cache";

export async function assignInstructorAction(classId, profileId, slotType) {
  await assignInstructorQuery(classId, profileId, slotType);
  revalidatePath("/admin/schedule");
}

export async function unassignInstructorAction(classId, slotType) {
  await unassignInstructorQuery(classId, slotType);
  revalidatePath("/admin/schedule");
}

export async function createDistrictAction(name, color) {
  const result = await createDistrictQuery(name, color);
  revalidatePath("/admin/schedule");
  return result;
}

export async function createSchoolAction(districtId, name) {
  const result = await createSchoolQuery(districtId, name);
  revalidatePath("/admin/schedule");
  return result;
}

export async function createClassAction(schoolId, days, time) {
  const result = await createClassQuery(schoolId, days, time);
  revalidatePath("/admin/schedule");
  return result;
}

export async function toggleReviewDayAction(classId, value) {
  const result = await toggleReviewDayQuery(classId, value);
  revalidatePath("/admin/schedule");
  return result;
}

export async function deleteDistrictAction(id) {
  await deleteDistrictQuery(id);
  revalidatePath("/admin/schedule");
}

export async function deleteSchoolAction(id) {
  await deleteSchoolQuery(id);
  revalidatePath("/admin/schedule");
}

export async function deleteClassAction(id) {
  await deleteClassQuery(id);
  revalidatePath("/admin/schedule");
}

export async function updateInstructorDistrictAction(profileId, districtId) {
  const result = await updateInstructorDistrictQuery(profileId, districtId);
  revalidatePath("/admin/schedule");
  return result;
}
