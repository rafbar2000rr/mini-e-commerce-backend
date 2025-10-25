const express = require('express');
const router = express.Router();
const Producto = require('../models/Producto');
const path = require('path');
const fs = require('fs');
const verifyToken = require('../middleware/verifyToken');
const cloudinary = require("../config/cloudinaryConfig");
const multer = require('multer');

//---------------------------------------------------------
// 📦 Configuración de Multer (usa memoria para subir a Cloudinary)
//---------------------------------------------------------
const storage = multer.memoryStorage();
const upload = multer({ storage });

//---------------------------------------------------------
// 🔹 Función para obtener productos (público o admin)
//---------------------------------------------------------
async function obtenerProductos(req, res, isAdmin = false) {
  try {
    let { page = 1, search = '', categoria = '' } = req.query;
    const limit = 8;

    page = Number(page);
    if (isNaN(page) || page < 1) page = 1;

    const query = {};
    if (search) query.nombre = { $regex: search, $options: 'i' };
    if (categoria) query.categoria = categoria;

    const total = await Producto.countDocuments(query);

    const productos = await Producto.find(query)
      .populate("categoria", "nombre")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      productos,
      total,
      page,
      pages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
      nextPage: page < Math.ceil(total / limit) ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      adminView: isAdmin,
    });
  } catch (error) {
    console.error('❌ Error al obtener productos:', error.message);
    res.status(500).json({ mensaje: 'Error al obtener productos', error: error.message });
  }
}

//---------------------------------------------------------
// 🆕 Crear producto (solo admin)
//---------------------------------------------------------
router.post("/productos", verifyToken, upload.single("imagen"), async (req, res) => {
  try {
    const { nombre, precio, descripcion, categoria, stock } = req.body;

    if (req.file) {
      // Subir imagen a Cloudinary
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "productos" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });

      const nuevoProducto = new Producto({
        nombre,
        precio: precio ? Number(precio) : 0,
        descripcion,
        categoria,
        stock: stock ? Number(stock) : 0,
        imagen: result.secure_url,
      });

      await nuevoProducto.save();
      return res.status(201).json({
        message: "Producto creado correctamente",
        producto: nuevoProducto,
      });
    }

    // Si no hay imagen
    const nuevoProducto = new Producto({
      nombre,
      precio: precio ? Number(precio) : 0,
      descripcion,
      categoria,
      stock: stock ? Number(stock) : 0,
      imagen: null,
    });

    await nuevoProducto.save();
    res.status(201).json({
      message: "Producto creado sin imagen",
      producto: nuevoProducto,
    });
  } catch (error) {
    console.error("❌ Error al crear producto:", error);
    res.status(500).json({ error: "Error al crear el producto" });
  }
});

//---------------------------------------------------------
// 📜 Listado de productos (solo admin)
//---------------------------------------------------------
router.get('/productos', verifyToken, (req, res) => {
  obtenerProductos(req, res, true);
});

//---------------------------------------------------------
// 🔹 Catálogo público
//---------------------------------------------------------
router.get('/catalogo', (req, res) => {
  obtenerProductos(req, res, false);
});

//---------------------------------------------------------
// ✏️ Actualizar producto (solo admin)
//---------------------------------------------------------
router.put("/productos/:id", verifyToken, upload.single("imagen"), async (req, res) => {
  try {
    const { nombre, precio, descripcion, categoria, stock, imagen: imagenURL } = req.body;
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ mensaje: "Producto no encontrado" });

    const updateData = {
      nombre,
      precio: precio ? Number(precio) : producto.precio,
      descripcion,
      categoria,
      stock: stock ? Number(stock) : producto.stock,
    };

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "productos" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      updateData.imagen = result.secure_url;
    } else if (imagenURL) {
      updateData.imagen = imagenURL;
    }

    const productoActualizado = await Producto.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    res.json({
      message: "Producto actualizado correctamente",
      producto: productoActualizado,
    });
  } catch (error) {
    console.error("❌ Error al actualizar producto:", error);
    res.status(500).json({ mensaje: "Error al actualizar producto" });
  }
});

