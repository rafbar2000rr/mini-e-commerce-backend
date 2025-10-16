const express = require('express');
const router = express.Router();
const Producto = require('../models/Producto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

//---------------------------------------------------------
// 📦 Configuración de Multer para subir imágenes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Carpeta donde se guardan
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext); // Nombre único
  }
});
const upload = multer({ storage });

//---------------------------------------------------------------------
// 🆕 Crear producto (imagen opcional: archivo o URL)
router.post('/productos', upload.single('imagen'), async (req, res) => {
  try {
    const { nombre, precio, descripcion, categoria, stock } = req.body;

    // 🔹 Convertir los valores numéricos
    const nuevoProducto = new Producto({
      nombre,
      precio: precio ? Number(precio) : 0,
      descripcion,
      categoria,
      stock: stock ? Number(stock) : 0,
      imagen: req.file ? req.file.filename : null,
    });

    await nuevoProducto.save();

    res.status(201).json({
      message: 'Producto creado correctamente',
      producto: nuevoProducto,
    });
  } catch (error) {
    console.error('❌ Error al crear el producto:', error);
    res.status(500).json({ error: 'Error al crear el producto' });
  }
});

//----------------------------------------------------------------------------
// 📜 Obtener productos con paginación, búsqueda y filtro por categoría
// GET /productos con paginación, búsqueda, ordenamiento y categoría
router.get('/productos', async (req, res) => {
  try {
    let { page = 1, search = '', categoria = '' } = req.query;
    const limit = 8;

    // 🔹 Convertir a número y validar
    page = Number(page);
    if (isNaN(page) || page < 1) page = 1;
    
    // 🔹 Filtro de búsqueda y categoría
    const query = {};

    // ✅ Si mandan "search" → busca por nombre con regex (insensible a mayúsculas)
    if (search) {
      query.nombre = { $regex: search, $options: 'i' };
    }
  
    // ✅ Si mandan "categoria" → filtrar por categoría exacta
    if (categoria) {
      query.categoria = categoria;
    }

    // 🔹 Total de productos encontrados según query
    const total = await Producto.countDocuments(query);//Cuenta el número de productos según el query (nombre + categoría).

    // 🔹 Paginación: busca productos en MongoDB según query, página y límite
    const productos = await Producto.find(query)//Busca productos filtrados por nombre y/o categoría.
      .populate("categoria", "nombre")  // 👈 trae solo el campo nombre
      .skip((page - 1) * limit)//Salta (omite) los productos de las páginas anteriores.
      .limit(limit)//Devuelve solo "limit" productos por página.
      .sort({ createdAt: -1 });//Ordena del más nuevo al más antiguo.

    // 🔹 Respuesta con productos + info de paginación
    res.json({
      productos,//Lista de productos de la página actual según filtros aplicados.
      total,//Total de productos encontrados con el filtro.
      page,//Número de página actual.
      pages: Math.ceil(total / limit),//Total de páginas (redondeado hacia arriba).
      hasNextPage: page < Math.ceil(total / limit),//¿Hay más páginas adelante?
      hasPrevPage: page > 1,//¿Hay páginas anteriores?
      nextPage: page < Math.ceil(total / limit) ? page + 1 : null,//Número de la siguiente página o null.
      prevPage: page > 1 ? page - 1 : null,//Número de la página anterior o null.
    });

  } catch (error) {
    console.error('❌ Error en GET /productos:', error.message);
    res.status(500).json({
      mensaje: 'Error al obtener productos',
      error: error.message
    });
  }
});


//---------------------------------------------------------------------------------------
// ✏ Actualizar producto
//Este endpoint permite actualizar un producto de dos formas:Si subes una nueva
//  foto → la guarda en tu servidor y actualiza el campo imagen con el nombre 
// del archivo.Si mandas una URL en vez de archivo → actualiza el campo imagen 
// con esa URL.Si no mandas nada de imagen → mantiene la imagen que ya tenía el producto.
//Multer → guarda el archivo en uploads/ automáticamente. El código → guarda en MongoDB 
// solo la referencia (ejemplo: "imagen": "1734567890123.png").
router.put('/productos/:id', upload.single('imagen'), async (req, res) => {
  try {
    const { nombre, precio, descripcion, categoria, stock, imagen: imagenURL } = req.body;
    //imagenURL sirve si el usuario manda un link de imagen externa en lugar de subir un archivo.
    // 🔹 Se crea un objeto con los campos que sí o sí se van a actualizar (aunque no venga imagen).
    const updateData = {
      nombre,
      precio: precio ? Number(precio) : undefined,
      descripcion,
      categoria,
      stock: stock ? Number(stock) : undefined,
    };
    
    if (req.file) {
      updateData.imagen = req.file.filename;//Si el usuario subió una imagen (req.file), se guarda el nombre del archivo en el campo imágen.
    } else if (imagenURL) {//Si no hay archivo pero sí una URL (imagenURL), entonces se guarda esa URL en el campo imagen.Si no envió nada, la imagen del producto no se toca.
      updateData.imagen = imagenURL;
    }
    // 🔹 Eliminar claves undefined para no sobreescribir nada accidentalmente
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );
    // 🔹 Actualizar producto
    const productoActualizado = await Producto.findByIdAndUpdate(//Busca en MongoDB el producto por ID (req.params.id).
      req.params.id,
      updateData,//Lo actualiza con updateData.
      { new: true }//hace que devuelva el producto ya actualizado (si no, devolvería el anterior).
      );
    if (!productoActualizado) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    res.json(productoActualizado);
  } catch (error) {
    console.error("❌ Error al actualizar producto:", error);
    res.status(500).json({ mensaje: 'Error al actualizar producto' });
  }
});

//---------------------------------------------------------------------------------
// 🗑 Eliminar producto
router.delete('/productos/:id', async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);//Busca el producto en la base de datos usando el id que llega en la URL (/productos/:id).
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    if (producto.imagen && !producto.imagen.startsWith('http')) {//se asegura de que sea una imagen guardada en tu servidor (no de internet).
      const rutaImagen = path.join(__dirname, '..', 'uploads', producto.imagen);//crea la ruta absoluta del archivo dentro de la carpeta uploads.
      fs.unlink(rutaImagen, err => {//elimina el archivo del disco.
        if (err) {
          console.error('⚠️ Error al borrar imagen:', err.message);
        } else {
          console.log('🗑️ Imagen borrada:', producto.imagen);
        }
      });
    }

    await Producto.findByIdAndDelete(req.params.id);//elimina el registro del producto de MongoDB.
    res.json({ message: 'Producto eliminado correctamente' });//Si todo sale bien, aparece  ese mensaje.
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

//----------------------------------------------------------------------------
router.get("/productos/:id", async (req, res) => {
  const producto = await Producto.findById(req.params.id);
  res.json(producto);
});

//----------------------------------------------------------------------------
// 🔹 Ruta para actualizar solo el stock de un producto
router.patch("/productos/:id/stock", async (req, res) => {
  try {
    const { cantidad } = req.body; // cantidad puede ser positiva o negativa
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

    // Evita que el stock sea negativo
    producto.stock = Math.max(0, producto.stock + cantidad);
    await producto.save();

    res.json({ message: "Stock actualizado", producto });
  } catch (error) {
    console.error("Error al actualizar stock:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;









