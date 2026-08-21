import { Router } from 'express';
import { requireAuth, getUserId } from '../../auth/middleware/requireAuth.js';
import {
  acceptTeamInvitation,
  changeMemberRole,
  createTeam,
  declineTeamInvitation,
  deleteTeamById,
  getTeam,
  inviteMember,
  kickMember,
  listInvitations,
  listInvitationsForTeam,
  listTeamMembers,
  listTeamsForUser,
  renameTeamById,
} from '../application/teamService.js';

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

teamsRouter.get('/', async (req, res) => {
  const userId = getUserId(req);
  res.json({ teams: await listTeamsForUser(userId) });
});

teamsRouter.post('/', async (req, res) => {
  const userId = getUserId(req);
  res.status(201).json(await createTeam(userId, req.body));
});

teamsRouter.get('/invitations', async (req, res) => {
  const userId = getUserId(req);
  res.json({ invitations: await listInvitations(userId) });
});

teamsRouter.get('/:teamId', async (req, res) => {
  const userId = getUserId(req);
  res.json(await getTeam(userId, req.params.teamId));
});

teamsRouter.patch('/:teamId', async (req, res) => {
  const userId = getUserId(req);
  await renameTeamById(userId, req.params.teamId, req.body);
  res.json({ ok: true });
});

teamsRouter.delete('/:teamId', async (req, res) => {
  const userId = getUserId(req);
  await deleteTeamById(userId, req.params.teamId);
  res.json({ ok: true });
});

teamsRouter.get('/:teamId/members', async (req, res) => {
  const userId = getUserId(req);
  res.json({ members: await listTeamMembers(userId, req.params.teamId) });
});

teamsRouter.patch('/:teamId/members/:userId', async (req, res) => {
  const userId = getUserId(req);
  await changeMemberRole(userId, req.params.teamId, req.params.userId, req.body);
  res.json({ ok: true });
});

teamsRouter.delete('/:teamId/members/:userId', async (req, res) => {
  const userId = getUserId(req);
  await kickMember(userId, req.params.teamId, req.params.userId);
  res.json({ ok: true });
});

teamsRouter.get('/:teamId/invitations', async (req, res) => {
  const userId = getUserId(req);
  res.json({ invitations: await listInvitationsForTeam(userId, req.params.teamId) });
});

teamsRouter.post('/:teamId/invitations', async (req, res) => {
  const userId = getUserId(req);
  res.status(201).json(await inviteMember(userId, req.params.teamId, req.body));
});

teamsRouter.post('/:teamId/invitations/:invitationId/accept', async (req, res) => {
  const userId = getUserId(req);
  res.json(await acceptTeamInvitation(userId, req.params.teamId, req.params.invitationId));
});

teamsRouter.delete('/:teamId/invitations/:invitationId', async (req, res) => {
  const userId = getUserId(req);
  await declineTeamInvitation(userId, req.params.teamId, req.params.invitationId);
  res.json({ ok: true });
});