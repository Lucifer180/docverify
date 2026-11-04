/**
 * Generates synthetic sample documents (no real personal data) for development,
 * testing and evaluation, plus a ground-truth file with the correct field values.
 *
 *   npm run samples   ->  tests/fixtures/samples/*.png|*.pdf + ground-truth.json
 *
 * The set includes consistent cases, deliberately modified copies (changed date of
 * birth, mismatched name, wrong totals) and a low-quality photo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../tests/fixtures/samples');

// ------------------------------------------------------------------ drawing helpers
function page(width = 1240, height = 1754) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#111111';
  return { canvas, ctx, width, height };
}

function text(ctx, str, x, y, size = 30, bold = false, align = 'left') {
  ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}

function rows(ctx, pairs, x, y, gap = 58, size = 30) {
  pairs.forEach(([label, value], i) => text(ctx, `${label}: ${value}`, x, y + i * gap, size));
}

const line = (ctx, x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = 2; ctx.stroke(); };

// ------------------------------------------------------------------ document templates
function identityCard(d) {
  const { canvas, ctx } = page(1400, 880);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.strokeRect(20, 20, 1360, 840);
  text(ctx, 'GOVERNMENT OF INDIA', 700, 90, 40, true, 'center');
  text(ctx, 'Unique Identification Authority of India', 700, 140, 30, false, 'center');
  text(ctx, 'AADHAAR', 700, 190, 34, true, 'center');
  ctx.fillStyle = '#e5e7eb'; ctx.fillRect(60, 240, 260, 320); ctx.fillStyle = '#111';
  text(ctx, 'PHOTO', 190, 410, 28, false, 'center');
  rows(ctx, [['Name', d.full_name], ['DOB', d.dobText], ['Gender', d.gender], ['Father', d.father_name]], 370, 290, 70, 34);
  text(ctx, `Aadhaar Number: ${d.document_number}`, 700, 680, 40, true, 'center');
  text(ctx, 'Sample document generated for testing - not a real identity document', 700, 800, 22, false, 'center');
  return canvas;
}

function marksheet(d) {
  const { canvas, ctx, width } = page();
  text(ctx, d.board_or_university.toUpperCase(), width / 2, 120, 40, true, 'center');
  text(ctx, 'STATEMENT OF MARKS - MARK SHEET', width / 2, 180, 32, true, 'center');
  text(ctx, `Examination: ${d.course} ${d.year_of_passing}`, width / 2, 230, 28, false, 'center');
  line(ctx, 80, 270, width - 80, 270);
  rows(ctx, [
    ['Name of the Student', d.student_name], ['Date of Birth', d.dobText], ["Father's Name", d.father_name],
    ['Roll No', d.register_number], ['Institution', d.institution_name], ['Year of Passing', d.year_of_passing],
  ], 100, 340);
  line(ctx, 80, 700, width - 80, 700);
  text(ctx, 'Subject', 100, 760, 30, true); text(ctx, 'Marks', 900, 760, 30, true);
  d.subjects.forEach(([s, m], i) => { text(ctx, s, 100, 820 + i * 55, 30); text(ctx, `${m} / 100`, 900, 820 + i * 55, 30); });
  const y = 820 + d.subjects.length * 55 + 40;
  line(ctx, 80, y - 30, width - 80, y - 30);
  rows(ctx, [['Total Marks', d.total_marks], ['Maximum Marks', d.max_marks], ['Percentage', `${d.percentage}%`], ['Result', d.result]], 100, y + 20);
  text(ctx, `Date of Issue: ${d.issueText}`, 100, y + 300, 28);
  text(ctx, 'Controller of Examinations', width - 100, y + 300, 28, false, 'right');
  text(ctx, 'Sample document generated for testing', width / 2, 1700, 22, false, 'center');
  return canvas;
}

function applicationForm(d) {
  const { canvas, ctx, width } = page();
  text(ctx, 'ADMISSION APPLICATION FORM', width / 2, 130, 42, true, 'center');
  text(ctx, 'Sunrise College of Engineering (sample)', width / 2, 185, 28, false, 'center');
  line(ctx, 80, 230, width - 80, 230);
  rows(ctx, [
    ['Applicant Name', d.applicant_name], ['Date of Birth', d.dobText], ["Father's Name", d.father_name],
    ['Email', d.email], ['Phone', d.phone], ['Address', d.address], ['Applied For', d.applied_for],
    ['Application Date', d.appDateText],
  ], 100, 310, 70);
  text(ctx, 'Declaration: I confirm the information above is correct.', 100, 960, 26);
  text(ctx, 'Signature of Applicant', width - 100, 1100, 26, false, 'right');
  return canvas;
}

function invoice(d) {
  const { canvas, ctx, width } = page();
  text(ctx, 'TAX INVOICE', width / 2, 120, 46, true, 'center');
  rows(ctx, [
    ['Vendor', d.vendor_name], ['GSTIN', d.vendor_gstin], ['Invoice Number', d.invoice_number],
    ['Invoice Date', d.dateText], ['Due Date', d.dueText], ['Bill To', d.buyer_name], ['Currency', 'INR'],
  ], 100, 220);
  line(ctx, 80, 640, width - 80, 640);
  text(ctx, 'Description', 100, 690, 28, true); text(ctx, 'Qty', 640, 690, 28, true);
  text(ctx, 'Rate', 800, 690, 28, true); text(ctx, 'Amount', 1000, 690, 28, true);
  line(ctx, 80, 710, width - 80, 710);
  d.line_items.forEach((it, i) => {
    const y = 760 + i * 55;
    text(ctx, it.description, 100, y, 28); text(ctx, String(it.quantity), 640, y, 28);
    text(ctx, String(it.unit_price), 800, y, 28); text(ctx, String(it.amount), 1000, y, 28);
  });
  const y = 760 + d.line_items.length * 55 + 30;
  line(ctx, 80, y - 20, width - 80, y - 20);
  rows(ctx, [['Subtotal', d.subtotal], ['Tax Amount', d.tax_amount], ['Total Amount', d.total_amount]], 700, y + 40);
  text(ctx, 'Sample invoice generated for testing', width / 2, 1700, 22, false, 'center');
  return canvas;
}

// ------------------------------------------------------------------ writers
async function writePng(canvas, name) {
  await fs.writeFile(path.join(OUT, name), canvas.toBuffer('image/png'));
}

async function writeJpg(canvas, name, { degrade = false } = {}) {
  let img = sharp(canvas.toBuffer('image/png'));
  if (degrade) img = img.rotate(2.5, { background: '#f5f3ee' }).blur(1.1).modulate({ brightness: 0.92 }).resize({ width: 1000 });
  await fs.writeFile(path.join(OUT, name), await img.jpeg({ quality: degrade ? 55 : 90 }).toBuffer());
}

/** A digital PDF with a real text layer (no OCR needed). */
async function writeTextPdf(lines, name) {
  const pdf = await PDFDocument.create();
  const p = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 790;
  for (const l of lines) {
    const isTitle = l.startsWith('#');
    p.drawText(isTitle ? l.slice(1).trim() : l, { x: 50, y, size: isTitle ? 15 : 11, font: isTitle ? bold : font, color: rgb(0, 0, 0) });
    y -= isTitle ? 26 : 20;
  }
  await fs.writeFile(path.join(OUT, name), await pdf.save());
}

