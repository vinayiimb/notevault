"use client";

import React, { useState, useEffect } from "react";
import { Calculator, Clock, WarningCircle, List, ArrowLeft, ArrowRight, Flag, X } from "@phosphor-icons/react/dist/ssr";
import { CbtCalculator } from "./cbt-calculator";
import { MOCK_QUESTIONS, Question } from "./mock-questions-data";


type QuestionStatus = "not_visited" | "not_answered" | "answered" | "marked_review" | "answered_marked_review";

interface UserResponse {
  selectedOption?: string;
  shortAnswerText?: string;
  status: QuestionStatus;
  timeSpentSec: number;
}

export function CbtMockTest() {
  const [activeSection, setActiveSection] = useState<"SA" | "MCQ" | "VA">("MCQ");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // index within active section
  const [userResponses, setUserResponses] = useState<Record<number, UserResponse>>({});

  // Modals state
  const [showCalculator, setShowCalculator] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showQuestionPaper, setShowQuestionPaper] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isTestSubmitted, setIsTestSubmitted] = useState(false);

  // Timers
  const [timeLeftSec, setTimeLeftSec] = useState(39 * 60 + 42); // 39:42 from screenshot
  const [questionTimeSec, setQuestionTimeSec] = useState(15);

  // Filter questions for active section
  const sectionQuestions = MOCK_QUESTIONS.filter((q) => q.sectionId === activeSection);
  const currentQuestion: Question | undefined = sectionQuestions[currentQuestionIndex] || sectionQuestions[0];

  // Initialize response state for question 1 as visited (not_answered) if not set
  useEffect(() => {
    if (!currentQuestion) return;
    setUserResponses((prev) => {
      if (!prev[currentQuestion.id]) {
        return {
          ...prev,
          [currentQuestion.id]: {
            status: "not_answered",
            timeSpentSec: 0,
          },
        };
      }
      return prev;
    });
  }, [currentQuestion]);

  // Main countdown timer
  useEffect(() => {
    if (isTestSubmitted) return;
    const timer = setInterval(() => {
      setTimeLeftSec((prev) => (prev > 0 ? prev - 1 : 0));
      setQuestionTimeSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isTestSubmitted]);

  // Reset per-question stopwatch when question changes
  useEffect(() => {
    setQuestionTimeSec(0);
  }, [currentQuestionIndex, activeSection]);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getQuestionStatus = (questionId: number): QuestionStatus => {
    return userResponses[questionId]?.status || "not_visited";
  };

  const handleOptionSelect = (optionId: string) => {
    if (isTestSubmitted || !currentQuestion) return;
    setUserResponses((prev) => {
      const current = prev[currentQuestion.id] || { status: "not_answered", timeSpentSec: 0 };
      return {
        ...prev,
        [currentQuestion.id]: {
          ...current,
          selectedOption: optionId,
          // If currently not_answered or not_visited, selecting option doesn't instantly change status until Save & Next or Mark for Review, or set to answered directly
        },
      };
    });
  };

  const handleShortAnswerChange = (val: string) => {
    if (isTestSubmitted || !currentQuestion) return;
    setUserResponses((prev) => {
      const current = prev[currentQuestion.id] || { status: "not_answered", timeSpentSec: 0 };
      return {
        ...prev,
        [currentQuestion.id]: {
          ...current,
          shortAnswerText: val,
        },
      };
    });
  };

  // Button Action: Save & Next
  const handleSaveAndNext = () => {
    if (!currentQuestion) return;
    const resp = userResponses[currentQuestion.id];
    const hasAnswer = currentQuestion.type === "MCQ" ? Boolean(resp?.selectedOption) : Boolean(resp?.shortAnswerText?.trim());

    setUserResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        status: hasAnswer ? "answered" : "not_answered",
        timeSpentSec: (prev[currentQuestion.id]?.timeSpentSec || 0) + questionTimeSec,
      },
    }));

    if (currentQuestionIndex < sectionQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  // Button Action: Mark for Review & Next
  const handleMarkForReviewAndNext = () => {
    if (!currentQuestion) return;
    const resp = userResponses[currentQuestion.id];
    const hasAnswer = currentQuestion.type === "MCQ" ? Boolean(resp?.selectedOption) : Boolean(resp?.shortAnswerText?.trim());

    const newStatus: QuestionStatus = hasAnswer ? "answered_marked_review" : "marked_review";

    setUserResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        status: newStatus,
        timeSpentSec: (prev[currentQuestion.id]?.timeSpentSec || 0) + questionTimeSec,
      },
    }));

    if (currentQuestionIndex < sectionQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  // Button Action: Clear Response
  const handleClearResponse = () => {
    if (!currentQuestion) return;
    setUserResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selectedOption: undefined,
        shortAnswerText: undefined,
        status: "not_answered",
      },
    }));
  };

  // Button Action: Previous
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Switch section
  const handleSectionSwitch = (sec: "SA" | "MCQ" | "VA") => {
    setActiveSection(sec);
    setCurrentQuestionIndex(0);
  };

  // Direct palette click
  const handlePaletteClick = (index: number) => {
    setCurrentQuestionIndex(index);
    const targetQ = sectionQuestions[index];
    if (targetQ && !userResponses[targetQ.id]) {
      setUserResponses((prev) => ({
        ...prev,
        [targetQ.id]: {
          status: "not_answered",
          timeSpentSec: 0,
        },
      }));
    }
  };

  // Calculate status counts for current section
  const counts = {
    answered: sectionQuestions.filter((q) => getQuestionStatus(q.id) === "answered").length,
    notAnswered: sectionQuestions.filter((q) => getQuestionStatus(q.id) === "not_answered").length,
    notVisited: sectionQuestions.filter((q) => getQuestionStatus(q.id) === "not_visited").length,
    markedReview: sectionQuestions.filter((q) => getQuestionStatus(q.id) === "marked_review").length,
    answeredMarkedReview: sectionQuestions.filter((q) => getQuestionStatus(q.id) === "answered_marked_review").length,
  };

  // Calculate test score summary
  const calculateResults = () => {
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;

    MOCK_QUESTIONS.forEach((q) => {
      const resp = userResponses[q.id];
      const userAns = q.type === "MCQ" ? resp?.selectedOption : resp?.shortAnswerText?.trim();
      const isAttempted = Boolean(userAns);

      if (!isAttempted) {
        unattemptedCount++;
      } else if (userAns?.toLowerCase() === q.correctAnswer.toLowerCase()) {
        correctCount++;
        score += 4;
      } else {
        wrongCount++;
        if (q.type === "MCQ") score -= 1; // +4 / -1 scheme
      }
    });

    return { score, correctCount, wrongCount, unattemptedCount, totalQuestions: MOCK_QUESTIONS.length };
  };

  const results = calculateResults();

  // Custom Fraction Renderer helper for math formulas in MCQ options (e.g. 13 3/4)
  const renderFormattedLabel = (labelStr: string) => {
    if (labelStr.includes("\\frac")) {
      // Parse e.g. "13\frac{3}{4}" or "\frac{1}{4}"
      const match = labelStr.match(/^(?:(\d+))?\\frac\{([^}]+)\}\{([^}]+)\}$/);
      if (match) {
        const whole = match[1] || "";
        const num = match[2];
        const den = match[3];
        return (
          <span className="inline-flex items-center gap-1 font-serif text-slate-800">
            {whole && <span className="text-base font-semibold">{whole}</span>}
            <span className="inline-flex flex-col text-[11px] leading-[0.9] text-center font-bold">
              <span className="border-b border-slate-700 px-0.5 pb-0.5">{num}</span>
              <span className="pt-0.5">{den}</span>
            </span>
          </span>
        );
      }
    }
    if (labelStr.includes("\\%")) {
      return <span>{labelStr.replace("\\%", "%")}</span>;
    }
    return <span>{labelStr}</span>;
  };

  return (
    <div className="flex flex-col h-screen w-full bg-white text-slate-900 font-sans select-none overflow-hidden">
      {/* 1. TOP HEADER (Dark Theme) */}
      <header className="flex items-center justify-between bg-[#1b2234] px-4 py-2 text-white shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-lg tracking-wide">Indore 2026</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-slate-200">
          <button
            type="button"
            onClick={() => setShowInstructions(true)}
            className="hover:underline flex items-center gap-1 hover:text-white transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>View Instructions</span>
          </button>
          <button
            type="button"
            onClick={() => setShowQuestionPaper(true)}
            className="hover:underline flex items-center gap-1 hover:text-white transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Question Paper</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCalculator(true)}
            className="hover:underline flex items-center gap-1 hover:text-white transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>Calculator</span>
          </button>
        </div>
      </header>

      {/* 2. SUB-HEADER / SECTION NAV & TIMERS */}
      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-1.5 text-xs">
        {/* Sections Selection */}
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-700">Sections</span>
          <div className="flex items-center gap-1">
            {(["SA", "MCQ", "VA"] as const).map((sec) => {
              const isActive = activeSection === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleSectionSwitch(sec)}
                  className={`px-3 py-1 font-semibold rounded-xs border transition ${
                    isActive
                      ? "bg-[#007bff] text-white border-[#007bff] shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {sec}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timers */}
        <div className="flex items-center gap-6 font-medium text-slate-700">
          <div>
            <span>Time Left: </span>
            <span className="font-bold text-slate-900">{formatTime(timeLeftSec)}</span>
          </div>
          <div>
            <span>Time Spent (Question): </span>
            <span className="text-slate-500">{formatTime(questionTimeSec)}</span>
          </div>
        </div>
      </div>

      {/* 3. VIBRANT BLUE MOCK BANNER */}
      <div className="bg-[#1e88e5] text-white px-4 py-1 text-xs font-semibold tracking-wide">
        AfterBoards Mock
      </div>

      {/* 4. MAIN CONTENT AREA (Split View) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Question & Options Area */}
        <main className="flex-1 flex flex-col p-5 overflow-y-auto border-r border-slate-200 bg-white">
          {currentQuestion ? (
            <div className="max-w-4xl w-full">
              {/* Question Header */}
              <div className="border-b border-slate-200 pb-2 mb-4">
                <h2 className="text-sm font-bold text-slate-900">
                  Question No. {currentQuestion.questionNo}
                </h2>
              </div>

              {/* Question Stem */}
              <div className="text-slate-800 text-sm leading-relaxed mb-6 font-normal">
                {currentQuestion.stem}
              </div>

              {/* MCQ Options or Short Answer Input */}
              {currentQuestion.type === "MCQ" && currentQuestion.options ? (
                <div className="space-y-3 pl-1">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = userResponses[currentQuestion.id]?.selectedOption === opt.id;
                    return (
                      <label
                        key={opt.id}
                        onClick={() => handleOptionSelect(opt.id)}
                        className={`flex items-center gap-3 p-2.5 rounded border text-sm cursor-pointer transition ${
                          isSelected
                            ? "border-[#007bff] bg-blue-50/50 ring-1 ring-[#007bff]"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          checked={isSelected}
                          onChange={() => handleOptionSelect(opt.id)}
                          className="w-4 h-4 text-[#007bff] border-slate-300 focus:ring-[#007bff]"
                        />
                        <div className="text-slate-800">
                          {renderFormattedLabel(opt.label)}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 max-w-sm">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Enter your numerical answer:
                  </label>
                  <input
                    type="text"
                    value={userResponses[currentQuestion.id]?.shortAnswerText || ""}
                    onChange={(e) => handleShortAnswerChange(e.target.value)}
                    placeholder="Type answer here..."
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#007bff]"
                  />
                </div>
              )}

              {/* Post-submission Solution View */}
              {isTestSubmitted && (
                <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Correct Answer: {currentQuestion.correctAnswer}</span>
                  </div>
                  <div className="text-slate-700 leading-relaxed">
                    <span className="font-semibold">Explanation: </span>
                    {currentQuestion.explanation}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500 text-sm">
              No questions found for this section.
            </div>
          )}
        </main>

        {/* RIGHT COLUMN: Sidebar (Profile & Question Palette) */}
        <aside className="w-80 flex flex-col bg-slate-50 border-l border-slate-200 overflow-y-auto">
          {/* Candidate Profile Box */}
          <div className="p-3 border-b border-slate-200 flex items-center gap-3 bg-white">
            <div className="w-12 h-14 bg-slate-200 border border-slate-300 rounded overflow-hidden flex items-center justify-center shrink-0">
              <svg className="w-10 h-12 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-slate-500">Candidate Name</div>
              <div className="text-sm font-bold text-slate-800 leading-tight">vinay kumar</div>
            </div>
          </div>

          {/* Question Status Legend */}
          <div className="p-3 border-b border-slate-200 text-[11px] grid grid-cols-2 gap-y-2 gap-x-2 bg-white">
            {/* Answered (Green Polygon) */}
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px] clip-path-polygon rounded-xs">
                {counts.answered}
              </div>
              <span className="text-slate-700 leading-none">Answered</span>
            </div>

            {/* Not Answered (Red Polygon) */}
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-red-600 text-white font-bold flex items-center justify-center text-[10px] clip-path-polygon rounded-xs">
                {counts.notAnswered}
              </div>
              <span className="text-slate-700 leading-none">Not Answered</span>
            </div>

            {/* Not Visited (Gray Box) */}
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-[10px] rounded border border-slate-300">
                {counts.notVisited}
              </div>
              <span className="text-slate-700 leading-none">Not Visited</span>
            </div>

            {/* Marked for Review (Purple Circle) */}
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-purple-700 text-white font-bold flex items-center justify-center text-[10px] rounded-full">
                {counts.markedReview}
              </div>
              <span className="text-slate-700 leading-none">Marked For Review</span>
            </div>

            {/* Answered & Marked for Review (Purple Circle + Green Dot) */}
            <div className="col-span-2 flex items-center gap-1.5 pt-1">
              <div className="relative w-6 h-6 bg-purple-700 text-white font-bold flex items-center justify-center text-[10px] rounded-full">
                {counts.answeredMarkedReview}
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 border border-white rounded-full"></span>
              </div>
              <span className="text-slate-700 text-[10px] leading-tight">
                Answered and Marked For Review (will be considered for evaluation)
              </span>
            </div>
          </div>

          {/* Sidebar Section Title */}
          <div className="bg-[#1e88e5] text-white px-3 py-1 text-xs font-bold">
            AfterBoards Mocks
          </div>

          {/* Subtitle */}
          <div className="p-2.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-700">
            Choose a Question
          </div>

          {/* Question Palette Grid (30 grid buttons) */}
          <div className="p-3 grid grid-cols-4 gap-2.5">
            {sectionQuestions.map((q, idx) => {
              const status = getQuestionStatus(q.id);
              const isCurrent = idx === currentQuestionIndex;

              let bgStyle = "bg-slate-200 text-slate-800 border-slate-300"; // default not_visited
              let shapeClass = "rounded";

              if (status === "answered") {
                bgStyle = "bg-emerald-600 text-white border-emerald-700 font-bold";
                shapeClass = "rounded-xs";
              } else if (status === "not_answered") {
                bgStyle = "bg-red-600 text-white border-red-700 font-bold";
                shapeClass = "rounded-xs";
              } else if (status === "marked_review") {
                bgStyle = "bg-purple-700 text-white border-purple-800 font-bold";
                shapeClass = "rounded-full";
              } else if (status === "answered_marked_review") {
                bgStyle = "bg-purple-700 text-white border-purple-800 font-bold relative";
                shapeClass = "rounded-full";
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handlePaletteClick(idx)}
                  className={`h-9 w-full flex items-center justify-center text-xs transition border ${bgStyle} ${shapeClass} ${
                    isCurrent ? "ring-2 ring-blue-600 ring-offset-1 font-extrabold shadow-sm" : ""
                  }`}
                >
                  {q.questionNo}
                  {status === "answered_marked_review" && (
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 border border-white rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* 5. BOTTOM ACTION FOOTER */}
      <footer className="flex items-center justify-between bg-slate-50 border-t border-slate-200 px-4 py-2 text-xs">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMarkForReviewAndNext}
            className="px-3 py-1.5 bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 rounded-xs font-medium transition"
          >
            Mark for Review & Next
          </button>
          <button
            type="button"
            onClick={handleClearResponse}
            className="px-3 py-1.5 bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 rounded-xs font-medium transition"
          >
            Clear Response
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-1.5 bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xs font-medium transition"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={handleSaveAndNext}
            className="px-4 py-1.5 bg-[#007bff] hover:bg-blue-600 text-white font-semibold rounded-xs transition shadow-xs"
          >
            Save & Next
          </button>
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="px-4 py-1.5 bg-[#60a5fa] hover:bg-blue-400 text-white font-semibold rounded-xs transition shadow-xs"
          >
            Submit
          </button>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Calculator Popup */}
      {showCalculator && <CbtCalculator onClose={() => setShowCalculator(false)} />}

      {/* 2. Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-md max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Test Instructions</h3>
            <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
              <p className="font-semibold">General Instructions:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Total duration of examination is 120 minutes.</li>
                <li>The clock will be set at the server. The countdown timer in the top right corner displays remaining time.</li>
                <li>Multiple Choice Questions (MCQs): +4 for correct answer, -1 for wrong answer.</li>
                <li>Short Answer Questions (SA): +4 for correct answer, 0 for wrong answer.</li>
              </ul>
              <p className="font-semibold pt-2">Navigating to a Question:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Click on the question number in the Question Palette to go directly to that question.</li>
                <li>Click on <span className="font-semibold">Save & Next</span> to save your answer and go to the next question.</li>
              </ul>
            </div>
            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="px-4 py-1.5 bg-[#007bff] text-white text-xs font-semibold rounded hover:bg-blue-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Question Paper Overview Modal */}
      {showQuestionPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-md max-w-3xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-bold text-slate-900">Question Paper - Section {activeSection}</h3>
              <button
                type="button"
                onClick={() => setShowQuestionPaper(false)}
                className="text-slate-500 hover:text-slate-800 text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>
            <div className="space-y-4 text-xs">
              {sectionQuestions.map((q) => (
                <div key={q.id} className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="font-bold text-slate-800 mb-1">Q{q.questionNo}. {q.stem}</div>
                  {q.options && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {q.options.map((o) => (
                        <div key={o.id} className="text-slate-600">
                          <span className="font-semibold">({o.id})</span> {renderFormattedLabel(o.label)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Submit Modal & Scorecard */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-md max-w-md w-full p-6 space-y-4 text-center">
            <h3 className="text-lg font-bold text-slate-900">
              {isTestSubmitted ? "Test Score Summary" : "Submit Examination?"}
            </h3>

            {!isTestSubmitted ? (
              <>
                <div className="text-xs text-slate-600 space-y-2">
                  <p>Are you sure you want to submit the test?</p>
                  <div className="grid grid-cols-2 gap-2 text-left bg-slate-50 p-3 rounded border border-slate-200 text-xs mt-3">
                    <div>Total Questions: <span className="font-bold">{results.totalQuestions}</span></div>
                    <div>Answered: <span className="font-bold text-emerald-600">{results.correctCount + results.wrongCount}</span></div>
                    <div>Unattempted: <span className="font-bold text-amber-600">{results.unattemptedCount}</span></div>
                    <div>Marked for Review: <span className="font-bold text-purple-600">{counts.markedReview}</span></div>
                  </div>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded hover:bg-slate-100"
                  >
                    Continue Test
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTestSubmitted(true);
                    }}
                    className="px-4 py-2 bg-[#007bff] text-white text-xs font-semibold rounded hover:bg-blue-600"
                  >
                    Confirm & Submit
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-900 space-y-2">
                  <div className="text-2xl font-extrabold text-emerald-700">{results.score} Marks</div>
                  <div className="text-xs grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200 text-center">
                    <div>
                      <div className="text-slate-500">Correct</div>
                      <div className="font-bold text-emerald-600">{results.correctCount}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Incorrect</div>
                      <div className="font-bold text-red-600">{results.wrongCount}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Unattempted</div>
                      <div className="font-bold text-slate-600">{results.unattemptedCount}</div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="w-full py-2 bg-[#007bff] text-white text-xs font-semibold rounded hover:bg-blue-600"
                >
                  View Step-by-Step Solutions
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
