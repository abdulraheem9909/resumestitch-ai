import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  console.log("uri",uri)
  if (!uri) {
    console.warn('MONGODB_URI not set — skipping database connection.');
    return;
  }
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
