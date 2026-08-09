import type { SourceItem } from '../types/content'

/**
 * RÈGLE : aucune chaîne arabe d'exercice ne doit être ajoutée ici sans
 * double vérification visuelle de la page source.
 *
 * Le tableau est volontairement vide pour cette première base visuelle.
 */
export const sourceItems: SourceItem[] = []

export function getVerifiedSourceItem(id: string): SourceItem {
  const item = sourceItems.find((entry) => entry.id === id)

  if (!item) {
    throw new Error(`Source introuvable : ${id}`)
  }

  if (item.verification !== 'verified') {
    throw new Error(`Source non vérifiée interdite dans une leçon active : ${id}`)
  }

  return item
}
