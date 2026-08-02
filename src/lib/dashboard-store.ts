"use client";

import { useState, useEffect } from "react";

const SAVED_STORAGE_KEY = "notevault_saved_resources";
const COURSE_PREF_KEY = "notevault_student_course_pref";

export interface SavedItem {
  id: string;
  type: "resource" | "subject";
  title: string;
  subjectName?: string;
  resourceType?: "NOTES" | "PYQ" | "ANSWER_KEY" | "SYLLABUS";
  url: string;
  savedAt: string;
}

export interface StudentCoursePref {
  programId: string;
  programName: string;
  programSlug: string;
  termId: string;
  termName: string;
}

export function getSavedItems(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveItem(item: Omit<SavedItem, "savedAt">) {
  if (typeof window === "undefined") return;
  const items = getSavedItems();
  if (items.some((i) => i.id === item.id)) return;
  const next = [{ ...item, savedAt: new Date().toISOString() }, ...items];
  localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("notevault_saved_updated"));
}

export function removeSavedItem(id: string) {
  if (typeof window === "undefined") return;
  const items = getSavedItems();
  const next = items.filter((i) => i.id !== id);
  localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("notevault_saved_updated"));
}

export function isItemSaved(id: string): boolean {
  if (typeof window === "undefined") return false;
  return getSavedItems().some((i) => i.id === id);
}

export function useSavedItems() {
  const [saved, setSaved] = useState<SavedItem[]>(() => getSavedItems());

  useEffect(() => {
    function handleUpdate() {
      setSaved(getSavedItems());
    }

    window.addEventListener("notevault_saved_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("notevault_saved_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return { saved, saveItem, removeSavedItem, isItemSaved };
}

export function getCoursePref(): StudentCoursePref | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COURSE_PREF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCoursePref(pref: StudentCoursePref) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COURSE_PREF_KEY, JSON.stringify(pref));
  window.dispatchEvent(new Event("notevault_course_pref_updated"));
}

export function useCoursePref(defaultPref?: StudentCoursePref | null) {
  const [pref, setPref] = useState<StudentCoursePref | null>(() => getCoursePref() || defaultPref || null);

  useEffect(() => {
    function handleUpdate() {
      const updated = getCoursePref();
      if (updated) setPref(updated);
    }

    window.addEventListener("notevault_course_pref_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("notevault_course_pref_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return { pref, setCoursePref };
}
