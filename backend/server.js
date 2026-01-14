// backend/server.js - COMPLETE WITH SOCKET.IO & KEEP-ALIVE
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// ✅ Socket.io Configuration with Keep-Alive
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8,
  allowEIO3: true,
  perMessageDeflate: false
});

// Make io accessible in routes/controllers
app.set('io', io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later."
  }
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    message: "Too many OTP requests. Please try again later."
  }
});

app.use(limiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Apply OTP rate limiting
app.use("/api/officers/request-otp", otpLimiter);

// Routes
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/officers", require("./routes/officerRoutes"));
app.use("/api/registration", require("./routes/registrationRoutes"));
app.use("/api/export", require("./routes/exportRoutes"));

// Health check endpoints
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "CPC Portal Backend API",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/health", (req, res) => {
  const adminRoom = io.sockets.adapter.rooms.get('admin-room');
  res.json({
    success: true,
    message: "Backend is healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    socketConnections: io.engine.clientsCount,
    adminsConnected: adminRoom ? adminRoom.size : 0
  });
});

// Database test endpoint
app.get("/api/db-test", async (req, res) => {
  try {
    const { poolPromise } = require("./config/db");
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT GETDATE() AS CurrentTime");
    
    res.json({
      success: true,
      message: "Database connected successfully",
      serverTime: result.recordset[0].CurrentTime,
    });
  } catch (err) {
    console.error("Database connection failed:", err);
    res.status(500).json({ 
      success: false,
      message: "Database connection failed", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal error'
    });
  }
});

// ✅ Socket.io Connection Handling with Keep-Alive
const adminSockets = new Map(); // Track admin sockets

io.on('connection', (socket) => {
  console.log(`\n✅ Socket connected: ${socket.id}`);
  console.log(`👥 Total connected clients: ${io.engine.clientsCount}`);
  console.log(`🚀 Transport: ${socket.conn.transport.name}`);

  // ✅ Admin joins admin room for notifications
  socket.on('admin:join', (adminData) => {
    socket.join('admin-room');
    adminSockets.set(socket.id, adminData);
    
    console.log(`✅ Admin ${adminData.username || 'Unknown'} (${socket.id}) joined admin-room`);
    
    const adminRoom = io.sockets.adapter.rooms.get('admin-room');
    console.log(`👥 Admins in room: ${adminRoom ? adminRoom.size : 0}`);
    console.log(`📋 Admin sockets tracked: ${adminSockets.size}`);
    
    // Confirm join to client
    socket.emit('admin:joined', { 
      success: true, 
      message: 'Successfully joined admin notifications',
      socketId: socket.id,
      adminsInRoom: adminRoom ? adminRoom.size : 0
    });
  });

  // ✅ Test notification event
  socket.on('test-notification', (data) => {
    console.log('🧪 Test notification received:', data);
    console.log('🧪 Sending test response to admin-room...');
    
    const adminRoom = io.sockets.adapter.rooms.get('admin-room');
    console.log(`👥 Admins in room: ${adminRoom ? adminRoom.size : 0}`);
    
    io.to('admin-room').emit('test-response', { 
      success: true, 
      message: 'Test notification working!',
      timestamp: new Date().toISOString(),
      adminsNotified: adminRoom ? adminRoom.size : 0
    });
    
    console.log('✅ Test response sent to admin-room');
  });

  // ✅ Keep-alive ping-pong
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // ✅ Handle client disconnect
  socket.on('disconnect', (reason) => {
    const adminData = adminSockets.get(socket.id);
    if (adminData) {
      console.log(`❌ Admin ${adminData.username || 'Unknown'} disconnected: ${socket.id}`);
      adminSockets.delete(socket.id);
    } else {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    }
    console.log(`   Reason: ${reason}`);
    console.log(`👥 Total connected clients: ${io.engine.clientsCount}`);
    console.log(`📋 Admin sockets tracked: ${adminSockets.size}`);
    
    const adminRoom = io.sockets.adapter.rooms.get('admin-room');
    console.log(`👥 Admins in room: ${adminRoom ? adminRoom.size : 0}\n`);
  });

  // ✅ Handle socket errors
  socket.on('error', (error) => {
    console.error(`❌ Socket error on ${socket.id}:`, error);
  });

  // ✅ Connection upgrade notification
  socket.conn.on('upgrade', (transport) => {
    console.log(`🔄 Transport upgraded to: ${transport.name} for socket ${socket.id}`);
  });
});

// ✅ Helper function to emit notifications to all admins
const emitToAdmins = (eventName, data) => {
  const adminRoom = io.sockets.adapter.rooms.get('admin-room');
  const adminCount = adminRoom ? adminRoom.size : 0;
  
  if (adminCount > 0) {
    io.to('admin-room').emit(eventName, data);
    console.log(`📡 Emitted '${eventName}' to ${adminCount} admin(s)`);
    return true;
  } else {
    console.log(`⚠️ No admins connected to receive '${eventName}'`);
    return false;
  }
};

// Make emitToAdmins globally available
global.emitToAdmins = emitToAdmins;

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 CPC Portal Backend Server Started`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🔌 Socket.io URL: http://localhost:${PORT}`);
  console.log(`💾 Database: ${process.env.DB_DATABASE || 'Not configured'}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`${'='.repeat(60)}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM received, closing server gracefully...');
  
  // Close all socket connections
  io.close(() => {
    console.log('✅ All socket connections closed');
  });
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, closing server gracefully...');
  
  io.close(() => {
    console.log('✅ All socket connections closed');
  });
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = { app, io, server };