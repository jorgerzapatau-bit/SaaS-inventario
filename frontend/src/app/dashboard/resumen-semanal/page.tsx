"use client";

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart2, Gauge, Droplets, DollarSign, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

type Registro = {
    id: string;
    fecha: string;
    equipo: { nombre: string; numeroEconomico: string | null };
    horasTrabajadas: number;
    barrenos: number;
    metrosLineales: number;
    litrosDiesel: number;
    precioDiesel: number;
    costoDiesel: number;
    operadores: number;
    peones: number;
    semanaNum: number | null;
    anoNum: number | null;
    kpi: { litrosPorHora: number | null; litrosPorMetro: number | null; metrosPorHora: number | null };
};

type Equipo = { id: string; nombre: string; numeroEconomico: string | null };

type ResumenSemana = {
    semanaNum: number;
    anoNum: number;
    equipoNombre: string;
    fechaInicio: string;
    fechaFin: string;
    dias: number;
    horasTotales: number;
    barrenos: number;
    metrosLineales: number;
    litrosDiesel: number;
    costoDiesel: number;
    costoOperadores: number;
    costoPeones: number;
    costoTotal: number;
    kpi: {
        litrosPorHora: number | null;
        litrosPorMetro: number | null;
        metrosPorHora: number | null;
        metrosPorDia: number | null;
    };
    registros: Registro[];
};

// Costo de operador y peón por jornada (del seed)
const COSTO_OPERADOR = 450;   // 2700/6
const COSTO_PEON     = 283.33; // 1700/6

function kpiColor(val: number | null, bueno: number, malo: number) {
    if (val === null) return 'text-gray-400';
    if (val <= bueno) return 'text-green-600';
    if (val <= malo)  return 'text-amber-500';
    return 'text-red-500';
}

