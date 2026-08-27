import batch01 from "../public/content/verified/s110-batch01.json";
import batch02 from "../public/content/verified/s110-batch02.json";

type VerifiedItem = {
  id: string;
  arabicExact: string;
  active?: boolean;
  eligibleForActiveLesson?: boolean;
  verification?: {
    visualPass1?: boolean;
    visualPass2?: boolean;
    ambiguous?: boolean;
  };
};

const manifests = [batch01, batch02] as Array<{ items: VerifiedItem[] }>;

export const VERIFIED_VOICE_REFERENCES = new Map<string, string>();

for (const manifest of manifests) {
  for (const item of manifest.items) {
    const isVerified =
      item.active === true &&
      item.eligibleForActiveLesson === true &&
      item.verification?.visualPass1 === true &&
      item.verification?.visualPass2 === true &&
      item.verification?.ambiguous === false;

    if (!isVerified) continue;
    if (VERIFIED_VOICE_REFERENCES.has(item.id)) {
      throw new Error(`Duplicate verified content id: ${item.id}`);
    }
    VERIFIED_VOICE_REFERENCES.set(item.id, item.arabicExact);
  }
}

export function matchesVerifiedVoiceReference(itemId: string, referenceText: string): boolean {
  const canonical = VERIFIED_VOICE_REFERENCES.get(itemId);
  return canonical !== undefined && canonical === referenceText;
}
