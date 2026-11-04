import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { toUser, ROLES } from '../models/user.model.js';
import { AUDIT_ACTIONS } from '../models/auditLog.model.js';
import { recordAudit } from './audit.service.js';
import { newId } from '../utils/ids.js';
import ApiError from '../utils/ApiError.js';

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, type: 'access' }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn, issuer: 'docverify',
  });
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.jwtSecret, { issuer: 'docverify' });
  if (payload.type !== 'access') throw new Error('Wrong token type');
  return payload;
}

export const authService = {
  async register({ name, email, password }, { ip } = {}) {
    if (userRepository.findByEmail(email)) throw ApiError.conflict('An account with this email already exists');
    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    // Self-registration always creates a submitter; admins assign other roles.
    const user = toUser(userRepository.create({ id: newId(), name, email, passwordHash, role: ROLES.SUBMITTER }));
    recordAudit({ user, ip, action: AUDIT_ACTIONS.USER_REGISTERED, entityType: 'user', entityId: user.id });
    return { user, token: signAccessToken(user) };
  },

  async login({ email, password }, { ip } = {}) {
    const row = userRepository.findByEmail(email);
    const ok = await bcrypt.compare(password, row?.password_hash || DUMMY_HASH);
    if (!row || !ok) {
      recordAudit({ user: row ? toUser(row) : { email }, ip, action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
        entityType: 'user', entityId: row?.id });
      throw ApiError.unauthorized('Invalid email or password');
    }
    if (!row.is_active) throw ApiError.forbidden('This account has been deactivated');
    const user = toUser(row);
    recordAudit({ user, ip, action: AUDIT_ACTIONS.USER_LOGIN, entityType: 'user', entityId: user.id });
    return { user, token: signAccessToken(user) };
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const row = userRepository.findById(userId);
    if (!row || !(await bcrypt.compare(currentPassword, row.password_hash))) {
      throw ApiError.badRequest('Current password is incorrect');
    }
    userRepository.update(userId, { passwordHash: await bcrypt.hash(newPassword, env.bcryptRounds) });
  },
};