/** A "scanned" PDF: the page is an image with no text layer (forces OCR). */
async function writeScannedPdf(canvas, name) {
  const pdf = await PDFDocument.create();
  const png = await pdf.embedPng(canvas.toBuffer('image/png'));
  const p = pdf.addPage([595, 842]);
  p.drawImage(png, { x: 0, y: 0, width: 595, height: 842 });
  await fs.writeFile(path.join(OUT, name), await pdf.save());
}

// ------------------------------------------------------------------ sample data
const ravi = { name: 'Ravi Kumar Sharma', dob: '2004-03-12', dobText: '12/03/2004', father: 'Suresh Kumar Sharma' };
const anita = { name: 'Anita Desai', dob: '2003-07-25', dobText: '25/07/2003', father: 'Mohan Desai' };

const groundTruth = { generatedAt: new Date().toISOString(), cases: [] };

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  // ---------- Case 1: consistent documents (expected: Passed Automated Checks)
  const c1 = { id: 'case-consistent', applicantName: ravi.name, applicantDob: ravi.dob, expectedIssues: [], documents: [] };

  await writePng(identityCard({ full_name: ravi.name, dobText: ravi.dobText, gender: 'Male', father_name: ravi.father,
    document_number: '2345 6789 0123' }), 'c1_aadhaar.png');
  c1.documents.push({ file: 'c1_aadhaar.png', type: 'identity_document', fields: {
    id_type: 'Aadhaar', full_name: ravi.name, date_of_birth: ravi.dob, gender: 'Male', father_name: ravi.father,
    document_number: '2345 6789 0123' } });

  const ms1 = { student_name: ravi.name, dobText: ravi.dobText, father_name: ravi.father, register_number: 'KA2022-118734',
    institution_name: 'Green Valley Public School', board_or_university: 'Central Board of Secondary Education',
    course: 'Senior School Certificate Examination', year_of_passing: 2022,
    subjects: [['English', 82], ['Mathematics', 91], ['Physics', 78], ['Chemistry', 85], ['Computer Science', 94]],
    total_marks: 430, max_marks: 500, percentage: 86, result: 'PASS', issueText: '20/07/2022' };
  await writeTextPdf([
    `# ${ms1.board_or_university.toUpperCase()}`, '# STATEMENT OF MARKS - MARK SHEET', '',
    `Name of the Student: ${ms1.student_name}`, `Date of Birth: ${ms1.dobText}`, `Father's Name: ${ms1.father_name}`,
    `Roll No: ${ms1.register_number}`, `Institution: ${ms1.institution_name}`, `Board: ${ms1.board_or_university}`,
    `Course: ${ms1.course}`, `Year of Passing: ${ms1.year_of_passing}`, '',
    ...ms1.subjects.map(([s, m]) => `${s}  ${m} / 100`), '',
    `Total Marks: ${ms1.total_marks}`, `Maximum Marks: ${ms1.max_marks}`, `Percentage: ${ms1.percentage}%`,
    `Result: ${ms1.result}`, `Issue Date: ${ms1.issueText}`, '', 'Sample document generated for testing',
  ], 'c1_marksheet.pdf');
  c1.documents.push({ file: 'c1_marksheet.pdf', type: 'certificate', fields: {
    student_name: ravi.name, date_of_birth: ravi.dob, father_name: ravi.father, register_number: ms1.register_number,
    institution_name: ms1.institution_name, year_of_passing: 2022, total_marks: 430, max_marks: 500, percentage: 86,
    result: 'PASS', issue_date: '2022-07-20' } });

  await writeScannedPdf(applicationForm({ applicant_name: ravi.name, dobText: ravi.dobText, father_name: ravi.father,
    email: 'ravi.sample@example.com', phone: '9876543210', address: '12 MG Road, Bengaluru',
    applied_for: 'B.E. Computer Science', appDateText: '15/06/2025' }), 'c1_application_scanned.pdf');
  c1.documents.push({ file: 'c1_application_scanned.pdf', type: 'application_form', fields: {
    applicant_name: ravi.name, date_of_birth: ravi.dob, father_name: ravi.father, email: 'ravi.sample@example.com',
    phone: '9876543210', applied_for: 'B.E. Computer Science', application_date: '2025-06-15' } });
  groundTruth.cases.push(c1);

  // ---------- Case 2: deliberate discrepancies (expected: Flagged for Review)
  const c2 = { id: 'case-discrepancies', applicantName: anita.name, applicantDob: anita.dob, documents: [],
    // 'A. Desai' vs 'Anita Desai' is deliberately a possible match that a reviewer must confirm.
    expectedIssues: ['cross_document_date_of_birth', 'cross_document_person_name', 'matches_submitter', 'marks_within_max',
      'percentage_consistent'] };

  await writeJpg(identityCard({ full_name: 'A. Desai', dobText: anita.dobText, gender: 'Female', father_name: anita.father,
    document_number: '5678 1234 9012' }), 'c2_aadhaar_initial.jpg');
  c2.documents.push({ file: 'c2_aadhaar_initial.jpg', type: 'identity_document', fields: {
    id_type: 'Aadhaar', full_name: 'A. Desai', date_of_birth: anita.dob, gender: 'Female', father_name: anita.father,
    document_number: '5678 1234 9012' } });

  // Modified copy: date of birth changed (25/07/2003 -> 25/08/2003) and marks greater than maximum.
  await writePng(marksheet({ student_name: anita.name, dobText: '25/08/2003', father_name: anita.father,
    register_number: 'MH2021-55120', institution_name: 'Lakeview Junior College',
    board_or_university: 'Maharashtra State Board', course: 'HSC Examination', year_of_passing: 2021,
    subjects: [['English', 88], ['Biology', 90], ['Physics', 84], ['Chemistry', 86], ['Mathematics', 92]],
    total_marks: 540, max_marks: 500, percentage: 88, result: 'PASS', issueText: '05/08/2021' }), 'c2_marksheet_modified.png');
  c2.documents.push({ file: 'c2_marksheet_modified.png', type: 'certificate', fields: {
    student_name: anita.name, date_of_birth: '2003-08-25', father_name: anita.father, register_number: 'MH2021-55120',
    institution_name: 'Lakeview Junior College', year_of_passing: 2021, total_marks: 540, max_marks: 500,
    percentage: 88, result: 'PASS', issue_date: '2021-08-05' } });
  groundTruth.cases.push(c2);

  // ---------- Case 3: invoice with a wrong total, and a low-quality photo
  const c3 = { id: 'case-invoice', applicantName: 'Bright Supplies Pvt Ltd', applicantDob: null, documents: [],
    expectedIssues: ['subtotal_plus_tax'] };
  const items = [
    { description: 'A4 Paper Ream', quantity: 10, unit_price: 250, amount: 2500 },
    { description: 'Printer Toner', quantity: 2, unit_price: 3200, amount: 6400 },
    { description: 'Stapler', quantity: 5, unit_price: 120, amount: 600 },
  ];
  await writePng(invoice({ vendor_name: 'Bright Supplies Pvt Ltd', vendor_gstin: '29ABCDE1234F1Z5',
    invoice_number: 'INV-2025-0457', dateText: '10/09/2025', dueText: '10/10/2025', buyer_name: 'Sunrise College',
    line_items: items, subtotal: 9500, tax_amount: 1710, total_amount: 11400 }), 'c3_invoice_wrong_total.png');
  c3.documents.push({ file: 'c3_invoice_wrong_total.png', type: 'invoice', fields: {
    invoice_number: 'INV-2025-0457', invoice_date: '2025-09-10', due_date: '2025-10-10', vendor_name: 'Bright Supplies Pvt Ltd',
    vendor_gstin: '29ABCDE1234F1Z5', buyer_name: 'Sunrise College', subtotal: 9500, tax_amount: 1710, total_amount: 11400 } });

  await writeJpg(invoice({ vendor_name: 'Bright Supplies Pvt Ltd', vendor_gstin: '29ABCDE1234F1Z5',
    invoice_number: 'INV-2025-0458', dateText: '12/09/2025', dueText: '12/10/2025', buyer_name: 'Sunrise College',
    line_items: items.slice(0, 2), subtotal: 8900, tax_amount: 1602, total_amount: 10502 }), 'c3_invoice_low_quality.jpg', { degrade: true });
  c3.documents.push({ file: 'c3_invoice_low_quality.jpg', type: 'invoice', fields: {
    invoice_number: 'INV-2025-0458', invoice_date: '2025-09-12', due_date: '2025-10-12', vendor_name: 'Bright Supplies Pvt Ltd',
    vendor_gstin: '29ABCDE1234F1Z5', buyer_name: 'Sunrise College', subtotal: 8900, tax_amount: 1602, total_amount: 10502 } });
  groundTruth.cases.push(c3);

  // ---------- Invalid files for upload tests
  await fs.writeFile(path.join(OUT, 'invalid_disguised.pdf'), 'MZ this is not really a pdf file');
  await fs.writeFile(path.join(OUT, 'invalid_notes.txt'), 'plain text is not allowed');

  await fs.writeFile(path.join(OUT, 'ground-truth.json'), JSON.stringify(groundTruth, null, 2));
  const files = await fs.readdir(OUT);
  console.log(`Generated ${files.length} files in ${OUT}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
