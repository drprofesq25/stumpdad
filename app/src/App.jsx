import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain, Swords, Users, Trophy, RefreshCw, Plus, X, ChevronLeft, Crown, Volume2, VolumeX,
  SkipForward, Lightbulb, Flame, Check, ArrowRight, Trash2, Medal, Home, Play, UserPlus,
  Shuffle, Clock, Star, Music2, Megaphone,
} from 'lucide-react';
import { Button, Card, ProgressRing, Avatar } from './ui.jsx';
import { PALETTE, AVATARS, DIFFICULTIES, TIMER_OPTIONS, MODES } from './game/constants.js';
import { sfx, music, setMuted, isMuted } from './game/audio.js';
import { narrator } from './game/speech.js';
import { burstConfetti } from './game/confetti.js';
import { buildSlots, computePoints, baseForDifficulty } from './game/engine.js';
import { recordMatch, getHallOfFame, clearHallOfFame, saveRoster, loadRoster, getRecentQuestions, addAskedQuestions } from './game/storage.js';

const ICONS = { Brain, Swords, Users };
let _pid = 0;
const newId = () => `p${++_pid}_${Math.random().toString(36).slice(2, 6)}`;

function makePlayer(i, team = null) {
  return {
    id: newId(),
    name: ['Dad', 'Mom', 'Player 3', 'Player 4', 'Player 5', 'Player 6', 'Player 7', 'Player 8'][i] || `Player ${i + 1}`,
    emoji: AVATARS[i % AVATARS.length],
    colorIdx: i % PALETTE.length,
    topics: [],
    team,
  };
}

// --- Stable, module-level components (defined OUTSIDE App so they never remount
// on every keystroke — that was causing inputs to lose focus). ---
function Shell({ children }) {
  return (
    <div className="bg-stars min-h-screen relative">
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function TopicEditor({ keyId, topics, isTeam = false, hex, max, ctx }) {
  const { topicDraft, setTopicDraft, addTopic, removeTopic } = ctx;
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={topicDraft[keyId] || ''}
          onChange={(e) => setTopicDraft((d) => ({ ...d, [keyId]: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && addTopic(keyId, isTeam)}
          placeholder="e.g. 80s Movies, Dinosaurs, Taylor Swift…"
          className="flex-1 px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2"
          style={{ '--tw-ring-color': hex }}
        />
        <button onClick={() => addTopic(keyId, isTeam)} className="px-3 rounded-xl text-white" style={{ background: hex }}>
          <Plus size={20} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 min-h-[34px]">
        {topics.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold"
            style={{ background: `${hex}22`, color: hex, border: `1px solid ${hex}44` }}>
            {t}
            <button onClick={() => removeTopic(keyId, i, isTeam)} className="hover:opacity-60"><X size={13} /></button>
          </span>
        ))}
        {!topics.length && <span className="text-xs text-slate-500 py-1.5">No topics yet · up to {max}</span>}
      </div>
    </div>
  );
}

function PlayerRow({ p, showTopics, showExpert, showTeam, ctx }) {
  const { mode, players, expertId, setExpertId, updatePlayer, removePlayer } = ctx;
  const hex = PALETTE[p.colorIdx % PALETTE.length].hex;
  return (
    <Card className="p-4 space-y-3" style={{ borderColor: `${hex}33` }}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => { const ai = (AVATARS.indexOf(p.emoji) + 1) % AVATARS.length; updatePlayer(p.id, { emoji: AVATARS[ai] }); sfx.tap(); }}
          className="shrink-0" title="Tap to change avatar"
        >
          <Avatar emoji={p.emoji} hex={hex} size={46} ring />
        </button>
        <input
          value={p.name}
          onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
          className="flex-1 bg-transparent text-lg font-bold text-white focus:outline-none border-b border-transparent focus:border-slate-600"
        />
        <button onClick={() => { const ci = (p.colorIdx + 1) % PALETTE.length; updatePlayer(p.id, { colorIdx: ci }); sfx.tap(); }}
          className="w-7 h-7 rounded-full shrink-0" style={{ background: hex }} title="Tap to change color" />
        {players.length > 2 && (
          <button onClick={() => removePlayer(p.id)} className="text-slate-500 hover:text-rose-400 shrink-0"><Trash2 size={18} /></button>
        )}
      </div>

      {showTeam && (
        <div className="flex gap-2">
          {['A', 'B'].map((tm) => (
            <button key={tm} onClick={() => updatePlayer(p.id, { team: tm })}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={p.team === tm
                ? { background: tm === 'A' ? PALETTE[0].hex : PALETTE[2].hex, color: '#fff' }
                : { background: 'rgba(148,163,184,0.12)', color: '#94a3b8' }}>
              {tm === 'A' ? 'Team Indigo' : 'Team Amber'}
            </button>
          ))}
        </div>
      )}

      {showExpert && (
        <button onClick={() => { setExpertId(p.id); sfx.tap(); }}
          className="w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          style={(expertId || players[0].id) === p.id
            ? { background: hex, color: '#fff' }
            : { background: 'rgba(148,163,184,0.12)', color: '#94a3b8' }}>
          <Crown size={14} /> {(expertId || players[0].id) === p.id ? 'The Expert' : 'Make Expert'}
        </button>
      )}

      {showTopics && <TopicEditor keyId={p.id} topics={p.topics} hex={hex} max={mode === 'stump' ? 5 : 3} ctx={ctx} />}
    </Card>
  );
}

