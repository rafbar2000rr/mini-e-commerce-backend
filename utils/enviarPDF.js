const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const axios = require("axios");

//-------------------------------------------------------------------------------
// 📌 Genera un PDF en memoria usando imágenes remotas a la derecha del nombre y precio
//-------------------------------------------------------------------------------
async function generarPDF(orden) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      // 🔹 Capturamos los chunks del PDF
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      //-----------------------------------------------
      // 🎀 Encabezado
      //-----------------------------------------------
      doc.fillColor("#D63384")
        .fontSize(20)
        .text("Detalle de la Orden", { align: "center" });
      doc.moveDown(1);

      //-----------------------------------------------
      // ID, fecha y total de la orden
      //-----------------------------------------------
      doc.fillColor("black").fontSize(12);
      doc.text(`ID de la Orden: ${orden._id}`);
      doc.text(`Fecha: ${new Date(orden.fecha).toLocaleString()}`);
      doc.font("Helvetica-Bold").text(`Total: $${orden.total.toFixed(2)}`);
      doc.moveDown(1);

      //-----------------------------------------------
      // 📦 Datos del cliente
      //-----------------------------------------------
      doc.font("Helvetica-Bold").fillColor("#333").fontSize(14).text(
        "Datos del Cliente:",
        { underline: true }
      );
      doc.moveDown(0.5);
      doc.font("Helvetica").fillColor("black");
      doc.text(`Nombre: ${orden.datosCliente?.nombre || "No disponible"}`);
      doc.text(`Email: ${orden.datosCliente?.email || "No disponible"}`);
      doc.text(`Dirección: ${orden.datosCliente?.direccion || "No disponible"}`);
      doc.text(`Ciudad: ${orden.datosCliente?.ciudad || "No disponible"}`);
      doc.text(`Código Postal: ${orden.datosCliente?.codigoPostal || "No disponible"}`);
      doc.moveDown(1);

      //-----------------------------------------------
      // 📌 Productos de la orden (imagen a la derecha)
      //-----------------------------------------------
      doc.font("Helvetica-Bold").fillColor("#333").fontSize(14).text(
        "Productos:",
        { underline: true }
      );
      doc.moveDown(0.5);

      // 🔹 Iteramos productos
      for (const p of orden.productos) {
        const yInicio = doc.y;

        //-----------------------------------------------
        // 🔹 Datos del producto (nombre y precio)
        //-----------------------------------------------
        const nombre = p.productoId?.nombre ?? p.nombre ?? "Producto sin nombre";
        const precio = p.productoId?.precio ?? p.precio ?? 0;
        doc.font("Helvetica-Bold").fillColor("black").fontSize(12)
          .text(nombre, 50, yInicio, { width: 350 });
        doc.font("Helvetica").fillColor("black").fontSize(12)
          .text(`$${precio} x ${p.cantidad ?? 1}`, 50, yInicio + 15, { width: 350 });

        //-----------------------------------------------
        // 🔹 Miniatura a la derecha
        //-----------------------------------------------
        const imgUrl = p.productoId?.imagen || p.imagen;
        if (imgUrl) {
          try {
            const response = await axios.get(imgUrl, { responseType: "arraybuffer" });
            const buffer = Buffer.from(response.data, "binary");
            doc.image(buffer, 410, yInicio, { width: 80, height: 80 });
          } catch (err) {
            console.error("❌ Error cargando imagen remota:", err.message);
          }
        }

        //-----------------------------------------------
        // 🔹 Separador
        //-----------------------------------------------
        doc.moveDown(5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#ddd").stroke();
        doc.moveDown(0.5);
      }

      //-----------------------------------------------
      // Pie de página
      //-----------------------------------------------
      doc.moveDown(1);
      doc.fontSize(10)
        .fillColor("#555")
        .text("Gracias por tu compra", { align: "center" });

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

    //-----------------------------------------------
    // 🔹 Configurar transporter de Gmail
    //-----------------------------------------------
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    //-----------------------------------------------
    // 🔹 Enviar correo con PDF adjunto
    //-----------------------------------------------
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

//-------------------------------------------------------------------------------
// 🔹 Exportamos funciones
//-------------------------------------------------------------------------------
module.exports = { generarPDF, enviarPDFporCorreo };
