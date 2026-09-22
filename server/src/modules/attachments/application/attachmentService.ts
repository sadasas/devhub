import { randomUUID } from 'node:crypto';
import { ApiError } from '../../../shared/errors.js';
import { pool } from '../../../db/pool.js';
import { withTransaction } from '../../../shared/db.js';
import { nowIso, newId } from '../../../shared/ids.js';
import {
  assertWrite,
  getProjectWithRole,
  getTeamWithRole,
} from '../../authorization/application/authz.js';
import { getTeamUsage } from '../../plans/infrastructure/planRepository.js';
import { PLAN_LIMIT_CODE } from '../../plans/domain/plans.js';
import { mutateProject } from '../../projects/application/entityService.js';
import { entitySummary, type ActivityDraft } from '../../activity/application/activity.js';
import { broadcastDiff } from '../../realtime/infrastructure/broadcast.js';
import {
  isAllowedMime,
  isHttpUrl,
  MAX_ATTACHMENTS_PER_ENTITY,
  type AttachableEntity,
  type Attachment,
} from '../domain/attachment.js';
import {
  isStorageEnabled,
  maxUploadBytes,
  mintDownloadUrl,
  mintUploadUrl,
  removeObject,
} from '../infrastructure/storageClient.js';

function fileKey(
  teamId: string,
  projectId: string,
  entity: AttachableEntity,
  entityId: string,
  name: string,
): string {
  const safe = name.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'file';
  return `${teamId}/${projectId}/${entity}/${entityId}/${randomUUID()}-${safe}`;
}

function expectedPrefix(teamId: string, projectId: string, entity: AttachableEntity, entityId: string): string {
  return `${teamId}/${projectId}/${entity}/${entityId}/`;
}

async function requireWritable(
  userId: string,
  projectId: string,
): Promise<{ teamId: string; role: string }> {
  const row = await getProjectWithRole(userId, projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  assertWrite(row.role);
  return { teamId: row.team_id, role: row.role };
}

/** Kunci baris tim + pastikan kuota masih cukup, lalu reservasi sebesar size. */
export async function reserveQuota(teamId: string, size: number): Promise<void> {
  await withTransaction(pool, async (client) => {
    const teamRes = await client.query<{ storage_used_bytes: string }>(
      'SELECT storage_used_bytes FROM teams WHERE id = $1 FOR UPDATE',
      [teamId],
    );
    const teamRow = teamRes.rows[0];
    if (!teamRow) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
    const usage = await getTeamUsage(teamId);
    const limit = usage?.storageLimit ?? null;
    const used = Number(teamRow.storage_used_bytes);
    if (limit !== null && used + size > limit) {
      throw new ApiError(402, PLAN_LIMIT_CODE, 'DevHub storage is full on your current plan', {
        resource: 'storage',
        limit,
        used,
      });
    }
    await client.query('UPDATE teams SET storage_used_bytes = storage_used_bytes + $2 WHERE id = $1', [
      teamId,
      size,
    ]);
  });
}

export async function releaseQuota(teamId: string, size: number): Promise<void> {
  if (size <= 0) return;
  await pool.query(
    'UPDATE teams SET storage_used_bytes = GREATEST(0, storage_used_bytes - $2) WHERE id = $1',
    [teamId, size],
  );
}

export interface SignUploadInput {
  projectId: string;
  entity: AttachableEntity;
  entityId: string;
  name: string;
  mime: string;
  size: number;
}

export async function signUpload(userId: string, input: SignUploadInput) {
  if (!isStorageEnabled()) {
    throw new ApiError(503, 'STORAGE_DISABLED', 'File uploads are not enabled on this workspace plan');
  }
  const { teamId } = await requireWritable(userId, input.projectId);
  const maxBytes = maxUploadBytes();
  if (input.size > maxBytes) {
    throw new ApiError(413, 'FILE_TOO_LARGE', `Files are limited to ${Math.round(maxBytes / 1048576)} MB`);
  }
  if (!isAllowedMime(input.mime)) {
    throw new ApiError(415, 'UNSUPPORTED_FILE', 'This file type must be added as a link instead');
  }
  const usage = await getTeamUsage(teamId);
  const limit = usage?.storageLimit ?? null;
  const used = usage?.storageUsed ?? 0;
  if (limit !== null && used + input.size > limit) {
    throw new ApiError(402, PLAN_LIMIT_CODE, 'DevHub storage is full on your current plan', {
      resource: 'storage',
      limit,
      used,
    });
  }
  const storageKey = fileKey(teamId, input.projectId, input.entity, input.entityId, input.name);
  const { uploadUrl, expiresIn } = await mintUploadUrl(storageKey);
  return { uploadUrl, storageKey, expiresIn };
}

export interface ConfirmInput {
  projectId: string;
  entity: AttachableEntity;
  entityId: string;
  attachment: Attachment;
}

export async function confirmAttachment(userId: string, input: ConfirmInput) {
  const { teamId } = await requireWritable(userId, input.projectId);
  const att = input.attachment;
  if (att.provider !== 'devhub' || !att.storageKey) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Only DevHub storage uploads can be confirmed here');
  }
  if (!att.storageKey.startsWith(expectedPrefix(teamId, input.projectId, input.entity, input.entityId))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Storage key does not belong to this item');
  }
  if (att.size > maxUploadBytes()) {
    throw new ApiError(413, 'FILE_TOO_LARGE', 'File exceeds the per-file limit');
  }
  await reserveQuota(teamId, att.size);
  try {
    const { version, state } = await mutateProject(userId, input.projectId, undefined, (state) => {
      const items = (state[input.entity] as Array<Record<string, unknown>> | undefined) ?? [];
      const idx = items.findIndex((i) => i.id === input.entityId);
      if (idx === -1) {
        throw new ApiError(404, 'NOT_FOUND', `${input.entity === 'tasks' ? 'Task' : 'Issue'} not found`);
      }
      const before = items[idx]!;
      const current = Array.isArray(before.attachments) ? (before.attachments as Attachment[]) : [];
      if (current.some((a) => a.id === att.id)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Attachment already linked');
      }
      if (current.length >= MAX_ATTACHMENTS_PER_ENTITY) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Attachment limit reached for this item');
      }
      const after = {
        ...before,
        attachments: [...current, { ...att, linkedBy: userId, linkedAt: nowIso() }],
        updatedAt: nowIso(),
      };
      items[idx] = after;
      return {
        entity: input.entity,
        entityId: input.entityId,
        action: 'updated',
        summary: entitySummary(input.entity, before, before, after),
        before,
        after,
      } satisfies ActivityDraft;
    });
    broadcastDiff(input.projectId, {
      type: 'state:diff',
      projectId: input.projectId,
      version,
      ops: [
        {
          entity: input.entity,
          id: input.entityId,
          op: 'updated',
          after: fullItem(state, input.entity, input.entityId),
        },
      ],
    });
    return { ok: true as const, version };
  } catch (err) {
    await releaseQuota(teamId, att.size);
    throw err;
  }
}

