import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, MessageSquare, Video, VideoOff, Image as ImageIcon } from 'lucide-react';

const ChatPanel = ({ room, messages, onSendMessage, onSendImage, toggleVideo, isVideoActive, currentUser }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.size < 2 * 1024 * 1024) { // 2MB limit
      const reader = new FileReader();
      reader.onload = (ev) => onSendImage(ev.target.result);
      reader.readAsDataURL(file);
    } else if (file) {
      alert("Image is too large! (Limit 2MB)");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };
  
  return (
    <div className="absolute bottom-6 right-6 w-80 max-h-[500px] flex flex-col glass rounded-2xl shadow-2xl overflow-hidden border-slate-800 transition-all duration-500 ease-in-out transform translate-y-0 opacity-100">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-violet-600/10">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-violet-400" />
          <h2 className="font-semibold text-sm">Proximity Chat</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleVideo} 
            className={`p-1.5 rounded-full transition-all ${isVideoActive ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-slate-400 hover:text-white'}`}
            title={isVideoActive ? "End Call" : "Start Video Call"}
          >
            {isVideoActive ? <VideoOff size={16} /> : <Video size={16} />}
          </button>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-slate-400">
            <Users size={12} />
            {room.members.length} Near
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[350px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center mb-2">
              <MessageSquare size={20} className="text-slate-700" />
            </div>
            <p className="text-xs text-slate-500">You are near {room.members.length - 1} other(s). Start chatting!</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              className={`flex flex-col ${msg.sender === currentUser.username ? 'items-end' : 'items-start'}`}
            >
              <span className="text-[10px] text-slate-500 mb-1 px-1">
                {msg.sender}
              </span>
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${msg.sender === currentUser.username
                ? 'bg-violet-600 text-white rounded-tr-none'
                : 'bg-slate-800 text-slate-200 rounded-tl-none'
                }`}>
                {msg.type === 'image' ? (
                  <img src={msg.content} alt="shared" className="rounded-lg max-w-full cursor-zoom-in" onClick={() => window.open(msg.content)} />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 bg-white/5 border-t border-white/5 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={200}
          placeholder="Say something cosmos..."
          className="flex-1 bg-slate-900 border border-white/5 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
        />
        <label className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all cursor-pointer text-slate-400">
          <ImageIcon size={18} />
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 p-2 rounded-xl transition-all shadow-lg shadow-violet-900/20"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
