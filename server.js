const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

//-------------------------------------------------------------
// 🔹 Crear app de Express
//-------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//-------------------------------------------------------------
// 🔹 Importar rutas
//-------------------------------------------------------------
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const carritoRoutes = require('./routes/carrito');
const categoriaRoutes = require('./routes/categorias');
const paypalRoutes = require('./routes/paypal');

//-------------------------------------------------------------
// 🔹 Usar rutas
//-------------------------------------------------------------
app.use('/api', authRoutes);
app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api/carrito', carritoRoutes);
app.use('/api', categoriaRoutes);
app.use('/api/paypal', paypalRoutes);

//-------------------------------------------------------------
// 🔹 Ruta base
//-------------------------------------------------------------
app.get('/', (req, res) => {
  res.send('API funcionando correctamente');
});

//-------------------------------------------------------------
// 🔹 Conectar a MongoDB
//-------------------------------------------------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error al conectar a MongoDB', err));

//-------------------------------------------------------------
// 🔹 Crear servidor HTTP y Socket.io
//-------------------------------------------------------------
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

//-------------------------------------------------------------
// 🔹 Conexión de clientes Socket.io
//-------------------------------------------------------------
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // Escuchar eventos de carrito
  socket.on('carrito:update', (usuarioId) => {
    // Emitir a todos los sockets excepto el que envió el evento
    socket.broadcast.emit(`carrito:${usuarioId}`);
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

//-------------------------------------------------------------
// 🔹 Escuchar el puerto
//-------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

//-------------------------------------------------------------
// 🔹 Exportar para pruebas o integración
//-------------------------------------------------------------
module.exports = { app, server, io };
