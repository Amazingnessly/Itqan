export type VoiceAssessmentRequest = { itemId: string; referenceText: string; audio: Blob; localeHint?: "ar-SA" | "ar-EG" };

export type VoiceAssessmentResult = {
  provider: string;
  recognized: boolean;
  overallScore?: number;
  confidence?: number;
  omissionCount?: number;
  insertionCount?: number;
  pronunciationIssueCount?: number;
  specificReadingError?: {
    kind: "vowel" | "sukun" | "shaddah" | "article" | "linking" | "other";
    confidence: number;
    validatedByItqan: boolean;
  };
};

export interface VoiceAssessmentProvider { assess(request: VoiceAssessmentRequest): Promise<VoiceAssessmentResult>; }

export function mayUseSpecificReadingDiagnosis(result: VoiceAssessmentResult): boolean {
  return Boolean(result.specificReadingError?.validatedByItqan && result.specificReadingError.confidence >= 0.9);
}
