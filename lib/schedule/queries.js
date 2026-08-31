import { createClient } from "@/lib/supabase/server";

/**
 * Fetch all schedule data with nested structure:
 * districts -> schools -> classes -> assignments (with profile info)
 */
export async function getScheduleData() {
  const supabase = await createClient();

  // Fetch districts
  const { data: districts, error: districtsError } = await supabase
    .from("districts")
    .select("id, name, color, created_at")
    .order("name");

  if (districtsError) {
    console.error("Error fetching districts:", districtsError);
    return { districts: [], instructors: [] };
  }

  // Fetch schools with district_id
  const { data: schools, error: schoolsError } = await supabase
    .from("schools")
    .select("id, district_id, name, address, created_at")
    .order("name");

  if (schoolsError) {
    console.error("Error fetching schools:", schoolsError);
    return { districts: districts || [], instructors: [] };
  }

  // Fetch classes with school_id
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, school_id, days, time, is_review_day, start_date, num_weeks, program, target_sessions, created_at")
    .order("time");

  if (classesError) {
    console.error("Error fetching classes:", classesError);
  }

  // Fetch assignments with profile info
  const { data: assignments, error: assignmentsError } = await supabase
    .from("class_assignments")
    .select(`
      id,
      class_id,
      profile_id,
      slot_type,
      profiles:profile_id (
        id,
        full_name,
        color,
        district_id
      )
    `);

  if (assignmentsError) {
    console.error("Error fetching assignments:", assignmentsError);
  }

  // Fetch all instructors for the sidebar pool
  const { data: instructors, error: instructorsError } = await supabase
    .from("profiles")
    .select("id, full_name, color, role")
    .in("role", ["instructor", "admin"])
    .order("full_name");

  if (instructorsError) {
    console.error("Error fetching instructors:", instructorsError);
  }

  // Fetch instructor-district relationships
  const { data: instructorDistricts, error: idError } = await supabase
    .from("instructor_districts")
    .select("profile_id, district_id");

  if (idError) {
    console.error("Error fetching instructor districts:", idError);
  }

  // Fetch holidays
  const { data: holidays, error: holidaysError } = await supabase
    .from("holidays")
    .select("id, date, name, district_id, school_id, created_at")
    .order("date");

  if (holidaysError) {
    console.error("Error fetching holidays:", holidaysError);
  }

  // Fetch program off days
  const { data: programOffDays, error: programOffDaysError } = await supabase
    .from("program_off_days")
    .select("id, program, date, reason, created_at")
    .order("date");

  if (programOffDaysError) {
    console.error("Error fetching program off days:", programOffDaysError);
  }

  // Group districts by instructor
  const districtsByInstructor = {};
  (instructorDistricts || []).forEach((id) => {
    if (!districtsByInstructor[id.profile_id]) {
      districtsByInstructor[id.profile_id] = [];
    }
    districtsByInstructor[id.profile_id].push(id.district_id);
  });

  // Attach districts to instructors
  const instructorsWithDistricts = (instructors || []).map((instructor) => ({
    ...instructor,
    district_ids: districtsByInstructor[instructor.id] || [],
  }));

  // Build nested structure
  const classesById = {};
  (classes || []).forEach((cls) => {
    classesById[cls.id] = {
      ...cls,
      assignments: [],
    };
  });

  // Attach assignments to classes
  (assignments || []).forEach((assignment) => {
    if (classesById[assignment.class_id]) {
      classesById[assignment.class_id].assignments.push({
        id: assignment.id,
        slotType: assignment.slot_type,
        profile: assignment.profiles,
      });
    }
  });

  // Build schools with nested classes
  const schoolsById = {};
  (schools || []).forEach((school) => {
    schoolsById[school.id] = {
      ...school,
      classes: [],
    };
  });

  // Attach classes to schools
  Object.values(classesById).forEach((cls) => {
    if (schoolsById[cls.school_id]) {
      schoolsById[cls.school_id].classes.push(cls);
    }
  });

  // Build districts with nested schools
  const result = (districts || []).map((district) => ({
    ...district,
    schools: Object.values(schoolsById).filter(
      (school) => school.district_id === district.id
    ),
  }));

  return {
    districts: result,
    instructors: instructorsWithDistricts,
    holidays: holidays || [],
    programOffDays: programOffDays || [],
  };
}

/**
 * Assign an instructor to a class slot
 */
