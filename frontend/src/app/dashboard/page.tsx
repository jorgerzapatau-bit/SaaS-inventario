"use client";

import { useEffect, useState, useMemo } from 'react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import {
    Package, AlertTriangle, DollarSign, ArrowUpCircle, ArrowDownCircle,
    RotateCcw, TrendingUp, TrendingDown, Minus, Percent,
    ShoppingCart, Ban, Warehouse, Calendar, ExternalLink, Clock,
    FileText, X, Gauge, Droplets, Wrench, ClipboardList,
} from 'lucide-react';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import { fetchApi } from '@/lib/api';
import { useCompany } from '@/context/CompanyContext';
import Link from 'next/link';

// ── Tipos y helpers ────────────────────────────────────────────────────
type PeriodKey = 'general' | 'este_mes' | 'mes_anterior' | 'ultimos_3m' | 'este_anio' | 'personalizado';
interface PeriodOption { key: PeriodKey; label: string; shortLabel: string; }

const PERIODS: PeriodOption[] = [
    { key: 'general',      label: 'General (todo el tiempo)', shortLabel: 'General' },
    { key: 'este_mes',     label: 'Este mes',                  shortLabel: 'Este mes' },
    { key: 'mes_anterior', label: 'Mes anterior',              shortLabel: 'Mes ant.' },
    { key: 'ultimos_3m',   label: 'Últimos 3 meses',           shortLabel: 'Últ. 3 meses' },
    { key: 'este_anio',    label: 'Este año',                  shortLabel: 'Este año' },
];

function toInputDate(d: Date) { return d.toISOString().split('T')[0]; }

function getPeriodRange(key: PeriodKey) {
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
        case 'este_mes':     return { desde: startOfMonth,     hasta: now, prevDesde: startOfPrevMonth, prevHasta: endOfPrevMonth };
        case 'mes_anterior': return { desde: startOfPrevMonth, hasta: endOfPrevMonth, prevDesde: new Date(now.getFullYear(), now.getMonth() - 2, 1), prevHasta: new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59) };
        case 'ultimos_3m':   return { desde: start3m,          hasta: now, prevDesde: startPrev3m, prevHasta: endPrev3m };
        case 'este_anio':    return { desde: startOfYear,      hasta: now, prevDesde: startOfPrevYear, prevHasta: endOfPrevYear };
        default:             return { desde: new Date(0),      hasta: now, prevDesde: new Date(0), prevHasta: new Date(0) };
    }
}

function calcPct(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
}
function fmt(n: number) { return n.toLocaleString('es-MX', { maximumFractionDigits: 0 }); }

