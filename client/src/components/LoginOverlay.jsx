import React, { useState } from 'react';
import { Rocket, Shield, Zap, Heart } from 'lucide-react';

const LoginOverlay = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('/avatars/avatar1.png');
  const [selectedColor, setSelectedColor] = useState('#8b5cf6');

  const avatars = [
    { id: 1, path: '/avatars/avatar1.png', color: '#8b5cf6' },
    { id: 2, path: '/avatars/avatar2.png', color: '#ec4899' },
    { id: 3, path: '/avatars/avatar3.png', color: '#06b6d4' },
  ];

  const handleAvatarSelect = (avatar) => {
    setSelectedAvatar(avatar.path);
    setSelectedColor(avatar.color);
  };

  const handleLaunch = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username.trim(), selectedColor, selectedAvatar);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md glass rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Background glow Decor */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-violet-600/20 blur-[100px]" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-600/20 blur-[100px]" />

        <div className="relative text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <Rocket className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Cosmos Chat</h1>
          <p className="text-slate-400 text-sm">Choose your explorer and launch</p>
        </div>

        <form onSubmit={handleLaunch} className="space-y-8">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Explorer Name</label>
            <input
              autoFocus
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={15}
              placeholder="Enter username..."
              className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all placeholder:text-slate-700"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">Select Your Avatar</label>
            <div className="flex justify-center gap-6">
              {avatars.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => handleAvatarSelect(avatar)}
                  className={`relative group transition-all duration-300 ${selectedAvatar === avatar.path ? 'scale-110' : 'opacity-60 grayscale hover:grayscale-0'
                    }`}
                >
                  <div className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${selectedAvatar === avatar.path ? 'border-violet-500 shadow-xl shadow-violet-900/20' : 'border-white/5'
                    }`}>
                    <img src={avatar.path} alt={`Avatar ${avatar.id}`} className="w-full h-full object-cover" />
                  </div>
                  {selectedAvatar === avatar.path && (
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center border-2 border-slate-900">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!username.trim()}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-violet-900/40 disabled:opacity-50 disabled:grayscale cursor-pointer transform active:scale-[0.98]"
          >
            Launch into Cosmos
          </button>
        </form>

        <div className="mt-8 flex justify-center gap-8 text-slate-500">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-tighter">
            <Zap size={12} /> Proximity Based
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-tighter">
            <Shield size={12} /> Secure Chat
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-tighter">
            <Heart size={12} /> MongoDB Linked
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginOverlay;
