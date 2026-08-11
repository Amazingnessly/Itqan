import type { AttemptRecord, BlueprintInteraction, ExerciseBlueprint, LearnerState } from "./types";
import { ControlledContentRepository } from "./contentRepository";
import { appendAttempt } from "./mastery";

export type ResolvedInteraction = {
  sessionId: string;
  category: ExerciseBlueprint["category"];
  interaction: BlueprintInteraction;
  arabicExact: string;
};

export class LessonSessionEngine {
  constructor(private readonly repository: ControlledContentRepository, private readonly blueprint: ExerciseBlueprint) {
    repository.validateBlueprint(blueprint);
  }

  getSession(sessionId: string): ResolvedInteraction[] {
    const session = this.blueprint.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`Unknown lesson session: ${sessionId}`);
    return session.interactions.map((interaction) => ({
      sessionId,
      category: this.blueprint.category,
      interaction,
      arabicExact: this.repository.resolve(interaction.itemId, this.blueprint.category).arabicExact,
    }));
  }

  record(state: LearnerState, input: Omit<AttemptRecord, "category">): LearnerState {
    return appendAttempt(state, { ...input, category: this.blueprint.category });
  }
}
