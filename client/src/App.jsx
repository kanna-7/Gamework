import React, { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import CosmosCanvas from './components/CosmosCanvas';
import ChatPanel from './components/ChatPanel';
import LoginOverlay from './components/LoginOverlay';

const App = () => {
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [proximityRoom, setProximityRoom] = useState(null);
  const [messages, setMessages] = useState([]);

  // Connect to socket
  useEffect(() => {
    const newSocket = io(window.location.origin === 'http://localhost:5173' ? 'http://localhost:5000' : window.location.origin);
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('initial-users', (data) => setUsers(data));
    socket.on('user-joined', (newUser) => setUsers((prev) => [...prev, newUser]));
    socket.on('user-moved', ({ id, x, y }) => {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, x, y } : u)));
    });
    socket.on('user-left', (id) => setUsers((prev) => prev.filter((u) => u.id !== id)));

    socket.on('proximity-update', (data) => {
      if (data.inRoom) {
        setProximityRoom({ id: data.roomId, members: data.members });
        if (data.history) {
          setMessages(data.history);
        }
      } else {
        setProximityRoom(null);
        setMessages([]); // Clear messages when leaving proximity
      }
    });

    socket.on('new-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off('initial-users');
      socket.off('user-joined');
      socket.off('user-moved');
      socket.off('user-left');
      socket.off('proximity-update');
      socket.off('new-message');
    };
  }, [socket]);

  const handleLogin = (username, color, avatar) => {
    const startPos = {
      x: Math.random() * (window.innerWidth - 100) + 50,
      y: Math.random() * (window.innerHeight - 100) + 50
    };
    const userInfo = { username, color, avatar, ...startPos };
    setUser(userInfo);
    socket.emit('join', userInfo);
  };

  const lastEmitRef = useRef(0);

  const handleMove = useCallback((x, y) => {
    if (!socket || !user) return;

    // Update local state immediately for smooth rendering
    setUser(prev => ({ ...prev, x, y }));

    // Throttle socket emissions to ~30Hz (once every 33ms)
    const now = Date.now();
    if (now - lastEmitRef.current > 33) {
      socket.emit('move', { x, y });
      lastEmitRef.current = now;
    }

    // Update users list locally for self position
    setUsers(prev => prev.map(u => u.id === socket.id ? { ...u, x, y } : u));
  }, [socket, user]);

  const sendMessage = (content) => {
    if (!socket || !proximityRoom) return;
    socket.emit('chat-message', { content, roomId: proximityRoom.id });
  };

  if (!user) {
    return <LoginOverlay onLogin={handleLogin} />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden selection:bg-purple-500/30">
      {/* Decorative Background Vignette */}
      <div className="vignette-overlay" />

      <CosmosCanvas
        currentUser={user}
        otherUsers={users.filter(u => u.id !== socket?.id)}
        onMove={handleMove}
        proximityRadius={150}
        socketId={socket?.id}
      />

      {proximityRoom && (
        <ChatPanel
          room={proximityRoom}
          messages={messages}
          onSendMessage={sendMessage}
          currentUser={user}
        />
      )}

      {/* Stats / UI Overlay */}
      <div className="absolute top-6 left-6 p-5 glass rounded-2xl pointer-events-none transition-all duration-500 hover:scale-[1.02]">
        <h1 className="text-2xl font-extrabold text-glow mb-2 tracking-tight">Cosmos <span className="text-blue-400">Chat</span></h1>
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Controls</p>
          <div className="flex gap-2">
            <span className="glass-pill px-2 py-0.5 text-[9px] text-slate-300">WASD</span>
            <span className="glass-pill px-2 py-0.5 text-[9px] text-slate-300">Arrows</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Connected</span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
            <span className="text-sm font-bold text-slate-200 tabular-nums">{users.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
