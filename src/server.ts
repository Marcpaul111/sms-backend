import 'dotenv/config';
import express from "express";
import type { Request, Response } from "express";

import cookieParser from "cookie-parser";
import { connectDB, disconnectDB } from "./config/db.ts";
import pool from "./config/db.ts";
import { verifyTokenMiddleware } from "./middleware/auth.ts";
import routes from "./routers/index.ts";
import { config } from 'dotenv';

config();
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const adminClients = new Set<Response>();
let notifClientReady = false;

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
    const c = await pool.connect();
    await c.query('LISTEN user_events');
    c.on('notification', (msg: any) => {
      const payload = (() => { try { return JSON.parse(msg.payload || '{}'); } catch { return {}; } })();
      if (payload?.type === 'user_signup' && payload?.role === 'teacher') {
        const data = JSON.stringify(payload);
        for (const client of adminClients) {
          client.write(`event: user_signup\ndata: ${data}\n\n`);
        }
      }
    });
    notifClientReady = true;
  } catch (e) {
    console.error('Realtime notifications setup failed', e);
  }
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled rejection error:", err);
  server.close(async () => {
    await disconnectDB();
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", async (err) => {
  console.error("❌ Uncaught exception error:", err);
  await disconnectDB();
  process.exit(1);
});

// Graceful shutdown on SIGTERM
process.on("SIGTERM", async () => {
  console.log("🔴 SIGTERM signal received. Shutting down server...");
  server.close(async () => {
    await disconnectDB();
    console.log("✓ Server closed gracefully.");
    process.exit(0);
  });
});

// Graceful shutdown on SIGINT (Ctrl+C)
process.on("SIGINT", async () => {
  console.log("\n🔴 SIGINT signal received. Shutting down server...");
  server.close(async () => {
    await disconnectDB();
    console.log("✓ Server closed gracefully.");
    process.exit(0);
  });
});

export default app;
