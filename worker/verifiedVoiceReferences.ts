import batch01 from "../public/content/verified/s110-batch01.json";
import batch02 from "../public/content/verified/s110-batch02.json";

type VerifiedItem = {
  id: string;
  arabicExact: string;
  active?: boolean;
  eligibleForActiveLesson?: boolean;
  integrity?: {
    utf8Sha256?: string;
    normalizationApplied?: boolean;
  };
  verification?: {
    visualPass1?: boolean;
    visualPass2?: boolean;
    ambiguous?: boolean;
  };
};

const manifests = [batch01, batch02] as Array<{ items: VerifiedItem[] }>;

export function buildVerifiedVoiceReferences(sourceManifests: Array<{ items: VerifiedItem[] }>): Map<string, string> {
  const references = new Map<string, string>();

  for (const manifest of sourceManifests) {
    for (const item of manifest.items) {
      const isVerified =
        item.active === true &&
        item.eligibleForActiveLesson === true &&
        item.integrity?.normalizationApplied === false &&
        item.verification?.visualPass1 === true &&
        item.verification?.visualPass2 === true &&
        item.verification?.ambiguous === false;

      if (!isVerified) continue;
      if (references.has(item.id)) {
        throw new Error(`Duplicate verified content id: ${item.id}`);
      }
      references.set(item.id, item.arabicExact);
    }
  }

  return references;
}

export const VERIFIED_VOICE_REFERENCES = buildVerifiedVoiceReferences(manifests);

export function matchesVerifiedVoiceReference(itemId: string, referenceText: string): boolean {
  const canonical = VERIFIED_VOICE_REFERENCES.get(itemId);
  return canonical !== undefined && canonical === referenceText;
}
