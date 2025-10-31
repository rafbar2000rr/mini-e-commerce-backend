const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const axios = require("axios");
const API_URL = process.env.VITE_API_URL || "http://localhost:5000";
const { Buffer } = require("buffer");


//-------------------------------------------------------------------------------
// 📌 Genera un PDF tipo catálogo profesional
//-------------------------------------------------------------------------------

// 🧠 Función para generar el PDF de la orden

async function generarPDF(orden) {
  const { usuario, productos, total } = orden;

  const doc = new PDFDocument({ margin: 40 });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const pdfPromise = new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  //-----------------------------------------------------------
  // ✨ Encabezado
  //-----------------------------------------------------------
  doc.fontSize(22).fillColor("#D63384").text("Detalle de la Orden", { align: "center" });
  doc.moveDown();
  doc.fillColor("black").fontSize(12);
  doc.text(`ID de Orden: ${orden._id}`);
  doc.text(`Fecha: ${new Date(orden.fecha).toLocaleString()}`);
  doc.moveDown(0.5);
  doc.text(`Cliente: ${usuario?.nombre || "No disponible"}`);
  doc.text(`Email: ${usuario?.email || "No disponible"}`);
  doc.moveDown(1);

  //-----------------------------------------------------------
  // 🛍️ Lista de productos
  //-----------------------------------------------------------
  doc.fontSize(16).fillColor("#333").text("Productos Comprados", { underline: true });
  doc.moveDown(0.5);

  for (const item of productos) {
    const producto = item.productoId;
    const subtotal = (producto?.precio ?? 0) * (item.cantidad ?? 1);

    // 📦 Caja con borde suave
    const boxTop = doc.y;
    doc.roundedRect(40, boxTop, 520, 90, 8).fillOpacity(0.05).fill("#000000");
    doc.fillOpacity(1); // reset fill
    doc.strokeColor("#ccc").lineWidth(0.5).stroke();

    // 📸 Imagen del producto
    const imgX = 50;
    const imgY = boxTop + 10;
    try {
      if (producto?.imagen) {
        const response = await axios.get(producto.imagen, { responseType: "arraybuffer" });
        const imgBuffer = Buffer.from(response.data);
        doc.image(imgBuffer, imgX, imgY, { width: 70, height: 70, fit: [70, 70] });
      } else {
        doc.fontSize(10).fillColor("#888").text("[sin imagen]", imgX, imgY + 25);
      }
    } catch (err) {
      doc.fontSize(10).fillColor("#888").text("[imagen no disponible]", imgX, imgY + 25);
    }

    // 📝 Texto a la derecha
    const textX = 140;
    const textY = boxTop + 15;
    doc.font("Helvetica-Bold").fillColor("#111").fontSize(12)
      .text(producto?.nombre ?? "Producto sin nombre", textX, textY, { width: 350 });
    doc.font("Helvetica").fillColor("#444").fontSize(11)
      .text(`Precio: $${(producto?.precio ?? 0).toFixed(2)}`, textX, textY + 18)
      .text(`Cantidad: ${item.cantidad ?? 1}`, textX, textY + 33)
      .text(`Subtotal: $${subtotal.toFixed(2)}`, textX, textY + 48);

    // 🔹 Espacio entre productos
    doc.moveDown(7);

    // ⛔ Evitar que una caja quede cortada
    if (doc.y > 700) doc.addPage();
  }

  //-----------------------------------------------------------
  // 💰 Total final
  //-----------------------------------------------------------
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#000")
    .text(`Total: $${(total ?? 0).toFixed(2)}`, { align: "right" });

  //-----------------------------------------------------------
  // ❤️ Pie de página
  //-----------------------------------------------------------
  doc.moveDown(2);
  doc.fontSize(10).fillColor("#666")
    .text("Gracias por tu compra 💖 — Mini E-commerce", { align: "center" });

  doc.end();
  return pdfPromise;
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
