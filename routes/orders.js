const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const User = require("../models/User");
const Producto = require("../models/Producto");
const verifyToken = require("../middleware/verifyToken");
const isAdmin = require("../middleware/isAdmin");
const { generarPDF, enviarPDFporCorreo } = require("../utils/enviarPDF");
const mongoose = require("mongoose");
const axios = require("axios");


//----------------------------------------------------
// 🛍️ Crear orden con PayPal y precios congelados (versión segura)
//----------------------------------------------------
router.post("/orders", verifyToken, async (req, res) => {
  try {
    const { productos, datosCliente, paypalOrderId } = req.body;
    const userId = req.userId;

    if (!productos || productos.length === 0)
      return res.status(400).json({ error: "No hay productos en la orden" });

    if (!paypalOrderId)
      return res.status(400).json({ error: "Falta paypalOrderId" });

    // 🔹 Verificar pago en PayPal
    const auth = await axios({
      url: "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      method: "post",
      headers: { "Accept": "application/json", "Accept-Language": "en_US" },
      auth: { username: process.env.PAYPAL_CLIENT_ID, password: process.env.PAYPAL_SECRET },
      params: { grant_type: "client_credentials" },
    });
    const accessToken = auth.data.access_token;

    const { data: paypalData } = await axios.get(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${paypalOrderId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (paypalData.status !== "COMPLETED")
      return res.status(400).json({ error: "El pago de PayPal no ha sido completado" });

    // 🔹 Obtener productos de DB y calcular total
    let totalCalculado = 0;
    const productosDetallados = await Promise.all(
      productos.map(async (item) => {
        const producto = await Producto.findById(item.productoId);
        if (!producto) return null;

        const cantidad = item.cantidad || 1;
        const precioPagado = producto.precio; // <-- precio congelado garantizado
        totalCalculado += precioPagado * cantidad;

        return {
          productoId: producto._id,
          nombre: producto.nombre || "Producto sin nombre",
          precio: producto.precio || 0,
          precioPagado, // <-- aseguramos que siempre tenga valor
          imagen: producto.imagen || "/placeholder.png",
          cantidad,
        };
      })
    );

    const productosValidos = productosDetallados.filter(Boolean);
    if (productosValidos.length === 0)
      return res.status(400).json({ error: "Ningún producto válido en la orden" });

    // 🧾 Crear la orden
    const nuevaOrden = new Order({
      paypalOrderId,
      status: "COMPLETED",
      usuario: userId,
      productos: productosValidos,
      total: totalCalculado,
      datosCliente,
    });

    await nuevaOrden.save();

    // 🔹 Vaciar carrito
    await User.findByIdAndUpdate(userId, { carrito: [] });

    // 🔹 Enviar PDF por correo
    try {
      // 🚨 Aquí usamos el objeto recién guardado en DB para que llegue todo completo
      const ordenConDatos = await Order.findById(nuevaOrden._id).populate("productos.productoId");
      await enviarPDFporCorreo(ordenConDatos);
      console.log("📩 PDF enviado al correo del cliente");
    } catch (err) {
      console.error("❌ No se pudo enviar el PDF:", err.message);
    }

    res.status(201).json({
      mensaje: "Orden creada con precios congelados, carrito vaciado y PDF enviado",
      orden: nuevaOrden,
    });

  } catch (error) {
    console.error("❌ Error creando la orden:", error);
    res.status(500).json({ error: "Error al crear la orden" });
  }
});

//----------------------------------------------------
// ✅ Obtener detalle de orden por ID (usuario)
//----------------------------------------------------
router.get("/orders/:id", verifyToken, async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(orderId))
      return res.status(400).json({ error: "ID de orden inválido" });

    const orden = await Order.findOne({ _id: orderId, usuario: userId })
      .populate("productos.productoId", "nombre imagen precio")
      .select("-__v");

    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });

    const ordenFormateada = {
      ...orden.toObject(),
      productos: orden.productos.map((p) => ({
        nombre: p.nombre || p.productoId?.nombre || "Producto eliminado",
        precioPagado: p.precioPagado ?? p.precio ?? 0,
        precioActual: p.productoId?.precio ?? p.precio ?? 0,
        imagen: p.imagen || p.productoId?.imagen || "/placeholder.png",
        cantidad: p.cantidad,
      })),
    };

    res.json(ordenFormateada);

  } catch (error) {
    console.error("❌ Error al obtener detalle de la orden:", error.message);
    res.status(500).json({ error: "Error al obtener detalle de la orden" });
  }
});

