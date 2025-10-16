const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  console.log("🧠 Headers:", req.headers.authorization);
  const authHeader = req.headers.authorization;
  

  if (!authHeader) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1]; // separa "Bearer" del token

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};

module.exports = verifyToken;

