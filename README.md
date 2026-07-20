# NoteVault

A one-stop study platform: browse by class or college program, then drill into a
semester and subject to find notes, previous year question papers with answer keys,
and the questions that repeat most often across papers.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, and Prisma + SQLite.

## Running locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Admin

Manage programs, semesters, subjects, upload notes/PYQ PDFs, and tag repeated
questions at `/admin`.

- Email: `admin@notevault.dev`
- Password: `ChangeMe123!`

(Configured via `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` in `.env`, applied when you
run the seed script below.)

### AI metadata matching

Consolidated Upload can match loose PDFs and ZIP contents to the course,
semester, subject, and academic year in the catalog. Configure
`OPENAI_API_KEY` to use the OpenAI Responses API; `OPENAI_MATCH_MODEL` is
optional and defaults to `gpt-5.6-luna`. If no OpenAI key is present, the
existing `GROQ_API_KEY` integration is used as a narrower fallback.

Large production PDFs upload directly to R2 through short-lived signed URLs.
The R2 bucket must allow browser `PUT` requests from the deployed site origin;
smaller files automatically fall back to the server upload path when needed.

## Database

SQLite database lives at `prisma/dev.db` (gitignored). Useful commands:

```bash
# Apply schema changes after editing prisma/schema.prisma
npx prisma migrate dev

# Re-seed sample content (wipes and recreates all programs/subjects/resources)
npx prisma db seed

# Browse the database visually
npx prisma studio
```

## Content structure

`Program` (e.g. "B.Com (Hons)", level: College or Class 12) → `Term` (e.g. "Semester 3")
→ `Subject` → `Resource` (Notes or PYQ PDF) and `Question` (a bank question with its
answer, optionally flagged `isRepeated` with a `repeatCount` and the `years` it appeared).

Uploaded files are saved to `public/uploads/` (gitignored) and served statically.

## Notes

- Sample content seeded so far covers a B.Com (Hons) program (6 semesters, with
  Financial Accounting, Principles of Management, Business Statistics, Cost
  Accounting, and Entrepreneurship populated) and CBSE Class 12 Commerce (Business
  Studies, Accountancy). Add more programs/subjects from `/admin`.
- File storage is local disk, which works for running this on your own machine or a
  single persistent server. If you deploy to a serverless platform (e.g. Vercel),
  swap `src/lib/storage.ts` for an object storage service (S3, R2, etc.) since
  serverless filesystems aren't persistent.
