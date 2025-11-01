const mongoose = require("mongoose");

// 📦 Esquema de la orden
const orderSchema = new mongoose.Schema(
  {
    paypalOrderId: { type: String, required: true }, // ID que devuelve PayPal
    status: { type: String, required: true },        // COMPLETED, PENDING, etc.

    productos: [
      {
        productoId: { type: mongoose.Schema.Types.ObjectId, ref: "Producto" }, // referencia
        nombre: { type: String, required: true },   // snapshot
        precio: { type: Number, required: true },   // snapshot
        imagen: { type: String },                   // snapshot
        cantidad: { type: Number, required: true, default: 1 }
      }
    ],

    total: { type: Number, required: true },

    estado: {
      type: String,
      enum: ["pendiente", "enviado", "entregado"],
      default: "pendiente"
    },

    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false // si permites compras como invitado
    },

    datosCliente: {
      nombre: { type: String, trim: true },
      email: { type: String, trim: true },
      direccion: { type: String, required: true, trim: true },
      ciudad: { type: String, required: true, trim: true },
      codigoPostal: { type: String, required: true, trim: true },
      monto: { type: Number, required: true },  // Total en USD
      moneda: { type: String, default: "USD" },
      fecha: { type: Date, default: Date.now },
    },
  },
  { timestamps: true } // crea createdAt y updatedAt automáticamente
);

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
