"use client";

import { useEffect, useState } from 'react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { Package, AlertTriangle, DollarSign, ArrowUpCircle, ArrowDownCircle, RotateCcw, Zap } from 'lucide-react';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

function timeAgo(dateStr: string) {
    const date = new Date(dateStr);
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
    // If today, show time
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return `hoy ${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function tipoColor(tipo: string) {
    if (tipo === 'ENTRADA') return 'bg-green-100 text-green-700';
    if (tipo === 'SALIDA') return 'bg-red-100 text-red-700';
    if (tipo === 'AJUSTE_POSITIVO') return 'bg-blue-100 text-blue-700';
    return 'bg-orange-100 text-orange-700';
}

function tipoLabel(tipo: string) {
    if (tipo === 'ENTRADA') return 'Entrada';
    if (tipo === 'SALIDA') return 'Salida';
    if (tipo === 'AJUSTE_POSITIVO') return 'Ajuste +';
    return 'Ajuste -';
}

export default function DashboardPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [prods, movs] = await Promise.all([
                    fetchApi('/products'),
                    fetchApi('/inventory/movements')
                ]);
                setProducts(prods);
                setMovements(movs);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // ── Stats ──────────────────────────────────────────────────────
    // Valor inventario = Σ(entradas×costo) - Σ(salidas×costo) sobre TODOS los movimientos
    // Misma fórmula que la gráfica "Valor en almacén" → ambos muestran el mismo número
    const totalValue = movements.reduce((a, m) => {
        const qty = Number(m.cantidad || 0);
        const costo = Number(m.costoUnitario || 0);
        if (['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)) return a + qty * costo;
        if (['SALIDA','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento))  return a - qty * costo;
        return a;
    }, 0);
    const lowStockProducts = products.filter(p => p.stock <= p.stockMinimo);
    const categories = new Set(products.map(p => p.categoria?.nombre).filter(Boolean)).size;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const movsHoy = movements.filter(m => new Date(m.fecha) >= startOfDay);
    const movsEsteMes = movements.filter(m => new Date(m.fecha) >= startOfMonth);

    const entradasHoy = movsHoy.filter(m => ['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento)).reduce((a, m) => a + m.cantidad, 0);
    const salidasHoy = movsHoy.filter(m => ['SALIDA', 'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)).reduce((a, m) => a + m.cantidad, 0);
    const entradasMes = movsEsteMes.filter(m => ['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento)).reduce((a, m) => a + m.cantidad, 0);
    const salidasMes = movsEsteMes.filter(m => ['SALIDA', 'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)).reduce((a, m) => a + m.cantidad, 0);

    const totalStock = products.reduce((a, p) => a + p.stock, 0);
    const rotacion = totalStock > 0 ? ((salidasMes / totalStock) * 100).toFixed(1) : '0.0';

    // Top 5 productos más movidos este mes
    const salesByProduct: Record<string, { nombre: string; stock: number; salidas: number }> = {};
    movsEsteMes.filter(m => ['SALIDA', 'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)).forEach(m => {
        const nombre = m.producto?.nombre || 'Desconocido';
        if (!salesByProduct[nombre]) salesByProduct[nombre] = { nombre, stock: 0, salidas: 0 };
        salesByProduct[nombre].salidas += m.cantidad;
    });
    products.forEach(p => {
        if (salesByProduct[p.nombre]) salesByProduct[p.nombre].stock = p.stock;
    });
    const topProductos = Object.values(salesByProduct).sort((a, b) => b.salidas - a.salidas).slice(0, 5);
    const maxSalidas = topProductos.length > 0 ? topProductos[0].salidas : 1;

    const recentMovements = movements.slice(0, 8);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Resumen General</h1>
                <div className="flex gap-2">
                    <Link href="/dashboard/purchases/new" className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                        <ArrowUpCircle size={16} /> Nueva Entrada
                    </Link>
                    <Link href="/dashboard/sales/new" className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                        <ArrowDownCircle size={16} /> Registrar Salida
                    </Link>
                </div>
            </div>

            {/* KPI Cards — 6 con bordes y sombra */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-500 font-medium">Valor inventario</p>
                            <InfoTooltip text="Σ(cantidad × costoUnitario) de todas las entradas − Σ(cantidad × costoUnitario) de todas las salidas. Representa el costo real del stock físico actual." />
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg"><DollarSign size={16} className="text-blue-600" /></div>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{loading ? '...' : `$${totalValue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}</p>
                    <p className="text-xs text-gray-400 mt-2">Costo total en almacén</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-500 font-medium">Total productos</p>
                            <InfoTooltip text="Número de SKUs activos en el catálogo. No incluye productos marcados como inactivos." />
                        </div>
                        <div className="p-2 bg-purple-50 rounded-lg"><Package size={16} className="text-purple-600" /></div>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{loading ? '...' : products.length}</p>
                    <p className="text-xs text-gray-400 mt-2">{loading ? '...' : `${categories} categorías activas`}</p>
                </div>

                <div className={`rounded-xl border shadow-sm hover:shadow-md transition-shadow p-5 ${lowStockProducts.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-medium ${lowStockProducts.length > 0 ? 'text-orange-600' : 'text-gray-500'}`}>Stock bajo mínimo</p>
                            <InfoTooltip text="Productos donde stock actual ≤ stock mínimo definido en el catálogo. Requieren reabastecimiento." position="top" />
                        </div>
                        <div className={`p-2 rounded-lg ${lowStockProducts.length > 0 ? 'bg-orange-100' : 'bg-gray-100'}`}>
                            <AlertTriangle size={16} className={lowStockProducts.length > 0 ? 'text-orange-500' : 'text-gray-400'} />
                        </div>
                    </div>
                    <p className={`text-3xl font-bold ${lowStockProducts.length > 0 ? 'text-orange-600' : 'text-gray-800'}`}>
                        {loading ? '...' : `${lowStockProducts.length} productos`}
                    </p>
                    <Link href="/dashboard/products" className={`text-xs mt-2 inline-block hover:underline ${lowStockProducts.length > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {lowStockProducts.length > 0 ? 'Ver detalles →' : 'Todo en orden'}
                    </Link>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-500 font-medium">Entradas hoy</p>
                            <InfoTooltip text="Suma de unidades de movimientos tipo ENTRADA y AJUSTE_POSITIVO registrados hoy. El acumulado del mes aparece abajo." />
                        </div>
                        <div className="p-2 bg-green-50 rounded-lg"><ArrowUpCircle size={16} className="text-green-600" /></div>
                    </div>
                    <p className="text-3xl font-bold text-green-600">{loading ? '...' : `+${entradasHoy}`}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        +{entradasMes} este mes
                    </span>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-500 font-medium">Salidas hoy</p>
                            <InfoTooltip text="Suma de unidades de movimientos tipo SALIDA y AJUSTE_NEGATIVO registrados hoy. El acumulado del mes aparece abajo." />
                        </div>
                        <div className="p-2 bg-red-50 rounded-lg"><ArrowDownCircle size={16} className="text-red-500" /></div>
                    </div>
                    <p className="text-3xl font-bold text-red-500">{loading ? '...' : `-${salidasHoy}`}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold rounded-full">
                        -{salidasMes} este mes
                    </span>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-500 font-medium">Rotación mensual</p>
                            <InfoTooltip text="(Salidas del mes ÷ Stock total actual) × 100. Indica qué porcentaje del inventario rotó este mes. Un valor alto significa que vendes rápido." position="top" />
                        </div>
                        <div className="p-2 bg-teal-50 rounded-lg"><RotateCcw size={16} className="text-teal-600" /></div>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{loading ? '...' : `${rotacion}%`}</p>
                    <p className="text-xs text-gray-400 mt-2">Salidas / stock total</p>
                </div>

            </div>

            {/* Gráfica */}
            <AnalyticsChart />

            {/* Top productos + Acciones + Actividad */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Top 5 con barras de progreso */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-base font-semibold text-gray-800">Top productos · este mes</h2>
                        <Link href="/dashboard/products" className="text-xs text-blue-500 hover:underline">Ver todos →</Link>
                    </div>
                    {loading ? (
                        <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
                    ) : topProductos.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">Sin movimientos este mes.</p>
                    ) : (
                        <div className="space-y-3">
                            {topProductos.map((p, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-gray-800 font-medium truncate max-w-[200px]">{p.nombre}</span>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="text-xs text-gray-400">stock: {p.stock}</span>
                                            <span className="text-sm font-bold text-red-500">-{p.salidas}</span>
                                        </div>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-400 rounded-full transition-all duration-500"
                                            style={{ width: `${(p.salidas / maxSalidas) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4">
                    {/* Acciones rápidas */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <h2 className="text-base font-semibold text-gray-800 mb-3">Acciones rápidas</h2>
                        <div className="grid grid-cols-2 gap-2">
                            <Link href="/dashboard/purchases/new" className="flex items-center gap-2 px-3 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors">
                                <ArrowUpCircle size={15} /> Nueva entrada
                            </Link>
                            <Link href="/dashboard/sales/new" className="flex items-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors">
                                <ArrowDownCircle size={15} /> Registrar salida
                            </Link>
                            <Link href="/dashboard/products/new" className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors">
                                <Package size={15} /> Nuevo producto
                            </Link>
                            <Link href="/dashboard/reports" className="flex items-center gap-2 px-3 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-medium transition-colors">
                                <Zap size={15} /> Ver reportes
                            </Link>
                        </div>
                    </div>

                    {/* Última actividad con hora exacta */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex-1">
                        <h2 className="text-base font-semibold text-gray-800 mb-3">Última actividad</h2>
                        {loading ? (
                            <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
                        ) : recentMovements.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">Sin movimientos recientes.</p>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {recentMovements.map((mov, i) => (
                                    <div key={mov.id || i} className="flex items-center justify-between py-2.5">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-800 truncate">{mov.producto?.nombre || 'Desconocido'}</p>
                                            <p className="text-xs text-gray-400 truncate">{mov.motivo || mov.referencia || '—'}</p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${tipoColor(mov.tipoMovimiento)}`}>
                                                {tipoLabel(mov.tipoMovimiento)}
                                            </span>
                                            <span className={`text-sm font-bold w-8 text-right ${['ENTRADA','AJUSTE_POSITIVO'].includes(mov.tipoMovimiento) ? 'text-green-600' : 'text-red-500'}`}>
                                                {['ENTRADA','AJUSTE_POSITIVO'].includes(mov.tipoMovimiento) ? '+' : '-'}{mov.cantidad}
                                            </span>
                                            <span className="text-xs text-gray-400 w-20 text-right">{timeAgo(mov.fecha)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
