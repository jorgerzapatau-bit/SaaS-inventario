"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { ArrowLeft, Save, Upload, X, ToggleLeft, ToggleRight } from "lucide-react";

// ── Image compression utility ────────────────────────────────────────────────
const MAX_SIZE_BYTES = 300 * 1024; // 300KB
const MAX_DIMENSION = 500;

async function compressImage(file: File): Promise<{ base64: string; error?: string }> {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) {
            resolve({ base64: '', error: 'El archivo debe ser una imagen (JPG, PNG, WebP)' });
            return;
        }

        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            // Resize mantaining aspect ratio
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                if (width > height) { height = Math.round(height * MAX_DIMENSION / width); width = MAX_DIMENSION; }
                else { width = Math.round(width * MAX_DIMENSION / height); height = MAX_DIMENSION; }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, width, height);

            // Try compressing at decreasing quality until under 300KB
            let quality = 0.85;
            let base64 = canvas.toDataURL('image/jpeg', quality);

            while (base64.length * 0.75 > MAX_SIZE_BYTES && quality > 0.2) {
                quality -= 0.1;
                base64 = canvas.toDataURL('image/jpeg', quality);
            }

            if (base64.length * 0.75 > MAX_SIZE_BYTES) {
                resolve({ base64: '', error: 'La imagen es demasiado grande incluso después de comprimir. Usa una imagen más pequeña.' });
            } else {
                resolve({ base64 });
            }
        };
        img.onerror = () => resolve({ base64: '', error: 'No se pudo leer la imagen' });
        img.src = url;
    });
}

