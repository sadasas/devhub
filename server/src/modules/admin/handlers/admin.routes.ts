import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, getUserId } from '../../auth/middleware/requireAuth.js';
import { parseOrThrow } from '../../../shared/db.js';
import { ApiError } from '../../../shared/errors.js';
import {
  getPlatformStats,
  getPlatformStatsCharts,
  getActivityByRange,
  listAllPayments,
  listPlatformTeams,
  listPlatformUsers,
  setUserRole,
} from '../application/adminService.js';
import { requireAdmin } from './require-admin.js';
import { updateTeamPlan } from '../../plans/application/quotaService.js';
import {
  createNewPackage,
  listPackagesForAdmin,
  patchPackage,
  removePackage,
} from '../../billing/application/packagesAdmin.js';

const listQuerySchema = z.object({
  query: z.string().trim().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  plan: z.enum(['free', 'pro', 'paid']).optional(),
});

const roleSchema = z.object({ role: z.enum(['user', 'admin']) });
const planSchema = z.object({
  plan: z.enum(['free', 'pro']),
  packageId: z.string().uuid().optional(),
  durationDays: z.number().int().positive().optional(),
});
const paymentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['pending', 'completed']).optional(),
  teamId: z.string().uuid().optional(),
});

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/stats', async (_req, res) => {
  res.json(await getPlatformStats());
});

adminRouter.get('/stats/charts', async (_req, res) => {
  res.json(await getPlatformStatsCharts());
});

adminRouter.get('/stats/activity', async (req, res) => {
  const range = z.enum(['1d', '7d', '1m', '6m', '12m']).catch('7d').parse(req.query.range);
  res.json(await getActivityByRange(range));
});

adminRouter.get('/users', async (req, res) => {
  const { query, limit, offset, plan } = parseOrThrow(listQuerySchema, req.query, 'Invalid query parameters');
  res.json(await listPlatformUsers(query, limit, offset, plan));
});

adminRouter.patch('/users/:userId/role', async (req, res) => {
  const actorId = getUserId(req);
  const { role } = parseOrThrow(roleSchema, req.body, 'Invalid role data');
  res.json(await setUserRole(actorId, req.params.userId ?? '', role));
});

adminRouter.get('/teams', async (req, res) => {
  const { limit } = parseOrThrow(listQuerySchema.pick({ limit: true }), req.query, 'Invalid query parameters');
  res.json(await listPlatformTeams(limit));
});

adminRouter.patch('/teams/:teamId/plan', async (req, res) => {
  const { plan, packageId, durationDays } = parseOrThrow(planSchema, req.body, 'Invalid plan data');
  const row = await updateTeamPlan(req.params.teamId ?? '', plan, packageId, durationDays);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  res.json(row);
});

adminRouter.get('/packages', async (_req, res) => {
  res.json(await listPackagesForAdmin());
});

adminRouter.post('/packages', async (req, res) => {
  res.status(201).json(await createNewPackage(req.body));
});

adminRouter.patch('/packages/:packageId', async (req, res) => {
  res.json(await patchPackage(req.params.packageId ?? '', req.body));
});

adminRouter.delete('/packages/:packageId', async (req, res) => {
  await removePackage(req.params.packageId ?? '');
  res.json({ ok: true });
});

adminRouter.get('/payments', async (req, res) => {
  const { limit, offset, status, teamId } = parseOrThrow(paymentsQuerySchema, req.query, 'Invalid query parameters');
  res.json(await listAllPayments(limit, offset, status, teamId));
});
