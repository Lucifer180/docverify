# DocVerify — AI-Powered Document Processing and Verification System

A web application that takes documents (PDF, JPG, PNG) from upload to a reviewed decision:

1. **Upload**: files are checked by extension, real content signature and size, then stored privately on this machine.
2. **Text extraction**: the PDF text layer is read directly; scanned pages and images go through **Tesseract OCR**, after pre-processing (rotation, grayscale, upscaling, contrast and a threshold retry).
3. **AI structuring**: **xAI Grok** classifies the document and returns structured JSON fields, using a strict JSON schema. The output is validated with **Zod**, retried once with the errors, and otherwise left for manual entry.
4. **Rule-based validation**: required fields, formats (date, Aadhaar, PAN, GSTIN, email, and others), date order, totals, and marks/percentage consistency.
5. **Cross-document comparison**: names, dates of birth and father's names are compared across all documents in a case and against the submitter's details, with fuzzy matching ("R. Kumar" vs "Ravi Kumar" is flagged as a *possible match* for a reviewer to confirm).
6. **Human review**: a side-by-side view of the original and the extracted fields. Reviewers correct values (saved as versions) and approve, reject or request corrections (a comment is required).
7. **Audit**: an append-only log of every upload, processing step, correction, sensitive-data view and decision.

> **Preliminary verification only.** The system flags inconsistencies. It does **not** establish that a document is genuine. Final decisions are made by an authorised reviewer.

Everything runs locally: **SQLite** database file, files stored on disk, OCR language data bundled. Only the Grok API call goes over the internet. Without a key, a built-in offline extractor is used.

---

## Requirements

- **Node.js 20 or newer** (22 LTS recommended): <https://nodejs.org>
- Windows, macOS or Linux. No database server, Redis, Tesseract install or Docker is needed.

## Quick start (Windows)

Double-click **`start.bat`**. On the first run it installs dependencies, then opens the backend and frontend in two windows. Open <http://localhost:5173>.

## Manual start

```bash
# 1. Backend
cd backend
npm install
copy .env.example .env        # macOS/Linux: cp .env.example .env
npm run dev                   # http://localhost:5000/api

# 2. Frontend (new terminal)
cd frontend
npm install
copy .env.example .env
npm run dev                   # http://localhost:5173
```

### Demo accounts (created automatically on first start)

| Role      | Email                        | Password        |
|-----------|------------------------------|-----------------|
| Admin     | admin@docverify.local        | `Admin@123`     |
| Reviewer  | reviewer@docverify.local     | `Reviewer@123`  |
| Submitter | submitter@docverify.local    | `Submitter@123` |

New users who register are submitters. An admin can promote them to reviewer or admin under **Users & roles**.

### Using Grok

In `backend/.env`:

```
LLM_PROVIDER=grok
GROK_API_KEY=xai-...your key...
GROK_MODEL=grok-4-1-fast-non-reasoning
```

Get a key at <https://console.x.ai>. Any Grok chat model works. If a model does not support JSON-schema mode, the app falls back to JSON mode automatically. Restart the backend after changing `.env`. The dashboard warns admins when the offline extractor is in use.

Only the extracted **text** is sent to Grok (never the image). It is cleaned and trimmed to `LLM_MAX_INPUT_CHARS`, and the model name is recorded on every document.

---

## Try it with sample documents

```bash
cd backend
npm run samples     # creates synthetic documents in tests/fixtures/samples
```

- `c1_*`: a consistent case (ID image, digital PDF mark sheet, scanned application form) → **Passed automated checks**
- `c2_*`: deliberately modified (name written with an initial, changed DOB, marks above maximum) → **Flagged**
- `c3_*`: an invoice whose total is wrong, plus a blurred, tilted photo
- `invalid_*`: a disguised file and a .txt file (should be rejected on upload)

## Evaluation (accuracy, precision, recall, timing)

```bash
cd backend
npm run evaluate
```

This runs the full pipeline on the labelled sample set (`tests/fixtures/samples/ground-truth.json`) and reports:

- field-extraction accuracy and classification accuracy
- precision, recall and F1 for flagged issues
- false-positive and false-negative rates
- average and maximum processing time (OCR and LLM stages separately)

Results are saved in `backend/storage/evaluation/`. Run it once with the offline extractor and once with Grok to compare. For the manual-baseline comparison, time a person processing the same documents.

## Tests

```bash
cd backend
npm test
```

