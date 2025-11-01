const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const axios = require("axios");
const { Buffer } = require("buffer");

//-------------------------------------------------------------------------------
// 📌 Genera un PDF estilo catálogo profesional usando precios congelados
//-------------------------------------------------------------------------------
async function generarPDF(orden) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      const PAGE_HEIGHT = doc.page.height - doc.page.margins.bottom;
      const PRODUCT_BOX_HEIGHT = 100;

      //-----------------------------------------------
      // 🎀 Encabezado
      //-----------------------------------------------
      doc.fillColor("#D63384")
        .fontSize(22)
        .text("Detalle de la Orden", { align: "center", underline: true });
      doc.moveDown(1);

      //-----------------------------------------------
      // ID, fecha y total
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
        "Datos del Cliente:", { underline: true }
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
      // 📌 Productos de la orden
      //-----------------------------------------------
      doc.font("Helvetica-Bold").fillColor("#333").fontSize(14).text(
        "Productos:", { underline: true }
      );
      doc.moveDown(0.5);

      for (const p of orden.productos) {
        if (doc.y + PRODUCT_BOX_HEIGHT > PAGE_HEIGHT) {
          doc.addPage();
        }

        const yInicio = doc.y;

        //-----------------------------------------------
        // 🔹 Caja sombreada por producto
        //-----------------------------------------------
        doc.rect(45, yInicio - 5, 510, 90).fillOpacity(0.05).fill("#000000");
        doc.fillOpacity(1);

        //-----------------------------------------------
        // 🔹 Datos del producto (nombre, cantidad, precios)
        //-----------------------------------------------
        const nombre = p.nombre || "Producto sin nombre";
        const cantidad = p.cantidad || 1;
        const precioPagado = p.precioPagado ?? 0;
        const precioActual = p.precioActual ?? 0;

        doc.font("Helvetica-Bold").fillColor("#222").fontSize(12)
          .text(nombre, 60, yInicio, { width: 350 });
        doc.font("Helvetica").fillColor("#555").fontSize(12)
          .text(`Cantidad: ${cantidad}`, 60, yInicio + 18, { width: 350 });
        doc.font("Helvetica").fillColor("#555").fontSize(12)
          .text(`Precio congelado: $${precioPagado.toFixed(2)}`, 60, yInicio + 33, { width: 350 });
        doc.font("Helvetica").fillColor("#777").fontSize(10)
          .text(`Precio actual: $${precioActual.toFixed(2)}`, 60, yInicio + 48, { width: 350 });

        //-----------------------------------------------
        // 🔹 Miniatura a la derecha
        //-----------------------------------------------
        const imgUrl = p.imagen;
        if (imgUrl) {
          try {
            const response = await axios.get(imgUrl, { responseType: "arraybuffer" });
            const buffer = Buffer.from(response.data, "binary");
            doc.image(buffer, 420, yInicio, { width: 80, height: 80, fit: [80, 80] });
          } catch (err) {
            console.error("❌ Error cargando imagen remota:", err.message);
          }
        }

        //-----------------------------------------------
        // 🔹 Separador elegante
        //-----------------------------------------------
        doc.moveDown(6);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#ccc").lineWidth(0.5).stroke();
        doc.moveDown(0.5);
      }

      //-----------------------------------------------
      // Pie de página
      //-----------------------------------------------
      doc.moveDown(1);
      doc.fontSize(10)
        .fillColor("#555")
        .text("Gracias por tu compra. ¡Esperamos verte pronto!", { align: "center" });

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
