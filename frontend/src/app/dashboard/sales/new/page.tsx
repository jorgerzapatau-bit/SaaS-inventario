"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Save, ArrowLeft, Plus, Trash2, UserCircle2, AlertTriangle, Pencil } from "lucide-react";
import { fetchApi } from "@/lib/api";

const TIPOS_SALIDA = [
    { value: "VENTA",           label: "Salida"                   },
    { value: "AJUSTE_NEGATIVO", label: "Ajuste (−) — baja manual" },
];

// ── Modal de confirmación de impacto en stock ─────────────────────────────────
function ConfirmStockModal({
    resumen,
    onConfirm,
    onCancel,
}: {
    resumen: { nombre: string; antes: number; despues: number; diff: number }[];
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
                 onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-100 rounded-lg">
                        <AlertTriangle size={20} className="text-amber-600"/>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Confirmar cambios de stock</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Esta edición ajustará el stock de los siguientes productos:
                        </p>
                    </div>
                </div>

                <div className="border border-gray-100 rounded-lg overflow-hidden mb-5">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Producto</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Stock antes</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Cambio</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Stock después</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {resumen.map((r, i) => (
                                <tr key={i}>
                                    <td className="px-3 py-2 text-gray-700 font-medium text-xs">{r.nombre}</td>
                                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{r.antes}</td>
                                    <td className={`px-3 py-2 text-right font-bold text-xs ${
                                        r.diff > 0 ? "text-green-600" : r.diff < 0 ? "text-red-500" : "text-gray-400"
                                    }`}>
                                        {r.diff > 0 ? `+${r.diff}` : r.diff}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-bold text-xs ${
                                        r.despues < 0 ? "text-red-600" : "text-gray-800"
                                    }`}>
                                        {r.despues}
                                        {r.despues < 0 && " ⚠"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex gap-3">
                    <button onClick={onCancel}
                        className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100
                                   hover:bg-gray-200 rounded-xl transition-colors">
                        Revisar
                    </button>
                    <button onClick={onConfirm}
                        className="flex-1 py-2.5 text-sm font-bold text-white bg-orange-600
                                   hover:bg-orange-700 rounded-xl transition-colors">
                        Confirmar y guardar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
function NewSalePageInner() {
    const router       = useRouter();
    const searchParams = useSearchParams();

    // Modo edición cuando viene ?editId=
    const editId = searchParams.get("editId");
    const isEdit = !!editId;

    const [loading,      setLoading]      = useState(false);
    const [loadingEdit,  setLoadingEdit]  = useState(isEdit);
    const [error,        setError]        = useState("");
    const [products,     setProducts]     = useState<any[]>([]);
    const [clientes,     setClientes]     = useState<any[]>([]);
    const [confirmModal, setConfirmModal] = useState<any[] | null>(null);

    const [formData, setFormData] = useState({
        referencia: "",
        clienteId:  "",
        tipo:       "VENTA",
    });

    const [detalles, setDetalles] = useState<any[]>([
        { productoId: "", cantidad: 1, precioUnitario: 0 }
    ]);

    // Stock original de los detalles antes de editar (para calcular diff)
    const [originalDetalles, setOriginalDetalles] = useState<any[]>([]);

    const esAjuste         = formData.tipo === "AJUSTE_NEGATIVO";
    const clienteRequerido = formData.tipo === "VENTA";

    // ── Cargar productos, clientes y (si edición) datos de la salida ─────────
    useEffect(() => {
        const init = async () => {
            try {
                const [prods, clients] = await Promise.all([
                    fetchApi("/products"),
                    fetchApi("/clients"),
                ]);
                setProducts(prods);
                setClientes(clients);

                // Preseleccionar producto desde ?productoId=
                const productoId = searchParams.get("productoId");
                if (productoId && !isEdit) {
                    const prod = prods.find((p: any) => p.id === productoId);
                    setDetalles([{
                        productoId,
                        cantidad: 1,
                        precioUnitario: prod ? Number(prod.ultimoPrecioVenta ?? 0) : 0,
                    }]);
                }

                // Modo edición: cargar datos de la salida existente
                if (isEdit && editId) {
                    const salida = await fetchApi(`/sales/${editId}`);
                    setFormData({
                        referencia: salida.referencia || "",
                        clienteId:  salida.clienteId  || "",
                        tipo:       salida.tipo,
                    });
                    const dets = salida.detalles.map((d: any) => ({
                        productoId:     d.productoId,
                        cantidad:       d.cantidad,
                        precioUnitario: Number(d.precioUnitario),
                    }));
                    setDetalles(dets);
                    setOriginalDetalles(dets);
                }
            } catch {
                setError("Error al cargar datos");
            } finally {
                setLoadingEdit(false);
            }
        };
        init();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            if (name === "tipo" && value === "AJUSTE_NEGATIVO") next.clienteId = "";
            return next;
        });
    };

    const handleDetalleChange = (index: number, field: string, value: string | number) => {
        const newDetalles = [...detalles];
        if (field === "productoId") {
            const prod = products.find(p => p.id === value);
            newDetalles[index].precioUnitario = prod
                ? (esAjuste ? Number(prod.costo ?? 0) : Number(prod.precioVenta ?? 0))
                : 0;
        }
        newDetalles[index][field] = value;
        setDetalles(newDetalles);
    };

    const addLinea    = () => setDetalles([...detalles, { productoId: "", cantidad: 1, precioUnitario: 0 }]);
    const removeLinea = (i: number) => {
        if (detalles.length > 1) setDetalles(detalles.filter((_, idx) => idx !== i));
    };

    const total = detalles.reduce((acc, d) => acc + Number(d.precioUnitario) * Number(d.cantidad), 0);

    // ── Calcular resumen de impacto en stock (para modal de confirmación) ─────
    const calcularResumenStock = () => {
        // Mapa: productoId → { nombre, cantOriginal, cantNueva }
        const mapa: Record<string, { nombre: string; stockActual: number; cantOriginal: number; cantNueva: number }> = {};

        // Stock original contribuido a este mapa
        for (const d of originalDetalles) {
            const prod = products.find(p => p.id === d.productoId);
            if (!mapa[d.productoId]) {
                mapa[d.productoId] = {
                    nombre:      prod?.nombre || d.productoId,
                    stockActual: prod?.stock  ?? 0,
                    cantOriginal: 0,
                    cantNueva:    0,
                };
            }
            mapa[d.productoId].cantOriginal += Number(d.cantidad);
        }

        for (const d of detalles) {
            if (!d.productoId) continue;
            const prod = products.find(p => p.id === d.productoId);
            if (!mapa[d.productoId]) {
                mapa[d.productoId] = {
                    nombre:      prod?.nombre || d.productoId,
                    stockActual: prod?.stock  ?? 0,
                    cantOriginal: 0,
                    cantNueva:    0,
                };
            }
            mapa[d.productoId].cantNueva += Number(d.cantidad);
        }

        return Object.values(mapa).map(r => {
            // El stock "antes" desde perspectiva del usuario es el actual + la salida original ya aplicada
            const stockAntes   = r.stockActual + r.cantOriginal;
            const stockDespues = stockAntes - r.cantNueva;
            const diff         = r.cantOriginal - r.cantNueva; // positivo = se devuelve stock, negativo = sale más
            return {
                nombre:  r.nombre,
                antes:   stockAntes,
                despues: stockDespues,
                diff,
            };
        }).filter(r => r.diff !== 0); // solo mostrar los que cambian
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (clienteRequerido && !formData.clienteId) {
            setError("Debes seleccionar un cliente para registrar una salida.");
            return;
        }
        if (detalles.some(d => !d.productoId || Number(d.cantidad) <= 0)) {
            setError("Por favor completa correctamente todas las líneas de productos.");
            return;
        }

        // En edición: mostrar modal de confirmación de stock
        if (isEdit) {
            const resumen = calcularResumenStock();
            if (resumen.length > 0) {
                setConfirmModal(resumen);
                return;
            }
        }

        await guardar();
    };

    const guardar = async () => {
        setLoading(true);
        setConfirmModal(null);
        try {
            const payload = {
                tipo:       formData.tipo,
                referencia: formData.referencia,
                clienteId:  formData.clienteId || undefined,
                detalles:   detalles.map(d => ({
                    productoId:     d.productoId,
                    cantidad:       Number(d.cantidad),
                    precioUnitario: Number(d.precioUnitario),
                })),
                total,
            };

            if (isEdit && editId) {
                await fetchApi(`/sales/${editId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
            } else {
                await fetchApi("/sales", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
            }

            router.push("/dashboard/sales");
            router.refresh();
        } catch (err: any) {
            setError(err.message || `Error al ${isEdit ? "editar" : "crear"} la salida`);
            setLoading(false);
        }
    };

    if (loadingEdit) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                Cargando datos de la salida...
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => router.back()}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50
                               transition-colors text-gray-600">
                    <ArrowLeft size={20}/>
                </button>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold text-gray-900">
                            {isEdit ? "Editar Salida" : "Nueva Salida"}
                        </h1>
                        {isEdit && (
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-orange-100
                                             text-orange-700 text-xs font-semibold rounded-full">
                                <Pencil size={11}/> Editando
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                        {isEdit
                            ? "Modifica los datos de esta salida. El stock se recalculará automáticamente."
                            : esAjuste
                                ? "Registra un ajuste negativo de inventario."
                                : "Registra una salida de inventario o ajuste de baja."}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 flex items-center gap-3">
                    <span className="font-semibold">Error:</span> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* ── Información General ── */}
                <Card>
                    <CardHeader title="Información General"/>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Tipo de movimiento */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Tipo de movimiento</label>
                            <select name="tipo" value={formData.tipo} onChange={handleChange}
                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg
                                           focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                                {TIPOS_SALIDA.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Referencia */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Referencia (Folio/Ticket) *
                            </label>
                            <input required type="text" name="referencia"
                                value={formData.referencia} onChange={handleChange}
                                placeholder={esAjuste ? "Ej: AJUSTE-2026-001" : "Ej: SALIDA-0001"}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                                           focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                            />
                        </div>

                        {/* Cliente — solo para Salida */}
                        {!esAjuste && (
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                    <UserCircle2 size={15} className="text-gray-400"/>
                                    Cliente
                                    <span className="text-red-500 text-xs font-normal ml-1">* obligatorio</span>
                                </label>
                                <select name="clienteId" value={formData.clienteId}
                                    onChange={handleChange} required
                                    className={`w-full px-4 py-2 bg-white border rounded-lg
                                               focus:outline-none focus:ring-2 focus:ring-orange-500/20
                                               ${!formData.clienteId
                                                   ? "border-orange-300 bg-orange-50/30"
                                                   : "border-gray-200"}`}>
                                    <option value="">— Selecciona un cliente *</option>
                                    {clientes.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                                {!formData.clienteId && (
                                    <p className="text-xs text-orange-500">
                                        Debes seleccionar un cliente para registrar esta salida.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Nota para ajuste negativo */}
                        {esAjuste && (
                            <div className="md:col-span-2 rounded-lg p-3 text-sm flex items-start gap-2
                                            bg-purple-50 text-purple-700 border border-purple-100">
                                <span className="font-bold text-base leading-none">−</span>
                                <span>Ajuste negativo: reduce el stock sin registrar una salida formal.</span>
                            </div>
                        )}

                        {/* Aviso edición */}
                        {isEdit && (
                            <div className="md:col-span-2 rounded-lg p-3 text-sm flex items-start gap-2
                                            bg-amber-50 text-amber-700 border border-amber-100">
                                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0"/>
                                <span>
                                    Estás editando una salida existente. Al guardar, el stock se revertirá y
                                    se reaplicará con las nuevas cantidades. Se te pedirá confirmación si
                                    hay cambios en el stock.
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Productos ── */}
                <Card>
                    <CardHeader
                        title="Productos"
                        subtitle="Selecciona los artículos y cantidades a descontar."
                    />
                    <CardContent className="space-y-4">
                        <div className="hidden sm:grid grid-cols-12 gap-4 pb-2 border-b border-gray-100
                                        text-sm font-semibold text-gray-500">
                            <div className="col-span-5">Producto</div>
                            <div className="col-span-2">{esAjuste ? "Costo unit." : "Precio unit."}</div>
                            <div className="col-span-2">Cantidad</div>
                            <div className="col-span-2 text-right">Subtotal</div>
                            <div className="col-span-1"></div>
                        </div>

                        {detalles.map((detalle, index) => (
                            <div key={index} className="grid grid-cols-12 gap-4 items-center mb-4 sm:mb-0">
                                <div className="col-span-12 sm:col-span-5">
                                    <select required value={detalle.productoId}
                                        onChange={e => handleDetalleChange(index, "productoId", e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg
                                                   focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                                        <option value="">— Selecciona producto</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.sku} - {p.nombre} (Stock: {p.stock || 0})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                        <input type="number" step="0.01" min="0"
                                            value={detalle.precioUnitario}
                                            onChange={e => handleDetalleChange(index, "precioUnitario", e.target.value)}
                                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg
                                                       bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <input type="number" min="1" required value={detalle.cantidad}
                                        onChange={e => handleDetalleChange(index, "cantidad", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg
                                                   focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>
                                <div className="col-span-10 sm:col-span-2 text-right font-bold text-gray-700">
                                    ${(Number(detalle.precioUnitario) * Number(detalle.cantidad)).toFixed(2)}
                                </div>
                                <div className="col-span-2 sm:col-span-1 flex justify-end">
                                    <button type="button" onClick={() => removeLinea(index)}
                                        disabled={detalles.length === 1}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg
                                                   disabled:opacity-30 transition-colors">
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                            <button type="button" onClick={addLinea}
                                className="flex items-center gap-2 px-4 py-2 text-orange-600
                                           hover:bg-orange-50 font-medium rounded-lg transition-colors">
                                <Plus size={18}/> Añadir Línea
                            </button>
                            <div className="text-right">
                                <span className="text-gray-500 mr-4">Total Salida:</span>
                                <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Acciones */}
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => router.back()}
                        className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700
                                   font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white
                                   font-semibold rounded-lg hover:bg-orange-700 transition-colors
                                   disabled:opacity-70 shadow-sm">
                        {loading ? "Guardando..." : (
                            <>
                                {isEdit ? <Pencil size={18}/> : <Save size={18}/>}
                                {isEdit
                                    ? "Guardar cambios"
                                    : esAjuste ? "Registrar Ajuste" : "Registrar Salida"}
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Modal confirmación de stock */}
            {confirmModal && (
                <ConfirmStockModal
                    resumen={confirmModal}
                    onConfirm={guardar}
                    onCancel={() => setConfirmModal(null)}
                />
            )}
        </div>
    );
}

export default function NewSalePage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                Cargando...
            </div>
        }>
            <NewSalePageInner />
        </Suspense>
    );
}
