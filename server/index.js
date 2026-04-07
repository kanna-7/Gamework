require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const Message = require('./models/Message');

const app = express();
const CLIENT_URL = process.env.CLIENT_URL || 'https://gamework-e49l.vercel.app,http://localhost:5173,http://localhost:5174';

// Handle multiple origins if provided as a comma-separated string
let allowedOrigins = CLIENT_URL.includes(',') 
  ? CLIENT_URL.split(',').map(o => o.trim()) 
  : [CLIENT_URL]; // Ensure it's an array if only one URL is provided

// Force include the Vercel deployed frontend
if (!allowedOrigins.includes('https://gamework-e49l.vercel.app')) {
  allowedOrigins.push('https://gamework-e49l.vercel.app');
}

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
}));
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cosmos_chat';
if (!process.env.MONGO_URI) {
  console.warn('⚠️ WARNING: MONGO_URI not found in environment variables. Falling back to local MongoDB.');
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// In-memory state
const users = new Map(); // socketId -> { id, username, x, y, color }
const PROXIMITY_RADIUS = 250; // Sync with client-side visuals
let proximitySequence = 0; // Prevent race conditions
let proximityTimer = null; // Throttling

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', ({ username, color, avatar, x, y }) => {
    const newUser = {
      id: socket.id,
      username,
      avatar: avatar || '/avatars/avatar1.png',
      color: color || `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      x: x || Math.random() * (2000 - 200) + 100,
      y: y || Math.random() * (2000 - 200) + 100,
    };
    users.set(socket.id, newUser);

    // Broadcast existing users to the new user
    socket.emit('initial-users', Array.from(users.values()));

    // Broadcast new user to everyone
    socket.broadcast.emit('user-joined', newUser);

    updateProximityGroups();
  });

  socket.on('move', ({ x, y }) => {
    const user = users.get(socket.id);
    if (user) {
      user.x = x;
      user.y = y;
      socket.broadcast.emit('user-moved', { id: socket.id, x, y });
      
      // Throttle proximity updates to once every 500ms
      if (!proximityTimer) {
        proximityTimer = setTimeout(() => {
          updateProximityGroups();
          proximityTimer = null;
        }, 500);
      }
    }
  });

  socket.on('chat-message', async ({ content, roomId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    try {
      // Always broadcast to specific room for real-time responsiveness
      io.to(roomId).emit('new-message', {
        id: Date.now(),
        sender: user.username,
        content,
        timestamp: new Date(),
        roomId
      });

      // Attempt to save to MongoDB in background
      const msg = new Message({
        sender: user.username,
        content,
        roomId,
      });
      await msg.save();
    } catch (err) {
      console.error('Error saving message to DB:', err);
      // We don't return here because the message was already emitted
    }
  });

  socket.on('call-signal', (data) => {
    // Relay signaling data to a specific peer or room
    if (data.to) {
      io.to(data.to).emit('call-signal', { from: socket.id, signal: data.signal });
    } else if (data.roomId) {
      socket.to(data.roomId).emit('call-signal', { from: socket.id, signal: data.signal });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    users.delete(socket.id);
    io.emit('user-left', socket.id);
    updateProximityGroups();
  });
});

/**
 * Recalculate proximity groups using connected components
 */
function updateProximityGroups() {
  const userList = Array.from(users.values());
  const socketIds = Array.from(users.keys());

  // Reset rooms for everyone
  socketIds.forEach(id => {
    const socket = io.sockets.sockets.get(id);
    if (socket) {
      // Clear existing proximity rooms
      const rooms = Array.from(socket.rooms).filter(r => r.startsWith('room_'));
      rooms.forEach(r => socket.leave(r));
    }
  });

  // We'll proceed to build adjacency and components even if empty, as the component loop
  // naturally handles this. Notify logic will clear out rooms for single users.
  // if (userList.length < 2) return; 

  // Build adjacency list
  const adj = new Map();
  userList.forEach(u => adj.set(u.id, []));

  for (let i = 0; i < userList.length; i++) {
    for (let j = i + 1; j < userList.length; j++) {
      const u1 = userList[i];
      const u2 = userList[j];
      const dist = Math.sqrt(Math.pow(u1.x - u2.x, 2) + Math.pow(u1.y - u2.y, 2));

      if (dist < PROXIMITY_RADIUS) {
        adj.get(u1.id).push(u2.id);
        adj.get(u2.id).push(u1.id);
      }
    }
  }

  // Find components
  const visited = new Set();
  const components = [];

  socketIds.forEach(id => {
    if (!visited.has(id) && adj.get(id).length > 0) {
      const component = [];
      const stack = [id];
      visited.add(id);

      while (stack.length > 0) {
        const u = stack.pop();
        component.push(u);
        adj.get(u).forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            stack.push(neighbor);
          }
        });
      }
      if (component.length > 1) {
        components.push(component);
      }
    }
  });

  // Assign rooms
  components.forEach((component) => {
    const roomId = `room_${component.sort().join('_').substring(0, 50)}`;
    const members = component.map(cid => users.get(cid)?.username).filter(Boolean);

    const currentSeq = ++proximitySequence;
    component.forEach(id => {
      const socket = io.sockets.sockets.get(id);
      const userData = users.get(id);
      if (socket && userData) {
        socket.join(roomId);
        // Step 1: Open the UI immediately with a sequence ID
        socket.emit('proximity-update', {
          inRoom: true,
          roomId,
          members,
          sequence: currentSeq
        });
      }
    });

    // Step 2: Fetch and send history in the background
    Message.find({ roomId }).sort({ timestamp: -1 }).limit(20)
      .then(results => {
        const history = results.reverse();
        io.to(roomId).emit('history-update', { roomId, history });
      })
      .catch(err => console.error('Error fetching history:', err));
  });

  // Notify users NOT in a room
  const currentSeq = ++proximitySequence;
  socketIds.forEach(id => {
    if (!visited.has(id) || adj.get(id).length === 0) {
      const socket = io.sockets.sockets.get(id);
      if (socket) {
        socket.emit('proximity-update', {
          inRoom: false,
          sequence: currentSeq
        });
      }
    }
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
});

// Robust error handling for port conflicts
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ ERROR: Port ${PORT} is already in use!`);
    console.log(`💡 TIP: Another instance of the server is likely running. You can kill it or try a different port.`);
    process.exit(1);
  } else {
    console.error('\n❌ Server Error:', err);
  }
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n🛑 Shutting down server gracefully...');
  server.close(() => {
    mongoose.connection.close(false).then(() => {
      console.log('✅ Connections closed. Goodbye!');
      process.exit(0);
    });
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
