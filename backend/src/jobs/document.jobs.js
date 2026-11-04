import { registerHandler, enqueue } from './queue.js';
import { JOB_TYPES } from '../models/job.model.js';
import { processDocument, markProcessingFailed, evaluateCase } from '../services/processing.service.js';

export function registerDocumentJobs() {
  registerHandler(JOB_TYPES.PROCESS_DOCUMENT, {
    handle: ({ documentId }) => processDocument(documentId),
    onFailed: ({ documentId }, err) => markProcessingFailed(documentId, err),
  });
  registerHandler(JOB_TYPES.EVALUATE_CASE, {
    handle: ({ caseId }) => evaluateCase(caseId),
  });
}

export const queueDocumentProcessing = (documentId) => enqueue(JOB_TYPES.PROCESS_DOCUMENT, { documentId });
export const queueCaseEvaluation = (caseId) => enqueue(JOB_TYPES.EVALUATE_CASE, { caseId });
