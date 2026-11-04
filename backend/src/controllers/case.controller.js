import { caseService } from '../services/case.service.js';
import { reviewService } from '../services/review.service.js';
import { buildReport, renderReportHtml } from '../services/report.service.js';

export const caseController = {
  create(req, res) {
    res.status(201).json({ success: true, data: caseService.create(req.user, req.valid.body, { ip: req.ip }) });
  },

  list(req, res) {
    const { items, total } = caseService.list(req.user, req.valid.query);
    res.json({ success: true, data: items, meta: { total, limit: req.valid.query.limit, offset: req.valid.query.offset } });
  },

  get(req, res) {
    const data = caseService.getDetail(req.user, req.valid.params.id, { reveal: req.valid.query.reveal, ip: req.ip });
    res.json({ success: true, data });
  },

  async update(req, res) {
    const data = await caseService.update(req.user, req.valid.params.id, req.valid.body, { ip: req.ip });
    res.json({ success: true, data });
  },

  submit(req, res) {
    res.json({ success: true, data: caseService.submit(req.user, req.valid.params.id, { ip: req.ip }) });
  },

  assign(req, res) {
    const data = caseService.assign(req.user, req.valid.params.id, req.valid.body.reviewerId, { ip: req.ip });
    res.json({ success: true, data });
  },

  decide(req, res) {
    const data = reviewService.decide(req.user, req.valid.params.id, req.valid.body, { ip: req.ip });
    res.json({ success: true, data });
  },

  history(req, res) {
    res.json({ success: true, data: caseService.history(req.user, req.valid.params.id) });
  },

  report(req, res) {
    const report = buildReport(req.user, req.valid.params.id, { ip: req.ip });
    const filename = `verification-report-${report.case.reference}`;
    if (req.valid.query.format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      return res.json(report);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${filename}.html"`);
    // The report page has its own inline styles and a print button.
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
    return res.send(renderReportHtml(report));
  },

  dashboard(req, res) {
    res.json({ success: true, data: caseService.dashboard(req.user) });
  },
};
