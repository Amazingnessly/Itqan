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
      // Batch status describes the manifest as a whole. Lesson activation is
      // deliberately item-scoped so a verified pilot subset can be enabled
      // without implicitly activating the rest of the batch.
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
    const sessionIds = new Set<string>();

    for (const session of blueprint.sessions) {
      if (!session.id || sessionIds.has(session.id)) {
        throw new Error(`Duplicate or empty lesson session id: ${session.id}`);
      }
      sessionIds.add(session.id);

      if (session.interactionCount !== session.interactions.length) {
        throw new Error(`Interaction count mismatch in ${session.id}`);
      }
      if (session.interactions.length === 0) {
        throw new Error(`Empty lesson session blocked: ${session.id}`);
      }

      const orders = new Set<number>();
      for (const [index, interaction] of session.interactions.entries()) {
        const expectedOrder = index + 1;
        if (!Number.isInteger(interaction.order) || interaction.order !== expectedOrder || orders.has(interaction.order)) {
          throw new Error(`Invalid interaction order in ${session.id}: expected ${expectedOrder}, got ${interaction.order}`);
        }
        if (interaction.precisionRequired !== true) {
          throw new Error(`Precision must remain required in ${session.id} interaction ${interaction.order}`);
        }
        if (interaction.timing !== "off" && interaction.timing !== "hidden") {
          throw new Error(`Invalid timing policy in ${session.id} interaction ${interaction.order}`);
        }
        if (interaction.voice !== "off" && interaction.voice !== "optional") {
          throw new Error(`Invalid voice policy in ${session.id} interaction ${interaction.order}`);
        }
        if (interaction.visibleArabicComesFromManifestOnly !== undefined && interaction.visibleArabicComesFromManifestOnly !== true) {
          throw new Error(`Visible Arabic source policy violated in ${session.id} interaction ${interaction.order}`);
        }
        orders.add(interaction.order);
        this.resolve(interaction.itemId, blueprint.category);
      }
    }
  }
}
