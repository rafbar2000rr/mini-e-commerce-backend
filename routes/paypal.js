const express = require("express");
const paypal = require("@paypal/checkout-server-sdk");
const Order = require("../models/Order");
const Producto = require("../models/Producto");
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

// 🔹 Configuración de PayPal Sandbox
const environment = new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_CLIENT_SECRET
);
const client = new paypal.core.PayPalHttpClient(environment);

// ✅ Crear orden de PayPal
router.post("/api/create-order", async (req, res) => {
  const { total } = req.body;

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: total.toFixed(2),
        },
      },
    ],
  });

  try {
    const order = await client.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error("❌ Error creando orden PayPal:", err);
    res.status(500).json({ error: "Error creando orden PayPal" });
  }
});

// ✅ Capturar pago, guardar orden y actualizar stock + vaciar carrito
router.post("/api/capture-order/:orderID", verifyToken, async (req, res) => {
  try {
    const { orderID } = req.params;

    // 🔹 Capturar el pago desde PayPal
    const auth = Buffer.from(
      process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET
    ).toString("base64");

    const captureRes = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    const captureData = await captureRes.json();

    if (captureData.status !== "COMPLETED") {
      return res.status(400).json({ error: "El pago no se completó correctamente" });
    }

    // 🔹 Extraer datos de la captura
    const capture = captureData.purchase_units[0].payments.captures[0];
    const amount = parseFloat(capture.amount.value);
    const currency = capture.amount.currency_code;

    // 🔹 Crear nueva orden asociada al usuario autenticado
    const nuevaOrden = new Order({
      usuario: req.userId,
      paypalOrderId: orderID,
      status: captureData.status,
      productos: req.body.productos,
      datosCliente: {
        ...req.body.datosCliente,
        direccion: req.body.datosCliente?.direccion || "Sin dirección",
        ciudad: req.body.datosCliente?.ciudad || "Sin ciudad",
        codigoPostal: req.body.datosCliente?.codigoPostal || "00000",
        monto: amount,
        moneda: currency,
      },
      total: amount,
    });

    await nuevaOrden.save();

    // 🩷 Vaciar carrito del usuario
    if (req.userId) {
      await User.findByIdAndUpdate(req.userId, { carrito: [] });
      console.log(`🧹 Carrito vaciado para usuario con ID: ${req.userId}`);
    }

    // 🔹 Actualizar stock
    for (const item of req.body.productos) {
      const producto = await Producto.findById(item.productoId || item._id);
      if (!producto) continue;

      if (producto.stock >= item.cantidad) {
        producto.stock -= item.cantidad;
        await producto.save();
      } else {
        console.warn(`⚠️ Stock insuficiente para ${producto.nombre}`);
      }
    }

    res.json({
      msg: "✅ Orden guardada correctamente, stock actualizado y carrito vaciado",
      orden: nuevaOrden,
    });
  } catch (err) {
    console.error("❌ Error capturando orden:", err);
    res.status(500).json({
      error: "Error al capturar orden",
      detalle: err.message,
    });
  }
});

module.exports = router;
