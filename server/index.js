require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const Message = require('./models/Message');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// MongoDB Connection
const MONGO_URI = 'mongodb+srv://vithanalapraveen069_db_user:otjCfohswpUQIRXf@cluster0.opf9zwo.mongodb.net/cosmos_chat?retryWrites=true&w=majority';
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// In-memory state
const users = new Map(); // socketId -> { id, username, x, y, color }
const PROXIMITY_RADIUS = 150; // Increased range for better UX

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', ({ username, color, x, y }) => {
    const newUser = {
      id: socket.id,
      username,
      color: color || `#${Math.floor(Math.random()*16777215).toString(16)}`,
      x: x || Math.random() * 800,
      y: y || Math.random() * 600,
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
      updateProximityGroups();
    }
  });

  socket.on('chat-message', async ({ content, roomId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    try {
      const msg = new Message({
        sender: user.username,
        content,
        roomId,
      });
      await msg.save();
      
      // Broadcast to specific room
      io.to(roomId).emit('new-message', {
        id: Date.now(),
        sender: user.username,
        content,
        timestamp: new Date(),
        roomId
      });
    } catch (err) {
      console.error('Error saving message:', err);
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

  if (userList.length < 2) return;

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
  components.forEach(async (component, index) => {
    const roomId = `room_${component.sort().join('_').substring(0, 50)}`;
    
    // Fetch last 20 messages for this room
    let history = [];
    try {
      history = await Message.find({ roomId }).sort({ timestamp: -1 }).limit(20);
      history = history.reverse(); // Standard chronological order
    } catch (err) {
      console.error('Error fetching history:', err);
    }

    component.forEach(id => {
      const socket = io.sockets.sockets.get(id);
      if (socket) {
        socket.join(roomId);
        socket.emit('proximity-update', { 
          inRoom: true, 
          roomId, 
          members: component.map(cid => users.get(cid).username),
          history
        });
      }
    });
  });

  // Notify users NOT in a room
  socketIds.forEach(id => {
    if (!visited.has(id) || adj.get(id).length === 0) {
      const socket = io.sockets.sockets.get(id);
      if (socket) {
        socket.emit('proximity-update', { inRoom: false });
      }
    }
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
