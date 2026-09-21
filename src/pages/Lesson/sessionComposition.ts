export type SessionComposition = {
  interactionCount: number;
  distinctItemIdCount: number;
  plannedRevisitCount: number;
};

export function sessionComposition(
  interactions: readonly { itemId: string }[],
): SessionComposition {
  const interactionCount = interactions.length;
  const distinctItemIdCount = new Set(
    interactions.map(({ itemId }) => itemId),
  ).size;

  return {
    interactionCount,
    distinctItemIdCount,
    plannedRevisitCount: interactionCount - distinctItemIdCount,
  };
}

export function sessionCompositionLabel(composition: SessionComposition): string {
  const { interactionCount, distinctItemIdCount, plannedRevisitCount } = composition;
  return [
    `${interactionCount} interaction${interactionCount > 1 ? "s" : ""}`,
    `${distinctItemIdCount} itemId${distinctItemIdCount > 1 ? "s" : ""} contrôlé${distinctItemIdCount > 1 ? "s" : ""} distinct${distinctItemIdCount > 1 ? "s" : ""}`,
    `${plannedRevisitCount} revisite${plannedRevisitCount > 1 ? "s" : ""} pédagogique${plannedRevisitCount > 1 ? "s" : ""} planifiée${plannedRevisitCount > 1 ? "s" : ""}`,
  ].join(" · ");
}