//---------------------------------------------------------
// 🗑️ Eliminar producto (solo admin)
//---------------------------------------------------------
router.delete("/productos/:id", verifyToken, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

    if (producto.imagen && producto.imagen.startsWith("https://res.cloudinary.com/")) {
      const publicId = producto.imagen.split("/").slice(-1)[0].split(".")[0];
      await cloudinary.uploader.destroy(`productos/${publicId}`);
      console.log("🗑️ Imagen borrada de Cloudinary:", publicId);
    }

    await Producto.findByIdAndDelete(req.params.id);
    res.json({ message: "Producto eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar producto:", error);
    res.status(500).json({ error: "Error al eliminar el producto" });
  }
});

//---------------------------------------------------------
// 🔹 Obtener un producto por ID (público)
//---------------------------------------------------------
router.get("/productos/:id", async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ mensaje: "Producto no encontrado" });
    res.json(producto);
  } catch (error) {
    console.error('❌ Error al obtener producto por ID:', error.message);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

//---------------------------------------------------------
// 🔹 Actualizar solo stock (solo admin)
//---------------------------------------------------------
router.patch("/productos/:id/stock", verifyToken, async (req, res) => {
  try {
    const { cantidad } = req.body;
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

    producto.stock = Math.max(0, producto.stock + cantidad);
    await producto.save();

    res.json({ message: "Stock actualizado", producto });
  } catch (error) {
    console.error("❌ Error al actualizar stock:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;

//---------------------------------------------------------
// 📦 Configuración de Multer para subir imágenes
//---------------------------------------------------------
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, 'uploads/'),
//   filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
// });
// const upload = multer({ storage });

//---------------------------------------------------------
// 🔹 Función interna para obtener productos (admin o público)
//---------------------------------------------------------

// router.delete('/productos/:id', verifyToken, async (req, res) => {
//   try {
//     const producto = await Producto.findById(req.params.id);
//     if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

//     if (producto.imagen && !producto.imagen.startsWith('http')) {
//       const rutaImagen = path.join(__dirname, '..', 'uploads', producto.imagen);
//       fs.unlink(rutaImagen, err => {
//         if (err) console.error('⚠️ Error al borrar imagen:', err.message);
//         else console.log('🗑️ Imagen borrada:', producto.imagen);
//       });
//     }

//     await Producto.findByIdAndDelete(req.params.id);
//     res.json({ message: 'Producto eliminado correctamente' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Error al eliminar el producto' });
//   }
// });

// router.put('/productos/:id', verifyToken, upload.single('imagen'), async (req, res) => {
//   try {
//     const { nombre, precio, descripcion, categoria, stock, imagen: imagenURL } = req.body;

//     const updateData = {
//       nombre,
//       precio: precio ? Number(precio) : undefined,
//       descripcion,
//       categoria,
//       stock: stock ? Number(stock) : undefined,
//     };

//     if (req.file) updateData.imagen = req.file.filename;
//     else if (imagenURL) updateData.imagen = imagenURL;

//     Object.keys(updateData).forEach(
//       key => updateData[key] === undefined && delete updateData[key]
//     );

//     const productoActualizado = await Producto.findByIdAndUpdate(
//       req.params.id,
//       updateData,
//       { new: true }
//     );

//     if (!productoActualizado) return res.status(404).json({ mensaje: 'Producto no encontrado' });

//     res.json(productoActualizado);
//   } catch (error) {
//     console.error("❌ Error al actualizar producto:", error);
//     res.status(500).json({ mensaje: 'Error al actualizar producto' });
//   }
// });
// router.post('/productos', verifyToken, upload.single('imagen'), async (req, res) => {
//   try {
//     const { nombre, precio, descripcion, categoria, stock } = req.body;

//     const nuevoProducto = new Producto({
//       nombre,
//       precio: precio ? Number(precio) : 0,
//       descripcion,
//       categoria,
//       stock: stock ? Number(stock) : 0,
//       imagen: req.file ? req.file.filename : null,
//     });

//     await nuevoProducto.save();

//     res.status(201).json({
//       message: 'Producto creado correctamente',
//       producto: nuevoProducto,
//     });
//   } catch (error) {
//     console.error('❌ Error al crear el producto:', error);
//     res.status(500).json({ error: 'Error al crear el producto' });
//   }
// });
