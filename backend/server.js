import { env } from './src/config/env.js'; // must stay first: loads .env
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import authRoutes from './src/routes/auth.js';
import memberRoutes from './src/routes/members.js';
import planRoutes from './src/routes/plans.js';
import paymentRoutes from './src/routes/payments.js';
import dashboardRoutes from './src/routes/dashboard.js';
import { errorHandler, notFound } from './src/middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientOrigins }));
app.use(express.json({ limit: '100kb' }));

// Public health check (no data exposed).
app.get('/api/health', async (req, res) => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    res.status(503).json({ status: 'database unavailable' });
    return;
  }

  try {
    const ping = await mongoose.connection.db.admin().ping();
    if (ping.ok !== 1) throw new Error('MongoDB ping did not return a successful response');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error(`MongoDB health check failed: ${err.message}`);
    res.status(503).json({ status: 'database unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/payments', paymentRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error(`Could not connect to MongoDB: ${err.message}`);
    console.error('Make sure MongoDB is running, or set MONGODB_URI to a MongoDB Atlas connection string.');
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`ForgeFit API running on http://localhost:${env.port}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${env.port} is already in use. Stop the other backend process or change PORT in .env.`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  const shutdown = () => server.close(() => mongoose.connection.close().then(() => process.exit(0)));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
