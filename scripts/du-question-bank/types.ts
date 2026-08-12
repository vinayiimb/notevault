export type Department = {
  departmentId: string;
  departmentName: string;
};

export type Paper = {
  departmentId: string;
  departmentName: string;
  paperId: string;
  paperName: string;
  paperCode: string | null;
  paperType: string | null;
  rawOptionText: string;
};

export type SessionOption = {
  sessionId: string; // DU doesn't expose a separate numeric id — the raw value doubles as the id
  sessionName: string;
  rawSessionName: string;
};

export type QuestionPaperRecord = {
  source: "DU_QUESTION_BANK";
  department_name: string | null;
  department_id: string | null;
  paper_name: string | null;
  paper_id: string | null;
  paper_code: string | null;
  upc: string | null;
  examination_session: string | null;
  session_id: string | null;
  year: number | null;
  semester: string | null;
  course: string | null;
  programme: string | null;
  paper_type: string | null;
  question_for: string | null;
  marks: string | null;
  set: string | null;
  remarks: string | null;
  detail_url: string;
  pdf_url: string | null;
  pdf_filename: string | null;
  source_url: string;
  scraped_at: string;
};

export type ScrapeError = {
  stage: "search" | "detail";
  paperId?: string;
  paperCode?: string;
  detailId?: string;
  url: string;
  message: string;
  attempts: number;
  timestamp: string;
};

export type ScraperState = {
  startedAt: string;
  updatedAt: string;
  departmentsDiscovered: boolean;
  papersDiscovered: boolean;
  sessionsDiscovered: boolean;
  totalPapers: number;
  completedPaperIds: string[]; // papers whose search+detail extraction is fully done
  completedDetailIds: string[]; // detail ids already fetched (dedupe across papers)
  failedPaperIds: string[];
  successfulRecordCount: number;
  failedRecordCount: number;
};
