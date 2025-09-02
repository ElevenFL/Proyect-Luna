import express from "express";
import cors from "cors";

const app = express();
const PORT = 3001;

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Ruta de prueba simple
app.get("/", (req, res) => {
  res.json({ message: "Servidor de prueba funcionando" });
});

// Ruta de health check
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🧪 Servidor de prueba corriendo en http://localhost:${PORT}`);
});
