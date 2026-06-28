// Core game logic: slot construction per mode + scoring math.
import { STREAK_MULT, FINAL_MULT, DIFFICULTIES } from './constants.js';

export function baseForDifficulty(difficulty) {
  return (DIFFICULTIES.find((d) => d.id === difficulty) || DIFFICULTIES[1]).base;
}

// Build the ordered list of question "slots". Each slot says who is on the spot
// and which topic pool the question should come from.
// Returns: [{ idx, answererId, topics, final }]
export function buildSlots({ mode, players, settings, teamTopics, expertId }) {
  const slots = [];
  const finalOn = settings.finalRound;

  if (mode === 'stump') {
    const expert = players.find((p) => p.id === expertId) || players[0];
    const n = settings.roundsStump;
    for (let i = 0; i < n; i++) {
      slots.push({ idx: i, answererId: expert.id, topics: expert.topics, final: false });
    }
    if (finalOn && slots.length) slots[slots.length - 1].final = true;
  } else if (mode === 'ffa') {
    const perPlayer = settings.roundsPerPlayer;
    for (let r = 0; r < perPlayer; r++) {
      for (const p of players) {
        slots.push({ idx: slots.length, answererId: p.id, topics: p.topics, final: false });
      }
    }
    if (finalOn) {
      // last full round is double points
      for (let k = slots.length - players.length; k < slots.length; k++) {
        if (k >= 0) slots[k].final = true;
      }
    }
  } else if (mode === 'teams') {
    const teamA = players.filter((p) => p.team === 'A');
    const teamB = players.filter((p) => p.team === 'B');
    const rounds = settings.roundsPerPlayer;
    let aTurn = 0;
    let bTurn = 0;
    for (let r = 0; r < rounds; r++) {
      if (teamA.length) {
        const ans = teamA[aTurn % teamA.length];
        slots.push({ idx: slots.length, answererId: ans.id, team: 'A', topics: teamTopics.A, final: false });
        aTurn++;
      }
      if (teamB.length) {
        const ans = teamB[bTurn % teamB.length];
        slots.push({ idx: slots.length, answererId: ans.id, team: 'B', topics: teamTopics.B, final: false });
        bTurn++;
      }
    }
    if (finalOn && slots.length >= 2) {
      slots[slots.length - 1].final = true;
      slots[slots.length - 2].final = true;
    }
  }
  return slots;
}

// Points earned for a correct answer.
export function computePoints({ base, timerSec, timeLeft, streak, final, speedBonus }) {
  const speed = speedBonus && timerSec > 0 ? Math.round(base * 0.5 * Math.max(0, timeLeft / timerSec)) : 0;
  const newStreak = streak + 1;
  const mult = STREAK_MULT[Math.min(newStreak, STREAK_MULT.length - 1)];
  const finalMult = final ? FINAL_MULT : 1;
  const total = Math.round((base + speed) * mult * finalMult);
  return { base, speed, mult, finalMult, total, newStreak };
}