/** Ambil item penuh dari state pasca-mutasi untuk broadcast (replace semantics). */
function fullItem(
  state: Record<string, unknown>,
  entity: AttachableEntity,
  entityId: string,
): Record<string, unknown> {
  const items = (state[entity] as Array<Record<string, unknown>> | undefined) ?? [];
  const found = items.find((i) => i.id === entityId);
  if (!found) throw new ApiError(500, 'INTERNAL', 'Mutation did not persist');
  return found;
}

export interface AddLinkInput {
  projectId: string;
  entity: AttachableEntity;
  entityId: string;
  name: string;
  url: string;
}

export async function addLink(userId: string, input: AddLinkInput) {
  await requireWritable(userId, input.projectId);
  if (!isHttpUrl(input.url)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Link must be a valid http(s) URL');
  }
  const attachment: Attachment = {
    id: newId(),
    provider: 'link',
    name: input.name,
    mime: '',
    size: 0,
    storageKey: null,
    url: input.url,
    linkedBy: userId,
    linkedAt: nowIso(),
  };
  const { version, state } = await mutateProject(userId, input.projectId, undefined, (state) => {
    const items = (state[input.entity] as Array<Record<string, unknown>> | undefined) ?? [];
    const idx = items.findIndex((i) => i.id === input.entityId);
    if (idx === -1) {
      throw new ApiError(404, 'NOT_FOUND', `${input.entity === 'tasks' ? 'Task' : 'Issue'} not found`);
    }
    const before = items[idx]!;
    const current = Array.isArray(before.attachments) ? (before.attachments as Attachment[]) : [];
    if (current.length >= MAX_ATTACHMENTS_PER_ENTITY) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Attachment limit reached for this item');
    }
    const after = { ...before, attachments: [...current, attachment], updatedAt: nowIso() };
    items[idx] = after;
    return {
      entity: input.entity,
      entityId: input.entityId,
      action: 'updated',
      summary: entitySummary(input.entity, before, before, after),
      before,
      after,
    } satisfies ActivityDraft;
  });
  broadcastDiff(input.projectId, {
    type: 'state:diff',
    projectId: input.projectId,
    version,
    ops: [
      {
        entity: input.entity,
        id: input.entityId,
        op: 'updated',
        after: fullItem(state, input.entity, input.entityId),
      },
    ],
  });
  return { attachment, version };
}

