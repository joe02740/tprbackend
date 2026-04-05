const { MongoClient } = require('mongodb');

let db = null;
let client = null;

const connectToDatabase = async () => {
  if (db) {
    return db;
  }

  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('🔌 Connecting to MongoDB...');

    client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    });

    await client.connect();

    // Test the connection
    await client.db('admin').command({ ping: 1 });

    db = client.db(process.env.MONGODB_DATABASE || 'thinkpack_solo');

    console.log('✅ MongoDB connected successfully');

    // Create indexes for better performance
    await createIndexes();

    return db;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
};

const createIndexes = async () => {
  try {
    // Conversations collection indexes
    await db.collection('conversations').createIndex({ userId: 1, updatedAt: -1 });
    await db.collection('conversations').createIndex({ 'metadata.characterName': 1 });
    await db.collection('conversations').createIndex({ createdAt: -1 });

    // Documents collection indexes
    await db.collection('documents').createIndex({ userId: 1, dateAdded: -1 });
    await db.collection('documents').createIndex({ fileType: 1 });
    await db.collection('documents').createIndex({ title: 'text' });

    // Users collection indexes
    await db.collection('users').createIndex({ deviceId: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { sparse: true });

    console.log('📊 Database indexes created');
  } catch (error) {
    console.error('⚠️ Error creating indexes:', error);
    // Don't throw here - indexes are optional for basic functionality
  }
};

const getDatabase = () => {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase first.');
  }
  return db;
};

const closeConnection = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('🔌 MongoDB connection closed');
  }
};

// Health check function
const healthCheck = async () => {
  try {
    if (!db) {
      throw new Error('Database not connected');
    }

    await db.admin().command({ ping: 1 });
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  connectToDatabase,
  getDatabase,
  closeConnection,
  healthCheck,
};