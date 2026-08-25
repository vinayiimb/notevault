"use client";

import { useState, useEffect } from "react";
import type { UPSCQuestion, SubjectHierarchy } from "@/lib/upsc-data";

export function useUPSCData() {
  const [questions, setQuestions] = useState<UPSCQuestion[]>([]);
  const [hierarchy, setHierarchy] = useState<SubjectHierarchy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/data/upsc-pyq/upsc_questions_master.json").then((res) => res.json()),
      fetch("/data/upsc-pyq/upsc_topics_hierarchy.json").then((res) => res.json()),
    ])
      .then(([qData, hData]) => {
        setQuestions(qData);
        setHierarchy(hData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load UPSC data:", err);
        setLoading(false);
      });
  }, []);

  return { questions, hierarchy, loading };
}
