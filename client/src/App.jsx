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

  const handleLogin = (username, color) => {
    const startPos = { x: Math.random() * (window.innerWidth - 100) + 50, y: Math.random() * (window.innerHeight - 100) + 50 };
    const userInfo = { username, color, ...startPos };
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
    <div className="relative w-screen h-screen bg-slate-950">
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
      <div className="absolute top-4 left-4 p-4 glass rounded-xl pointer-events-none">
        <h1 className="text-xl font-bold text-glow mb-1">Cosmos Chat</h1>
        <p className="text-xs text-slate-400">Move: WASD or Arrows</p>
        <div className="mt-2 text-sm">
          <span className="text-slate-500">Connected:</span> {users.length}
        </div>
      </div>
    </div>
  );
};

export default App;
