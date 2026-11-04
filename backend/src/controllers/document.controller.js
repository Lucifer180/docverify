import { documentService } from '../services/document.service.js';

export const documentController = {
  async upload(req, res) {
    const docs = await documentService.upload(req.user, req.valid.params.id, req.files, { ip: req.ip });
    res.status(201).json({ success: true, data: docs, message: `${docs.length} document(s) uploaded and queued for processing` });
  },

  fileLink(req, res) {
    res.json({ success: true, data: documentService.createFileLink(req.user, req.valid.params.id, { ip: req.ip }) });
  },

  serveFile(req, res) {
    const { stream, mimeType, name, size } = documentService.openFileByToken(req.valid.params.token);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Allow the frontend (a different port in development) to embed the file.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors *");
    stream.pipe(res);
  },

  async remove(req, res) {
    await documentService.remove(req.user, req.valid.params.id, { ip: req.ip });
    res.json({ success: true, message: 'Document deleted' });
  },

  reprocess(req, res) {
    const data = documentService.reprocess(req.user, req.valid.params.id, { ...req.valid.body, ip: req.ip });
    res.json({ success: true, data });
  },

  rawText(req, res) {
    res.json({ success: true, data: documentService.rawText(req.user, req.valid.params.id, { ip: req.ip }) });
  },

  versions(req, res) {
    res.json({ success: true, data: documentService.versions(req.user, req.valid.params.id, req.valid.query) });
  },

  async correct(req, res) {
    const data = await documentService.correctFields(req.user, req.valid.params.id, req.valid.body, { ip: req.ip });
    res.json({ success: true, data });
  },
};
