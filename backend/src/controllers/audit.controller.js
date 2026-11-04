import { auditService } from '../services/audit.service.js';

export const auditController = {
  list(req, res) {
    const { items, total } = auditService.list(req.valid.query);
    res.json({ success: true, data: items, meta: { total, limit: req.valid.query.limit, offset: req.valid.query.offset } });
  },
};
