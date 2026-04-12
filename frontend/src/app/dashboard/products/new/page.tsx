"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { ArrowLeft, Save, Upload, X, ToggleLeft, ToggleRight } from "lucide-react";

// ── Image compression ────────────────────────────────────────────────────────
const MAX_SIZE_BYTES = 300 * 1024;
const MAX_DIMENSION  = 500;

async function compressImage(file: File): Promise<{ base64: string; error?: string }> {
    return new Promise((resolve) => {
        if (!file.type.startsWith("image/")) {
            resolve({ base64: "", error: "El archivo debe ser una imagen (JPG, PNG, WebP)" });
            return;
        }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement("canvas");
            let { width, height } = img;
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                if (width > height) { height = Math.round(height * MAX_DIMENSION / width); width = MAX_DIMENSION; }
                else { width = Math.round(width * MAX_DIMENSION / height); height = MAX_DIMENSION; }
            }
            canvas.width = width; canvas.height = height;
            canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
            let quality = 0.85;
            let base64 = canvas.toDataURL("image/jpeg", quality);
            while (base64.length * 0.75 > MAX_SIZE_BYTES && quality > 0.2) {
                quality -= 0.1;
                base64 = canvas.toDataURL("image/jpeg", quality);
            }
            if (base64.length * 0.75 > MAX_SIZE_BYTES) resolve({ base64: "", error: "Imagen demasiado grande. Usa una más pequeña." });
            else resolve({ base64 });
        };
        img.onerror = () => resolve({ base64: "", error: "No se pudo leer la imagen" });
        img.src = url;
    });
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NuevoInsumoPage() {
    const router       = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading,      setLoading]      = useState(false);
    const [error,        setError]        = useState("");
    const [imgError,     setImgError]     = useState("");
    const [imgUploading, setImgUploading] = useState(false);
    const [categorias,   setCategorias]   = useState<any[]>([]);

    const [formData, setFormData] = useState({
        sku:          "",
        nombre:       "",
        descripcion:  "",
        categoriaId:  "",
        costoUnitario:"",
        nivelReorden: "",
        diasReorden:  "",
        stockMinimo:  "5",
        unidad:       "litro",
        imagen:       null as string | null,
        activo:       true,
    });

    useEffect(() => {
        fetchApi("/categories").then(setCategorias).catch(() => {});
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageFile = async (file: File) => {
        setImgError(""); setImgUploading(true);
        const { base64, error } = await compressImage(file);
        setImgUploading(false);
        if (error) { setImgError(error); return; }
        setFormData(prev => ({ ...prev, imagen: base64 }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.sku.trim())    { setError("El SKU es obligatorio"); return; }
        if (!formData.nombre.trim()) { setError("El nombre es obligatorio"); return; }
        if (!formData.categoriaId)   { setError("Debes seleccionar una categoría"); return; }

        setLoading(true); setError("");
        try {
            const created = await fetchApi("/products", {
                method: "POST",
                body: JSON.stringify({
                    sku:          formData.sku.trim(),
                    nombre:       formData.nombre.trim(),
                    descripcion:  formData.descripcion,
                    categoriaId:  formData.categoriaId,
                    unidad:       formData.unidad,
                    stockMinimo:  Number(formData.stockMinimo) || 5,
                    nivelReorden: formData.nivelReorden ? Number(formData.nivelReorden) : undefined,
                    diasReorden:  formData.diasReorden  ? Number(formData.diasReorden)  : undefined,
                    precioCompra: formData.costoUnitario ? Number(formData.costoUnitario) : undefined,
                    imagen:       formData.imagen,
                    activo:       formData.activo,
                }),
            });
            router.replace(`/dashboard/products/${created.id}`);
        } catch (err: any) {
            setError(err.message || "Error al crear el insumo");
            setLoading(false);
        }
    };

    const costoUnitario = Number(formData.costoUnitario) || 0;

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()}
                        className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <p className="text-sm text-gray-500">Nuevo insumo</p>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {formData.nombre || "Nuevo Insumo"}
                        </h1>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {formData.activo ? "Activo" : "Inactivo"}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => router.back()}
                        className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                        <X size={16} /> Cancelar
                    </button>
                    <button onClick={handleSubmit} disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-70 text-sm shadow-sm">
                        <Save size={16} />
                        {loading ? "Creando..." : "Crear insumo"}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

                    {/* Columna izquierda */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Imagen del insumo</p>
                            <div
                                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
                                onDragOver={e => e.preventDefault()}
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all mb-3 overflow-hidden"
                            >
                                {imgUploading ? (
                                    <p className="text-sm text-gray-400">Procesando imagen...</p>
                                ) : formData.imagen ? (
                                    <img src={formData.imagen} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <div className="p-3 bg-gray-100 rounded-xl"><Upload size={24} className="text-gray-400" /></div>
                                        <div className="text-center px-4">
                                            <p className="text-sm text-gray-600 font-medium">Haz clic o arrastra aquí</p>
                                            <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP</p>
                                        </div>
                                    </>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                                onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
                            {imgError && <p className="text-xs text-red-500 mb-3">{imgError}</p>}
                            <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1 mb-3">
                                <div className="flex justify-between"><span className="text-gray-400">Tamaño máximo</span><span className="font-medium text-gray-700">300 KB</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">Dimensiones</span><span className="font-medium text-gray-700">500 × 500 px</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">Compresión</span><span className="font-medium text-green-600">Automática</span></div>
                            </div>
                            {formData.imagen && (
                                <button type="button" onClick={() => setFormData(p => ({ ...p, imagen: null }))}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-xs text-red-500 hover:bg-red-50 border border-red-200 rounded-lg transition-colors">
                                    <X size={14} /> Eliminar imagen
                                </button>
                            )}
                        </div>

                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">Insumo activo</p>
                                    <p className="text-xs text-gray-400 mt-1">Los inactivos no aparecen en nuevas entradas/salidas</p>
                                </div>
                                <button type="button" onClick={() => setFormData(p => ({ ...p, activo: !p.activo }))} className="transition-colors flex-shrink-0">
                                    {formData.activo ? <ToggleRight size={36} className="text-green-500" /> : <ToggleLeft size={36} className="text-gray-300" />}
                                </button>
                            </div>
                            <div className={`mt-3 text-center text-xs font-semibold py-1.5 rounded-lg ${formData.activo ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                                {formData.activo ? "Activo — visible en el sistema" : "Inactivo — oculto del sistema"}
                            </div>
                        </div>
                    </div>

                    {/* Columna derecha */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Información general</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">SKU *</label>
                                <input required type="text" name="sku" value={formData.sku} onChange={handleChange}
                                    placeholder="Ej: LAP-001"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                <p className="text-xs text-gray-400 mt-1">No editable después — identifica el historial</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nombre *</label>
                                <input required type="text" name="nombre" value={formData.nombre} onChange={handleChange}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1.5">Descripción</label>
                            <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows={2}
                                placeholder="Características principales del insumo..."
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">Categoría *</label>
                                <select name="categoriaId" value={formData.categoriaId} onChange={handleChange} required
                                    className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${!formData.categoriaId ? "border-red-300" : "border-gray-200"}`}>
                                    <option value="">Seleccionar</option>
                                    {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                {!formData.categoriaId && <p className="text-xs text-red-500 mt-1">Requerida para guardar</p>}
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">Unidad de medida *</label>
                                <select name="unidad" value={formData.unidad} onChange={handleChange}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                    <option value="pieza">Pieza</option>
                                    <option value="unidad">Unidad</option>
                                    <option value="caja">Caja</option>
                                    <option value="litro">Litro</option>
                                    <option value="kg">Kilogramo</option>
                                    <option value="gramo">Gramo</option>
                                    <option value="metro">Metro</option>
                                    <option value="rollo">Rollo</option>
                                    <option value="resma">Resma</option>
                                    <option value="par">Par</option>
                                    <option value="jornal">Jornal</option>
                                </select>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-5">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Costos y reabastecimiento</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1.5">
                                        Costo unitario <span className="text-gray-400 font-normal text-xs">(referencia, opcional)</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                        <input type="number" step="0.01" min="0" name="costoUnitario"
                                            value={formData.costoUnitario} onChange={handleChange}
                                            placeholder="Ej: 77.92"
                                            className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Se actualizará automáticamente al registrar compras</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Stock mínimo *</label>
                                    <input required type="number" min="0" name="stockMinimo"
                                        value={formData.stockMinimo} onChange={handleChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                    <p className="text-xs text-gray-400 mt-1">Alerta cuando el stock baja de este nivel</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Nivel de reorden</label>
                                    <input type="number" min="0" name="nivelReorden"
                                        value={formData.nivelReorden} onChange={handleChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                    <p className="text-xs text-gray-400 mt-1">Cantidad a pedir cuando se activa la alerta</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1.5">
                                        Días de reorden <span className="text-gray-400 font-normal text-xs">(tiempo de entrega)</span>
                                    </label>
                                    <input type="number" min="0" name="diasReorden"
                                        value={formData.diasReorden} onChange={handleChange}
                                        placeholder="Ej: 7"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                    <p className="text-xs text-gray-400 mt-1">Días hábiles que tarda en llegar el pedido</p>
                                </div>
                                {costoUnitario > 0 && (
                                    <div className="flex items-end">
                                        <div className="w-full bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                                            <p className="text-xs text-blue-500 font-medium mb-1">Costo de reabastecimiento estimado</p>
                                            <p className="text-xl font-bold text-blue-700">
                                                ${(costoUnitario * (Number(formData.nivelReorden) || Number(formData.stockMinimo) || 0)).toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                                            </p>
                                            <p className="text-xs text-blue-400 mt-0.5">
                                                {formData.nivelReorden || formData.stockMinimo} {formData.unidad} × ${costoUnitario.toLocaleString("es-MX")}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button type="button" onClick={() => router.back()}
                                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm">
                                Cancelar
                            </button>
                            <button type="submit" disabled={loading}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-70 text-sm shadow-sm">
                                <Save size={16} />
                                {loading ? "Creando..." : "Crear insumo"}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
