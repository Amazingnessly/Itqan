import type { AttemptRecord, BlueprintInteraction, ExerciseBlueprint, LearnerState } from "./types";
import { ControlledContentRepository } from "./contentRepository";
import { appendAttempt, isCategoryUnlocked } from "./mastery";

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
    if (!isCategoryUnlocked(this.blueprint.category, state)) {
      throw new Error(`Cannot record attempt for locked lesson category: ${this.blueprint.category}`);
    }
    const session = this.blueprint.sessions.find((candidate) => candidate.id === input.sessionId);
    if (!session) throw new Error(`Cannot record attempt for unknown lesson session: ${input.sessionId}`);
    const interaction = session.interactions.find((candidate) => candidate.itemId === input.itemId);
    if (!interaction) {
      throw new Error(`Cannot record item ${input.itemId} outside lesson session ${input.sessionId}`);
    }
    const timing = interaction.timing === "hidden" ? input.timing : undefined;
    const voice = interaction.voice === "optional" ? input.voice : undefined;
    return appendAttempt(state, { ...input, timing, voice, category: this.blueprint.category });
  }
}
