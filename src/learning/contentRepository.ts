import type {
  ControlledBatch,
  ControlledContentItem,
  ExerciseBlueprint,
  ExerciseCategory,
} from "./types";

export class ControlledContentRepository {
  private readonly items = new Map<string, ControlledContentItem>();

  constructor(batches: ControlledBatch[]) {
    for (const batch of batches) {
      for (const item of batch.items) {
        if (this.items.has(item.id)) {
          throw new Error(`Duplicate controlled-content id: ${item.id}`);
        }
        this.items.set(item.id, item);
      }
    }
  }

  resolve(itemId: string, category: ExerciseCategory): ControlledContentItem {
    const item = this.items.get(itemId);

    if (!item) {
      throw new Error(`Unknown controlled-content id: ${itemId}`);
    }

    if (
      item.verification.visualPass1 !== true ||
      item.verification.visualPass2 !== true ||
      item.verification.ambiguous !== false
    ) {
      throw new Error(`Blocked unverified/ambiguous item: ${itemId}`);
    }

    if (!item.allowedExerciseTypes.includes(category)) {
      throw new Error(
        `Item ${itemId} is not authorized for exercise category ${category}`
      );
    }

    if (!item.eligibleForActiveLesson) {
      throw new Error(`Item ${itemId} is not eligible for active lessons`);
    }

    if (item.active !== true) {
      throw new Error(`Inactive controlled-content item blocked: ${itemId}`);
    }

    return item;
  }

  validateBlueprint(blueprint: ExerciseBlueprint): void {
    for (const session of blueprint.sessions) {
      if (session.interactionCount !== session.interactions.length) {
        throw new Error(`Interaction count mismatch in ${session.id}`);
      }

      for (const interaction of session.interactions) {
        this.resolve(interaction.itemId, blueprint.category);
      }
    }
  }
}
