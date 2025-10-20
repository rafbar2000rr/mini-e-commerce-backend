const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ✅ Verifica token y agrega usuario a req.user
const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No autorizado" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "Usuario no encontrado" });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token inválido" });
  }
};

// ✅ Solo admin puede acceder
const adminMiddleware = (req, res, next) => {
  if (req.user.rol !== "admin") {
    return res.status(403).json({ error: "No tienes permisos de administrador" });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };
