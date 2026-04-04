import React, { useState } from 'react';
import { Rocket, Sparkles } from 'lucide-react';

const COLORS = [
  '#7c3aed', // Violet
  '#2563eb', // Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#dc2626', // Red
  '#db2777', // Pink
  '#4f46e5', // Indigo
  '#0891b2', // Cyan
];

const LoginOverlay = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username, selectedColor);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-4">
      {/* Background stars for login screen */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        {[...Array(50)].map((_, i) => (
          <div 
            key={i} 
            className="absolute bg-white rounded-full animate-pulse-slow"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 3}px`,
              height: `${Math.random() * 3}px`,
              animationDelay: `${Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-md glass p-8 rounded-3xl border-violet-500/20 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-violet-900/40 rotate-3">
             <Rocket size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-glow">Cosmos Chat</h1>
          <p className="text-slate-400 mt-2 text-sm max-w-xs">
            Enter the 2D space, move around, and talk to explorers near you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 ml-1">
              Your Explorer Name
            </label>
            <input
              autoFocus
              type="text"
              maxLength={15}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. StarLord"
              className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all font-medium"
            />
          </div>

          <div>
             <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 ml-1">
              Choose Your Color
            </label>
            <div className="flex flex-wrap gap-2 justify-center">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 ${
                    selectedColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!username.trim()}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:pointer-events-none py-3.5 rounded-xl font-bold shadow-lg shadow-violet-900/30 transition-all flex items-center justify-center gap-2 mt-4"
          >
            Launch into Cosmos
            <Sparkles size={18} />
          </button>
        </form>

        <div className="mt-8 text-center text-[10px] text-slate-600 font-medium tracking-widest uppercase">
          Proximity Communication Enabled
        </div>
      </div>
    </div>
  );
};

export default LoginOverlay;
