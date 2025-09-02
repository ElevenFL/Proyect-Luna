import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const dbUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/lunae';
    await mongoose.connect(dbUrl);
    console.log("✅ Conectado a MongoDB");
  } catch (err) {
    console.error("❌ Error conectando a la DB", err);
    process.exit(1);
  }
};
