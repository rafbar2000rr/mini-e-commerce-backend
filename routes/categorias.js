const express = require("express");
const router = express.Router();
const Categoria = require("../models/Categoria");

// 📜 Obtener todas las categorías
router.get("/categorias", async (req, res) => {
  try {
    const categorias = await Categoria.find().sort({ nombre: 1 });
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener categorías" });
  }
});

// 📌 Crear una nueva categoría
router.post("/categorias", async (req, res) => {
  try {
    const nuevaCategoria = new Categoria({ nombre: req.body.nombre });
    await nuevaCategoria.save();
    res.json(nuevaCategoria);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al crear categoría" });
  }
});

// DELETE /categorias/:id
router.delete("/categorias/:id", async (req, res) => {
  try {
    const categoria = await Categoria.findByIdAndDelete(req.params.id);
    if (!categoria) return res.status(404).json({ msg: "Categoría no encontrada" });
    res.json({ msg: "Categoría eliminada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al eliminar categoría" });
  }
});

module.exports = router;
