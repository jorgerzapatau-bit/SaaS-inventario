"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Save, ArrowLeft, Plus, Trash2, Truck, AlertTriangle } from "lucide-react";
import { fetchApi } from "@/lib/api";

function EditPurchasePageInner() {
    const router       = useRouter();
    const searchParams = useSearchParams();
    const compraId     = searchParams.get("id");

    const [loading,       setLoading]       = useState(false);
    const [loadingData,   setLoadingData]   = useState(true);
    const [error,         setError]         = useState("");
    const [products,      setProducts]      = useState<any[]>([]);
    const [suppliers,     setSuppliers]     = useState<any[]>([]);
    const [referencia,    setReferencia]    = useState("");
    const [proveedorId,   setProveedorId]   = useState("");
    const [detalles,      setDetalles]      = useState<any[]>([
        { productoId: "", cantidad: 1, precioUnitario: 0 },
    ]);

    // Cargar datos de la compra + catálogos en paralelo
    useEffect(() => {
        if (!compraId) { setError("ID de compra no especificado."); setLoadingData(false); return; }

        Promise.all([
            fetchApi("/products"),
            fetchApi("/suppliers"),
            fetchApi("/purchases"),
        ])
            .then(([prodData, suppData, comprasData]) => {
                setProducts(prodData);
                setSuppliers(suppData);

                const compra = comprasData.find((c: any) => c.id === compraId);
                if (!compra) { setError("Compra no encontrada."); return; }
                if (compra.status !== "PENDIENTE") {
                    setError(`Solo se pueden editar compras en estado PENDIENTE. Esta está ${compra.status}.`);
                    return;
                }

                setProveedorId(compra.proveedorId ?? "");
                setReferencia(compra.referencia ?? "");
                setDetalles(
                    compra.detalles.map((d: any) => ({
                        productoId:     d.productoId,
                        cantidad:       d.cantidad,
                        precioUnitario: Number(d.precioUnitario),
                    }))
                );
            })
            .catch(() => setError("Error al cargar los datos."))
            .finally(() => setLoadingData(false));
    }, [compraId]);

    const handleDetalleChange = (index: number, field: string, value: string | number) => {
        const next = [...detalles];
        if (field === "productoId") {
            const prod = products.find((p) => p.id === value);
            next[index].precioUnitario = prod ? Number(prod.precioCompra ?? 0) : 0;
        }
        next[index][field] = value;
        setDetalles(next);
    };

    const addLinea    = () => setDetalles([...detalles, { productoId: "", cantidad: 1, precioUnitario: 0 }]);
    const removeLinea = (i: number) => { if (detalles.length > 1) setDetalles(detalles.filter((_, idx) => idx !== i)); };

    const total = detalles.reduce((acc, d) => acc + Number(d.precioUnitario) * Number(d.cantidad), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!proveedorId) { setError("Debes seleccionar un proveedor."); return; }
        if (detalles.some((d) => !d.productoId || Number(d.cantidad) <= 0)) {
            setError("Completa correctamente todas las líneas de producto.");
            return;
        }

        setLoading(true);
        setError("");
        try {
            await fetchApi(`/purchases/${compraId}`, {
                method: "PUT",
                body: JSON.stringify({
                    proveedorId,
                    detalles: detalles.map((d) => ({
                        productoId:     d.productoId,
                        cantidad:       Number(d.cantidad),
                        precioUnitario: Number(d.precioUnitario),
                    })),
                    total,
                }),
            });
            router.push("/dashboard/purchases");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Error al guardar los cambios.");
            setLoading(false);
        }
    };

    // ── Estados de carga / error iniciales ───────────────────────────────────
    if (loadingData) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                Cargando datos de la compra…
            </div>
        );
    }

    if (error && detalles.length === 1 && !detalles[0].productoId) {
        // Error fatal (no es un error de validación del form)
        return (
            <div className="max-w-2xl mx-auto mt-12">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
                    <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={22} />
                    <div>
                        <p className="font-semibold text-red-700">No se puede editar esta compra</p>
                        <p className="text-sm text-red-600 mt-1">{error}</p>
                        <button
                            onClick={() => router.back()}
                            className="mt-4 px-4 py-2 bg-white border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 text-sm"
                        >
                            ← Volver
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.back()}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Editar Compra</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Modifica el proveedor o las líneas de esta orden pendiente.
                        El stock no cambia hasta que la marques como completada.
                    </p>
                </div>
            </div>

            {/* Aviso de solo pendientes */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-700">
                <AlertTriangle size={16} className="shrink-0" />
                Solo las compras en estado <strong>Pendiente</strong> pueden editarse. Una vez completada o cancelada, el registro es definitivo.
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 flex items-center gap-3">
                    <span className="font-semibold">Error:</span> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* ── Información General ── */}
                <Card>
                    <CardHeader title="Información General" />
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Referencia (solo lectura — generada automáticamente) */}
                        {referencia && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Referencia</label>
                                <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 text-sm">
                                    {referencia}
                                    <span className="ml-2 text-xs text-gray-400">(no editable)</span>
                                </div>
                            </div>
                        )}

                        {/* Proveedor */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                <Truck size={15} className="text-gray-400" />
                                Proveedor
                                <span className="text-red-500 text-xs font-normal ml-1">* obligatorio</span>
                            </label>
                            <select
                                value={proveedorId}
                                onChange={(e) => setProveedorId(e.target.value)}
                                required
                                className={`w-full px-4 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20
                                    ${!proveedorId ? "border-blue-300 bg-blue-50/30" : "border-gray-200"}`}
                            >
                                <option value="">-- Seleccionar Proveedor --</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Productos ── */}
                <Card>
                    <CardHeader
                        title="Productos de la Orden"
                        subtitle="Modifica las cantidades o reemplaza los productos según corresponda."
                    />
                    <CardContent className="space-y-4">
                        <div className="hidden sm:grid grid-cols-12 gap-4 pb-2 border-b border-gray-100 text-sm font-semibold text-gray-500">
                            <div className="col-span-5">Producto</div>
                            <div className="col-span-2">Costo Unitario</div>
                            <div className="col-span-2">Cantidad</div>
                            <div className="col-span-2 text-right">Subtotal</div>
                            <div className="col-span-1"></div>
                        </div>

                        {detalles.map((det, index) => (
                            <div key={index} className="grid grid-cols-12 gap-4 items-center mb-4 sm:mb-0">
                                <div className="col-span-12 sm:col-span-5">
                                    <select
                                        required
                                        value={det.productoId}
                                        onChange={(e) => handleDetalleChange(index, "productoId", e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="">-- Selecciona Producto --</option>
                                        {products.map((p) => (
                                            <option key={p.id} value={p.id}>{p.sku} - {p.nombre} ({p.unidad})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                        <input
                                            type="number" step="0.01" min="0" required
                                            value={det.precioUnitario}
                                            onChange={(e) => handleDetalleChange(index, "precioUnitario", e.target.value)}
                                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <input
                                        type="number" min="1" required
                                        value={det.cantidad}
                                        onChange={(e) => handleDetalleChange(index, "cantidad", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                                <div className="col-span-10 sm:col-span-2 text-right font-bold text-gray-700">
                                    ${(Number(det.precioUnitario) * Number(det.cantidad)).toFixed(2)}
                                </div>
                                <div className="col-span-2 sm:col-span-1 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => removeLinea(index)}
                                        disabled={detalles.length === 1}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors"
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
                                <span className="text-gray-500 mr-4">Total Compra:</span>
                                <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Acciones */}
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
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 shadow-sm"
                    >
                        {loading ? "Guardando..." : <><Save size={18} /> Guardar cambios</>}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function EditPurchasePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>}>
            <EditPurchasePageInner />
        </Suspense>
    );
}
