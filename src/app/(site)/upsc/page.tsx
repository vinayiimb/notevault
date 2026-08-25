"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ALL_YEARS, FilterState, filterQuestions, UPSCQuestion } from "@/lib/upsc-data";
import { useUPSCData } from "@/lib/use-upsc-data";
import { QuestionBodyRenderer } from "@/components/upsc/QuestionBodyRenderer";

export default function UPSCExactPage() {
  const { questions: ALL_UPSC_QUESTIONS, hierarchy: ALL_UPSC_HIERARCHY, loading } = useUPSCData();
  // Filters State
  const [selectedYears, setSelectedYears] = useState<string[]>([...ALL_YEARS]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedQuestionType, setSelectedQuestionType] = useState<string | null>(null);
  const [attemptStatus, setAttemptStatus] = useState<FilterState["attemptStatus"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<FilterState["mode"]>("practice");

  // Accordion open states in left sidebar
  const [openSections, setOpenSections] = useState({
    sections: false,
    topics: true,
    difficulty: false,
    bookmarks: false,
    attempt: false,
    timeSpent: false,
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showTopicDistribution, setShowTopicDistribution] = useState(false);

  // LocalStorage persistence
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState<
    Record<string, { selectedOption: string; isCorrect: boolean; timeSpent: number }>
  >({});
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);

  const numberStripRef = useRef<HTMLDivElement>(null);

  // Load saved state
  useEffect(() => {
    try {
      const savedBm = localStorage.getItem("upsc_pyq_bookmarks");
      if (savedBm) setBookmarks(new Set(JSON.parse(savedBm)));
      const savedAtt = localStorage.getItem("upsc_pyq_attempts");
      if (savedAtt) setAttempts(JSON.parse(savedAtt));
    } catch (e) {}
  }, []);

  // Timer per question
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpentSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [currentIndex]);

  const toggleBookmark = (qId: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      try {
        localStorage.setItem("upsc_pyq_bookmarks", JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });
  };

  const handleRecordAttempt = (
    qId: string,
    selectedOption: string,
    isCorrect: boolean
  ) => {
    setAttempts((prev) => {
      const next = {
        ...prev,
        [qId]: { selectedOption, isCorrect, timeSpent: timeSpentSeconds },
      };
      try {
        localStorage.setItem("upsc_pyq_attempts", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    setShowSolution(true);
  };

  // Filter logic
  const filters: FilterState = useMemo(
    () => ({
      searchQuery,
      selectedYears,
      selectedSubject,
      selectedTopic,
      selectedDifficulty,
      selectedQuestionType,
      attemptStatus,
      mode,
    }),
    [
      searchQuery,
      selectedYears,
      selectedSubject,
      selectedTopic,
      selectedDifficulty,
      selectedQuestionType,
      attemptStatus,
      mode,
    ]
  );

  const filteredQuestions = useMemo(() => {
    return filterQuestions(ALL_UPSC_QUESTIONS, filters, { bookmarks, attempts });
  }, [filters, bookmarks, attempts]);

  // Active Question
  const activeQuestion: UPSCQuestion | undefined =
    filteredQuestions[currentIndex] || filteredQuestions[0];

  // Reset showSolution when active question changes
  useEffect(() => {
    setShowSolution(false);
    setTimeSpentSeconds(0);
    // Scroll number strip to active item
    if (numberStripRef.current) {
      const activeEl = numberStripRef.current.querySelector(`[data-qindex="${currentIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [currentIndex, activeQuestion?.question_id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        if (currentIndex < filteredQuestions.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        }
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1);
        }
      } else if (e.key === "s" || e.key === "S") {
        setShowSolution((prev) => !prev);
      } else if (e.key === "b" || e.key === "B") {
        if (activeQuestion) toggleBookmark(activeQuestion.question_id);
      } else if (["1", "2", "3", "4"].includes(e.key) && activeQuestion?.options) {
        const optIdx = parseInt(e.key) - 1;
        if (activeQuestion.options[optIdx]) {
          const opt = activeQuestion.options[optIdx];
          const isCorrect = activeQuestion.correct_answer.toLowerCase().includes(opt.label.toLowerCase());
          handleRecordAttempt(activeQuestion.question_id, opt.label, isCorrect);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, filteredQuestions.length, activeQuestion]);

  const handleToggleYear = (year: string) => {
    setSelectedYears((prev) => {
      const next = prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year];
      return next;
    });
    setCurrentIndex(0);
  };

  const handleSelectAllYears = () => {
    if (selectedYears.length === ALL_YEARS.length) {
      setSelectedYears([]);
    } else {
      setSelectedYears([...ALL_YEARS]);
    }
    setCurrentIndex(0);
  };

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Difficulty badge colors
  const getDiffBadge = (diff: string) => {
    if (diff === "Easy") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
    if (diff === "Hard") return "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
  };

  const userAttempt = activeQuestion ? attempts[activeQuestion.question_id] : undefined;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090d16] text-slate-800 dark:text-slate-100 font-sans antialiased selection:bg-indigo-500/20 pb-20">
      
      {/* 1. Topmost Navbar Header */}
      <header className="bg-white dark:bg-[#0f172a] border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-40">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          
          {/* Top Left: Logo & Dropdown */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm shadow-xs">
              🏛️
            </div>
            <div className="flex items-center gap-1.5 cursor-pointer font-semibold text-sm text-slate-900 dark:text-slate-100 hover:text-indigo-600 transition-colors">
              <span>UPSC CSE Prelims</span>
              <span className="text-xs text-slate-400 font-bold">⇅</span>
            </div>
          </div>

          {/* Top Right: Icons & Streak/Points */}
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm">
            <button className="p-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" title="Calendar">
              🗓️
            </button>
            <button className="relative p-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" title="Notifications">
              🔔
              <span className="absolute 0 top-0.5 right-0.5 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                1
              </span>
            </button>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>💧</span>
              <span>{Object.keys(attempts).length}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Top Banner Notification */}
      {!bannerDismissed && (
        <div className="bg-white dark:bg-[#0f172a] border-b border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-400 py-2 px-4 relative">
          <div className="max-w-[1440px] mx-auto flex items-center justify-center text-center">
            <span>
              Require Free Mentorship or UPSC GS Study Plan?{" "}
              <a
                href="https://wa.me/919376180015"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-slate-900 dark:text-slate-100 hover:underline inline-flex items-center gap-1"
              >
                WhatsApp +91 9376180015 →
              </a>
            </span>
            <button
              onClick={() => setBannerDismissed(true)}
              className="absolute right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        
        {/* 3. Hero Header Card */}
        <div className="bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              UPSC CSE Prelims Past Year Papers
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="text-amber-500 font-bold">🔶</span>
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-mono text-slate-700 dark:text-slate-300">
                Arrow Keys
              </kbd>
              <span>or</span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-mono text-slate-700 dark:text-slate-300">
                A
              </kbd>
              <span>and</span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-mono text-slate-700 dark:text-slate-300">
                D
              </kbd>
              <span>to navigate questions, press</span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-mono text-slate-700 dark:text-slate-300">
                S
              </kbd>
              <span>to show/hide solutions.</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedYears([...ALL_YEARS]);
                setSelectedSubject(null);
                setSelectedTopic(null);
                setSelectedDifficulty(null);
                setAttemptStatus("all");
                setCurrentIndex(0);
              }}
              className="px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs sm:text-sm transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <span>View Past-Year Questions →</span>
            </button>
          </div>
        </div>

        {/* 4. Two-Column Main Area: Left Sidebar & Right Question Panel */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          
          {/* Left Sidebar (2 Separate White Rounded Cards) */}
          <aside className="w-full lg:w-[280px] shrink-0 space-y-4">
            
            {/* Top Card: Exams */}
            <div className="bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-3.5">
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Exams
              </h2>

              <div className="space-y-3">
                {/* Accordion item: UPSC CSE */}
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <span>⌄</span>
                  <span>UPSC CSE Prelims (Paper-I)</span>
                </div>

                {/* Select All Checkbox */}
                <div className="pl-3.5 pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedYears.length === ALL_YEARS.length}
                      onChange={handleSelectAllYears}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Select All</span>
                  </label>
                </div>

                {/* 2-Column Year Grid */}
                <div className="grid grid-cols-2 gap-y-2 gap-x-3 pl-3.5 pt-1 text-xs">
                  {ALL_YEARS.map((yr) => {
                    const isChecked = selectedYears.includes(yr);
                    return (
                      <label
                        key={yr}
                        className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleYear(yr)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{yr}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Card: Questions Filters */}
            <div className="bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Questions
                </h2>
                {(selectedSubject || selectedTopic || selectedDifficulty || attemptStatus !== "all") && (
                  <button
                    onClick={() => {
                      setSelectedSubject(null);
                      setSelectedTopic(null);
                      setSelectedDifficulty(null);
                      setAttemptStatus("all");
                      setCurrentIndex(0);
                    }}
                    className="text-[11px] text-indigo-600 hover:underline font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                
                {/* 1. Sections / Subjects */}
                <div className="py-2.5">
                  <button
                    onClick={() => toggleSection("sections")}
                    className="w-full flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium hover:text-indigo-600 py-1"
                  >
                    <span>{openSections.sections ? "⌄" : "›"} Sections</span>
                    <span className="text-[10px] text-slate-400 font-mono">12 Subjects</span>
                  </button>
                  {openSections.sections && (
                    <div className="mt-2 space-y-1 pl-3 max-h-48 overflow-y-auto">
                      {ALL_UPSC_HIERARCHY.map((s) => (
                        <button
                          key={s.subject}
                          onClick={() => {
                            setSelectedSubject(selectedSubject === s.subject ? null : s.subject);
                            setSelectedTopic(null);
                            setCurrentIndex(0);
                          }}
                          className={`w-full text-left py-1 px-2 rounded flex justify-between items-center transition-colors ${
                            selectedSubject === s.subject
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <span className="truncate">{s.subject}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{s.total_questions}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Topics Hierarchy */}
                <div className="py-2.5">
                  <button
                    onClick={() => toggleSection("topics")}
                    className="w-full flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium hover:text-indigo-600 py-1"
                  >
                    <span>{openSections.topics ? "⌄" : "›"} Topics</span>
                    <span className="text-[10px] text-slate-400 font-mono">92 Topics</span>
                  </button>
                  {openSections.topics && (
                    <div className="mt-2 space-y-2 pl-2 max-h-64 overflow-y-auto pr-1">
                      {ALL_UPSC_HIERARCHY.map((s) => (
                        <div key={s.subject} className="space-y-1">
                          <div
                            onClick={() => {
                              setSelectedSubject(selectedSubject === s.subject ? null : s.subject);
                              setSelectedTopic(null);
                              setCurrentIndex(0);
                            }}
                            className="font-semibold text-[11px] text-slate-800 dark:text-slate-200 cursor-pointer flex justify-between hover:text-indigo-600"
                          >
                            <span>{s.subject}</span>
                            <span className="font-mono text-slate-400">{s.total_questions}</span>
                          </div>
                          <div className="pl-2 border-l border-slate-200 dark:border-slate-700 space-y-0.5">
                            {s.topics.map((t) => (
                              <button
                                key={t.name}
                                onClick={() => {
                                  setSelectedSubject(s.subject);
                                  setSelectedTopic(selectedTopic === t.name ? null : t.name);
                                  setCurrentIndex(0);
                                }}
                                className={`w-full text-left py-0.5 px-1.5 rounded text-[11px] flex justify-between items-center ${
                                  selectedTopic === t.name
                                    ? "bg-indigo-600 text-white font-medium shadow-2xs"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                              >
                                <span className="truncate pr-1">{t.name}</span>
                                <span className="font-mono text-[10px] opacity-80">{t.total_questions}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Difficulty */}
                <div className="py-2.5">
                  <button
                    onClick={() => toggleSection("difficulty")}
                    className="w-full flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium hover:text-indigo-600 py-1"
                  >
                    <span>{openSections.difficulty ? "⌄" : "›"} Difficulty</span>
                  </button>
                  {openSections.difficulty && (
                    <div className="mt-2 space-y-1 pl-3">
                      {["All", "Easy", "Moderate", "Hard"].map((d) => (
                        <button
                          key={d}
                          onClick={() => {
                            setSelectedDifficulty(d === "All" ? null : d);
                            setCurrentIndex(0);
                          }}
                          className={`w-full text-left py-1 px-2 rounded text-xs ${
                            (d === "All" && !selectedDifficulty) || selectedDifficulty === d
                              ? "bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/60 dark:text-indigo-300"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Bookmarks */}
                <div className="py-2.5">
                  <button
                    onClick={() => {
                      setAttemptStatus(attemptStatus === "bookmarked" ? "all" : "bookmarked");
                      setCurrentIndex(0);
                    }}
                    className="w-full flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium hover:text-indigo-600 py-1"
                  >
                    <span>› Bookmarks</span>
                    <span className="text-[10px] font-mono font-bold text-amber-600">
                      {bookmarks.size} Saved
                    </span>
                  </button>
                </div>

                {/* 5. Attempt */}
                <div className="py-2.5">
                  <button
                    onClick={() => toggleSection("attempt")}
                    className="w-full flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium hover:text-indigo-600 py-1"
                  >
                    <span>{openSections.attempt ? "⌄" : "›"} Attempt</span>
                  </button>
                  {openSections.attempt && (
                    <div className="mt-2 space-y-1 pl-3">
                      {[
                        { id: "all", label: "All" },
                        { id: "unattempted", label: "Unattempted" },
                        { id: "attempted", label: "Attempted" },
                        { id: "incorrect", label: "Incorrect Only" },
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() => {
                            setAttemptStatus(st.id as FilterState["attemptStatus"]);
                            setCurrentIndex(0);
                          }}
                          className={`w-full text-left py-1 px-2 rounded text-xs ${
                            attemptStatus === st.id
                              ? "bg-indigo-50 text-indigo-700 font-semibold"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. Time Spent */}
                <div className="py-2.5">
                  <button
                    onClick={() => toggleSection("timeSpent")}
                    className="w-full flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium hover:text-indigo-600 py-1"
                  >
                    <span>{openSections.timeSpent ? "⌄" : "›"} Time Spent</span>
                  </button>
                  {openSections.timeSpent && (
                    <div className="mt-2 space-y-1 pl-3 text-slate-500 text-xs">
                      <div className="py-0.5">&lt; 1 min</div>
                      <div className="py-0.5">1–3 min</div>
                      <div className="py-0.5">3–5 min</div>
                      <div className="py-0.5">5+ min</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Right Main Practice Area */}
          <main className="flex-1 w-full space-y-4">
            
            {/* Top Question Number Strip Bar */}
            <div className="flex items-center justify-between gap-3 overflow-hidden">
              <div
                ref={numberStripRef}
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 pr-4 max-w-full scroll-smooth"
              >
                {filteredQuestions.map((q, idx) => {
                  const isActive = idx === currentIndex;
                  const att = attempts[q.question_id];
                  const isBm = bookmarks.has(q.question_id);

                  let bgClass = "bg-slate-200/70 hover:bg-slate-300/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
                  if (isActive) {
                    bgClass = "bg-black dark:bg-white text-white dark:text-black font-bold shadow-xs";
                  } else if (att?.isCorrect) {
                    bgClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
                  } else if (att && !att.isCorrect) {
                    bgClass = "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
                  }

                  return (
                    <button
                      key={q.question_id}
                      data-qindex={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium flex items-center justify-center shrink-0 transition-all relative ${bgClass}`}
                    >
                      {idx + 1}
                      {isBm && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* View Topic Distribution button */}
              <button
                onClick={() => setShowTopicDistribution((prev) => !prev)}
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 whitespace-nowrap flex items-center gap-1 shrink-0"
              >
                <span>View Topic Distribution →</span>
              </button>
            </div>

            {/* Topic Distribution Modal if toggled */}
            {showTopicDistribution && (
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Topic Breakdown ({filteredQuestions.length} Questions)
                  </h3>
                  <button
                    onClick={() => setShowTopicDistribution(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                  {ALL_UPSC_HIERARCHY.map((s) => (
                    <div
                      key={s.subject}
                      onClick={() => {
                        setSelectedSubject(s.subject);
                        setSelectedTopic(null);
                        setShowTopicDistribution(false);
                        setCurrentIndex(0);
                      }}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-300 cursor-pointer"
                    >
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{s.subject}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{s.total_questions} Questions</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Question Main Card */}
            {activeQuestion ? (
              <div className="space-y-4">
                
                {/* 1. Question Card Container */}
                <div className="bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                  
                  {/* Top Badges Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Year Pill (Purple) */}
                      <span className="px-3.5 py-1 rounded-full bg-[#f3e8ff] dark:bg-[#3b0764]/60 text-[#7e22ce] dark:text-[#d8b4fe] font-semibold text-xs tracking-tight">
                        UPSC CSE {activeQuestion.year}
                      </span>

                      {/* Topic Hierarchy Pill (Blue) */}
                      <span className="px-3.5 py-1 rounded-full bg-[#e0f2fe] dark:bg-[#082f49]/60 text-[#0369a1] dark:text-[#7dd3fc] font-semibold text-xs tracking-tight">
                        {activeQuestion.subject} &gt; {activeQuestion.topic}
                      </span>

                      {/* Difficulty Pill (Green/Amber/Rose) */}
                      <span className={`px-3 py-1 rounded-full font-semibold text-xs tracking-tight ${getDiffBadge(activeQuestion.difficulty)}`}>
                        {activeQuestion.difficulty}
                      </span>
                    </div>

                    {/* Right side: Report button & Bookmark */}
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <button
                        onClick={() => toggleBookmark(activeQuestion.question_id)}
                        className={`hover:text-amber-500 transition-colors flex items-center gap-1 ${
                          bookmarks.has(activeQuestion.question_id) ? "text-amber-500 font-semibold" : ""
                        }`}
                        title="Bookmark question"
                      >
                        <span>🔖</span>
                        <span>{bookmarks.has(activeQuestion.question_id) ? "Bookmarked" : "Bookmark"}</span>
                      </button>
                      <button className="hover:text-slate-600 flex items-center gap-1">
                        <span>ⓘ</span>
                        <span>Report</span>
                      </button>
                    </div>
                  </div>

                  {/* Verbatim Question Text Box (Rounded Inner Container) */}
                  <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 sm:p-6 bg-white dark:bg-[#0f172a] space-y-4">
                    <QuestionBodyRenderer question={activeQuestion} />

                    {/* Options List */}
                    {activeQuestion.options && activeQuestion.options.length > 0 && (
                      <div className="space-y-2.5 pt-2">
                        {activeQuestion.options.map((opt) => {
                          const isCorrect = activeQuestion.correct_answer.toLowerCase().includes(opt.label.toLowerCase());
                          const isSelected = userAttempt?.selectedOption === opt.label;

                          let btnStyle = "bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200";

                          if (showSolution || userAttempt) {
                            if (isCorrect) {
                              btnStyle = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500/40";
                            } else if (isSelected && !isCorrect) {
                              btnStyle = "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-950 dark:text-rose-100 ring-1 ring-rose-500/40";
                            }
                          } else if (isSelected) {
                            btnStyle = "bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500";
                          }

                          return (
                            <button
                              key={opt.label}
                              onClick={() => handleRecordAttempt(activeQuestion.question_id, opt.label, isCorrect)}
                              className={`w-full text-left p-3.5 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${btnStyle}`}
                            >
                              <span className={`w-6 h-6 rounded font-mono font-bold text-xs flex items-center justify-center shrink-0 border ${
                                showSolution && isCorrect
                                  ? "bg-emerald-500 text-white border-emerald-600"
                                  : showSolution && isSelected && !isCorrect
                                  ? "bg-rose-500 text-white border-rose-600"
                                  : isSelected
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                              }`}>
                                {opt.label.replace(/[()]/g, "").toUpperCase()}
                              </span>
                              <span className="text-sm font-normal leading-relaxed pt-0.5">
                                {opt.text}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. Show Solution Center Button Bar */}
                  <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 flex flex-col items-center justify-center gap-3">
                    <button
                      onClick={() => setShowSolution((prev) => !prev)}
                      className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 shadow-2xs transition-all"
                    >
                      {showSolution ? "Hide Solution" : "Show Solution"}
                    </button>

                    {/* Detailed Solution Expanded Container */}
                    {showSolution && (
                      <div className="w-full mt-2 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Official / Verified Answer
                          </span>
                          <span className="px-3.5 py-1 bg-emerald-500 text-white font-mono font-bold text-sm rounded-lg shadow-xs">
                            {activeQuestion.correct_answer || "Verified"}
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                          {activeQuestion.detailed_solution}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs">
                            <strong className="text-blue-900 dark:text-blue-200 block mb-1">💡 Core Concept:</strong>
                            <span className="text-blue-800 dark:text-blue-300 leading-relaxed">{activeQuestion.core_concept}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 text-xs">
                            <strong className="text-purple-900 dark:text-purple-200 block mb-1">🎯 Exam Takeaway:</strong>
                            <span className="text-purple-800 dark:text-purple-300 leading-relaxed">{activeQuestion.exam_takeaway}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono pt-2">
                          <span>PDF Reference: {activeQuestion.source_pdf} (p. {activeQuestion.source_page})</span>
                          <span>Marks: 2.00 | Penalty: -0.66</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Navigation Controls */}
                <div className="flex items-center justify-between text-xs font-semibold">
                  <button
                    onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev))}
                    disabled={currentIndex === 0}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>← Previous Question</span>
                    <kbd className="px-1 text-[10px] font-mono text-slate-400">[A / ←]</kbd>
                  </button>

                  <div className="text-slate-500 font-mono">
                    {currentIndex + 1} / {filteredQuestions.length} Questions
                  </div>

                  <button
                    onClick={() =>
                      setCurrentIndex((prev) => (prev < filteredQuestions.length - 1 ? prev + 1 : prev))
                    }
                    disabled={currentIndex >= filteredQuestions.length - 1}
                    className="px-5 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black disabled:opacity-40 hover:opacity-90 transition-all flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>Next Question →</span>
                    <kbd className="px-1 text-[10px] font-mono opacity-60">[D / →]</kbd>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-3">
                <div className="text-4xl">🔍</div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  No Questions Found
                </h3>
                <p className="text-xs max-w-sm mx-auto">
                  Try adjusting your filters in the left sidebar to view questions.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
