// utils/enviarPDF.js
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

// Generar PDF de la orden estilo recibo profesional
async function generarPDF(orden) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // ---------- Encabezado ----------
      doc.fillColor("#333").fontSize(22).text("📦 Detalle de tu Orden", { align: "center" });
      doc.moveDown(0.5);

      doc.fontSize(12).fillColor("#555");
      doc.text(`Orden ID: ${orden._id}`);
      doc.text(`Fecha: ${orden.fecha.toLocaleString()}`);
      doc.text(`Cliente: ${orden.datosCliente.nombre}`);
      doc.text(`Email: ${orden.datosCliente.email}`);
      doc.text(`Dirección: ${orden.datosCliente.direccion}, ${orden.datosCliente.ciudad} - ${orden.datosCliente.codigoPostal}`);
      doc.moveDown();

      // ---------- Tabla de productos ----------
      const startX = doc.x;
      const startY = doc.y;
      const tableWidth = 500;

      doc.fontSize(12).fillColor("#333").text("Productos:", startX, startY);
      doc.moveDown(0.5);

      // Encabezado de tabla
      const tableHeaders = ["#", "Producto", "Cantidad", "Precio Pagado", "Precio Actual", "Subtotal"];
      const columnWidths = [20, 200, 60, 80, 80, 60];
      let y = doc.y;

      // Dibujar encabezado
      doc.fillColor("#fff").rect(startX, y, tableWidth, 20).fill("#4CAF50");
      doc.fillColor("#fff");
      let x = startX;
      for (let i = 0; i < tableHeaders.length; i++) {
        doc.text(tableHeaders[i], x + 2, y + 5, { width: columnWidths[i], align: "left" });
        x += columnWidths[i];
      }
      y += 20;

      // Dibujar filas
      doc.fillColor("#000");
      orden.productos.forEach((p, i) => {
        x = startX;
        const subtotal = (p.precioPagado || 0) * (p.cantidad || 1);

        const rowHeight = 20;
        // Fondo alternado
        if (i % 2 === 0) doc.rect(startX, y, tableWidth, rowHeight).fill("#f2f2f2").fillColor("#000");

        const values = [
          i + 1,
          p.nombre,
          p.cantidad,
          `$${p.precioPagado.toFixed(2)}`,
          `$${p.precioActual.toFixed(2)}`,
          `$${subtotal.toFixed(2)}`
        ];

        for (let j = 0; j < values.length; j++) {
          doc.text(values[j], x + 2, y + 5, { width: columnWidths[j], align: "left" });
          x += columnWidths[j];
        }
        y += rowHeight;
      });

      doc.moveDown(orden.productos.length * 0.5 + 1);

      // ---------- Total ----------
      doc.fontSize(14).fillColor("#333").text(`💰 Total: $${orden.total.toFixed(2)}`, { align: "right" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ---------- Enviar PDF por correo ----------
async function enviarPDFporCorreo(orden) {
  const pdfBuffer = await generarPDF(orden);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: orden.datosCliente.email,
    subject: `Detalle de tu orden ${orden._id}`,
    text: "Adjuntamos el PDF con el detalle de tu orden.",
    attachments: [{ filename: `orden_${orden._id}.pdf`, content: pdfBuffer }],
  });
}

module.exports = { generarPDF, enviarPDFporCorreo };
