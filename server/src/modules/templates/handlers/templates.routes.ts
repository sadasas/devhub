import { Router } from 'express';
import { requireAuth, getUserId } from '../../auth/middleware/requireAuth.js';
import { parseOrThrow } from '../../../shared/db.js';
import {
  instantiateTemplateSchema,
  saveTemplateSchema,
  updateTemplateSchema,
} from '../domain/templates.js';
import {
  deleteTemplate,
  getTemplate,
  instantiateTemplate,
  listTemplates,
  saveTemplate,
  templateJson,
  updateTemplate,
} from '../application/templateService.js';

// Thin router: validate (zod) -> call service -> respond.
// All ownership checks live in templateService (owner-only, 404 for non-owners).

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

templatesRouter.post('/', async (req, res) => {
  const userId = getUserId(req);
  const input = parseOrThrow(saveTemplateSchema, req.body, 'Invalid template data');
  const row = await saveTemplate(userId, input);
  res.status(201).json({ template: templateJson(row) });
});

templatesRouter.get('/', async (req, res) => {
  const userId = getUserId(req);
  const rows = await listTemplates(userId);
  res.json({ templates: rows.map((r) => templateJson(r)) });
});

templatesRouter.get('/:templateId', async (req, res) => {
  const userId = getUserId(req);
  const row = await getTemplate(userId, req.params.templateId as string);
  res.json({ template: templateJson(row, true) });
});

templatesRouter.patch('/:templateId', async (req, res) => {
  const userId = getUserId(req);
  const input = parseOrThrow(updateTemplateSchema, req.body ?? {}, 'Invalid template data');
  const row = await updateTemplate(userId, req.params.templateId as string, input);
  res.json({ template: templateJson(row) });
});

templatesRouter.delete('/:templateId', async (req, res) => {
  const userId = getUserId(req);
  await deleteTemplate(userId, req.params.templateId as string);
  res.json({ ok: true });
});

templatesRouter.post('/:templateId/instantiate', async (req, res) => {
  const userId = getUserId(req);
  const input = parseOrThrow(instantiateTemplateSchema, req.body ?? {}, 'Invalid project data');
  const projectId = await instantiateTemplate(userId, req.params.templateId as string, input);
  res.status(201).json({ projectId });
});
