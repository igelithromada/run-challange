import { parseActivityDate } from './runData';

export const CHAT_CHANGED = 'dolni-lhota:chat-changed';

export type ChatRecord = {
  id: string;
  nickname: string;
  avatarUrl?: string;
  type: string;
  timestamp: string | null;
  description: string;
  km: number;
  minuty: number;
  tempo: number;
  repetitions: number;
};
export type ChatReply = { id: string; nickname: string; text: string };
export type ChatUnread = {
  version: string;
  enabled: boolean;
  unread?: number;
  newestIncomingAt?: number;
};

export function chatRecord(id: string, run: Record<string, unknown> | undefined): ChatRecord | null {
  if (!run || run.deleting || typeof run.uid !== 'string' || !run.uid) return null;
  const nickname = typeof run.nickname === 'string' ? run.nickname.trim().slice(0, 80) : '';
  const type = typeof run.type === 'string' && run.type ? run.type : run.activityType;
  const amount = (value: unknown) => {
    const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0;
    return Number.isFinite(number) && number > 0 ? number : 0;
  };

  return {
    id,
    nickname: nickname || 'Uživatel',
    ...(typeof run.avatarUrl === 'string' && run.avatarUrl ? { avatarUrl: run.avatarUrl } : {}),
    type: typeof type === 'string' && type ? type : 'běh',
    timestamp: parseActivityDate(run.timestamp)?.toISOString() ?? null,
    description: typeof run.description === 'string' ? run.description.trim().slice(0, 1000) : '',
    km: amount(run.km),
    minuty: amount(run.minuty),
    tempo: amount(run.tempo),
    repetitions: amount(run.repetitions),
  };
}
