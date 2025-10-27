// middleware/isAdmin.js
const User = require("../models/User");

const isAdmin = async (req, res, next) => {
  try {
    // req.userId viene del middleware verifyToken
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    if (user.rol !== "admin") {
      return res.status(403).json({ error: "No tienes permisos de administrador" });
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error verificando permisos" });
  }
};

module.exports = isAdmin;
