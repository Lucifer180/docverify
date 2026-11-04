import { verifyAccessToken } from '../services/auth.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { toUser } from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';

/** Verifies the Bearer JWT and loads the current user (so deactivations take effect immediately). */
export function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(ApiError.unauthorized());
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(ApiError.unauthorized('Your session has expired. Please log in again.'));
  }
  const user = toUser(userRepository.findById(payload.sub));
  if (!user || !user.isActive) return next(ApiError.unauthorized('Account not found or deactivated'));
  req.user = user;
  return next();
}

/** Role-based access control: authorize('reviewer', 'admin') */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  return next();
};
