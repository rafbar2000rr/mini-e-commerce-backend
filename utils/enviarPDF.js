const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

//-------------------------------------------------------------------------------
// ✅ Tu función para generar y enviar el PDF
async function generarPDF(orden) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      let buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // 🌸 Encabezado
      doc.fillColor("#D63384").fontSize(22).text("Mini E-commerce", {
        align: "center",
      });
      doc.moveDown(0.5);
      doc.fillColor("black").fontSize(12).text("Detalle de la Orden", {
        align: "center",
      });
      doc.moveDown(1);

      // 🧾 Información de la orden
      doc.fontSize(12).fillColor("black");
      doc.text(`ID de la Orden: ${orden._id}`);
      doc.text(`Fecha: ${new Date(orden.fecha).toLocaleString()}`);
      doc.font("Helvetica-Bold").text(`Total: $${orden.total.toFixed(2)}`);
      doc.moveDown(1);

      // 👤 Datos del cliente
      doc.font("Helvetica-Bold").fillColor("#333").fontSize(14).text("Datos del Cliente:", { underline: true });
      doc.moveDown(0.5);
      doc.font("Helvetica").fillColor("black").fontSize(12);
      doc.text(`Nombre: ${orden.datosCliente?.nombre || "No disponible"}`);
      doc.text(`Email: ${orden.datosCliente?.email || "No disponible"}`);
      doc.text(`Dirección: ${orden.datosCliente?.direccion}`);
      doc.text(`Ciudad: ${orden.datosCliente?.ciudad}`);
      doc.text(`Código Postal: ${orden.datosCliente?.codigoPostal}`);
      doc.moveDown(1);

      // 🛍️ Productos
      doc.font("Helvetica-Bold").fillColor("#333").fontSize(14).text("Productos:", { underline: true });
      doc.moveDown(0.5);

      orden.productos.forEach((p) => {
        const y = doc.y;

        // 📸 Miniatura del producto
        if (p.imagen) {
          try {
            const imagePath = path.join(__dirname, "..", "uploads", path.basename(p.imagen));
            if (fs.existsSync(imagePath)) {
              doc.image(imagePath, 50, y, { width: 50, height: 50 });
            }
          } catch (err) {
            console.error("❌ Error cargando imagen del producto:", err.message);
          }
        }

        // 📦 Datos del producto
        doc.font("Helvetica").fillColor("black").fontSize(12).text(
          `${p.nombre} - $${p.precio.toFixed(2)} x ${p.cantidad}`,
          120,
          y + 15
        );

        doc.moveDown(2);
        // Línea separadora
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#ddd").stroke();
        doc.moveDown(0.5);
      });

      // 💖 Mensaje final
      doc.moveDown(2);
      doc.fontSize(10).fillColor("#555").text("Gracias por tu compra 💕", { align: "center" });

      doc.end();
    } catch (err) {
      console.error("❌ Error al generar PDF:", err);
      reject(err);
    }
  });
}


//-------------------------------------------------------------------------------
// 📌 Enviar PDF por correo
async function enviarPDFporCorreo(orden) {
  try {
    const pdfBuffer = await generarPDF(orden);

    // Configurar transporter de Gmail
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
