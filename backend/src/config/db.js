import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  const ping = await mongoose.connection.db.admin().ping();
  if (ping.ok !== 1) throw new Error('MongoDB ping did not return a successful response');
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}
