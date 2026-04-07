import React, { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { Send, Users, MessageSquare, Video, VideoOff, Maximize, Minimize, Image as ImageIcon } from 'lucide-react';
import CosmosCanvas from './components/CosmosCanvas';
import ChatPanel from './components/ChatPanel';
import LoginOverlay from './components/LoginOverlay';

const App = () => {
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [proximityRoom, setProximityRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> stream
  const lastSeenSeqRef = useRef(0);
  const peersRef = useRef({}); // userId -> RTCPeerConnection
  const streamRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Connect to socket
  useEffect(() => {
    // Determine the API URL based on environment or fallback
    const apiUrl = import.meta.env.VITE_API_URL || 'https://gamework.onrender.com';
    console.log('🔌 Connecting to socket server at:', apiUrl);
    
    const newSocket = io(apiUrl, {
      reconnectionAttempts: 5,
      timeout: 10000,
    });
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
      // Discard old updates to prevent race conditions
      if (data.sequence < lastSeenSeqRef.current) return;
      lastSeenSeqRef.current = data.sequence;

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

    socket.on('call-signal', async ({ from, signal }) => {
      console.log(`WebRTC: Received signal from ${from}`, signal.type || 'candidate');

      if (signal.type === 'join-video') {
        // Someone joined video, initiate call to them
        createPeer(from, true);
        return;
      }

      if (!peersRef.current[from]) {
        createPeer(from, false);
      }
      
      const peer = peersRef.current[from];
      try {
        if (signal.type === 'offer') {
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit('call-signal', { to: from, signal: answer });
        } else if (signal.type === 'answer') {
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(signal));
        }
      } catch (err) {
        console.error("WebRTC Error:", err);
      }
    });

    socket.on('history-update', (data) => {
      // Only set history if the room still matches
      setProximityRoom(prev => {
        if (prev && prev.id === data.roomId) {
          setMessages(data.history);
        }
        return prev;
      });
    });

    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      socket.off('initial-users');
      socket.off('user-joined');
      socket.off('user-moved');
      socket.off('user-left');
      socket.off('proximity-update');
      socket.off('new-message');
      socket.off('history-update');
    };
  }, [socket]);

  const handleLogin = (username, color, avatar) => {
    const worldSize = 2000;
    const startPos = {
      x: Math.random() * (worldSize - 200) + 100,
      y: Math.random() * (worldSize - 200) + 100
    };
    const userInfo = { username, color, avatar, ...startPos };
    setUser(userInfo);
    socket.emit('join', userInfo);
  };

  const lastEmitRef = useRef(0);

  const createPeer = (userId, isInitiator) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('call-signal', { to: userId, signal: e.candidate });
      }
    };

    peer.ontrack = (e) => {
      setRemoteStreams(prev => ({ ...prev, [userId]: e.streams[0] }));
    };

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        peer.addTrack(track, streamRef.current);
      });
    }

    if (isInitiator) {
      peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socket.emit('call-signal', { to: userId, signal: offer });
      });
    }

    peersRef.current[userId] = peer;
    return peer;
  };

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

  const sendImage = (dataUrl) => {
    if (!socket || !proximityRoom) return;
    socket.emit('chat-message', { content: dataUrl, roomId: proximityRoom.id, type: 'image' });
  };

  const toggleVideo = async () => {
    if (isVideoActive) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setLocalStream(null);
      setIsVideoActive(false);
      Object.values(peersRef.current).forEach(p => p.close());
      peersRef.current = {};
      setRemoteStreams({});
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        setLocalStream(stream);
        setIsVideoActive(true);
        // Start calls with everyone in the room
        proximityRoom?.members.forEach(m => {
          // Find member socket ID? This needs a map. 
          // For now, let's just broadcast an 'initiate-call'
          socket.emit('call-signal', { roomId: proximityRoom.id, signal: { type: 'join-video' } });
        });
      } catch (err) {
        console.error("Camera access failed:", err);
      }
    }
  };

  if (!user) {
    return <LoginOverlay onLogin={handleLogin} />;
  }

  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden select-none">
      <CosmosCanvas
        currentUser={user}
        otherUsers={users.filter(u => u.id !== socket?.id)}
        onMove={handleMove}
        proximityRadius={250}
        socketId={socket?.id}
      />

      {proximityRoom && (
        <>
          <ChatPanel
            room={proximityRoom}
            messages={messages}
            onSendMessage={sendMessage}
            onSendImage={sendImage}
            toggleVideo={toggleVideo}
            isVideoActive={isVideoActive}
            currentUser={user}
          />
          
          {/* Video Overlay */}
          <div className="absolute top-24 right-6 flex flex-col gap-4 pointer-events-none">
            {localStream && (
              <div className="w-48 aspect-video glass rounded-xl overflow-hidden border-2 border-violet-500 shadow-xl pointer-events-auto relative">
                <video 
                  autoPlay 
                  muted 
                  playsInline 
                  ref={el => { if(el) el.srcObject = localStream; }} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded text-[10px] text-white">You</div>
              </div>
            )}
            {Object.entries(remoteStreams).map(([id, stream]) => (
              <div key={id} className="w-48 aspect-video glass rounded-xl overflow-hidden border border-white/10 shadow-xl pointer-events-auto relative">
                <video 
                  autoPlay 
                  playsInline 
                  ref={el => { if(el) el.srcObject = stream; }} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded text-[10px] text-white">Guest</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Stats / UI Overlay */}
      <div className="absolute top-4 left-4 p-4 glass rounded-xl pointer-events-none flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-glow mb-1">Cosmos Chat</h1>
          <p className="text-xs text-slate-400">Move: WASD or Arrows</p>
          <div className="mt-2 text-sm">
            <span className="text-slate-500">Connected:</span> {users.length}
          </div>
        </div>
        <button 
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen();
            } else {
              if (document.exitFullscreen) document.exitFullscreen();
            }
          }}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg pointer-events-auto transition-all text-slate-400 hover:text-white"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>
    </div>
  );
};

export default App;
