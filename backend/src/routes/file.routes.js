import { Router } from 'express';
import { documentController } from '../controllers/document.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { fileTokenParam } from '../validators/document.validator.js';

// Files are served only through short-lived signed links (no login header needed,
// so the link works in <img> and <iframe> tags).
const router = Router();
router.get('/:token', validate({ params: fileTokenParam }), documentController.serveFile);

export default router;
