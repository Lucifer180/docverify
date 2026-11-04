import { Router } from 'express';
import { auditController } from '../controllers/audit.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { listAuditQuery } from '../validators/audit.validator.js';

const router = Router();
router.get('/', authenticate, authorize('admin'), validate({ query: listAuditQuery }), auditController.list);

export default router;
