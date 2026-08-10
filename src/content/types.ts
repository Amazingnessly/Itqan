export type ExerciseCategory =
  | "reading_units"
  | "vowels_sukun"
  | "shaddah"
  | "article_al"
  | "linking"
  | "fluent_reading";

export type ControlledContentItem = {
  id: string;
  source: {
    sourceId: string;
    file: string;
    pdfPage: number;
    printedPage?: number;
  };
  arabicExact: string;
  integrity: {
    utf8Sha256: string;
    normalizationApplied: false;
  };
  verification: {
    visualPass1: true;
    visualPass1Method: string;
    visualPass2: true;
    visualPass2Method: string;
    ambiguous: false;
  };
  allowedExerciseTypes: ExerciseCategory[];
  focusMarksObserved: string[];
  articleClassObserved: Array<"shamsiyyah" | "qamariyyah">;
  hamzatWaslCandidate: boolean;
  audio: {
    sourceAudioPresent: boolean;
    referenceAudioStatus: string;
  };
  eligibleForActiveLesson: boolean;
  active: boolean;
};

export type ControlledBatch = {
  schemaVersion: string;
  project: "Itqān";
  batchId: string;
  status: string;
  sourceControl: {
    canonicalSourceId: string;
    canonicalFile: string;
    verifiedPdfPages: number[];
    verifiedPrintedPages: number[];
    visualPassesPerItem: number;
    silentNormalization: false;
    ocrUsedAsAuthority: false;
  };
  items: ControlledContentItem[];
};
