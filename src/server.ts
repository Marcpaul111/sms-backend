import 'dotenv/config';
import express from "express";
import type { Request, Response } from "express";

import cookieParser from "cookie-parser";
import { connectDB, disconnectDB } from "./config/db.ts";
import routes from "./routers/index.ts";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging middleware (optional)
app.use((req: Request, res: Response, next) => {
  console.log(`📍 ${req.method} ${req.path}`);
  next();
});

// Routes
app.use(routes);

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
