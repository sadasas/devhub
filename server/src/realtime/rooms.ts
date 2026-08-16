import type { WebSocket } from 'ws';

/**
 * Generic room registry for the real-time server (ADR-024).
 *
 * Rooms are plain string keys (`project:{id}`, later `team:{id}` for M13).
 * A socket can be a member of several rooms at once, so membership lives
 * per (room, socket) pair; `leaveAll` removes a socket from every room.
 */
export class RoomRegistry {
  private readonly rooms = new Map<string, Set<WebSocket>>();

  join(room: string, socket: WebSocket): void {
    let members = this.rooms.get(room);
    if (!members) {
      members = new Set();
      this.rooms.set(room, members);
    }
    members.add(socket);
  }

  leave(room: string, socket: WebSocket): void {
    const members = this.rooms.get(room);
    if (!members) return;
    members.delete(socket);
    if (members.size === 0) this.rooms.delete(room);
  }

  /**
   * Members of a room as an array (empty when the room does not exist).
   * Used by presence snapshots to enumerate who is online.
   */
  members(room: string): WebSocket[] {
    return [...(this.rooms.get(room) ?? [])];
  }

  /**
   * Removes a socket from every room; returns the room keys it left
   * (for presence follow-up broadcasts).
   */
  leaveAll(socket: WebSocket): string[] {
    const left: string[] = [];
    for (const [room, members] of this.rooms) {
      if (members.delete(socket)) {
        left.push(room);
        if (members.size === 0) this.rooms.delete(room);
      }
    }
    return left;
  }

  size(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }

  broadcast(room: string, message: unknown, except?: WebSocket): void {
    const members = this.rooms.get(room);
    if (!members) return;
    const data = JSON.stringify(message);
    for (const member of members) {
      if (member !== except && member.readyState === member.OPEN) member.send(data);
    }
  }
}
