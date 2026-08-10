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

// Parse FRONTEND_URL or default to localhost, and add common local environments
const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((url) => url.trim().replace(/\/$/, ''))
  : [];

const allowedOrigins = Array.from(
  new Set([
    ...configuredOrigins,
    'https://virtualhealthconsultancy.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])
).filter(Boolean);

// Dynamic origin validation function for Express CORS
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy error: Origin ${origin} is not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Connect Database
dbConnect();

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Health check endpoint for UptimeRobot / Cron-job.org keep-alive pings
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth & REST Routes
app.use('/api', authRoutes);

// Shared Socket.io CORS Configuration
const socketCorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Socket CORS policy error: Origin ${origin} is not allowed`));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true,
};

// Socket.io Instance 1: Chat Signaling (/api/socket)
const chatIo = new Server(server, {
  path: '/api/socket',
  cors: socketCorsOptions,
});
initChatSocket(chatIo);

// Socket.io Instance 2: Video WebRTC Signaling (/api/video/socket)
const videoIo = new Server(server, {
  path: '/api/video/socket',
  cors: socketCorsOptions,
});
initVideoSocket(videoIo);

server.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});