const mongoose = require("mongoose");

// 📦 Esquema de la orden
const orderSchema = new mongoose.Schema(
  {
    paypalOrderId: { type: String, required: true },
    status: { type: String, required: true },

    productos: [
      {
        productoId: { type: mongoose.Schema.Types.ObjectId, ref: "Producto" },
        nombre: { type: String, required: true },
        precio: { type: Number, required: true },       // precio actual
        precioPagado: { type: Number, required: true }, // precio congelado
        imagen: { type: String },
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
      required: false
    },

    datosCliente: {
      nombre: { type: String, trim: true },
      email: { type: String, trim: true },
      direccion: { type: String, required: true, trim: true },
      ciudad: { type: String, required: true, trim: true },
      codigoPostal: { type: String, required: true, trim: true },
      monto: { type: Number, required: true },
      moneda: { type: String, default: "USD" },
      fecha: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

// 🔹 Pre-save: recalcular total automáticamente
orderSchema.pre("save", function (next) {
  if (this.productos && this.productos.length > 0) {
    this.total = this.productos.reduce(
      (sum, p) => sum + (p.precioPagado ?? p.precio ?? 0) * (p.cantidad ?? 1),
      0
    );
  }
  next();
});

// 🔹 Pre-findOneAndUpdate: recalcular total si actualizan productos
orderSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.productos && update.productos.length > 0) {
    const totalCalculado = update.productos.reduce(
      (sum, p) => sum + (p.precioPagado ?? p.precio ?? 0) * (p.cantidad ?? 1),
      0
    );
    update.total = totalCalculado;
  }
  next();
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
