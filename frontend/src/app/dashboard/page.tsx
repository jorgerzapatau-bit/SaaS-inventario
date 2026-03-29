"use client";

import { useEffect, useState, useMemo } from 'react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import {
    Package, AlertTriangle, DollarSign, ArrowUpCircle, ArrowDownCircle,
    RotateCcw, TrendingUp, TrendingDown, Minus, Percent,
    ShoppingCart, Ban, Warehouse, Calendar, ExternalLink, Clock, FileText, X
} from 'lucide-react';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import { fetchApi } from '@/lib/api';
import { useCompany } from '@/context/CompanyContext';
import Link from 'next/link';

// ── Tipos ──────────────────────────────────────────────────────────────
type PeriodKey = 'general' | 'este_mes' | 'mes_anterior' | 'ultimos_3m' | 'este_anio' | 'personalizado';
interface PeriodOption { key: PeriodKey; label: string; shortLabel: string; }

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
        case 'este_mes':     return { desde: startOfMonth,     hasta: now, prevDesde: startOfPrevMonth, prevHasta: endOfPrevMonth };
        case 'mes_anterior': return { desde: startOfPrevMonth, hasta: endOfPrevMonth, prevDesde: new Date(now.getFullYear(), now.getMonth() - 2, 1), prevHasta: new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59) };
        case 'ultimos_3m':   return { desde: start3m,          hasta: now, prevDesde: startPrev3m, prevHasta: endPrev3m };
        case 'este_anio':    return { desde: startOfYear,      hasta: now, prevDesde: startOfPrevYear, prevHasta: endOfPrevYear };
        default:             return { desde: new Date(0),      hasta: now, prevDesde: new Date(0), prevHasta: new Date(0) };
    }
}

// ── Helpers de display ─────────────────────────────────────────────────
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

// Tooltip inteligente para margen alto
function MargenTooltipDetalle({ margenPct, costoEntradas, ingresosSalidas }: {
    margenPct: number; costoEntradas: number; ingresosSalidas: number;
}) {
    const esAlto = margenPct > 60;
    return (
        <InfoTooltip position="top" text={
            esAlto
                ? `Margen alto (${margenPct.toFixed(1)}%): Ingresos $${fmt(ingresosSalidas)} − Costo $${fmt(costoEntradas)} = $${fmt(ingresosSalidas - costoEntradas)}. Puede ser real si las salidas tienen precio de venta muy superior al costo de entrada del período.`
                : `(Ingresos − Costo) ÷ Ingresos × 100. Ingresos: $${fmt(ingresosSalidas)}, Costo: $${fmt(costoEntradas)}.`
        } />
    );
}

// Estado vacío para gráfica
function EmptyChartState({ desde, hasta, onChangePeriod }: {
    desde: string; hasta: string; onChangePeriod: (k: PeriodKey) => void;
}) {
    const diffDays = desde && hasta
        ? Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000)
        : 0;
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 flex flex-col items-center justify-center gap-3 text-center min-h-[200px]">
            <div className="p-3 bg-gray-100 rounded-full">
                <RotateCcw size={22} className="text-gray-400" />
            </div>
            <div>
                <p className="text-sm font-semibold text-gray-600">Sin movimientos en el período seleccionado</p>
                <p className="text-xs text-gray-400 mt-1">
                    {diffDays <= 7
                        ? <>Período muy corto. Prueba con{' '}
                            <button onClick={() => onChangePeriod('este_mes')} className="underline text-blue-500">Este mes</button>
                            {' '}o{' '}
                            <button onClick={() => onChangePeriod('ultimos_3m')} className="underline text-blue-500">Últimos 3 meses</button>.
                          </>
                        : 'Registra entradas y salidas para ver la tendencia aquí.'
                    }
                </p>
            </div>
        </div>
    );
}

// ── Helpers: construyen URLs con filtros de período ────────────────────
function buildKardexUrl(tipo: string, desde: string, hasta: string) {
    const params = new URLSearchParams();
    if (tipo)  params.set('tipo', tipo);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    return `/dashboard/inventory?${params.toString()}`;
}

function buildPurchasesUrl(desde: string, hasta: string) {
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    return `/dashboard/purchases?${params.toString()}`;
}

function buildSalesUrl(desde: string, hasta: string) {
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    return `/dashboard/sales?${params.toString()}`;
}

