// Static game configuration: palettes, avatars, difficulty, modes.

// Per-player accent colors (hex so Tailwind purge can't strip them; applied inline).
export const PALETTE = [
  { name: 'indigo', hex: '#6366f1', soft: 'rgba(99,102,241,0.16)' },
  { name: 'emerald', hex: '#10b981', soft: 'rgba(16,185,129,0.16)' },
  { name: 'amber', hex: '#f59e0b', soft: 'rgba(245,158,11,0.16)' },
  { name: 'rose', hex: '#f43f5e', soft: 'rgba(244,63,94,0.16)' },
  { name: 'sky', hex: '#0ea5e9', soft: 'rgba(14,165,233,0.16)' },
  { name: 'violet', hex: '#8b5cf6', soft: 'rgba(139,92,246,0.16)' },
  { name: 'lime', hex: '#84cc16', soft: 'rgba(132,204,22,0.16)' },
  { name: 'orange', hex: '#fb923c', soft: 'rgba(251,146,60,0.16)' },
];

export const AVATARS = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐧', '🦉', '🐙', '🦄', '🐲', '🤖', '👑', '🦖', '🐝', '🦋', '🐺'];

export const DIFFICULTIES = [
  { id: 'Kids', label: 'Kids', blurb: 'Ages ~6-10', base: 100 },
  { id: 'Medium', label: 'Medium', blurb: 'Pub quiz', base: 100 },
  { id: 'Hard', label: 'Hard', blurb: 'For enthusiasts', base: 150 },
  { id: 'Expert', label: 'Expert', blurb: 'Deep cuts', base: 200 },
];

export const TIMER_OPTIONS = [
  { id: 0, label: 'Off' },
  { id: 20, label: '20s' },
  { id: 30, label: '30s' },
  { id: 45, label: '45s' },
];

export const MODES = {
  stump: {
    id: 'stump',
    title: 'Stump the Expert',
    tagline: 'One know-it-all vs. the whole room.',
    blurb: 'Pick an expert and their favorite topics. Every question is aimed at them. Miss one, and the challengers steal the point.',
    icon: 'Brain',
    accent: '#6366f1',
    minPlayers: 2,
  },
  ffa: {
    id: 'ffa',
    title: 'Free-for-All',
    tagline: 'Everyone picks their topics. Last one standing wins.',
    blurb: 'Each player gets their own questions from their own expertise. Build streaks, steal misses, win the crown.',
    icon: 'Swords',
    accent: '#10b981',
    minPlayers: 2,
  },
  teams: {
    id: 'teams',
    title: 'Teams',
    tagline: 'Split the family. Battle for bragging rights.',
    blurb: 'Two teams, shared topic pools, alternating turns. Great for big groups and mixed ages.',
    icon: 'Users',
    accent: '#f59e0b',
    minPlayers: 4,
  },
};

export const STREAK_MULT = [1, 1, 1.5, 2, 2.5, 3]; // index = current streak (capped)
export const STEAL_FRACTION = 0.5;
export const FINAL_MULT = 2;
