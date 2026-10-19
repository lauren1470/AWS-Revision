# AWS Certification Revision Hub

A private, local-first study workspace for AWS certifications. The first seed bank contains 23 AWS Certified Cloud Practitioner practice exams (1,142 questions). The application is structured so terminology, categories, and later question banks can be associated with separate certifications.

## Features

- A persistent **certification selector** controls the study context across dashboard, terminology, flashcards, progress, and practice exams.
- Terminology glossary with search, category filters, manual entry/editing, and CSV import/export.
- Categories: the app starts with nine Cloud Practitioner categories that match the exam subject areas. Tick categories when adding or editing a term, or type a name in **New category** to create one on the spot. Category tags on each term filter the glossary when clicked. Manage categories in **Settings → Categories**.
- Flashcard sessions with category selection, optional shuffle, Previous/Next navigation, and **Again**, **Good**, and **Easy** ratings. Ratings advance automatically; Next skips unrated cards. A progress bar tracks rated and skipped cards separately from card position.
- Flashcard completion summaries with full-set restart and separate review rounds for **Again** or skipped cards. Revising a rating within a round replaces it without double-counting lifetime reviews.
- Randomized 90-minute, 75-question exams balanced across all tagged Cloud Practitioner subject areas, with flags for later review, multi-answer support, deferred answer review, explanations, and result history.
- Question-bank coverage and subject-area performance insights so you can identify areas needing more revision.
- Browser-local IndexedDB storage, plus full JSON backup export and restore.
- Colour themes (Blue, Pink, Purple, Green, Dark), selectable in **Settings → Theme**.

## Start the app

```bash
npm install
npm run dev
```

Run checks:

```bash
npm test
npm run build
npm run lint
```

`npm run build` regenerates the practice-exam seed data before type checking and creating the production bundle.

## Practice-exam content

Practice-exam sources live in [`practice-exam-src/`](./practice-exam-src/), with one subfolder per certification. The Cloud Practitioner sources are in [`practice-exam-src/cloud-practioner-exam-src/`](./practice-exam-src/cloud-practioner-exam-src/). Run:

```bash
npm run generate:exams
```

to parse the existing Markdown and regenerate [`src/data/generatedPracticeExams.ts`](./src/data/generatedPracticeExams.ts). The parser validates question choices and correct answers and fails with a source file and question number if it finds an unsupported or invalid format.

All current source files are assigned to **AWS Certified Cloud Practitioner (CLF-C02)**. During generation, questions receive a deterministic subject-area tag (including IAM, security, compute, storage, networking, databases, management, pricing, and cloud concepts) from their text and answer options. Generated practice exams include every available subject area. When adding another certification, put its Markdown files in a new subfolder of `practice-exam-src/` (for example `practice-exam-src/solutions-architect-associate-exam-src/`), create its certification record, and import it as a separately identified question bank; do not mix its questions with the Cloud Practitioner bank.

## Terminology CSV

Import a UTF-8 CSV with this exact header:

```text
term,definition,notes,source,certificationIds,categoryIds
```

- `term`, `definition`, and `certificationIds` are required.
- Use `|` to separate multiple certification or category IDs.
- Rows that fail validation are reported and are not imported.
- Exporting terminology produces the same schema.

Example:

```csv
term,definition,notes,source,certificationIds,categoryIds
"Amazon S3","Object storage service.","Durable storage","AWS docs","aws-certified-cloud-practitioner","storage"
```

## Local data and backups

All user-added terminology, category assignments, flashcard ratings, and practice-attempt history are stored in the current browser's IndexedDB database. This data is saved automatically and remains after you close the tab, browser, or restart the computer. This application does not include accounts or cloud synchronization.

- **Flashcard sessions resume.** Each certification has its own saved session, including its card order, position, category, shuffle setting, ratings, and skips. Return to **Flashcards** to continue or start a new session. Starting over keeps ratings already recorded. Completed sessions reopen their summary. Deleted cards are removed from saved sessions with a notification; existing review history is preserved.
- **Flashcard shortcuts.** Use Space to flip, Left/Right arrows to navigate, and 1/2/3 to rate Again/Good/Easy after revealing the definition. Controls show the shortcuts. Shortcuts do not intercept typing; Space on a focused button performs that button's normal action. Moving between cards always returns to the term side.
- **In-progress exams resume.** Answers and flags are saved as you go. If you close or refresh mid-exam, the exam reopens when you return to **Practice exams**. The 90-minute timer keeps running in real time, so an exam whose time has expired is submitted automatically.
- **Persistent storage.** On startup the app asks the browser for persistent storage so your data is not evicted when disk space is low. **Settings** shows whether it was granted.
- **Use the same address.** Browser storage is tied to the exact URL origin. `http://localhost:5173` and `http://127.0.0.1:5173` (or a different port) are separate stores.
- **Avoid private/incognito windows.** Their storage is deleted when the window closes.

Use **Settings → Export backup** regularly, and before clearing browser data or moving to another computer. Restore the resulting JSON file from **Settings → Restore backup**.
