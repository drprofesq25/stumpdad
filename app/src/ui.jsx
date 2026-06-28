import React from 'react';
import { sfx } from './game/audio.js';

export function Button({ onClick, children, variant = 'primary', className = '', disabled = false, icon: Icon, style }) {
  const variants = {
    primary: 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-lg shadow-indigo-900/40',
    secondary: 'glass text-slate-100 hover:border-indigo-400/50',
    danger: 'bg-rose-500 text-white hover:bg-rose-400 shadow-lg shadow-rose-900/40',
    success: 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-900/40',
    ghost: 'bg-transparent text-slate-400 hover:text-slate-100 hover:bg-white/5',
    gold: 'bg-amber-400 text-slate-900 hover:bg-amber-300 shadow-lg shadow-amber-900/40',
  };
  return (
    <button
      onClick={(e) => {
        sfx.tap();
        onClick && onClick(e);
      }}
      disabled={disabled}
      style={style}
      className={`px-5 py-3.5 rounded-2xl font-bold transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={20} />}
      {children}
    </button>
  );
}

export function Card({ children, className = '', style }) {
  return (
    <div className={`glass rounded-3xl shadow-2xl overflow-hidden ${className}`} style={style}>
      {children}
    </div>
  );
}

// Countdown ring (SVG). pct = 0..1 remaining.
export function ProgressRing({ pct, size = 56, stroke = 6, color = '#6366f1', label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const danger = pct <= 0.25;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(148,163,184,0.18)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={danger ? '#f43f5e' : color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={`absolute font-black ${danger ? 'text-rose-400' : 'text-slate-100'}`} style={{ fontSize: size * 0.32 }}>
        {label}
      </span>
    </div>
  );
}

export function Avatar({ emoji, hex, size = 44, ring = false }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl shrink-0"
      style={{
        width: size,
        height: size,
        background: `${hex}22`,
        border: `2px solid ${ring ? hex : 'transparent'}`,
        fontSize: size * 0.5,
      }}
    >
      {emoji}
    </div>
  );
}