export async function removeAttachment(
  userId: string,
  projectId: string,
  entity: AttachableEntity,
  entityId: string,
  attachmentId: string,
) {
  const { teamId } = await requireWritable(userId, projectId);
  let removed: Attachment | null = null;
  const { version, state } = await mutateProject(userId, projectId, undefined, (state) => {
    const items = (state[entity] as Array<Record<string, unknown>> | undefined) ?? [];
    const idx = items.findIndex((i) => i.id === entityId);
    if (idx === -1) throw new ApiError(404, 'NOT_FOUND', 'Item not found');
    const before = items[idx]!;
    const current = Array.isArray(before.attachments) ? (before.attachments as Attachment[]) : [];
    const target = current.find((a) => a.id === attachmentId);
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'Attachment not found');
    removed = target;
    const after = {
      ...before,
      attachments: current.filter((a) => a.id !== attachmentId),
      updatedAt: nowIso(),
    };
    items[idx] = after;
    return {
      entity,
      entityId,
      action: 'updated',
      summary: entitySummary(entity, before, before, after),
      before,
      after,
    } satisfies ActivityDraft;
  });
  if (removed && (removed as Attachment).provider === 'devhub') {
    const gone = removed as Attachment;
    await releaseQuota(teamId, gone.size);
    if (gone.storageKey) await removeObject(gone.storageKey);
  }
  broadcastDiff(projectId, {
    type: 'state:diff',
    projectId,
    version,
    ops: [{ entity, id: entityId, op: 'updated', after: fullItem(state, entity, entityId) }],
  });
  return { ok: true as const, version };
}

export async function signDownload(userId: string, projectId: string, attachmentId: string) {
  const row = await getProjectWithRole(userId, projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  if (!isStorageEnabled()) {
    throw new ApiError(503, 'STORAGE_DISABLED', 'File downloads are not available right now');
  }
  const data = row.data as {
    tasks?: Array<{ attachments?: Attachment[] } & Record<string, unknown>>;
    issues?: Array<{ attachments?: Attachment[] } & Record<string, unknown>>;
  };
  const all = [...(data.tasks ?? []), ...(data.issues ?? [])];
  const found = all.flatMap((i) => i.attachments ?? []).find((a) => a.id === attachmentId);
  if (!found || found.provider !== 'devhub' || !found.storageKey) {
    throw new ApiError(404, 'NOT_FOUND', 'Attachment not found');
  }
  const { downloadUrl, expiresIn } = await mintDownloadUrl(found.storageKey);
  return { downloadUrl, expiresIn, name: found.name, mime: found.mime, size: found.size };
}

/** Batalkan upload staged (new modal ditutup tanpa save): hapus objek yatim.
 *  Kuota tak berubah karena reservasi baru terjadi saat entity tersimpan. */
export async function abandonUpload(userId: string, projectId: string, storageKey: string) {
  const { teamId } = await requireWritable(userId, projectId);
  if (!storageKey || !storageKey.startsWith(`${teamId}/${projectId}/`)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Storage key does not belong to this project');
  }
  await removeObject(storageKey);
  return { ok: true as const };
}

/** Dipakai entity-router saat task/issue dihapus: kembalikan kuota + hapus objek. */
export async function releaseProjectEntityAttachments(
  projectId: string,
  attachments: Attachment[] | undefined,
): Promise<void> {
  const owned = (attachments ?? []).filter((a) => a.provider === 'devhub' && a.size > 0);
  if (owned.length === 0) return;
  const res = await pool.query<{ team_id: string }>('SELECT team_id FROM projects WHERE id = $1', [projectId]);
  const teamId = res.rows[0]?.team_id;
  if (!teamId) return;
  await releaseEntityAttachments(teamId, owned);
}
export async function releaseEntityAttachments(
  teamId: string,
  attachments: Attachment[] | undefined,
): Promise<void> {
  const owned = (attachments ?? []).filter((a) => a.provider === 'devhub' && a.size > 0);
  if (owned.length === 0) return;
  const total = owned.reduce((n, a) => n + a.size, 0);
  await releaseQuota(teamId, total);
  await Promise.all(owned.map((a) => (a.storageKey ? removeObject(a.storageKey) : Promise.resolve())));
}

/**
 * Hitung ulang counter tim dari seluruh state proyek (pengaman drift,
 * mis. setelah import massal). Hanya editor+.
 */
export async function reconcileTeamStorage(userId: string, teamId: string) {
  const membership = await getTeamWithRole(userId, teamId);
  if (!membership) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertWrite(membership.role);
  const res = await pool.query<{ data: unknown }>('SELECT data FROM projects WHERE team_id = $1', [teamId]);
  let total = 0;
  for (const row of res.rows) {
    const data = row.data as {
      tasks?: Array<{ attachments?: Attachment[] }>;
      issues?: Array<{ attachments?: Attachment[] }>;
    };
    for (const item of [...(data.tasks ?? []), ...(data.issues ?? [])]) {
      for (const a of item.attachments ?? []) {
        if (a.provider === 'devhub' && a.size > 0) total += a.size;
      }
    }
  }
  await pool.query('UPDATE teams SET storage_used_bytes = $2 WHERE id = $1', [teamId, total]);
  return { storageUsedBytes: total };
}
