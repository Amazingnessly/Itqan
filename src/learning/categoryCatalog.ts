import type { ExerciseCategory } from "./types";

export type CategoryResources = {
  manifestUrl: string;
  blueprintUrl: string;
};

export const CATEGORY_ORDER: ExerciseCategory[] = [
  "reading_units",
  "vowels_sukun",
  "shaddah",
  "article_al",
  "linking",
  "fluent_reading",
];

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
