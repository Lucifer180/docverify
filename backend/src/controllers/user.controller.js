import { userService } from '../services/user.service.js';

export const userController = {
  list(req, res) {
    const { items, total } = userService.list(req.valid.query);
    res.json({ success: true, data: items, meta: { total, limit: req.valid.query.limit, offset: req.valid.query.offset } });
  },

  reviewers(_req, res) {
    res.json({ success: true, data: userService.listReviewers() });
  },

  async create(req, res) {
    const user = await userService.create(req.valid.body, { user: req.user, ip: req.ip });
    res.status(201).json({ success: true, data: user });
  },

  update(req, res) {
    const user = userService.update(req.valid.params.id, req.valid.body, { user: req.user, ip: req.ip });
    res.json({ success: true, data: user });
  },
};
