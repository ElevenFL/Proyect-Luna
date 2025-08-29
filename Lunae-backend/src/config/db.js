import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("✅ Conectado a MongoDB");
  } catch (err) {
    console.error("❌ Error conectando a la DB", err);
    process.exit(1);
  }
};
