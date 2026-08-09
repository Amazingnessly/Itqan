export type VerificationStatus =
  | 'verified'
  | 'to-review'
  | 'ambiguous'
  | 'blocked'

export type ExerciseType =
  | 'reading-unit'
  | 'vowels-sukun'
  | 'shaddah'
  | 'article-al'
  | 'linking'
  | 'fluency'

export interface SourceItem {
  id: string
  sourceFile: string
  sourcePage: number
  arabic: string
  verification: VerificationStatus
  allowedExercises: ExerciseType[]
}

export interface Lesson {
  id: string
  title: string
  level: 'Découverte' | 'Progression' | 'Consolidation' | 'Maîtrise' | 'Excellence'
  sourceItemIds: string[]
  exerciseType: ExerciseType
  active: boolean
}
