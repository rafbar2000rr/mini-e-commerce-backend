const express = require("express");
const router = express.Router();   // ✅ Aquí defines router
const Order = require("../models/Order");
const User = require("../models/User"); // ✅ Modelo de usuario
const verifyToken = require("../middleware/verifyToken");
const { generarPDF, enviarPDFporCorreo } = require("../utils/enviarPDF");
const Producto = require("../models/Producto");
const mongoose = require("mongoose");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

//---------------------------------------------------------------------------------------------
// 📦 Crear orden y enviar correo
// Este endpoint recibe productos + datos de cliente, valida todo, reconstruye la lista de productos
// directamente desde la base de datos (para que nadie altere precios), calcula el total, guarda la orden,
// vacía el carrito, y envía la orden al correo.
router.post("/orders", verifyToken, async (req, res) => {
  try {
    const { productos, datosCliente } = req.body;
    const userId = req.userId;

    // 🔹 Validar productos
    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ error: "No se enviaron productos válidos" });
    }

    // 🔹 Validar datos del cliente
    if (
      !datosCliente ||
      !datosCliente.direccion ||
      !datosCliente.ciudad ||
      !datosCliente.codigoPostal
    ) {
      return res.status(400).json({ error: "Faltan datos del cliente" });
    }

    // 🔎 Reconstruir lista de productos desde la BD para evitar manipulación de precios
    const productosProcesados = await Promise.all(
      productos.map(async (p) => {
        if (!mongoose.Types.ObjectId.isValid(p.productoId)) {
          throw new Error(`ID de producto inválido: ${p.productoId}`);
        }

        const prodDB = await Producto.findById(p.productoId);
        if (!prodDB) throw new Error(`Producto no encontrado: ${p.productoId}`);

        const cantidad = Number(p.cantidad) > 0 ? Number(p.cantidad) : 1;

        // ✅ Verificar stock disponible
        if (prodDB.stock < cantidad) {
          throw new Error(
            `No hay suficiente stock de ${prodDB.nombre}. Disponible: ${prodDB.stock}`
          );
        }

        // ✅ Descontar stock
        prodDB.stock -= cantidad;
        await prodDB.save();

        return {
          productoId: prodDB._id,
          nombre: prodDB.nombre,
          precio: prodDB.precio,
          imagen: prodDB.imagen || null,
          cantidad,
        };
      })
    );

    // ✅ Calcular total usando precios desde la BD
    const totalCalculado = productosProcesados.reduce(
      (acc, p) => acc + p.precio * p.cantidad,
      0
    );

    // ✅ Agregar monto y moneda al objeto datosCliente
    datosCliente.monto = totalCalculado;
    datosCliente.moneda = "USD";

    // ✅ Guardar la orden en MongoDB
    const nuevaOrden = new Order({
      productos: productosProcesados,
      total: totalCalculado,
      usuario: userId,
      datosCliente,
    });

    await nuevaOrden.save();

    // ✅ Vaciar carrito del usuario dentro del modelo User
    await User.findByIdAndUpdate(userId, { carrito: [] });

    // ✅ Recuperar la orden completa
    const ordenCompleta = await Order.findById(nuevaOrden._id).populate("usuario");

    // ✅ Intentar enviar correo con la orden en PDF
    try {
      await enviarPDFporCorreo(ordenCompleta);
    } catch (errorCorreo) {
      console.error("⚠️ Fallo al enviar correo:", errorCorreo.message);
    }

    // 🔹 Responder al cliente
    res.status(201).json({
      message: `✅ Hola ${datosCliente.nombre}, tu orden se ha creado con éxito! Total: $${totalCalculado.toFixed(2)}`,
      orden: ordenCompleta,
    });

  } catch (error) {
    console.error("❌ Error en /orders:", error.message);
    res.status(500).json({
      error: "Error al procesar la orden",
      detalle: error.message,
    });
  }
});