function DeltaBadge({ pct, label }: { pct: number | null; label?: string }) {
    if (pct === null) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400"><Minus size={10} /> Sin datos ant.</span>;
    const isUp      = pct > 0;
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

// ── Componente principal ───────────────────────────────────────────────────────
export default function DashboardPage() {
    const [products,   setProducts]   = useState<any[]>([]);
    const [movements,  setMovements]  = useState<any[]>([]);
    const [purchases,  setPurchases]  = useState<any[]>([]);
    const [registros,  setRegistros]  = useState<any[]>([]);
    const [equipos,    setEquipos]    = useState<any[]>([]);
    const [obras,      setObras]      = useState<any[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [period,     setPeriod]     = useState<PeriodKey>('este_mes');
    const [showSinMovimiento, setShowSinMovimiento] = useState(false);
    const [showPdfPreview,    setShowPdfPreview]    = useState(false);
    const [pdfGenerating,     setPdfGenerating]     = useState(false);

    const { company } = useCompany();
    const now = new Date();

    const [manualDesde, setManualDesde] = useState(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
    const [manualHasta, setManualHasta] = useState(toInputDate(now));

    useEffect(() => {
        const load = async () => {
            try {
                const [prods, movs, purch, regs, eqs, obs] = await Promise.all([
                    fetchApi('/products'),
                    fetchApi('/inventory/movements'),
                    fetchApi('/purchases'),
                    fetchApi('/registros-diarios'),
                    fetchApi('/equipos'),
                    fetchApi('/obras'),
                ]);
                setProducts(prods);
                setMovements(movs);
                setPurchases(Array.isArray(purch) ? purch : []);
                setRegistros(regs);
                setEquipos(eqs);
                setObras(Array.isArray(obs) ? obs.filter((o: any) => o.activa !== false) : []);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    const handlePeriodButton = (key: PeriodKey) => {
        setPeriod(key);
        if (key === 'general') { setManualDesde(''); setManualHasta(toInputDate(new Date())); return; }
        const range = getPeriodRange(key);
        setManualDesde(toInputDate(range.desde));
        setManualHasta(toInputDate(range.hasta));
    };

    const desde = useMemo(() => (!manualDesde || period === 'general') ? new Date(0) : new Date(manualDesde + 'T00:00:00'), [period, manualDesde]);
    const hasta = useMemo(() => !manualHasta ? new Date() : new Date(manualHasta + 'T23:59:59'), [manualHasta]);
    const prevRange = useMemo(() => (period === 'general' || period === 'personalizado') ? null : getPeriodRange(period), [period]);

    const isEntrada = (m: any) => ['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento);
    const isSalida  = (m: any) => ['SALIDA', 'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento);

    // ── KPIs de inventario ────────────────────────────────────────────────────
    const valorActualTotal = useMemo(() =>
        movements.reduce((acc, m) => {
            const v = Number(m.cantidad || 0) * Number(m.costoUnitario || 0);
            return acc + (isEntrada(m) ? v : -v);
        }, 0), [movements]);

    const lowStockProducts = products.filter(p => Number(p.stockActual) <= Number(p.stockMinimo));
    const categories       = new Set(products.map(p => p.categoria?.nombre).filter(Boolean)).size;
    const totalStock       = products.reduce((a, p) => a + Number(p.stockActual), 0);

    const movsActual = useMemo(() =>
        period === 'general' ? movements
        : movements.filter(m => { const f = new Date(m.fecha); return f >= desde && f <= hasta; }),
        [movements, period, desde, hasta]);

    const movsPrev = useMemo(() => {
        if (!prevRange) return [];
        return movements.filter(m => { const f = new Date(m.fecha); return f >= prevRange.prevDesde && f <= prevRange.prevHasta; });
    }, [movements, prevRange]);

    const sumCant = (arr: any[]) => arr.reduce((a, m) => a + Number(m.cantidad), 0);
    const entradasActual = sumCant(movsActual.filter(isEntrada));
    const salidasActual  = sumCant(movsActual.filter(isSalida));
    const entradasPrev   = sumCant(movsPrev.filter(isEntrada));
    const salidasPrev    = sumCant(movsPrev.filter(isSalida));
    const costoEntradas  = movsActual.filter(isEntrada).reduce((a, m) => a + Number(m.cantidad||0)*Number(m.costoUnitario||0), 0);
    const sinMovimiento  = products.filter(p => !new Set(movsActual.map(m => m.productoId)).has(p.id));

    // ── KPIs operacionales (Teprex) ───────────────────────────────────────────
    const toSafeDate = (fecha: string) => {
        const bare = fecha.includes('T') ? fecha.split('T')[0] : fecha;
        return new Date(bare + 'T12:00:00');
    };

    // Comparación de fechas por string YYYY-MM-DD para evitar desfase de timezone
    const dateStr = (d: Date) => d.toISOString().slice(0, 10);
    const regFecha = (r: any): string =>
        typeof r.fecha === 'string' ? r.fecha.slice(0, 10)
        : r.fecha instanceof Date   ? r.fecha.toISOString().slice(0, 10)
        : '';

    const registrosPeriodo = useMemo(() =>
        registros.filter(r => {
            if (period === 'general') return true;
            const f = regFecha(r);
            return f >= dateStr(desde) && f <= dateStr(hasta);
        }), [registros, period, desde, hasta]);

    const registrosPrev = useMemo(() => {
        if (!prevRange) return [];
        return registros.filter(r => {
            const f = regFecha(r);
            return f >= dateStr(prevRange.prevDesde) && f <= dateStr(prevRange.prevHasta);
        });
    }, [registros, prevRange]);

    const opKPIs = useMemo(() => {
        const totalHoras  = registrosPeriodo.reduce((a: number, r: any) => a + Number(r.horasTrabajadas), 0);
        const totalMetros = registrosPeriodo.reduce((a: number, r: any) => a + Number(r.metrosLineales),  0);
        const totalLitros = registrosPeriodo.reduce((a: number, r: any) => a + Number(r.litrosDiesel),    0);
        const totalBarr   = registrosPeriodo.reduce((a: number, r: any) => a + Number(r.barrenos),        0);
        const costoDiesel = registrosPeriodo.reduce((a: number, r: any) => a + Number(r.costoDiesel),     0);
        const dias        = registrosPeriodo.filter((r: any) => Number(r.horasTrabajadas) > 0).length;
        return {
            horas: totalHoras, metros: totalMetros, litros: totalLitros,
            barrenos: totalBarr, costoDiesel, dias,
            ltHr:  totalHoras  > 0 ? +(totalLitros / totalHoras).toFixed(2)  : null,
            mtHr:  totalHoras  > 0 ? +(totalMetros / totalHoras).toFixed(2)  : null,
            mtDia: dias        > 0 ? +(totalMetros / dias).toFixed(2)        : null,
        };
    }, [registrosPeriodo]);

    const opKPIsPrev = useMemo(() => ({
        horas:  registrosPrev.reduce((a: number, r: any) => a + Number(r.horasTrabajadas), 0),
        metros: registrosPrev.reduce((a: number, r: any) => a + Number(r.metrosLineales),  0),
        litros: registrosPrev.reduce((a: number, r: any) => a + Number(r.litrosDiesel),    0),
    }), [registrosPrev]);

    const compareLabel = !prevRange ? '' :
        period === 'este_mes'     ? 'vs mes ant.' :
        period === 'mes_anterior' ? 'vs 2 meses atrás' :
        period === 'ultimos_3m'   ? 'vs 3 meses previos' : 'vs año anterior';

    const selectedPeriodLabel = period === 'personalizado'
        ? `${manualDesde || '…'} → ${manualHasta || '…'}`
        : PERIODS.find(p => p.key === period)!.label;

    const fechaActual = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const chartDateRange = useMemo(() => {
        if (period === 'general' || !manualDesde) return null;
        return { desde: manualDesde, hasta: manualHasta || toInputDate(new Date()), isAllTime: false };
    }, [period, manualDesde, manualHasta]);

    // último registro diario para mostrar en el panel
    const ultimoRegistro = registros[0] ?? null;

    const getClienteNombre = (cliente: any) => {
        if (!cliente) return "—";
        if (typeof cliente === "string") return cliente;
        if (typeof cliente === "object") return cliente.nombre ?? cliente.name ?? cliente.razonSocial ?? "—";
        return "—";
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* PDF preview modal (sin cambios) */}
            {showPdfPreview && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <p className="font-semibold text-gray-800">Resumen listo</p>
                            <button onClick={() => setShowPdfPreview(false)}><X size={18} className="text-gray-400" /></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">El resumen ejecutivo incluye inventario y KPIs operacionales de Teprex.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowPdfPreview(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                            <button onClick={() => setShowPdfPreview(false)} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Resumen General</h1>
                    <p className="text-sm text-gray-400 mt-0.5 capitalize">{fechaActual}</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <Link href="/dashboard/registros-diarios/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                        <ClipboardList size={16} /> Nuevo Registro
                    </Link>
                    <Link href="/dashboard/purchases/new" className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                        <ArrowUpCircle size={16} /> Nueva Entrada
                    </Link>
                </div>
            </div>

            {/* ── ZONA A: Estado actual ─────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Estado actual</p>
                    </div>
                    <span className="text-xs text-slate-400 italic flex items-center gap-1"><Clock size={11} /> No varía con el filtro</span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">

                    {/* Equipos activos */}
                    <Link href="/dashboard/equipos" className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md hover:border-blue-200 transition-all group block">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1">
                                <p className="text-xs text-gray-500 font-medium group-hover:text-blue-600 transition-colors">Equipos activos</p>
                                <InfoTooltip text="Equipos con status Activo. El total incluye equipos dados de baja o en mantenimiento." />
                            </div>
                            <div className="p-1.5 bg-blue-50 rounded-lg"><Wrench size={14} className="text-blue-600" /></div>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{loading ? '…' : equipos.filter(e => e.activo).length}</p>
                        <p className="text-xs text-gray-400 mt-1">{equipos.length} equipos en total</p>
                    </Link>

                    {/* Obras activas */}
                    <Link href="/dashboard/obras" className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md hover:border-yellow-200 transition-all group block">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1">
                                <p className="text-xs text-gray-500 font-medium group-hover:text-yellow-600 transition-colors">Obras activas</p>
                                <InfoTooltip text="Obras con status Activa o En curso actualmente. No varía con el filtro de período." />
                            </div>
                            <div className="p-1.5 bg-yellow-50 rounded-lg"><FileText size={14} className="text-yellow-600" /></div>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{loading ? '…' : obras.length}</p>
                        <p className="text-xs text-gray-400 mt-1">En curso actualmente</p>
                    </Link>

                    {/* Valor inventario */}
                    <Link href="/dashboard/products" className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md hover:border-purple-200 transition-all group block">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1">
                                <p className="text-xs text-gray-500 font-medium group-hover:text-purple-600 transition-colors">Valor insumos</p>
                                <InfoTooltip text="Valor en libros del inventario de insumos (entradas − salidas × costo)." />
                            </div>
                            <div className="p-1.5 bg-purple-50 rounded-lg"><DollarSign size={14} className="text-purple-600" /></div>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{loading ? '…' : `$${fmt(valorActualTotal)}`}</p>
                        <p className="text-xs text-gray-400 mt-1">{products.length} insumos · {categories} categorías</p>
                    </Link>

                    {/* Stock bajo mínimo */}
                    <div className={`rounded-xl border shadow-sm p-4 ${lowStockProducts.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1">
                                <p className={`text-xs font-medium ${lowStockProducts.length > 0 ? 'text-orange-600' : 'text-gray-500'}`}>Stock bajo mínimo</p>
                                <InfoTooltip text="Insumos cuyo stockActual ≤ stockMínimo configurado. Requiere atención inmediata para no detener operaciones." />
                            </div>
                            <div className={`p-1.5 rounded-lg ${lowStockProducts.length > 0 ? 'bg-orange-100' : 'bg-gray-100'}`}>
                                <AlertTriangle size={14} className={lowStockProducts.length > 0 ? 'text-orange-500' : 'text-gray-400'} />
                            </div>
                        </div>
                        <p className={`text-2xl font-bold ${lowStockProducts.length > 0 ? 'text-orange-600' : 'text-gray-800'}`}>
                            {loading ? '…' : lowStockProducts.length}
                        </p>
                        <Link href="/dashboard/products?stock=bajo" className={`text-xs mt-1 inline-flex items-center gap-1 hover:underline ${lowStockProducts.length > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                            {lowStockProducts.length > 0 ? <>Ver detalle <ExternalLink size={10} /></> : 'Todo en orden ✓'}
                        </Link>
                    </div>

                    {/* Último registro */}
                    <Link href="/dashboard/registros-diarios" className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md hover:border-green-200 transition-all group block">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1">
                                <p className="text-xs text-gray-500 font-medium group-hover:text-green-600 transition-colors">Último registro</p>
                                <InfoTooltip text="Fecha y métricas del registro diario más reciente: horas trabajadas, metros perforados y litros de diésel." />
                            </div>
                            <div className="p-1.5 bg-green-50 rounded-lg"><ClipboardList size={14} className="text-green-600" /></div>
                        </div>
                        {loading || !ultimoRegistro ? (
                            <p className="text-sm text-gray-400">{loading ? '…' : 'Sin registros'}</p>
                        ) : (
                            <>
                                <p className="text-sm font-bold text-gray-800">
                                    {toSafeDate(ultimoRegistro.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {Number(ultimoRegistro.horasTrabajadas)} hrs · {Number(ultimoRegistro.metrosLineales).toFixed(1)} m · {Number(ultimoRegistro.litrosDiesel)} lt
                                </p>
                            </>
                        )}
                    </Link>
                </div>
            </div>

            {/* ── Filtro de período ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Calendar size={16} className="text-blue-500" />
                    <span className="text-sm font-semibold text-gray-700">Filtrar período:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {PERIODS.map(p => (
                        <button key={p.key} onClick={() => handlePeriodButton(p.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                period === p.key
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}>
                            {p.shortLabel}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium">Desde</span>
                    <input type="date" value={manualDesde} onChange={e => { setManualDesde(e.target.value); setPeriod('personalizado'); }}
                        className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 bg-white" />
                    <span className="text-xs text-gray-400 font-medium">Hasta</span>
                    <input type="date" value={manualHasta} onChange={e => { setManualHasta(e.target.value); setPeriod('personalizado'); }}
                        className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 bg-white" />
                </div>
            </div>

            {/* ── ZONA B: KPIs Operacionales Teprex ────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Gauge size={12} /> Operación del período
                    </p>
                    <span className="text-xs text-blue-500 font-medium px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">{selectedPeriodLabel}</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                    <Link href="/dashboard/registros-diarios" className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-blue-600 transition-colors">Horas operadas</p>
                                <InfoTooltip text="Suma de horas trabajadas (horometroFin − horometroInicio) de todos los registros diarios del período." />
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg"><Gauge size={16} className="text-blue-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{loading ? '…' : opKPIs.horas.toFixed(1)}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <DeltaBadge pct={prevRange ? calcPct(opKPIs.horas, opKPIsPrev.horas) : null} label={compareLabel || undefined} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{opKPIs.dias} días operados</p>
                    </Link>

                    <Link href="/dashboard/registros-diarios" className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-green-600 transition-colors">Metros perforados</p>
                                <InfoTooltip text="Suma de metros lineales perforados en todos los registros diarios del período. Se muestra también el promedio de metros por día y el total de barrenos." />
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg"><TrendingUp size={16} className="text-green-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{loading ? '…' : opKPIs.metros.toFixed(1)}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <DeltaBadge pct={prevRange ? calcPct(opKPIs.metros, opKPIsPrev.metros) : null} label={compareLabel || undefined} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{opKPIs.barrenos} barrenos · {opKPIs.mtDia ?? '—'} m/día prom.</p>
                    </Link>

                    <Link href="/dashboard/registros-diarios" className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-blue-600 transition-colors">Consumo diésel</p>
                                <InfoTooltip text="Litros de diésel totales del período. Lt/hr = litros ÷ horas trabajadas (eficiencia). Mt/hr = metros ÷ horas (rendimiento)." />
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg"><Droplets size={16} className="text-blue-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-blue-600">{loading ? '…' : opKPIs.litros.toLocaleString('es-MX')}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <DeltaBadge pct={prevRange ? calcPct(opKPIs.litros, opKPIsPrev.litros) : null} label={compareLabel || undefined} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            Lt/hr: <span className="font-semibold">{opKPIs.ltHr ?? '—'}</span>
                            {' · '}Mt/hr: <span className="font-semibold">{opKPIs.mtHr ?? '—'}</span>
                        </p>
                    </Link>

                    <Link href="/dashboard/resumen-semanal" className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-orange-600 transition-colors">Costo diésel período</p>
                                <InfoTooltip text="Costo total de diésel = litros × precio por litro registrado en cada registro diario del período." />
                            </div>
                            <div className="p-2 bg-orange-50 rounded-lg"><DollarSign size={16} className="text-orange-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">${loading ? '…' : fmt(opKPIs.costoDiesel)}</p>
                        <p className="text-xs text-gray-400 mt-2">
                            Ver resumen semanal <ExternalLink size={10} className="inline ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                    </Link>
                </div>
            </div>

            {/* ── ZONA C: Inventario del período ───────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Package size={12} /> Inventario del período
                    </p>
                    <span className="text-xs text-blue-500 font-medium px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">{selectedPeriodLabel}</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

                    <Link href="/dashboard/purchases" className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-green-600 transition-colors">Entradas (insumos)</p>
                                <InfoTooltip text="Cantidad total de unidades ingresadas al inventario (compras y ajustes positivos) durante el período seleccionado." />
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg"><ArrowUpCircle size={16} className="text-green-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-green-600">{loading ? '…' : `+${entradasActual.toLocaleString('es-MX', { maximumFractionDigits: 1 })}`}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <DeltaBadge pct={prevRange ? calcPct(entradasActual, entradasPrev) : null} label={compareLabel || undefined} />
                        </div>
                    </Link>

                    <Link href="/dashboard/sales" className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-red-500 transition-colors">Salidas / Consumos</p>
                                <InfoTooltip text="Cantidad total de unidades consumidas o retiradas del inventario (salidas y ajustes negativos) durante el período." />
                            </div>
                            <div className="p-2 bg-red-50 rounded-lg"><ArrowDownCircle size={16} className="text-red-500" /></div>
                        </div>
                        <p className="text-3xl font-bold text-red-500">{loading ? '…' : `-${salidasActual.toLocaleString('es-MX', { maximumFractionDigits: 1 })}`}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <DeltaBadge pct={prevRange ? calcPct(salidasActual, salidasPrev) : null} label={compareLabel || undefined} />
                        </div>
                    </Link>

                    <Link href="/dashboard/purchases" className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-blue-600 transition-colors">Costo compras</p>
                                <InfoTooltip text="Monto total de capital invertido en compras de insumos del período = suma de (cantidad × costo unitario) de todas las entradas." />
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg"><ShoppingCart size={16} className="text-blue-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{loading ? '…' : `$${fmt(costoEntradas)}`}</p>
                        <p className="text-xs text-gray-400 mt-2">Capital invertido en insumos</p>
                    </Link>
                </div>
            </div>

            {/* ── Gráfica tendencia ─────────────────────────────────────────── */}
            {!loading && movsActual.length > 0 && (
                <div className="min-w-0">
                    <AnalyticsChart externalMovements={movements} externalDateRange={chartDateRange} />
                </div>
            )}

            {/* ── Panel inferior: Stock crítico + Últimos registros ──────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Stock crítico */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-base font-semibold text-gray-800">Insumos bajo mínimo</h2>
                        <Link href="/dashboard/products?stock=bajo" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            Ver todos <ExternalLink size={10} />
                        </Link>
                    </div>
                    {loading ? (
                        <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
                    ) : lowStockProducts.length === 0 ? (
                        <div className="flex flex-col items-center py-6 gap-2">
                            <div className="p-3 bg-green-50 rounded-full"><Package size={20} className="text-green-500" /></div>
                            <p className="text-sm text-gray-500 font-medium">Todos los insumos sobre el mínimo</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {lowStockProducts.slice(0, 6).map((p: any) => (
                                <Link key={p.id} href={`/dashboard/products/${p.id}`}
                                    className="flex items-center justify-between py-2.5 group hover:bg-gray-50 px-1 rounded-lg transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600">{p.nombre}</p>
                                        <p className="text-xs text-gray-400">{p.sku} · {p.unidad}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                                            {Number(p.stockActual).toFixed(1)} {p.moneda === 'USD' ? '🇺🇸' : ''}
                                        </span>
                                        <span className="text-xs text-gray-400">Mín: {p.stockMinimo}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Últimos registros diarios */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-base font-semibold text-gray-800">Últimos registros diarios</h2>
                        <Link href="/dashboard/registros-diarios" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            Ver todos <ExternalLink size={10} />
                        </Link>
                    </div>
                    {loading ? (
                        <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
                    ) : registros.length === 0 ? (
                        <div className="flex flex-col items-center py-6 gap-2">
                            <div className="p-3 bg-blue-50 rounded-full"><ClipboardList size={20} className="text-blue-500" /></div>
                            <p className="text-sm text-gray-500 font-medium">Sin registros diarios aún</p>
                            <Link href="/dashboard/registros-diarios" className="text-xs text-blue-500 hover:underline">Crear el primero →</Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {registros.slice(0, 5).map((r: any) => (
                                <div key={r.id} className="flex items-center justify-between py-2.5 px-1">
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">
                                            {toSafeDate(r.fecha).toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })}
                                        </p>
                                        <p className="text-xs text-gray-400">{r.equipo?.nombre}</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-right">
                                        <div>
                                            <p className="text-xs font-semibold text-gray-700">{Number(r.horasTrabajadas)} hrs</p>
                                            <p className="text-xs text-gray-400">{Number(r.metrosLineales).toFixed(1)} m</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-semibold text-blue-600">{Number(r.litrosDiesel)} lt</p>
                                            <p className="text-xs text-gray-400">Lt/hr: {r.kpi?.litrosPorHora ?? '—'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Obras en curso */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-base font-semibold text-gray-800">Obras en curso</h2>
                        <Link href="/dashboard/obras" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            Ver todas <ExternalLink size={10} />
                        </Link>
                    </div>
                    {loading ? (
                        <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
                    ) : obras.length === 0 ? (
                        <div className="flex flex-col items-center py-6 gap-2">
                            <div className="p-3 bg-yellow-50 rounded-full"><FileText size={20} className="text-yellow-500" /></div>
                            <p className="text-sm text-gray-500 font-medium">Sin obras activas</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {obras.slice(0, 5).map((o: any) => (
                                <Link key={o.id} href={`/dashboard/obras/${o.id}`}
                                    className="flex items-center justify-between py-2.5 px-1 hover:bg-gray-50 rounded-lg transition-colors group">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600">{o.nombre}</p>
                                        <p className="text-xs text-gray-400">{getClienteNombre(o.cliente)}</p>
                                    </div>
                                    <div className="text-right ml-3 flex-shrink-0">
                                        <p className="text-xs font-semibold text-gray-700">{Number(o.metrosContratados ?? 0).toFixed(0)} m contrat.</p>
                                        <p className="text-xs text-gray-400">{Number(o.metrosPerforados ?? 0).toFixed(1)} m perf.</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