export default function EditProductPage() {
    const router = useRouter();
    const { id } = useParams();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [fetching, setFetching] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [imgError, setImgError] = useState('');
    const [imgUploading, setImgUploading] = useState(false);
    const [categorias, setCategorias] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        sku: '',
        nombre: '',
        descripcion: '',
        categoriaId: '',
        precioCompra: '',
        precioVenta: '',
        stockMinimo: '',
        unidad: 'pieza',
        imagen: '' as string | null,
        activo: true,
    });

    useEffect(() => {
        const load = async () => {
            try {
                const [product, products] = await Promise.all([
                    fetchApi(`/products/${id}`),
                    fetchApi('/products'),
                ]);
                // Extract unique categories from products list
                const cats = Array.from(new Map(
                    products.filter((p: any) => p.categoria).map((p: any) => [p.categoria.id, p.categoria])
                ).values());
                setCategorias(cats);

                setFormData({
                    sku: product.sku || '',
                    nombre: product.nombre || '',
                    descripcion: product.descripcion || '',
                    categoriaId: product.categoriaId || '',
                    precioCompra: product.precioCompra ?? '',
                    precioVenta: product.precioVenta ?? '',
                    stockMinimo: product.stockMinimo ?? '',
                    unidad: product.unidad || 'pieza',
                    imagen: product.imagen || null,
                    activo: product.activo ?? true,
                });
            } catch (err: any) {
                setError('Error al cargar el producto');
            } finally {
                setFetching(false);
            }
        };
        if (id) load();
    }, [id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageFile = async (file: File) => {
        setImgError('');
        setImgUploading(true);
        const { base64, error } = await compressImage(file);
        setImgUploading(false);
        if (error) { setImgError(error); return; }
        setFormData(prev => ({ ...prev, imagen: base64 }));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleImageFile(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await fetchApi(`/products/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    nombre: formData.nombre,
                    categoriaId: formData.categoriaId,
                    unidad: formData.unidad,
                    precioCompra: Number(formData.precioCompra),
                    precioVenta: Number(formData.precioVenta),
                    stockMinimo: Number(formData.stockMinimo),
                    imagen: formData.imagen,
                    activo: formData.activo,
                }),
            });
            router.push(`/dashboard/products/${id}`);
        } catch (err: any) {
            setError(err.message || 'Error al guardar el producto');
            setLoading(false);
        }
    };

    // Margen calculado en tiempo real
    const pCompra = Number(formData.precioCompra) || 0;
    const pVenta  = Number(formData.precioVenta)  || 0;
    const margen  = pVenta > 0 ? ((pVenta - pCompra) / pVenta * 100) : 0;
    const margenColor = margen >= 30 ? 'text-green-600' : margen >= 15 ? 'text-amber-500' : 'text-red-500';

    if (fetching) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <p className="text-gray-500">Cargando producto...</p>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Editar Producto</h1>
                    <p className="text-sm text-gray-500 mt-1">SKU: <span className="font-mono font-semibold text-gray-700">{formData.sku}</span></p>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

                    {/* ── Columna izquierda: imagen + toggle activo ── */}
                    <div className="space-y-4">

                        {/* Imagen */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Imagen del producto</p>

                            {/* Drop zone */}
                            <div
                                onDrop={handleDrop}
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

                            {/* Límites */}
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

                        {/* Toggle activo/inactivo */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">Producto activo</p>
                                    <p className="text-xs text-gray-400 mt-1">Los inactivos no aparecen en nuevas entradas/salidas</p>
                                </div>
                                <button type="button" onClick={() => setFormData(p => ({ ...p, activo: !p.activo }))}
                                    className="transition-colors flex-shrink-0">
                                    {formData.activo
                                        ? <ToggleRight size={36} className="text-green-500" />
                                        : <ToggleLeft  size={36} className="text-gray-300" />
                                    }
                                </button>
                            </div>
                            <div className={`mt-3 text-center text-xs font-semibold py-1.5 rounded-lg ${formData.activo ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                {formData.activo ? 'Activo — visible en el sistema' : 'Inactivo — oculto del sistema'}
                            </div>
                        </div>
                    </div>

                    {/* ── Columna derecha: formulario ── */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">

                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Información general</p>

                        {/* SKU (readonly) + Nombre */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">SKU</label>
                                <input type="text" value={formData.sku} readOnly
                                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 font-mono cursor-not-allowed" />
                                <p className="text-xs text-gray-400 mt-1">No editable — identifica el historial</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nombre *</label>
                                <input required type="text" name="nombre" value={formData.nombre} onChange={handleChange}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                        </div>

                        {/* Descripción */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1.5">Descripción</label>
                            <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows={2}
                                placeholder="Características principales del producto..."
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
                        </div>

                        {/* Categoría + Unidad */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">Categoría *</label>
                                <select name="categoriaId" value={formData.categoriaId} onChange={handleChange} required
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                    <option value="">Seleccionar categoría</option>
                                    {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
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
                                </select>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-5">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Precios y stock</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Precio compra *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                        <input required type="number" step="0.01" min="0" name="precioCompra" value={formData.precioCompra} onChange={handleChange}
                                            className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Precio venta *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                        <input required type="number" step="0.01" min="0" name="precioVenta" value={formData.precioVenta} onChange={handleChange}
                                            className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Stock mínimo *</label>
                                    <input required type="number" min="0" name="stockMinimo" value={formData.stockMinimo} onChange={handleChange}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                </div>
                            </div>

                            {/* Margen en tiempo real */}
                            <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${margen >= 30 ? 'bg-green-50 border-green-200' : margen >= 15 ? 'bg-amber-50 border-amber-200' : pVenta > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Margen de ganancia</p>
                                    <p className="text-xs text-gray-400">
                                        {pVenta > 0 && pCompra > 0 ? `$${(pVenta - pCompra).toLocaleString('es-MX')} por ${formData.unidad}` : 'Ingresa los precios para calcular'}
                                    </p>
                                </div>
                                <p className={`text-2xl font-bold ${margenColor}`}>
                                    {pVenta > 0 ? `${margen.toFixed(1)}%` : '—'}
                                </p>
                            </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button type="button" onClick={() => router.back()}
                                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm">
                                Cancelar
                            </button>
                            <button type="submit" disabled={loading}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-70 text-sm shadow-sm">
                                <Save size={16} />
                                {loading ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
