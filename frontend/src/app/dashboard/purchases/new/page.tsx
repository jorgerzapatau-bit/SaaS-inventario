"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Save, ArrowLeft, Plus, Trash2, Truck } from "lucide-react";
import { fetchApi } from "@/lib/api";

// Dos tipos de entrada
const TIPOS_ENTRADA = [
    { value: "COMPRA",          label: "Compra — entrada por proveedor" },
    { value: "AJUSTE_POSITIVO", label: "Ajuste (+) — alta manual"       },
];

function NewPurchasePageInner() {
    const router       = useRouter();
    const searchParams = useSearchParams();
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState("");
    const [products,  setProducts]  = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        referencia:  "",
        proveedorId: "",
        tipo:        "COMPRA",
        estado:      "PENDIENTE",
        moneda:      "MXN",
        tipoCambio:  "",
        fecha:       new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    });

    const [detalles, setDetalles] = useState<any[]>([
        { productoId: "", cantidad: 1, precioUnitario: 0, moneda: "MXN" }
    ]);

    const esAjuste          = formData.tipo === "AJUSTE_POSITIVO";
    const proveedorRequerido = formData.tipo === "COMPRA";

    useEffect(() => {
        Promise.all([fetchApi("/products"), fetchApi("/suppliers")])
            .then(([prodData, suppData]) => {
                setProducts(prodData);
                setSuppliers(suppData);
                const productoId = searchParams.get("productoId");
                if (productoId) {
                    const prod = prodData.find((p: any) => p.id === productoId);
                    setDetalles([{
                        productoId,
                        cantidad: 1,
                        precioUnitario: prod ? Number(prod.precioCompra ?? 0) : 0,
                    }]);
                }
            })
            .catch(() => setError("Error al cargar dependencias"));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            // Al cambiar a ajuste, limpiar proveedor y forzar estado COMPLETADA
            if (name === "tipo" && value === "AJUSTE_POSITIVO") {
                next.proveedorId = "";
                next.estado      = "COMPLETADA";
            }
            // Al volver a compra, restaurar estado a PENDIENTE por defecto
            if (name === "tipo" && value === "COMPRA") {
                next.estado = "PENDIENTE";
            }
            return next;
        });
    };

    const handleDetalleChange = (index: number, field: string, value: string | number) => {
        const newDetalles = [...detalles];
        if (field === "productoId") {
            const prod = products.find(p => p.id === value);
            newDetalles[index].precioUnitario = prod ? Number(prod.precioCompra ?? 0) : 0;
            newDetalles[index].moneda = prod?.moneda ?? "MXN";
            newDetalles[index].unidad = prod?.unidad ?? "";
        }
        newDetalles[index][field] = value;
        setDetalles(newDetalles);
    };

    const addLinea    = () => setDetalles([...detalles, { productoId: "", cantidad: 1, precioUnitario: 0 }]);
    const removeLinea = (i: number) => { if (detalles.length > 1) setDetalles(detalles.filter((_, idx) => idx !== i)); };

    const total = detalles.reduce((acc, d) => acc + Number(d.precioUnitario) * Number(d.cantidad), 0);

    const handleSubmit = async () => {
        console.log("🟡 handleSubmit iniciado");
        setLoading(true);
        setError("");
        try {
            // Validaciones manuales
            if (!formData.referencia?.trim())
                throw new Error("La referencia (Folio/Ticket) es obligatoria.");
            if (!formData.fecha)
                throw new Error("La fecha de operación es obligatoria.");
            if (proveedorRequerido && !formData.proveedorId)
                throw new Error("Debes seleccionar un proveedor para registrar una compra.");
            if (detalles.some(d => !d.productoId || Number(d.cantidad) <= 0))
                throw new Error("Por favor completa correctamente todas las líneas.");

            const payload = {
                tipo:        formData.tipo,
                referencia:  formData.referencia || undefined,
                proveedorId: formData.proveedorId || undefined,
                moneda:      formData.moneda,
                tipoCambio:  formData.tipoCambio ? Number(formData.tipoCambio) : null,
                fecha:       formData.fecha ? new Date(formData.fecha + "T12:00:00Z").toISOString() : undefined,
                detalles:    detalles.map(d => ({
                    productoId:     d.productoId,
                    cantidad:       Number(d.cantidad),
                    precioUnitario: Number(d.precioUnitario),
                    moneda:         d.moneda ?? formData.moneda,
                })),
                total,
                status: esAjuste ? "COMPLETADA" : formData.estado,
            };

            console.log("🟡 Payload a enviar:", JSON.stringify(payload, null, 2));

            // Llamada directa con fetch para ver la respuesta RAW
            const token = localStorage.getItem("token");
            const userStr = localStorage.getItem("user");
            const empresaId = userStr ? JSON.parse(userStr).empresaId : null;

            console.log("🟡 Token existe:", !!token);
            console.log("🟡 EmpresaId:", empresaId);

            const rawRes = await fetch("/api/purchases", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                    ...(empresaId ? { "X-Empresa-Id": empresaId } : {}),
                },
                body: JSON.stringify(payload),
            });

            const rawText = await rawRes.text();
            console.log("🔴 Status:", rawRes.status);
            console.log("🔴 Respuesta RAW:", rawText);
            console.log("🔴 Content-Type:", rawRes.headers.get("content-type"));

            if (!rawRes.ok) {
                let msg = "Error al registrar la entrada";
                try { msg = JSON.parse(rawText).error || msg; } catch {}
                throw new Error(`[${rawRes.status}] ${msg}`);
            }

            console.log("✅ Guardado exitoso");
            // Agregamos ?t=timestamp para que searchParams cambie y el useEffect
            // de la lista se vuelva a ejecutar, forzando un nuevo fetch al API.
            window.location.href = `/dashboard/purchases?t=${Date.now()}`;
        } catch (err: any) {
            console.error("🔴 Error capturado:", err);
            setError(err.message || "Error al registrar la entrada");
            setLoading(false);
        }
    };

    const labelBoton = () => {
        if (loading) return "Guardando...";
        if (esAjuste) return "Registrar Ajuste";
        return formData.estado === "COMPLETADA" ? "Guardar y recibir mercancía" : "Guardar orden pendiente";
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => router.back()}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
                    <ArrowLeft size={20}/>
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Nueva Entrada</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {esAjuste
                            ? "Registra un ajuste positivo de inventario."
                            : "Registra la entrada de nuevos productos de tus proveedores al inventario."}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 flex items-center gap-3">
                    <span className="font-semibold">Error:</span> {error}
                </div>
            )}

            <div className="space-y-6">

                {/* ── Información General ── */}
                <Card>
                    <CardHeader title="Información General"/>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Tipo de movimiento */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Tipo de movimiento</label>
                            <select name="tipo" value={formData.tipo} onChange={handleChange}
                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                {TIPOS_ENTRADA.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Referencia — siempre visible */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Referencia (Folio/Ticket) *</label>
                            <input type="text" name="referencia" value={formData.referencia} onChange={handleChange}
                                placeholder={esAjuste ? "Ej: AJUSTE-2026-001" : "Ej: COMPRA-0001"}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>

                        {/* Fecha de operación — siempre visible */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Fecha de operación *</label>
                            <input type="date" name="fecha" value={formData.fecha} onChange={handleChange}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>

                        {/* Proveedor — solo cuando tipo === COMPRA */}
                        {!esAjuste && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                    <Truck size={15} className="text-gray-400"/>
                                    Proveedor
                                    <span className="text-red-500 text-xs font-normal ml-1">* obligatorio</span>
                                </label>
                                <select name="proveedorId" value={formData.proveedorId} onChange={handleChange}
                                    className={`w-full px-4 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20
                                        ${!formData.proveedorId ? "border-blue-300 bg-blue-50/30" : "border-gray-200"}`}>
                                    <option value="">-- Seleccionar Proveedor --</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.nombre}</option>
                                    ))}
                                </select>
                                {!formData.proveedorId && (
                                    <p className="text-xs text-blue-500">Debes seleccionar un proveedor para registrar esta compra.</p>
                                )}
                            </div>
                        )}

                        {/* Estado de la orden — solo cuando tipo === COMPRA */}
                        {!esAjuste && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Estado de la orden</label>
                                <select name="estado" value={formData.estado} onChange={handleChange}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                    <option value="PENDIENTE">Pendiente — orden enviada, mercancía aún no llega</option>
                                    <option value="COMPLETADA">Completada — mercancía recibida, entra al inventario ahora</option>
                                </select>
                                {formData.estado === "COMPLETADA" && (
                                    <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                        ✓ Se generarán entradas en el kardex al guardar.
                                    </p>
                                )}
                                {formData.estado === "PENDIENTE" && (
                                    <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                                        ⏳ El stock no cambia hasta que marques la orden como completada.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Nota — solo para ajuste positivo */}
                        {esAjuste && (
                            <div className="md:col-span-2 rounded-lg p-3 text-sm flex items-start gap-2 bg-green-50 text-green-700 border border-green-100">
                                <span className="font-bold text-base leading-none">+</span>
                                <span>Ajuste positivo: incrementa el stock sin registrar una compra formal. Útil para correcciones de inventario o altas por inventario físico.</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Productos ── */}
                <Card>
                    <CardHeader
                        title={esAjuste ? "Productos" : "Productos Recibidos"}
                        subtitle={esAjuste ? "Selecciona los artículos y cantidades a incrementar." : "Ingresa el detalle de la factura de compra."}
                    />
                    <CardContent className="space-y-4">
                        <div className="hidden sm:grid grid-cols-12 gap-4 pb-2 border-b border-gray-100 text-sm font-semibold text-gray-500">
                            <div className="col-span-5">Producto</div>
                            <div className="col-span-2">Costo Unitario</div>
                            <div className="col-span-2">Cantidad</div>
                            <div className="col-span-2 text-right">Costo Total</div>
                            <div className="col-span-1"></div>
                        </div>

                        {detalles.map((detalle, index) => (
                            <div key={index} className="grid grid-cols-12 gap-4 items-center mb-4 sm:mb-0">
                                <div className="col-span-12 sm:col-span-5">
                                    <select value={detalle.productoId}
                                        onChange={e => handleDetalleChange(index, "productoId", e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                        <option value="">-- Selecciona Producto --</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.sku} - {p.nombre} ({p.unidad})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                        <input type="number" step="0.01" value={detalle.precioUnitario}
                                            onChange={e => handleDetalleChange(index, "precioUnitario", e.target.value)}
                                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <div className="flex items-center gap-1.5">
                                        <input type="number" min="1" value={detalle.cantidad}
                                            onChange={e => handleDetalleChange(index, "cantidad", e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                        {detalle.unidad && (
                                            <span className="shrink-0 px-2 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-md border border-blue-100 uppercase">
                                                {detalle.unidad}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="col-span-10 sm:col-span-2 text-right font-bold text-gray-700">
                                    ${(Number(detalle.precioUnitario) * Number(detalle.cantidad)).toFixed(2)}
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
                                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 font-medium rounded-lg transition-colors">
                                <Plus size={18}/> Añadir Línea
                            </button>
                            <div className="text-right">
                                <span className="text-gray-500 mr-4">Total {esAjuste ? "Ajuste" : "Compra"}:</span>
                                <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
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
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 shadow-sm">
                        {loading ? "Guardando..." : (
                            <><Save size={18}/> {labelBoton()}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function NewPurchasePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>}>
            <NewPurchasePageInner />
        </Suspense>
    );
}
