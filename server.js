const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🔹 Rutas
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const carritoRoutes = require('./routes/carrito');
const categoriaRoutes = require('./routes/categorias');
const paypalRoutes = require('./routes/paypal');

app.use('/api', authRoutes);
app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api/carrito', carritoRoutes);
app.use('/api', categoriaRoutes);
app.use('/api/paypal', paypalRoutes);

// 🔹 Ruta base
app.get('/', (req, res) => res.send('✅ API funcionando correctamente'));

// 🔹 Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error al conectar a MongoDB', err));

// 🔹 Servidor HTTP + Socket.io
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
});

// 🔹 Eventos Socket.io
io.on('connection', (socket) => {
  console.log('🟢 Usuario conectado:', socket.id);

  // 🔹 Unirse a su room
  socket.on('join', (usuarioId) => {
    socket.join(usuarioId);
    console.log(`👤 Usuario ${usuarioId} se unió a su room`);
  });

  // 🔹 Emitir solo al usuario correspondiente
  socket.on('carrito:update', (usuarioId) => {
    io.to(usuarioId).emit(`carrito:${usuarioId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Usuario desconectado:', socket.id);
  });
});

// 🔹 Guardar io en app para usarlo en rutas
app.set("io", io);

// 🔹 Iniciar servidor
server.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));

module.exports = { app, server, io };
