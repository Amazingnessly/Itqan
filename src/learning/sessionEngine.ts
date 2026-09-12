import type { AttemptRecord, BlueprintInteraction, ExerciseBlueprint, LearnerState } from "./types";
import { ControlledContentRepository } from "./contentRepository";
import { appendAttempt, isCategoryUnlocked } from "./mastery";
import { isCanonicalAttemptTimestamp, MAX_FUTURE_CLOCK_SKEW_MS } from "./attemptTimestamp";
import { sanitizeLearnerState } from "./persistence";
import { mayObserveTiming } from "./timingPolicy";
import {
  controlledObservationPolicyForAttempt,
  isAttemptAuthorizedByControlledBlueprint,
  isSessionAvailableForActiveLesson,
  isSessionInteractionModeSequenceCanonical,
  isSessionItemSequenceCanonical,
  isSessionKnownToControlledBlueprint,
} from "./attemptRegistry.generated";

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

  private assertCanonicalSessionAvailable(sessionId: string): void {
    if (!isSessionKnownToControlledBlueprint(this.blueprint.category, sessionId)) {
      throw new Error(`Unknown controlled lesson session blocked: ${sessionId}`);
    }
    if (!isSessionAvailableForActiveLesson(this.blueprint.category, sessionId)) {
      throw new Error(`Inactive lesson session blocked: ${sessionId}`);
    }
  }

  private assertCanonicalSessionSequence(sessionId: string, interactions: BlueprintInteraction[]): void {
    if (!isSessionItemSequenceCanonical(
      this.blueprint.category,
      sessionId,
      interactions.map((interaction) => interaction.itemId),
    )) {
      throw new Error(`Controlled lesson item sequence mismatch blocked: ${sessionId}`);
    }
    if (!isSessionInteractionModeSequenceCanonical(this.blueprint.category, sessionId, interactions)) {
      throw new Error(`Controlled lesson interaction mode mismatch blocked: ${sessionId}`);
    }
  }

  private assertCanonicalInteractionAvailable(sessionId: string, interaction: BlueprintInteraction): void {
    const attemptKey = {
      category: this.blueprint.category,
      sessionId,
      itemId: interaction.itemId,
    };
    if (!isAttemptAuthorizedByControlledBlueprint(attemptKey)) {
      throw new Error(`Unauthorized controlled lesson interaction blocked: ${sessionId}/${interaction.itemId}`);
    }
    const policy = controlledObservationPolicyForAttempt(attemptKey);
    if (
      !policy ||
      policy.timing !== interaction.timing ||
      policy.voice !== interaction.voice
    ) {
      throw new Error(`Controlled observation policy mismatch blocked: ${sessionId}/${interaction.itemId}`);
    }
  }

  getSession(sessionId: string): ResolvedInteraction[] {
    const session = this.blueprint.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`Unknown lesson session: ${sessionId}`);
    this.assertCanonicalSessionAvailable(sessionId);
    this.assertCanonicalSessionSequence(sessionId, session.interactions);
    return session.interactions.map((interaction) => {
      this.assertCanonicalInteractionAvailable(sessionId, interaction);
      return {
        sessionId,
        category: this.blueprint.category,
        interaction,
        arabicExact: this.repository.resolve(interaction.itemId, this.blueprint.category).arabicExact,
      };
    });
  }

  record(state: LearnerState, input: Omit<AttemptRecord, "category">): LearnerState {
    const trustedState = sanitizeLearnerState(state);
    if (!trustedState) {
      throw new Error("Cannot record attempt from invalid learner state");
    }
    if (!isCategoryUnlocked(this.blueprint.category, trustedState)) {
      throw new Error(`Cannot record attempt for locked lesson category: ${this.blueprint.category}`);
    }
    const latestAllowedMs = Date.now() + MAX_FUTURE_CLOCK_SKEW_MS;
    if (!isCanonicalAttemptTimestamp(input.attemptedAt, latestAllowedMs)) {
      throw new Error(`Cannot record attempt with invalid timestamp: ${input.attemptedAt}`);
    }
    const session = this.blueprint.sessions.find((candidate) => candidate.id === input.sessionId);
    if (!session) throw new Error(`Cannot record attempt for unknown lesson session: ${input.sessionId}`);
    this.assertCanonicalSessionAvailable(input.sessionId);
    this.assertCanonicalSessionSequence(input.sessionId, session.interactions);
    for (const candidate of session.interactions) {
      this.assertCanonicalInteractionAvailable(input.sessionId, candidate);
      this.repository.resolve(candidate.itemId, this.blueprint.category);
    }
    const interaction = session.interactions.find((candidate) => candidate.itemId === input.itemId);
    if (!interaction) {
      throw new Error(`Cannot record item ${input.itemId} outside lesson session ${input.sessionId}`);
    }
    const skill = trustedState.skills[this.blueprint.category];
    const timing = mayObserveTiming(interaction, skill) ? input.timing : undefined;
    const voice = interaction.voice === "optional" ? input.voice : undefined;
    return appendAttempt(trustedState, { ...input, timing, voice, category: this.blueprint.category });
  }
}
