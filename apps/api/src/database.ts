import mongoose from 'mongoose';

export async function connectToDatabase(uri: string) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}
