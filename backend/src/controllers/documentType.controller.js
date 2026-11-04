import { documentTypeService } from '../services/documentType.service.js';
import { isStaff } from '../services/access.service.js';

export const documentTypeController = {
  list(req, res) {
    const includeInactive = isStaff(req.user) && req.query.all === 'true';
    res.json({ success: true, data: documentTypeService.list({ includeInactive }) });
  },

  get(req, res) {
    res.json({ success: true, data: documentTypeService.get(req.valid.params.key) });
  },

  create(req, res) {
    res.status(201).json({ success: true, data: documentTypeService.create(req.valid.body, { user: req.user, ip: req.ip }) });
  },

  update(req, res) {
    const data = documentTypeService.update(req.valid.params.key, req.valid.body, { user: req.user, ip: req.ip });
    res.json({ success: true, data });
  },
};
