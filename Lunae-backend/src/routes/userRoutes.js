import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/Users.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// POST /api/users/register - Registrar usuario
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validaciones básicas
    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: "Todos los campos son requeridos" 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: "La contraseña debe tener al menos 6 caracteres" 
      });
    }

    if (username.length < 3) {
      return res.status(400).json({ 
        message: "El username debe tener al menos 3 caracteres" 
      });
    }

    // Verificar si el email ya existe
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ 
        message: "El email ya está registrado" 
      });
    }

    // Verificar si el username ya existe
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ 
        message: "El username ya está en uso" 
      });
    }

    // Crear nuevo usuario
    const newUser = new User({
      username,
      email,
      password
    });

    await newUser.save();

    // Generar token JWT
    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET || 'tu_secreto_super_seguro',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: "Usuario registrado exitosamente",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({ 
      message: "Error interno del servidor" 
    });
  }
});

// POST /api/users/login - Iniciar sesión
router.post("/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    // Validaciones básicas
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ 
        message: "Username/Email y contraseña son requeridos" 
      });
    }

    // Buscar usuario por username o email
    const user = await User.findOne({
      $or: [
        { username: usernameOrEmail },
        { email: usernameOrEmail }
      ]
    });

    if (!user) {
      return res.status(401).json({ 
        message: "Credenciales inválidas" 
      });
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Credenciales inválidas" 
      });
    }

    // Generar token JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'tu_secreto_super_seguro',
      { expiresIn: '7d' }
    );

    res.json({
      message: "Inicio de sesión exitoso",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ 
      message: "Error interno del servidor" 
    });
  }
});

// GET /api/users/profile - Obtener perfil del usuario autenticado
router.get("/profile", auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error("Error obteniendo perfil:", error);
    res.status(500).json({ 
      message: "Error interno del servidor" 
    });
  }
});

// GET usuarios (solo para desarrollo)
router.get("/", auth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    res.status(500).json({ 
      message: "Error interno del servidor" 
    });
  }
});

export default router;
