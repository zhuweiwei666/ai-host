const mongoose = require('mongoose');

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    console.log('✅ MongoDB already connected.');
    return;
  }

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai-host';
  
  if (!process.env.MONGO_URI) {
    console.warn(`[DB] WARNING: MONGO_URI not set, using default: mongodb://127.0.0.1:27017/ai-host`);
  }
  
  console.log(`[DB] Attempting to connect to MongoDB...`);
  console.log(`[DB] URI: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in logs

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // Increased timeout
      socketTimeoutMS: 45000,
      autoIndex: true, // Build indexes
      maxPoolSize: 10, // Maintain up to 10 socket connections
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`[DB] Database: ${conn.connection.name}`);
    console.log(`[DB] Connection state: ${mongoose.connection.readyState} (1=connected)`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error(`[DB] Error name: ${error.name}`);
    if (error.name === 'MongoServerSelectionError') {
      console.error(`[DB] This usually means:`);
      console.error(`   - MongoDB service is not running`);
      console.error(`   - Network cannot reach MongoDB server`);
      console.error(`   - MONGO_URI is incorrect`);
    }
    console.error(`[DB] Full error:`, error);
    console.error(`[DB] Please check:`);
    console.error(`  1. MONGO_URI environment variable is set correctly`);
    console.error(`  2. MongoDB service is running (sudo systemctl status mongod)`);
    console.error(`  3. Network connectivity to MongoDB server`);
    console.error(`[DB] Server will continue to start, but database operations will fail until connection is established.`);
    
    // Set up retry mechanism (only retry once to avoid spam)
    if (!mongoose.connection.readyState) {
      console.log('[DB] Will retry connection in 5 seconds...');
      setTimeout(() => {
        if (mongoose.connection.readyState !== 1) {
          console.log('[DB] Retrying MongoDB connection...');
          connectDB();
        }
      }, 5000);
    }
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected! Attempting to reconnect...');
  // Mongoose auto-reconnects usually, but we can force a check
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected!');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

module.exports = connectDB;
