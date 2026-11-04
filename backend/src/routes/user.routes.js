import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { createUserSchema, updateUserSchema, listUsersQuery } from '../validators/user.validator.js';
import { idParam } from '../validators/common.validator.js';

const router = Router();
router.use(authenticate);

router.get('/reviewers', authorize('reviewer', 'admin'), userController.reviewers);
router.get('/', authorize('admin'), validate({ query: listUsersQuery }), userController.list);
router.post('/', authorize('admin'), validate({ body: createUserSchema }), userController.create);
router.patch('/:id', authorize('admin'), validate({ params: idParam, body: updateUserSchema }), userController.update);

export default router;
