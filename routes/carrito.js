


//-------------------------------------------------------------
// 🔹 Inyectar Socket.io en req.app.get("io")
//-------------------------------------------------------------
// En tu server principal (ej: server.js):
// const io = new Server(server);
// app.set("io", io);

// backend/routes/carrito.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const User = require("../models/User");
const Producto = require("../models/Producto");
const mongoose = require("mongoose");

// -------------------------------------------------------------
// 💠 Obtener carrito del usuario
// -------------------------------------------------------------
router.get("/", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const carritoMapeado = [];

    for (const item of user.carrito) {
      if (!mongoose.Types.ObjectId.isValid(item.productoId)) continue;

      const producto = await Producto.findById(item.productoId);
      if (!producto) continue;

      carritoMapeado.push({
        productoId: {
          _id: producto._id,
          nombre: producto.nombre,
          precio: producto.precio,
          descripcion: producto.descripcion,
          imagen: producto.imagen,
        },
        cantidad: item.cantidad,
      });
    }

    res.json(carritoMapeado);
  } catch (err) {
    console.error("❌ Error al obtener carrito:", err);
    res.status(500).json({ error: "Error al obtener carrito" });
  }
});

// -------------------------------------------------------------
// 💠 Agregar producto al carrito
// -------------------------------------------------------------
router.post("/", verifyToken, async (req, res) => {
  try {
    const { productoId, cantidad } = req.body;
    if (!productoId) return res.status(400).json({ error: "Falta productoId" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const existente = user.carrito.find(
      (p) => p.productoId.toString() === productoId.toString()
    );

    if (existente) {
      existente.cantidad += cantidad || 1;
    } else {
      user.carrito.push({ productoId, cantidad: cantidad || 1 });
    }

    await user.save();

    // 🔔 Emitir solo al room del usuario
    const io = req.app.get("io");
    io.to(req.userId).emit(`carrito:${req.userId}`);

    const actualizado = await User.findById(req.userId);
    res.json(actualizado.carrito);
  } catch (err) {
    console.error("❌ Error al agregar producto:", err);
    res.status(500).json({ error: "Error al agregar producto" });
  }
});

// -------------------------------------------------------------
// 💠 Actualizar cantidad de un producto
// -------------------------------------------------------------
router.put("/:productoId", verifyToken, async (req, res) => {
  try {
    const { cantidad } = req.body;
    const { productoId } = req.params;
    if (cantidad == null) return res.status(400).json({ error: "Falta cantidad" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const producto = user.carrito.find((p) => p.productoId.toString() === productoId);
    if (!producto) return res.status(404).json({ error: "Producto no encontrado en carrito" });

    if (cantidad < 1) {
      user.carrito = user.carrito.filter((p) => p.productoId.toString() !== productoId);
    } else {
      producto.cantidad = cantidad;
    }

    await user.save();

    const io = req.app.get("io");
    io.to(req.userId).emit(`carrito:${req.userId}`);

    res.json(user.carrito);
  } catch (err) {
    console.error("❌ Error al actualizar cantidad:", err);
    res.status(500).json({ error: "Error al actualizar cantidad" });
  }
});

// -------------------------------------------------------------
// 💠 Eliminar un producto del carrito
// -------------------------------------------------------------
router.delete("/:productoId", verifyToken, async (req, res) => {
  try {
    const { productoId } = req.params;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    user.carrito = user.carrito.filter((p) => p.productoId.toString() !== productoId);
    await user.save();

    const io = req.app.get("io");
    io.to(req.userId).emit(`carrito:${req.userId}`);

    res.json(user.carrito);
  } catch (err) {
    console.error("❌ Error al eliminar producto:", err);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

// -------------------------------------------------------------
// 💠 Vaciar todo el carrito
// -------------------------------------------------------------
router.delete("/", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    user.carrito = [];
    await user.save();

    const io = req.app.get("io");
    io.to(req.userId).emit(`carrito:${req.userId}`);

    res.json([]);
  } catch (err) {
    console.error("❌ Error al vaciar carrito:", err);
    res.status(500).json({ error: "Error al vaciar carrito" });
  }
});

module.exports = router;







// const express = require("express");
// const router = express.Router();
// const verifyToken = require("../middleware/verifyToken");
// const User = require("../models/User");

// //---------------------------------------------------------------------
// router.get("/", verifyToken, async (req, res) => {
//   try {
//     // Buscar el usuario autenticado usando el id que viene en el token
//     const user = await User.findById(req.userId).populate("carrito.productoId");
//     if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

//     // ✅ Devolver carrito en formato esperado por el frontend
//     res.json({ productos: user.carrito });
//   } catch (err) {
//     console.error("❌ Error al obtener carrito:", err.message);
//     res.status(500).json({ error: "Error al obtener carrito" });
//   }
// });


// //---------------------------------------------------------------------------------
// // 🔹 Agregar producto al carrito. Busca el usuario por su token.Verifica si el producto ya estaba en el carrito.
// //Si estaba → suma la cantidad.Si no estaba → lo agrega nuevo.Guarda los cambios.Devuelve el carrito con la info 
// // completa de los productos.
// router.post("/", verifyToken, async (req, res) => {
//   try {
//     const { productoId, cantidad } = req.body;
//     if (!productoId) return res.status(400).json({ error: "productoId no recibido" });

//     const user = await User.findById(req.userId);
//     if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

//     // Buscar si el producto ya existe en el carrito. user.carrito es un array de objetos con { productoId, cantidad }
//     const productoExistente = user.carrito.find(p => {
//       const id = p.productoId?._id?.toString() || p.productoId?.toString();//Puede pasar que productoId ya esté 
//       // populado (tenga un objeto con _id) o que solo sea un string con el ObjectId → por eso se usa
//       //  p.productoId?._id?.toString() || p.productoId?.toString()
//       return id === productoId.toString();//Comparo el id con el productoId recibido. Si lo encuentra → significa que 
//       // el producto ya estaba en el carrito. Al primer true, find detiene la búsqueda y devuelve ese elemento del array.
//     });

//     if (productoExistente) {
//       // Si ya existe, sumamos la cantidad
//       productoExistente.cantidad += cantidad || 1;
//     } else {
//       // Si no existe, lo agregamos como nuevo
//       user.carrito.push({ productoId, cantidad: cantidad || 1 });
//     }

//     await user.save();
//     // Devolver carrito actualizado con productos populados
//     const carritoActualizado = await User.findById(req.userId).populate("carrito.productoId");
//     res.json(carritoActualizado.carrito);
//   } catch (err) {
//     console.error("❌ Error al agregar producto:", err.message);
//     res.status(500).json({ error: "Error al agregar producto" });
//   }
// });

// //---------------------------------------------------------------------------
// // 🔹 Actualizar cantidad de un producto
// router.put("/:id", verifyToken, async (req, res) => {
//   try {
//     const { cantidad } = req.body;
//     if (cantidad == null) return res.status(400).json({ error: "cantidad no recibida" });

//     const user = await User.findById(req.userId);
//     if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

//     // Buscar el producto dentro del carrito del usuario
//     const producto = user.carrito.find(p => {
//       const id = p.productoId?._id?.toString() || p.productoId?.toString();
//       return id === req.params.id.toString();
//     });

//     if (!producto) return res.status(404).json({ error: "Producto no encontrado en carrito" });

//     if (cantidad < 1) {
//       // Si la cantidad es menor a 1, eliminar producto del carrito
//       user.carrito = user.carrito.filter(p => {
//         const id = p.productoId?._id?.toString() || p.productoId?.toString();
//         return id !== req.params.id.toString();
//       });
//     } else {
//       // Si no, solo actualizar cantidad
//       producto.cantidad = cantidad;
//     }

//     await user.save();
//     const carritoActualizado = await User.findById(req.userId).populate("carrito.productoId");
//     res.json(carritoActualizado.carrito);
//   } catch (err) {
//     console.error("❌ Error al actualizar cantidad:", err.message);
//     res.status(500).json({ error: "Error al actualizar cantidad" });
//   }
// });

// //--------------------------------------------------------------------------------
// // 🔹 Eliminar un producto del carrito
// router.delete("/:id", verifyToken, async (req, res) => {
//   try {
//     const user = await User.findById(req.userId);
//     if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

//     // Filtrar el carrito para eliminar el producto por su id
//     user.carrito = user.carrito.filter(p => {
//       const id = p.productoId?._id?.toString() || p.productoId?.toString();
//       return id !== req.params.id.toString();
//     });

//     await user.save();
//     const carritoActualizado = await User.findById(req.userId).populate("carrito.productoId");
//     res.json(carritoActualizado.carrito);
//   } catch (err) {
//     console.error("❌ Error al eliminar producto:", err.message);
//     res.status(500).json({ error: "Error al eliminar producto" });
//   }
// });

// //---------------------------------------------------------------------------------
// // 🔹 Vaciar carrito
// router.delete("/", verifyToken, async (req, res) => {
//   try {
//     const user = await User.findById(req.userId);
//     if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

//     // Vaciar el arreglo del carrito
//     user.carrito = [];
//     await user.save();
//     res.json([]);
//   } catch (err) {
//     console.error("❌ Error al vaciar carrito:", err.message);
//     res.status(500).json({ error: "Error al vaciar carrito" });
//   }
// });

// //--------------------------------------------------------------------------------
// // 🔹 Sincronizar carrito al iniciar sesión
// router.post("/sincronizar", verifyToken, async (req, res) => {
//   try {
//     const { carritoLocal } = req.body; // carrito que viene del frontend
//     const user = await User.findById(req.userId);
//     if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

//     // Crear un mapa para fusionar por productoId y sumar cantidades si ya existen
//     const mapa = new Map();

//     // Agregamos los productos del carrito del servidor
//     user.carrito.forEach(item => {
//       const id = item.productoId?._id?.toString() || item.productoId?.toString();
//       if (id) mapa.set(id, { productoId: id, cantidad: item.cantidad });
//     });

//     // Agregamos productos del carrito local
//     carritoLocal.forEach(item => {
//       const id =
//         item._id?.toString() ||
//         item.productoId?._id?.toString() ||
//         item.productoId?.toString();
//       if (!id) return;

//       if (mapa.has(id)) {
//         // sumar cantidades
//         mapa.get(id).cantidad += item.cantidad;
//       } else {
//         mapa.set(id, { productoId: id, cantidad: item.cantidad });
//       }
//     });

//     // Guardar carrito fusionado en el usuario
//     user.carrito = Array.from(mapa.values());
//     await user.save();

//     // Devolver carrito final populado
//     const carritoFinal = await User.findById(req.userId).populate("carrito.productoId");
//     res.json(carritoFinal.carrito);
//   } catch (err) {
//     console.error("❌ Error al sincronizar carrito:", err.message);
//     res.status(500).json({ error: "Error al sincronizar carrito" });
//   }
// });

// module.exports = router;
