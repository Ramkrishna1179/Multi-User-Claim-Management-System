import mongoose from 'mongoose';
import { dbLogger } from './logger';

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI ||'mongodb+srv://Ramyadav:rEIZfa2sAUGOj6xU@cluster0.kvmhjwn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    
    dbLogger.info('Connecting to MongoDB', { uri: mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') });
    
    const conn = await mongoose.connect(mongoURI);
    
    dbLogger.info('MongoDB connected successfully', {
      host: conn.connection.host,
      port: conn.connection.port,
      name: conn.connection.name
    });

    // Log database events
    mongoose.connection.on('error', (error) => {
      dbLogger.error('MongoDB connection error:', { error: error.message });
    });

    mongoose.connection.on('disconnected', () => {
      dbLogger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      dbLogger.info('MongoDB reconnected');
    });

  } catch (error: any) {
    dbLogger.error('Database connection failed:', { 
      error: error.message, 
      stack: error.stack 
    });
    process.exit(1);
  }
};

export default connectDB; 