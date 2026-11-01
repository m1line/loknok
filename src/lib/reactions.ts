import type { MessageReactionRow } from '@/lib/types';

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface ReactionSummary {
  emoji: ReactionEmoji;
  count: number;
  mine: boolean;
}

function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value);
}

export function summarizeReactions(rows: MessageReactionRow[], myProfileId: string): Map<string, ReactionSummary[]> {
  const byMessage = new Map<string, Map<ReactionEmoji, ReactionSummary>>();
  for (const row of rows) {
    if (!isReactionEmoji(row.emoji)) continue;
    const emojis = byMessage.get(row.message_id) ?? new Map<ReactionEmoji, ReactionSummary>();
    const summary = emojis.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
    summary.count += 1;
    if (row.profile_id === myProfileId) summary.mine = true;
    emojis.set(row.emoji, summary);
    byMessage.set(row.message_id, emojis);
  }

  const result = new Map<string, ReactionSummary[]>();
  byMessage.forEach((emojis, messageId) => {
    result.set(
      messageId,
      REACTION_EMOJIS.flatMap((emoji) => {
        const summary = emojis.get(emoji);
        return summary ? [summary] : [];
      })
    );
  });
  return result;
}
