const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const axios = require("axios");
const API_URL = process.env.VITE_API_URL || "http://localhost:5000";
const { Buffer } = require("buffer");



//-------------------------------------------------------------------------------
// 📌 Genera un PDF tipo catálogo profesional
//-------------------------------------------------------------------------------

const PDFDocument = require("pdfkit");
const axios = require("axios");

// 🧠 Función para generar el PDF de la orden
async function generarPDF(orden) {
  const { usuario, productos, total } = orden;

  // 🪄 Creamos el PDF en memoria
  const doc = new PDFDocument({ margin: 40 });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const pdfPromise = new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // 🧾 Encabezado
  doc.fontSize(18).text("Order Summary", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Order ID: ${orden._id}`);
  doc.text(`Customer: ${usuario.nombre}`);
  doc.text(`Email: ${usuario.email}`);
  doc.moveDown();

  // 🛍️ Título productos
  doc.fontSize(14).text("Purchased Products:");
  doc.moveDown(0.5);

  // 📦 Lista de productos
  for (const item of productos) {
    const producto = item.productoId;
    const subtotal = producto.precio * item.cantidad;

    // 🔹 Cargar imagen si existe
    if (producto.imagen) {
      try {
        const response = await axios.get(producto.imagen, { responseType: "arraybuffer" });
        const imgBuffer = Buffer.from(response.data);
        doc.image(imgBuffer, { width: 60, height: 60, align: "left" });
      } catch (error) {
        doc.text("[Image not available]");
      }
    } else {
      doc.text("[No image]");
    }

    // 🔹 Texto al lado
    doc.fontSize(12).text(`Product: ${producto.nombre}`);
    doc.text(`Price: $${producto.precio.toFixed(2)}`);
    doc.text(`Quantity: ${item.cantidad}`);
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`);
    doc.moveDown(1);

    // 🔹 Evita que se corte al final de la página
    if (doc.y > 700) doc.addPage();
  }

  // 💰 Total
  doc.moveDown();
  doc.fontSize(14).text(`Total: $${total.toFixed(2)}`, { align: "right" });

  doc.end();
  return pdfPromise;
}

module.exports = generarPDF;


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
