const express = require("express"); 
const router = express.Router();  // ✅ Define el router
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const verifyToken = require("../middleware/verifyToken"); 

router.post("/register", async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "El correo ya está registrado" });
    }

    // ⚠️ El modelo ya encripta la contraseña automáticamente
    const newUser = new User({ nombre, email, password });
    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Usuario registrado correctamente",
      token,
      user: {
        id: newUser._id,
        nombre: newUser.nombre,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("❌ Error real en /register:", error);
    res
      .status(500)
      .json({ error: "Error al registrar el usuario", details: error.message });
  }
});



router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login exitoso",
      token,
      user: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("❌ Error en /login:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// GET /me -> devuelve datos del usuario logueado
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password"); // sin contraseña
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo usuario" });
  }
});

// PUT /perfil -> actualizar datos del usuario
router.put("/perfil", verifyToken, async (req, res) => {
  try {
    const { nombre, email, direccion, ciudad, codigoPostal } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { nombre, email, direccion, ciudad, codigoPostal },
      { new: true, runValidators: true }
    ).select("-password");

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar perfil" });
  }
});




module.exports = router;  // ✅ Exporta el router
