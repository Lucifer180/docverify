import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { toUser, ROLES } from '../models/user.model.js';
import { AUDIT_ACTIONS } from '../models/auditLog.model.js';
import { recordAudit } from './audit.service.js';
import { newId } from '../utils/ids.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

export const DEMO_USERS = [
  { name: 'System Admin', email: 'admin@docverify.local', password: 'Admin@123', role: ROLES.ADMIN },
  { name: 'Priya Reviewer', email: 'reviewer@docverify.local', password: 'Reviewer@123', role: ROLES.REVIEWER },
  { name: 'Ravi Submitter', email: 'submitter@docverify.local', password: 'Submitter@123', role: ROLES.SUBMITTER },
];

export const userService = {
  /** Creates demo accounts the first time the app starts with an empty database. */
  async seedDemoUsers() {
    if (userRepository.count() > 0) return false;
    for (const u of DEMO_USERS) {
      const passwordHash = await bcrypt.hash(u.password, env.bcryptRounds);
      userRepository.create({ id: newId(), name: u.name, email: u.email, passwordHash, role: u.role });
    }
    if (!env.isTest) {
      logger.info('Created demo accounts (change these passwords before real use)');
      // Printed directly so the demo emails are not redacted by the logger.
      console.log(DEMO_USERS.map((u) => `  ${u.role.padEnd(9)} ${u.email} / ${u.password}`).join('\n'));
    }
    return true;
  },

  getById(id) {
    const user = toUser(userRepository.findById(id));
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  list(query) {
    const { rows, total } = userRepository.list(query);
    return { items: rows.map(toUser), total };
  },

  listReviewers() {
    const reviewers = userRepository.list({ role: ROLES.REVIEWER, limit: 500 }).rows;
    const admins = userRepository.list({ role: ROLES.ADMIN, limit: 500 }).rows;
    return [...reviewers, ...admins].filter((u) => u.is_active).map(toUser);
  },

  async create({ name, email, password, role }, { user: actor, ip }) {
    if (userRepository.findByEmail(email)) throw ApiError.conflict('An account with this email already exists');
    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    const user = toUser(userRepository.create({ id: newId(), name, email, passwordHash, role }));
    recordAudit({ user: actor, ip, action: AUDIT_ACTIONS.USER_REGISTERED, entityType: 'user', entityId: user.id,
      details: { role, createdByAdmin: true } });
    return user;
  },

  update(id, changes, { user: actor, ip }) {
    const existing = this.getById(id);
    if (actor.id === id && (changes.role && changes.role !== existing.role)) {
      throw ApiError.badRequest('You cannot change your own role');
    }
    if (actor.id === id && changes.isActive === false) throw ApiError.badRequest('You cannot deactivate your own account');
    const user = toUser(userRepository.update(id, changes));
    recordAudit({ user: actor, ip, action: AUDIT_ACTIONS.USER_UPDATED, entityType: 'user', entityId: id,
      details: { before: { role: existing.role, isActive: existing.isActive }, after: { role: user.role, isActive: user.isActive } } });
    return user;
  },
};
