"use client";

import { useEffect, useState, useMemo } from 'react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import {
    Package, AlertTriangle, DollarSign, ArrowUpCircle, ArrowDownCircle,
    RotateCcw, TrendingUp, TrendingDown, Minus, Percent,
    ShoppingCart, Ban, Warehouse, Calendar
} from 'lucide-react';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

// ── Tipos ──────────────────────────────────────────────────────────────
type PeriodKey = 'general' | 'este_mes' | 'mes_anterior' | 'ultimos_3m' | 'este_anio' | 'personalizado';

interface PeriodOption {
    key: PeriodKey;
    label: string;
    shortLabel: string;
}

const PERIODS: PeriodOption[] = [
    { key: 'general',      label: 'General (todo el tiempo)', shortLabel: 'General' },
    { key: 'este_mes',     label: 'Este mes',                  shortLabel: 'Este mes' },
    { key: 'mes_anterior', label: 'Mes anterior',              shortLabel: 'Mes ant.' },
    { key: 'ultimos_3m',   label: 'Últimos 3 meses',           shortLabel: 'Últ. 3 meses' },
    { key: 'este_anio',    label: 'Este año',                  shortLabel: 'Este año' },
];

// ── Helpers de tiempo ──────────────────────────────────────────────────
function toInputDate(d: Date) { return d.toISOString().split('T')[0]; }

function getPeriodRange(key: PeriodKey): { desde: Date; hasta: Date; prevDesde: Date; prevHasta: Date } {
    const now = new Date();
    const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const start3m          = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const startPrev3m      = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const endPrev3m        = new Date(now.getFullYear(), now.getMonth() - 3, 0, 23, 59, 59);
    const startOfYear      = new Date(now.getFullYear(), 0, 1);
    const startOfPrevYear  = new Date(now.getFullYear() - 1, 0, 1);
    const endOfPrevYear    = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

    switch (key) {
        case 'este_mes':
            return { desde: startOfMonth, hasta: now, prevDesde: startOfPrevMonth, prevHasta: endOfPrevMonth };
        case 'mes_anterior':
            return { desde: startOfPrevMonth, hasta: endOfPrevMonth, prevDesde: new Date(now.getFullYear(), now.getMonth() - 2, 1), prevHasta: new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59) };
        case 'ultimos_3m':
            return { desde: start3m, hasta: now, prevDesde: startPrev3m, prevHasta: endPrev3m };
        case 'este_anio':
            return { desde: startOfYear, hasta: now, prevDesde: startOfPrevYear, prevHasta: endOfPrevYear };
        default:
            return { desde: new Date(0), hasta: now, prevDesde: new Date(0), prevHasta: new Date(0) };
    }
}

// ── Utilidades de display ──────────────────────────────────────────────
function calcPct(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
}

function fmt(n: number) { return n.toLocaleString('es-MX', { maximumFractionDigits: 0 }); }

function DeltaBadge({ pct, label }: { pct: number | null; label?: string }) {
    if (pct === null) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                <Minus size={10} /> Sin datos ant.
            </span>
        );
    }
    const isUp = pct > 0;
    const isNeutral = Math.abs(pct) < 0.05;
    const colorClass = isNeutral ? 'bg-gray-100 text-gray-500' : isUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600';
    const Icon = isNeutral ? Minus : isUp ? TrendingUp : TrendingDown;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
            <Icon size={11} />
            {isNeutral ? '0%' : `${isUp ? '+' : ''}${pct.toFixed(1)}%`}
            {label && <span className="font-normal opacity-75">{label}</span>}
        </span>
    );
}

