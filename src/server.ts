import 'dotenv/config';
import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from 'ws';
import type { PoolClient } from 'pg';
import multer from 'multer';

import cookieParser from "cookie-parser";
import pool, { connectDB, disconnectDB } from "./config/db.ts";
import { verifyTokenMiddleware } from "./middleware/auth.ts";
import { verifyAccessToken } from "./utils/useJwt";
import routes from "./routers/index.ts";
import { config } from 'dotenv';

config();
const app = express();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit for module uploads
  },
});

// Make upload middleware available to routes
app.use((req: Request, res: Response, next) => {
  (req as any).upload = upload;
  next();
});

// CORS configuration
const allowedOrigins = [
  "https://sms-asiapacific.online",
  "https://www.sms-asiapacific.online",
  "http://localhost:5173",
  "http://localhost:8080"
];

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // allow non-browser requests with no origin (Postman/CRON)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};


app.use(cors(corsOptions));

// Middleware
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));
app.use(cookieParser());

const adminClients = new Set<Response>();
let notifClientReady = false;
let notificationClient: PoolClient | null = null;

// WebSocket server for real-time notifications
const wss = new WebSocketServer({ noServer: true });

// Store connected clients by user ID
const wsClients = new Map<string, WebSocket>();

// Authenticate WebSocket connection
const authenticateWebSocket = (token: string) => {
  return verifyAccessToken(token);
};

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket, request) => {
  const url = new URL(request.url || '', 'http://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(1008, 'Authentication required');
    return;
  }

  let user;
  try {
    user = authenticateWebSocket(token);
  } catch (error) {
    ws.close(1008, 'Invalid token');
    return;
  }

  // Store client with user ID
  (ws as any).user = user;
  wsClients.set(user.id, ws);

  console.log(`🔗 WebSocket connected: ${user.email} (${user.role})`);

  ws.on('close', () => {
    wsClients.delete(user.id);
    console.log(`🔌 WebSocket disconnected: ${user.email}`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    wsClients.delete(user.id);
  });
});

// Broadcast to specific role
const broadcastToRole = (role: string, event: string, data: any) => {
  wsClients.forEach((client, userId) => {
    const user = (client as any).user;
    if (user?.role === role) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
      }
    }
  });
};

// Broadcast to specific user
const broadcastToUser = (userId: string, event: string, data: any) => {
  const client = wsClients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
  }
};

// Logging middleware (optional)
app.use((req: Request, res: Response, next) => {
  console.log(`📍 ${req.method} ${req.path}`);
  next();
});

// Routes
app.use(routes);

app.get('/api/notifications/stream', verifyTokenMiddleware, (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  adminClients.add(res);
  res.write(`event: ping\ndata: {}\n\n`);
  req.on('close', () => {
    adminClients.delete(res);
  });
});

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({ 
    success: true,
    message: "SMS API is running..." 
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`
  });
});

// Error handler
app.use((err: any, req: Request, res: Response) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const port = process.env.PORT || 3001;

const server = app.listen(port, async () => {
  console.log(`🚀 Server is running on port ${port}`);
  console.log(`📚 API Documentation:`);
  console.log(`   Health: GET http://localhost:${port}/health`);
  console.log(`   Register: POST http://localhost:${port}/api/auth/register`);
  console.log(`   Login: POST http://localhost:${port}/api/auth/login`);
  console.log(`   Me: GET http://localhost:${port}/api/auth/me`);
  await connectDB();
  try {
    notificationClient = await pool.connect();
    await notificationClient.query('LISTEN user_events');
    notificationClient.on('notification', (msg: any) => {
    notificationClient!.on('error', (err: any) => {
      console.error('LISTEN client error:', err);
    });
    notificationClient!.on('end', () => {
      console.log('LISTEN client connection ended');
      notificationClient = null;
    });
      const payload = (() => { try { return JSON.parse(msg.payload || '{}'); } catch { return {}; } })();
      if (payload?.type === 'user_signup' && payload?.role === 'teacher') {
        // Broadcast to WebSocket clients
        broadcastToRole('admin', 'user_signup', payload);
        // Legacy SSE support
        const data = JSON.stringify(payload);
        for (const client of adminClients) {
          client.write(`event: user_signup\ndata: ${data}\n\n`);
        }
      } else if (payload?.type === 'submission_created') {
        // Broadcast to teachers (we'd need to get assignment teacher, but for simplicity broadcast to all teachers)
        broadcastToRole('teacher', 'submission_received', payload);
      }
    });
    notifClientReady = true;
  } catch (e) {
    console.error('Realtime notifications setup failed', e);
  }
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled rejection error:", err);
  server.close(async () => {
    if (notificationClient) {
      notificationClient.release();
      notificationClient = null;
    }
    await disconnectDB();
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", async (err) => {
  console.error("❌ Uncaught exception error:", err);
  server.close(async () => {
    if (notificationClient) {
      notificationClient.release();
      notificationClient = null;
    }
    await disconnectDB();
    process.exit(1);
  });
});

// Graceful shutdown on SIGTERM
process.on("SIGTERM", async () => {
  console.log("🔴 SIGTERM signal received. Shutting down server...");
  server.close(async () => {
    if (notificationClient) {
      notificationClient.release();
      notificationClient = null;
    }
    await disconnectDB();
    console.log("✓ Server closed gracefully.");
    process.exit(0);
  });
});

// Graceful shutdown on SIGINT (Ctrl+C)
process.on("SIGINT", async () => {
  console.log("\n🔴 SIGINT signal received. Shutting down server...");
  server.close(async () => {
    if (notificationClient) {
      notificationClient.release();
      notificationClient = null;
    }
    await disconnectDB();
    console.log("✓ Server closed gracefully.");
    process.exit(0);
  });
});

export default app;
