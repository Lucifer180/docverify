import { Router } from 'express';
import { caseController } from '../controllers/case.controller.js';
import { documentController } from '../controllers/document.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { uploadFiles } from '../middlewares/upload.middleware.js';
import { uploadLimiter } from '../middlewares/rateLimit.middleware.js';
import { idParam } from '../validators/common.validator.js';
import {
  createCaseSchema, updateCaseSchema, listCasesQuery, caseDetailQuery, assignSchema, decisionSchema, reportQuery,
} from '../validators/case.validator.js';

const router = Router();
router.use(authenticate);

router.get('/dashboard', caseController.dashboard);
router.get('/', validate({ query: listCasesQuery }), caseController.list);
router.post('/', authorize('submitter', 'admin'), validate({ body: createCaseSchema }), caseController.create);
router.get('/:id', validate({ params: idParam, query: caseDetailQuery }), caseController.get);
router.patch('/:id', validate({ params: idParam, body: updateCaseSchema }), caseController.update);
router.post('/:id/submit', validate({ params: idParam }), caseController.submit);
router.post('/:id/assign', authorize('reviewer', 'admin'), validate({ params: idParam, body: assignSchema }), caseController.assign);
router.post('/:id/decision', authorize('reviewer', 'admin'), validate({ params: idParam, body: decisionSchema }), caseController.decide);
router.get('/:id/history', validate({ params: idParam }), caseController.history);
router.get('/:id/report', validate({ params: idParam, query: reportQuery }), caseController.report);
router.post('/:id/documents', uploadLimiter, validate({ params: idParam }), uploadFiles, documentController.upload);

export default router;
