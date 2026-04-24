"use client";
/**
 * ProductChart — Gráfica dedicada para el detalle de un producto.
 * 
 * 4 métricas diseñadas específicamente para un producto individual:
 *  1. Stock acumulado    — línea día a día, la más importante
 *  2. Entradas vs Salidas — barras agrupadas mensuales
 *  3. $ Valor en almacén  — saldo acumulado en $ día a día
 *  4. $ Costo vs Ingresos — costo compras vs ingresos ventas mensuales
 */

import { useState, useMemo } from 'react';
import {
    ComposedChart, Line, Bar, Area, AreaChart,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ReferenceLine
} from 'recharts';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

type MetricKey = 'stock' | 'flujo' | 'valor' | 'dinero';

interface Movimiento {
    id: string;
    fecha: string;
    tipoMovimiento: string;
    cantidad: number;
    costoUnitario: number;
    precioVenta?: number;
    referencia?: string;
    saldo?: number;
}

interface Props {
    movements: Movimiento[];   // DESC (más reciente primero) — como llegan del estado
    unidad: string;
    moneda?: string; // símbolo de moneda, ej: "MXN" | "USD" — default "MXN"
    stockActual?: number;      // Stock real del producto (KPI)
    costoUnitario?: number;    // Último precio de compra conocido (fallback cuando no hay movimientos)
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function toInputDate(d: Date) { return d.toISOString().split('T')[0]; }
function fmtDate(iso: string) {
    const d = new Date(iso + 'T00:00:00Z');
    return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}
function fmtMes(iso: string) {
    const d = new Date(iso + 'T00:00:00Z');
    return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const METRICS: { key: MetricKey; label: string; color: string; tooltip: string }[] = [
    {
        key: 'stock',
        label: 'Stock acumulado',
        color: 'bg-blue-50 text-blue-700 border-blue-200',
        tooltip: 'Cómo evoluciona el inventario día a día. Cada punto es el stock real después de cada movimiento. Las barras de fondo indican si fue entrada (verde) o salida (rojo).',
    },
    {
        key: 'flujo',
        label: 'Entradas vs Salidas',
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        tooltip: 'Barras agrupadas por mes. Verde = unidades que entraron, Rojo = unidades que salieron. Útil para ver en qué meses hubo más actividad.',
    },
    {
        key: 'valor',
        label: '$ Valor en almacén',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        tooltip: 'Valor acumulado del inventario en pesos día a día: Σ(entradas×costo) − Σ(salidas×costo). El último punto coincide con el KPI "Valor en almacén".',
    },
    {
        key: 'dinero',
        label: '$ Costo vs Ingresos',
        color: 'bg-purple-50 text-purple-700 border-purple-200',
        tooltip: 'Barras por mes. Azul = dinero invertido en compras (cantidad × costo). Verde = ingresos por ventas (cantidad × precio de venta). La diferencia es tu ganancia bruta.',
    },
];

function CustomTooltip({ active, payload, label, metric, unidad, currencyFmt }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
            <p className="font-semibold text-gray-700 mb-2">{label}</p>
            {payload.map((p: any) => (
                p.value !== undefined && p.value !== null && p.value !== 0 || metric === 'stock' || metric === 'valor' ? (
                    <div key={p.name} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                            <span className="text-gray-500">{p.name}</span>
                        </div>
                        <span className="font-semibold text-gray-800">
                            {(metric === 'stock') ? (
                                p.dataKey === 'salida' ? `-${p.value} ${unidad}` : `+${p.value} ${unidad}`
                            ) :
                             (metric === 'flujo') ? `${p.value > 0 ? '+' : ''}${p.value} ${unidad}` :
                             currencyFmt(Number(p.value))}
                        </span>
                    </div>
                ) : null
            ))}
        </div>
    );
}

export default function ProductChart({ movements, unidad, moneda = 'MXN', stockActual = 0, costoUnitario = 0 }: Props) {
    const currencyFmt = (v: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(v);
    const [metric, setMetric] = useState<MetricKey>('stock');
    const [period, setPeriod] = useState<'30d' | '90d' | '1y' | 'all' | 'manual'>('all');

    // Movimientos en orden ASC para cálculos acumulados
    const asc = useMemo(() =>
        [...movements].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()),
        [movements]
    );

    // Fecha mínima y máxima de los movimientos
    const minDate = asc.length > 0 ? asc[0].fecha.split('T')[0] : toInputDate(new Date());
    const maxDate = toInputDate(new Date());

    const [desde, setDesde] = useState<string>(minDate);
    const [hasta, setHasta]  = useState<string>(maxDate);

    // Cuando period cambia (botones), recalcular desde/hasta
    const applyPeriod = (p: typeof period) => {
        setPeriod(p);
        const now = new Date();
        if (p === '30d') { setDesde(toInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30))); setHasta(toInputDate(now)); }
        else if (p === '90d') { setDesde(toInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90))); setHasta(toInputDate(now)); }
        else if (p === '1y')  { setDesde(toInputDate(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()))); setHasta(toInputDate(now)); }
        else { setDesde(minDate); setHasta(toInputDate(now)); } // 'all'
    };

    // Rango de fechas según desde/hasta
    const filteredAsc = useMemo(() => {
        const d = new Date(desde + 'T00:00:00Z');
        const h = new Date(hasta + 'T23:59:59Z');
        return asc.filter(m => {
            const f = new Date(m.fecha);
            return f >= d && f <= h;
        });
    }, [asc, desde, hasta]);

    // ── Datos para Stock acumulado (día a día) ──────────────────────────────
    const stockData = useMemo(() => {
        // Calcular saldo inicial antes del rango filtrado
        const cutoffDate = filteredAsc.length > 0 ? new Date(filteredAsc[0].fecha) : null;
        const initialSaldo = cutoffDate
            ? asc.filter(m => new Date(m.fecha) < cutoffDate).reduce((acc, m) => {
                return acc + (['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento) ? Number(m.cantidad) : -Number(m.cantidad));
            }, 0)
            : 0;

        let saldo = initialSaldo;
        return filteredAsc.map(m => {
            const isPos = ['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento);
            saldo += isPos ? Number(m.cantidad) : -Number(m.cantidad);
            return {
                name: fmtDate(m.fecha.split('T')[0]),
                stock: saldo,
                entrada: isPos ? Number(m.cantidad) : 0,
                salida: isPos ? 0 : Number(m.cantidad),   // positivo — la barra siempre va hacia arriba
                tipo: isPos ? 'entrada' : 'salida',
            };
        });
    }, [filteredAsc, asc]);

    // ── Datos para Entradas vs Salidas mensuales ────────────────────────────
    const flujoData = useMemo(() => {
        const buckets: Record<string, { name: string; entradas: number; salidas: number }> = {};
        filteredAsc.forEach(m => {
            const d = new Date(m.fecha);
            const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
            if (!buckets[key]) buckets[key] = { name: fmtMes(m.fecha.split('T')[0]), entradas: 0, salidas: 0 };
            if (['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)) buckets[key].entradas += Number(m.cantidad);
            else buckets[key].salidas += Number(m.cantidad);
        });
        return Object.keys(buckets).sort().map(k => buckets[k]);
    }, [filteredAsc]);

    // ── Datos para $ Valor en almacén acumulado (día a día) ─────────────────
    const valorData = useMemo(() => {
        const cutoffDate = filteredAsc.length > 0 ? new Date(filteredAsc[0].fecha) : null;
        const initialValor = cutoffDate
            ? asc.filter(m => new Date(m.fecha) < cutoffDate).reduce((acc, m) => {
                const v = Number(m.cantidad) * Number(m.costoUnitario);
                return acc + (['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento) ? v : -v);
            }, 0)
            : 0;

        let valor = initialValor;
        return filteredAsc.map(m => {
            const isPos = ['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento);
            const v = Number(m.cantidad) * Number(m.costoUnitario);
            valor += isPos ? v : -v;
            return { name: fmtDate(m.fecha.split('T')[0]), valor: Math.max(0, valor) };
        });
    }, [filteredAsc, asc]);

    // ── Datos para $ Costo vs Ingresos mensuales ────────────────────────────
    const dineroData = useMemo(() => {
        const buckets: Record<string, { name: string; costo: number; ingresos: number }> = {};
        filteredAsc.forEach(m => {
            const d = new Date(m.fecha);
            const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
            if (!buckets[key]) buckets[key] = { name: fmtMes(m.fecha.split('T')[0]), costo: 0, ingresos: 0 };
            if (['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)) {
                buckets[key].costo += Number(m.cantidad) * Number(m.costoUnitario);
            } else {
                buckets[key].ingresos += Number(m.cantidad) * Number(m.precioVenta || 0);
            }
        });
        return Object.keys(buckets).sort().map(k => buckets[k]);
    }, [filteredAsc]);

    // ── Resumen del periodo ─────────────────────────────────────────────────
    const totalEntradas   = filteredAsc.filter(m => ['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)).reduce((a,m)=>a+Number(m.cantidad),0);
    const totalSalidas    = filteredAsc.filter(m => ['SALIDA','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)).reduce((a,m)=>a+Number(m.cantidad),0);
    const totalCosto      = filteredAsc.filter(m => ['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)).reduce((a,m)=>a+Number(m.cantidad)*Number(m.costoUnitario),0);
    const totalIngresos   = filteredAsc.filter(m => ['SALIDA','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)).reduce((a,m)=>a+Number(m.cantidad)*Number(m.precioVenta||0),0);
    const margenBruto     = totalIngresos - filteredAsc.filter(m=>['SALIDA','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)).reduce((a,m)=>a+Number(m.cantidad)*Number(m.costoUnitario),0);
    const stockFinal      = stockData.length > 0 ? stockData[stockData.length-1].stock : 0;
    // Si no hay movimientos en el período pero el producto tiene stock y precio conocidos,
    // mostrar el valor real del inventario (stock × costo) en lugar de $0.
    const valorFinalMovimientos = valorData.length > 0 ? valorData[valorData.length - 1].valor : 0;
    const valorFallback = stockActual > 0 && costoUnitario > 0 ? stockActual * costoUnitario : 0;
    const valorFinal = valorFinalMovimientos > 0 ? valorFinalMovimientos : valorFallback;

    const btnPeriod = (p: typeof period, label: string) => (
        <button key={p} onClick={() => applyPeriod(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${period===p?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
            {label}
        </button>
    );

    const isEmpty = filteredAsc.length === 0;

    const renderChart = () => {
        // Para la tab de valor: si no hay movimientos pero sí hay stock y costo, mostrar gráfica
        // estática con el valor actual en lugar de mensaje vacío.
        if (isEmpty && metric === 'valor' && valorFallback > 0) {
            const today = new Date().toISOString().split('T')[0];
            const staticValorData = [{ name: fmtDate(today), valor: valorFallback }];
            return (
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={staticValorData} margin={{ top:10, right:20, left:10, bottom:0 }}>
                        <defs>
                            <linearGradient id="gradValorStatic" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#9CA3AF', fontSize:11 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill:'#9CA3AF', fontSize:11 }} dx={-8}
                            tickFormatter={(v) => currencyFmt(v)} domain={[0, valorFallback * 1.2]} />
                        <Tooltip content={<CustomTooltip metric="valor" unidad={unidad} currencyFmt={currencyFmt} />} />
                        <Area type="monotone" dataKey="valor" stroke="#f59e0b" strokeWidth={2.5}
                            fill="url(#gradValorStatic)" fillOpacity={1}
                            dot={{ r:6, fill:'#f59e0b', strokeWidth:2, stroke:'#fff' }}
                            activeDot={{ r:8 }} name="Valor en almacén" />
                    </AreaChart>
                </ResponsiveContainer>
            );
        }

        if (isEmpty) return (
            <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
                No hay movimientos en este periodo.
            </div>
        );

        if (metric === 'stock') return (
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={stockData} margin={{ top:10, right:20, left:10, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#9CA3AF', fontSize:11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill:'#9CA3AF', fontSize:11 }} dx={-8}
                        domain={[0, 'auto']}
                        label={{ value: unidad, angle: -90, position: 'insideLeft', offset: 10, style: { fill:'#9CA3AF', fontSize:10 } }} />
                    <Tooltip content={<CustomTooltip metric="stock" unidad={unidad} currencyFmt={currencyFmt} />} />
                    {/* Barras de fondo para entradas/salidas */}
                    <Bar dataKey="entrada" fill="#22c55e" fillOpacity={0.25} radius={[2,2,0,0]} name="Entrada" barSize={16} />
                    <Bar dataKey="salida"  fill="#ef4444" fillOpacity={0.25} radius={[2,2,0,0]} name="Salida"  barSize={16} />
                    {/* Línea de stock acumulado encima */}
                    <Line type="monotone" dataKey="stock" stroke="#3b82f6" strokeWidth={2.5}
                        dot={{ r:4, fill:'#3b82f6', strokeWidth:2, stroke:'#fff' }}
                        activeDot={{ r:6 }} name={`Stock (${unidad})`} />
                    <ReferenceLine y={0} stroke="#E5E7EB" />
                    <Legend wrapperStyle={{ paddingTop:12, fontSize:12 }} />
                </ComposedChart>
            </ResponsiveContainer>
        );

        if (metric === 'flujo') return (
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={flujoData} margin={{ top:10, right:20, left:10, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#9CA3AF', fontSize:11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill:'#9CA3AF', fontSize:11 }} dx={-8} />
                    <Tooltip content={<CustomTooltip metric="flujo" unidad={unidad} currencyFmt={currencyFmt} />} />
                    <Bar dataKey="entradas" fill="#22c55e" radius={[4,4,0,0]} name="Entradas" barSize={28} />
                    <Bar dataKey="salidas"  fill="#ef4444" radius={[4,4,0,0]} name="Salidas"  barSize={28} />
                    <Legend wrapperStyle={{ paddingTop:12, fontSize:12 }} />
                </ComposedChart>
            </ResponsiveContainer>
        );

        if (metric === 'valor') return (
            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={valorData} margin={{ top:10, right:20, left:10, bottom:0 }}>
                    <defs>
                        <linearGradient id="gradValor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#9CA3AF', fontSize:11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill:'#9CA3AF', fontSize:11 }} dx={-8}
                        tickFormatter={(v) => currencyFmt(v)} />
                    <Tooltip content={<CustomTooltip metric="valor" unidad={unidad} currencyFmt={currencyFmt} />} />
                    <Area type="monotone" dataKey="valor" stroke="#f59e0b" strokeWidth={2.5}
                        fill="url(#gradValor)" fillOpacity={1}
                        dot={{ r:4, fill:'#f59e0b', strokeWidth:2, stroke:'#fff' }}
                        activeDot={{ r:6 }} name="Valor en almacén" />
                </AreaChart>
            </ResponsiveContainer>
        );

        // dinero
        return (
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={dineroData} margin={{ top:10, right:20, left:10, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'#9CA3AF', fontSize:11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill:'#9CA3AF', fontSize:11 }} dx={-8}
                        tickFormatter={(v) => currencyFmt(v)} />
                    <Tooltip content={<CustomTooltip metric="dinero" unidad={unidad} currencyFmt={currencyFmt} />} />
                    <Bar dataKey="costo"    fill="#3b82f6" radius={[4,4,0,0]} name="Inversión (compras)" barSize={28} />
                    <Bar dataKey="ingresos" fill="#22c55e" radius={[4,4,0,0]} name="Ingresos (ventas)"   barSize={28} />
                    <Legend wrapperStyle={{ paddingTop:12, fontSize:12 }} />
                </ComposedChart>
            </ResponsiveContainer>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-800">Gráfica de inventario</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                    {metric === 'stock'  && `Stock en ${unidad} por movimiento · línea acumulada + barras de flujo`}
                    {metric === 'flujo'  && `Entradas vs Salidas en ${unidad} · agrupadas por mes`}
                    {metric === 'valor'  && `Valor del inventario en $ · acumulado por movimiento`}
                    {metric === 'dinero' && `Inversión en compras vs Ingresos por ventas · por mes`}
                </p>
            </div>

            <div className="px-6 py-4 space-y-4">
                {/* Selector de métrica */}
                <div className="flex flex-wrap gap-2">
                    {METRICS.map(m => (
                        <div key={m.key} className="flex items-center gap-1">
                            <button onClick={() => setMetric(m.key)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                    metric === m.key ? m.color + ' border' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                                }`}>
                                {m.label}
                            </button>
                            <InfoTooltip text={m.tooltip} position="bottom" />
                        </div>
                    ))}
                </div>

                {/* Filtro de periodo */}
                <div className="flex flex-wrap items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex bg-gray-200/50 rounded-md p-0.5">
                        {btnPeriod('30d','30d')}
                        {btnPeriod('90d','90d')}
                        {btnPeriod('1y','1 año')}
                        {btnPeriod('all','Todo')}
                    </div>
                    <div className="w-px h-4 bg-gray-200"/>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium">Desde</span>
                        <input type="date" value={desde} min={minDate} max={hasta}
                            onChange={e => { setDesde(e.target.value); setPeriod('manual'); }}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium">Hasta</span>
                        <input type="date" value={hasta} min={desde} max={maxDate}
                            onChange={e => { setHasta(e.target.value); setPeriod('manual'); }}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div className="ml-auto flex items-center gap-4 text-xs font-semibold flex-wrap">
                        {metric === 'stock' && <>
                            <span className="text-green-600">+{totalEntradas} {unidad} entradas</span>
                            <span className="text-red-500">-{totalSalidas} {unidad} salidas</span>
                            <span className="text-blue-600">Stock final: {stockFinal} {unidad}</span>
                        </>}
                        {metric === 'flujo' && <>
                            <span className="text-green-600">+{totalEntradas} {unidad}</span>
                            <span className="text-red-500">-{totalSalidas} {unidad}</span>
                            <span className="text-gray-500">Neto: {totalEntradas-totalSalidas>=0?'+':''}{totalEntradas-totalSalidas} {unidad}</span>
                        </>}
                        {metric === 'valor' && <>
                            <span className="text-amber-600">Valor final: {currencyFmt(valorFinal)}</span>
                        </>}
                        {metric === 'dinero' && <>
                            <span className="text-blue-600">Inversión: {currencyFmt(totalCosto)}</span>
                            <span className="text-green-600">Ingresos: {currencyFmt(totalIngresos)}</span>
                            {totalIngresos > 0 && <span className={margenBruto>=0?'text-green-700':'text-red-500'}>
                                Margen: {currencyFmt(margenBruto)} ({(margenBruto/totalIngresos*100).toFixed(1)}%)
                            </span>}
                        </>}
                    </div>
                </div>

                {/* Gráfica */}
                {renderChart()}
            </div>
        </div>
    );
}
