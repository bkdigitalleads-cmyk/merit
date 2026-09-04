/**
 * Goal presets: volunteer-hour requirements are
 * set by schools, chapters, and programs, so we offer the common shapes and
 * let the user tune the number. Hours are suggestions, always editable.
 */
export interface GoalPreset {
  key: string;
  label: string;
  /** Suggested target hours (editable after choosing). */
  hours: number;
  note?: string;
}

export const GOAL_PRESETS: GoalPreset[] = [
  {
    key: 'nhs',
    label: 'National Honor Society',
    hours: 25,
    note: 'Chapters commonly require 20–30 hours per year — confirm with your chapter.',
  },
  {
    key: 'school',
    label: 'School graduation requirement',
    hours: 40,
    note: 'Districts vary widely — check your student handbook for the exact number.',
  },
  {
    key: 'college',
    label: 'College applications',
    hours: 100,
    note: 'No official minimum — sustained commitment matters more than the total.',
  },
  {
    key: 'scholarship',
    label: 'Scholarship requirement',
    hours: 50,
    note: 'Use the number from your scholarship’s eligibility rules.',
  },
  {
    key: 'program',
    label: 'Court or program requirement',
    hours: 40,
    note: 'Use the exact number you were assigned, and confirm what proof is needed.',
  },
  {
    key: 'personal',
    label: 'Personal goal',
    hours: 50,
  },
];

export function getGoalPreset(key: string): GoalPreset | undefined {
  return GOAL_PRESETS.find((p) => p.key === key);
}