//----------------------------------------------------------------------------------------------
// ✅ Obtener detalle de una orden por ID (solo si pertenece al usuario). Este endpoint sirve para que un usuario autenticado pueda consultar una orden específica que le pertenece, validando que el ID sea correcto, asegurando que no acceda a órdenes de otros y devolviendo los datos limpios sin el __v.
router.get("/orders/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const orderId = req.params.id;

    // ✅ Validar ID
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: "ID de orden inválido" });
    }

    // ✅ Buscar la orden del usuario y poblar productos usando "productoId"
    const orden = await Order.findOne({ _id: orderId, usuario: userId })
      .select("-__v")
      .populate("productos.productoId", "nombre imagen precio");

    if (!orden) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    res.json(orden);
  } catch (error) {
    console.error("❌ Error al obtener detalle de la orden:", error.message);
    res.status(500).json({ error: "Error al obtener detalle de la orden" });
  }
});

//----------------------------------------------------------------------------------------------
// ✅ Descargar orden en PDF. Este endpoint permite que un usuario autenticado descargue un PDF con el detalle de una orden que le pertenece. No guarda el archivo en el servidor, sino que lo genera en memoria y lo envía como descarga directa al navegador.
// Descargar orden en PDF
router.get("/orders/:id/pdf", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: "ID de orden inválido" });
    }

    const orden = await Order.findOne({ _id: orderId, usuario: userId })
      .select("-__v")
      .populate("usuario")
      .populate("productos.productoId", "nombre imagen precio"); // ✅ corregido

    if (!orden) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const pdfBuffer = await generarPDF(orden);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=orden_${orden._id}.pdf`,
    });
    res.send(pdfBuffer);

  } catch (error) {
    console.error("❌ Error al generar PDF:", error.message);
    res.status(500).json({ error: "Error al generar el PDF" });
  }
});

//--------------------------------------------------------------------------------------------------------------------
// ✅ Obtener todas las órdenes del usuario autenticado
// Este endpoint sirve para que un usuario logueado vea todo su historial de compras, con:
// Sus productos populados (detalles completos, no solo IDs).
// Ordenados desde el más reciente al más antiguo.
router.get("/my-orders", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    console.log("👤 Buscando órdenes para usuario:", userId);

    // 🔹 Traemos las órdenes y populamos los productos
    const ordenes = await Order.find({ usuario: userId }) // Busca todas las órdenes en la colección Order que pertenezcan al usuario actual
      .select("paypalOrderId status productos total estado datosCliente fecha") // solo campos necesarios
      .populate("productos.productoId", "nombre precio imagen") // 👈 aquí se cargan los datos esenciales del producto
      .sort({ fecha: -1 }); // Ordena las órdenes desde la más reciente a la más antigua

    console.log("📦 Órdenes enviadas al cliente:", ordenes.length);

    // 🔹 Responder al cliente
    res.json(ordenes);
  } catch (error) {
    console.error("❌ Error al obtener órdenes del usuario:", error.message);
    res.status(500).json({ error: "Error al obtener tus órdenes" });
  }
});
//-------------------------------------------------------------------
// ✅ Obtener todas las órdenes de todos los usuarios (para admin)
router.get("/orders", async (req, res) => {
  try {
    const ordenes = await Order.find()
      .populate("usuario", "nombre email") // 👈 Trae nombre y email del usuario
      .populate("productos.productoId")    // 👈 Trae detalles del producto
      .sort({ fecha: -1 });                // Ordena de más reciente a más antigua

    res.json(ordenes);
  } catch (error) {
    console.error("❌ Error al obtener todas las órdenes:", error.message);
    res.status(500).json({ error: "Error al obtener todas las órdenes" });
  }
});

//-----------------------------------------------------------------------
// ✅ Actualizar estado de una orden (pendiente → enviado → entregado)


router.patch(
  "/orders/:id", verifyToken,
       // 🔹 Verifica que el usuario esté logueado
       // 🔹 Verifica que sea admin
  async (req, res) => {
    try {
      const { estado } = req.body;

      // Validar que manden el estado
      if (!estado) {
        return res.status(400).json({ error: "El campo 'estado' es obligatorio" });
      }

      // Buscar y actualizar
      const ordenActualizada = await Order.findByIdAndUpdate(
        req.params.id,
        { estado },
        { new: true } // devuelve la orden actualizada
      );

      if (!ordenActualizada) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }

      // ✅ Devolvemos la orden actualizada
      res.json(ordenActualizada);

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error actualizando la orden" });
    }
  }
);




module.exports = router;
