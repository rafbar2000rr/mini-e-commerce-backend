// utils/enviarPDF.js
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

// Generar PDF de la orden
async function generarPDF(orden) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      let buffers = [];
      
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // Encabezado
      doc.fontSize(20).text("Detalle de la Orden", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`Orden ID: ${orden._id}`);
      doc.text(`Fecha: ${orden.fecha}`);
      doc.text(`Cliente: ${orden.datosCliente.nombre}`);
      doc.text(`Email: ${orden.datosCliente.email}`);
      doc.moveDown();

      // Tabla de productos
      doc.fontSize(14).text("Productos:", { underline: true });
      doc.moveDown(0.5);

      orden.productos.forEach((p, i) => {
        const subtotal = (p.precioPagado || 0) * (p.cantidad || 1);
        doc.fontSize(12)
           .text(`${i + 1}. ${p.nombre}`)
           .text(`   Cantidad: ${p.cantidad}`)
           .text(`   Precio Pagado: $${p.precioPagado.toFixed(2)}`)
           .text(`   Precio Actual: $${p.precioActual.toFixed(2)}`)
           .text(`   Subtotal: $${subtotal.toFixed(2)}`)
           .moveDown(0.5);
      });

      doc.moveDown();
      doc.fontSize(14).text(`Total de la Orden: $${orden.total.toFixed(2)}`, { align: "right" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Enviar PDF por correo
async function enviarPDFporCorreo(orden) {
  const pdfBuffer = await generarPDF(orden);

  const transporter = nodemailer.createTransport({
    service: "gmail", // o tu servicio de correo
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
    attachments: [
      { filename: `orden_${orden._id}.pdf`, content: pdfBuffer },
    ],
  });
}

module.exports = { generarPDF, enviarPDFporCorreo };