// ── Componente principal ───────────────────────────────────────────────
export default function DashboardPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<PeriodKey>('este_mes');

    const now = new Date();
    const [manualDesde, setManualDesde] = useState<string>(
        toInputDate(new Date(now.getFullYear(), now.getMonth(), 1))
    );
    const [manualHasta, setManualHasta] = useState<string>(toInputDate(now));

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

    // ── Al elegir botón rápido → rellena los campos Desde/Hasta ────
    const handlePeriodButton = (key: PeriodKey) => {
        setPeriod(key);
        if (key === 'general') {
            setManualDesde('');
            setManualHasta(toInputDate(new Date()));
            return;
        }
        const range = getPeriodRange(key);
        setManualDesde(toInputDate(range.desde));
        setManualHasta(toInputDate(range.hasta));
    };

    // ── Al editar fechas manualmente → período = personalizado ──────
    const handleManualDesde = (val: string) => { setManualDesde(val); setPeriod('personalizado'); };
    const handleManualHasta = (val: string) => { setManualHasta(val); setPeriod('personalizado'); };

    // ── Rango efectivo ─────────────────────────────────────────────
    const desde: Date = useMemo(() => {
        if (period === 'general' || !manualDesde) return new Date(0);
        return new Date(manualDesde + 'T00:00:00');
    }, [period, manualDesde]);

    const hasta: Date = useMemo(() => {
        if (!manualHasta) return new Date();
        return new Date(manualHasta + 'T23:59:59');
    }, [manualHasta]);

    // Período anterior (solo para botones rápidos predefinidos)
    const prevRange = useMemo(() => {
        if (period === 'general' || period === 'personalizado') return null;
        return getPeriodRange(period);
    }, [period]);

    // ── Helpers de filtrado ─────────────────────────────────────────
    const isEntrada = (m: any) => ['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento);
    const isSalida  = (m: any) => ['SALIDA',  'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento);
    const sumCant   = (arr: any[]) => arr.reduce((a, m) => a + m.cantidad, 0);

    const startOfDay       = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const endOfYesterday   = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Movimientos dentro del rango seleccionado
    const movsActual = useMemo(() =>
        period === 'general'
            ? movements
            : movements.filter(m => { const f = new Date(m.fecha); return f >= desde && f <= hasta; }),
        [movements, period, desde, hasta]
    );

    // Movimientos del período anterior (solo períodos rápidos)
    const movsPrev = useMemo(() => {
        if (!prevRange) return [];
        return movements.filter(m => {
            const f = new Date(m.fecha);
            return f >= prevRange.prevDesde && f <= prevRange.prevHasta;
        });
    }, [movements, prevRange]);

    const movsHoy  = movements.filter(m => new Date(m.fecha) >= startOfDay);
    const movsAyer = movements.filter(m => { const f = new Date(m.fecha); return f >= startOfYesterday && f < endOfYesterday; });

    // ── VALOR INVENTARIO — SNAPSHOT al final del período ──────────
    // Acumula TODOS los movimientos desde el inicio hasta "hasta"
    const valorSnapshotHasta = useMemo(() =>
        movements
            .filter(m => new Date(m.fecha) <= hasta)
            .reduce((acc, m) => {
                const v = Number(m.cantidad || 0) * Number(m.costoUnitario || 0);
                return acc + (isEntrada(m) ? v : -v);
            }, 0),
        [movements, hasta]
    );

    const valorSnapshotPrev = useMemo(() => {
        if (!prevRange) return 0;
        return movements
            .filter(m => new Date(m.fecha) <= prevRange.prevHasta)
            .reduce((acc, m) => {
                const v = Number(m.cantidad || 0) * Number(m.costoUnitario || 0);
                return acc + (isEntrada(m) ? v : -v);
            }, 0);
    }, [movements, prevRange]);

    const valuePct = prevRange ? calcPct(valorSnapshotHasta, valorSnapshotPrev) : null;

    // ── Total productos ─────────────────────────────────────────────
    const productosNuevosMes = useMemo(() =>
        products.filter(p => p.createdAt && new Date(p.createdAt) >= desde).length,
        [products, desde]
    );
    const categories = new Set(products.map(p => p.categoria?.nombre).filter(Boolean)).size;
    const lowStockProducts = products.filter(p => p.stock <= p.stockMinimo);

    // ── Entradas / Salidas ──────────────────────────────────────────
    const entradasActual = sumCant(movsActual.filter(isEntrada));
    const salidasActual  = sumCant(movsActual.filter(isSalida));
    const entradasPrev   = sumCant(movsPrev.filter(isEntrada));
    const salidasPrev    = sumCant(movsPrev.filter(isSalida));
    const entradasHoy    = sumCant(movsHoy.filter(isEntrada));
    const salidasHoy     = sumCant(movsHoy.filter(isSalida));
    const entradasAyer   = sumCant(movsAyer.filter(isEntrada));
    const salidasAyer    = sumCant(movsAyer.filter(isSalida));

    const entradasPct    = prevRange ? calcPct(entradasActual, entradasPrev) : null;
    const salidasPct     = prevRange ? calcPct(salidasActual, salidasPrev)  : null;
    const entradasHoyPct = calcPct(entradasHoy, entradasAyer);
    const salidasHoyPct  = calcPct(salidasHoy, salidasAyer);

    // ── Rotación ────────────────────────────────────────────────────
    const totalStock   = products.reduce((a, p) => a + p.stock, 0);
    const rotacionNum  = totalStock > 0 ? (salidasActual / totalStock) * 100 : 0;
    const rotacionPrev = totalStock > 0 ? (salidasPrev / totalStock) * 100 : 0;
    const rotacion     = rotacionNum.toFixed(1);
    const rotacionPct  = prevRange ? calcPct(rotacionNum, rotacionPrev) : null;

    // ── KPIs Financieros ────────────────────────────────────────────
    const costoEntradas     = movsActual.filter(isEntrada).reduce((a, m) => a + Number(m.cantidad||0)*Number(m.costoUnitario||0), 0);
    const costoEntradasPrev = movsPrev.filter(isEntrada).reduce((a, m) => a + Number(m.cantidad||0)*Number(m.costoUnitario||0), 0);

    const ingresosSalidas     = movsActual.filter(m => m.tipoMovimiento === 'SALIDA').reduce((a, m) => a + Number(m.cantidad||0)*Number(m.precioUnitario||m.costoUnitario||0), 0);
    const ingresosSalidasPrev = movsPrev.filter(m => m.tipoMovimiento === 'SALIDA').reduce((a, m) => a + Number(m.cantidad||0)*Number(m.precioUnitario||m.costoUnitario||0), 0);

    const margenBruto     = ingresosSalidas - costoEntradas;
    const margenBrutoPrev = ingresosSalidasPrev - costoEntradasPrev;
    const margenPct       = ingresosSalidas > 0 ? (margenBruto / ingresosSalidas) * 100 : 0;
    const margenPctPrev   = ingresosSalidasPrev > 0 ? (margenBrutoPrev / ingresosSalidasPrev) * 100 : 0;

    const costoEntradasDelta   = prevRange ? calcPct(costoEntradas, costoEntradasPrev)     : null;
    const ingresosSalidasDelta = prevRange ? calcPct(ingresosSalidas, ingresosSalidasPrev) : null;
    const margenBrutoDelta     = prevRange ? calcPct(margenBruto, margenBrutoPrev)         : null;
    const margenPorcentDelta   = prevRange ? calcPct(margenPct, margenPctPrev)             : null;

    const productosConMov     = new Set(movsActual.map(m => m.productoId || m.producto?.id));
    const productosConMovPrev = new Set(movsPrev.map(m => m.productoId || m.producto?.id));
    const sinMovimiento       = products.filter(p => !productosConMov.has(p.id));
    const sinMovimientoPrev   = products.filter(p => !productosConMovPrev.has(p.id));
    const sinMovimientoDelta  = prevRange ? calcPct(sinMovimiento.length, sinMovimientoPrev.length) : null;

    const valorInmovilizado = sinMovimiento.reduce((a, p) => a + Number(p.stock||0)*Number(p.costoUnitario||0), 0);
    const pctInmovilizado   = valorSnapshotHasta > 0 ? (valorInmovilizado / valorSnapshotHasta) * 100 : 0;

    // ── Rango para AnalyticsChart (sincronizado exactamente) ────────
    const chartDateRange = useMemo(() => {
        if (period === 'general' || !manualDesde) return null;
        return {
            desde: manualDesde,
            hasta: manualHasta || toInputDate(new Date()),
            isAllTime: false,
        };
    }, [period, manualDesde, manualHasta]);

    // ── Labels ─────────────────────────────────────────────────────
    const selectedPeriodLabel =
        period === 'personalizado'
            ? `${manualDesde || '…'} → ${manualHasta || '…'}`
            : PERIODS.find(p => p.key === period)!.label;

    const compareLabel =
        !prevRange ? '' :
        period === 'este_mes'     ? 'vs mes ant.' :
        period === 'mes_anterior' ? 'vs 2 meses atrás' :
        period === 'ultimos_3m'   ? 'vs 3 meses previos' :
        'vs año anterior';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Resumen General</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Mostrando datos de: <span className="font-medium text-gray-600">{selectedPeriodLabel}</span>
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <Link href="/dashboard/purchases/new" className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                        <ArrowUpCircle size={16} /> Nueva Entrada
                    </Link>
                    <Link href="/dashboard/sales/new" className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                        <ArrowDownCircle size={16} /> Registrar Salida
                    </Link>
                </div>
            </div>

            {/* ── Filtro global ─────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Calendar size={16} className="text-blue-500" />
                    <span className="text-sm font-medium text-gray-600">Filtrar período:</span>
                </div>

                {/* Botones rápidos */}
                <div className="flex flex-wrap gap-1.5">
                    {PERIODS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => handlePeriodButton(p.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                period === p.key
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                            }`}
                        >
                            {p.shortLabel}
                        </button>
                    ))}
                    {period === 'personalizado' && (
                        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white border border-purple-600 shadow-sm">
                            Personalizado
                        </span>
                    )}
                </div>

                <div className="hidden sm:block w-px h-5 bg-gray-200 flex-shrink-0" />

                {/* Campos Desde / Hasta */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-medium flex-shrink-0">Desde</span>
                        <input
                            type="date"
                            value={manualDesde}
                            onChange={e => handleManualDesde(e.target.value)}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-medium flex-shrink-0">Hasta</span>
                        <input
                            type="date"
                            value={manualHasta}
                            onChange={e => handleManualHasta(e.target.value)}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 1 — INVENTARIO
            ══════════════════════════════════════════════════════════ */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Inventario</p>
                    <span className="text-xs text-blue-500 font-medium px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">
                        {selectedPeriodLabel}
                    </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

                    {/* Valor inventario — snapshot */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium">Valor inventario</p>
                                <InfoTooltip text="Valor acumulado del inventario al cierre del período (snapshot): Σ(entradas×costo) − Σ(salidas×costo) desde el inicio hasta la fecha 'Hasta'." />
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg"><DollarSign size={16} className="text-blue-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">
                            {loading ? '...' : `$${fmt(valorSnapshotHasta)}`}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={valuePct} label={compareLabel || undefined} />}
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
                                    <TrendingUp size={11} />+{productosNuevosMes} en período
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
                                <InfoTooltip text="Productos donde stock actual ≤ stock mínimo. Estado actual del inventario (siempre global)." position="top" />
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

                    {/* Entradas del período */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium">
                                    {period === 'general' ? 'Entradas totales' : period === 'este_mes' ? 'Entradas hoy' : 'Entradas período'}
                                </p>
                                <InfoTooltip text="Suma de unidades de ENTRADA y AJUSTE_POSITIVO en el período seleccionado." />
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg"><ArrowUpCircle size={16} className="text-green-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-green-600">
                            {loading ? '...' : `+${period === 'este_mes' ? entradasHoy : entradasActual}`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : (
                                period === 'este_mes' ? (
                                    <>
                                        <DeltaBadge pct={entradasHoyPct} label="vs ayer" />
                                        <span className="text-xs text-gray-400">· +{entradasActual} mes</span>
                                        {entradasPct !== null && <DeltaBadge pct={entradasPct} label={compareLabel} />}
                                    </>
                                ) : (
                                    <DeltaBadge pct={entradasPct} label={compareLabel || undefined} />
                                )
                            )}
                        </div>
                    </div>

                    {/* Salidas del período */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium">
                                    {period === 'general' ? 'Salidas totales' : period === 'este_mes' ? 'Salidas hoy' : 'Salidas período'}
                                </p>
                                <InfoTooltip text="Suma de unidades de SALIDA y AJUSTE_NEGATIVO en el período seleccionado." />
                            </div>
                            <div className="p-2 bg-red-50 rounded-lg"><ArrowDownCircle size={16} className="text-red-500" /></div>
                        </div>
                        <p className="text-3xl font-bold text-red-500">
                            {loading ? '...' : `-${period === 'este_mes' ? salidasHoy : salidasActual}`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : (
                                period === 'este_mes' ? (
                                    <>
                                        <DeltaBadge pct={salidasHoyPct} label="vs ayer" />
                                        <span className="text-xs text-gray-400">· -{salidasActual} mes</span>
                                        {salidasPct !== null && <DeltaBadge pct={salidasPct} label={compareLabel} />}
                                    </>
                                ) : (
                                    <DeltaBadge pct={salidasPct} label={compareLabel || undefined} />
                                )
                            )}
                        </div>
                    </div>

                    {/* Rotación */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium">Rotación del período</p>
                                <InfoTooltip text="(Salidas del período ÷ Stock total actual) × 100. Indica qué porcentaje del inventario rotó en el período seleccionado." position="top" />
                            </div>
                            <div className="p-2 bg-teal-50 rounded-lg"><RotateCcw size={16} className="text-teal-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{loading ? '...' : `${rotacion}%`}</p>
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={rotacionPct} label={compareLabel || undefined} />}
                        </div>
                    </div>

                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 2 — FINANZAS
            ══════════════════════════════════════════════════════════ */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Finanzas</p>
                    <span className="text-xs text-blue-500 font-medium px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">
                        {selectedPeriodLabel}
                    </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium">Costo de entradas</p>
                                <InfoTooltip text="Σ(cantidad × costoUnitario) de todas las entradas en el período seleccionado. Capital invertido en compras." />
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg"><ShoppingCart size={16} className="text-blue-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{loading ? '...' : `$${fmt(costoEntradas)}`}</p>
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={costoEntradasDelta} label={compareLabel || undefined} />}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium">Ingresos por salidas</p>
                                <InfoTooltip text="Σ(cantidad × precioVenta) de salidas tipo SALIDA en el período. No incluye ajustes." />
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg"><TrendingUp size={16} className="text-green-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-green-600">{loading ? '...' : `$${fmt(ingresosSalidas)}`}</p>
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={ingresosSalidasDelta} label={compareLabel || undefined} />}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium">Margen bruto</p>
                                <InfoTooltip text="Ingresos por salidas − Costo de entradas del período." position="top" />
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign size={16} className="text-emerald-600" /></div>
                        </div>
                        <p className={`text-3xl font-bold ${margenBruto >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{loading ? '...' : `$${fmt(margenBruto)}`}</p>
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={margenBrutoDelta} label={compareLabel || undefined} />}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium">Margen %</p>
                                <InfoTooltip text="(Ingresos − Costo) ÷ Ingresos × 100." />
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg"><Percent size={16} className="text-emerald-600" /></div>
                        </div>
                        <p className={`text-3xl font-bold ${margenPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{loading ? '...' : `${margenPct.toFixed(1)}%`}</p>
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={margenPorcentDelta} label={compareLabel || undefined} />}
                        </div>
                    </div>

                    <div className={`rounded-xl border shadow-sm hover:shadow-md transition-shadow p-5 ${sinMovimiento.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className={`text-sm font-medium ${sinMovimiento.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>Sin movimiento</p>
                                <InfoTooltip text="Productos sin ninguna entrada ni salida en el período seleccionado." position="top" />
                            </div>
                            <div className={`p-2 rounded-lg ${sinMovimiento.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                                <Ban size={16} className={sinMovimiento.length > 0 ? 'text-red-500' : 'text-gray-400'} />
                            </div>
                        </div>
                        <p className={`text-3xl font-bold ${sinMovimiento.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>{loading ? '...' : `${sinMovimiento.length} items`}</p>
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={sinMovimientoDelta} label={compareLabel || undefined} />}
                        </div>
                    </div>

                    <div className={`rounded-xl border shadow-sm hover:shadow-md transition-shadow p-5 ${valorInmovilizado > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className={`text-sm font-medium ${valorInmovilizado > 0 ? 'text-red-600' : 'text-gray-500'}`}>Valor inmovilizado</p>
                                <InfoTooltip text="Σ(stock × costoUnitario) de los productos sin movimiento en el período." position="top" />
                            </div>
                            <div className={`p-2 rounded-lg ${valorInmovilizado > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                                <Warehouse size={16} className={valorInmovilizado > 0 ? 'text-red-500' : 'text-gray-400'} />
                            </div>
                        </div>
                        <p className={`text-3xl font-bold ${valorInmovilizado > 0 ? 'text-red-600' : 'text-gray-800'}`}>{loading ? '...' : `$${fmt(valorInmovilizado)}`}</p>
                        <p className="text-xs text-gray-400 mt-2">{loading ? '' : `${pctInmovilizado.toFixed(1)}% del inventario total`}</p>
                    </div>

                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 3 — TENDENCIA DE MOVIMIENTOS
                Filtro interno eliminado — controlado por filtro global
            ══════════════════════════════════════════════════════════ */}
            <AnalyticsChart
                externalMovements={movements}
                externalDateRange={chartDateRange}
            />

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 4 — OPERACIONES
            ══════════════════════════════════════════════════════════ */}
            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Operaciones</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-base font-semibold text-gray-800">Stock crítico</h2>
                            <Link href="/dashboard/products" className="text-xs text-blue-500 hover:underline">Ver todos →</Link>
                        </div>
                        {loading ? (
                            <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
                        ) : lowStockProducts.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-6">Todos los productos están sobre el mínimo.</p>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {lowStockProducts.slice(0, 6).map((p: any) => {
                                    const isCritical = p.stock <= Math.floor(p.stockMinimo * 0.5);
                                    return (
                                        <div key={p.id} className="flex items-center justify-between py-2.5">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                                                <p className="text-xs text-gray-400">{p.sku || p.codigo || '—'}</p>
                                            </div>
                                            <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    Stock: {p.stock}
                                                </span>
                                                <span className="text-xs text-gray-400">Mín: {p.stockMinimo}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-base font-semibold text-gray-800">Compras pendientes</h2>
                            <Link href="/dashboard/purchases" className="text-xs text-blue-500 hover:underline">Ver todas →</Link>
                        </div>
                        {loading ? (
                            <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
                        ) : (
                            <p className="text-sm text-gray-400 text-center py-6">
                                Conecta el módulo de órdenes de compra para ver las pendientes.
                            </p>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
