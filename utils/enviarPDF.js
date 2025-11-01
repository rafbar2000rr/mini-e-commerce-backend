const PDFDocument = require("pdfkit");
const fs = require("fs");
const nodemailer = require("nodemailer");

// 🔹 Generar PDF en memoria
async function generarPDF(orden) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // Título
      doc.fontSize(20).text("Orden de Compra", { align: "center" });
      doc.moveDown();

      // Datos del cliente
      const { datosCliente } = orden;
      doc.fontSize(12).text(`Nombre: ${datosCliente.nombre}`);
      doc.text(`Email: ${datosCliente.email}`);
      doc.text(`Dirección: ${datosCliente.direccion}, ${datosCliente.ciudad}, ${datosCliente.codigoPostal}`);
      doc.text(`Fecha: ${new Date(datosCliente.fecha).toLocaleString()}`);
      doc.moveDown();

      // Tabla de productos
      const tableTop = doc.y;
      const itemX = 50;
      const quantityX = 250;
      const priceX = 300;
      const currentPriceX = 370;
      const subtotalX = 440;

      // Encabezados
      doc.font("Helvetica-Bold");
      doc.text("Producto", itemX, tableTop);
      doc.text("Cant.", quantityX, tableTop);
      doc.text("Precio Pagado", priceX, tableTop);
      doc.text("Precio Actual", currentPriceX, tableTop);
      doc.text("Subtotal", subtotalX, tableTop);
      doc.moveDown();

      // Contenido
      doc.font("Helvetica");
      orden.productos.forEach((p, i) => {
        const y = tableTop + 25 + i * 20;
        const subtotal = (p.precioPagado || 0) * (p.cantidad || 0);

        doc.text(p.nombre, itemX, y);
        doc.text(p.cantidad, quantityX, y);
        doc.text(`$${(p.precioPagado || 0).toFixed(2)}`, priceX, y);
        doc.text(`$${(p.precioActual || 0).toFixed(2)}`, currentPriceX, y);
        doc.text(`$${subtotal.toFixed(2)}`, subtotalX, y);
      });

      doc.moveDown();

      // Total
      doc.font("Helvetica-Bold");
      doc.text(`Total: $${orden.total.toFixed(2)}`, { align: "right" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// 🔹 Enviar PDF por correo
async function enviarPDFporCorreo(orden) {
  try {
    const pdfBuffer = await generarPDF(orden);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Tienda" <${process.env.SMTP_USER}>`,
      to: orden.datosCliente.email,
      subject: `Tu orden ${orden._id}`,
      text: "Adjuntamos tu factura en PDF",
      attachments: [
        {
          filename: `orden_${orden._id}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    console.log("📩 PDF enviado por correo");
  } catch (err) {
    console.error("❌ Error enviando PDF por correo:", err.message);
    throw err;
  }
}

module.exports = { generarPDF, enviarPDFporCorreo };
