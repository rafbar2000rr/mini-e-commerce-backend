const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Importar rutas
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const carritoRoutes = require("./routes/carrito");
const categoriaRoutes = require("./routes/categorias");
const paypalRoutes = require("./routes/paypal");


app.use('/api', authRoutes);
//app.use("/api/me", authRoutes);
app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api', carritoRoutes);
app.use('api/carrito', carritoRoutes);
app.use('/api', categoriaRoutes);
app.use('/api/paypal', paypalRoutes);

// Servir carpeta uploads como pública
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get('/', (req, res) => {
  res.send('API funcionando correctamente');
});
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => console.error('❌ Error al conectar a MongoDB', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));