export default function App() {
  const [screen, setScreen] = useState('menu'); // menu|setup|loading|playing|summary|hof
  const [mode, setMode] = useState('stump');
  const [players, setPlayers] = useState(() => {
    const saved = loadRoster();
    if (saved && saved.length >= 2) {
      _pid = saved.length;
      return saved.map((p, i) => ({ ...makePlayer(i), ...p, id: newId(), team: null }));
    }
    return [makePlayer(0), makePlayer(1)];
  });
  const [expertId, setExpertId] = useState(null);
  const [teamTopics, setTeamTopics] = useState({ A: [], B: [] });
  const [settings, setSettings] = useState({
    difficulty: 'Medium',
    timerSec: 30,
    speedBonus: true,
    finalRound: true,
    steal: true,
    lifelines: true,
    kidSafe: true,
    readAloud: true,
    roundsStump: 10,
    roundsPerPlayer: 3,
  });
  const [topicDraft, setTopicDraft] = useState({});
  const [error, setError] = useState(null);
  const [muted, setMutedState] = useState(isMuted());
  const [musicOn, setMusicOn] = useState(false);

  // gameplay
  const [questions, setQuestions] = useState([]);
  const [slots, setSlots] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [phase, setPhase] = useState('q'); // q|reveal|steal
  const [scores, setScores] = useState({});
  const [streaks, setStreaks] = useState({});
  const [challengerScore, setChallengerScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [skipsLeft, setSkipsLeft] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(0);
  const [toast, setToast] = useState(null);
  const [shakeKey, setShakeKey] = useState(0);

  const kidSafe = settings.kidSafe || settings.difficulty === 'Kids';

  // ---------- helpers ----------
  const colorOf = (p) => PALETTE[p.colorIdx % PALETTE.length].hex;

  function toggleMute() {
    const v = !muted;
    setMuted(v);
    setMutedState(v);
  }
  function toggleMusic() {
    sfx.unlock();
    setMusicOn(music.toggle());
  }

  function updatePlayer(id, patch) {
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function addPlayer() {
    setPlayers((ps) => {
      if (ps.length >= 8) return ps;
      const i = ps.length;
      const team = mode === 'teams' ? (i % 2 === 0 ? 'A' : 'B') : null;
      return [...ps, makePlayer(i, team)];
    });
  }
  function removePlayer(id) {
    setPlayers((ps) => (ps.length <= 2 ? ps : ps.filter((p) => p.id !== id)));
  }

  function addTopic(key, isTeam = false) {
    const val = (topicDraft[key] || '').trim();
    if (!val) return;
    if (isTeam) {
      setTeamTopics((t) => (t[key].length >= 4 ? t : { ...t, [key]: [...t[key], val] }));
    } else {
      setPlayers((ps) =>
        ps.map((p) => (p.id === key && p.topics.length < (mode === 'stump' ? 5 : 3) ? { ...p, topics: [...p.topics, val] } : p))
      );
    }
    setTopicDraft((d) => ({ ...d, [key]: '' }));
  }
  function removeTopic(key, idx, isTeam = false) {
    if (isTeam) setTeamTopics((t) => ({ ...t, [key]: t[key].filter((_, i) => i !== idx) }));
    else setPlayers((ps) => ps.map((p) => (p.id === key ? { ...p, topics: p.topics.filter((_, i) => i !== idx) } : p)));
  }

  function chooseMode(m) {
    setMode(m);
    setError(null);
    setPlayers((ps) => {
      let next = ps.map((p) => ({ ...p, team: null }));
      if (m === 'teams') {
        if (next.length < 4) while (next.length < 4) next.push(makePlayer(next.length));
        next = next.map((p, i) => ({ ...p, team: i % 2 === 0 ? 'A' : 'B' }));
      }
      return next;
    });
    if (m === 'stump') setExpertId((id) => id || null);
    setScreen('setup');
  }

  // ---------- start game ----------
  async function startGame() {
    setError(null);
    narrator.warmup(); // prime TTS inside this user gesture (needed on iOS)
    const eId = expertId || players[0].id;
    if (mode === 'stump') setExpertId(eId);

    const builtSlots = buildSlots({ mode, players, settings, teamTopics, expertId: eId });
    setSlots(builtSlots);
    setScreen('loading');

    const payload = {
      difficulty: settings.difficulty,
      kidSafe,
      avoid: getRecentQuestions(60),
      slots: builtSlots.map((s) => ({ idx: s.idx, target: s.answererId, topics: s.topics })),
    };

    try {
      const res = await fetch('/api/trivia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      const qs = (data.questions || []).map((q, i) => ({ ...q, final: builtSlots[i]?.final, team: builtSlots[i]?.team }));
      if (!qs.length) throw new Error('No questions came back.');
      addAskedQuestions(qs.map((q) => q.question));

      // reset runtime
      setQuestions(qs);
      setQIndex(0);
      setPhase('q');
      setScores({});
      setStreaks({});
      setChallengerScore(0);
      setHintShown(false);
      setTimeLeft(settings.timerSec);
      setSkipsLeft(settings.lifelines ? players.length : 0);
      setHintsLeft(settings.lifelines ? players.length : 0);
      setToast(null);
      saveRoster(players);
      setScreen('playing');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not generate questions. Try again.');
      setScreen('setup');
    }
  }

  // Detect premium voice availability once on load.
  useEffect(() => {
    narrator.init();
  }, []);

  // ---------- timer ----------
  useEffect(() => {
    if (screen !== 'playing' || phase !== 'q' || settings.timerSec === 0) return;
    if (timeLeft <= 0) {
      setPhase('reveal');
      sfx.reveal();
      return;
    }
    const id = setTimeout(() => {
      setTimeLeft((t) => t - 1);
      if (timeLeft <= 4) sfx.tick();
    }, 1000);
    return () => clearTimeout(id);
  }, [screen, phase, timeLeft, settings.timerSec]);

  // ---------- scoring keys ----------
  const curQ = questions[qIndex];
  const curSlot = slots[qIndex];

  // ---------- host voice: read question on show, answer on reveal ----------
  useEffect(() => {
    if (screen !== 'playing' || !settings.readAloud || !curQ) {
      if (screen !== 'playing') narrator.cancel();
      return;
    }
    if (phase === 'q') {
      narrator.speak(curQ.question);
      narrator.prefetch(questions[qIndex + 1]?.question); // warm next question's audio
    } else if (phase === 'reveal') {
      narrator.speak(`The answer is: ${curQ.answer}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, phase, screen, settings.readAloud]);
  const answerer = curSlot ? players.find((p) => p.id === curSlot.answererId) : null;
  const scoreKey = (slot) => (mode === 'teams' ? slot.team : slot.answererId);
  const streakKey = (slot) => (mode === 'teams' ? slot.team : slot.answererId);

  function judge(correct) {
    if (!curSlot) return;
    const base = baseForDifficulty(settings.difficulty);
    const sk = scoreKey(curSlot);
    const stk = streakKey(curSlot);

    if (correct) {
      const r = computePoints({
        base,
        timerSec: settings.timerSec,
        timeLeft,
        streak: streaks[stk] || 0,
        final: curSlot.final,
        speedBonus: settings.speedBonus,
      });
      setScores((s) => ({ ...s, [sk]: (s[sk] || 0) + r.total }));
      setStreaks((s) => ({ ...s, [stk]: r.newStreak }));
      if (r.mult > 1) sfx.combo(r.newStreak);
      else sfx.correct();
      setToast({
        kind: 'good',
        text: `+${r.total}`,
        sub: r.mult > 1 ? `${r.mult}× combo!` : r.finalMult > 1 ? 'Final round — double!' : r.speed > 0 ? `incl. +${r.speed} speed` : null,
        hex: mode === 'teams' ? (curSlot.team === 'A' ? PALETTE[0].hex : PALETTE[2].hex) : colorOf(answerer),
      });
      advance(900);
    } else {
      // miss
      setStreaks((s) => ({ ...s, [stk]: 0 }));
      sfx.wrong();
      setShakeKey((k) => k + 1);
      if (mode === 'stump') {
        setChallengerScore((c) => c + base);
        setToast({ kind: 'bad', text: 'STUMPED!', sub: `+${base} to the Challengers`, hex: '#f43f5e' });
        advance(950);
      } else if (settings.steal && otherEntitiesForSteal(curSlot).length) {
        setToast({ kind: 'bad', text: 'Missed!', sub: 'Open for a steal…', hex: '#f43f5e' });
        setTimeout(() => {
          setToast(null);
          setPhase('steal');
        }, 700);
      } else {
        setToast({ kind: 'bad', text: 'Missed!', sub: 'No points', hex: '#f43f5e' });
        advance(900);
      }
    }
  }

  function otherEntitiesForSteal(slot) {
    if (mode === 'teams') {
      return [slot.team === 'A' ? 'B' : 'A'];
    }
    return players.filter((p) => p.id !== slot.answererId).map((p) => p.id);
  }

  function doSteal(entityKey) {
    const base = baseForDifficulty(settings.difficulty);
    if (entityKey !== 'none') {
      const gain = Math.round(base * 0.5);
      setScores((s) => ({ ...s, [entityKey]: (s[entityKey] || 0) + gain }));
      sfx.steal();
      const label =
        mode === 'teams' ? `Team ${entityKey}` : players.find((p) => p.id === entityKey)?.name || 'Stealer';
      setToast({ kind: 'good', text: `Steal! +${gain}`, sub: label, hex: '#0ea5e9' });
    } else {
      setToast({ kind: 'bad', text: 'Nobody got it', sub: null, hex: '#94a3b8' });
    }
    advance(850);
  }

  function skipQuestion() {
    if (skipsLeft <= 0) return;
    setSkipsLeft((n) => n - 1);
    setToast({ kind: 'neutral', text: 'Skipped', sub: null, hex: '#94a3b8' });
    advance(650);
  }

  function useHint() {
    if (hintsLeft <= 0 || hintShown) return;
    setHintsLeft((n) => n - 1);
    setHintShown(true);
    sfx.tap();
  }

  function advance(delay = 700) {
    setTimeout(() => {
      setToast(null);
      if (qIndex < questions.length - 1) {
        setQIndex((i) => i + 1);
        setPhase('q');
        setHintShown(false);
        setTimeLeft(settings.timerSec);
      } else {
        endGame();
      }
    }, delay);
  }

  function endGame() {
    const { entities, winners } = resolveStandings();
    recordMatch({
      mode,
      difficulty: settings.difficulty,
      players: entities.map((e) => ({ name: e.name, emoji: e.emoji, score: e.score })),
      winners,
    });
    setScreen('summary');
    setTimeout(() => {
      sfx.victory();
      burstConfetti();
    }, 250);
  }

  // ---------- standings ----------
  function resolveStandings() {
    let entities = [];
    if (mode === 'stump') {
      const expert = players.find((p) => p.id === (expertId || players[0].id)) || players[0];
      entities = [
        { id: expert.id, name: expert.name, emoji: expert.emoji, hex: colorOf(expert), score: scores[expert.id] || 0 },
        { id: 'challengers', name: 'The Challengers', emoji: '🧑‍🤝‍🧑', hex: '#94a3b8', score: challengerScore },
      ];
    } else if (mode === 'teams') {
      const aM = players.filter((p) => p.team === 'A');
      const bM = players.filter((p) => p.team === 'B');
      entities = [
        { id: 'A', name: 'Team Indigo', emoji: aM[0]?.emoji || '🔵', hex: PALETTE[0].hex, score: scores.A || 0, members: aM },
        { id: 'B', name: 'Team Amber', emoji: bM[0]?.emoji || '🟡', hex: PALETTE[2].hex, score: scores.B || 0, members: bM },
      ];
    } else {
      entities = players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, hex: colorOf(p), score: scores[p.id] || 0 }));
    }
    const max = Math.max(...entities.map((e) => e.score));
    const winners = entities.filter((e) => e.score === max && max > 0).map((e) => e.name);
    return { entities: entities.sort((a, b) => b.score - a.score), winners };
  }

  // ---------- validation ----------
  const validation = useMemo(() => {
    if (players.some((p) => !p.name.trim())) return 'Give everyone a name.';
    if (mode === 'stump') {
      const e = players.find((p) => p.id === (expertId || players[0].id)) || players[0];
      if (!e.topics.length) return `Add at least one topic for ${e.name}.`;
    } else if (mode === 'ffa') {
      const missing = players.find((p) => !p.topics.length);
      if (missing) return `${missing.name} needs at least one topic.`;
    } else if (mode === 'teams') {
      const a = players.filter((p) => p.team === 'A');
      const b = players.filter((p) => p.team === 'B');
      if (!a.length || !b.length) return 'Each team needs at least one player.';
      if (!teamTopics.A.length || !teamTopics.B.length) return 'Each team needs at least one topic.';
    }
    return null;
  }, [players, mode, expertId, teamTopics]);

  // =====================================================================
  // RENDERERS
  // =====================================================================

  // Bundle of state + handlers passed to the lifted PlayerRow/TopicEditor.
  const ctx = {
    mode, players, expertId, setExpertId, updatePlayer, removePlayer,
    topicDraft, setTopicDraft, addTopic, removeTopic,
  };

  function renderMenu() {
    const hof = getHallOfFame();
    return (
      <Shell>
        <div className="max-w-md mx-auto px-5 pt-6 pb-16 space-y-7 animate-fadeIn">
          <div className="flex justify-end">
            <button onClick={toggleMusic} className={`p-2.5 rounded-xl glass ${musicOn ? 'text-emerald-400' : 'text-slate-500'}`} title="Background music">
              <Music2 size={18} />
            </button>
          </div>
          <div className="text-center space-y-2">
            <div className="inline-block animate-floatY">
              <span className="text-6xl">🧠</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              StumpDad
            </h1>
            <p className="text-slate-400 text-lg font-medium">AI-powered family trivia.</p>
          </div>

          <div className="grid gap-4">
            {Object.values(MODES).map((m) => {
              const Icon = ICONS[m.icon];
              return (
                <button
                  key={m.id}
                  onClick={() => { sfx.unlock(); sfx.tap(); chooseMode(m.id); }}
                  className="glass text-left rounded-3xl p-5 border-2 border-transparent hover:scale-[1.02] transition-all group relative overflow-hidden"
                  style={{ borderColor: 'transparent' }}
                >
                  <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Icon size={110} style={{ color: m.accent }} />
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 rounded-2xl" style={{ background: `${m.accent}22`, color: m.accent }}>
                      <Icon size={26} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white">{m.title}</h3>
                      <p className="text-xs font-semibold" style={{ color: m.accent }}>{m.tagline}</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm relative z-10">{m.blurb}</p>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => { sfx.tap(); setScreen('hof'); }}
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-amber-300 font-bold py-3 transition-colors"
          >
            <Trophy size={18} /> Hall of Fame {hof.players.length ? `(${hof.players.length})` : ''}
          </button>
        </div>
      </Shell>
    );
  }

  function renderSetup() {
    const m = MODES[mode];
    const eId = expertId || players[0].id;
    return (
      <Shell>
        <div className="max-w-md mx-auto px-5 pt-8 pb-28 space-y-5 animate-fadeIn">
          <div className="flex items-center gap-3">
            <button onClick={() => { sfx.tap(); setScreen('menu'); }} className="text-slate-400 hover:text-white"><ChevronLeft /></button>
            <div>
              <h2 className="text-2xl font-black text-white">{m.title}</h2>
              <p className="text-xs font-semibold" style={{ color: m.accent }}>{m.tagline}</p>
            </div>
          </div>

          {/* Players */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Players · {players.length}</h3>
              {players.length < 8 && (
                <button onClick={() => { sfx.tap(); addPlayer(); }} className="text-sm font-bold flex items-center gap-1" style={{ color: m.accent }}>
                  <UserPlus size={16} /> Add
                </button>
              )}
            </div>
            {players.map((p) => (
              <PlayerRow key={p.id} p={p}
                showTopics={mode === 'ffa' || (mode === 'stump' && p.id === eId)}
                showExpert={mode === 'stump'}
                showTeam={mode === 'teams'} ctx={ctx} />
            ))}
          </div>

          {/* Team topics */}
          {mode === 'teams' && (
            <div className="grid gap-3">
              {['A', 'B'].map((tm) => {
                const hex = tm === 'A' ? PALETTE[0].hex : PALETTE[2].hex;
                return (
                  <Card key={tm} className="p-4 space-y-2" style={{ borderColor: `${hex}44` }}>
                    <h4 className="font-black text-sm" style={{ color: hex }}>{tm === 'A' ? 'Team Indigo' : 'Team Amber'} topics</h4>
                    <TopicEditor keyId={tm} topics={teamTopics[tm]} isTeam hex={hex} max={4} ctx={ctx} />
                  </Card>
                );
              })}
            </div>
          )}

          {/* Options */}
          <Card className="p-5 space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Game Options</h3>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><Star size={13} /> Difficulty</label>
              <div className="grid grid-cols-4 gap-1.5 bg-slate-900/60 p-1.5 rounded-2xl">
                {DIFFICULTIES.map((d) => (
                  <button key={d.id} onClick={() => { sfx.tap(); setSettings((s) => ({ ...s, difficulty: d.id })); }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${settings.difficulty === d.id ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">{DIFFICULTIES.find((d) => d.id === settings.difficulty)?.blurb}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><Clock size={13} /> Timer</label>
              <div className="grid grid-cols-4 gap-1.5 bg-slate-900/60 p-1.5 rounded-2xl">
                {TIMER_OPTIONS.map((t) => (
                  <button key={t.id} onClick={() => { sfx.tap(); setSettings((s) => ({ ...s, timerSec: t.id })); }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${settings.timerSec === t.id ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {[
              ['speedBonus', '⚡ Speed bonus', 'Answer faster, score more'],
              ['finalRound', '🔥 Final round', 'Last questions worth double'],
              ['steal', '🥷 Steals', 'Others can grab a missed question', mode !== 'stump'],
              ['lifelines', '💡 Lifelines', 'Skips & hints for the brave'],
              ['readAloud', '📣 Host voice', 'Read each question aloud'],
              ['kidSafe', '🧸 Kid-safe content', 'Keep everything family-friendly'],
            ].map(([k, label, sub, show = true]) => show && (
              <button key={k} onClick={() => { sfx.tap(); setSettings((s) => ({ ...s, [k]: !s[k] })); }}
                className="w-full flex items-center justify-between">
                <div className="text-left">
                  <p className="font-bold text-white text-sm">{label}</p>
                  <p className="text-[11px] text-slate-500">{sub}</p>
                </div>
                <div className={`w-12 h-7 rounded-full p-1 transition-all ${settings[k] ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings[k] ? 'translate-x-5' : ''}`} />
                </div>
              </button>
            ))}
          </Card>

          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-sm rounded-xl">{error}</div>
          )}
        </div>

        {/* Sticky start bar */}
        <div className="fixed bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-slate-950 to-transparent">
          <div className="max-w-md mx-auto">
            {validation ? (
              <div className="text-center text-xs text-amber-300/90 mb-2 font-semibold">{validation}</div>
            ) : null}
            <Button onClick={startGame} disabled={!!validation} className="w-full text-lg py-4" variant="gold" icon={Play}>
              Generate & Play
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  function renderLoading() {
    const lines = ['Consulting the trivia gods…', 'Sharpening tough questions…', 'Loading the buzzer…', 'Brewing brain-benders…'];
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-8 gap-6">
          <div className="w-20 h-20 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
          <h2 className="text-2xl font-black text-white">{lines[qIndex % lines.length] || lines[0]}</h2>
          <p className="text-slate-500 text-sm">{settings.difficulty} difficulty · {kidSafe ? 'kid-safe' : 'standard'}</p>
        </div>
      </Shell>
    );
  }

  function renderPlaying() {
    if (!curQ || !curSlot) return null;
    const { entities } = liveStandings();
    const total = questions.length;
    const accent = mode === 'teams' ? (curSlot.team === 'A' ? PALETTE[0].hex : PALETTE[2].hex) : (answerer ? colorOf(answerer) : '#6366f1');
    const onSpotName = mode === 'teams' ? `Team ${curSlot.team === 'A' ? 'Indigo' : 'Amber'} · ${answerer?.name}` : answerer?.name;
    const onSpotEmoji = answerer?.emoji || '🎯';
    const stk = streaks[streakKey(curSlot)] || 0;

    return (
      <Shell>
        <div className="max-w-md mx-auto px-4 pt-5 pb-8 space-y-4">
          {/* top bar */}
          <div className="flex items-center justify-between">
            <button onClick={() => { sfx.tap(); if (confirm('Quit this match?')) setScreen('menu'); }} className="text-slate-500 hover:text-white"><Home size={20} /></button>
            <div className="text-xs font-bold text-slate-400">Question {qIndex + 1} / {total}</div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { sfx.tap(); setSettings((s) => { const v = !s.readAloud; if (!v) narrator.cancel(); return { ...s, readAloud: v }; }); }}
                className={settings.readAloud ? 'text-emerald-400' : 'text-slate-500 hover:text-white'}
                title="Host voice (read questions aloud)"
              >
                <Megaphone size={20} />
              </button>
              <button onClick={toggleMusic} className={musicOn ? 'text-emerald-400' : 'text-slate-500 hover:text-white'}><Music2 size={20} /></button>
              <button onClick={toggleMute} className="text-slate-500 hover:text-white">{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
            </div>
          </div>

          {/* progress */}
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((qIndex) / total) * 100}%`, background: accent }} />
          </div>

          {/* scoreboard */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {entities.map((e) => {
              const isActive = mode === 'teams' ? e.id === curSlot.team : e.id === curSlot.answererId;
              return (
                <div key={e.id} className={`flex items-center gap-2 px-3 py-2 rounded-2xl shrink-0 transition-all ${isActive ? 'scale-105' : 'opacity-60'}`}
                  style={{ background: isActive ? `${e.hex}22` : 'rgba(30,41,59,0.5)', border: `1.5px solid ${isActive ? e.hex : 'transparent'}` }}>
                  <span className="text-xl">{e.emoji}</span>
                  <div className="leading-tight">
                    <p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[72px]">{e.name}</p>
                    <p className="text-lg font-black" style={{ color: e.hex }}>{e.score}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* question card */}
          <div key={shakeKey} className={phase === 'q' && toast?.kind === 'bad' ? 'animate-shake' : ''}>
            <Card className="p-6 min-h-[420px] flex flex-col" style={{ borderColor: `${accent}44` }}>
              {/* on the spot + timer */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{onSpotEmoji}</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">On the spot</p>
                    <p className="font-black text-white text-sm leading-tight">{onSpotName}</p>
                  </div>
                </div>
                {settings.timerSec > 0 && phase === 'q' ? (
                  <ProgressRing pct={timeLeft / settings.timerSec} label={timeLeft} color={accent} />
                ) : (
                  curSlot.final && <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-400 text-slate-900">🔥 FINAL ×2</span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide text-white" style={{ background: accent }}>{curQ.category}</span>
                {stk >= 2 && <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-orange-500/20 text-orange-300 flex items-center gap-1"><Flame size={11} /> {stk} streak</span>}
                {curSlot.final && settings.timerSec > 0 && <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-400 text-slate-900">🔥 ×2</span>}
              </div>

              <h3 className="text-2xl font-black text-white leading-snug">{curQ.question}</h3>
              {settings.readAloud && narrator.supported() && (
                <button onClick={() => { sfx.tap(); narrator.speak(curQ.question); }}
                  className="mt-2 self-start text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5">
                  <Megaphone size={14} /> Replay question
                </button>
              )}
              <div className="flex-1" />

              {/* hint */}
              {hintShown && phase === 'q' && (
                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm animate-fadeIn">
                  💡 Hint: {curQ.context}
                </div>
              )}

              {/* answer */}
              {phase !== 'q' && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-900/60 animate-popIn">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Answer</p>
                  <p className="text-xl font-black mb-1" style={{ color: accent }}>{curQ.answer}</p>
                  {curQ.context && <p className="text-sm text-slate-400 italic">{curQ.context}</p>}
                </div>
              )}

              {/* controls */}
              <div className="mt-5">
                {phase === 'q' && (
                  <div className="space-y-3">
                    <Button onClick={() => { sfx.reveal(); setPhase('reveal'); }} className="w-full text-lg py-4" variant="primary">Reveal Answer</Button>
                    {settings.lifelines && (
                      <div className="grid grid-cols-2 gap-3">
                        <Button onClick={useHint} disabled={hintShown || hintsLeft <= 0} variant="secondary" icon={Lightbulb} className="text-sm py-2.5">Hint ({hintsLeft})</Button>
                        <Button onClick={skipQuestion} disabled={skipsLeft <= 0} variant="secondary" icon={SkipForward} className="text-sm py-2.5">Skip ({skipsLeft})</Button>
                      </div>
                    )}
                  </div>
                )}

                {phase === 'reveal' && (
                  <div className="space-y-2">
                    <p className="text-center text-sm font-semibold text-slate-400">Did {answerer?.name} get it right?</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button onClick={() => judge(false)} variant="danger" icon={X} className="py-4">Missed</Button>
                      <Button onClick={() => judge(true)} variant="success" icon={Check} className="py-4">Got it!</Button>
                    </div>
                  </div>
                )}

                {phase === 'steal' && (
                  <div className="space-y-2 animate-fadeIn">
                    <p className="text-center text-sm font-black text-sky-300">🥷 STEAL! Who got it?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {otherEntitiesForSteal(curSlot).map((k) => {
                        const label = mode === 'teams' ? `Team ${k === 'A' ? 'Indigo' : 'Amber'}` : players.find((p) => p.id === k)?.name;
                        const hex = mode === 'teams' ? (k === 'A' ? PALETTE[0].hex : PALETTE[2].hex) : colorOf(players.find((p) => p.id === k));
                        return <Button key={k} onClick={() => doSteal(k)} variant="secondary" className="py-3 text-sm" style={{ borderColor: hex }}>{label}</Button>;
                      })}
                      <Button onClick={() => doSteal('none')} variant="ghost" className="py-3 text-sm col-span-2">Nobody got it</Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* toast */}
        {toast && (
          <div className="fixed inset-x-0 top-1/3 z-50 flex justify-center pointer-events-none">
            <div className="px-8 py-5 rounded-3xl glass animate-popIn text-center" style={{ borderColor: toast.hex, boxShadow: `0 0 40px ${toast.hex}55` }}>
              <p className="text-4xl font-black" style={{ color: toast.hex }}>{toast.text}</p>
              {toast.sub && <p className="text-sm font-bold text-slate-300 mt-1">{toast.sub}</p>}
            </div>
          </div>
        )}
      </Shell>
    );
  }

  function liveStandings() {
    let entities = [];
    if (mode === 'stump') {
      const expert = players.find((p) => p.id === (expertId || players[0].id)) || players[0];
      entities = [
        { id: expert.id, name: expert.name, emoji: expert.emoji, hex: colorOf(expert), score: scores[expert.id] || 0 },
        { id: 'challengers', name: 'Challengers', emoji: '🧑‍🤝‍🧑', hex: '#94a3b8', score: challengerScore },
      ];
    } else if (mode === 'teams') {
      entities = [
        { id: 'A', name: 'Indigo', emoji: '🔵', hex: PALETTE[0].hex, score: scores.A || 0 },
        { id: 'B', name: 'Amber', emoji: '🟡', hex: PALETTE[2].hex, score: scores.B || 0 },
      ];
    } else {
      entities = players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, hex: colorOf(p), score: scores[p.id] || 0 }));
    }
    return { entities };
  }

  function renderSummary() {
    const { entities, winners } = resolveStandings();
    const champ = entities[0];
    const isTie = winners.length > 1 || winners.length === 0;
    return (
      <Shell>
        <div className="max-w-md mx-auto px-5 pt-12 pb-16 space-y-6 text-center animate-fadeIn">
          <div className="animate-floatY"><Trophy className="w-24 h-24 mx-auto text-amber-400" /></div>
          <div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">{isTie ? 'Final Score' : 'Champion'}</p>
            <h2 className="text-4xl font-black text-white mt-1">
              {isTie ? "It's a tie!" : `${champ.emoji} ${champ.name} wins!`}
            </h2>
          </div>

          <div className="space-y-2">
            {entities.map((e, i) => (
              <Card key={e.id} className="p-4 flex items-center gap-3" style={{ borderColor: i === 0 && !isTie ? '#fbbf24' : `${e.hex}33` }}>
                <span className="text-2xl font-black text-slate-500 w-8">{i === 0 && !isTie ? '👑' : `#${i + 1}`}</span>
                <Avatar emoji={e.emoji} hex={e.hex} size={42} />
                <span className="flex-1 text-left font-bold text-white">{e.name}</span>
                <span className="text-3xl font-black" style={{ color: e.hex }}>{e.score}</span>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button onClick={() => { sfx.tap(); startGame(); }} variant="gold" icon={RefreshCw}>Rematch</Button>
            <Button onClick={() => { sfx.tap(); setScreen('menu'); }} variant="secondary" icon={Home}>Menu</Button>
          </div>
          <button onClick={() => { sfx.tap(); setScreen('hof'); }} className="text-slate-400 hover:text-amber-300 font-bold text-sm flex items-center justify-center gap-2 w-full pt-2">
            <Medal size={16} /> View Hall of Fame
          </button>
        </div>
      </Shell>
    );
  }

  function renderHof() {
    const hof = getHallOfFame();
    return (
      <Shell>
        <div className="max-w-md mx-auto px-5 pt-8 pb-16 space-y-5 animate-fadeIn">
          <div className="flex items-center gap-3">
            <button onClick={() => { sfx.tap(); setScreen('menu'); }} className="text-slate-400 hover:text-white"><ChevronLeft /></button>
            <h2 className="text-2xl font-black text-white flex items-center gap-2"><Trophy className="text-amber-400" /> Hall of Fame</h2>
          </div>

          {!hof.players.length ? (
            <Card className="p-8 text-center text-slate-400">No matches yet. Go crown a champion! 👑</Card>
          ) : (
            <>
              <div className="space-y-2">
                {hof.players.map((p, i) => (
                  <Card key={p.name} className="p-4 flex items-center gap-3">
                    <span className="text-xl w-7 text-center">{['🥇', '🥈', '🥉'][i] || `${i + 1}`}</span>
                    <span className="text-2xl">{p.emoji || '🎮'}</span>
                    <div className="flex-1">
                      <p className="font-bold text-white">{p.name}</p>
                      <p className="text-[11px] text-slate-500">{p.games} games · best {p.best} pts</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-amber-400">{p.wins}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">wins</p>
                    </div>
                  </Card>
                ))}
              </div>
              {hof.matches.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 pt-2">Recent matches</h3>
                  {hof.matches.slice(0, 8).map((mt, i) => (
                    <div key={i} className="glass rounded-xl px-4 py-2.5 text-sm flex items-center justify-between">
                      <span className="text-slate-300">{MODES[mt.mode]?.title || mt.mode}</span>
                      <span className="font-bold text-amber-300">{mt.winners.join(', ') || 'Tie'}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => { if (confirm('Clear all Hall of Fame history?')) { clearHallOfFame(); setScreen('menu'); } }}
                className="text-rose-400/70 hover:text-rose-400 text-xs font-bold w-full pt-2">Clear history</button>
            </>
          )}
        </div>
      </Shell>
    );
  }

  // ---------- router ----------
  if (screen === 'menu') return renderMenu();
  if (screen === 'setup') return renderSetup();
  if (screen === 'loading') return renderLoading();
  if (screen === 'playing') return renderPlaying();
  if (screen === 'summary') return renderSummary();
  if (screen === 'hof') return renderHof();
  return renderMenu();
}
