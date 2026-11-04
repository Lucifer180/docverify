import { authService } from '../services/auth.service.js';

export const authController = {
  async register(req, res) {
    const result = await authService.register(req.valid.body, { ip: req.ip });
    res.status(201).json({ success: true, data: result });
  },

  async login(req, res) {
    const result = await authService.login(req.valid.body, { ip: req.ip });
    res.json({ success: true, data: result });
  },

  me(req, res) {
    res.json({ success: true, data: req.user });
  },

  async changePassword(req, res) {
    await authService.changePassword(req.user.id, req.valid.body);
    res.json({ success: true, message: 'Password updated' });
  },
};
