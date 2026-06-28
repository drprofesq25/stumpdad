import React, { useState } from 'react';
import { Trophy, Brain, XCircle, CheckCircle, RefreshCw, Plus, Trash2, GraduationCap, ChevronRight, AlertCircle, Swords, User, Users } from 'lucide-react';

// --- API HANDLING ---
const apiKey = ""; // Runtime environment provides this

const generateTrivia = async (mode, config, difficulty) => {
  let prompt = "";
  
  if (mode === 'stump') {
    prompt = `Generate 10 trivia questions based on these topics: ${config.p1Categories.join(', ')}. 
    Difficulty: ${difficulty}. 
    Return a RAW JSON array of objects with keys: "category", "question", "answer", "context" (1 sentence fact), and "assignedTo" (value must be "player1").`;
  } else {
    // Versus Mode
    prompt = `Generate 12 trivia questions for a head-to-head battle.
    Player 1 topics: ${config.p1Categories.join(', ')}.
    Player 2 topics: ${config.p2Categories.join(', ')}.
    Alternate strictly between Player 1 and Player 2. 
    Difficulty: ${difficulty}.
    Return a RAW JSON array of objects with keys: "category", "question", "answer", "context" (1 sentence fact), and "assignedTo" (value must be "player1" for P1 questions or "player2" for P2 questions).`;
  }

  // Common API Call Logic
  const callApi = async (attempt = 0) => {
    const delays = [1000, 2000, 4000];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          }),
        }
      );

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No content generated");
      
      // Clean up markdown if the AI adds it (fixes potential JSON parse errors)
      const cleanedText = text.replace(/```json|```/g, '').trim();
      
      return JSON.parse(cleanedText);

    } catch (error) {
      if (attempt < delays.length) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        return callApi(attempt + 1);
      }
      throw error;
    }
  };

  return callApi();
};

// --- AUDIO HANDLING ---
const playSound = (type) => {
  // Simple synthesizer using Web Audio API so no external files are needed
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      // Ding: High pitch sine wave that fades out
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.05); // Slide up to C6
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else {
      // Buzzer: Low pitch sawtooth wave
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime); // Low buzz
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3); // Drop pitch slightly
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

// --- COMPONENTS ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, children, variant = 'primary', className = "", disabled = false, icon: Icon }) => {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 shadow-lg",
    secondary: "bg-white text-slate-700 border-2 border-slate-200 hover:border-indigo-300 hover:text-indigo-600",
    danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200 shadow-lg",
    success: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200 shadow-lg",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`px-6 py-3 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}>
      {Icon && <Icon size={20} />}
      {children}
    </button>
  );
};

// --- MAIN APP ---

