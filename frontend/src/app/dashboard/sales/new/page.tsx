"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Save, ArrowLeft, Plus, Trash2, AlertTriangle, Pencil, HardHat, Wrench } from "lucide-react";
import { fetchApi } from "@/lib/api";

// Solo CONSUMO_INTERNO y AJUSTE_NEGATIVO — Teprex no hace ventas
const TIPOS_CONSUMO = [
    { value: "CONSUMO_INTERNO", label: "Salida de insumo — salida por operación" },
    { value: "AJUSTE_NEGATIVO", label: "Ajuste (−) — baja manual de inventario"   },
];

// ── Modal confirmación de stock ───────────────────────────────────────────────
function ConfirmStockModal({
    resumen, onConfirm, onCancel,
}: {
    resumen: { nombre: string; antes: number; despues: number; diff: number }[];
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle size={20} className="text-amber-600"/></div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Confirmar cambios de stock</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Esta operación ajustará el stock de los siguientes insumos:</p>
                    </div>
                </div>
                <div className="border border-gray-100 rounded-lg overflow-hidden mb-5">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Insumo</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Antes</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Cambio</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Después</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {resumen.map((r, i) => (
                                <tr key={i}>
                                    <td className="px-3 py-2 text-gray-700 font-medium text-xs">{r.nombre}</td>
                                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{r.antes}</td>
                                    <td className={`px-3 py-2 text-right font-bold text-xs ${r.diff < 0 ? "text-red-500" : "text-green-600"}`}>
                                        {r.diff > 0 ? `+${r.diff}` : r.diff}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-bold text-xs ${r.despues < 0 ? "text-red-600" : "text-gray-800"}`}>
                                        {r.despues}{r.despues < 0 && " ⚠"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Revisar</button>
                    <button onClick={onConfirm} className="flex-1 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors">Confirmar</button>
                </div>
            </div>
        </div>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
function ConsumoInsumoPageInner() {
    const router       = useRouter();
    const searchParams = useSearchParams();
    const editId       = searchParams.get("editId");
    const isEdit       = !!editId;

    const [loading,      setLoading]      = useState(false);
    const [loadingEdit,  setLoadingEdit]  = useState(isEdit);
    const [error,        setError]        = useState("");
    const [products,     setProducts]     = useState<any[]>([]);
    const [obras,        setObras]        = useState<any[]>([]);
    const [equipos,      setEquipos]      = useState<any[]>([]);
    const [confirmModal, setConfirmModal] = useState<any[] | null>(null);

    const [formData, setFormData] = useState({
        tipo:      "CONSUMO_INTERNO",
        obraId:    "",
        equipoId:  "",
        referencia: "",
        notas:     "",
    });

    const [detalles, setDetalles] = useState<any[]>([
        { productoId: "", cantidad: 1, precioUnitario: 0 }
    ]);
    const [originalDetalles, setOriginalDetalles] = useState<any[]>([]);

    const esAjuste = formData.tipo === "AJUSTE_NEGATIVO";

    useEffect(() => {
        const init = async () => {
            try {
                const [prods, obrasData, eqData] = await Promise.all([
                    fetchApi("/products"),
                    fetchApi("/obras?status=ACTIVA"),
                    fetchApi("/equipos"),
                ]);
                setProducts(prods);
                setObras(obrasData);
                setEquipos(eqData);

                // Preseleccionar producto desde URL
                const productoId = searchParams.get("productoId");
                if (productoId && !isEdit) {
                    const prod = prods.find((p: any) => p.id === productoId);
                    setDetalles([{
                        productoId,
                        cantidad: 1,
                        precioUnitario: prod ? Number(prod.precioCompra ?? 0) : 0,
                        moneda: prod?.moneda ?? "MXN",  // ← FIX: moneda desde URL
                    }]);
                }

                // Preseleccionar obra desde URL
                const obraId = searchParams.get("obraId");
                if (obraId) setFormData(f => ({ ...f, obraId }));

                // Preseleccionar equipo desde URL
                const equipoId = searchParams.get("equipoId");
                if (equipoId) setFormData(f => ({ ...f, equipoId }));

                // Modo edición
                if (isEdit && editId) {
                    const salida = await fetchApi(`/sales/${editId}`);
                    setFormData({
                        tipo:       salida.tipo,
                        obraId:     salida.obraId    || "",
                        equipoId:   salida.equipoId  || "",
                        referencia: salida.referencia || "",
                        notas:      salida.notas      || "",
                    });
                    const dets = salida.detalles.map((d: any) => ({
                        productoId:     d.productoId,
                        cantidad:       Number(d.cantidad),
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDetalleChange = (index: number, field: string, value: string | number) => {
        const newDetalles = [...detalles];
        if (field === "productoId") {
            const prod = products.find((p: any) => p.id === value);
            newDetalles[index].precioUnitario = prod ? Number(prod.precioCompra ?? 0) : 0;
            // ← FIX: copiar la moneda del producto para mostrar el símbolo correcto
            newDetalles[index].moneda = prod?.moneda ?? "MXN";
        }
        newDetalles[index][field] = value;
        setDetalles(newDetalles);
    };

    const addLinea    = () => setDetalles([...detalles, { productoId: "", cantidad: 1, precioUnitario: 0, moneda: "MXN" }]);
    const removeLinea = (i: number) => { if (detalles.length > 1) setDetalles(detalles.filter((_, idx) => idx !== i)); };

    // Helper: símbolo de moneda por línea
    const simbolo = (moneda?: string) => moneda === "USD" ? "USD $" : "MXN $";

    // Totales separados por moneda para mostrar correctamente
    const totalMXN = detalles.filter(d => (d.moneda ?? "MXN") !== "USD").reduce((acc, d) => acc + Number(d.precioUnitario) * Number(d.cantidad), 0);
    const totalUSD = detalles.filter(d => d.moneda === "USD").reduce((acc, d) => acc + Number(d.precioUnitario) * Number(d.cantidad), 0);
    // costoTotal para el payload (la BD guarda moneda por movimiento)
    const costoTotal = totalMXN + totalUSD;

    const calcularResumenStock = () => {
        const mapa: Record<string, { nombre: string; stockActual: number; cantOriginal: number; cantNueva: number }> = {};
        for (const d of originalDetalles) {
            const prod = products.find((p: any) => p.id === d.productoId);
            if (!mapa[d.productoId]) mapa[d.productoId] = { nombre: prod?.nombre || d.productoId, stockActual: Number(prod?.stockActual ?? 0), cantOriginal: 0, cantNueva: 0 };
            mapa[d.productoId].cantOriginal += Number(d.cantidad);
        }
        for (const d of detalles) {
            if (!d.productoId) continue;
            const prod = products.find((p: any) => p.id === d.productoId);
            if (!mapa[d.productoId]) mapa[d.productoId] = { nombre: prod?.nombre || d.productoId, stockActual: Number(prod?.stockActual ?? 0), cantOriginal: 0, cantNueva: 0 };
            mapa[d.productoId].cantNueva += Number(d.cantidad);
        }
        return Object.values(mapa).map(r => {
            const stockAntes   = r.stockActual + r.cantOriginal;
            const stockDespues = stockAntes - r.cantNueva;
            return { nombre: r.nombre, antes: stockAntes, despues: stockDespues, diff: r.cantOriginal - r.cantNueva };
        }).filter(r => r.diff !== 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (detalles.some((d: any) => !d.productoId || Number(d.cantidad) <= 0)) {
            setError("Completa correctamente todos los insumos.");
            return;
        }
        if (isEdit) {
            const resumen = calcularResumenStock();
            if (resumen.length > 0) { setConfirmModal(resumen); return; }
        }
        await guardar();
    };

    const guardar = async () => {
        setLoading(true);
        setConfirmModal(null);
        try {
            const payload = {
                tipo:       formData.tipo,
                obraId:     formData.obraId    || undefined,
                equipoId:   formData.equipoId  || undefined,
                referencia: formData.referencia || undefined,
                notas:      formData.notas      || undefined,
                detalles:   detalles.map((d: any) => ({
                    productoId:     d.productoId,
                    cantidad:       Number(d.cantidad),
                    precioUnitario: Number(d.precioUnitario),
                })),
                total: costoTotal,
            };
            if (isEdit && editId) {
                await fetchApi(`/sales/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
            } else {
                await fetchApi("/sales", { method: "POST", body: JSON.stringify(payload) });
            }
            router.push("/dashboard/sales");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Error al registrar la salida");
            setLoading(false);
        }
    };

    if (loadingEdit) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => router.back()} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
                    <ArrowLeft size={20}/>
                </button>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold text-gray-900">
                            {isEdit ? "Editar Salida" : "Registrar Salida de Insumos"}
                        </h1>
                        {isEdit && <span className="flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full"><Pencil size={11}/> Editando</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                        {esAjuste ? "Registra una baja manual de inventario." : "Registra la salida de insumos para una obra o equipo."}
                    </p>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* ── Información General ── */}
                <Card>
                    <CardHeader title="Información General"/>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Tipo */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Tipo</label>
                            <select name="tipo" value={formData.tipo} onChange={handleChange}
                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                                {TIPOS_CONSUMO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>

                        {/* Referencia */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Referencia / Folio</label>
                            <input type="text" name="referencia" value={formData.referencia} onChange={handleChange}
                                placeholder="Ej: CONS-2026-001"
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"/>
                        </div>

                        {/* Obra */}
                        {!esAjuste && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                    <HardHat size={15} className="text-gray-400"/> Obra (opcional)
                                </label>
                                <select name="obraId" value={formData.obraId} onChange={handleChange}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                                    <option value="">— Sin vincular a obra —</option>
                                    {obras.map((o: any) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Equipo */}
                        {!esAjuste && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                    <Wrench size={15} className="text-gray-400"/> Equipo (opcional)
                                </label>
                                <select name="equipoId" value={formData.equipoId} onChange={handleChange}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                                    <option value="">— Sin vincular a equipo —</option>
                                    {equipos.map((e: any) => <option key={e.id} value={e.id}>{e.nombre} {e.numeroEconomico ? `(${e.numeroEconomico})` : ""}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Notas */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-semibold text-gray-700">Notas</label>
                            <textarea name="notas" value={formData.notas} onChange={handleChange} rows={2}
                                placeholder="Ej: Cambio de aceite preventivo semana 14"
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none text-sm"/>
                        </div>

                        {/* Aviso ajuste */}
                        {esAjuste && (
                            <div className="md:col-span-2 rounded-lg p-3 text-sm flex items-start gap-2 bg-purple-50 text-purple-700 border border-purple-100">
                                <span className="font-bold text-base leading-none">−</span>
                                <span>Ajuste negativo: reduce el stock sin registrar un consumo formal. Útil para correcciones o mermas.</span>
                            </div>
                        )}

                        {/* Aviso edición */}
                        {isEdit && (
                            <div className="md:col-span-2 rounded-lg p-3 text-sm flex items-start gap-2 bg-amber-50 text-amber-700 border border-amber-100">
                                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0"/>
                                <span>Editando un registro existente. El stock se revertirá y se reaplicará con las nuevas cantidades.</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Insumos ── */}
                <Card>
                    <CardHeader title="Insumos" subtitle="Selecciona los insumos consumidos y sus cantidades."/>
                    <CardContent className="space-y-4">
                        <div className="hidden sm:grid grid-cols-12 gap-4 pb-2 border-b border-gray-100 text-sm font-semibold text-gray-500">
                            <div className="col-span-5">Insumo</div>
                            <div className="col-span-2">Costo unit.</div>
                            <div className="col-span-2">Cantidad</div>
                            <div className="col-span-2 text-right">Subtotal</div>
                            <div className="col-span-1"></div>
                        </div>

                        {detalles.map((detalle: any, index: number) => (
                            <div key={index} className="grid grid-cols-12 gap-4 items-center mb-4 sm:mb-0">
                                <div className="col-span-12 sm:col-span-5">
                                    <select required value={detalle.productoId}
                                        onChange={e => handleDetalleChange(index, "productoId", e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                                        <option value="">— Selecciona insumo</option>
                                        {products.map((p: any) => (
                                            <option key={p.id} value={p.id}>
                                                {p.sku} — {p.nombre} ({p.unidad}) · Stock: {Number(p.stockActual).toFixed(1)}
                                                {p.moneda === "USD" ? " 🇺🇸" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <div className="relative">
                                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold ${detalle.moneda === "USD" ? "text-blue-600" : "text-gray-500"}`}>
                                            {detalle.moneda === "USD" ? "USD" : "MXN"}
                                        </span>
                                        <input type="number" step="0.01" min="0" value={detalle.precioUnitario}
                                            onChange={e => handleDetalleChange(index, "precioUnitario", e.target.value)}
                                            className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"/>
                                    </div>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <input type="number" min="0.01" step="0.01" required value={detalle.cantidad}
                                        onChange={e => handleDetalleChange(index, "cantidad", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"/>
                                </div>
                                <div className={`col-span-10 sm:col-span-2 text-right font-bold text-xs ${detalle.moneda === "USD" ? "text-blue-700" : "text-gray-700"}`}>
                                    {simbolo(detalle.moneda)}{(Number(detalle.precioUnitario) * Number(detalle.cantidad)).toFixed(2)}
                                </div>
                                <div className="col-span-2 sm:col-span-1 flex justify-end">
                                    <button type="button" onClick={() => removeLinea(index)} disabled={detalles.length === 1}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors">
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                            <button type="button" onClick={addLinea}
                                className="flex items-center gap-2 px-4 py-2 text-orange-600 hover:bg-orange-50 font-medium rounded-lg transition-colors">
                                <Plus size={18}/> Añadir insumo
                            </button>
                            <div className="text-right space-y-0.5">
                                <div className="text-gray-500 text-sm mb-1">Costo total:</div>
                                {totalMXN > 0 && (
                                    <div className="text-xl font-bold text-gray-900">MXN ${totalMXN.toFixed(2)}</div>
                                )}
                                {totalUSD > 0 && (
                                    <div className="text-xl font-bold text-blue-700">USD ${totalUSD.toFixed(2)}</div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Acciones */}
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => router.back()}
                        className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-70 shadow-sm">
                        {loading ? "Guardando..." : (
                            <>{isEdit ? <Pencil size={18}/> : <Save size={18}/>} {isEdit ? "Guardar cambios" : esAjuste ? "Registrar Ajuste" : "Registrar Salida"}</>
                        )}
                    </button>
                </div>
            </form>

            {confirmModal && (
                <ConfirmStockModal resumen={confirmModal} onConfirm={guardar} onCancel={() => setConfirmModal(null)}/>
            )}
        </div>
    );
}

export default function ConsumoInsumoPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>}>
            <ConsumoInsumoPageInner />
        </Suspense>
    );
}
