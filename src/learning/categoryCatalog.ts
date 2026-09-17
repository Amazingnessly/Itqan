import type { ExerciseCategory } from "./types";

export type CategoryResources = {
  manifestUrl: string;
  blueprintUrl: string;
};

export type LearningStageId =
  | "reading_units"
  | "vowels_sukun"
  | "article_qamariyyah"
  | "shaddah"
  | "article_shamsiyyah"
  | "linking"
  | "fluent_reading";

export type LearningStageDefinition = {
  id: LearningStageId;
  category: ExerciseCategory;
  label: string;
  sessionIds?: readonly string[];
};

export const CATEGORY_ORDER: ExerciseCategory[] = [
  "reading_units",
  "vowels_sukun",
  "shaddah",
  "article_al",
  "linking",
  "fluent_reading",
];

export const ARTICLE_QAMARIYYAH_SESSION_IDS = [
  "ARTICLE_AL-B02-S01",
  "ARTICLE_AL-B02-S02",
  "ARTICLE_AL-B02-S03",
] as const;

export const ARTICLE_SHAMSIYYAH_SESSION_IDS = [
  "ARTICLE_AL-B02-S04",
  "ARTICLE_AL-B02-S05",
  "ARTICLE_AL-B02-S06",
] as const;

export const LEARNING_STAGES: readonly LearningStageDefinition[] = [
  { id: "reading_units", category: "reading_units", label: "Unités de lecture" },
  { id: "vowels_sukun", category: "vowels_sukun", label: "Voyelles & Sukūn" },
  {
    id: "article_qamariyyah",
    category: "article_al",
    label: "Alif-lām — qamariyyah",
    sessionIds: ARTICLE_QAMARIYYAH_SESSION_IDS,
  },
  { id: "shaddah", category: "shaddah", label: "Shaddah" },
  {
    id: "article_shamsiyyah",
    category: "article_al",
    label: "Alif-lām — shamsiyyah",
    sessionIds: ARTICLE_SHAMSIYYAH_SESSION_IDS,
  },
  { id: "linking", category: "linking", label: "Enchaînement" },
  { id: "fluent_reading", category: "fluent_reading", label: "Lecture fluide" },
];

export function learningStage(id: LearningStageId): LearningStageDefinition {
  const stage = LEARNING_STAGES.find((candidate) => candidate.id === id);
  if (!stage) throw new Error(`Unknown learning stage: ${id}.`);
  return stage;
}

export const CATEGORY_RESOURCES: Record<ExerciseCategory, CategoryResources> = {
  reading_units: {
    manifestUrl: "/content/verified/s110-batch01.json",
    blueprintUrl: "/content/blueprints/units-batch01.json",
  },
  vowels_sukun: {
    manifestUrl: "/content/verified/s110-batch02.json",
    blueprintUrl: "/content/blueprints/vowels_sukun-batch02.json",
  },
  shaddah: {
    manifestUrl: "/content/verified/s110-batch02.json",
    blueprintUrl: "/content/blueprints/shaddah-batch02.json",
  },
  article_al: {
    manifestUrl: "/content/verified/s110-batch02.json",
    blueprintUrl: "/content/blueprints/article_al-batch02.json",
  },
  linking: {
    manifestUrl: "/content/verified/s110-batch02.json",
    blueprintUrl: "/content/blueprints/linking-batch02.json",
  },
  fluent_reading: {
    manifestUrl: "/content/verified/s110-batch02.json",
    blueprintUrl: "/content/blueprints/fluent_reading-batch02.json",
  },
};