//----------------------------------------------------
// ✅ Descargar PDF de orden
//----------------------------------------------------
router.get("/orders/:id/pdf", verifyToken, async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const userId = req.userId;

    const orden = await Order.findOne({ _id: orderId, usuario: userId })
      .populate("usuario")
      .populate("productos.productoId", "nombre imagen precio");

    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });

    const ordenParaPDF = {
      ...orden.toObject(),
      productos: orden.productos.map((p) => ({
        nombre: p.nombre || p.productoId?.nombre || "Producto eliminado",
        precioPagado: p.precioPagado ?? p.precio ?? 0,
        precioActual: p.productoId?.precio ?? p.precio ?? 0,
        imagen: p.imagen || p.productoId?.imagen || "/placeholder.png",
        cantidad: p.cantidad,
      })),
    };

    const pdfBuffer = await generarPDF(ordenParaPDF);

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

//----------------------------------------------------
// ✅ Listar órdenes del usuario
//----------------------------------------------------
router.get("/my-orders", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const ordenes = await Order.find({ usuario: userId })
      .select("productos total estado status datosCliente createdAt")
      .populate("productos.productoId", "nombre precio imagen")
      .sort({ createdAt: -1 });

    const ordenesFormateadas = ordenes.map((orden) => ({
      _id: orden._id,
      total: orden.total,
      estado: orden.estado,
      status: orden.status,
      fecha: orden.createdAt,
      datosCliente: orden.datosCliente,
      productos: orden.productos.map((p) => ({
        nombre: p.nombre || p.productoId?.nombre || "Producto eliminado",
        precioPagado: p.precioPagado ?? p.precio ?? 0,
        precioActual: p.productoId?.precio ?? p.precio ?? 0,
        imagen: p.imagen || p.productoId?.imagen || "/placeholder.png",
        cantidad: p.cantidad,
      })),
    }));

    res.json(ordenesFormateadas);

  } catch (error) {
    console.error("❌ Error al obtener órdenes del usuario:", error.message);
    res.status(500).json({ error: "Error al obtener tus órdenes" });
  }
});

//----------------------------------------------------
// ✅ Listar todas las órdenes (admin)
//----------------------------------------------------
router.get("/orders", verifyToken, isAdmin, async (req, res) => {
  try {
    const ordenes = await Order.find()
      .populate("usuario", "nombre email rol")
      .populate("productos.productoId", "nombre precio imagen")
      .sort({ createdAt: -1 });

    const ordenesFormateadas = ordenes.map((orden) => ({
      _id: orden._id,
      usuario: orden.usuario,
      total: orden.total,
      estado: orden.estado,
      fecha: orden.createdAt,
      productos: orden.productos.map((p) => ({
        nombre: p.productoId?.nombre || "Producto eliminado",
        precioPagado: p.precioPagado ?? p.precio ?? 0,
        precioActual: p.productoId?.precio ?? p.precio ?? 0,
        cantidad: p.cantidad,
      })),
    }));

    res.json(ordenesFormateadas);

  } catch (error) {
    console.error("❌ Error al obtener todas las órdenes:", error.message);
    res.status(500).json({ error: "Error al obtener todas las órdenes" });
  }
});

//----------------------------------------------------
// ✅ Actualizar estado de orden (solo admin)
//----------------------------------------------------
router.patch("/orders/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { estado } = req.body;
    if (!estado) return res.status(400).json({ error: "El campo 'estado' es obligatorio" });

    const ordenActualizada = await Order.findByIdAndUpdate(
      req.params.id,
      { estado },
      { new: true }
    );

    if (!ordenActualizada) return res.status(404).json({ error: "Orden no encontrada" });

    res.json(ordenActualizada);

  } catch (error) {
    console.error("❌ Error actualizando la orden:", error.message);
    res.status(500).json({ error: "Error actualizando la orden" });
  }
});

module.exports = router;
