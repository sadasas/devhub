import { describe, expect, it } from 'vitest';
import { buildMentionToken, parseChatRefs } from './chat-tokens';

describe('chat tokens', () => {
  it('builds a mention token with title, entity and id', () => {
    expect(buildMentionToken('Build login', 'tasks', 't1')).toBe('@[Build login](tasks:t1)');
  });

  it('parses a token back into a ref', () => {
    expect(parseChatRefs(buildMentionToken('Build login', 'tasks', 't1'))).toEqual([
      { entity: 'tasks', entityId: 't1' },
    ]);
  });

  it('parses multiple tokens and keeps their order', () => {
    const content =
      buildMentionToken('Build login', 'tasks', 't1') +
      ' lalu ' +
      buildMentionToken('Flaky test', 'issues', 'i9');
    expect(parseChatRefs(content)).toEqual([
      { entity: 'tasks', entityId: 't1' },
      { entity: 'issues', entityId: 'i9' },
    ]);
  });

  it('returns an empty list when there are no tokens', () => {
    expect(parseChatRefs('just a normal message')).toEqual([]);
    expect(parseChatRefs('')).toEqual([]);
  });

  it('ignores malformed tokens and plain @mentions', () => {
    expect(parseChatRefs('@[unclosed(tasks:t1')).toEqual([]);
    expect(parseChatRefs('@[no id](tasks)')).toEqual([]);
    expect(parseChatRefs('hey @budimantap')).toEqual([]);
    expect(parseChatRefs('@[broken](tasks:t1')).toEqual([]);
  });

  it('parses tokens with CJK and emoji titles', () => {
    expect(parseChatRefs('cek @[Tugas berbahasa Indonesia 👍](tasks:t1) ya')).toEqual([
      { entity: 'tasks', entityId: 't1' },
    ]);
  });

  it('parses tokens embedded in surrounding plain text', () => {
    const content = 'lihat @[Roadmap](whiteboards:wb1) di papan';
    expect(parseChatRefs(content)).toEqual([{ entity: 'whiteboards', entityId: 'wb1' }]);
  });

  it('does not deduplicate repeated tokens (caller owns dedupe)', () => {
    const token = buildMentionToken('Build login', 'tasks', 't1');
    expect(parseChatRefs(`${token} ${token}`)).toEqual([
      { entity: 'tasks', entityId: 't1' },
      { entity: 'tasks', entityId: 't1' },
    ]);
  });
});