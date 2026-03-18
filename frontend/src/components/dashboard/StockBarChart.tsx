"use client";

import { useEffect, useState, useRef } from 'react';
import { X, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

const PAGE_SIZE = 30;

interface Product {
    id: string; nombre: string; sku: string; unidad: string;
    stock: number; stockMinimo: number;
}

interface Props {
    products: Product[];
    onClose: () => void;
}

// ── Tooltip personalizado (mismo estilo que AnalyticsChart) ───────────────────
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const stock = payload[0]?.value ?? 0;
    const minimo = payload[1]?.value ?? 0;
    const unidad = payload[0]?.payload?.unidad || '';
    const isLow = stock <= minimo;
    return (
        <div style={{ background: 'white', border: 'none', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '10px 14px', minWidth: 160 }}>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#111827' }}>{label}</p>
            <p style={{ fontSize: 12, color: isLow ? '#ea580c' : '#2563eb', marginBottom: 2 }}>
                Stock: <strong>{stock} {unidad}</strong>
            </p>
            <p style={{ fontSize: 12, color: '#ef4444', marginBottom: isLow ? 6 : 0 }}>
                Mínimo: <strong>{minimo} {unidad}</strong>
            </p>
            {isLow && (
                <p style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', borderRadius: 4, padding: '3px 6px', marginTop: 4 }}>
                    ⚠ Requiere reabastecimiento
                </p>
            )}
        </div>
    );
}

export function StockBarChart({ products, onClose }: Props) {
    const [showAll, setShowAll] = useState(false);
    const [page, setPage] = useState(0);

    // Por defecto: solo críticos ordenados por urgencia (stock/mínimo %)
    const critical = [...products]
        .filter(p => p.stock <= p.stockMinimo)
        .sort((a, b) => (a.stock / Math.max(a.stockMinimo, 1)) - (b.stock / Math.max(b.stockMinimo, 1)));

    const allSorted = [...products]
        .sort((a, b) => (a.stock / Math.max(a.stockMinimo, 1)) - (b.stock / Math.max(b.stockMinimo, 1)));

    const source = showAll ? allSorted : critical;
    const totalPages = Math.ceil(source.length / PAGE_SIZE);
    const pageData = source.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const chartData = pageData.map(p => ({
        name: p.nombre.length > 22 ? p.nombre.slice(0, 20) + '…' : p.nombre,
        stock: p.stock,
        minimo: p.stockMinimo,
        unidad: p.unidad,
        isLow: p.stock <= p.stockMinimo,
    }));

    const chartHeight = Math.max(280, chartData.length * 38 + 60);

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-base font-semibold text-gray-800">Stock actual vs mínimo</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {showAll
                                ? `${source.length} productos · página ${page + 1} de ${totalPages}`
                                : critical.length > 0
                                    ? <span className="text-orange-500 font-medium">{critical.length} productos bajo mínimo</span>
                                    : 'Todos los productos están por encima del mínimo'
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Toggle críticos / todos */}
                        <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
                            <button onClick={() => { setShowAll(false); setPage(0); }}
                                className={`px-3 py-1.5 rounded-md font-medium transition-all ${!showAll ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                {critical.length > 0 && <AlertTriangle size={11} className="inline mr-1" />}
                                Críticos ({critical.length})
                            </button>
                            <button onClick={() => { setShowAll(true); setPage(0); }}
                                className={`px-3 py-1.5 rounded-md font-medium transition-all ${showAll ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                Todos ({products.length})
                            </button>
                        </div>
                        <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Chart */}
                <div className="px-6 py-4" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                    {chartData.length === 0 ? (
                        <div className="py-12 text-center">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <p className="text-sm font-medium text-gray-700">Todo el stock está en orden</p>
                            <p className="text-xs text-gray-400 mt-1">Ningún producto está por debajo del mínimo</p>
                            <button onClick={() => setShowAll(true)} className="mt-3 text-xs text-blue-500 hover:underline">Ver todos los productos →</button>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={chartHeight}>
                            <BarChart
                                data={chartData}
                                layout="vertical"
                                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                <XAxis
                                    type="number"
                                    axisLine={false} tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 11 }}
                                    dx={4}
                                />
                                <YAxis
                                    type="category" dataKey="name"
                                    axisLine={false} tickLine={false}
                                    tick={{ fill: '#374151', fontSize: 11 }}
                                    width={140}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
                                <Legend
                                    wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                                    formatter={(v) => v === 'stock' ? 'Stock actual' : 'Mínimo requerido'}
                                />
                                <Bar dataKey="stock" name="stock" radius={[0, 4, 4, 0]} maxBarSize={20}>
                                    {chartData.map((entry, i) => (
                                        <Cell key={i} fill={entry.isLow ? 'rgba(249,115,22,0.85)' : 'rgba(59,130,246,0.85)'} />
                                    ))}
                                </Bar>
                                <Bar dataKey="minimo" name="minimo" fill="rgba(239,68,68,0.25)" stroke="rgba(239,68,68,0.6)" strokeWidth={1} radius={[0, 4, 4, 0]} maxBarSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Paginación (solo en modo "todos") */}
                {showAll && totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
                            <ChevronLeft size={14} /> Anterior
                        </button>
                        <div className="flex gap-1">
                            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                                const p = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i;
                                return (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={`w-7 h-7 text-xs rounded-md font-medium transition-colors ${page === p ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                                        {p + 1}
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
                            Siguiente <ChevronRight size={14} />
                        </button>
                    </div>
                )}

                {/* Leyenda de colores */}
                <div className="flex gap-4 px-6 pb-4 pt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block"></span>Stock OK</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block"></span>Bajo mínimo</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-200 border border-red-300 inline-block"></span>Mínimo requerido</span>
                </div>
            </div>
        </div>
    );
}
