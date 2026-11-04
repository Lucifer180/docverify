export const APP_NAME = import.meta.env.VITE_APP_NAME || 'DocVerify';
export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const TOKEN_KEY = 'docverify.token';
export const USER_KEY = 'docverify.user';
export const POLL_INTERVAL_MS = 2500;
export const MAX_FILE_SIZE_MB = 10;
export const ACCEPTED_FILES = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

export const ROLES = { SUBMITTER: 'submitter', REVIEWER: 'reviewer', ADMIN: 'admin' };

export const ROLE_LABELS = { submitter: 'Submitter', reviewer: 'Reviewer', admin: 'Administrator' };

export const CASE_STATUS = {
  open: { label: 'Open', tone: 'neutral' },
  submitted: { label: 'Submitted for review', tone: 'info' },
  approved: { label: 'Approved', tone: 'pass' },
  rejected: { label: 'Rejected', tone: 'fail' },
  correction_requested: { label: 'Correction requested', tone: 'flag' },
};

export const PRELIMINARY_STATUS = {
  pending: { label: 'No documents yet', tone: 'neutral' },
  processing: { label: 'Processing', tone: 'info' },
  passed: { label: 'Passed automated checks', tone: 'pass' },
  flagged: { label: 'Flagged for review', tone: 'flag' },
};

export const DOCUMENT_STATUS = {
  uploaded: { label: 'Uploaded', tone: 'info', step: 1 },
  text_extracted: { label: 'Text extracted', tone: 'info', step: 2 },
  fields_extracted: { label: 'Fields extracted', tone: 'info', step: 3 },
  passed: { label: 'Passed checks', tone: 'pass', step: 4 },
  flagged: { label: 'Flagged', tone: 'flag', step: 4 },
  processing_failed: { label: 'Processing failed', tone: 'fail', step: 4 },
};

export const IN_PROGRESS = new Set(['uploaded', 'text_extracted', 'fields_extracted']);

export const DECISIONS = {
  approved: { label: 'Approve', past: 'Approved', tone: 'pass' },
  correction_requested: { label: 'Request correction', past: 'Correction requested', tone: 'flag' },
  rejected: { label: 'Reject', past: 'Rejected', tone: 'fail' },
};

export const SEVERITY = {
  error: { label: 'Error', tone: 'fail' },
  warning: { label: 'Warning', tone: 'flag' },
  info: { label: 'Info', tone: 'neutral' },
};

export const RULE_TYPES = [
  'date_not_future', 'date_not_past', 'date_order', 'number_range', 'number_lte', 'sum_equals',
  'array_sum_equals', 'line_item_math', 'percentage_consistent', 'min_age_at_year', 'pattern', 'pattern_if', 'one_of',
];
export const FIELD_TYPES = ['string', 'date', 'number', 'email', 'phone', 'array'];
