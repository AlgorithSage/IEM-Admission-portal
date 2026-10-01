const mongoose = require('mongoose');

const DEFAULT_MONGO_URI = 'mongodb+srv://carchisman1_db_user:hUYQnRGUeXezcsoz@iem-admission-portal.tqnwjmg.mongodb.net/iem_admission_portal?retryWrites=true&w=majority&appName=IEM-ADMISSION-PORTAL';

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGO_URI || DEFAULT_MONGO_URI;

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });
    isConnected = true;
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    isConnected = false;
    console.error(`[MongoDB] Connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
