"use client";

import { useEffect, useState } from 'react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { Package, AlertTriangle, DollarSign, ArrowUpCircle, ArrowDownCircle, RotateCcw, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

function timeAgo(dateStr: string) {
    const date = new Date(dateStr);
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
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

/** Calcula el % de cambio entre valor actual y anterior. */
function calcPct(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
}

/** Chip de variación con flecha + porcentaje */
function DeltaBadge({
    pct,
    label,
}: {
    pct: number | null;
    label?: string;
}) {
    if (pct === null) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                <Minus size={10} />
                Sin datos ant.
            </span>
        );
    }

    const isUp = pct > 0;
    const isNeutral = Math.abs(pct) < 0.05;
    const colorClass = isNeutral
        ? 'bg-gray-100 text-gray-500'
        : isUp
        ? 'bg-green-100 text-green-700'
        : 'bg-red-100 text-red-600';
    const Icon = isNeutral ? Minus : isUp ? TrendingUp : TrendingDown;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
            <Icon size={11} />
            {isNeutral ? '0%' : `${isUp ? '+' : ''}${pct.toFixed(1)}%`}
            {label && <span className="font-normal opacity-75">{label}</span>}
        </span>
    );
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
                    fetchApi('/inventory/movements'),
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

    // ── Períodos ────────────────────────────────────────────────────
    const now = new Date();
    const startOfDay       = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const endOfYesterday   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    // ── Helpers ─────────────────────────────────────────────────────
    const isEntrada   = (m: any) => ['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento);
    const isSalida    = (m: any) => ['SALIDA',  'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento);
    const sumCantidad = (arr: any[]) => arr.reduce((a, m) => a + m.cantidad, 0);

    // ── Valor inventario ────────────────────────────────────────────
    const valorMovimiento = (m: any) => {
        const v = Number(m.cantidad || 0) * Number(m.costoUnitario || 0);
        return isEntrada(m) ? v : -v;
    };
    const totalValue    = movements.reduce((a, m) => a + valorMovimiento(m), 0);
    const prevTotalValue = movements
        .filter(m => new Date(m.fecha) <= endOfPrevMonth)
        .reduce((a, m) => a + valorMovimiento(m), 0);
    const valuePct = calcPct(totalValue, prevTotalValue);

    // ── Total productos ─────────────────────────────────────────────
    const categories = new Set(products.map(p => p.categoria?.nombre).filter(Boolean)).size;
    const productosNuevosMes = products.filter(p => p.createdAt && new Date(p.createdAt) >= startOfMonth).length;

    // ── Stock bajo mínimo ───────────────────────────────────────────
    const lowStockProducts = products.filter(p => p.stock <= p.stockMinimo);

    // ── Entradas / Salidas ──────────────────────────────────────────
    const movsHoy    = movements.filter(m => new Date(m.fecha) >= startOfDay);
    const movsAyer   = movements.filter(m => { const f = new Date(m.fecha); return f >= startOfYesterday && f < endOfYesterday; });
    const movsEsteMes = movements.filter(m => new Date(m.fecha) >= startOfMonth);
    const movsMesAnt  = movements.filter(m => { const f = new Date(m.fecha); return f >= startOfPrevMonth && f <= endOfPrevMonth; });

    const entradasHoy    = sumCantidad(movsHoy.filter(isEntrada));
    const salidasHoy     = sumCantidad(movsHoy.filter(isSalida));
    const entradasAyer   = sumCantidad(movsAyer.filter(isEntrada));
    const salidasAyer    = sumCantidad(movsAyer.filter(isSalida));
    const entradasMes    = sumCantidad(movsEsteMes.filter(isEntrada));
    const salidasMes     = sumCantidad(movsEsteMes.filter(isSalida));
    const entradasMesAnt = sumCantidad(movsMesAnt.filter(isEntrada));
    const salidasMesAnt  = sumCantidad(movsMesAnt.filter(isSalida));

    const entradasHoyPct = calcPct(entradasHoy, entradasAyer);
    const salidasHoyPct  = calcPct(salidasHoy, salidasAyer);
    const entradasMesPct = calcPct(entradasMes, entradasMesAnt);
    const salidasMesPct  = calcPct(salidasMes, salidasMesAnt);

    // ── Rotación ────────────────────────────────────────────────────
    const totalStock   = products.reduce((a, p) => a + p.stock, 0);
    const rotacionNum  = totalStock > 0 ? (salidasMes / totalStock) * 100 : 0;
    const rotacionPrev = totalStock > 0 ? (salidasMesAnt / totalStock) * 100 : 0;
    const rotacion     = rotacionNum.toFixed(1);
    const rotacionPct  = calcPct(rotacionNum, rotacionPrev);

    // ── Top 5 ───────────────────────────────────────────────────────
    const salesByProduct: Record<string, { nombre: string; stock: number; salidas: number }> = {};
    movsEsteMes.filter(isSalida).forEach(m => {
        const nombre = m.producto?.nombre || 'Desconocido';
        if (!salesByProduct[nombre]) salesByProduct[nombre] = { nombre, stock: 0, salidas: 0 };
        salesByProduct[nombre].salidas += m.cantidad;
    });
    products.forEach(p => { if (salesByProduct[p.nombre]) salesByProduct[p.nombre].stock = p.stock; });
    const topProductos = Object.values(salesByProduct).sort((a, b) => b.salidas - a.salidas).slice(0, 5);
    const maxSalidas   = topProductos.length > 0 ? topProductos[0].salidas : 1;

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

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Valor inventario */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-500 font-medium">Valor inventario</p>
                            <InfoTooltip text="Σ(cantidad × costoUnitario) de todas las entradas − Σ(cantidad × costoUnitario) de todas las salidas. Representa el costo real del stock físico actual." />
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg"><DollarSign size={16} className="text-blue-600" /></div>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">
                        {loading ? '...' : `$${totalValue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={valuePct} label="vs mes ant." />}
                    </div>
                </div>

                {/* Total productos */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-500 font-medium">Total productos</p>
                            <InfoTooltip text="Número de SKUs activos en el catálogo. No incluye productos marcados como inactivos." />
                        </div>
                        <div className="p-2 bg-purple-50 rounded-lg"><Package size={16} className="text-purple-600" /></div>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{loading ? '...' : products.length}</p>
                    <div className="flex items-center gap-2 mt-2">
                        {loading ? (
                            <p className="text-xs text-gray-400">Cargando...</p>
                        ) : productosNuevosMes > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                                <TrendingUp size={11} />+{productosNuevosMes} este mes
                            </span>
                        ) : (
                            <p className="text-xs text-gray-400">{categories} categorías activas</p>
                        )}
                    </div>
                </div>

                {/* Stock bajo mínimo */}
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

                {/* Entradas hoy */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-500 font-medium">Entradas hoy</p>
                            <InfoTooltip text="Suma de unidades de ENTRADA y AJUSTE_POSITIVO registradas hoy, vs ayer y el mes completo vs mes anterior." />
                        </div>
                        <div className="p-2 bg-green-50 rounded-lg"><ArrowUpCircle size={16} className="text-green-600" /></div>
                    </div>
                    <p className="text-3xl font-bold text-green-600">{loading ? '...' : `+${entradasHoy}`}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {loading ? <p className="text-xs text-gray-400">Cargando...</p> : (
                            <>
                                <DeltaBadge pct={entradasHoyPct} label="vs ayer" />
                                <span className="text-xs text-gray-400">· +{entradasMes} mes</span>
                                {entradasMesPct !== null && <DeltaBadge pct={entradasMesPct} label="vs mes ant." />}
                            </>
                        )}
                    </div>
                </div>

                {/* Salidas hoy */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-500 font-medium">Salidas hoy</p>
                            <InfoTooltip text="Suma de unidades de SALIDA y AJUSTE_NEGATIVO registradas hoy, vs ayer y el mes completo vs mes anterior." />
                        </div>
                        <div className="p-2 bg-red-50 rounded-lg"><ArrowDownCircle size={16} className="text-red-500" /></div>
                    </div>
                    <p className="text-3xl font-bold text-red-500">{loading ? '...' : `-${salidasHoy}`}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {loading ? <p className="text-xs text-gray-400">Cargando...</p> : (
                            <>
                                <DeltaBadge pct={salidasHoyPct} label="vs ayer" />
                                <span className="text-xs text-gray-400">· -{salidasMes} mes</span>
                                {salidasMesPct !== null && <DeltaBadge pct={salidasMesPct} label="vs mes ant." />}
                            </>
                        )}
                    </div>
                </div>

                {/* Rotación mensual */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-500 font-medium">Rotación mensual</p>
                            <InfoTooltip text="(Salidas del mes ÷ Stock total actual) × 100. Indica qué porcentaje del inventario rotó este mes. Un valor alto significa que vendes rápido." position="top" />
                        </div>
                        <div className="p-2 bg-teal-50 rounded-lg"><RotateCcw size={16} className="text-teal-600" /></div>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{loading ? '...' : `${rotacion}%`}</p>
                    <div className="flex items-center gap-2 mt-2">
                        {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={rotacionPct} label="vs mes ant." />}
                    </div>
                </div>

            </div>

            {/* Gráfica */}
            <AnalyticsChart />

            {/* Top productos + Acciones + Actividad */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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
                                        <div className="h-full bg-red-400 rounded-full transition-all duration-500" style={{ width: `${(p.salidas / maxSalidas) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4">
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