66 tests: unit tests (dates, name matching, every rule type, schema building, masking, the Grok client's retry and fallback logic) and API integration tests (auth, RBAC, upload security, the full OCR → AI → rules pipeline, masking, file links, corrections and versions, decisions, the append-only audit log, LLM outage retries and manual-entry fallback).

---

## Project structure

```
backend/
├── src/
│   ├── config/          env.js, db.js (SQLite connection)
│   ├── database/        migrations.js (schema), seed-data/documentTypes.js
│   ├── models/          table constants + row → object mappers
│   ├── repositories/    all SQL lives here
│   ├── services/        business logic
│   │   ├── ocr.service.js           PDF text layer / page rendering / Tesseract
│   │   ├── llm/                     grok.provider.js, grok.client.js, prompts.js, mock.client.js
│   │   ├── extraction.service.js    classify → extract → Zod validate → retry → manual entry
│   │   ├── validation.service.js    rule engine
│   │   ├── comparison.service.js    fuzzy name/date matching across documents
│   │   ├── processing.service.js    pipeline + case evaluation / preliminary status
│   │   └── case / document / review / report / auth / user / audit services
│   ├── controllers/     HTTP in/out only
│   ├── routes/          endpoints + middleware per route
│   ├── middlewares/     auth (JWT + roles), validate (Zod), upload, rate limit, errors
│   ├── validators/      Zod request schemas
│   ├── jobs/            SQLite-backed job queue with retries, retention purge
│   ├── utils/           ApiError, logger (redacts sensitive data), masking, dates, schema builder
│   ├── app.js
│   └── server.js
├── scripts/             generate-samples.js, evaluate.js
├── tests/               unit/, integration/, fixtures/
└── storage/             (created at runtime) docverify.sqlite + uploads/  — git-ignored

frontend/
├── src/
│   ├── assets/styles/   global.css, variables.css (Tailwind v4 theme)
│   ├── components/      common/ (Button, Input, Modal, Loader, Badge…), navigation/ (Navbar, Sidebar)
│   ├── layouts/         MainLayout, AuthLayout
│   ├── pages/           Dashboard, Cases, CaseNew, CaseDetail, DocumentReview, admin/…
│   ├── features/        auth, cases, documents, users, documentTypes (components + hooks)
│   ├── services/        api.js (axios + JWT), auth / case / document / user / admin services
│   ├── context/         AuthContext (token stored in localStorage), ToastContext
│   ├── hooks/           useDebounce, useAsync (loading + polling)
│   ├── routes/          AppRoutes (protected + role-based routes)
│   ├── utils/, constants/
│   ├── App.jsx, main.jsx
└── vite.config.js       proxies /api → backend in development
```

## API overview

All routes are under `/api`. Every route except auth, health and signed file links needs `Authorization: Bearer <token>`.

| Method | Route | Who | Purpose |
|---|---|---|---|
| POST | `/auth/register`, `/auth/login` | public | Account / JWT |
| GET | `/auth/me` | any | Current user |
| GET/POST | `/cases` | any / submitter, admin | List (scoped by role) / create |
| GET/PATCH | `/cases/:id` | owner, reviewer, admin | Detail (`?reveal=true` for staff, audited) / edit details |
| POST | `/cases/:id/documents` | owner | Upload (multipart `files`) |
| POST | `/cases/:id/submit` | owner | Submit or resubmit for review |
| POST | `/cases/:id/assign` | reviewer, admin | Assign reviewer |
| POST | `/cases/:id/decision` | reviewer, admin | `approved` / `rejected` / `correction_requested` |
| GET | `/cases/:id/history` · `/cases/:id/report?format=html\|json` | viewers | Audit trail · verification report |
| GET | `/documents/:id/file-link` | viewers | 5-minute signed link to the original |
| PUT | `/documents/:id/fields` | reviewer, admin | Correct fields / change type (new version) |
| GET | `/documents/:id/versions` · `/documents/:id/text` | viewers · staff | Version history · raw OCR text |
| POST | `/documents/:id/reprocess` | owner, staff | Re-run extraction (`fromScratch` re-runs OCR) |
| DELETE | `/documents/:id` | owner | While the case is open or sent back |
| GET/POST/PATCH | `/document-types` | any / admin | Configure fields and rules |
| GET/POST/PATCH | `/users` | admin | Manage users and roles |
| GET | `/audit-logs` | admin | Filterable audit log |

## Configurable rules

Admins edit fields and rules under **Document types & rules**. Rule types:
`date_not_future`, `date_not_past`, `date_order`, `number_range`, `number_lte`, `sum_equals`,
`array_sum_equals`, `line_item_math`, `percentage_consistent`, `min_age_at_year`, `pattern`, `pattern_if`, `one_of`.
Fields can be marked **required**, **sensitive** (masked in the UI, logs and reports), compared **across documents**
(`person_name`, `date_of_birth`, `father_name`) or matched against the **submitter's details**.

## Security notes

- Passwords are hashed with bcrypt. JWT access tokens are short-lived. Deactivated users are blocked immediately.
- Role checks run on every route. Users can never see another user's cases (they get a 404).
- Uploads: the real file type is detected from the content, and the extension must match it. Size and count limits apply. Files get random names, are stored outside any web folder, and are served only through expiring signed links.
- Helmet security headers, CORS restricted to the frontend URL, rate limiting (stricter on login and upload).
- Sensitive fields are masked for submitters, and for staff unless they choose "Reveal" (which is audited). Logs redact ID numbers, emails and phone numbers. Corrections to sensitive fields are stored masked in the audit log.
- The audit log is append-only (SQLite triggers block updates and deletes).
- Retention: files of decided cases are deleted after `DOCUMENT_RETENTION_DAYS`.
- Before real use: change the demo passwords and set a long random `JWT_SECRET`.

## Troubleshooting

- **`npm install` fails on better-sqlite3 / sharp / canvas**: use an LTS Node version (20 or 22). These packages ship prebuilt binaries for those versions.
- **Port in use**: change `PORT` in `backend/.env` (and `VITE_BACKEND_URL` in `frontend/.env`).
- **Reset all data**: stop the backend and delete the `backend/storage` folder.
