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
  addInstructorToDistrict as addInstructorToDistrictQuery,
  removeInstructorFromDistrict as removeInstructorFromDistrictQuery,
  createHoliday as createHolidayQuery,
  deleteHoliday as deleteHolidayQuery,
  createHolidaysBulk as createHolidaysBulkQuery,
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

export async function createClassAction(schoolId, days, time, startDate = null, numWeeks = 8) {
  const result = await createClassQuery(schoolId, days, time, startDate, numWeeks);
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

export async function addInstructorToDistrictAction(profileId, districtId) {
  const result = await addInstructorToDistrictQuery(profileId, districtId);
  revalidatePath("/admin/schedule");
  return result;
}

export async function removeInstructorFromDistrictAction(profileId, districtId) {
  await removeInstructorFromDistrictQuery(profileId, districtId);
  revalidatePath("/admin/schedule");
}

export async function createHolidayAction(date, name, districtId = null) {
  const result = await createHolidayQuery(date, name, districtId);
  revalidatePath("/admin/schedule");
  return result;
}

export async function deleteHolidayAction(id) {
  await deleteHolidayQuery(id);
  revalidatePath("/admin/schedule");
}

export async function addTypicalHolidaysAction(schoolYear) {
  // schoolYear is the starting year, e.g., 2024 for 2024-2025 school year
  const holidays = generateTypicalSchoolHolidays(schoolYear);
  const result = await createHolidaysBulkQuery(holidays);
  revalidatePath("/admin/schedule");
  return result;
}

/**
 * Generate typical US school holidays for a given school year
 * @param {number} startYear - The starting year of the school year (e.g., 2024 for 2024-2025)
 * @returns {Array} Array of holiday objects with date, name, district_id (null for global)
 */
function generateTypicalSchoolHolidays(startYear) {
  const endYear = startYear + 1;
  const holidays = [];

  // Helper to get nth occurrence of a weekday in a month
  // weekday: 0 = Sunday, 1 = Monday, etc.
  const getNthWeekdayOfMonth = (year, month, weekday, n) => {
    const firstDay = new Date(year, month, 1);
    let dayOffset = (weekday - firstDay.getDay() + 7) % 7;
    const date = 1 + dayOffset + (n - 1) * 7;
    return new Date(year, month, date);
  };

  // Helper to get last occurrence of a weekday in a month
  const getLastWeekdayOfMonth = (year, month, weekday) => {
    const lastDay = new Date(year, month + 1, 0);
    let dayOffset = (lastDay.getDay() - weekday + 7) % 7;
    return new Date(year, month, lastDay.getDate() - dayOffset);
  };

  // Format date as YYYY-MM-DD
  const formatDate = (date) => {
    return date.toISOString().split("T")[0];
  };

  // Labor Day - First Monday of September
  const laborDay = getNthWeekdayOfMonth(startYear, 8, 1, 1);
  holidays.push({ date: formatDate(laborDay), name: "Labor Day", district_id: null });

  // Columbus Day / Indigenous Peoples' Day - Second Monday of October
  const columbusDay = getNthWeekdayOfMonth(startYear, 9, 1, 2);
  holidays.push({ date: formatDate(columbusDay), name: "Indigenous Peoples' Day", district_id: null });

  // Veterans Day - November 11 (or observed day if weekend)
  let veteransDay = new Date(startYear, 10, 11);
  if (veteransDay.getDay() === 0) veteransDay.setDate(12); // Sunday -> Monday
  if (veteransDay.getDay() === 6) veteransDay.setDate(10); // Saturday -> Friday
  holidays.push({ date: formatDate(veteransDay), name: "Veterans Day", district_id: null });

  // Thanksgiving Break - Fourth Thursday of November + Friday
  const thanksgiving = getNthWeekdayOfMonth(startYear, 10, 4, 4);
  holidays.push({ date: formatDate(thanksgiving), name: "Thanksgiving Day", district_id: null });
  const dayAfterThanksgiving = new Date(thanksgiving);
  dayAfterThanksgiving.setDate(dayAfterThanksgiving.getDate() + 1);
  holidays.push({ date: formatDate(dayAfterThanksgiving), name: "Day After Thanksgiving", district_id: null });

  // Winter Break - Dec 23 through Jan 3 (typical, schools vary)
  for (let d = 23; d <= 31; d++) {
    holidays.push({ date: `${startYear}-12-${String(d).padStart(2, "0")}`, name: "Winter Break", district_id: null });
  }
  for (let d = 1; d <= 3; d++) {
    holidays.push({ date: `${endYear}-01-${String(d).padStart(2, "0")}`, name: "Winter Break", district_id: null });
  }

  // MLK Day - Third Monday of January
  const mlkDay = getNthWeekdayOfMonth(endYear, 0, 1, 3);
  holidays.push({ date: formatDate(mlkDay), name: "Martin Luther King Jr. Day", district_id: null });

  // Presidents' Day - Third Monday of February
  const presidentsDay = getNthWeekdayOfMonth(endYear, 1, 1, 3);
  holidays.push({ date: formatDate(presidentsDay), name: "Presidents' Day", district_id: null });

  // Spring Break - Typically a week in March or April (using third week of March as default)
  // This varies significantly by district, so we'll add a common window
  const springBreakStart = getNthWeekdayOfMonth(endYear, 2, 1, 3); // Third Monday of March
  for (let i = 0; i < 5; i++) {
    const d = new Date(springBreakStart);
    d.setDate(d.getDate() + i);
    holidays.push({ date: formatDate(d), name: "Spring Break", district_id: null });
  }

  // Memorial Day - Last Monday of May
  const memorialDay = getLastWeekdayOfMonth(endYear, 4, 1);
  holidays.push({ date: formatDate(memorialDay), name: "Memorial Day", district_id: null });

  return holidays;
}
