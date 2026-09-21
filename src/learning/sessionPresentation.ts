export type SessionItemOutline = {
  interactionCount: number;
  controlledItemCount: number;
  plannedRevisitCount: number;
  revisitIndexes: ReadonlySet<number>;
};

/**
 * Describes the visible session sequence from controlled itemIds only.
 * A later occurrence of an itemId is a planned revisit, not a new item.
 */
export function sessionItemOutline(itemIds: readonly string[]): SessionItemOutline {
  const seen = new Set<string>();
  const revisitIndexes = new Set<number>();

  itemIds.forEach((itemId, index) => {
    if (seen.has(itemId)) revisitIndexes.add(index);
    else seen.add(itemId);
  });

  return {
    interactionCount: itemIds.length,
    controlledItemCount: seen.size,
    plannedRevisitCount: revisitIndexes.size,
    revisitIndexes,
  };
}
