import { hasPrecisionStability } from "./mastery";
import type { BlueprintInteraction, SkillState } from "./types";

export function mayObserveTiming(interaction: BlueprintInteraction, skill: SkillState): boolean {
  return interaction.timing === "hidden" && hasPrecisionStability(skill);
}
