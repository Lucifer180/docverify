import { caseService } from './case.service.js';
import { recordAudit } from './audit.service.js';
import { AUDIT_ACTIONS } from '../models/auditLog.model.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LABELS = {
  open: 'Open', submitted: 'Submitted for review', approved: 'Approved', rejected: 'Rejected',
  correction_requested: 'Correction requested', pending: 'Pending', processing: 'Processing',
  passed: 'Passed automated checks', flagged: 'Flagged for review',
};

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '<span class="muted">—</span>';
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="muted">—</span>';
    const keys = Object.keys(value[0] || {});
    return `<table class="inner"><tr>${keys.map((k) => `<th>${esc(k)}</th>`).join('')}</tr>${value
      .map((row) => `<tr>${keys.map((k) => `<td>${esc(row[k])}</td>`).join('')}</tr>`).join('')}</table>`;
  }
  return esc(value);
}

/** Builds the verification report (sensitive values are always masked in exports). */
export function buildReport(user, caseId, { ip } = {}) {
  const detail = caseService.getDetail(user, caseId, { reveal: false });
  const history = caseService.history(user, caseId);
  recordAudit({ user, ip, action: AUDIT_ACTIONS.CASE_REPORT_EXPORTED, entityType: 'case', entityId: caseId });
  return { ...detail, history, generatedAt: new Date().toISOString(), generatedBy: { name: user.name, email: user.email } };
}

export function renderReportHtml(report) {
  const c = report.case;
  const issues = report.results.filter((r) => !r.passed && r.severity !== 'info');
  const docName = (id) => report.documents.find((d) => d.id === id)?.originalName || '';

  const docSections = report.documents.map((d) => {
    const type = report.documentTypes[d.documentType];
    const rows = (type?.fields || []).map((f) => `<tr><th>${esc(f.label)}</th><td>${formatValue(d.fields?.data?.[f.key])}</td></tr>`).join('');
    const docIssues = report.results.filter((r) => r.documentId === d.id && !r.passed && r.severity !== 'info');
    return `<section class="doc">
      <h3>${esc(d.originalName)}</h3>
      <p class="meta">Type: <b>${esc(type?.name || d.documentType || 'Unknown')}</b>
        · Classification confidence: ${d.classificationConfidence != null ? Math.round(d.classificationConfidence * 100) + '%' : '—'}
        · Extraction: ${esc(d.extractionMethod === 'ocr' ? `OCR (${d.ocrConfidence ?? '—'}% confidence)` : d.extractionMethod === 'text_layer' ? 'PDF text layer' : '—')}
        · Status: <b>${esc(LABELS[d.status] || d.status)}</b>
        · Data version: ${d.fields?.version ?? '—'} (${esc(d.fields?.source || '—')})</p>
      <table class="fields">${rows || '<tr><td class="muted">No fields extracted</td></tr>'}</table>
      ${docIssues.length ? `<ul class="issues">${docIssues.map((i) => `<li class="${i.severity}"><b>${esc(i.severity.toUpperCase())}</b> ${esc(i.message)}</li>`).join('')}</ul>` : ''}
    </section>`;
  }).join('');

  const caseIssues = issues.filter((i) => i.scope === 'case');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Verification report ${esc(c.reference)}</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #1f2937; margin: 32px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 28px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 0 0 4px; } .muted { color: #9ca3af; } .meta { color: #4b5563; margin: 0 0 8px; }
  .notice { background: #fffbeb; border: 1px solid #fcd34d; padding: 10px 12px; border-radius: 6px; margin: 16px 0; }
  table { border-collapse: collapse; width: 100%; } th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  table.fields th { width: 30%; color: #4b5563; font-weight: 500; } table.inner th, table.inner td { border: 1px solid #e5e7eb; font-size: 12px; }
  .doc { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
  ul.issues { margin: 8px 0 0; padding-left: 18px; } li.error b { color: #b91c1c; } li.warning b { color: #b45309; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 24px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-weight: 600; }
  @media print { body { margin: 12mm; } .noprint { display: none; } }
</style></head><body>
  <button class="noprint" onclick="window.print()" style="float:right;padding:6px 12px">Print / Save as PDF</button>
  <h1>Document Verification Report</h1>
  <p class="meta">${esc(c.reference)} · ${esc(c.title)} · Generated ${esc(new Date(report.generatedAt).toLocaleString('en-IN'))} by ${esc(report.generatedBy.name)}</p>
  <div class="notice"><b>Preliminary verification only.</b> Automated checks confirm that data was extracted and is complete,
    correctly formatted and consistent across documents. They do not establish that any document is genuine or was issued by
    the stated authority. Final decisions are made by an authorised reviewer.</div>

  <h2>Case summary</h2>
  <div class="grid">
    <div><b>Applicant:</b> ${esc(c.applicantName)}</div><div><b>Date of birth (entered):</b> ${esc(c.applicantDob || '—')}</div>
    <div><b>Submitted by:</b> ${esc(c.submitterName)}</div><div><b>Reviewer:</b> ${esc(c.assignedReviewerName || '—')}</div>
    <div><b>Preliminary status:</b> <span class="badge">${esc(LABELS[c.preliminaryStatus])}</span></div>
    <div><b>Case status:</b> <span class="badge">${esc(LABELS[c.status])}</span></div>
    <div><b>Errors:</b> ${report.summary.errors} · <b>Warnings:</b> ${report.summary.warnings} · <b>Checks passed:</b> ${report.summary.passedChecks}</div>
  </div>
  ${c.issueSummary ? `<p><b>Summary of issues:</b> ${esc(c.issueSummary)}</p>` : ''}

  <h2>Documents (${report.documents.length})</h2>
  ${docSections || '<p class="muted">No documents</p>'}

  <h2>Cross-document checks</h2>
  ${caseIssues.length ? `<ul class="issues">${caseIssues.map((i) => `<li class="${i.severity}"><b>${esc(i.severity.toUpperCase())}</b> ${esc(i.message)}</li>`).join('')}</ul>`
    : `<p>${report.results.some((r) => r.scope === 'case') ? 'All compared fields are consistent across documents.' : 'Not enough documents with comparable fields.'}</p>`}

  <h2>All checks</h2>
  <table><tr><th>Result</th><th>Severity</th><th>Rule</th><th>Document</th><th>Message</th></tr>
  ${report.results.map((r) => `<tr><td>${r.passed ? '✔ Pass' : '✘ Issue'}</td><td>${esc(r.severity)}</td><td>${esc(r.rule)}</td>
    <td>${esc(r.documentId ? docName(r.documentId) : 'Case')}</td><td>${esc(r.message)}</td></tr>`).join('')}
  </table>

  <h2>Review decisions</h2>
  ${report.decisions.length ? `<table><tr><th>Date</th><th>Reviewer</th><th>Decision</th><th>Comment</th></tr>${report.decisions
    .map((d) => `<tr><td>${esc(new Date(d.createdAt).toLocaleString('en-IN'))}</td><td>${esc(d.reviewerName)}</td><td>${esc(LABELS[d.decision] || d.decision)}</td><td>${esc(d.comment || '')}</td></tr>`).join('')}</table>`
    : '<p class="muted">No decision recorded yet.</p>'}

  <h2>Audit trail</h2>
  <table><tr><th>Time</th><th>User</th><th>Action</th></tr>
  ${report.history.map((h) => `<tr><td>${esc(new Date(h.createdAt).toLocaleString('en-IN'))}</td><td>${esc(h.userEmail || 'system')}</td><td>${esc(h.action)}</td></tr>`).join('')}
  </table>
</body></html>`;
}
