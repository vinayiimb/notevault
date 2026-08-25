"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  CaretDown,
  FunnelSimple,
  Clock,
  Bookmark,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  WarningCircle,
  Lightbulb,
  ArrowSquareOut
} from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";

type CourseData = {
  name: string;
  slug: string;
  subjects: {
    name: string;
    slug: string;
    semester: string | null;
    years: string[];
  }[];
};

type Question = {
  id: string;
  questionNumber: string;
  section: string;
  questionText: string;
  answerText: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  topics: string[];
  solution: string;
};

interface PracticeClientProps {
  initialCourses: CourseData[];
  preselectedPaper?: {
    course: string;
    semester: string | null;
    subject: string;
    year: string;
  };
  // Seeds the topic filter from a `?topic=` deep link (e.g. from a Study
  // Planner "Solve N Questions" task) — the filter itself is still applied
  // client-side once questions for a subject/paper have loaded.
  initialTopic?: string;
}

export function PracticeClient({ initialCourses, preselectedPaper, initialTopic }: PracticeClientProps) {
  // --- State for Selection Sidebar ---
  const [selectedCourse, setSelectedCourse] = useState<string>(preselectedPaper?.course || "");
  const [selectedSemester, setSelectedSemester] = useState<string>(preselectedPaper?.semester || "all");
  const [selectedSubject, setSelectedSubject] = useState<string>(preselectedPaper?.subject || "");
  const [selectedYears, setSelectedYears] = useState<string[]>(preselectedPaper?.year ? [preselectedPaper.year] : []);

  // Sidebar filters
  const [difficultyFilter, setDifficultyFilter] = useState<string[]>([]);
  const [topicFilter, setTopicFilter] = useState<string>(initialTopic || "all");
  
  // --- Active Practice Session State ---
  const [isActive, setIsActive] = useState<boolean>(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  
  // User answers per question id
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  // Bookmarks per question id
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  // Solution revealed status per question id
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});
  
  // Timer state
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Derived lists from selections ---
  const currentCourseData = useMemo(() => {
    return initialCourses.find(c => c.name === selectedCourse) || null;
  }, [initialCourses, selectedCourse]);

  const semesters = useMemo(() => {
    if (!currentCourseData) return [];
    const sems = new Set<string>();
    currentCourseData.subjects.forEach(s => {
      if (s.semester) sems.add(s.semester);
    });
    return Array.from(sems).sort();
  }, [currentCourseData]);

  const subjects = useMemo(() => {
    if (!currentCourseData) return [];
    let filtered = currentCourseData.subjects;
    if (selectedSemester !== "all") {
      filtered = filtered.filter(s => s.semester === selectedSemester);
    }
    return filtered;
  }, [currentCourseData, selectedSemester]);

  const years = useMemo(() => {
    if (!currentCourseData) return [];
    const yrs = new Set<string>();
    let filtered = currentCourseData.subjects;
    if (selectedSubject) {
      filtered = filtered.filter(s => s.name === selectedSubject);
    }
    filtered.forEach(s => {
      s.years.forEach(y => {
        if (y) yrs.add(y);
      });
    });
    return Array.from(yrs).sort().reverse();
  }, [currentCourseData, selectedSubject]);

  // Available topics for active session questions
  const availableTopics = useMemo(() => {
    const topics = new Set<string>();
    questions.forEach(q => {
      q.topics.forEach(t => topics.add(t));
    });
    return Array.from(topics);
  }, [questions]);

  // Apply frontend filters to questions in active session
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (difficultyFilter.length > 0 && !difficultyFilter.includes(q.difficulty)) {
        return false;
      }
      if (topicFilter !== "all" && !q.topics.includes(topicFilter)) {
        return false;
      }
      return true;
    });
  }, [questions, difficultyFilter, topicFilter]);

  // Active question
  const activeQuestion = filteredQuestions[activeIndex] || null;

  // Pre-select logic if paper is passed
  useEffect(() => {
    if (preselectedPaper && initialCourses.length > 0) {
      const courseMatch = initialCourses.find(c => c.name === preselectedPaper.course);
      if (courseMatch) {
        setSelectedCourse(preselectedPaper.course);
        if (preselectedPaper.semester) {
          setSelectedSemester(preselectedPaper.semester);
        }
        setSelectedSubject(preselectedPaper.subject);
        setSelectedYears([preselectedPaper.year]);
      }
    }
  }, [preselectedPaper, initialCourses]);

  // Start/Clear timer based on active session
  useEffect(() => {
    if (isActive) {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  const handleYearToggle = (year: string) => {
    setSelectedYears(prev =>
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
    );
  };

  const handleDifficultyToggle = (diff: string) => {
    setDifficultyFilter(prev =>
      prev.includes(diff) ? prev.filter(d => d !== diff) : [...prev, diff]
    );
    setActiveIndex(0);
  };

  const handleStartPractice = async () => {
    if (!selectedCourse || !selectedSubject) return;
    setLoading(true);
    try {
      const yearStr = selectedYears.join(",");
      const res = await fetch(
        `/api/practice-questions?course=${encodeURIComponent(selectedCourse)}&semester=${encodeURIComponent(selectedSemester === "all" ? "" : selectedSemester)}&subject=${encodeURIComponent(selectedSubject)}&year=${encodeURIComponent(yearStr)}`
      );
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setActiveIndex(0);
        setIsActive(true);
      } else {
        alert("Could not load practice questions for this subject.");
      }
    } catch (e) {
      console.error(e);
      alert("Error starting practice session.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col gap-6 lg:flex-row">
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="w-full shrink-0 rounded-2xl border border-border bg-surface p-6 shadow-sm lg:w-80">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <FunnelSimple size={20} weight="bold" /> Practice Filters
        </h2>

        <div className="mt-5 flex flex-col gap-4">
          {/* Course Selection */}
          <div>
            <label className="text-xs font-semibold text-muted uppercase">Course / Exam</label>
            <div className="relative mt-1">
              <select
                value={selectedCourse}
                onChange={(e) => {
                  setSelectedCourse(e.target.value);
                  setSelectedSubject("");
                  setSelectedYears([]);
                  setIsActive(false);
                }}
                className="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2.5 pr-8 text-sm focus:border-accent focus:outline-none"
              >
                <option value="">Select course...</option>
                {initialCourses.map((c) => (
                  <option key={c.slug} value={c.name}>{c.name}</option>
                ))}
              </select>
              <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
            </div>
          </div>

          {/* Semester Selection */}
          {selectedCourse && semesters.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-muted uppercase">Semester</label>
              <div className="relative mt-1">
                <select
                  value={selectedSemester}
                  onChange={(e) => {
                    setSelectedSemester(e.target.value);
                    setSelectedSubject("");
                    setIsActive(false);
                  }}
                  className="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2.5 pr-8 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="all">All Semesters</option>
                  {semesters.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
              </div>
            </div>
          )}

          {/* Subject Selection */}
          {selectedCourse && (
            <div>
              <label className="text-xs font-semibold text-muted uppercase">Subject</label>
              <div className="relative mt-1">
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setIsActive(false);
                  }}
                  className="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2.5 pr-8 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Select subject...</option>
                  {subjects.map((sub) => (
                    <option key={sub.slug} value={sub.name}>{sub.name}</option>
                  ))}
                </select>
                <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
              </div>
            </div>
          )}

          {/* Year Checkboxes */}
          {selectedCourse && years.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-muted uppercase">Exam Years</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {years.map((year) => {
                  const isChecked = selectedYears.includes(year);
                  return (
                    <button
                      key={year}
                      onClick={() => handleYearToggle(year)}
                      type="button"
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        isChecked
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border bg-surface text-muted hover:border-accent/40"
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Questions Section - Sub Filters */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Question Filters</h3>
            
            {/* Difficulty */}
            <div className="mt-3">
              <label className="text-xs font-semibold text-muted uppercase">Difficulty</label>
              <div className="mt-2 flex flex-col gap-2">
                {["EASY", "MEDIUM", "HARD"].map((diff) => {
                  const isChecked = difficultyFilter.includes(diff);
                  return (
                    <label key={diff} className="flex items-center gap-2.5 text-sm text-muted cursor-pointer hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleDifficultyToggle(diff)}
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      <span className="capitalize">{diff.toLowerCase()}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Topic Filter */}
            {isActive && availableTopics.length > 0 && (
              <div className="mt-4">
                <label className="text-xs font-semibold text-muted uppercase">Topics</label>
                <div className="relative mt-1">
                  <select
                    value={topicFilter}
                    onChange={(e) => {
                      setTopicFilter(e.target.value);
                      setActiveIndex(0);
                    }}
                    className="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2 pr-8 text-xs focus:border-accent focus:outline-none"
                  >
                    <option value="all">All Topics</option>
                    {availableTopics.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <CaretDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
                </div>
              </div>
            )}
          </div>
          
          {/* Start Practice Session Button */}
          <button
            onClick={handleStartPractice}
            disabled={!selectedCourse || !selectedSubject || loading}
            className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? "Loading Questions..." : "Start Practice Session"}
          </button>
        </div>
      </aside>

      {/* ================= RIGHT MAIN AREA ================= */}
      <main className="flex-1 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        {!isActive ? (
          /* Initial Screen - Selection Prompt */
          <div className="flex h-full min-h-[350px] flex-col items-center justify-center text-center p-8">
            <div className="rounded-full bg-accent-soft p-4 text-accent">
              <Lightbulb size={36} weight="duotone" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-foreground">Interactive Practice Sandbox</h3>
            <p className="mt-2 max-w-md text-sm text-muted">
              Choose the exams and filter on the basis of topic, subtopic and difficulty! We will fetch real or AI-generated practice drills immediately.
            </p>
            {selectedCourse && selectedSubject && (
              <button
                onClick={handleStartPractice}
                className="mt-6 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground shadow transition hover:bg-accent-hover"
              >
                Start Practice Now
              </button>
            )}
          </div>
        ) : filteredQuestions.length === 0 ? (
          /* No Questions Found for Active Filter Screen */
          <div className="flex h-full min-h-[350px] flex-col items-center justify-center text-center p-8">
            <div className="rounded-full bg-surface-muted p-4 text-muted">
              <WarningCircle size={36} weight="duotone" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">No Questions Match Filters</h3>
            <p className="mt-2 text-sm text-muted">
              Try adjusting the difficulty or topic checkmarks in the sidebar to view available questions.
            </p>
            <button
              onClick={() => {
                setDifficultyFilter([]);
                setTopicFilter("all");
                setActiveIndex(0);
              }}
              className="mt-4 text-sm font-medium text-accent hover:underline"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          /* Active Question Solver Pane */
          <div className="flex flex-col h-full">
            {/* Top Navigation Bar: Circles + Topic Distribution + Clock */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              {/* Circles Pagination */}
              <div className="flex flex-wrap gap-2">
                {filteredQuestions.map((q, idx) => {
                  const isCurrent = idx === activeIndex;
                  const isAnswered = !!userAnswers[q.id];
                  return (
                    <button
                      key={q.id}
                      onClick={() => setActiveIndex(idx)}
                      type="button"
                      className={`h-9 w-9 rounded-full text-sm font-semibold flex items-center justify-center transition border ${
                        isCurrent
                          ? "border-accent bg-accent-soft text-accent ring-2 ring-accent/20"
                          : isAnswered
                          ? "border-green bg-green-soft text-green"
                          : "border-border bg-surface text-muted hover:border-accent/40"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Timer & Meta controls */}
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted uppercase">
                  <Clock size={15} weight="bold" /> {formatTime(elapsedTime)}
                </span>
                
                {activeQuestion && (
                  <button
                    onClick={() => {
                      setBookmarks(prev => ({ ...prev, [activeQuestion.id]: !prev[activeQuestion.id] }));
                    }}
                    type="button"
                    className={`rounded-lg border p-1.5 transition ${
                      bookmarks[activeQuestion.id]
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border text-muted hover:text-foreground"
                    }`}
                    title="Bookmark question"
                  >
                    <Bookmark size={18} weight={bookmarks[activeQuestion.id] ? "fill" : "bold"} />
                  </button>
                )}
              </div>
            </div>

            {/* Split Screen Columns */}
            {activeQuestion && (
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:divide-x lg:divide-border">
                {/* LEFT COLUMN: Question Details */}
                <div className="flex flex-col gap-4 lg:pr-6">
                  {/* Badges / Tags */}
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                      {selectedCourse} {selectedYears[0] ? `· ${selectedYears[0]}` : ""}
                    </span>
                    {activeQuestion.topics.map(t => (
                      <span key={t} className="rounded-full bg-blue-soft px-2.5 py-1 text-xs font-semibold text-blue">
                        {t}
                      </span>
                    ))}
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      activeQuestion.difficulty === "EASY"
                        ? "bg-green-soft text-green"
                        : activeQuestion.difficulty === "MEDIUM"
                        ? "bg-yellow-soft text-yellow"
                        : "bg-red-soft text-red"
                    }`}>
                      {activeQuestion.difficulty.toLowerCase()}
                    </span>
                  </div>

                  {/* Section Label */}
                  <p className="text-xs font-bold text-muted uppercase tracking-wider">
                    {activeQuestion.section ? `${activeQuestion.section} · ` : ""}Question {activeQuestion.questionNumber}
                  </p>

                  {/* Question Body */}
                  <div className="prose prose-sm dark:prose-invert max-w-none text-base leading-relaxed text-foreground">
                    <ReactMarkdown>{activeQuestion.questionText}</ReactMarkdown>
                  </div>
                </div>

                {/* RIGHT COLUMN: Answer Input & Solution */}
                <div className="flex flex-col gap-5 lg:pl-6">
                  {/* Answer Input Box */}
                  <div className="rounded-2xl border border-border bg-surface-muted p-5">
                    <label className="block text-sm font-semibold text-foreground">
                      Entered answer:
                    </label>
                    <input
                      type="text"
                      value={userAnswers[activeQuestion.id] || ""}
                      onChange={(e) => {
                        setUserAnswers(prev => ({ ...prev, [activeQuestion.id]: e.target.value }));
                      }}
                      placeholder="Type your final answer..."
                      className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* Reveal Solution Button */}
                  {!revealedSolutions[activeQuestion.id] ? (
                    <button
                      onClick={() => {
                        setRevealedSolutions(prev => ({ ...prev, [activeQuestion.id]: true }));
                      }}
                      className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground shadow transition hover:bg-accent-hover"
                    >
                      <CheckCircle size={18} weight="bold" /> Show Solution
                    </button>
                  ) : (
                    /* Revealed Solution Box */
                    <div className="flex flex-col gap-4">
                      <div className="rounded-2xl border border-accent/20 bg-accent-soft/30 p-5">
                        <div className="flex items-center gap-2 text-accent font-semibold text-sm">
                          <CheckCircle size={18} weight="bold" /> Correct Answer: {activeQuestion.answerText}
                        </div>
                        <div className="mt-3 prose prose-sm dark:prose-invert text-sm text-foreground border-t border-border pt-3">
                          <ReactMarkdown>{activeQuestion.solution}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Previous / Next Question Navigation */}
                  <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                    <button
                      onClick={() => setActiveIndex(prev => Math.max(0, prev - 1))}
                      disabled={activeIndex === 0}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition hover:text-foreground disabled:opacity-40"
                    >
                      <ArrowLeft size={16} weight="bold" /> Previous
                    </button>

                    <button
                      onClick={() => setActiveIndex(prev => Math.min(filteredQuestions.length - 1, prev + 1))}
                      disabled={activeIndex === filteredQuestions.length - 1}
                      className="flex items-center gap-1.5 rounded-lg bg-surface border border-border px-4 py-2 text-sm font-medium text-muted transition hover:text-foreground disabled:opacity-40"
                    >
                      Next <ArrowRight size={16} weight="bold" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
