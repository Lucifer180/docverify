import { Router } from 'express';
import { documentTypeController } from '../controllers/documentType.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { createDocumentTypeSchema, updateDocumentTypeSchema, keyParam } from '../validators/documentType.validator.js';

const router = Router();
router.use(authenticate);

router.get('/', documentTypeController.list);
router.get('/:key', validate({ params: keyParam }), documentTypeController.get);
router.post('/', authorize('admin'), validate({ body: createDocumentTypeSchema }), documentTypeController.create);
router.patch('/:key', authorize('admin'), validate({ params: keyParam, body: updateDocumentTypeSchema }), documentTypeController.update);

export default router;
