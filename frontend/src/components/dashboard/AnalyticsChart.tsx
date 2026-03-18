"use client";

import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { Card, CardContent } from '@/components/ui/Card';
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { fetchApi } from '@/lib/api';

type MetricType = 'cantidad' | 'costo' | 'ingresos' | 'margen' | 'valorAlmacen';

function toInputDate(d: Date) { return d.toISOString().split('T')[0]; }

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function buildChartData(movements: any[], desde: string, hasta: string, metric: MetricType) {
    // Usar medianoche UTC para evitar problemas de timezone (Supabase guarda en UTC)
    const desdeDate = desde ? new Date(desde + 'T00:00:00Z') : null;
    const hastaDate = hasta ? new Date(hasta + 'T23:59:59Z') : null;

    // ── Métrica especial: Valor en almacén ──────────────────────────────────
    // Usa TODOS los movimientos para acumular el saldo real,
    // pero solo muestra los meses dentro del rango desde/hasta
    if (metric === 'valorAlmacen') {
        // 1. Construir saldo acumulado mes a mes con TODOS los movimientos
        const allBuckets: Record<string, { name: string; delta: number }> = {};
        movements.forEach((mov) => {
            const fecha = new Date(mov.fecha);
            const key = `${fecha.getFullYear()}-${String(fecha.getMonth()).padStart(2, '0')}`;
            const label = `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
            if (!allBuckets[key]) allBuckets[key] = { name: label, delta: 0 };
            const costo = Number(mov.costoUnitario || 0);
            const qty = Number(mov.cantidad || 0);
            const isEntrada = ['ENTRADA','AJUSTE_POSITIVO'].includes(mov.tipoMovimiento);
            const isSalida  = ['SALIDA','AJUSTE_NEGATIVO'].includes(mov.tipoMovimiento);
            if (isEntrada) allBuckets[key].delta += qty * costo;
            if (isSalida)  allBuckets[key].delta -= qty * costo;
        });

        // 2. Calcular saldo acumulado progresivo para TODOS los meses
        const allSorted = Object.keys(allBuckets).sort();
        let saldoAcum = 0;
        const saldoPorMes: Record<string, { name: string; saldo: number }> = {};
        for (const k of allSorted) {
            saldoAcum += allBuckets[k].delta;
            saldoPorMes[k] = { name: allBuckets[k].name, saldo: saldoAcum };
        }

        // 3. Filtrar solo los meses dentro del rango visible
        return allSorted
            .filter(k => {
                const [y, m] = k.split('-').map(Number);
                const mesDate = new Date(y, m, 1);
                if (desdeDate && mesDate < new Date(desdeDate.getFullYear(), desdeDate.getMonth(), 1)) return false;
                if (hastaDate && mesDate > new Date(hastaDate.getFullYear(), hastaDate.getMonth() + 1, 0)) return false;
                return true;
            })
            .map(k => ({ name: saldoPorMes[k].name, entradas: saldoPorMes[k].saldo, salidas: 0 }));
    }

    // ── Otras métricas: flujo mensual filtrado por rango ────────────────────
    const buckets: Record<string, { name: string; entradas: number; salidas: number }> = {};
    movements.forEach((mov) => {
        const fecha = new Date(mov.fecha);
        if (desdeDate && fecha < desdeDate) return;
        if (hastaDate && fecha > hastaDate) return;
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth()).padStart(2, '0')}`;
        const label = `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
        if (!buckets[key]) buckets[key] = { name: label, entradas: 0, salidas: 0 };
        const costo = Number(mov.costoUnitario || 0);
        const pventa = Number(mov.precioVenta || 0);
        const qty = Number(mov.cantidad || 0);
        const isEntrada = ['ENTRADA','AJUSTE_POSITIVO'].includes(mov.tipoMovimiento);
        const isSalida = ['SALIDA','AJUSTE_NEGATIVO'].includes(mov.tipoMovimiento);
        if (metric === 'cantidad') {
            if (isEntrada) buckets[key].entradas += qty;
            else buckets[key].salidas += qty;
        } else if (metric === 'costo') {
            if (isEntrada) buckets[key].entradas += qty * costo;
            else buckets[key].salidas += qty * costo;
        } else if (metric === 'ingresos') {
            if (isSalida && pventa > 0) buckets[key].salidas += qty * pventa;
            if (isEntrada) buckets[key].entradas += qty * costo;
        } else if (metric === 'margen') {
            if (isSalida) {
                buckets[key].salidas += pventa > 0 ? qty * pventa : 0;
                buckets[key].entradas += qty * costo;
            }
        }
    });
    return Object.keys(buckets).sort().map(k => buckets[k]);
}

function formatTick(value: number, metric: MetricType) {
    if (metric === 'cantidad') return value.toLocaleString('es-MX');
    return `$${(value / 1000).toFixed(0)}k`; // costo, ingresos, margen, valorAlmacen
}

function formatTooltip(value: number, name: string, metric: MetricType) {
    // Para valorAlmacen, salidas siempre es 0 — no mostrar
    if (metric === 'valorAlmacen') {
        if (name === 'salidas' || value === 0) return ['', ''];
        return [`$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, 'Valor en almacén'];
    }
    const formatted = metric === 'cantidad'
        ? value.toLocaleString('es-MX')
        : `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
    if (metric === 'margen') return [formatted, name === 'entradas' ? 'Costo vendido' : 'Ingresos venta'];
    return [formatted, name === 'entradas' ? 'Entradas' : 'Salidas'];
}

const METRICS: { key: MetricType; label: string; color: string; tooltip: string }[] = [
    { key: 'cantidad',     label: 'Cantidad',           color: 'bg-blue-50 text-blue-700 border-blue-200',   tooltip: 'Unidades físicas movidas por mes. Azul = entradas al almacén, rojo = salidas. No considera precios.' },
    { key: 'costo',        label: '$ Costo compras',    color: 'bg-green-50 text-green-700 border-green-200', tooltip: 'Azul = dinero invertido en compras ese mes (Σ cantidad × costoUnitario de entradas). Rojo = costo de lo que salió del almacén.' },
    { key: 'ingresos',     label: '$ Ingresos venta',   color: 'bg-teal-50 text-teal-700 border-teal-200',   tooltip: 'Azul = inversión en compras (costo). Rojo = dinero recuperado por ventas (Σ cantidad × precioVenta de salidas). Si hay salidas sin precio registrado aparecen como $0.' },
    { key: 'margen',       label: '$ Margen bruto',     color: 'bg-purple-50 text-purple-700 border-purple-200', tooltip: 'Verde = ingresos por ventas. Amarillo = costo de lo vendido. La diferencia visual entre ambas líneas es tu ganancia bruta del mes.' },
    { key: 'valorAlmacen', label: '$ Valor en almacén', color: 'bg-amber-50 text-amber-700 border-amber-200', tooltip: 'Saldo acumulado del inventario mes a mes: Σ(costos de entradas) − Σ(costos de salidas) desde el inicio. El punto final siempre coincide con el KPI "Valor inventario" del dashboard.' },
];

interface Props {
    // Si se pasan movimientos externos, no hace fetch propio
    externalMovements?: any[];
    // Título opcional para contexto (ej: "Electrónicos")
    title?: string;
    // Si es compacto (sin Card wrapper, para embeber en otra página)
    compact?: boolean;
}

function getMinDate(movs: any[]): string {
    if (movs.length === 0) return toInputDate(new Date());
    const dates = movs.map((m: any) => new Date(m.fecha).getTime());
    return toInputDate(new Date(Math.min(...dates)));
}

export default function AnalyticsChart({ externalMovements, title, compact = false }: Props = {}) {
    const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('area');
    const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y' | 'all' | 'manual'>(externalMovements !== undefined ? 'all' : '30d');
    const [metric, setMetric] = useState<MetricType>('cantidad');
    const [fetchedMovements, setFetchedMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(!externalMovements);

    // Rango manual — solo se usa cuando period !== 'all'
    const now = new Date();
    const [manualDesde, setManualDesde] = useState<string>(toInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)));
    const [manualHasta, setManualHasta] = useState<string>(toInputDate(now));

    // Solo fetcha si no recibe movimientos externos
    useEffect(() => {
        if (externalMovements !== undefined) {
            setLoading(false);
            return;
        }
        fetchApi('/inventory/movements')
            .then(setFetchedMovements)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [externalMovements]);

    // Usa externos si los hay, si no usa los fetchados
    const movements = externalMovements ?? fetchedMovements;

    // Cuando period === 'all', desde/hasta se derivan directamente de los movimientos (nunca quedan desactualizados)
    // Cuando period === 'manual', usa los valores editados por el usuario
    const desde = period === 'all' ? getMinDate(movements) : manualDesde;
    const hasta  = period === 'all' ? toInputDate(new Date()) : manualHasta;

    const applyPeriod = (p: typeof period) => {
        setPeriod(p);
        const now = new Date();
        if (p === '7d')       { setManualDesde(toInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)));   setManualHasta(toInputDate(now)); }
        else if (p === '30d') { setManualDesde(toInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)));  setManualHasta(toInputDate(now)); }
        else if (p === '90d') { setManualDesde(toInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90)));  setManualHasta(toInputDate(now)); }
        else if (p === '1y')  { setManualDesde(toInputDate(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())));   setManualHasta(toInputDate(now)); }
        // 'all' no necesita setear nada — desde/hasta se calculan en el render desde movements
    };

    // Cuando el usuario edita manualmente las fechas, usa los valores manuales directamente
    const handleDesde = (val: string) => { setManualDesde(val); setManualHasta(hasta); setPeriod('manual' as any); };
    const handleHasta = (val: string) => { setManualHasta(val); setManualDesde(desde); setPeriod('manual' as any); };

    const data = buildChartData(movements, desde, hasta, metric);

    const desdeDate = desde ? new Date(desde + 'T00:00:00Z') : null;
    const hastaDate = hasta ? new Date(hasta + 'T23:59:59Z') : null;
    const filtered = movements.filter(m => {
        const f = new Date(m.fecha);
        if (desdeDate && f < desdeDate) return false;
        if (hastaDate && f > hastaDate) return false;
        return true;
    });

    const totalCostoCompras = filtered.filter(m => ['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)).reduce((a,m) => a + Number(m.cantidad)*Number(m.costoUnitario||0), 0);
    const totalIngresos     = filtered.filter(m => ['SALIDA','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)).reduce((a,m) => a + Number(m.cantidad)*Number(m.precioVenta||0), 0);
    const totalCostoVendido = filtered.filter(m => ['SALIDA','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)).reduce((a,m) => a + Number(m.cantidad)*Number(m.costoUnitario||0), 0);
    const margenBruto = totalIngresos - totalCostoVendido;
    const totalEntradas = filtered.filter(m => ['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)).reduce((a,m) => a + m.cantidad, 0);
    const totalSalidas  = filtered.filter(m => ['SALIDA','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)).reduce((a,m) => a + m.cantidad, 0);

    const subtitles: Record<MetricType, string> = {
        cantidad:     'Entradas vs Salidas por mes · cantidad total',
        costo:        'Inversión en compras vs costo de lo vendido · $',
        ingresos:     'Inversión (compras) vs Recuperación (ventas) · $',
        margen:       'Ingresos por ventas vs Costo de lo vendido · $',
        valorAlmacen: 'Valor acumulado del inventario mes a mes · $',
    };

    const entrLabel = metric === 'margen' ? 'Costo vendido' : metric === 'valorAlmacen' ? 'Valor en almacén' : 'Entradas';
    const salLabel  = metric === 'margen' ? 'Ingresos venta' : 'Salidas';
    // Sanitizar el title para usarlo como ID de SVG (sin espacios ni caracteres especiales)
    const gradientId = (title || 'd').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
    const entrColor = metric === 'margen' ? '#f59e0b' : metric === 'valorAlmacen' ? '#f59e0b' : '#3b82f6';
    const salColor  = metric === 'margen' ? '#22c55e' : '#ef4444';

    const chartProps = { data, margin: { top: 10, right: 30, left: 10, bottom: 0 } };

    const commonChildren = (
        <>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#6B7280', fontSize:11 }} dy={10}
                angle={data.length > 8 ? -30 : 0} textAnchor={data.length > 8 ? 'end' : 'middle'} height={data.length > 8 ? 50 : 30} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill:'#6B7280', fontSize:11 }} dx={-10}
                tickFormatter={(v) => formatTick(v, metric)} />
            <Tooltip
                contentStyle={{ borderRadius:'8px', border:'none', boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any, name: any) => formatTooltip(value, name, metric)}
                itemSorter={(item: any) => item.value === 0 ? 1 : -1}
                filterNull
            />
            <Legend wrapperStyle={{ paddingTop:'16px' }}
                formatter={(v) => { if (metric === 'valorAlmacen') return v === 'entradas' ? 'Valor en almacén' : ''; return v === 'entradas' ? entrLabel : salLabel; }} />
        </>
    );

    const renderChart = () => {
        if (chartType === 'line') return (
            <LineChart {...chartProps}>
                {commonChildren}
                <Line type="monotone" dataKey="entradas" stroke={entrColor} strokeWidth={3} dot={{r:4}} activeDot={{r:6}} name="entradas" />
                <Line type="monotone" dataKey="salidas"  stroke={salColor}  strokeWidth={3} dot={{r:4}} activeDot={{r:6}} name="salidas" />
            </LineChart>
        );
        if (chartType === 'bar') return (
            <BarChart {...chartProps}>
                {commonChildren}
                <Bar dataKey="entradas" fill={entrColor} radius={[4,4,0,0]} name="entradas" />
                <Bar dataKey="salidas"  fill={salColor}  radius={[4,4,0,0]} name="salidas" />
            </BarChart>
        );
        return (
            <AreaChart {...chartProps}>
                <defs>
                    <linearGradient id={`gEnt${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={entrColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={entrColor} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id={`gSal${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={salColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={salColor} stopOpacity={0} />
                    </linearGradient>
                </defs>
                {commonChildren}
                <Area type="monotone" dataKey="entradas" stroke={entrColor} strokeWidth={3} fillOpacity={1} fill={`url(#gEnt${gradientId})`} name="entradas" />
                <Area type="monotone" dataKey="salidas"  stroke={salColor}  strokeWidth={3} fillOpacity={1} fill={`url(#gSal${gradientId})`} name="salidas" />
            </AreaChart>
        );
    };

    const btnPeriod = (p: typeof period, label: string) => (
        <button key={p} onClick={() => applyPeriod(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${period === p ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
        </button>
    );

    // ── Contenido interno (reutilizable) ──────────────────────────────────────
    const inner = (
        <>
            {/* Header */}
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${compact ? 'mb-4' : 'px-6 py-5 border-b border-gray-50'}`}>
                <div>
                    <h3 className={`font-semibold text-gray-800 ${compact ? 'text-sm' : 'text-lg'}`}>
                        {title ? `Tendencia · ${title}` : 'Tendencia de Movimientos'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{subtitles[metric]}</p>
                </div>
                <div className="flex bg-gray-200/50 rounded-md p-0.5">
                    {(['area','bar','line'] as const).map(type => (
                        <button key={type} onClick={() => setChartType(type)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${chartType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {type === 'area' ? 'Área' : type === 'bar' ? 'Barras' : 'Líneas'}
                        </button>
                    ))}
                </div>
            </div>

            <div className={compact ? '' : 'px-6 pb-6'}>
                {/* Selector de métrica */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {METRICS.map(m => (
                        <div key={m.key} className="flex items-center gap-1">
                            <button onClick={() => setMetric(m.key)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${metric === m.key ? m.color + ' border' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                                {m.label}
                            </button>
                            <InfoTooltip text={m.tooltip} position="bottom" />
                        </div>
                    ))}
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-3 mb-5 py-3 px-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex bg-gray-200/50 rounded-md p-0.5">
                        {btnPeriod('7d','7d')}{btnPeriod('30d','30d')}{btnPeriod('90d','90d')}{btnPeriod('1y','1 año')}{btnPeriod('all','Todo')}
                    </div>
                    <div className="w-px h-4 bg-gray-200"/>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium">Desde</span>
                        <input type="date" value={desde} onChange={e => handleDesde(e.target.value)}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium">Hasta</span>
                        <input type="date" value={hasta} onChange={e => handleHasta(e.target.value)}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div className="ml-auto flex items-center gap-4 text-xs font-semibold">
                        {metric === 'cantidad' && <>
                            <span className="text-blue-600">+{totalEntradas} entradas</span>
                            <span className="text-red-500">-{totalSalidas} salidas</span>
                        </>}
                        {metric === 'costo' && <>
                            <span className="text-blue-600">Compras: ${totalCostoCompras.toLocaleString('es-MX',{maximumFractionDigits:0})}</span>
                            <span className="text-orange-500">Costo vendido: ${totalCostoVendido.toLocaleString('es-MX',{maximumFractionDigits:0})}</span>
                        </>}
                        {metric === 'ingresos' && <>
                            <span className="text-blue-600">Inversión: ${totalCostoCompras.toLocaleString('es-MX',{maximumFractionDigits:0})}</span>
                            <span className="text-teal-600">Ingresos: ${totalIngresos.toLocaleString('es-MX',{maximumFractionDigits:0})}</span>
                        </>}
                        {metric === 'margen' && <>
                            <span className={margenBruto >= 0 ? 'text-green-600' : 'text-red-500'}>
                                Margen: ${margenBruto.toLocaleString('es-MX',{maximumFractionDigits:0})}
                            </span>
                            {totalIngresos > 0 && <span className="text-purple-600">{((margenBruto/totalIngresos)*100).toFixed(1)}%</span>}
                        </>}
                        {metric === 'valorAlmacen' && <>
                            <span className="text-amber-600">
                                Valor actual: ${movements.reduce((a, m) => {
                                    const qty = Number(m.cantidad||0);
                                    const costo = Number(m.costoUnitario||0);
                                    const isE = ['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento);
                                    const isS = ['SALIDA','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento);
                                    return a + (isE ? qty*costo : 0) - (isS ? qty*costo : 0);
                                }, 0).toLocaleString('es-MX',{maximumFractionDigits:0})}
                            </span>
                        </>}
                    </div>
                </div>

                {/* Chart */}
                {loading ? (
                    <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">Cargando datos...</div>
                ) : data.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No hay movimientos en el periodo seleccionado.</div>
                ) : (
                    <div className={compact ? 'h-[260px] w-full' : 'h-[360px] w-full'}>
                        <ResponsiveContainer width="100%" height="100%">
                            {renderChart()}
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </>
    );

    // En modo compacto no envuelve en Card (lo hace la página que lo usa)
    if (compact) return <div>{inner}</div>;

    return <Card className="mt-2 mb-2">{inner}</Card>;
}
