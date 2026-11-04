/**
 * Evaluates the pipeline on the labelled sample set (tests/fixtures/samples/ground-truth.json).
 *
 *   npm run samples      (once, to create the sample documents)
 *   npm run evaluate
 *
 * Metrics: field-extraction accuracy, classification accuracy, precision / recall / F1 for
 * flagged issues, false-positive / false-negative rates per case and processing times.
 * Results are written to storage/evaluation/. Uses whichever LLM is configured in .env.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SAMPLES = path.join(ROOT, 'tests/fixtures/samples');

// Use a throw-away storage folder so evaluation never touches real data.
const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docverify-eval-'));
process.env.STORAGE_DIR = runDir;
process.env.JOB_MAX_ATTEMPTS = process.env.JOB_MAX_ATTEMPTS || '3';

const { bootstrap } = await import('../src/bootstrap.js');
const { drainQueue } = await import('../src/jobs/queue.js');
const { caseService } = await import('../src/services/case.service.js');
const { documentService } = await import('../src/services/document.service.js');
const { userRepository } = await import('../src/repositories/user.repository.js');
const { extractedFieldRepository } = await import('../src/repositories/extractedField.repository.js');
const { toUser } = await import('../src/models/user.model.js');
const { normalizeDate } = await import('../src/utils/dates.js');
const { parseNumber, normalizeName } = await import('../src/utils/text.js');
const { getLlmClient } = await import('../src/services/llm/index.js');
const { shutdownOcr } = await import('../src/services/ocr.service.js');
const { closeDb } = await import('../src/config/db.js');

const QUALITY_RULES = new Set(['low_ocr_confidence', 'low_quality_image', 'low_classification_confidence',
  'unsupported_document_type', 'manual_entry_required', 'processing_failed']);

function sameValue(expected, actual) {
  if (expected === null || expected === undefined) return actual === null || actual === undefined || actual === '';
  if (actual === null || actual === undefined) return false;
  if (typeof expected === 'number') return parseNumber(actual) !== null && Math.abs(parseNumber(actual) - expected) < 0.01;
  const d = normalizeDate(expected);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(expected)) && d) return normalizeDate(actual) === d;
  const clean = (v) => normalizeName(String(v)).replace(/\s/g, '');
  return clean(expected) === clean(actual);
}

const pct = (n, d) => (d ? Number(((n / d) * 100).toFixed(1)) : null);

async function main() {
  const gt = JSON.parse(await fs.readFile(path.join(SAMPLES, 'ground-truth.json'), 'utf8'));
  await bootstrap();
  const submitter = toUser(userRepository.findByEmail('submitter@docverify.local'));
  const reviewer = toUser(userRepository.findByEmail('reviewer@docverify.local'));
  const llm = getLlmClient();
  console.log(`Evaluating with ${llm.name} (${llm.modelId}) on ${gt.cases.length} cases...\n`);

  const perDocument = [];
  const perCase = [];
  let fieldsTotal = 0; let fieldsCorrect = 0; let docsTotal = 0; let docsClassified = 0;
  let tp = 0; let fp = 0; let fn = 0;

  for (const c of gt.cases) {
    const created = caseService.create(submitter, { title: `Evaluation ${c.id}`, applicantName: c.applicantName,
      applicantDob: c.applicantDob }, {});
    const files = [];
    for (const d of c.documents) {
      const buffer = await fs.readFile(path.join(SAMPLES, d.file));
      files.push({ originalname: d.file, buffer, size: buffer.length });
    }
    const uploaded = await documentService.upload(submitter, created.id, files, {});
    await drainQueue();

    caseService.submit(submitter, created.id, {});
    const detail = caseService.getDetail(reviewer, created.id, { reveal: true });

    for (const d of c.documents) {
      const doc = detail.documents.find((x) => x.originalName === d.file);
      const latest = extractedFieldRepository.findLatest(doc.id);
      const data = latest ? JSON.parse(latest.data) : {};
      const fieldResults = Object.entries(d.fields).map(([key, expected]) => ({
        key, expected, actual: data[key] ?? null, correct: doc.documentType === d.type && sameValue(expected, data[key]),
      }));
      const correct = fieldResults.filter((f) => f.correct).length;
      fieldsTotal += fieldResults.length; fieldsCorrect += correct;
      docsTotal += 1; if (doc.documentType === d.type) docsClassified += 1;
      perDocument.push({
        file: d.file, expectedType: d.type, actualType: doc.documentType, classificationConfidence: doc.classificationConfidence,
        method: doc.extractionMethod, ocrConfidence: doc.ocrConfidence, status: doc.status,
        fieldAccuracy: pct(correct, fieldResults.length), timings: doc.timings,
        wrongFields: fieldResults.filter((f) => !f.correct),
      });
    }

    const flaggedRules = new Set(detail.results
      .filter((r) => !r.passed && (r.severity === 'error' || r.severity === 'warning') && !QUALITY_RULES.has(r.rule))
      .map((r) => r.rule));
    const expected = new Set(c.expectedIssues);
    const caseTp = [...flaggedRules].filter((r) => expected.has(r));
    const caseFp = [...flaggedRules].filter((r) => !expected.has(r));
    const caseFn = [...expected].filter((r) => !flaggedRules.has(r));
    tp += caseTp.length; fp += caseFp.length; fn += caseFn.length;

    const shouldFlag = expected.size > 0;
    const flagged = detail.case.preliminaryStatus === 'flagged';
    perCase.push({
      case: c.id, preliminaryStatus: detail.case.preliminaryStatus, expectedFlagged: shouldFlag,
      outcome: shouldFlag === flagged ? 'correct' : flagged ? 'false_positive' : 'false_negative',
      truePositives: caseTp, falsePositives: caseFp, missed: caseFn,
      qualityWarnings: detail.results.filter((r) => !r.passed && QUALITY_RULES.has(r.rule)).map((r) => r.rule),
      documents: uploaded.length,
    });
  }

  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision && recall ? (2 * precision * recall) / (precision + recall) : null;
  const totals = perDocument.map((d) => d.timings.totalMs).filter(Boolean);
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  const consistentCases = perCase.filter((c) => !c.expectedFlagged);
  const inconsistentCases = perCase.filter((c) => c.expectedFlagged);

  const summary = {
    llm: `${llm.name} (${llm.modelId})`,
    runAt: new Date().toISOString(),
    documents: docsTotal,
    cases: perCase.length,
    fieldExtractionAccuracy: pct(fieldsCorrect, fieldsTotal),
    fieldsCorrect, fieldsTotal,
    classificationAccuracy: pct(docsClassified, docsTotal),
    issuePrecision: precision === null ? null : Number((precision * 100).toFixed(1)),
    issueRecall: recall === null ? null : Number((recall * 100).toFixed(1)),
    issueF1: f1 === null ? null : Number((f1 * 100).toFixed(1)),
    falsePositiveRate: pct(consistentCases.filter((c) => c.outcome === 'false_positive').length, consistentCases.length),
    falseNegativeRate: pct(inconsistentCases.filter((c) => c.outcome === 'false_negative').length, inconsistentCases.length),
    processingTimeMs: {
      average: avg(totals), max: totals.length ? Math.max(...totals) : null,
      averageTextExtraction: avg(perDocument.map((d) => d.timings.textMs).filter(Boolean)),
      averageLlm: avg(perDocument.map((d) => d.timings.llmMs).filter((v) => v !== undefined)),
    },
  };

  const outDir = path.join(ROOT, 'storage', 'evaluation');
  await fs.mkdir(outDir, { recursive: true });
  const stamp = summary.runAt.replace(/[:.]/g, '-');
  await fs.writeFile(path.join(outDir, `evaluation-${stamp}.json`), JSON.stringify({ summary, perCase, perDocument }, null, 2));

  console.table(perDocument.map((d) => ({ file: d.file, type: d.actualType, expected: d.expectedType, method: d.method,
    ocr: d.ocrConfidence, accuracy: `${d.fieldAccuracy}%`, ms: d.timings.totalMs })));
  console.table(perCase.map((c) => ({ case: c.case, status: c.preliminaryStatus, outcome: c.outcome,
    found: c.truePositives.join(', '), extra: c.falsePositives.join(', '), missed: c.missed.join(', ') })));
  console.log('\nSummary', summary);
  for (const d of perDocument.filter((x) => x.wrongFields.length)) {
    console.log(`\nIncorrect fields in ${d.file}:`);
    for (const f of d.wrongFields) console.log(`  ${f.key}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`);
  }
  console.log(`\nSaved to ${path.join(outDir, `evaluation-${stamp}.json`)}`);
  console.log('Manual baseline: time a person processing the same documents and compare with processingTimeMs.');
}

try {
  await main();
} finally {
  await shutdownOcr();
  closeDb();
  await fs.rm(runDir, { recursive: true, force: true });
}
