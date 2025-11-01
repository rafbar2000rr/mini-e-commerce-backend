const express = require("express");
const router = express.Router();   // ✅ Aquí defines router
const Order = require("../models/Order");
const User = require("../models/User"); // ✅ Modelo de usuario
const verifyToken = require("../middleware/verifyToken");
const { generarPDF, enviarPDFporCorreo } = require("../utils/enviarPDF");
const Producto = require("../models/Producto");
const mongoose = require("mongoose");
const isAdmin = require("../middleware/isAdmin");
const axios = require("axios");
const Carrito = require("../models/Carrito");
//---------------------------------------------------------------------------------------------
// 📦 Crear orden y enviar correo
// Este endpoint recibe productos + datos de cliente, valida todo, reconstruye la lista de productos
// directamente desde la base de datos (para que nadie altere precios), calcula el total, guarda la orden,
// vacía el carrito, y envía la orden al correo.
// routes/orders.js

//----------------------------------------------------
// 🛍️ Crear una nueva orden (con precios congelados)
//----------------------------------------------------

// 🛍️ Crear orden con integración PayPal, vaciar carrito y enviar PDF
router.post("/orders", verifyToken, async (req, res) => {
  try {
    const { productos, datosCliente, paypalOrderId } = req.body;
    const userId = req.userId;

    if (!productos || productos.length === 0) {
      return res.status(400).json({ error: "No hay productos en la orden" });
    }

    if (!paypalOrderId) {
      return res.status(400).json({ error: "Falta paypalOrderId" });
    }

    //----------------------------------------------------
    // 🔹 Verificar el pago en PayPal
    //----------------------------------------------------
    const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

    // Obtener token de acceso
    const auth = await axios({
      url: "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      method: "post",
      headers: {
        "Accept": "application/json",
        "Accept-Language": "en_US",
      },
      auth: { username: PAYPAL_CLIENT, password: PAYPAL_SECRET },
      params: { grant_type: "client_credentials" },
    });

    const accessToken = auth.data.access_token;

    // Consultar la orden
    const { data: paypalData } = await axios.get(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${paypalOrderId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (paypalData.status !== "COMPLETED") {
      return res.status(400).json({ error: "El pago de PayPal no ha sido completado" });
    }

    //----------------------------------------------------
    // 🔹 Obtener datos actuales de productos
    //----------------------------------------------------
    const productosDetallados = await Promise.all(
      productos.map(async (item) => {
        const producto = await Producto.findById(item.productoId);
        if (!producto) return null;

        return {
          productoId: producto._id,
          nombre: producto.nombre,
          precio: producto.precio,
          imagen: producto.imagen,
          cantidad: item.cantidad || 1,
        };
      })
    );

    const productosValidos = productosDetallados.filter(Boolean);
    if (productosValidos.length === 0)
      return res.status(400).json({ error: "Ningún producto válido en la orden" });

    const totalCalculado = productosValidos.reduce(
      (sum, p) => sum + p.precio * p.cantidad,
      0
    );

    //----------------------------------------------------
    // 🧾 Crear orden marcada como COMPLETED
    //----------------------------------------------------
    const nuevaOrden = new Order({
      paypalOrderId,
      status: "COMPLETED",
      usuario: userId,
      productos: productosValidos,
      total: totalCalculado,
      datosCliente,
      fecha: new Date(),
    });

    await nuevaOrden.save();

    //----------------------------------------------------
    // 🔹 Vaciar carrito
    //----------------------------------------------------
    await Carrito.findOneAndUpdate(
      { usuario: userId },
      { productos: [] }
    );

    //----------------------------------------------------
    // 🔹 Enviar PDF por correo
    //----------------------------------------------------
    try {
      await enviarPDFporCorreo(nuevaOrden);
      console.log("📩 PDF enviado al correo del cliente");
    } catch (err) {
      console.error("❌ No se pudo enviar el PDF:", err.message);
    }

    res.status(201).json({
      mensaje: "Orden creada y completada con éxito, carrito vaciado y PDF enviado",
      orden: nuevaOrden,
    });

  } catch (error) {
    console.error("❌ Error creando la orden:", error);
    res.status(500).json({ error: "Error al crear la orden" });
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

    const orden = await Order.findOne({ _id: orderId, usuario: userId })
      .populate("usuario")
      .populate("productos.productoId", "nombre imagen precio");

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

    const ordenes = await Order.find({ usuario: userId })
      .select("productos total estado status datosCliente fecha")
      .populate("productos.productoId", "nombre precio imagen")
      .sort({ fecha: -1 });

    const ordenesFormateadas = ordenes.map((orden) => ({
      _id: orden._id,
      total: orden.total,
      estado: orden.estado,
      status: orden.status,
      fecha: orden.fecha,
      datosCliente: orden.datosCliente,
      productos: orden.productos.map((p) => ({
        nombre: p.productoId?.nombre || p.nombre || "Producto eliminado",
        precio: p.productoId?.precio || p.precio || 0,
        imagen:
          p.productoId?.imagen || p.imagen || "/placeholder.png", // 👈 siempre devuelve algo
        cantidad: p.cantidad,
      })),
    }));

    console.log("📦 Órdenes enviadas al cliente:", ordenesFormateadas.length);
    res.json(ordenesFormateadas);
  } catch (error) {
    console.error("❌ Error al obtener órdenes del usuario:", error.message);
    res.status(500).json({ error: "Error al obtener tus órdenes" });
  }
});


//-------------------------------------------------------------------
// ✅ Obtener todas las órdenes de todos los usuarios (para admin)


// Solo admins pueden ver todas las órdenes
router.get("/orders", verifyToken, isAdmin, async (req, res) => {
  try {
    const ordenes = await Order.find()
      .populate("usuario", "nombre email rol")
      .populate("productos.productoId", "nombre precio imagen")
      .sort({ fecha: -1 });

    // 🧩 Aplanamos los productos para que incluyan directamente nombre, precio y cantidad
    const ordenesFormateadas = ordenes.map((orden) => ({
      _id: orden._id,
      usuario: orden.usuario,
      total: orden.total,
      estado: orden.estado,
      fecha: orden.fecha,
      productos: orden.productos.map((p) => ({
        nombre: p.productoId?.nombre || "Producto eliminado",
        precio: p.productoId?.precio || 0,
        cantidad: p.cantidad,
      })),
    }));

    res.json(ordenesFormateadas);
  } catch (error) {
    console.error("❌ Error al obtener todas las órdenes:", error.message);
    res.status(500).json({ error: "Error al obtener todas las órdenes" });
  }
});


//-----------------------------------------------------------------------
// ✅ Actualizar estado de una orden (pendiente → enviado → entregado)
router.patch(
  "/orders/:id", verifyToken, isAdmin,
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
