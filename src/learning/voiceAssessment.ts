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

export type VoiceAssessmentGuidance = {
  status: "unavailable" | "observed" | "specific_diagnosis";
  message: string;
  result?: VoiceAssessmentResult;
};

export function mayUseSpecificReadingDiagnosis(result: VoiceAssessmentResult): boolean {
  return Boolean(result.specificReadingError?.validatedByItqan && result.specificReadingError.confidence >= 0.9);
}

export async function assessVoiceSafely(
  provider: VoiceAssessmentProvider | null | undefined,
  request: VoiceAssessmentRequest,
): Promise<VoiceAssessmentGuidance> {
  if (!provider) return { status: "unavailable", message: "Analyse vocale non configurée : le contrôle manuel reste nécessaire." };
  try {
    const result = await provider.assess(request);
    if (mayUseSpecificReadingDiagnosis(result)) {
      return { status: "specific_diagnosis", message: "Un point de lecture validé peut être signalé avec précision.", result };
    }
    return { status: "observed", message: "La lecture a été analysée, mais le résultat ne peut pas décider seul de l’exactitude.", result };
  } catch {
    return { status: "unavailable", message: "L’analyse vocale est indisponible : la séance continue avec le contrôle manuel." };
  }
}
