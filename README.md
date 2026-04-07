# Cosmos Chat 🚀

A full-stack, real-time multiplayer proximity chat application. Explore a 2D cosmos, move around with your avatar, and automatically connect to others when you are within range.

## Features
- **Real-time Multiplayer**: See other players moving in the cosmos instantly.
- **Proximity-Based Chat**: Chat panel appears and connects you only when users are within 150px.
- **Dynamic Rooms**: Supports 1-1 and group chats automatically based on player clusters.
- **PixiJS Rendering**: Smooth 2D canvas rendering with a starfield background.
- **MongoDB Persistence**: Messages are saved and retrieved using MongoDB.
- **Aesthetic UI**: Modern glassmorphism design with Tailwind CSS.

## Tech Stack
- **Frontend**: React (Vite), PixiJS, Tailwind CSS, Socket.IO Client, Lucide React.
- **Backend**: Node.js, Express, Socket.IO, Mongoose.
- **Database**: MongoDB (Atlas).

## Setup Instructions

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 2. Environment Setup
Create a `.env` file in both `client` and `server` folders using the `.env.example` templates.

**Server (.env):**
```env
PORT=5000
MONGO_URI=your_mongodb_uri
CLIENT_URL=http://localhost:5173
```

**Client (.env):**
```env
VITE_API_URL=http://localhost:5000
```

### 3. Backend Setup
1. Navigate to the `server` folder: `cd server`
2. Install dependencies: `npm install`
3. Start the server: `npm start`

### 4. Frontend Setup
1. Navigate to the `client` folder: `cd client`
2. Install dependencies: `npm install`
3. Start development: `npm run dev`
4. Build for production: `npm run build`

### 5. Deployment Instructions (Render)

#### Backend (Web Service)
- **Root Directory**: `server`
- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- **Env Vars**: Add `MONGO_URI` and `CLIENT_URL` (frontend URL).

#### Frontend (Static Site)
- **Root Directory**: `client`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **Env Vars**: Add `VITE_API_URL` (backend URL).

### 4. Running the App
1. Open `http://localhost:5173` in your browser.
2. Open another tab or window to `http://localhost:5173` to test multiplayer.
3. Choose a username and color.
4. Move your circle using **WASD** or **Arrow Keys**.
5. Move close to another player to start chatting!

## Proximity Logic
The server calculates distances between all players on every move.
- **Radius**: 150px
- **Formula**: `sqrt((x1-x2)^2 + (y1-y2)^2)`
- **Dynamic Grouping**: Connected components of nearby players form a temporary chat room.
