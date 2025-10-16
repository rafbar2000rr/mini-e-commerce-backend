const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    precio: { type: Number, required: true },
    descripcion: { type: String },
    imagen: { type: String },
    stock: { 
      type: Number, 
      required: true, 
      min: 0,              // 👈 evita que haya valores negativos
      default: 0 
    },
    categoria: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Categoria"     // 🔹 relación con la colección "categorias"
    },
  },
  { timestamps: true }
);

// 👇 Esto le dice a Mongoose que la colección se llame exactamente "productos"
module.exports = mongoose.model("Producto", productoSchema, "productos");
