"use client";

import { useEffect, useState, useMemo } from 'react';
import { Search, Plus, X, Building2, Package, Calendar, ChevronRight, AlertCircle } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

interface DetalleCompra {
    id: string;
    productoId: string;
    producto: { nombre: string; sku: string; unidad: string };
    cantidad: number;
    precioUnitario: number | string;
}

interface Compra {
    id: string;
    proveedorId: string;
    proveedor: { nombre: string; telefono?: string; email?: string } | null;
    referencia: string;
    fecha: string;
    total: number | string;
    status: 'PENDIENTE' | 'COMPLETADA' | 'CANCELADA';
    esHuerfana: boolean;
    detalles: DetalleCompra[];
}

const statusConfig = {
    COMPLETADA: { label: 'Completada', cls: 'bg-green-100 text-green-700' },
    PENDIENTE:  { label: 'Pendiente',  cls: 'bg-orange-100 text-orange-700' },
    CANCELADA:  { label: 'Cancelada',  cls: 'bg-red-100 text-red-600' },
};

export default function PurchasesPage() {
    const [compras,   setCompras]   = useState<Compra[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState('');
    const [busqueda,  setBusqueda]  = useState('');
    const [detalle,   setDetalle]   = useState<Compra | null>(null);

    useEffect(() => {
        fetchApi('/purchases')
            .then(setCompras)
            .catch((err: any) => setError(err.message || 'Error al cargar compras'))
            .finally(() => setLoading(false));
    }, []);

    const comprasFiltradas = useMemo(() => {
        if (!busqueda.trim()) return compras;
        const q = busqueda.toLowerCase();
        return compras.filter(c =>
            (c.referencia || '').toLowerCase().includes(q) ||
            (c.proveedor?.nombre || '').toLowerCase().includes(q) ||
            c.detalles?.some(d => d.producto?.nombre?.toLowerCase().includes(q))
        );
    }, [compras, busqueda]);

    // KPIs
    const totalComprado  = compras.reduce((a, c) => a + Number(c.total), 0);
    const totalEntradas  = compras.length;
    const mesActual      = new Date().getMonth();
    const comprasMes     = compras.filter(c => new Date(c.fecha).getMonth() === mesActual).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Compras (Entradas)</h1>
                    <p className="text-sm text-gray-500 mt-1">Historial de órdenes de compra y entradas al inventario.</p>
                </div>
                <Link href="/dashboard/purchases/new"
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                    <Plus size={16}/> Nueva Compra
                </Link>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1">Total órdenes</p>
                    <p className="text-2xl font-bold text-gray-800">{totalEntradas}</p>
                    <p className="text-xs text-gray-400 mt-1">{comprasMes} este mes</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1">Total invertido</p>
                    <p className="text-2xl font-bold text-gray-800">
                        ${totalComprado.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Todas las entradas</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1">Proveedores activos</p>
                    <p className="text-2xl font-bold text-gray-800">
                        {new Set(compras.map(c => c.proveedorId)).size}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Con al menos 1 compra</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 flex items-center gap-2">
                    <AlertCircle size={16}/> {error}
                </div>
            )}

            {/* Tabla */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar por referencia, proveedor o producto..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        {busqueda && (
                            <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={14}/>
                            </button>
                        )}
                    </div>
                    <p className="text-sm text-gray-400 whitespace-nowrap">
                        {comprasFiltradas.length} {comprasFiltradas.length === 1 ? 'resultado' : 'resultados'}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                {['Referencia', 'Proveedor', 'Fecha', 'Productos', 'Total', 'Estado', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">Cargando compras...</td></tr>
                            ) : comprasFiltradas.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <Package size={32} className="mx-auto text-gray-300 mb-2"/>
                                        <p className="text-gray-500 font-medium">{busqueda ? 'Sin resultados para esta búsqueda' : 'No hay compras registradas'}</p>
                                        {!busqueda && (
                                            <p className="text-gray-400 text-sm mt-1">
                                                Las entradas con proveedor se registran aquí automáticamente.
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                comprasFiltradas.map(compra => {
                                    const st = statusConfig[compra.status] ?? statusConfig.COMPLETADA;
                                    const totalItems = compra.detalles?.reduce((a, d) => a + d.cantidad, 0) ?? 0;
                                    return (
                                        <tr key={compra.id}
                                            onClick={() => setDetalle(compra)}
                                            className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                                    {compra.referencia || '—'}
                                                </span>
                                                {compra.esHuerfana && (
                                                    <span className="ml-2 text-xs bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">entrada directa</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="flex items-center gap-1.5 text-sm text-gray-700">
                                                    <Building2 size={13} className="text-blue-400 flex-shrink-0"/>
                                                    {compra.proveedor?.nombre || 'Sin proveedor'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                {new Date(compra.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {compra.detalles?.length ?? 0} {compra.detalles?.length === 1 ? 'producto' : 'productos'} · {totalItems} uds
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-gray-800">
                                                ${Number(compra.total).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${st.cls}`}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 transition-colors"/>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal detalle */}
            {detalle && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetalle(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        {/* Header modal */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between sticky top-0 bg-white rounded-t-2xl z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-lg font-bold text-gray-900">{detalle.referencia || 'Sin referencia'}</span>
                                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusConfig[detalle.status]?.cls}`}>
                                        {statusConfig[detalle.status]?.label}
                                    </span>
                                </div>
                                {detalle.esHuerfana && (
                                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 inline-block">
                                        Entrada directa — registrada desde el producto
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setDetalle(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                                <X size={18}/>
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            {/* Info general */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Building2 size={11}/> Proveedor</p>
                                    <p className="text-sm font-semibold text-gray-800">{detalle.proveedor?.nombre || '—'}</p>
                                    {detalle.proveedor?.telefono && <p className="text-xs text-gray-500 mt-0.5">{detalle.proveedor.telefono}</p>}
                                    {detalle.proveedor?.email   && <p className="text-xs text-gray-500">{detalle.proveedor.email}</p>}
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Calendar size={11}/> Fecha</p>
                                    <p className="text-sm font-semibold text-gray-800">
                                        {new Date(detalle.fecha).toLocaleDateString('es-MX', { dateStyle: 'long' })}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {new Date(detalle.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>

                            {/* Productos */}
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Productos recibidos</p>
                                <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg overflow-hidden">
                                    {detalle.detalles?.map((d, i) => (
                                        <div key={d.id ?? i} className="flex items-center justify-between px-4 py-2.5">
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{d.producto?.nombre}</p>
                                                <p className="text-xs text-gray-400">{d.producto?.sku} · {d.cantidad} {d.producto?.unidad}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-gray-800">
                                                    ${(Number(d.precioUnitario) * d.cantidad).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                                                </p>
                                                <p className="text-xs text-gray-400">${Number(d.precioUnitario).toLocaleString()} c/u</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Total */}
                            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                <span className="text-sm font-semibold text-gray-700">Total facturado</span>
                                <span className="text-xl font-bold text-gray-900">
                                    ${Number(detalle.total).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        <div className="px-6 pb-5">
                            <button onClick={() => setDetalle(null)}
                                className="w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