export async function assignInstructor(classId, profileId, slotType) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_assignments")
    .upsert(
      {
        class_id: classId,
        profile_id: profileId,
        slot_type: slotType,
      },
      {
        onConflict: "class_id,slot_type",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error assigning instructor:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Unassign an instructor from a class slot
 */
export async function unassignInstructor(classId, slotType) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("class_assignments")
    .delete()
    .eq("class_id", classId)
    .eq("slot_type", slotType);

  if (error) {
    console.error("Error unassigning instructor:", error);
    throw new Error(error.message);
  }

  return { success: true };
}

/**
 * Create a new district
 */
export async function createDistrict(name, color) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("districts")
    .insert({ name, color })
    .select()
    .single();

  if (error) {
    console.error("Error creating district:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Create a new school
 */
export async function createSchool(districtId, name, address = null) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("schools")
    .insert({ district_id: districtId, name, address })
    .select()
    .single();

  if (error) {
    console.error("Error creating school:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Create a new class
 */
export async function createClass(schoolId, days, time, startDate = null, numWeeks = 8) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .insert({
      school_id: schoolId,
      days,
      time,
      start_date: startDate,
      num_weeks: numWeeks,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating class:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Create a new class with program and target_sessions support
 * This is the extended version used by the Add Class modal
 */
export async function createClassWithProgram({
  schoolId,
  program,
  days,
  time,
  startDate,
  targetSessions,
  isReviewDay = false,
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .insert({
      school_id: schoolId,
      program,
      days,
      time,
      start_date: startDate,
      target_sessions: targetSessions,
      is_review_day: isReviewDay,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating class:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Toggle review day status for a class
 */
export async function toggleReviewDay(classId, value) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .update({ is_review_day: value })
    .eq("id", classId)
    .select()
    .single();

  if (error) {
    console.error("Error toggling review day:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Delete a district (cascades to schools, classes, assignments)
 */
export async function deleteDistrict(id) {
  const supabase = await createClient();

  const { error } = await supabase.from("districts").delete().eq("id", id);

  if (error) {
    console.error("Error deleting district:", error);
    throw new Error(error.message);
  }

  return { success: true };
}

/**
 * Delete a school (cascades to classes, assignments)
 */
export async function deleteSchool(id) {
  const supabase = await createClient();

  const { error } = await supabase.from("schools").delete().eq("id", id);

  if (error) {
    console.error("Error deleting school:", error);
    throw new Error(error.message);
  }

  return { success: true };
}

/**
 * Update an existing school
 */
export async function updateSchool(id, updates) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("schools")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating school:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Update an existing class
 */
export async function updateClass(id, updates) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating class:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Delete a class (cascades to assignments)
 */
export async function deleteClass(id) {
  const supabase = await createClient();

  const { error } = await supabase.from("classes").delete().eq("id", id);

  if (error) {
    console.error("Error deleting class:", error);
    throw new Error(error.message);
  }

  return { success: true };
}

/**
 * Add instructor to a district
 */
export async function addInstructorToDistrict(profileId, districtId) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("instructor_districts")
    .insert({ profile_id: profileId, district_id: districtId })
    .select()
    .single();

  if (error) {
    // Ignore duplicate errors
    if (error.code === "23505") {
      return { success: true, duplicate: true };
    }
    console.error("Error adding instructor to district:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Remove instructor from a district
 */
export async function removeInstructorFromDistrict(profileId, districtId) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("instructor_districts")
    .delete()
    .eq("profile_id", profileId)
    .eq("district_id", districtId);

  if (error) {
    console.error("Error removing instructor from district:", error);
    throw new Error(error.message);
  }

  return { success: true };
}

/**
 * Create a new holiday
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} name - Holiday name
 * @param {string|null} districtId - District ID (null = global)
 * @param {string|null} schoolId - School ID (null = applies to all schools in scope)
 */
export async function createHoliday(date, name, districtId = null, schoolId = null) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("holidays")
    .insert({
      date,
      name,
      district_id: districtId,
      school_id: schoolId,
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate date
    if (error.code === "23505") {
      throw new Error("A holiday already exists on this date for this scope");
    }
    console.error("Error creating holiday:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Delete a holiday
 */
export async function deleteHoliday(id) {
  const supabase = await createClient();

  const { error } = await supabase.from("holidays").delete().eq("id", id);

  if (error) {
    console.error("Error deleting holiday:", error);
    throw new Error(error.message);
  }

  return { success: true };
}

/**
 * Bulk create holidays (for auto-adding typical school holidays)
 */
export async function createHolidaysBulk(holidays) {
  const supabase = await createClient();

  // Filter out holidays that might already exist
  // Add school_id: null for global holidays
  const holidaysWithSchoolId = holidays.map(h => ({
    ...h,
    school_id: h.school_id ?? null,
  }));

  const { data, error } = await supabase
    .from("holidays")
    .upsert(holidaysWithSchoolId, {
      onConflict: "date,district_id,school_id",
      ignoreDuplicates: true,
    })
    .select();

  if (error) {
    console.error("Error creating holidays:", error);
    throw new Error(error.message);
  }

  return data;
}
