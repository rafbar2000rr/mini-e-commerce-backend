const express = require("express"); 
const router = express.Router();  // ✅ Define el router
const User = require("../models/User");
const jwt = require("jsonwebtoken");

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

module.exports = router;  // ✅ Exporta el router
