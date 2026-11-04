import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import caseRoutes from './case.routes.js';
import documentRoutes from './document.routes.js';
import fileRoutes from './file.routes.js';
import documentTypeRoutes from './documentType.routes.js';
import auditRoutes from './audit.routes.js';
import { healthController } from '../controllers/health.controller.js';

const router = Router();

router.get('/health', healthController.check);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/cases', caseRoutes);
router.use('/documents', documentRoutes);
router.use('/files', fileRoutes);
router.use('/document-types', documentTypeRoutes);
router.use('/audit-logs', auditRoutes);

export default router;
