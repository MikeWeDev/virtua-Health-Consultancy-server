const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const dbConnect = require('./lib/db');
const authRoutes = require('./routes/auth.routes');
const initChatSocket = require('./sockets/chatSocket');
const initVideoSocket = require('./sockets/videoSocket');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Connect Database
dbConnect();

// Middlewares
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health check endpoint for UptimeRobot / Cron-job.org keep-alive pings
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth & REST Routes
app.use('/api', authRoutes);

// Socket.io Instance 1: Chat Signaling (/api/socket)
const chatIo = new Server(server, {
  path: '/api/socket',
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
initChatSocket(chatIo);

// Socket.io Instance 2: Video WebRTC Signaling (/api/video/socket)
const videoIo = new Server(server, {
  path: '/api/video/socket',
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
initVideoSocket(videoIo);

server.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});