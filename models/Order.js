const mongoose = require("mongoose");

// 📦 Esquema de la orden
const orderSchema = new mongoose.Schema({
  paypalOrderId: { type: String, required: true }, // ID que devuelve PayPal
  status: { type: String, required: true },        // COMPLETED, PENDING, etc.
  productos: [
    {
      productoId: { type: mongoose.Schema.Types.ObjectId, ref: "Producto" }, // referencia
      nombre: String,   // snapshot
      precio: Number,   // snapshot
      imagen: String,   // snapshot
      cantidad: Number
    }
  ],
  total: Number,
  fecha: {
    type: Date,
    default: Date.now
  },
  estado: {
    type: String,
    enum: ["pendiente", "enviado", "entregado"],
    default: "pendiente"
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  datosCliente: {
    nombre: {
      type: String,
      required: false,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      trim: true,
    },
    direccion: {
      type: String,
      required: true,
      trim: true,
    },
    ciudad: {
      type: String,
      required: true,
      trim: true,
    },
    codigoPostal: {
      type: String,
      required: true,
      trim: true,
    },
    monto: { type: Number, required: true },  // Total en USD
    moneda: { type: String, default: "USD" },
    fecha: { type: Date, default: Date.now },
  },
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;


  
  

  

