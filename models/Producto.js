import { useState, useEffect } from "react";
import axios from "axios";

export default function FormularioProducto({ onProductoAgregado, productoEditando, categorias }) {
  const [form, setForm] = useState({
    nombre: "",
    precio: "",
    descripcion: "",
    categoria: "",
    stock: "",
  });
  const [imagen, setImagen] = useState(null);
  const [errores, setErrores] = useState({});

  const enEdicion = Boolean(productoEditando);
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (productoEditando) {
      setForm({
        nombre: productoEditando.nombre,
        precio: productoEditando.precio,
        descripcion: productoEditando.descripcion,
        categoria: productoEditando.categoria?._id || "",
        stock: productoEditando.stock || 0,
      });
      setImagen(null);
      setErrores({});
    }
  }, [productoEditando]);

  // 🔹 Validación de un solo campo en tiempo real
  const validarCampo = (nombreCampo, valor) => {
    let error = "";

    switch (nombreCampo) {
      case "nombre":
        if (!valor.trim()) error = "El nombre es obligatorio";
        break;
      case "precio":
        if (!valor) error = "El precio es obligatorio";
        else if (Number(valor) <= 0) error = "El precio debe ser un número positivo";
        break;
      case "categoria":
        if (!valor) error = "Selecciona una categoría";
        break;
      case "stock":
        if (!valor) error = "La cantidad disponible es obligatoria";
        else if (Number(valor) < 0 || !Number.isInteger(Number(valor))) 
          error = "La cantidad debe ser un número entero positivo";
        break;
      default:
        break;
    }

    setErrores((prev) => ({ ...prev, [nombreCampo]: error }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    validarCampo(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar todos los campos antes de enviar
    Object.keys(form).forEach((campo) => validarCampo(campo, form[campo]));
    if (Object.values(errores).some((err) => err)) return;

    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("nombre", form.nombre);
    formData.append("precio", form.precio);
    formData.append("descripcion", form.descripcion);
    formData.append("categoria", form.categoria);
    formData.append("stock", form.stock);
    if (imagen) formData.append("imagen", imagen);

    try {
      let nuevoProducto;
      if (enEdicion) {
        const res = await axios.put(`${API_URL}/api/productos/${productoEditando._id}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        });
        nuevoProducto = res.data;
      } else {
        const res = await axios.post(`${API_URL}/api/productos`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        });
        nuevoProducto = res.data.producto;
      }

      onProductoAgregado(nuevoProducto);
      setForm({ nombre: "", precio: "", descripcion: "", categoria: "", stock: "" });
      setImagen(null);
      setErrores({});
    } catch (error) {
      console.error("Error al guardar producto:", error.response?.data || error.message);
    }
  };

  const handleCancelar = () => {
    setForm({ nombre: "", precio: "", descripcion: "", categoria: "", stock: "" });
    setImagen(null);
    setErrores({});
    onProductoAgregado(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" encType="multipart/form-data">
      {/** Nombre */}
      <div>
        <input
          name="nombre"
          placeholder="Nombre"
          value={form.nombre}
          onChange={handleChange}
          className="border w-full p-2 rounded-lg"
        />
        {errores.nombre && <p className="text-red-500 text-sm">{errores.nombre}</p>}
      </div>

      {/** Precio */}
      <div>
        <input
          name="precio"
          placeholder="Precio"
          type="number"
          value={form.precio}
          onChange={handleChange}
          className="border w-full p-2 rounded-lg"
        />
        {errores.precio && <p className="text-red-500 text-sm">{errores.precio}</p>}
      </div>

      {/** Descripción */}
      <div>
        <textarea
          name="descripcion"
          placeholder="Descripción"
          value={form.descripcion}
          onChange={handleChange}
          className="border w-full p-2 rounded-lg"
        />
      </div>

      {/** Categoría */}
      <div>
        <select
          name="categoria"
          value={form.categoria}
          onChange={handleChange}
          className="border w-full p-2 rounded-lg"
        >
          <option value="">Selecciona una categoría</option>
          {categorias.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.nombre}
            </option>
          ))}
        </select>
        {errores.categoria && <p className="text-red-500 text-sm">{errores.categoria}</p>}
      </div>

      {/** Stock */}
      <div>
        <input
          name="stock"
          type="number"
          placeholder="Cantidad disponible"
          value={form.stock}
          onChange={handleChange}
          className="border w-full p-2 rounded-lg"
        />
        {errores.stock && <p className="text-red-500 text-sm">{errores.stock}</p>}
      </div>

      {/** Imagen */}
      <div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImagen(e.target.files[0])}
          className="border w-full p-2 rounded-lg"
        />
      </div>

      {/** Botones */}
      <div className="flex space-x-2">
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow"
        >
          {enEdicion ? "Actualizar" : "Agregar"} Producto
        </button>
        {enEdicion && (
          <button
            type="button"
            onClick={handleCancelar}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg shadow"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