export default function StumpDad() {
  const [appState, setAppState] = useState('menu'); // menu, setup, loading, playing, summary
  const [gameMode, setGameMode] = useState('stump'); // 'stump' or 'versus'
  
  // Game Config State
  const [p1Name, setP1Name] = useState('Dad');
  const [p2Name, setP2Name] = useState('Challenger');
  const [p1Categories, setP1Categories] = useState(['History', 'Classic Rock']);
  const [p2Categories, setP2Categories] = useState(['Video Games', 'Memes']); // Only used in versus
  const [difficulty, setDifficulty] = useState('Hard');

  // Input State
  const [newCatInput, setNewCatInput] = useState('');
  const [activeTab, setActiveTab] = useState(1); // For versus setup (1 or 2)

  // Gameplay State
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [scores, setScores] = useState({ p1: 0, p2: 0 }); // p2 is Challenger in Stump mode
  const [error, setError] = useState(null);

  // --- HANDLERS ---

  const addCategory = (playerNum) => {
    if (!newCatInput.trim()) return;
    if (playerNum === 1 && p1Categories.length < 5) {
      setP1Categories([...p1Categories, newCatInput.trim()]);
    } else if (playerNum === 2 && p2Categories.length < 5) {
      setP2Categories([...p2Categories, newCatInput.trim()]);
    }
    setNewCatInput('');
  };

  const removeCategory = (playerNum, index) => {
    if (playerNum === 1) setP1Categories(p1Categories.filter((_, i) => i !== index));
    else setP2Categories(p2Categories.filter((_, i) => i !== index));
  };

  const startGame = async () => {
    setAppState('loading');
    setError(null);
    setScores({ p1: 0, p2: 0 });
    setCurrentQIndex(0);
    setIsAnswerRevealed(false);

    try {
      const qs = await generateTrivia(
        gameMode, 
        { p1Categories, p2Categories }, 
        difficulty
      );
      setQuestions(qs);
      setAppState('playing');
    } catch (err) {
      console.error(err);
      setError("The AI is thinking too hard. Try again!");
      setAppState('setup');
    }
  };

  const handleScore = (pointForPlayer) => {
    // pointForPlayer: 'p1' or 'p2', or null for no points
    if (pointForPlayer) {
      setScores(prev => ({ ...prev, [pointForPlayer]: prev[pointForPlayer] + 1 }));
    }
    
    setTimeout(() => {
      if (currentQIndex < questions.length - 1) {
        setCurrentQIndex(prev => prev + 1);
        setIsAnswerRevealed(false);
      } else {
        setAppState('summary');
      }
    }, 400);
  };

  // --- RENDERERS ---

  const renderMenu = () => (
    <div className="max-w-md mx-auto space-y-8 animate-fadeIn p-4 pt-10">
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-black text-slate-800 tracking-tighter">StumpDad</h1>
        <p className="text-slate-500 text-lg">Choose your battle.</p>
      </div>

      <div className="grid gap-4">
        <button 
          onClick={() => { setGameMode('stump'); setP1Name('Dad'); setP2Name('The Challenger'); setAppState('setup'); }}
          className="bg-white p-6 rounded-2xl shadow-lg border-2 border-transparent hover:border-indigo-500 hover:shadow-xl transition-all group text-left relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Brain size={100} className="text-indigo-600" />
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
              <User size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">Stump Dad</h3>
          </div>
          <p className="text-slate-500 relative z-10 font-medium">
            One dad. One challenger. Does Dad really know as much as he thinks he does?
          </p>
        </button>

        <button 
          onClick={() => { setGameMode('versus'); setP1Name('Dad'); setP2Name('You'); setAppState('setup'); }}
          className="bg-white p-6 rounded-2xl shadow-lg border-2 border-transparent hover:border-emerald-500 hover:shadow-xl transition-all group text-left relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Swords size={100} className="text-emerald-600" />
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform">
              <Users size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">You vs. Dad</h3>
          </div>
          <p className="text-slate-500 relative z-10 font-medium">
            Head-to-head. Pick your own expert topics and battle for the high score.
          </p>
        </button>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="max-w-md mx-auto space-y-6 animate-fadeIn p-4">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setAppState('menu')} className="text-slate-400 hover:text-slate-600">
          <ChevronRight className="rotate-180" />
        </button>
        <h2 className="text-xl font-bold text-slate-800">
          Setup: {gameMode === 'stump' ? 'Stump Mode' : 'Versus Mode'}
        </h2>
      </div>

      <Card className="p-6 space-y-6">
        {/* Names */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Player 1</label>
            <input 
              value={p1Name} onChange={(e) => setP1Name(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-indigo-700"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Player 2</label>
            <input 
              value={p2Name} onChange={(e) => setP2Name(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-emerald-700"
            />
          </div>
        </div>

        {/* Categories Section */}
        <div className="space-y-3">
          {gameMode === 'versus' && (
            <div className="flex p-1 bg-slate-100 rounded-lg mb-4">
              <button 
                onClick={() => setActiveTab(1)}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 1 ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
              >
                {p1Name}'s Topics
              </button>
              <button 
                onClick={() => setActiveTab(2)}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 2 ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
              >
                {p2Name}'s Topics
              </button>
            </div>
          )}

          <label className="text-xs font-bold text-slate-400 uppercase flex items-center justify-between">
            {gameMode === 'stump' ? 'Expertise Areas' : `${activeTab === 1 ? p1Name : p2Name}'s Topics`}
            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">Max 5</span>
          </label>

          <div className="flex gap-2">
            <input 
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory(gameMode === 'stump' ? 1 : activeTab)}
              placeholder="e.g. 80s Movies, Woodworking..."
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onClick={() => addCategory(gameMode === 'stump' ? 1 : activeTab)}
              className="p-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700"
            >
              <Plus size={24} />
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {(gameMode === 'stump' ? p1Categories : (activeTab === 1 ? p1Categories : p2Categories)).map((cat, idx) => (
              <span key={idx} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${
                (gameMode === 'stump' || activeTab === 1) ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
              }`}>
                {cat}
                <button onClick={() => removeCategory(gameMode === 'stump' ? 1 : activeTab, idx)} className="hover:opacity-70"><XCircle size={14} /></button>
              </span>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-400 uppercase">Difficulty</label>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {['Medium', 'Hard', 'Expert'].map((level) => (
              <button
                key={level}
                onClick={() => setDifficulty(level)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                  difficulty === level 
                    ? 'bg-white text-slate-800 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg flex gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <Button onClick={startGame} className="w-full text-lg" icon={Brain}>
          Generate Questions
        </Button>
      </Card>
    </div>
  );

  const renderPlaying = () => {
    const currentQ = questions[currentQIndex];
    const isP1Question = currentQ.assignedTo === 'player1';
    
    // In Stump mode, P1 is always the target. In Versus, it alternates.
    const activePlayerName = isP1Question ? p1Name : p2Name;
    const activeColor = isP1Question ? 'text-indigo-600' : 'text-emerald-600';
    const activeBg = isP1Question ? 'bg-indigo-600' : 'bg-emerald-600';

    return (
      <div className="max-w-md mx-auto space-y-6 p-4">
        {/* Scoreboard */}
        <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className={`text-center w-1/3 transition-opacity ${!isP1Question && gameMode === 'versus' ? 'opacity-50' : 'opacity-100'}`}>
            <p className="text-xs font-bold text-slate-400 uppercase">{p1Name}</p>
            <p className="text-3xl font-black text-indigo-600">{scores.p1}</p>
          </div>
          <div className="text-center w-1/3 border-x border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase">Round</p>
            <p className="text-xl font-bold text-slate-700">{currentQIndex + 1}/{questions.length}</p>
          </div>
          <div className={`text-center w-1/3 transition-opacity ${isP1Question && gameMode === 'versus' ? 'opacity-50' : 'opacity-100'}`}>
            <p className="text-xs font-bold text-slate-400 uppercase">{p2Name}</p>
            <p className="text-3xl font-black text-emerald-600">{scores.p2}</p>
          </div>
        </div>

        {/* Question Card */}
        <div className="relative min-h-[450px]">
          <Card className="h-full flex flex-col p-8 text-center justify-between min-h-[450px]">
            <div>
              <div className="flex justify-center items-center gap-2 mb-4">
                <span className={`px-3 py-1 text-white text-xs font-bold uppercase tracking-wider rounded-full ${activeBg}`}>
                  For {activePlayerName}
                </span>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-full">
                  {currentQ.category}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 leading-snug">
                {currentQ.question}
              </h3>
            </div>

            <div key={currentQIndex} className={`transition-all duration-500 my-6 transform ${isAnswerRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
               <p className="text-sm font-bold text-slate-400 uppercase mb-2">Answer</p>
               <p className={`text-xl font-bold mb-2 ${activeColor}`}>{currentQ.answer}</p>
               <p className="text-sm text-slate-500 italic">{currentQ.context}</p>
            </div>

            <div className="mt-auto">
              {!isAnswerRevealed ? (
                <Button onClick={() => setIsAnswerRevealed(true)} className="w-full">
                  Reveal Answer
                </Button>
              ) : (
                <div className="space-y-3">
                   <p className="text-sm font-medium text-slate-400">Did {activePlayerName} get it?</p>
                   <div className="grid grid-cols-2 gap-3">
                    <Button 
                      onClick={() => {
                        playSound('incorrect');
                        gameMode === 'stump' ? handleScore('p2') : handleScore(null);
                      }}
                      variant="danger"
                      icon={XCircle}
                    >
                      Missed
                    </Button>
                    <Button 
                      onClick={() => {
                        playSound('correct');
                        handleScore(isP1Question ? 'p1' : 'p2');
                      }} 
                      variant="success"
                      icon={CheckCircle}
                    >
                      Solved
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    const winner = scores.p1 > scores.p2 ? p1Name : scores.p2 > scores.p1 ? p2Name : "Draw";
    return (
      <div className="max-w-md mx-auto p-4 space-y-6 text-center animate-fadeIn pt-10">
        <Trophy className="w-20 h-20 text-yellow-500 mx-auto" />
        <h2 className="text-4xl font-black text-slate-800">
          {winner === "Draw" ? "It's a Tie!" : `${winner} Wins!`}
        </h2>

        <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-indigo-50 border-indigo-100">
                <p className="text-sm font-bold text-indigo-400 uppercase">{p1Name}</p>
                <p className="text-4xl font-black text-indigo-700">{scores.p1}</p>
            </Card>
            <Card className="p-4 bg-emerald-50 border-emerald-100">
                <p className="text-sm font-bold text-emerald-400 uppercase">{p2Name}</p>
                <p className="text-4xl font-black text-emerald-700">{scores.p2}</p>
            </Card>
        </div>

        <Button onClick={() => setAppState('menu')} variant="primary" className="w-full" icon={RefreshCw}>
          Back to Menu
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 pb-12">
      {appState === 'menu' && renderMenu()}
      {appState === 'setup' && renderSetup()}
      {appState === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 space-y-6">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <h2 className="text-2xl font-bold text-slate-800">Generating Battle...</h2>
        </div>
      )}
      {appState === 'playing' && renderPlaying()}
      {appState === 'summary' && renderSummary()}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}