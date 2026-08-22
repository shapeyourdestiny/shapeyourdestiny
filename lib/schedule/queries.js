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
    .select("id, district_id, name, created_at")
    .order("name");

  if (schoolsError) {
    console.error("Error fetching schools:", schoolsError);
    return { districts: districts || [], instructors: [] };
  }

  // Fetch classes with school_id
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, school_id, days, time, is_review_day, created_at")
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
    .select("id, full_name, color, district_id, role")
    .in("role", ["instructor", "admin"])
    .order("full_name");

  if (instructorsError) {
    console.error("Error fetching instructors:", instructorsError);
  }

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
    instructors: instructors || [],
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
export async function createSchool(districtId, name) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("schools")
    .insert({ district_id: districtId, name })
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
export async function createClass(schoolId, days, time) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .insert({ school_id: schoolId, days, time })
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
 * Update instructor's district assignment
 */
export async function updateInstructorDistrict(profileId, districtId) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({ district_id: districtId })
    .eq("id", profileId)
    .select()
    .single();

  if (error) {
    console.error("Error updating instructor district:", error);
    throw new Error(error.message);
  }

  return data;
}
