const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const axios = require("axios");

const API_URL = process.env.VITE_API_URL || "http://localhost:5000";

//-------------------------------------------------------------------------------
// 📌 Genera un PDF tipo catálogo profesional
//-------------------------------------------------------------------------------



import { Buffer } from "buffer";
import { Image, Paragraph, Table, TableStyle, Spacer } from "reportlab.platypus";
import { colors } from "reportlab.lib";

export async function generarPDF(orden) {
  const { usuario, productos, total } = orden;

  // 🧠 Función auxiliar para cargar imágenes de forma segura
  async function obtenerImagenSegura(url) {
    try {
      const response = await axios.get(url, { responseType: "arraybuffer" });
      const imgBuffer = Buffer.from(response.data);
      return new Image(imgBuffer, { width: 80, height: 80 });
    } catch (error) {
      console.warn("⚠️ No se pudo cargar la imagen:", url);
      return null;
    }
  }

  const elementos = [];

  // 🧾 Encabezado
  elementos.push(new Paragraph(`<b>Order ID:</b> ${orden._id}`));
  elementos.push(new Paragraph(`<b>Customer:</b> ${usuario.nombre}`));
  elementos.push(new Paragraph(`<b>Email:</b> ${usuario.email}`));
  elementos.push(new Spacer(1, 12));

  // 🛍️ Título
  elementos.push(new Paragraph("<b>Purchased Products:</b>"));
  elementos.push(new Spacer(1, 12));

  // 🧱 Tabla de productos
  const tablaData = [["Image", "Product", "Price", "Quantity", "Subtotal"]];

  for (const item of productos) {
    const producto = item.productoId;
    const subtotal = producto.precio * item.cantidad;

    // Cargar imagen de forma segura
    const img = await obtenerImagenSegura(producto.imagen);

    tablaData.push([
      img ? img : "Image not available",
      producto.nombre,
      `$${producto.precio.toFixed(2)}`,
      item.cantidad.toString(),
      `$${subtotal.toFixed(2)}`
    ]);
  }

  const tabla = new Table(tablaData, { repeatRows: 1 });
  tabla.setStyle(
    new TableStyle({
      alignment: "CENTER",
      grid: { color: colors.black, width: 0.5 },
      background: { start: [0, 0], end: [-1, 0], color: colors.lightgrey },
      padding: 6,
    })
  );

  elementos.push(tabla);
  elementos.push(new Spacer(1, 20));

  // 💰 Total
  elementos.push(new Paragraph(`<b>Total:</b> $${total.toFixed(2)}`));

  return elementos;
}




//-------------------------------------------------------------------------------
// 📌 Enviar PDF por correo
//-------------------------------------------------------------------------------
async function enviarPDFporCorreo(orden) {
  try {
    const pdfBuffer = await generarPDF(orden);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: '"Mini E-commerce" <rafbar2000rr@gmail.com>',
      to: orden.usuario?.email || "no-reply@example.com",
      subject: "Confirmación de tu orden",
      text: "Gracias por tu compra. Adjuntamos el detalle de tu orden en PDF.",
      attachments: [
        {
          filename: `orden_${orden._id}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("📩 Correo enviado con PDF a", orden.usuario?.email);
  } catch (err) {
    console.error("❌ Error enviando correo:", err.message);
    throw err;
  }
}

module.exports = { generarPDF, enviarPDFporCorreo };
