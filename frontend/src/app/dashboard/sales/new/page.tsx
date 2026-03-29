"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Save, ArrowLeft, Plus, Trash2, UserCircle2 } from "lucide-react";
import { fetchApi } from "@/lib/api";

// Tipos de salida disponibles y sus labels para el usuario
const TIPOS_SALIDA = [
    { value: "VENTA",           label: "Salida"            },
    { value: "CONSUMO_INTERNO", label: "Consumo interno"   },
    { value: "PERDIDA",         label: "Pérdida / Merma"   },
    { value: "AJUSTE_NEGATIVO", label: "Ajuste (−) — baja manual" },
];

// Para SALIDA (VENTA) el cliente es obligatorio; para los demás no aplica
const TIPOS_REQUIEREN_CLIENTE = ["VENTA"];

function NewSalePageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState("");
    const [products,  setProducts]  = useState<any[]>([]);
    const [clientes,  setClientes]  = useState<any[]>([]);

    const [formData, setFormData] = useState({
        referencia: "",
        clienteId:  "",
        tipo:       "VENTA",
        estado:     "COMPLETADA",
    });

    const [detalles, setDetalles] = useState<any[]>([
        { productoId: "", cantidad: 1, precioUnitario: 0 }
    ]);

    // ¿El tipo seleccionado requiere cliente?
    const clienteRequerido = TIPOS_REQUIEREN_CLIENTE.includes(formData.tipo);
    // Los ajustes no manejan precio de venta
    const esAjuste = formData.tipo === "AJUSTE_NEGATIVO";

    useEffect(() => {
        Promise.all([fetchApi('/products'), fetchApi('/clients')])
            .then(([prods, clients]) => {
                setProducts(prods);
                setClientes(clients);
                // Preseleccionar producto si viene de ?productoId=
                const productoId = searchParams.get('productoId');
                if (productoId) {
                    const prod = prods.find((p: any) => p.id === productoId);
                    setDetalles([{
                        productoId,
                        cantidad: 1,
                        precioUnitario: prod ? Number(prod.ultimoPrecioVenta ?? 0) : 0,
                    }]);
                }
            })
            .catch(() => setError("Error al cargar productos"));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            // Si cambia a un tipo que no requiere cliente, limpiar selección
            if (name === "tipo" && !TIPOS_REQUIEREN_CLIENTE.includes(value)) {
                next.clienteId = "";
            }
            return next;
        });
    };

    const handleDetalleChange = (index: number, field: string, value: string | number) => {
        const newDetalles = [...detalles];
        if (field === "productoId") {
            const prod = products.find(p => p.id === value);
            // Solo prellenar precio en ventas; en ajustes se usa el costo
            newDetalles[index].precioUnitario = prod
                ? (esAjuste ? (prod.costo ?? 0) : (prod.precioVenta ?? 0))
                : 0;
        }
        newDetalles[index][field] = value;
        setDetalles(newDetalles);
    };

    const addLinea = () => {
        setDetalles([...detalles, { productoId: "", cantidad: 1, precioUnitario: 0 }]);
    };

    const removeLinea = (index: number) => {
        if (detalles.length > 1) setDetalles(detalles.filter((_, i) => i !== index));
    };

    const total = detalles.reduce(
        (acc, d) => acc + Number(d.precioUnitario) * Number(d.cantidad), 0
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            // Validación: cliente obligatorio para VENTA
            if (clienteRequerido && !formData.clienteId) {
                throw new Error("Debes seleccionar un cliente para registrar una salida por venta.");
            }
            // Validación: líneas de productos completas
            if (detalles.some(d => !d.productoId || Number(d.cantidad) <= 0)) {
                throw new Error("Por favor completa correctamente todas las líneas de productos.");
            }

            const processedDetalles = detalles.map(d => ({
                productoId:     d.productoId,
                cantidad:       Number(d.cantidad),
                precioUnitario: Number(d.precioUnitario),
            }));

            await fetchApi("/sales", {
                method: "POST",
                body: JSON.stringify({
                    tipo:       formData.tipo,
                    referencia: formData.referencia,
                    clienteId:  formData.clienteId || undefined,
                    detalles:   processedDetalles,
                    total,
                }),
            });

            router.push("/dashboard/sales");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Error al crear la salida");
            setLoading(false);
        }
    };

    // Cliente seleccionado (para mostrar nombre en el label)
    const clienteSeleccionado = clientes.find(c => c.id === formData.clienteId);

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.back()}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
                    <ArrowLeft size={20}/>
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Nueva Salida</h1>
                    <p className="text-sm text-gray-500 mt-1">Registra una salida de inventario o ajuste de baja.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 flex items-center gap-3">
                    <span className="font-semibold">Error:</span> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* ── Información General ──────────────────────────────────── */}
                <Card>
                    <CardHeader title="Información General"/>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Tipo — va primero para que el resto del form reaccione */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Tipo de movimiento
                            </label>
                            <select
                                name="tipo"
                                value={formData.tipo}
                                onChange={handleChange}
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
                            <input
                                required
                                type="text"
                                name="referencia"
                                value={formData.referencia}
                                onChange={handleChange}
                                placeholder={esAjuste ? "Ej: AJUSTE-2026-001" : "Ej: SALIDA-0001"}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                                           focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                            />
                        </div>

                        {/* Cliente — solo visible (y obligatorio) cuando tipo === VENTA */}
                        {formData.tipo === "VENTA" && (
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                <UserCircle2 size={15} className="text-gray-400"/>
                                Cliente
                                {clienteRequerido
                                    ? <span className="text-red-500 text-xs font-normal ml-1">* obligatorio para ventas</span>
                                    : <span className="text-gray-400 text-xs font-normal ml-1">(opcional)</span>
                                }
                            </label>
                            <select
                                name="clienteId"
                                value={formData.clienteId}
                                onChange={handleChange}
                                required={clienteRequerido}
                                className={`w-full px-4 py-2 bg-white border rounded-lg
                                           focus:outline-none focus:ring-2 focus:ring-orange-500/20
                                           ${clienteRequerido && !formData.clienteId
                                               ? 'border-orange-300 bg-orange-50/30'
                                               : 'border-gray-200'}`}>
                                <option value="">
                                    {clienteRequerido ? "— Selecciona un cliente *" : "— Sin cliente (mostrador)"}
                                </option>
                                {clientes.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                            {clienteRequerido && !formData.clienteId && (
                                <p className="text-xs text-orange-500 flex items-center gap-1">
                                    Debes seleccionar un cliente para registrar esta salida.
                                </p>
                            )}
                        </div>
                        )}

                        {/* Nota informativa para ajuste negativo */}
                        {formData.tipo === "AJUSTE_NEGATIVO" && (
                            <div className="md:col-span-2 rounded-lg p-3 text-sm flex items-start gap-2 bg-purple-50 text-purple-700 border border-purple-100">
                                <span className="font-bold text-base leading-none">−</span>
                                <span>Ajuste negativo: reduce el stock sin registrar una salida formal. Útil para correcciones de inventario o bajas por descuento.</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Productos ────────────────────────────────────────────── */}
                <Card>
                    <CardHeader
                        title="Productos"
                        subtitle="Selecciona los artículos y cantidades a descontar."
                    />
                    <CardContent className="space-y-4">
                        {/* Cabecera columnas */}
                        <div className="hidden sm:grid grid-cols-12 gap-4 pb-2 border-b border-gray-100
                                        text-sm font-semibold text-gray-500">
                            <div className="col-span-5">Producto</div>
                            <div className="col-span-2">
                                {esAjuste ? "Costo unit." : "Precio unit."}
                            </div>
                            <div className="col-span-2">Cantidad</div>
                            <div className="col-span-2 text-right">Subtotal</div>
                            <div className="col-span-1"></div>
                        </div>

                        {detalles.map((detalle, index) => (
                            <div key={index} className="grid grid-cols-12 gap-4 items-center mb-4 sm:mb-0">
                                {/* Producto */}
                                <div className="col-span-12 sm:col-span-5">
                                    <select
                                        required
                                        value={detalle.productoId}
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
                                {/* Precio / Costo */}
                                <div className="col-span-6 sm:col-span-2">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={detalle.precioUnitario}
                                            onChange={e => handleDetalleChange(index, "precioUnitario", e.target.value)}
                                            // Solo editable en ventas y ajustes; readonly en consumo/pérdida
                                            readOnly={formData.tipo === "CONSUMO_INTERNO" || formData.tipo === "PERDIDA"}
                                            className={`w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg
                                                ${(formData.tipo === "CONSUMO_INTERNO" || formData.tipo === "PERDIDA")
                                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                    : "bg-gray-50"}`}
                                        />
                                    </div>
                                </div>
                                {/* Cantidad */}
                                <div className="col-span-6 sm:col-span-2">
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={detalle.cantidad}
                                        onChange={e => handleDetalleChange(index, "cantidad", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg
                                                   focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>
                                {/* Subtotal */}
                                <div className="col-span-10 sm:col-span-2 text-right font-bold text-gray-700">
                                    ${(Number(detalle.precioUnitario) * Number(detalle.cantidad)).toFixed(2)}
                                </div>
                                {/* Eliminar */}
                                <div className="col-span-2 sm:col-span-1 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => removeLinea(index)}
                                        disabled={detalles.length === 1}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors">
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Footer tabla */}
                        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                            <button
                                type="button"
                                onClick={addLinea}
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
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700
                                   font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white
                                   font-semibold rounded-lg hover:bg-orange-700 transition-colors
                                   disabled:opacity-70 shadow-sm">
                        {loading ? "Guardando..." : (
                            <><Save size={18}/> Registrar Salida</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function NewSalePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>}>
            <NewSalePageInner />
        </Suspense>
    );
}