// ── Componente principal ───────────────────────────────────────────────
export default function DashboardPage() {
    const [products, setProducts]   = useState<any[]>([]);
    const [movements, setMovements] = useState<any[]>([]);
    const [purchases, setPurchases] = useState<any[]>([]);
    const [loading, setLoading]     = useState(true);
    const [period, setPeriod]       = useState<PeriodKey>('general');
    const [showSinMovimiento, setShowSinMovimiento] = useState(false);
    const [pdfGenerating, setPdfGenerating] = useState(false);
    const [showPdfPreview, setShowPdfPreview] = useState(false);

    const { company } = useCompany();

    const now = new Date();
    const [manualDesde, setManualDesde] = useState<string>(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
    const [manualHasta, setManualHasta] = useState<string>(toInputDate(now));

    useEffect(() => {
        const load = async () => {
            try {
                const [prods, movs, purch] = await Promise.all([fetchApi('/products'), fetchApi('/inventory/movements'), fetchApi('/purchases')]);
                setProducts(prods);
                setMovements(movs);
                setPurchases(Array.isArray(purch) ? purch : []);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    const handlePeriodButton = (key: PeriodKey) => {
        setPeriod(key);
        setShowSinMovimiento(false);
        if (key === 'general') { setManualDesde(''); setManualHasta(toInputDate(new Date())); return; }
        const range = getPeriodRange(key);
        setManualDesde(toInputDate(range.desde));
        setManualHasta(toInputDate(range.hasta));
    };
    const handleManualDesde = (val: string) => { setManualDesde(val); setPeriod('personalizado'); };
    const handleManualHasta = (val: string) => { setManualHasta(val); setPeriod('personalizado'); };

    const desde: Date = useMemo(() => {
        if (period === 'general' || !manualDesde) return new Date(0);
        return new Date(manualDesde + 'T00:00:00');
    }, [period, manualDesde]);

    const hasta: Date = useMemo(() => {
        if (!manualHasta) return new Date();
        return new Date(manualHasta + 'T23:59:59');
    }, [manualHasta]);

    const prevRange = useMemo(() => {
        if (period === 'general' || period === 'personalizado') return null;
        return getPeriodRange(period);
    }, [period]);

    const isEntrada = (m: any) => ['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento);
    const isSalida  = (m: any) => ['SALIDA', 'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento);
    const sumCant   = (arr: any[]) => arr.reduce((a, m) => a + m.cantidad, 0);

    const startOfDay       = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const endOfYesterday   = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const movsActual = useMemo(() =>
        period === 'general'
            ? movements
            : movements.filter(m => { const f = new Date(m.fecha); return f >= desde && f <= hasta; }),
        [movements, period, desde, hasta]
    );
    const movsPrev = useMemo(() => {
        if (!prevRange) return [];
        return movements.filter(m => { const f = new Date(m.fecha); return f >= prevRange.prevDesde && f <= prevRange.prevHasta; });
    }, [movements, prevRange]);

    const movsHoy  = movements.filter(m => new Date(m.fecha) >= startOfDay);
    const movsAyer = movements.filter(m => { const f = new Date(m.fecha); return f >= startOfYesterday && f < endOfYesterday; });

    // ── KPIs ESTÁTICOS (estado actual, no dependen del filtro) ─────────
    const valorActualTotal = useMemo(() =>
        movements.reduce((acc, m) => {
            const v = Number(m.cantidad || 0) * Number(m.costoUnitario || 0);
            return acc + (isEntrada(m) ? v : -v);
        }, 0),
        [movements]
    );
    const categories       = new Set(products.map(p => p.categoria?.nombre).filter(Boolean)).size;
    const lowStockProducts = products.filter(p => p.stock <= p.stockMinimo);
    const totalStock       = products.reduce((a, p) => a + p.stock, 0);

    // ── KPIs DINÁMICOS (dependen del filtro) ──────────────────────────
    const valorSnapshotHasta = useMemo(() =>
        movements.filter(m => new Date(m.fecha) <= hasta)
            .reduce((acc, m) => { const v = Number(m.cantidad||0)*Number(m.costoUnitario||0); return acc + (isEntrada(m) ? v : -v); }, 0),
        [movements, hasta]
    );
    const valorSnapshotPrev = useMemo(() => {
        if (!prevRange) return 0;
        return movements.filter(m => new Date(m.fecha) <= prevRange.prevHasta)
            .reduce((acc, m) => { const v = Number(m.cantidad||0)*Number(m.costoUnitario||0); return acc + (isEntrada(m) ? v : -v); }, 0);
    }, [movements, prevRange]);

    const entradasActual = sumCant(movsActual.filter(isEntrada));
    const salidasActual  = sumCant(movsActual.filter(isSalida));
    const entradasPrev   = sumCant(movsPrev.filter(isEntrada));
    const salidasPrev    = sumCant(movsPrev.filter(isSalida));
    const entradasHoy    = sumCant(movsHoy.filter(isEntrada));
    const salidasHoy     = sumCant(movsHoy.filter(isSalida));
    const entradasAyer   = sumCant(movsAyer.filter(isEntrada));
    const salidasAyer    = sumCant(movsAyer.filter(isSalida));

    const rotacionNum  = totalStock > 0 ? (salidasActual / totalStock) * 100 : 0;
    const rotacionPrev = totalStock > 0 ? (salidasPrev / totalStock) * 100 : 0;

    const costoEntradas         = movsActual.filter(isEntrada).reduce((a, m) => a + Number(m.cantidad||0)*Number(m.costoUnitario||0), 0);
    const costoEntradasPrev     = movsPrev.filter(isEntrada).reduce((a, m) => a + Number(m.cantidad||0)*Number(m.costoUnitario||0), 0);
    const ingresosSalidas       = movsActual.filter(m => m.tipoMovimiento === 'SALIDA').reduce((a, m) => a + Number(m.cantidad||0)*Number(m.precioUnitario||m.costoUnitario||0), 0);
    const ingresosSalidasPrev   = movsPrev.filter(m => m.tipoMovimiento === 'SALIDA').reduce((a, m) => a + Number(m.cantidad||0)*Number(m.precioUnitario||m.costoUnitario||0), 0);
    const margenBruto           = ingresosSalidas - costoEntradas;
    const margenBrutoPrev       = ingresosSalidasPrev - costoEntradasPrev;
    const margenPct             = ingresosSalidas > 0 ? (margenBruto / ingresosSalidas) * 100 : 0;
    const margenPctPrev         = ingresosSalidasPrev > 0 ? (margenBrutoPrev / ingresosSalidasPrev) * 100 : 0;

    const productosConMov       = new Set(movsActual.map(m => m.productoId || m.producto?.id));
    const productosConMovPrev   = new Set(movsPrev.map(m => m.productoId || m.producto?.id));
    const sinMovimiento         = products.filter(p => !productosConMov.has(p.id));
    const sinMovimientoPrev     = products.filter(p => !productosConMovPrev.has(p.id));
    const valorInmovilizado     = sinMovimiento.reduce((a, p) => a + Number(p.stock||0)*Number(p.costoUnitario||0), 0);
    const pctInmovilizado       = valorActualTotal > 0 ? (valorInmovilizado / valorActualTotal) * 100 : 0;

    // Deltas
    const valuePct            = prevRange ? calcPct(valorSnapshotHasta, valorSnapshotPrev) : null;
    const entradasPct         = prevRange ? calcPct(entradasActual, entradasPrev)          : null;
    const salidasPct          = prevRange ? calcPct(salidasActual, salidasPrev)            : null;
    const entradasHoyPct      = calcPct(entradasHoy, entradasAyer);
    const salidasHoyPct       = calcPct(salidasHoy, salidasAyer);
    const rotacionPct         = prevRange ? calcPct(rotacionNum, rotacionPrev)             : null;
    const costoEntradasDelta  = prevRange ? calcPct(costoEntradas, costoEntradasPrev)      : null;
    const ingresosDelta       = prevRange ? calcPct(ingresosSalidas, ingresosSalidasPrev)  : null;
    const margenBrutoDelta    = prevRange ? calcPct(margenBruto, margenBrutoPrev)          : null;
    const margenPorcentDelta  = prevRange ? calcPct(margenPct, margenPctPrev)              : null;
    const sinMovDelta         = prevRange ? calcPct(sinMovimiento.length, sinMovimientoPrev.length) : null;

    // Gráfica
    const chartDateRange = useMemo(() => {
        if (period === 'general' || !manualDesde) return null;
        return { desde: manualDesde, hasta: manualHasta || toInputDate(new Date()), isAllTime: false };
    }, [period, manualDesde, manualHasta]);

    const puntosEnGrafica = useMemo(() => {
        const meses = new Set(movsActual.map(m => { const f = new Date(m.fecha); return `${f.getFullYear()}-${f.getMonth()}`; }));
        return meses.size;
    }, [movsActual]);
    const graficaVacia    = movsActual.length === 0;
    const graficaPocaData = movsActual.length > 0 && puntosEnGrafica <= 1;

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

    // Fecha y hora actual para mostrar en la zona estática
    const fechaActual = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // ── Helpers para el PDF ────────────────────────────────────────────
    const margenColor  = margenBruto >= 0 ? '#16a34a' : '#dc2626';
    const margenBgColor = margenBruto >= 0 ? '#f0fdf4' : '#fef2f2';

    const buildPdfHtml = () => {
        const empresaNombre = company?.nombre || 'Mi Empresa';
        const empresaLogo   = company?.logo   || null;
        const fechaGen = now.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

        const kpiCard = (label: string, value: string, sub?: string, color = '#1e293b') => `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;flex:1;min-width:160px">
                <p style="font-size:11px;color:#64748b;margin:0 0 6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">${label}</p>
                <p style="font-size:22px;font-weight:800;color:${color};margin:0">${value}</p>
                ${sub ? `<p style="font-size:11px;color:#94a3b8;margin:4px 0 0">${sub}</p>` : ''}
            </div>`;

        const finRow = (label: string, value: string, color = '#1e293b', bold = false) => `
            <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:10px 0;font-size:13px;color:#475569">${label}</td>
                <td style="padding:10px 0;font-size:13px;font-weight:${bold ? 700 : 500};color:${color};text-align:right">${value}</td>
            </tr>`;

        return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Resumen Ejecutivo — ${empresaNombre}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; background: #fff; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    @page { margin: 18mm 15mm; size: A4; }
  }
  .page { max-width: 780px; margin: 0 auto; padding: 32px 28px; }
  h2 { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .8px; margin: 28px 0 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  .badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; }
  .badge-green { background:#dcfce7; color:#16a34a; }
  .badge-red   { background:#fee2e2; color:#dc2626; }
  .badge-amber { background:#fef3c7; color:#d97706; }
  .print-btn { position:fixed; bottom:24px; right:24px; background:#2563eb; color:#fff; border:none; padding:12px 24px; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(37,99,235,.35); }
  .print-btn:hover { background:#1d4ed8; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #2563eb;padding-bottom:18px;margin-bottom:4px">
    <div style="display:flex;align-items:center;gap:14px">
      ${empresaLogo
        ? `<img src="${empresaLogo}" alt="${empresaNombre}" style="height:48px;width:auto;object-fit:contain;border-radius:6px"/>`
        : `<div style="width:48px;height:48px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center">
             <span style="color:#fff;font-size:22px;font-weight:800">${empresaNombre.charAt(0).toUpperCase()}</span>
           </div>`}
      <div>
        <p style="font-size:20px;font-weight:800;color:#1e293b">${empresaNombre}</p>
        <p style="font-size:12px;color:#64748b;margin-top:2px">Resumen Ejecutivo de Inventario</p>
      </div>
    </div>
    <div style="text-align:right">
      <p style="font-size:12px;color:#94a3b8">Generado</p>
      <p style="font-size:12px;font-weight:600;color:#475569">${fechaGen}</p>
      <p style="font-size:11px;color:#94a3b8;margin-top:4px">Período: <strong>${selectedPeriodLabel}</strong></p>
    </div>
  </div>

  <!-- ESTADO ACTUAL -->
  <h2>Estado Actual del Inventario</h2>
  <div style="display:flex;gap:12px;flex-wrap:wrap">
    ${kpiCard('Valor de Inventario', `$${fmt(valorActualTotal)}`, `${products.length} SKUs · ${categories} categorías`)}
    ${kpiCard('Total Productos', `${products.length}`, `${totalStock.toLocaleString()} unidades en stock`)}
    ${kpiCard('Stock bajo mínimo', `${lowStockProducts.length}`, lowStockProducts.length > 0 ? 'requieren reabastecimiento' : 'Sin alertas', lowStockProducts.length > 0 ? '#d97706' : '#16a34a')}
  </div>

  ${lowStockProducts.length > 0 ? `
  <div style="margin-top:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px">
    <p style="font-size:12px;font-weight:700;color:#d97706;margin-bottom:8px">⚠ Productos con stock crítico</p>
    <table>
      <thead>
        <tr style="border-bottom:1px solid #fde68a">
          <th style="text-align:left;font-size:11px;color:#92400e;padding-bottom:6px">Producto</th>
          <th style="text-align:left;font-size:11px;color:#92400e;padding-bottom:6px">SKU</th>
          <th style="text-align:right;font-size:11px;color:#92400e;padding-bottom:6px">Stock actual</th>
          <th style="text-align:right;font-size:11px;color:#92400e;padding-bottom:6px">Mínimo</th>
        </tr>
      </thead>
      <tbody>
        ${lowStockProducts.map(p => `
        <tr style="border-bottom:1px solid #fef3c7">
          <td style="padding:7px 0;font-size:12px;color:#1e293b">${p.nombre}</td>
          <td style="padding:7px 0;font-size:12px;color:#64748b">${p.sku}</td>
          <td style="padding:7px 0;font-size:12px;font-weight:700;color:#dc2626;text-align:right">${p.stock}</td>
          <td style="padding:7px 0;font-size:12px;color:#64748b;text-align:right">${p.stockMinimo}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- MOVIMIENTOS -->
  <h2>Movimientos del Período</h2>
  <div style="display:flex;gap:12px;flex-wrap:wrap">
    ${kpiCard('Entradas totales', `+${entradasActual.toLocaleString()} uds`, 'unidades recibidas', '#16a34a')}
    ${kpiCard('Salidas totales',  `-${salidasActual.toLocaleString()} uds`, 'unidades despachadas', '#dc2626')}
    ${kpiCard('Rotación del período', `${rotacionNum.toFixed(1)}%`, 'salidas / stock total')}
  </div>

  <!-- FINANZAS -->
  <h2>Finanzas del Período</h2>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:6px 20px">
    <table>
      <tbody>
        ${finRow('Costo de entradas',   `$${fmt(costoEntradas)}`)}
        ${finRow('Ingresos por salidas',`$${fmt(ingresosSalidas)}`, '#16a34a')}
        ${finRow('Margen bruto',        `$${fmt(margenBruto)}`,     margenColor, true)}
        ${finRow('Margen %',            `${margenPct.toFixed(1)}%`, margenColor, true)}
        ${finRow('Productos sin movimiento', `${sinMovimiento.length}`, '#64748b')}
      </tbody>
    </table>
  </div>

  <!-- FOOTER -->
  <div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:14px;display:flex;justify-content:space-between;align-items:center">
    <p style="font-size:11px;color:#94a3b8">Documento generado automáticamente · ${empresaNombre}</p>
    <p style="font-size:11px;color:#94a3b8">${fechaGen}</p>
  </div>

</div>
<button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
</body>
</html>`;
    };

    const handleExportClick = () => {
        setPdfGenerating(true);
        // Pequeño delay para mostrar el spinner antes de construir el DOM
        setTimeout(() => {
            setPdfGenerating(false);
            setShowPdfPreview(true);
        }, 400);
    };

    const handlePrint = () => {
        const html   = buildPdfHtml();
        const win    = window.open('', '_blank', 'width=900,height=700');
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.focus();
        // Dar tiempo al navegador para cargar el logo si existe
        setTimeout(() => win.print(), 800);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* ── Modal Vista Previa PDF ─────────────────────────────── */}
            {showPdfPreview && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        {/* Header modal */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <FileText size={18} className="text-blue-600"/>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900 text-sm">Resumen Ejecutivo listo</p>
                                    <p className="text-xs text-gray-400">PDF · {company?.nombre || 'Mi Empresa'} · {selectedPeriodLabel}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPdfPreview(false)}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                <X size={18}/>
                            </button>
                        </div>
                        {/* Vista previa de secciones */}
                        <div className="px-6 py-4 space-y-3">
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">El PDF incluye</p>
                            {[
                                { icon: '📦', label: 'Estado actual del inventario', sub: `$${fmt(valorActualTotal)} · ${products.length} productos` },
                                { icon: '📊', label: 'Movimientos del período',      sub: `+${entradasActual} entradas · -${salidasActual} salidas` },
                                { icon: '💰', label: 'Finanzas del período',         sub: `Margen ${margenPct.toFixed(1)}% · Ingresos $${fmt(ingresosSalidas)}` },
                                ...(lowStockProducts.length > 0
                                    ? [{ icon: '⚠️', label: 'Stock crítico', sub: `${lowStockProducts.length} producto${lowStockProducts.length > 1 ? 's' : ''} bajo mínimo` }]
                                    : []),
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                    <span className="text-lg">{item.icon}</span>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                                        <p className="text-xs text-gray-400">{item.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Acciones */}
                        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                            <button onClick={() => setShowPdfPreview(false)}
                                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                                Cancelar
                            </button>
                            <button onClick={() => { setShowPdfPreview(false); handlePrint(); }}
                                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center gap-2">
                                <FileText size={15}/> Abrir y descargar PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Resumen General</h1>
                    <p className="text-sm text-gray-400 mt-0.5 capitalize">{fechaActual}</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <button onClick={handleExportClick} disabled={pdfGenerating}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-60">
                        {pdfGenerating
                            ? <><span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin inline-block"/><span>Generando…</span></>
                            : <><FileText size={16}/> Exportar resumen</>
                        }
                    </button>
                    <Link href="/dashboard/purchases/new" className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                        <ArrowUpCircle size={16} /> Nueva Entrada
                    </Link>
                    <Link href="/dashboard/sales/new" className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                        <ArrowDownCircle size={16} /> Registrar Salida
                    </Link>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                ZONA A — ESTADO ACTUAL DEL INVENTARIO
                Estos KPIs son SIEMPRE "ahora", no cambian con el filtro
            ══════════════════════════════════════════════════════════ */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                {/* Encabezado zona estática */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Estado actual del inventario</p>
                    </div>
                    <span className="text-xs text-slate-400 italic flex items-center gap-1">
                        <Clock size={11} /> No varía con el filtro de período
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                    {/* Valor inventario AHORA */}
                    <Link href="/dashboard/products" className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition-all group block">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-blue-600 transition-colors">Valor inventario</p>
                                <InfoTooltip text="Σ(entradas × costo) − Σ(salidas × costo) de todos los movimientos históricos. Refleja el valor en libros del inventario hoy. Para ver el desglose completo por producto, ve a Reportes → Inventario Valorizado." />
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg"><DollarSign size={16} className="text-blue-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">
                            {loading ? '...' : `$${fmt(valorActualTotal)}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            {products.length} SKUs · {categories} categorías
                            <ExternalLink size={10} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                        </p>
                    </Link>

                    {/* Total productos AHORA */}
                    <Link href="/dashboard/products" className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-purple-200 transition-all group block">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-purple-600 transition-colors">Total productos</p>
                                <InfoTooltip text="Número total de SKUs en el catálogo. Estado actual del sistema." />
                            </div>
                            <div className="p-2 bg-purple-50 rounded-lg"><Package size={16} className="text-purple-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{loading ? '...' : products.length}</p>
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            {categories} categorías · {totalStock.toLocaleString()} unidades en stock
                            <ExternalLink size={10} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-purple-400" />
                        </p>
                    </Link>

                    {/* Stock bajo mínimo AHORA */}
                    <div className={`rounded-xl border shadow-sm p-5 ${lowStockProducts.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className={`text-sm font-medium ${lowStockProducts.length > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                                    Stock bajo mínimo
                                </p>
                                <InfoTooltip text="Productos con stock actual ≤ stock mínimo configurado. Siempre es el estado de hoy." position="top" />
                            </div>
                            <div className={`p-2 rounded-lg ${lowStockProducts.length > 0 ? 'bg-orange-100' : 'bg-gray-100'}`}>
                                <AlertTriangle size={16} className={lowStockProducts.length > 0 ? 'text-orange-500' : 'text-gray-400'} />
                            </div>
                        </div>
                        <p className={`text-3xl font-bold ${lowStockProducts.length > 0 ? 'text-orange-600' : 'text-gray-800'}`}>
                            {loading ? '...' : `${lowStockProducts.length} productos`}
                        </p>
                        <Link
                            href={lowStockProducts.length > 0 ? '/dashboard/products?stock=bajo' : '/dashboard/products'}
                            className={`text-xs mt-2 inline-flex items-center gap-1 hover:underline ${lowStockProducts.length > 0 ? 'text-orange-500' : 'text-gray-400'}`}
                        >
                            {lowStockProducts.length > 0 ? <>Ver detalles <ExternalLink size={10} /></> : 'Todo en orden ✓'}
                        </Link>
                    </div>

                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                FILTRO DE PERÍODO
                Divide visualmente las dos zonas
            ══════════════════════════════════════════════════════════ */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Calendar size={16} className="text-blue-500" />
                    <span className="text-sm font-semibold text-gray-700">Filtrar período:</span>
                </div>
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
                        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white border border-purple-600">
                            Personalizado
                        </span>
                    )}
                </div>
                <div className="hidden sm:block w-px h-5 bg-gray-200 flex-shrink-0" />
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-medium">Desde</span>
                        <input type="date" value={manualDesde} onChange={e => handleManualDesde(e.target.value)}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-medium">Hasta</span>
                        <input type="date" value={manualHasta} onChange={e => handleManualHasta(e.target.value)}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white" />
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                ZONA B — ACTIVIDAD DEL PERÍODO
                Todo lo que hay debajo responde al filtro de fecha
            ══════════════════════════════════════════════════════════ */}

            {/* SECCIÓN — MOVIMIENTOS ──────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Movimientos del período</p>
                    <span className="text-xs text-blue-500 font-medium px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">
                        {selectedPeriodLabel}
                    </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

                    {/* Entradas */}
                    <Link href={buildKardexUrl('ENTRADA', manualDesde, manualHasta)} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-green-600 transition-colors">
                                    {period === 'general' ? 'Entradas totales' : period === 'este_mes' ? 'Entradas del mes' : 'Entradas período'}
                                </p>
                                <InfoTooltip text="Suma de unidades ENTRADA + AJUSTE_POSITIVO en el período." />
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg"><ArrowUpCircle size={16} className="text-green-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-green-600">
                            {loading ? '...' : `+${entradasActual}`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : (
                                period === 'este_mes' ? (
                                    <><DeltaBadge pct={entradasHoyPct} label="vs ayer" />
                                    <span className="text-xs text-gray-400">· hoy: +{entradasHoy}</span>
                                    {entradasPct !== null && <DeltaBadge pct={entradasPct} label={compareLabel} />}</>
                                ) : <DeltaBadge pct={entradasPct} label={compareLabel || undefined} />
                            )}
                        </div>
                        <p className="text-xs text-blue-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <ExternalLink size={10} /> Ver en kardex
                        </p>
                    </Link>

                    {/* Salidas */}
                    <Link href={buildKardexUrl('SALIDA', manualDesde, manualHasta)} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-red-500 transition-colors">
                                    {period === 'general' ? 'Salidas totales' : period === 'este_mes' ? 'Salidas del mes' : 'Salidas período'}
                                </p>
                                <InfoTooltip text="Suma de unidades SALIDA + AJUSTE_NEGATIVO en el período." />
                            </div>
                            <div className="p-2 bg-red-50 rounded-lg"><ArrowDownCircle size={16} className="text-red-500" /></div>
                        </div>
                        <p className="text-3xl font-bold text-red-500">
                            {loading ? '...' : `-${salidasActual}`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : (
                                period === 'este_mes' ? (
                                    <><DeltaBadge pct={salidasHoyPct} label="vs ayer" />
                                    <span className="text-xs text-gray-400">· hoy: -{salidasHoy}</span>
                                    {salidasPct !== null && <DeltaBadge pct={salidasPct} label={compareLabel} />}</>
                                ) : <DeltaBadge pct={salidasPct} label={compareLabel || undefined} />
                            )}
                        </div>
                        <p className="text-xs text-blue-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <ExternalLink size={10} /> Ver en kardex
                        </p>
                    </Link>

                    {/* Rotación */}
                    <Link href={buildKardexUrl('', manualDesde, manualHasta)} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-teal-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-teal-600 transition-colors">Rotación del período</p>
                                <InfoTooltip text="(Salidas del período ÷ Stock total actual) × 100." position="top" />
                            </div>
                            <div className="p-2 bg-teal-50 rounded-lg"><RotateCcw size={16} className="text-teal-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{loading ? '...' : `${rotacionNum.toFixed(1)}%`}</p>
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={rotacionPct} label={compareLabel || undefined} />}
                        </div>
                        <p className="text-xs text-teal-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <ExternalLink size={10} /> Ver movimientos del período
                        </p>
                    </Link>

                </div>
            </div>

            {/* SECCIÓN — FINANZAS ─────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Finanzas del período</p>
                    <span className="text-xs text-blue-500 font-medium px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">
                        {selectedPeriodLabel}
                    </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

                    {/* Costo entradas */}
                    <Link href={buildPurchasesUrl(manualDesde, manualHasta)} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-blue-600 transition-colors">Costo de entradas</p>
                                <InfoTooltip text="Σ(cantidad × costoUnitario) de entradas en el período. Capital invertido en compras." />
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg"><ShoppingCart size={16} className="text-blue-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{loading ? '...' : `$${fmt(costoEntradas)}`}</p>
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={costoEntradasDelta} label={compareLabel || undefined} />}
                        </div>
                        <p className="text-xs text-blue-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <ExternalLink size={10} /> Ver compras del período
                        </p>
                    </Link>

                    {/* Ingresos salidas */}
                    <Link href={buildSalesUrl(manualDesde, manualHasta)} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-green-600 transition-colors">Ingresos por salidas</p>
                                <InfoTooltip text="Σ(cantidad × precioVenta) de salidas tipo SALIDA en el período." />
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg"><TrendingUp size={16} className="text-green-600" /></div>
                        </div>
                        <p className="text-3xl font-bold text-green-600">{loading ? '...' : `$${fmt(ingresosSalidas)}`}</p>
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={ingresosDelta} label={compareLabel || undefined} />}
                        </div>
                        <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-blue-400 flex items-center gap-1">
                                <ExternalLink size={10} /> Ver ventas
                            </span>
                            <span className="text-xs text-gray-300">·</span>
                            <a href={buildKardexUrl('SALIDA', manualDesde, manualHasta)}
                               onClick={e => e.stopPropagation()}
                               className="text-xs text-gray-400 hover:text-blue-400 flex items-center gap-1 transition-colors">
                                <ExternalLink size={10} /> Kardex
                            </a>
                        </div>
                    </Link>

                    {/* Margen bruto */}
                    <Link href={buildSalesUrl(manualDesde, manualHasta)} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group block p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-emerald-600 transition-colors">Margen bruto</p>
                                <InfoTooltip text="Ingresos por salidas − Costo de entradas del período." position="top" />
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign size={16} className="text-emerald-600" /></div>
                        </div>
                        <p className={`text-3xl font-bold ${margenBruto >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {loading ? '...' : `$${fmt(margenBruto)}`}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={margenBrutoDelta} label={compareLabel || undefined} />}
                        </div>
                        <p className="text-xs text-emerald-500 mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <ExternalLink size={10} /> Ver ventas del período
                        </p>
                    </Link>

                    {/* Margen % */}
                    <Link href={buildKardexUrl('', manualDesde, manualHasta)} className={`rounded-xl border shadow-sm hover:shadow-md transition-all group block p-5 ${!loading && margenPct > 80 && ingresosSalidas > 0 ? 'bg-amber-50 border-amber-200 hover:border-amber-400' : 'bg-white border-gray-100 hover:border-emerald-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm text-gray-500 font-medium group-hover:text-emerald-600 transition-colors">Margen %</p>
                                {!loading && <MargenTooltipDetalle margenPct={margenPct} costoEntradas={costoEntradas} ingresosSalidas={ingresosSalidas} />}
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg"><Percent size={16} className="text-emerald-600" /></div>
                        </div>
                        <p className={`text-3xl font-bold ${margenPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {loading ? '...' : `${margenPct.toFixed(1)}%`}
                        </p>
                        {!loading && margenPct > 80 && ingresosSalidas > 0 && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <AlertTriangle size={11} /> Margen alto — revisa el tooltip
                            </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : <DeltaBadge pct={margenPorcentDelta} label={compareLabel || undefined} />}
                        </div>
                        <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-emerald-500 flex items-center gap-1"><ExternalLink size={10} /> Ventas</span>
                            <span className="text-xs text-gray-300">·</span>
                            <a href={buildPurchasesUrl(manualDesde, manualHasta)}
                               onClick={e => e.stopPropagation()}
                               className="text-xs text-gray-400 hover:text-blue-400 flex items-center gap-1 transition-colors">
                                <ExternalLink size={10} /> Compras
                            </a>
                        </div>
                    </Link>

                    {/* Sin movimiento */}
                    <Link href={sinMovimiento.length > 0 ? `/dashboard/products?sinMovimiento=1&desde=${manualDesde}&hasta=${manualHasta}` : '/dashboard/products'} className={`rounded-xl border shadow-sm hover:shadow-md transition-all group block p-5 ${sinMovimiento.length > 0 ? 'bg-red-50 border-red-200 hover:border-red-400' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className={`text-sm font-medium ${sinMovimiento.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>Sin movimiento</p>
                                <InfoTooltip text="Productos sin entradas ni salidas en el período seleccionado." position="top" />
                            </div>
                            <div className={`p-2 rounded-lg ${sinMovimiento.length > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                                <Ban size={16} className={sinMovimiento.length > 0 ? 'text-red-500' : 'text-gray-400'} />
                            </div>
                        </div>
                        <p className={`text-3xl font-bold ${sinMovimiento.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                            {loading ? '...' : `${sinMovimiento.length} items`}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {loading ? <p className="text-xs text-gray-400">Cargando...</p> : sinMovimiento.length > 0 ? (
                                <><DeltaBadge pct={sinMovDelta} label={compareLabel || undefined} />
                                <button onClick={() => setShowSinMovimiento(v => !v)} className="text-xs text-red-500 hover:underline">
                                    {showSinMovimiento ? 'Ocultar ▲' : 'Ver productos ▼'}
                                </button></>
                            ) : <DeltaBadge pct={sinMovDelta} label={compareLabel || undefined} />}
                        </div>
                        {showSinMovimiento && sinMovimiento.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-red-100 space-y-1 max-h-40 overflow-y-auto">
                                {sinMovimiento.map((p: any) => (
                                    <Link key={p.id} href={`/dashboard/products/${p.id}`}
                                        className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-red-100 transition-colors group">
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-gray-700 truncate group-hover:text-red-700">{p.nombre}</p>
                                            <p className="text-xs text-gray-400">{p.sku} · Stock: {p.stock}</p>
                                        </div>
                                        <ExternalLink size={11} className="text-gray-300 group-hover:text-red-400 flex-shrink-0 ml-2" />
                                    </Link>
                                ))}
                            </div>
                        )}
                        {sinMovimiento.length > 0 && (
                            <p className="text-xs text-red-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <ExternalLink size={10} /> Ver todos en productos
                            </p>
                        )}
                    </Link>

                    {/* Valor inmovilizado */}
                    <div className={`rounded-xl border shadow-sm hover:shadow-md transition-shadow p-5 ${valorInmovilizado > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <p className={`text-sm font-medium ${valorInmovilizado > 0 ? 'text-red-600' : 'text-gray-500'}`}>Valor inmovilizado</p>
                                <InfoTooltip text="Σ(stock × costoUnitario) de productos sin movimiento en el período." position="top" />
                            </div>
                            <div className={`p-2 rounded-lg ${valorInmovilizado > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                                <Warehouse size={16} className={valorInmovilizado > 0 ? 'text-red-500' : 'text-gray-400'} />
                            </div>
                        </div>
                        <p className={`text-3xl font-bold ${valorInmovilizado > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                            {loading ? '...' : `$${fmt(valorInmovilizado)}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                            {loading ? '' : valorInmovilizado === 0
                                ? 'Sin capital inmovilizado en el período'
                                : `${pctInmovilizado.toFixed(1)}% del inventario total`
                            }
                        </p>
                    </div>

                </div>
            </div>

            {/* ── Tendencia ─────────────────────────────────────────── */}
            {!loading && graficaVacia ? (
                <EmptyChartState desde={manualDesde} hasta={manualHasta} onChangePeriod={handlePeriodButton} />
            ) : !loading && graficaPocaData ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                        <AlertTriangle size={14} className="flex-shrink-0" />
                        <span>
                            Pocos datos en el período — la gráfica puede no ser representativa. Prueba con{' '}
                            <button onClick={() => handlePeriodButton('este_mes')} className="underline font-semibold">Este mes</button>
                            {' '}o{' '}
                            <button onClick={() => handlePeriodButton('ultimos_3m')} className="underline font-semibold">Últimos 3 meses</button>.
                        </span>
                    </div>
                    <AnalyticsChart externalMovements={movements} externalDateRange={chartDateRange} />
                </div>
            ) : (
                <AnalyticsChart externalMovements={movements} externalDateRange={chartDateRange} />
            )}

            {/* ── Operaciones ───────────────────────────────────────── */}
            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Operaciones</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-base font-semibold text-gray-800">Stock crítico</h2>
                            <Link href="/dashboard/products" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                Ver todos <ExternalLink size={10} />
                            </Link>
                        </div>
                        {loading ? (
                            <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
                        ) : lowStockProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-6 gap-2">
                                <div className="p-3 bg-green-50 rounded-full"><Package size={20} className="text-green-500" /></div>
                                <p className="text-sm text-gray-500 font-medium">Todo el inventario está sobre el mínimo</p>
                                <p className="text-xs text-gray-400">No hay productos en estado crítico</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {lowStockProducts.slice(0, 6).map((p: any) => {
                                    const isCritical = p.stock <= Math.floor(p.stockMinimo * 0.5);
                                    return (
                                        <Link key={p.id} href={`/dashboard/products/${p.id}`}
                                            className="flex items-center justify-between py-2.5 group hover:bg-gray-50 px-1 rounded-lg transition-colors">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600">{p.nombre}</p>
                                                <p className="text-xs text-gray-400">{p.sku || '—'}</p>
                                            </div>
                                            <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    Stock: {p.stock}
                                                </span>
                                                <span className="text-xs text-gray-400">Mín: {p.stockMinimo}</span>
                                            </div>
                                        </Link>
                                    );
                                })}
                                {lowStockProducts.length > 6 && (
                                    <div className="pt-2">
                                        <Link href="/dashboard/products" className="text-xs text-blue-500 hover:underline">
                                            + {lowStockProducts.length - 6} productos más con stock crítico →
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-base font-semibold text-gray-800">Compras pendientes</h2>
                            <Link href="/dashboard/purchases?status=PENDIENTE" className="text-xs text-blue-500 hover:underline">Ver todas →</Link>
                        </div>
                        {loading ? (
                            <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
                        ) : purchases.filter((c: any) => c.status === 'PENDIENTE').length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-6 gap-2">
                                <div className="p-3 bg-green-50 rounded-full"><ShoppingCart size={20} className="text-green-500" /></div>
                                <p className="text-sm text-gray-500 font-medium">Sin compras pendientes</p>
                                <p className="text-xs text-gray-400">Todas las órdenes están completadas</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {purchases
                                    .filter((c: any) => c.status === 'PENDIENTE')
                                    .slice(0, 6)
                                    .map((c: any) => (
                                        <Link key={c.id} href="/dashboard/purchases?status=PENDIENTE"
                                            className="flex items-center justify-between py-2.5 group hover:bg-gray-50 px-1 rounded-lg transition-colors">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600">
                                                    {c.proveedor?.nombre || 'Sin proveedor'}
                                                </p>
                                                <p className="text-xs text-gray-400">{c.referencia || '—'} · {new Date(c.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</p>
                                            </div>
                                            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
                                                    ${Number(c.total).toLocaleString('es-MX')}
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                {purchases.filter((c: any) => c.status === 'PENDIENTE').length > 6 && (
                                    <div className="pt-2">
                                        <Link href="/dashboard/purchases" className="text-xs text-blue-500 hover:underline">
                                            + {purchases.filter((c: any) => c.status === 'PENDIENTE').length - 6} compras pendientes más →
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
