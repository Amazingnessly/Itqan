import type { InteractionMode } from "../../learning";

export const METHOD_STEPS = ["Voir", "Décomposer", "Prononcer", "Fluidifier"] as const;
export type MethodStep = (typeof METHOD_STEPS)[number];

type InteractionInstruction = {
  kicker: MethodStep;
  title: string;
  hint: string;
};

export const INTERACTION_INSTRUCTIONS: Record<InteractionMode, InteractionInstruction> = {
  guided_scan: {
    kicker: "Voir",
    title: "Observe chaque unité avant de lire.",
    hint: "Ne devine pas la forme globale. Suis exactement ce qui est écrit.",
  },
  exact_read: {
    kicker: "Prononcer",
    title: "Lis exactement ce qui est affiché.",
    hint: "Garde chaque voyelle et chaque signe.",
  },
  unit_tracking: {
    kicker: "Décomposer",
    title: "Suis les unités dans l’ordre, puis lis.",
    hint: "Aucune unité ne doit disparaître pendant la lecture.",
  },
  oral_read: {
    kicker: "Prononcer",
    title: "Lis à voix haute, sans accélérer.",
    hint: "Une lecture lente et exacte vaut mieux qu’une lecture rapide et imprécise.",
  },
  delayed_recall: {
    kicker: "Voir",
    title: "Relis sans t’appuyer sur la mémoire.",
    hint: "Regarde à nouveau les signes : lis ce qui est là, pas ce que tu attends.",
  },
  mixed_exact_read: {
    kicker: "Fluidifier",
    title: "Garde la même précision dans ce nouveau contexte.",
    hint: "La fluidité n’est utile que si chaque signe reste exact.",
  },
  delayed_check: {
    kicker: "Voir",
    title: "Vérifie à nouveau la lecture sans te fier au souvenir.",
    hint: "Repars des signes visibles. Une répétition espacée ne vaut que si elle reste exacte.",
  },
  mark_focus: {
    kicker: "Voir",
    title: "Repère les voyelles et le sukūn visibles avant de lire.",
    hint: "Observe chaque marque telle qu’elle est écrite avant de prononcer l’unité.",
  },
  verified_contrast: {
    kicker: "Décomposer",
    title: "Garde les contrastes visuels déjà vérifiés.",
    hint: "Ne rapproche pas deux formes que les signes distinguent. Lis uniquement la chaîne affichée.",
  },
  contrast_from_verified_items: {
    kicker: "Décomposer",
    title: "Compare avec les éléments contrôlés déjà rencontrés.",
    hint: "Appuie-toi seulement sur les différences réellement visibles, puis lis cette chaîne exactement.",
  },
  precision_reread: {
    kicker: "Voir",
    title: "Relis avec un contrôle signe par signe.",
    hint: "Corrige d’abord toute imprécision. La fluidité vient ensuite.",
  },
  spot_shaddah: {
    kicker: "Voir",
    title: "Repère la shaddah visible avant de lire.",
    hint: "Ne laisse pas disparaître le signe dans ta prononciation.",
  },
  decompose: {
    kicker: "Décomposer",
    title: "Décompose en unités de lecture, puis réunis-les.",
    hint: "Garde chaque signe pendant la recomposition de la lecture.",
  },
  mixed_transfer: {
    kicker: "Fluidifier",
    title: "Transfère la même précision dans ce nouveau contexte.",
    hint: "Ne change pas ta règle de lecture parce que la chaîne est différente.",
  },
  spot_article: {
    kicker: "Voir",
    title: "Repère l’article écrit avant de lire.",
    hint: "Observe sa forme dans la chaîne et prononce uniquement ce que la source montre.",
  },
  classify_observed: {
    kicker: "Décomposer",
    title: "Classe seulement ce que tu observes dans la lecture.",
    hint: "Reste sur les signes présents. Il ne s’agit pas d’un exercice de grammaire ou de vocabulaire.",
  },
  chunk_read: {
    kicker: "Décomposer",
    title: "Découpe en groupes courts, puis enchaîne-les.",
    hint: "Chaque groupe doit rester exact avant de poursuivre la lecture.",
  },
  connected_read: {
    kicker: "Fluidifier",
    title: "Enchaîne les unités sans coupure artificielle.",
    hint: "Garde chaque signe exact pendant l’enchaînement.",
  },
  phrase_read: {
    kicker: "Fluidifier",
    title: "Lis le groupe complet avec continuité.",
    hint: "Ne gagne pas de vitesse au prix d’un signe perdu ou transformé.",
  },
  meaning_group_read: {
    kicker: "Fluidifier",
    title: "Lis le groupe comme une unité de lecture.",
    hint: "Travaille la continuité de lecture, sans exercice de sens, de vocabulaire ou de grammaire.",
  },
  hidden_timing: {
    kicker: "Fluidifier",
    title: "Lis avec naturel pendant que le temps reste invisible.",
    hint: "Le temps est seulement observé. Il n’a aucune valeur si la précision baisse.",
  },
};
