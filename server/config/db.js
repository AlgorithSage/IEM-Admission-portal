const mongoose = require('mongoose');

const { MONGO_URI } = require('./secrets');

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = MONGO_URI();

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
    console.error(`[MongoDB] Connection error: ${String(error.message).replace(/(\w+:\/\/[^:/\s]+:)[^\s]+@/g, '$1****@')}`);
    throw error;
  }
};

module.exports = connectDB;
