import { supabase } from "./supabase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export async function saveHousingPreferences(token: string, preferences: any) {
  const res = await fetch(`${API_BASE_URL}/preferences/housing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      budget_min: preferences.budgetRange[0],
      budget_max: preferences.budgetRange[1],
      move_in_date: preferences.moveInDate,
      move_out_date: null, // or derive from leaseLength if needed
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to save housing preferences");
  }
}

export async function saveLifestylePreferences(token: string, preferences: any) {
  const res = await fetch(`${API_BASE_URL}/preferences/lifestyle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      cleanliness_level: preferences.cleanlinessLevel,
      noise_tolerance: mapSocialVibeToNoise(preferences.socialVibe),
      sleep_schedule: mapSleepSchedule(preferences.sleepSchedule),
      cooking_habits: "sometimes", // (or add more fields later)
      diet: "none",
      pets: preferences.hasPets.length ? "has_pets" : "no_pets",
      sharing_items: "sometimes",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to save lifestyle preferences");
  }
}

// 🧩 mapping helpers (adjust as your schema evolves)
function mapSocialVibeToNoise(vibe: string): "quiet" | "moderate" | "loud" {
  if (vibe.includes("Quiet")) return "quiet";
  if (vibe.includes("Balanced")) return "moderate";
  return "loud";
}

function mapSleepSchedule(schedule: string): "early" | "late" | "flexible" {
  if (schedule === "Early bird") return "early";
  if (schedule === "Night owl") return "late";
  return "flexible";
}
