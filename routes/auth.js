// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/verifyToken');

//---------------------------------------------------------------------------
router.post('/register', async (req, res) => {
  
    const { nombre, email, password } = req.body;

    // Validación simple
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    // Validar longitud de la contraseña
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
    try {
    // Verificar si el correo ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }
    
    // Guardar usuario
    const newUser = new User({ nombre, email, password});
    await newUser.save();
    // Crear token
    const token = jwt.sign(
  { id: newUser._id, email: newUser.email }, // ✅ usa la variable correcta
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
    res.status(201).json({
      message: 'Usuario registrado correctamente',
      token,
      user: {
        id: newUser._id,
        nombre: newUser.nombre,
        email: newUser.email,
      },
    });
  } catch (error) {
  console.error('❌ Error real en /register:', error);
  res.status(500).json({ error: 'Error al registrar el usuario', details: error.message });
  }
});

//--------------------------------------------------------------------------------------
// Ruta para login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Validación básica
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }
    // Buscar usuario por email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Correo no registrado' });
    }
    // Comparar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Contraseña incorrecta' });
    }
    // ✅ Crear token JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '2h' } // el token expira en 2 horas
    );
    // Autenticación exitosa
    // ✅ Enviar token junto con info básica
    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
      },
      carrito: user.carrito || [] 
    });
  } catch (error) {
    console.error('Error en /login:', error);
    res.status(500).json({ error: 'Error en el inicio de sesión' });
  }
});

//------------------------------------------------------------------------------
router.get('/perfil', verifyToken, async (req, res) => {
  try {
    // req.user contiene el id y el email del token
    res.status(200).json({
      message: 'Acceso autorizado al perfil',
      user: req.userId
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al acceder al perfil' });
  }
});

//-------------------------------------------------------------------------------
// 📌 Obtener datos del usuario logueado
router.get("/me", verifyToken, async (req, res) => {
  try {
    // Traer solo nombre y email
    const user = await User.findById(req.userId).select("nombre email");
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(user);
  } catch (error) {
    console.error("❌ Error en /me:", error);
    res.status(500).json({ error: "Error al obtener datos del usuario" });
  }
});

module.exports = router;






