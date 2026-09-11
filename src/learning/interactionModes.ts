export const SUPPORTED_INTERACTION_MODES = [
  "guided_scan",
  "exact_read",
  "unit_tracking",
  "oral_read",
  "delayed_recall",
  "mixed_exact_read",
  "delayed_check",
  "mark_focus",
  "verified_contrast",
  "contrast_from_verified_items",
  "precision_reread",
  "spot_shaddah",
  "decompose",
  "mixed_transfer",
  "spot_article",
  "classify_observed",
  "chunk_read",
  "connected_read",
  "phrase_read",
  "meaning_group_read",
  "hidden_timing",
] as const;

export type InteractionMode = (typeof SUPPORTED_INTERACTION_MODES)[number];

const SUPPORTED_INTERACTION_MODE_SET = new Set<string>(SUPPORTED_INTERACTION_MODES);

export function isSupportedInteractionMode(value: string): value is InteractionMode {
  return SUPPORTED_INTERACTION_MODE_SET.has(value);
}
