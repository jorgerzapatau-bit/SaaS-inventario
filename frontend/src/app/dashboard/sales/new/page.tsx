"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Save, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { fetchApi } from "@/lib/api";

export default function NewSalePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [products, setProducts] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        referencia: "",
        cliente: "",
        tipo: "VENTA",
        estado: "COMPLETADA",
    });

    const [detalles, setDetalles] = useState<any[]>([
        { productoId: "", cantidad: 1, precioUnitario: 0 }
    ]);

    useEffect(() => {
        // Load products to populate the dropdown
        fetchApi('/products')
            .then(setProducts)
            .catch(() => setError("Error al cargar productos"));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDetalleChange = (index: number, field: string, value: string | number) => {
        const newDetalles = [...detalles];
        
        if (field === 'productoId') {
            const selectedProduct = products.find(p => p.id === value);
            newDetalles[index].precioUnitario = selectedProduct ? selectedProduct.precioVenta : 0;
            // set max available quantity to stock? For now just allow any
        }
        
        newDetalles[index][field] = value;
        setDetalles(newDetalles);
    };

    const addLinea = () => {
        setDetalles([...detalles, { productoId: "", cantidad: 1, precioUnitario: 0 }]);
    };

    const removeLinea = (index: number) => {
        if (detalles.length > 1) {
            setDetalles(detalles.filter((_, i) => i !== index));
        }
    };

    const total = detalles.reduce((acc, current) => {
        return acc + (Number(current.precioUnitario) * Number(current.cantidad));
    }, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            // Validate details
            if (detalles.some(d => !d.productoId || Number(d.cantidad) <= 0)) {
                throw new Error("Por favor completa correctamente todas las líneas de productos.");
            }

            // Convert to numbers
            const processedDetalles = detalles.map(d => ({
                productoId: d.productoId,
                cantidad: Number(d.cantidad),
                precioUnitario: Number(d.precioUnitario)
            }));

            await fetchApi("/sales", {
                method: "POST",
                body: JSON.stringify({
                    ...formData,
                    detalles: processedDetalles,
                    total
                }),
            });

            router.push("/dashboard/sales");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Error al crear la salida");
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.back()}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Nueva Salida</h1>
                    <p className="text-sm text-gray-500 mt-1">Registra una venta o retiro de inventario.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 flex items-center gap-3">
                    <span className="font-semibold">Error:</span> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <CardHeader title="Información General" />
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Referencia (Folio/Ticket) *</label>
                            <input
                                required
                                type="text"
                                name="referencia"
                                value={formData.referencia}
                                onChange={handleChange}
                                placeholder="Ej: VENTA-0001"
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Cliente (Opcional)</label>
                            <input
                                type="text"
                                name="cliente"
                                value={formData.cliente}
                                onChange={handleChange}
                                placeholder="Atención a mostrador..."
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Tipo de Salida</label>
                            <select
                                name="tipo"
                                value={formData.tipo}
                                onChange={handleChange}
                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg"
                            >
                                <option value="VENTA">Venta</option>
                                <option value="CONSUMO_INTERNO">Consumo Interno</option>
                                <option value="PERDIDA">Merma / Pérdida</option>
                            </select>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader title="Productos" subtitle="Selecciona los artículos y cantidades a descontar." />
                    <CardContent className="space-y-4">
                        <div className="hidden sm:grid grid-cols-12 gap-4 pb-2 border-b border-gray-100 text-sm font-semibold text-gray-500">
                            <div className="col-span-12 sm:col-span-5">Producto</div>
                            <div className="col-span-12 sm:col-span-2">Precio Unit.</div>
                            <div className="col-span-12 sm:col-span-2">Cantidad</div>
                            <div className="col-span-12 sm:col-span-2 text-right">Subtotal</div>
                            <div className="col-span-12 sm:col-span-1"></div>
                        </div>

                        {detalles.map((detalle, index) => (
                            <div key={index} className="grid grid-cols-12 gap-4 items-center mb-4 sm:mb-0">
                                <div className="col-span-12 sm:col-span-5">
                                    <select
                                        required
                                        value={detalle.productoId}
                                        onChange={(e) => handleDetalleChange(index, 'productoId', e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg"
                                    >
                                        <option value="">-- Selecciona --</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.sku} - {p.nombre} (Stock: {p.stock || 0})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={detalle.precioUnitario}
                                            onChange={(e) => handleDetalleChange(index, 'precioUnitario', e.target.value)}
                                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                            readOnly={formData.tipo !== 'VENTA'} 
                                        />
                                    </div>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={detalle.cantidad}
                                        onChange={(e) => handleDetalleChange(index, 'cantidad', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div className="col-span-10 sm:col-span-2 text-right font-bold text-gray-700">
                                    ${(Number(detalle.precioUnitario) * Number(detalle.cantidad)).toFixed(2)}
                                </div>
                                <div className="col-span-2 sm:col-span-1 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => removeLinea(index)}
                                        disabled={detalles.length === 1}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                            <button
                                type="button"
                                onClick={addLinea}
                                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 font-medium rounded-lg transition-colors"
                            >
                                <Plus size={18} /> Añadir Línea
                            </button>
                            <div className="text-right">
                                <span className="text-gray-500 mr-4">Total Salida:</span>
                                <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
                            </div>
                        </div>

                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-70 shadow-sm"
                    >
                        {loading ? 'Guardando...' : (
                            <>
                                <Save size={18} />
                                Registrar Salida
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
