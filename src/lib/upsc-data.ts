
export interface OptionItem {
  label: string;
  text: string;
}

export interface UPSCQuestion {
  question_id: string;
  exam: string;
  stage: string;
  year: string;
  paper: string;
  subject: string;
  topic: string;
  subtopic: string;
  secondary_topics: string[];
  question_number: string;
  question_type: string;
  original_question: string;
  options: OptionItem[];
  marks: string;
  word_limit: string;
  difficulty: "Easy" | "Moderate" | "Hard";
  correct_answer: string;
  detailed_solution: string;
  core_concept: string;
  exam_takeaway: string;
  tags: string[];
  source_pdf: string;
  source_page: number;
  verification_status: string;
}

export interface TopicItem {
  name: string;
  total_questions: number;
  subtopics: string[];
}

export interface SubjectHierarchy {
  subject: string;
  total_questions: number;
  topics: TopicItem[];
}

export interface FilterState {
  searchQuery: string;
  selectedYears: string[];
  selectedSubject: string | null;
  selectedTopic: string | null;
  selectedDifficulty: string | null;
  selectedQuestionType: string | null;
  attemptStatus: "all" | "attempted" | "unattempted" | "correct" | "incorrect" | "bookmarked";
  mode: "browse" | "practice" | "revision" | "drill";
}


export const ALL_YEARS = [
  "2025", "2024", "2023", "2022", "2021", "2020",
  "2019", "2018", "2017", "2016", "2015", "2014", "2013"
];

export const QUESTION_TYPES = [
  "All Types",
  "MCQ",
  "Statement-based MCQ",
  "Statement Pairs Count MCQ",
  "Match the Following / Pairs"
];

export const DIFFICULTIES = ["All", "Easy", "Moderate", "Hard"] as const;

export function filterQuestions(
  questions: UPSCQuestion[],
  filters: FilterState,
  userState: {
    bookmarks: Set<string>;
    attempts: Record<string, { selectedOption: string; isCorrect: boolean; timeSpent: number }>;
  }
): UPSCQuestion[] {
  return questions.filter((q) => {
    // Mode revision: bookmarked or incorrect only
    if (filters.mode === "revision") {
      const isBookmarked = userState.bookmarks.has(q.question_id);
      const attempt = userState.attempts[q.question_id];
      const isIncorrect = attempt && !attempt.isCorrect;
      if (!isBookmarked && !isIncorrect) return false;
    }

    // Search Query (question, topic, subject, tags, core concept)
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      const inQuestion = q.original_question.toLowerCase().includes(query);
      const inTopic = q.topic.toLowerCase().includes(query);
      const inSubject = q.subject.toLowerCase().includes(query);
      const inTags = q.tags.some((t) => t.toLowerCase().includes(query));
      const inConcept = q.core_concept.toLowerCase().includes(query);
      const inSolution = q.detailed_solution.toLowerCase().includes(query);
      if (!inQuestion && !inTopic && !inSubject && !inTags && !inConcept && !inSolution) {
        return false;
      }
    }

    // Years Filter
    if (filters.selectedYears.length > 0 && !filters.selectedYears.includes(q.year)) {
      return false;
    }

    // Subject Filter
    if (filters.selectedSubject && q.subject !== filters.selectedSubject) {
      return false;
    }

    // Topic Filter
    if (filters.selectedTopic && q.topic !== filters.selectedTopic) {
      return false;
    }

    // Difficulty Filter
    if (filters.selectedDifficulty && filters.selectedDifficulty !== "All" && q.difficulty !== filters.selectedDifficulty) {
      return false;
    }

    // Question Type Filter
    if (filters.selectedQuestionType && filters.selectedQuestionType !== "All Types" && q.question_type !== filters.selectedQuestionType) {
      return false;
    }

    // Attempt Status Filter
    if (filters.attemptStatus === "bookmarked") {
      if (!userState.bookmarks.has(q.question_id)) return false;
    } else if (filters.attemptStatus === "attempted") {
      if (!userState.attempts[q.question_id]) return false;
    } else if (filters.attemptStatus === "unattempted") {
      if (userState.attempts[q.question_id]) return false;
    } else if (filters.attemptStatus === "correct") {
      const att = userState.attempts[q.question_id];
      if (!att || !att.isCorrect) return false;
    } else if (filters.attemptStatus === "incorrect") {
      const att = userState.attempts[q.question_id];
      if (!att || att.isCorrect) return false;
    }

    return true;
  });
}
