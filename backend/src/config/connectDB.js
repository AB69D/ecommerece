import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../lib/logger.js';

mongoose.set('strictQuery', true);

const connectDB = async () => {
    mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
    mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB error'));

    await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 20,
    });
};

export default connectDB;