function SemanaCard({ semana }: { semana: ResumenSemana }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header de semana */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Calendar size={18} className="text-blue-600" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-bold text-gray-800">
                            Semana {semana.semanaNum} / {semana.anoNum}
                            <span className="ml-2 text-xs font-normal text-gray-400">
                                {new Date(semana.fechaInicio + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                {' → '}
                                {new Date(semana.fechaFin + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                            </span>
                        </p>
                        <p className="text-xs text-gray-400">{semana.equipoNombre} · {semana.dias} días operados</p>
                    </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                    <div className="hidden sm:block">
                        <p className="text-xs text-gray-400">Horas</p>
                        <p className="text-sm font-bold text-gray-700">{semana.horasTotales.toFixed(1)}</p>
                    </div>
                    <div className="hidden sm:block">
                        <p className="text-xs text-gray-400">Metros</p>
                        <p className="text-sm font-bold text-gray-700">{semana.metrosLineales.toFixed(1)} m</p>
                    </div>
                    <div className="hidden md:block">
                        <p className="text-xs text-gray-400">Diésel</p>
                        <p className="text-sm font-bold text-blue-600">{semana.litrosDiesel.toLocaleString()} lt</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Costo total</p>
                        <p className="text-sm font-bold text-gray-800">${semana.costoTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                    </div>
                    {expanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-gray-100 px-5 py-5 space-y-5">

                    {/* KPIs operacionales */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Gauge size={12} /> KPIs operacionales
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'Lt / Hr',   val: semana.kpi.litrosPorHora,   unit: '',    bueno: 15, malo: 20 },
                                { label: 'Lt / Mt',   val: semana.kpi.litrosPorMetro,  unit: '',    bueno: 1.5, malo: 2 },
                                { label: 'Mt / Hr',   val: semana.kpi.metrosPorHora,   unit: '',    bueno: null, malo: null },
                                { label: 'Mt / Día',  val: semana.kpi.metrosPorDia,    unit: ' m',  bueno: null, malo: null },
                            ].map(k => (
                                <div key={k.label} className="bg-gray-50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                                    <p className={`text-lg font-bold ${k.bueno ? kpiColor(k.val, k.bueno, k.malo!) : 'text-gray-700'}`}>
                                        {k.val !== null ? `${k.val.toFixed(2)}${k.unit}` : 'N/A'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Costos desglosados (equivalente a hoja Semana del Excel) */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <DollarSign size={12} /> Costos de la semana
                        </p>
                        <div className="space-y-2">
                            {[
                                { label: 'Diésel',       val: semana.costoDiesel,    color: 'bg-blue-500' },
                                { label: 'Operadores',   val: semana.costoOperadores, color: 'bg-purple-500' },
                                { label: 'Peones',       val: semana.costoPeones,     color: 'bg-indigo-400' },
                            ].map(c => {
                                const pct = semana.costoTotal > 0 ? (c.val / semana.costoTotal) * 100 : 0;
                                return (
                                    <div key={c.label} className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 w-24 flex-shrink-0">{c.label}</span>
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${c.color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs font-semibold text-gray-700 w-24 text-right">
                                            ${c.val.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                        </span>
                                        <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                                    </div>
                                );
                            })}
                            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                                <span className="text-xs font-bold text-gray-700 w-24 flex-shrink-0">TOTAL</span>
                                <div className="flex-1" />
                                <span className="text-sm font-bold text-gray-800 w-24 text-right">
                                    ${semana.costoTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                </span>
                                <span className="w-10" />
                            </div>
                        </div>
                    </div>

                    {/* Registros diarios de la semana */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Droplets size={12} /> Registros diarios
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="p-2 font-semibold text-gray-400">Fecha</th>
                                        <th className="p-2 font-semibold text-gray-400 text-right">Hrs</th>
                                        <th className="p-2 font-semibold text-gray-400 text-right">Barrenos</th>
                                        <th className="p-2 font-semibold text-gray-400 text-right">Metros</th>
                                        <th className="p-2 font-semibold text-gray-400 text-right">Diésel (lt)</th>
                                        <th className="p-2 font-semibold text-gray-400 text-right">Lt/Hr</th>
                                        <th className="p-2 font-semibold text-gray-400 text-right">Mt/Hr</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {semana.registros.map(r => (
                                        <tr key={r.id} className="hover:bg-gray-50">
                                            <td className="p-2 text-gray-600">
                                                {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })}
                                            </td>
                                            <td className="p-2 text-right font-semibold text-gray-700">{r.horasTrabajadas}</td>
                                            <td className="p-2 text-right text-gray-600">{r.barrenos}</td>
                                            <td className="p-2 text-right text-gray-600">{r.metrosLineales.toFixed(1)}</td>
                                            <td className="p-2 text-right text-blue-600 font-semibold">{r.litrosDiesel}</td>
                                            <td className={`p-2 text-right font-semibold ${kpiColor(r.kpi.litrosPorHora, 15, 20)}`}>
                                                {r.kpi.litrosPorHora ?? '—'}
                                            </td>
                                            <td className="p-2 text-right text-gray-600">{r.kpi.metrosPorHora ?? '—'}</td>
                                        </tr>
                                    ))}
                                    {/* Fila de totales */}
                                    <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                                        <td className="p-2 text-blue-700">SEMANA {semana.semanaNum}</td>
                                        <td className="p-2 text-right text-blue-700">{semana.horasTotales.toFixed(1)}</td>
                                        <td className="p-2 text-right text-blue-700">{semana.barrenos}</td>
                                        <td className="p-2 text-right text-blue-700">{semana.metrosLineales.toFixed(1)}</td>
                                        <td className="p-2 text-right text-blue-700">{semana.litrosDiesel}</td>
                                        <td className="p-2 text-right text-blue-700">{semana.kpi.litrosPorHora?.toFixed(2) ?? '—'}</td>
                                        <td className="p-2 text-right text-blue-700">{semana.kpi.metrosPorHora?.toFixed(2) ?? '—'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ResumenSemanalInner() {
    const searchParams  = useSearchParams();
    const equipoIdParam = searchParams.get('equipoId') || 'todos';

    const [registros,    setRegistros]    = useState<Registro[]>([]);
    const [equipos,      setEquipos]      = useState<Equipo[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState('');
    const [filtroEquipo, setFiltroEquipo] = useState(equipoIdParam);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [regs, eqs] = await Promise.all([
                    fetchApi(`/registros-diarios${filtroEquipo !== 'todos' ? `?equipoId=${filtroEquipo}` : ''}`),
                    fetchApi('/equipos'),
                ]);
                setRegistros(regs);
                setEquipos(eqs);
            } catch (e: any) {
                setError(e.message || 'Error al cargar');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [filtroEquipo]);

    // Agrupar registros por semana (equivalente a hoja Semana del Excel)
    const semanas = useMemo<ResumenSemana[]>(() => {
        if (!registros.length) return [];

        const mapa: Record<string, Registro[]> = {};
        for (const r of registros) {
            if (!r.semanaNum || !r.anoNum) continue;
            const key = `${r.anoNum}-${String(r.semanaNum).padStart(2, '0')}-${r.equipo.nombre}`;
            if (!mapa[key]) mapa[key] = [];
            mapa[key].push(r);
        }

        return Object.entries(mapa)
            .map(([, regs]) => {
                regs.sort((a, b) => a.fecha.localeCompare(b.fecha));
                const totalHoras  = regs.reduce((a, r) => a + r.horasTrabajadas, 0);
                const totalMetros = regs.reduce((a, r) => a + r.metrosLineales,  0);
                const totalLitros = regs.reduce((a, r) => a + r.litrosDiesel,    0);
                const totalBarr   = regs.reduce((a, r) => a + r.barrenos,        0);
                const costoDiesel = regs.reduce((a, r) => a + r.costoDiesel,     0);
                const totalOps    = regs.reduce((a, r) => a + r.operadores,      0);
                const totalPeones = regs.reduce((a, r) => a + r.peones,          0);
                const costoOps    = totalOps    * COSTO_OPERADOR;
                const costoPeones = totalPeones * COSTO_PEON;
                const costoTotal  = costoDiesel + costoOps + costoPeones;
                const dias        = regs.filter(r => r.horasTrabajadas > 0).length;

                return {
                    semanaNum:    regs[0].semanaNum!,
                    anoNum:       regs[0].anoNum!,
                    equipoNombre: regs[0].equipo.nombre,
                    fechaInicio:  regs[0].fecha.slice(0, 10),
                    fechaFin:     regs[regs.length - 1].fecha.slice(0, 10),
                    dias,
                    horasTotales:   totalHoras,
                    barrenos:       totalBarr,
                    metrosLineales: totalMetros,
                    litrosDiesel:   totalLitros,
                    costoDiesel,
                    costoOperadores: costoOps,
                    costoPeones,
                    costoTotal,
                    kpi: {
                        litrosPorHora:  totalHoras  > 0 ? +(totalLitros / totalHoras).toFixed(2)  : null,
                        litrosPorMetro: totalMetros > 0 ? +(totalLitros / totalMetros).toFixed(2) : null,
                        metrosPorHora:  totalHoras  > 0 ? +(totalMetros / totalHoras).toFixed(2)  : null,
                        metrosPorDia:   dias        > 0 ? +(totalMetros / dias).toFixed(2)        : null,
                    },
                    registros: regs,
                } as ResumenSemana;
            })
            .sort((a, b) => {
                if (b.anoNum !== a.anoNum) return b.anoNum - a.anoNum;
                return b.semanaNum - a.semanaNum;
            });
    }, [registros]);

    // Totales acumulados de todo el período visible
    const totales = useMemo(() => ({
        semanas:    semanas.length,
        horas:      semanas.reduce((a, s) => a + s.horasTotales,   0),
        metros:     semanas.reduce((a, s) => a + s.metrosLineales,  0),
        litros:     semanas.reduce((a, s) => a + s.litrosDiesel,    0),
        costoTotal: semanas.reduce((a, s) => a + s.costoTotal,      0),
        ltHr:       null as number | null,
        mtHr:       null as number | null,
    }), [semanas]);

    if (totales.horas > 0) {
        (totales as any).ltHr = +(totales.litros / totales.horas).toFixed(2);
        (totales as any).mtHr = +(totales.metros / totales.horas).toFixed(2);
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Resumen Semanal</h1>
                    <p className="text-sm text-gray-500 mt-1">Equivalente a la hoja "Semana" del Excel — KPIs y costos agrupados por semana.</p>
                </div>
                <select
                    value={filtroEquipo}
                    onChange={e => setFiltroEquipo(e.target.value)}
                    className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                    <option value="todos">Todos los equipos</option>
                    {equipos.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.nombre}</option>
                    ))}
                </select>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            {/* Totales acumulados */}
            {!loading && semanas.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Semanas',        val: totales.semanas,                                              unit: '',    icon: <BarChart2 size={14}/>,  color: 'text-gray-800' },
                        { label: 'Horas totales',  val: totales.horas.toFixed(1),                                     unit: ' hrs', icon: <Gauge size={14}/>,      color: 'text-gray-800' },
                        { label: 'Metros totales', val: totales.metros.toFixed(1),                                    unit: ' m',  icon: <BarChart2 size={14}/>,  color: 'text-gray-800' },
                        { label: 'Diésel total',   val: totales.litros.toLocaleString('es-MX'),                       unit: ' lt', icon: <Droplets size={14}/>,   color: 'text-blue-600' },
                        { label: 'Lt/hr prom.',    val: (totales as any).ltHr ?? '—',                                 unit: '',    icon: <Gauge size={14}/>,      color: 'text-gray-700' },
                        { label: 'Costo total',    val: `$${totales.costoTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, unit: '', icon: <DollarSign size={14}/>, color: 'text-gray-800' },
                    ].map(k => (
                        <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">{k.icon}{k.label}</p>
                            <p className={`text-xl font-bold ${k.color}`}>{k.val}<span className="text-sm font-normal text-gray-400">{k.unit}</span></p>
                        </div>
                    ))}
                </div>
            )}

            {/* Lista de semanas */}
            {loading ? (
                <Card><div className="p-10 text-center text-gray-400 text-sm">Cargando resúmenes...</div></Card>
            ) : semanas.length === 0 ? (
                <Card>
                    <div className="p-10 text-center">
                        <BarChart2 size={36} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-600">Sin datos semanales</p>
                        <p className="text-xs text-gray-400 mt-1">Registra operaciones diarias para ver el resumen aquí.</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-3">
                    {semanas.map(s => (
                        <SemanaCard key={`${s.anoNum}-${s.semanaNum}-${s.equipoNombre}`} semana={s} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ResumenSemanalPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>}>
            <ResumenSemanalInner />
        </Suspense>
    );
}
