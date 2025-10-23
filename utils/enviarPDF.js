const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

//-------------------------------------------------------------------------------
// ✅ Tu función para generar y enviar el PDF
const generarPDF = async (req, res) => {
  try {
    const orderId = req.params.id;

    // Busca la orden e incluye los productos
    const order = await Order.findById(orderId)
      .populate('productos.productoId') // asegúrate que se llame productoId en tu schema
      .exec();

    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // 📄 Crear documento PDF
    const doc = new PDFDocument({ margin: 40 });
    const filePath = path.join(__dirname, `../pdfs/order_${orderId}.pdf`);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // 🩵 Encabezado
    doc.fontSize(18).text('Mini E-commerce', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(12);
    doc.text(`Order ID: ${order._id}`);
    doc.text(`Date: ${new Date(order.fecha).toLocaleDateString()}`);
    doc.moveDown(1);

    // 🧾 Tabla de productos
    doc.fontSize(13).text('Productos:', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12);
    let y = doc.y;
    doc.text('Producto', 50, y);
    doc.text('Cantidad', 250, y);
    doc.text('Precio', 400, y, { align: 'right' });
    y += 15;

    order.productos.forEach((item) => {
      doc.text(item.productoId.nombre, 50, y);
      doc.text(item.cantidad.toString(), 260, y);
      doc.text(`$${item.productoId.precio.toFixed(2)}`, 420, y, { align: 'right' });
      y += 20;
    });

    // 💰 Total
    doc.moveTo(50, y).lineTo(500, y).stroke();
    y += 10;
    doc.fontSize(14).text(`Total: $${order.total.toFixed(2)}`, 420, y, { align: 'right' });

    // 🖨️ Finaliza
    doc.end();

    stream.on('finish', () => {
      res.download(filePath, `order_${orderId}.pdf`, (err) => {
        if (err) console.error('❌ Error al enviar el PDF:', err);
        fs.unlinkSync(filePath); // borra el PDF temporal
      });
    });

  } catch (error) {
    console.error('❌ Error al generar PDF:', error);
    res.status(500).json({ message: 'Error al generar PDF' });
  }
};

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
