export interface QuestionOption {
  id: string;
  label: string; // string or latex
  isCorrect?: boolean;
}

export interface Question {
  id: number;
  sectionId: "SA" | "MCQ" | "VA";
  questionNo: number;
  stem: string;
  type: "MCQ" | "SA";
  options?: QuestionOption[];
  correctAnswer: string;
  explanation: string;
}

export const MOCK_QUESTIONS: Question[] = [
  // SECTION 1: MCQ (30 Questions - Quantitative Aptitude)
  {
    id: 1,
    sectionId: "MCQ",
    questionNo: 1,
    stem: "Painter A can paint a building in 12 days while Painter B can paint it in 16 days. If A and B work on alternate days, and A starts the work on the first day, then the number of days required to paint the building is",
    type: "MCQ",
    options: [
      { id: "A", label: "13\\frac{2}{3}" },
      { id: "B", label: "13\\frac{1}{2}" },
      { id: "C", label: "13\\frac{3}{4}", isCorrect: true },
      { id: "D", label: "7\\frac{6}{7}" },
    ],
    correctAnswer: "C",
    explanation: `Let total work = LCM(12, 16) = 48 units.
Efficiency of A = 48 / 12 = 4 units/day.
Efficiency of B = 48 / 16 = 3 units/day.
In 2 days (Day 1 A, Day 2 B), work done = 4 + 3 = 7 units.
In 6 pairs of days (12 days), work done = 6 × 7 = 42 units.
Remaining work = 48 - 42 = 6 units.
On Day 13, A works and completes 4 units. Remaining work = 2 units.
On Day 14, B works. Time taken by B to do 2 units = 2/3 days.
Total time taken = 13 3/4 days (Option C).`,
  },
  {
    id: 2,
    sectionId: "MCQ",
    questionNo: 2,
    stem: "A shopkeeper marks his goods 25% above the cost price and allows a discount of 12% on the marked price. Find his profit percentage.",
    type: "MCQ",
    options: [
      { id: "A", label: "10\\%", isCorrect: true },
      { id: "B", label: "12\\%" },
      { id: "C", label: "14\\%" },
      { id: "D", label: "15\\%" },
    ],
    correctAnswer: "A",
    explanation: "Let Cost Price = 100. Marked Price = 125. Discount = 12% of 125 = 15. Selling Price = 125 - 15 = 110. Profit % = 10%.",
  },
  {
    id: 3,
    sectionId: "MCQ",
    questionNo: 3,
    stem: "If \\log_2(x - 1) + \\log_2(x + 1) = 3, then the value of x is:",
    type: "MCQ",
    options: [
      { id: "A", label: "3", isCorrect: true },
      { id: "B", label: "4" },
      { id: "C", label: "\\sqrt{8}" },
      { id: "D", label: "9" },
    ],
    correctAnswer: "A",
    explanation: "\\log_2((x-1)(x+1)) = 3 \\implies x^2 - 1 = 2^3 = 8 \\implies x^2 = 9 \\implies x = 3 (since x > 1).",
  },
  {
    id: 4,
    sectionId: "MCQ",
    questionNo: 4,
    stem: "The sum of the first n terms of an arithmetic progression is given by S_n = 3n^2 + 5n. The 10th term of this AP is:",
    type: "MCQ",
    options: [
      { id: "A", label: "58" },
      { id: "B", label: "62", isCorrect: true },
      { id: "C", label: "65" },
      { id: "D", label: "70" },
    ],
    correctAnswer: "B",
    explanation: "T_{10} = S_{10} - S_9 = [3(100) + 50] - [3(81) + 45] = 350 - 288 = 62.",
  },
  {
    id: 5,
    sectionId: "MCQ",
    questionNo: 5,
    stem: "Two dice are thrown simultaneously. What is the probability of getting a sum divisible by 4?",
    type: "MCQ",
    options: [
      { id: "A", label: "\\frac{1}{4}", isCorrect: true },
      { id: "B", label: "\\frac{1}{3}" },
      { id: "C", label: "\\frac{1}{2}" },
      { id: "D", label: "\\frac{9}{36}" },
    ],
    correctAnswer: "A",
    explanation: "Possible sums divisible by 4 are 4, 8, 12. Total favorable outcomes = 9. Probability = 9/36 = 1/4.",
  },
  ...Array.from({ length: 25 }, (_, i) => {
    const qNum = i + 6;
    return {
      id: qNum,
      sectionId: "MCQ" as const,
      questionNo: qNum,
      stem: `Quantitative Aptitude MCQ Question ${qNum}: What is the value of x if 2^{x+2} + 2^{x} = ${5 * Math.pow(2, qNum - 5)}?`,
      type: "MCQ" as const,
      options: [
        { id: "A", label: `${qNum - 5}` },
        { id: "B", label: `${qNum - 4}` },
        { id: "C", label: `${qNum - 3}` },
        { id: "D", label: `${qNum - 2}` },
      ],
      correctAnswer: "A",
      explanation: `2^x (4 + 1) = 5 * 2^{${qNum - 5}} => 5 * 2^x = 5 * 2^{${qNum - 5}} => x = ${qNum - 5}.`,
    };
  }),

  // SECTION 2: SA (10 Questions - Short Answer)
  ...Array.from({ length: 10 }, (_, i) => {
    const qNum = i + 1;
    return {
      id: 100 + qNum,
      sectionId: "SA" as const,
      questionNo: qNum,
      stem: `Short Answer Question ${qNum}: Find the remainder when ${12 * qNum + 7} is divided by 5.`,
      type: "SA" as const,
      correctAnswer: `${(12 * qNum + 7) % 5}`,
      explanation: `Calculate (${12 * qNum + 7}) mod 5 = ${(12 * qNum + 7) % 5}.`,
    };
  }),

  // SECTION 3: VA (30 Questions - Verbal Ability)
  ...Array.from({ length: 30 }, (_, i) => {
    const qNum = i + 1;
    return {
      id: 200 + qNum,
      sectionId: "VA" as const,
      questionNo: qNum,
      stem: `Verbal Ability Question ${qNum}: Choose the word nearest in meaning to 'EPHEMERAL'.`,
      type: "MCQ" as const,
      options: [
        { id: "A", label: "Transient", isCorrect: true },
        { id: "B", label: "Permanent" },
        { id: "C", label: "Eternal" },
        { id: "D", label: "Substantial" },
      ],
      correctAnswer: "A",
      explanation: "Ephemeral means lasting for a very short time. Synonyms include transient, fleeting, and short-lived.",
    };
  }),
];
