const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const axios = require("axios");

const API_URL = process.env.VITE_API_URL || "http://localhost:5000";

//-------------------------------------------------------------------------------
// 📌 Genera un PDF tipo catálogo profesional
//-------------------------------------------------------------------------------


async function generarPDF(orden) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // ------------------------------------------
      // 💖 ENCABEZADO
      // ------------------------------------------
      doc.fillColor("#D63384")
        .fontSize(22)
        .text("Detalle de la Orden", { align: "center", underline: true });
      doc.moveDown(1);

      // ------------------------------------------
      // 📄 INFORMACIÓN GENERAL
      // ------------------------------------------
      doc.fillColor("black").fontSize(12);
      doc.text(`ID de la Orden: ${orden._id}`);
      doc.text(`Fecha: ${new Date(orden.fecha).toLocaleString()}`);
      doc.font("Helvetica-Bold").text(`Total: $${orden.total.toFixed(2)}`);
      doc.moveDown(1);

      // ------------------------------------------
      // 👤 DATOS DEL CLIENTE
      // ------------------------------------------
      doc.font("Helvetica-Bold").fillColor("#333").fontSize(14).text("Datos del Cliente:", { underline: true });
      doc.moveDown(0.5);
      doc.font("Helvetica").fillColor("black");
      doc.text(`Nombre: ${orden.datosCliente?.nombre || "No disponible"}`);
      doc.text(`Email: ${orden.datosCliente?.email || "No disponible"}`);
      doc.text(`Dirección: ${orden.datosCliente?.direccion || "No disponible"}`);
      doc.text(`Ciudad: ${orden.datosCliente?.ciudad || "No disponible"}`);
      doc.text(`Código Postal: ${orden.datosCliente?.codigoPostal || "No disponible"}`);
      doc.moveDown(1.2);

      // ------------------------------------------
      // 🛍️ LISTA DE PRODUCTOS
      // ------------------------------------------
      doc.font("Helvetica-Bold").fillColor("#333").fontSize(14).text("Productos:", { underline: true });
      doc.moveDown(0.8);

      for (const p of orden.productos) {
        const nombre = p.productoId?.nombre ?? p.nombre ?? "Producto sin nombre";
        const precio = p.productoId?.precio ?? p.precio ?? 0;
        const cantidad = p.cantidad ?? 1;
        const imgUrl = p.productoId?.imagen || p.imagen;

        const boxHeight = 95; // altura total de la caja de producto

        // 💡 Si no hay espacio suficiente, nueva página
        if (doc.y + boxHeight > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
        }

        // 🔲 Caja de fondo
        const boxY = doc.y;
        doc.save();
        doc.rect(45, boxY - 5, 510, boxHeight).fillOpacity(0.05).fill("#000").restore();

        // 📄 Nombre y precio
        doc.font("Helvetica-Bold").fillColor("#111").fontSize(12)
          .text(nombre, 60, boxY + 5, { width: 340 });
        doc.font("Helvetica").fillColor("#555").fontSize(11)
          .text(`$${precio} x ${cantidad}`, 60, boxY + 25, { width: 340 });

        // 🖼️ Imagen (si existe)
        if (imgUrl) {
          try {
            const response = await axios.get(imgUrl, { responseType: "arraybuffer" });
            const buffer = Buffer.from(response.data, "binary");

            // Ajuste automático sin cortar imagen
            doc.image(buffer, 420, boxY, { width: 80, height: 80, fit: [80, 80] });
          } catch (err) {
            console.error("❌ Error al cargar imagen:", err.message);
          }
        }

        // ✨ Separador visual
        doc.moveDown(6);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#ccc").lineWidth(0.5).stroke();
        doc.moveDown(0.5);
      }

      // ------------------------------------------
      // 🌸 PIE DE PÁGINA
      // ------------------------------------------
      if (doc.y + 60 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
      doc.moveDown(2);
      doc.fontSize(10)
        .fillColor("#555")
        .text("Gracias por tu compra. 💕 ¡Esperamos verte pronto!", { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
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
