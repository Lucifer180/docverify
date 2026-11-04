import { Router } from 'express';
import { documentController } from '../controllers/document.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { idParam } from '../validators/common.validator.js';
import { correctFieldsSchema, reprocessSchema, revealQuery } from '../validators/document.validator.js';

const router = Router();
router.use(authenticate);

router.get('/:id/file-link', validate({ params: idParam }), documentController.fileLink);
router.get('/:id/versions', validate({ params: idParam, query: revealQuery }), documentController.versions);
router.get('/:id/text', authorize('reviewer', 'admin'), validate({ params: idParam }), documentController.rawText);
router.put('/:id/fields', authorize('reviewer', 'admin'), validate({ params: idParam, body: correctFieldsSchema }), documentController.correct);
router.post('/:id/reprocess', validate({ params: idParam, body: reprocessSchema }), documentController.reprocess);
router.delete('/:id', validate({ params: idParam }), documentController.remove);

export default router;
