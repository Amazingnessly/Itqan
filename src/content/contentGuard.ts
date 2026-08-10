import type { ControlledContentItem, ExerciseCategory } from "./types";

export function assertContentMayRender(
  item: ControlledContentItem,
  exerciseType: ExerciseCategory
): void {
  if (!item.arabicExact) {
    throw new Error(`Arabic content missing for ${item.id}`);
  }

  if (
    item.verification.visualPass1 !== true ||
    item.verification.visualPass2 !== true ||
    item.verification.ambiguous !== false
  ) {
    throw new Error(`Unverified or ambiguous Arabic content blocked: ${item.id}`);
  }

  if (item.integrity.normalizationApplied !== false) {
    throw new Error(`Normalized Arabic content blocked: ${item.id}`);
  }

  if (!item.allowedExerciseTypes.includes(exerciseType)) {
    throw new Error(
      `Exercise type ${exerciseType} not authorized for ${item.id}`
    );
  }
}
