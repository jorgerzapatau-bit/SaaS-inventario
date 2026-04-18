"use client";

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    BarChart2, Gauge, Droplets, DollarSign,
    ChevronDown, ChevronUp, Calendar, HardHat,
    Receipt, Info, Drill, Wrench, Layers,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
type Registro = {
    id: string;
    fecha: string;
    equipo: { nombre: string; numeroEconomico: string | null };
    horometroInicio: number;
    horometroFin: number;
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
    bordo: number | null;
    espaciamiento: number | null;
    profundidadPromedio: number | null;
    volumenRoca: number | null;
    porcentajePerdida: number | null;
    porcentajeAvance: number | null;
    rentaEquipoDiaria: number | null;
    plantilla: { id: string; numero: number } | null;
    corte: { id: string; numero: number; status: string } | null;
    notas: string | null;
    kpi: {
        litrosPorHora: number | null;
        litrosPorMetro: number | null;
        metrosPorHora: number | null;
        metrosPorDia: number | null;
    };
};

type GastoOperativo = {
    id: string;
    fechaInicio: string | null;
    fechaFin: string | null;
    semanaNum: number | null;
    anoNum: number | null;
    nivelGasto: string;
    tipoGasto: string;
    categoria: string;
    producto: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
    unidad: string;
    equipo: { nombre: string } | null;
};

type Equipo    = { id: string; nombre: string; numeroEconomico: string | null };
type ObraSimple = {
    id: string; nombre: string; status: string;
    plantillas?: { id: string; numero: number; metrosContratados: number; barrenos: number }[];
};

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
    costoRenta: number;
    costoGastosOp: number;
    costoTotal: number;
    volumenRocaTotal: number | null;
    volumenRocaTotalCalculado: boolean;   // true si algún valor fue calculado en cliente
    profundidadPromProm: number | null;
    kpi: {
        litrosPorHora: number | null;
        litrosPorMetro: number | null;
        metrosPorHora: number | null;
        metrosPorDia: number | null;
    };
    registros: Registro[];
    gastosOp: GastoOperativo[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const COSTO_OPERADOR = 450;
const COSTO_PEON     = 283.33;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Semáforo de eficiencia:
 *  Verde  ≤ bueno  → eficiente
 *  Ámbar  ≤ malo   → moderado
 *  Rojo   > malo   → consumo elevado
 */
function kpiColor(val: number | null, bueno: number, malo: number) {
    if (val === null) return 'text-gray-400';
    if (val <= bueno) return 'text-green-600';
    if (val <= malo)  return 'text-amber-500';
    return 'text-red-500';
}

function categLabel(cat: string) {
    const map: Record<string, string> = {
        COMBUSTIBLE: 'Combustible', LUBRICANTE: 'Lubricante', HERRAMIENTA: 'Herramienta',
        REFACCION: 'Refacción', VEHICULO: 'Vehículo', OTRO: 'Otro',
    };
    return map[cat] ?? cat;
}

function categColor(cat: string) {
    const map: Record<string, string> = {
        COMBUSTIBLE: 'bg-red-100 text-red-700',
        LUBRICANTE:  'bg-yellow-100 text-yellow-700',
        HERRAMIENTA: 'bg-blue-100 text-blue-700',
        REFACCION:   'bg-purple-100 text-purple-700',
        VEHICULO:    'bg-indigo-100 text-indigo-700',
        OTRO:        'bg-gray-100 text-gray-600',
    };
    return map[cat] ?? 'bg-gray-100 text-gray-600';
}

/**
 * calcVolumenRoca — calcula el volumen de roca en el frontend cuando el
 * backend devuelve null (el campo no fue ingresado manualmente).
 *
 * Fórmula: bordo × espaciamiento × profundidadPromedio
 *
 * Si falta profundidadPromedio se devuelve null (no podemos completar el cálculo).
 * Se marca con `calculado: true` para mostrar un indicador visual al usuario.
 */
function calcVolumenRoca(r: {
    volumenRoca: number | null;
    bordo: number | null;
    espaciamiento: number | null;
    profundidadPromedio: number | null;
}): { valor: number | null; calculado: boolean } {
    // El backend ya lo calculó — usarlo directamente
    if (r.volumenRoca != null) return { valor: r.volumenRoca, calculado: false };
    // Intentar calcular con los campos disponibles
    if (r.bordo != null && r.espaciamiento != null && r.profundidadPromedio != null) {
        return { valor: r.bordo * r.espaciamiento * r.profundidadPromedio, calculado: true };
    }
    // Sin profundidad no podemos calcular
    return { valor: null, calculado: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// RegistroDiarioRow — fila idéntica al formato de Registro Diario
// Header compacto + panel expandible con tarjetas
// ─────────────────────────────────────────────────────────────────────────────
function RegistroDiarioRow({ r, index }: { r: Registro; index: number }) {
    const [expanded, setExpanded] = useState(false);

    const [yr, mo, dy] = r.fecha.slice(0, 10).split('-').map(Number);
    const fechaObj   = new Date(yr, mo - 1, dy);
    const diaSemana  = fechaObj.toLocaleDateString('es-MX', { weekday: 'short' });
    const fechaCorta = fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    const semLabel   = r.semanaNum ? `Sem. ${r.semanaNum}/${r.anoNum}` : '';

    const tienePerforacion = r.bordo != null || r.espaciamiento != null
        || r.profundidadPromedio != null || r.volumenRoca != null
        || r.porcentajePerdida != null || r.porcentajeAvance != null
        || r.rentaEquipoDiaria != null;

    // Calcula volumen en el cliente si el backend devolvió null
    const volRoca = calcVolumenRoca(r);

    return (
        <>
            {/* ── Fila compacta — misma estructura que en Registro Diario ── */}
            <tr
                className="hover:bg-slate-50/80 transition-colors group cursor-pointer border-b border-gray-100"
                onClick={() => setExpanded(v => !v)}
            >
                {/* # */}
                <td className="pl-3 pr-1 py-3 w-8 text-center text-xs text-blue-300 border-r border-gray-100">
                    {index + 1}
                </td>

                {/* Fecha */}
                <td className="pl-2 pr-2 py-3 w-32">
                    <p className="text-sm font-semibold text-gray-800 capitalize">{diaSemana} {fechaCorta}</p>
                    {semLabel && <p className="text-[10px] text-gray-300 mt-0.5">{semLabel}</p>}
                </td>

                {/* Plantilla / corte */}
                <td className="px-2 py-3 w-20 text-center">
                    {r.plantilla ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                            <Layers size={9} /> P{r.plantilla.numero}
                        </span>
                    ) : (
                        <span className="text-gray-200 text-xs">—</span>
                    )}
                </td>

                {/* Horómetro */}
                <td className="px-2 py-3 text-center">
                    <p className="text-xs font-mono text-gray-600">
                        {r.horometroInicio != null ? r.horometroInicio.toLocaleString('es-MX') : '—'}
                        <span className="text-gray-300 mx-0.5">→</span>
                        {r.horometroFin.toLocaleString('es-MX')}
                    </p>
                    <p className="text-[10px] text-gray-400">{r.horasTrabajadas} hrs</p>
                </td>

                {/* Barrenos */}
                <td className="px-2 py-3 text-right">
                    <p className="text-sm font-bold text-gray-800">{r.barrenos}</p>
                    <p className="text-[10px] text-gray-400">bar.</p>
                </td>

                {/* Metros */}
                <td className="px-2 py-3 text-right">
                    <p className="text-sm font-bold text-gray-800">{Number(r.metrosLineales).toFixed(1)}</p>
                    <p className="text-[10px] text-gray-400">m</p>
                </td>

                {/* Vol. roca — usa valor del backend; si es null, calcula bordo×espa×prof */}
                <td className="px-2 py-3 text-right">
                    {volRoca.valor != null ? (
                        <span className={`text-sm font-semibold ${volRoca.calculado ? 'text-indigo-400' : 'text-indigo-600'}`}>
                            {Number(volRoca.valor).toFixed(2)}
                            {volRoca.calculado && (
                                <span className="ml-0.5 text-[9px] font-normal text-indigo-300 align-super">calc.</span>
                            )}
                        </span>
                    ) : (
                        <span className="text-gray-200 text-sm">—</span>
                    )}
                </td>

                {/* Diésel lt */}
                <td className="px-2 py-3 text-right">
                    <p className="text-sm font-semibold text-blue-600">{r.litrosDiesel}</p>
                    <p className="text-[10px] text-gray-400">lt</p>
                </td>

                {/* Lt/Hr — rojo si > 20 */}
                <td className={`px-2 py-3 text-right font-bold text-sm ${kpiColor(r.kpi.litrosPorHora, 15, 20)}`}>
                    {r.kpi.litrosPorHora ?? '—'}
                </td>

                {/* Mt/Hr */}
                <td className="px-2 py-3 text-right text-sm text-gray-600">
                    {r.kpi.metrosPorHora ?? '—'}
                </td>

                {/* Renta */}
                <td className="pr-3 py-3 text-right">
                    {r.rentaEquipoDiaria != null ? (
                        <>
                            <p className="text-sm font-semibold text-emerald-700">
                                ${Number(r.rentaEquipoDiaria).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-gray-400">renta</p>
                        </>
                    ) : (
                        <span className="text-gray-200 text-sm">—</span>
                    )}
                </td>

                {/* Chevron */}
                <td className="pr-2 py-3 w-6 text-right">
                    {expanded
                        ? <ChevronUp size={13} className="text-gray-400" />
                        : <ChevronDown size={13} className="text-gray-400 opacity-0 group-hover:opacity-100" />}
                </td>
            </tr>

            {/* ── Panel expandido — idéntico a Registro Diario ── */}
            {expanded && (
                <tr className="bg-slate-50/60">
                    <td colSpan={12} className="px-6 py-4 space-y-3 border-b border-gray-100">
                        {/* Tarjetas: Horómetro · Personal · KPIs · Diésel */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            {/* Horómetro */}
                            <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Horómetro</p>
                                <p className="text-sm font-bold text-gray-700 font-mono">
                                    {r.horometroInicio != null ? r.horometroInicio.toLocaleString('es-MX') : '—'}
                                    {' → '}
                                    {r.horometroFin.toLocaleString('es-MX')}
                                </p>
                                <p className="text-xs text-gray-400">{r.horasTrabajadas} hrs efectivas</p>
                            </div>

                            {/* Personal */}
                            <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Personal</p>
                                <p className="text-sm font-bold text-gray-700">
                                    {r.operadores} op. / {r.peones} peón{r.peones !== 1 ? 'es' : ''}
                                </p>
                            </div>

                            {/* KPIs */}
                            <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                    <Gauge size={10} /> KPIs
                                </p>
                                <div className="grid grid-cols-3 gap-1 text-center">
                                    <div>
                                        <p className="text-[10px] text-gray-400">Lt/hr</p>
                                        <p className={`text-xs font-bold ${kpiColor(r.kpi.litrosPorHora, 15, 20)}`}>
                                            {r.kpi.litrosPorHora ?? '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400">Lt/m</p>
                                        <p className={`text-xs font-bold ${kpiColor(r.kpi.litrosPorMetro, 1.5, 2)}`}>
                                            {r.kpi.litrosPorMetro ?? '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400">m/hr</p>
                                        <p className="text-xs font-bold text-gray-700">
                                            {r.kpi.metrosPorHora ?? '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Diésel */}
                            <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                    <Droplets size={10} /> Diésel
                                </p>
                                <p className="text-xs text-gray-600">
                                    {r.litrosDiesel} lt × ${r.precioDiesel}/lt
                                </p>
                                <p className="text-sm font-bold text-gray-700">
                                    = ${r.costoDiesel.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>

                        {/* Notas */}
                        {r.notas && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 flex gap-2 items-start">
                                <span className="font-semibold flex-shrink-0">📝 Notas:</span>
                                <span>{r.notas}</span>
                            </div>
                        )}

                        {/* Datos de perforación */}
                        {tienePerforacion && (
                            <div className="bg-indigo-50/80 border border-indigo-100 rounded-lg px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 mb-2 flex items-center gap-1">
                                    <Drill size={10} /> Datos de perforación
                                </p>
                                <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 text-xs">
                                    {r.bordo != null && (
                                        <div className="bg-white/60 rounded p-1.5">
                                            <p className="text-indigo-400 mb-0.5">Bordo</p>
                                            <p className="font-bold text-indigo-700">{r.bordo} m</p>
                                        </div>
                                    )}
                                    {r.espaciamiento != null && (
                                        <div className="bg-white/60 rounded p-1.5">
                                            <p className="text-indigo-400 mb-0.5">Espa.</p>
                                            <p className="font-bold text-indigo-700">{r.espaciamiento} m</p>
                                        </div>
                                    )}
                                    {r.profundidadPromedio != null && (
                                        <div className="bg-white/60 rounded p-1.5">
                                            <p className="text-indigo-400 mb-0.5">Prof.</p>
                                            <p className="font-bold text-indigo-700">{r.profundidadPromedio} m</p>
                                        </div>
                                    )}
                                    {(r.volumenRoca != null || volRoca.calculado) && (
                                        <div className="bg-white/60 rounded p-1.5">
                                            <p className="text-indigo-400 mb-0.5">
                                                Vol. roca{volRoca.calculado && <span className="ml-1 text-[9px] text-indigo-300">calc.</span>}
                                            </p>
                                            <p className="font-bold text-indigo-700">{Number(volRoca.valor).toFixed(2)} m³</p>
                                        </div>
                                    )}
                                    {r.porcentajePerdida != null && (
                                        <div className="bg-white/60 rounded p-1.5">
                                            <p className="text-indigo-400 mb-0.5">% Pérdida</p>
                                            <p className="font-bold text-indigo-700">{r.porcentajePerdida}%</p>
                                        </div>
                                    )}
                                    {r.porcentajeAvance != null && (
                                        <div className="bg-white/60 rounded p-1.5">
                                            <p className="text-indigo-400 mb-0.5">% Avance</p>
                                            <p className="font-bold text-indigo-700">{r.porcentajeAvance}%</p>
                                        </div>
                                    )}
                                    {r.rentaEquipoDiaria != null && (
                                        <div className="bg-white/60 rounded p-1.5">
                                            <p className="text-indigo-400 mb-0.5">Renta/día</p>
                                            <p className="font-bold text-indigo-700">
                                                ${Number(r.rentaEquipoDiaria).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabla de registros diarios — encabezado + filas tipo Registro Diario
// ─────────────────────────────────────────────────────────────────────────────
function TablaRegistrosDiarios({ semana }: { semana: ResumenSemana }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 920 }}>
                <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="pl-3 pr-1 py-2.5 w-8 text-center text-[10px] font-semibold text-gray-300 uppercase">#</th>
                        <th className="pl-2 pr-2 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                        <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Plant.</th>
                        <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Horómetro</th>
                        <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Bar.</th>
                        <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Metros</th>
                        <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Vol. roca (m³)</th>
                        <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Diésel (lt)</th>
                        <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Lt/Hr</th>
                        <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Mt/Hr</th>
                        <th className="pr-3 py-2.5 text-right text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Renta ($)</th>
                        <th className="pr-2 py-2.5 w-6" />
                    </tr>
                </thead>
                <tbody>
                    {semana.registros.map((r, i) => (
                        <RegistroDiarioRow key={r.id} r={r} index={i} />
                    ))}
                </tbody>
                {/* Fila de totales */}
                <tfoot>
                    <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                        <td className="pl-3 pr-1 py-2" />
                        <td className="pl-2 pr-2 py-2 text-blue-700 text-xs">SEMANA {semana.semanaNum}</td>
                        <td className="px-2 py-2" />
                        <td className="px-2 py-2 text-center text-blue-700 text-xs">{semana.horasTotales.toFixed(1)} hrs</td>
                        <td className="px-2 py-2 text-right text-blue-700 text-xs">{semana.barrenos}</td>
                        <td className="px-2 py-2 text-right text-blue-700 text-xs">{semana.metrosLineales.toFixed(1)}</td>
                        <td className="px-2 py-2 text-right text-indigo-700 text-xs">
                            {semana.volumenRocaTotal != null
                                ? <>
                                    {semana.volumenRocaTotal.toFixed(2)}
                                    {semana.volumenRocaTotalCalculado && (
                                        <span className="ml-0.5 text-[9px] font-normal text-indigo-400 align-super">calc.</span>
                                    )}
                                  </>
                                : <span className="font-normal text-blue-300">—</span>}
                        </td>
                        <td className="px-2 py-2 text-right text-blue-700 text-xs">{semana.litrosDiesel}</td>
                        <td className={`px-2 py-2 text-right text-xs font-bold ${semana.kpi.litrosPorHora ? kpiColor(semana.kpi.litrosPorHora, 15, 20) : 'text-blue-700'}`}>
                            {semana.kpi.litrosPorHora?.toFixed(2) ?? '—'}
                        </td>
                        <td className="px-2 py-2 text-right text-blue-700 text-xs">
                            {semana.kpi.metrosPorHora?.toFixed(2) ?? '—'}
                        </td>
                        <td className="pr-3 py-2 text-right text-orange-700 text-xs">
                            {semana.costoRenta > 0
                                ? `$${semana.costoRenta.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
                                : <span className="font-normal text-blue-300">—</span>}
                        </td>
                        <td className="pr-2 py-2" />
                    </tr>
                </tfoot>
            </table>
            {/* Nota vol. roca */}
            <div className="flex items-start gap-1.5 px-3 py-2 bg-gray-50/80 border-t border-gray-100 text-[10px] text-gray-400">
                <Info size={10} className="mt-0.5 flex-shrink-0 text-gray-300" />
                <span>
                    <strong className="text-gray-500">Vol. roca (m³)</strong> = bordo × espaciamiento × profundidad.
                    Aparece <strong>—</strong> cuando no hay profundidad capturada.
                    Los valores marcados con <span className="text-indigo-400 font-semibold">calc.</span> son calculados en tiempo real con los datos del registro.
                </span>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabla Gastos Operativos
// ─────────────────────────────────────────────────────────────────────────────
function TablaGastosOp({ semana }: { semana: ResumenSemana }) {
    if (semana.gastosOp.length === 0) {
        return (
            <div className="rounded-xl border border-gray-100 py-8 text-center text-sm text-gray-400">
                <Receipt size={28} className="mx-auto mb-2 text-gray-200" />
                <p>Sin gastos operativos para esta semana</p>
            </div>
        );
    }
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left text-xs border-collapse" style={{ minWidth: 580 }}>
                <thead>
                    <tr className="bg-teal-50 border-b border-teal-100">
                        <th className="pl-3 pr-2 py-2.5 font-semibold text-teal-500 uppercase tracking-wider text-[10px]">Período</th>
                        <th className="px-2 py-2.5 font-semibold text-teal-500 uppercase tracking-wider text-[10px]">Nivel</th>
                        <th className="px-2 py-2.5 font-semibold text-teal-500 uppercase tracking-wider text-[10px]">Categoría</th>
                        <th className="px-2 py-2.5 font-semibold text-teal-500 uppercase tracking-wider text-[10px]">Concepto</th>
                        <th className="px-2 py-2.5 font-semibold text-teal-500 uppercase tracking-wider text-[10px] text-right">Cant.</th>
                        <th className="px-2 py-2.5 font-semibold text-teal-500 uppercase tracking-wider text-[10px] text-right">P. Unit.</th>
                        <th className="pr-3 py-2.5 font-semibold text-teal-500 uppercase tracking-wider text-[10px] text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {semana.gastosOp.map(g => (
                        <tr key={g.id} className="hover:bg-teal-50/40 transition-colors">
                            <td className="pl-3 pr-2 py-2">
                                <p className="text-gray-600">
                                    {g.fechaInicio
                                        ? new Date(g.fechaInicio + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
                                        : '—'}
                                </p>
                                {g.fechaFin && g.fechaFin !== g.fechaInicio && (
                                    <p className="text-[10px] text-gray-400">
                                        → {new Date(g.fechaFin + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                    </p>
                                )}
                            </td>
                            <td className="px-2 py-2">
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold">
                                    {g.nivelGasto === 'GENERAL'       ? 'General'   :
                                     g.nivelGasto === 'POR_EQUIPO'    ? 'Equipo'    :
                                     g.nivelGasto === 'POR_PLANTILLA' ? 'Plantilla' : g.nivelGasto}
                                </span>
                                {g.equipo && (
                                    <p className="text-[10px] text-gray-400 mt-0.5">{g.equipo.nombre}</p>
                                )}
                            </td>
                            <td className="px-2 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${categColor(g.categoria)}`}>
                                    {categLabel(g.categoria)}
                                </span>
                            </td>
                            <td className="px-2 py-2 text-gray-700 font-medium">{g.producto}</td>
                            <td className="px-2 py-2 text-right text-gray-600">{g.cantidad} {g.unidad}</td>
                            <td className="px-2 py-2 text-right text-gray-600">
                                ${g.precioUnitario.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="pr-3 py-2 text-right font-bold text-teal-700">
                                ${g.total.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-teal-50 border-t-2 border-teal-200 font-bold">
                        <td colSpan={6} className="pl-3 py-2 text-teal-700 text-xs">TOTAL GASTOS OPERATIVOS</td>
                        <td className="pr-3 py-2 text-right text-teal-800 text-xs">
                            ${semana.costoGastosOp.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SemanaCard — tarjeta expandible por semana
// ─────────────────────────────────────────────────────────────────────────────
function SemanaCard({ semana, ingresoPorMetro }: { semana: ResumenSemana; ingresoPorMetro: number | null }) {
    const [expanded,      setExpanded]      = useState(false);
    const [seccionActiva, setSeccionActiva] = useState<'registros' | 'gastos'>('registros');

    const tienePerforacion = semana.registros.some(r =>
        r.bordo || r.espaciamiento || r.profundidadPromedio || r.volumenRoca
    );

    // ── Utilidad semanal estimada ─────────────────────────────────────────────
    const mxn = (n: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

    // Validación explícita: el prop debe ser número > 0 y no NaN
    const precioValido = typeof ingresoPorMetro === 'number' && !isNaN(ingresoPorMetro) && ingresoPorMetro > 0;
    console.log('[SemanaCard] ingresoPorMetro:', ingresoPorMetro, '| precioValido:', precioValido, '| metros:', semana.metrosLineales);

    const ingresoSemana  = (precioValido && semana.metrosLineales > 0)
        ? ingresoPorMetro! * semana.metrosLineales
        : null;
    const utilidadSemana = ingresoSemana != null
        ? ingresoSemana - semana.costoTotal
        : null;
    const margenSemana   = (utilidadSemana != null && ingresoSemana != null && ingresoSemana > 0)
        ? (utilidadSemana / ingresoSemana) * 100
        : null;
    const utilPos = (utilidadSemana ?? 0) >= 0;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* ── Header ────────────────────────────────────────────────── */}
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
                        <p className="text-xs text-gray-400">
                            {semana.equipoNombre} · {semana.dias} días operados
                        </p>
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
                    {semana.costoGastosOp > 0 && (
                        <div className="hidden md:block">
                            <p className="text-xs text-gray-400">Gastos Op.</p>
                            <p className="text-sm font-bold text-teal-600">
                                ${semana.costoGastosOp.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    )}
                    <div>
                        <p className="text-xs text-gray-400">Costo total</p>
                        <p className="text-sm font-bold text-gray-800">
                            ${semana.costoTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                    {expanded
                        ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                        : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-gray-100 px-5 py-5 space-y-5">

                    {/* ── KPIs operacionales ─────────────────────────────── */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <Gauge size={12} /> KPIs operacionales
                        </p>
                        <p className="text-[10px] text-gray-400 mb-3 flex items-center gap-1">
                            <Info size={9} />
                            Lt/Hr: 🟢 ≤15 eficiente · 🟡 ≤20 moderado · 🔴 &gt;20 elevado
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'Lt / Hr',  val: semana.kpi.litrosPorHora,  unit: '',   bueno: 15,   malo: 20   },
                                { label: 'Lt / Mt',  val: semana.kpi.litrosPorMetro, unit: '',   bueno: 1.5,  malo: 2    },
                                { label: 'Mt / Hr',  val: semana.kpi.metrosPorHora,  unit: '',   bueno: null, malo: null },
                                { label: 'Mt / Día', val: semana.kpi.metrosPorDia,   unit: ' m', bueno: null, malo: null },
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

                    {/* ── Perforación ─────────────────────────────────────── */}
                    {tienePerforacion && (
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <HardHat size={12} /> Perforación
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {semana.volumenRocaTotal !== null && (
                                    <div className="bg-indigo-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-indigo-400 mb-1">
                                            Volumen roca total
                                            {semana.volumenRocaTotalCalculado && (
                                                <span className="ml-1 text-[9px] text-indigo-300">calc.</span>
                                            )}
                                        </p>
                                        <p className="text-lg font-bold text-indigo-700">{semana.volumenRocaTotal.toFixed(2)} m³</p>
                                    </div>
                                )}
                                {semana.profundidadPromProm !== null && (
                                    <div className="bg-indigo-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-indigo-400 mb-1">Prof. promedio</p>
                                        <p className="text-lg font-bold text-indigo-700">{semana.profundidadPromProm.toFixed(2)} m</p>
                                    </div>
                                )}
                                {semana.barrenos > 0 && semana.volumenRocaTotal !== null && (
                                    <div className="bg-indigo-50 rounded-lg p-3 text-center">
                                        <p className="text-xs text-indigo-400 mb-1">m³ / barreno</p>
                                        <p className="text-lg font-bold text-indigo-700">
                                            {(semana.volumenRocaTotal / semana.barrenos).toFixed(2)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Costos desglosados ──────────────────────────────── */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <DollarSign size={12} /> Costos de la semana
                        </p>
                        <div className="space-y-2">
                            {[
                                { label: 'Diésel',            val: semana.costoDiesel,     color: 'bg-blue-500'   },
                                { label: 'Operadores',        val: semana.costoOperadores, color: 'bg-purple-500' },
                                { label: 'Peones',            val: semana.costoPeones,     color: 'bg-indigo-400' },
                                ...(semana.costoRenta > 0
                                    ? [{ label: 'Renta equipo',      val: semana.costoRenta,    color: 'bg-orange-400' }]
                                    : []),
                                ...(semana.costoGastosOp > 0
                                    ? [{ label: 'Gastos Operativos', val: semana.costoGastosOp, color: 'bg-teal-400'   }]
                                    : []),
                            ].map(c => {
                                const pct = semana.costoTotal > 0 ? (c.val / semana.costoTotal) * 100 : 0;
                                return (
                                    <div key={c.label} className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 w-36 flex-shrink-0">{c.label}</span>
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
                                <span className="text-xs font-bold text-gray-700 w-36 flex-shrink-0">TOTAL</span>
                                <div className="flex-1" />
                                <span className="text-sm font-bold text-gray-800 w-24 text-right">
                                    ${semana.costoTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                </span>
                                <span className="w-10" />
                            </div>
                        </div>
                    </div>

                    {/* ── Resultado semanal ──────────────────────────────────── */}
                    {precioValido && ingresoSemana != null && (
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <DollarSign size={12} /> Resultado semanal
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1">Ingreso estimado</p>
                                    <p className="text-base font-bold text-gray-800">{mxn(ingresoSemana)}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        {semana.metrosLineales.toFixed(1)} m × {mxn(ingresoPorMetro!)}/m
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1">Costo total</p>
                                    <p className="text-base font-bold text-gray-800">{mxn(semana.costoTotal)}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Producción + gastos</p>
                                </div>
                                <div className={`rounded-lg p-3 ${utilPos ? 'bg-green-50' : 'bg-red-50'}`}>
                                    <p className="text-xs text-gray-400 mb-1">Utilidad</p>
                                    <p className={`text-base font-bold ${utilPos ? 'text-green-600' : 'text-red-600'}`}>
                                        {utilPos ? '+' : ''}{mxn(utilidadSemana!)}
                                    </p>
                                    <p className={`text-[10px] mt-0.5 ${utilPos ? 'text-green-400' : 'text-red-400'}`}>
                                        Ingreso − costo
                                    </p>
                                </div>
                                <div className={`rounded-lg p-3 ${utilPos ? 'bg-green-50' : 'bg-red-50'}`}>
                                    <p className="text-xs text-gray-400 mb-1">Margen</p>
                                    <p className={`text-base font-bold ${utilPos ? 'text-green-600' : 'text-red-600'}`}>
                                        {margenSemana != null ? `${margenSemana.toFixed(1)}%` : '—'}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Utilidad / ingreso</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Pestañas: Registros / Gastos ─────────────────────── */}
                    <div>
                        <div className="flex gap-1 mb-3 border-b border-gray-100">
                            <button
                                onClick={() => setSeccionActiva('registros')}
                                className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
                                    seccionActiva === 'registros'
                                        ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <Droplets size={12} /> Registros diarios ({semana.registros.length})
                            </button>
                            <button
                                onClick={() => setSeccionActiva('gastos')}
                                className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
                                    seccionActiva === 'gastos'
                                        ? 'text-teal-700 border-b-2 border-teal-600 bg-teal-50/50'
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <Receipt size={12} /> Gastos Operativos ({semana.gastosOp.length})
                                {semana.costoGastosOp > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-[10px]">
                                        ${semana.costoGastosOp.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                    </span>
                                )}
                            </button>
                        </div>

                        {seccionActiva === 'registros' && <TablaRegistrosDiarios semana={semana} />}
                        {seccionActiva === 'gastos'    && <TablaGastosOp semana={semana} />}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página con carga de datos
// ─────────────────────────────────────────────────────────────────────────────
function ResumenSemanalInner() {
    const searchParams  = useSearchParams();
    const equipoIdParam = searchParams.get('equipoId') || 'todos';

    const [registros,    setRegistros]    = useState<Registro[]>([]);
    const [gastosOp,     setGastosOp]     = useState<GastoOperativo[]>([]);
    const [equipos,      setEquipos]      = useState<Equipo[]>([]);
    const [obras,        setObras]        = useState<ObraSimple[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState('');
    const [filtroEquipo, setFiltroEquipo] = useState(equipoIdParam);
    const [filtroObra,   setFiltroObra]   = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (filtroEquipo !== 'todos') params.set('equipoId', filtroEquipo);
                if (filtroObra)              params.set('obraId',   filtroObra);

                const [regs, gastos, eqs, obs] = await Promise.all([
                    fetchApi(`/registros-diarios${params.toString() ? '?' + params.toString() : ''}`),
                    fetchApi(`/gastos-operativos${filtroObra ? `?obraId=${filtroObra}` : ''}`),
                    fetchApi('/equipos'),
                    fetchApi('/obras'),
                ]);
                setRegistros(regs);
                setGastosOp(gastos);
                setEquipos(eqs);
                setObras(obs);
            } catch (e: any) {
                setError(e.message || 'Error al cargar');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [filtroEquipo, filtroObra]);

    const gastoEnSemana = (g: GastoOperativo, semanaNum: number, anoNum: number): boolean => {
        if (g.semanaNum != null && g.anoNum != null) {
            return g.semanaNum === semanaNum && g.anoNum === anoNum;
        }
        if (g.fechaInicio) {
            const d = new Date(g.fechaInicio + 'T12:00:00');
            return getISOWeek(d) === semanaNum && d.getFullYear() === anoNum;
        }
        return false;
    };

    const semanas = useMemo<ResumenSemana[]>(() => {
        if (!registros.length) return [];

        const mapa: Record<string, Registro[]> = {};
        for (const r of registros) {
            const fechaDate = new Date(r.fecha + 'T12:00:00');
            const semana    = r.semanaNum ?? getISOWeek(fechaDate);
            const ano       = r.anoNum    ?? fechaDate.getFullYear();
            const key = `${ano}-${String(semana).padStart(2, '0')}-${r.equipo.nombre}`;
            if (!mapa[key]) mapa[key] = [];
            mapa[key].push({ ...r, semanaNum: semana, anoNum: ano });
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
                const costoRenta  = regs.reduce((a, r) => a + (r.rentaEquipoDiaria ?? 0), 0);
                const dias        = regs.filter(r => r.horasTrabajadas > 0).length;

                const semanaNum = regs[0].semanaNum!;
                const anoNum    = regs[0].anoNum!;

                const gastosEnSem   = gastosOp.filter(g => gastoEnSemana(g, semanaNum, anoNum));
                const costoGastosOp = gastosEnSem.reduce((a, g) => a + g.total, 0);
                const costoTotal    = costoDiesel + costoOps + costoPeones + costoRenta + costoGastosOp;

                // Volumen de roca: usa valor del backend si existe,
                // si no calcula bordo × espaciamiento × profundidad en el cliente.
                const volsRoca = regs.map(r => calcVolumenRoca(r));
                const regsConVol = volsRoca.filter(v => v.valor != null);
                const volumenRocaTotal = regsConVol.length > 0
                    ? regsConVol.reduce((a, v) => a + (v.valor ?? 0), 0)
                    : null;
                const volumenRocaTotalCalculado = regsConVol.some(v => v.calculado);

                const regsConProf = regs.filter(r => r.profundidadPromedio != null);
                const profundidadPromProm = regsConProf.length > 0
                    ? regsConProf.reduce((a, r) => a + (r.profundidadPromedio ?? 0), 0) / regsConProf.length
                    : null;

                return {
                    semanaNum,
                    anoNum,
                    equipoNombre:    regs[0].equipo.nombre,
                    fechaInicio:     regs[0].fecha.slice(0, 10),
                    fechaFin:        regs[regs.length - 1].fecha.slice(0, 10),
                    dias,
                    horasTotales:    totalHoras,
                    barrenos:        totalBarr,
                    metrosLineales:  totalMetros,
                    litrosDiesel:    totalLitros,
                    costoDiesel,
                    costoOperadores: costoOps,
                    costoPeones,
                    costoRenta,
                    costoGastosOp,
                    costoTotal,
                    volumenRocaTotal,
                    volumenRocaTotalCalculado,
                    profundidadPromProm,
                    kpi: {
                        litrosPorHora:  totalHoras  > 0 ? +(totalLitros / totalHoras).toFixed(2)  : null,
                        litrosPorMetro: totalMetros > 0 ? +(totalLitros / totalMetros).toFixed(2) : null,
                        metrosPorHora:  totalHoras  > 0 ? +(totalMetros / totalHoras).toFixed(2)  : null,
                        metrosPorDia:   dias        > 0 ? +(totalMetros / dias).toFixed(2)        : null,
                    },
                    registros: regs,
                    gastosOp:  gastosEnSem,
                } as ResumenSemana;
            })
            .sort((a, b) => {
                if (b.anoNum !== a.anoNum) return b.anoNum - a.anoNum;
                return b.semanaNum - a.semanaNum;
            });
    }, [registros, gastosOp]);

    const totales = useMemo(() => {
        const horas      = semanas.reduce((a, s) => a + s.horasTotales,  0);
        const metros     = semanas.reduce((a, s) => a + s.metrosLineales, 0);
        const litros     = semanas.reduce((a, s) => a + s.litrosDiesel,   0);
        const costoTotal = semanas.reduce((a, s) => a + s.costoTotal,     0);
        return {
            semanas: semanas.length,
            horas, metros, litros, costoTotal,
            ltHr: horas > 0 ? +(litros / horas).toFixed(2) : null,
        };
    }, [semanas]);

    // ── Ingreso por metro estimado ────────────────────────────────────────────
    // El usuario ingresa el precio de venta por metro directamente en la UI.
    // No requiere fetch adicional. Se muestra solo si hay datos válidos.
    const [precioVentaMetro, setPrecioVentaMetro] = useState<string>('');
    const ingresoPorMetro = useMemo<number | null>(() => {
        const val = parseFloat(precioVentaMetro);
        const result = (!isNaN(val) && val > 0) ? val : null;
        console.log('[ResumenSemanal] precioVentaMetro:', JSON.stringify(precioVentaMetro), '| parsed:', val, '| ingresoPorMetro:', result);
        return result;
    }, [precioVentaMetro]);

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Resumen Semanal</h1>
                    <p className="text-sm text-gray-500 mt-1">KPIs y costos agrupados por semana.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <select
                        value={filtroObra}
                        onChange={e => setFiltroObra(e.target.value)}
                        className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="">Todas las obras</option>
                        {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                    </select>
                    <select
                        value={filtroEquipo}
                        onChange={e => setFiltroEquipo(e.target.value)}
                        className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="todos">Todos los equipos</option>
                        {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
                    </select>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                            type="number"
                            min="0"
                            step="10"
                            placeholder="Precio/metro"
                            value={precioVentaMetro}
                            onChange={e => setPrecioVentaMetro(e.target.value)}
                            className="pl-6 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 w-36"
                            title="Precio de venta por metro (para calcular utilidad estimada)"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>
            )}

            {/* KPIs globales */}
            {!loading && semanas.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Semanas',        val: totales.semanas,                                                                             unit: '',     icon: <BarChart2 size={14}/>, color: 'text-gray-800' },
                        { label: 'Horas totales',  val: totales.horas.toFixed(1),                                                                    unit: ' hrs', icon: <Gauge size={14}/>,    color: 'text-gray-800' },
                        { label: 'Metros totales', val: totales.metros.toFixed(1),                                                                    unit: ' m',   icon: <BarChart2 size={14}/>, color: 'text-gray-800' },
                        { label: 'Diésel total',   val: totales.litros.toLocaleString('es-MX'),                                                       unit: ' lt',  icon: <Droplets size={14}/>, color: 'text-blue-600' },
                        { label: 'Lt/hr prom.',    val: totales.ltHr ?? '—',                                                                          unit: '',     icon: <Gauge size={14}/>,    color: 'text-gray-700' },
                        { label: 'Costo total',    val: `$${totales.costoTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`,                unit: '',     icon: <DollarSign size={14}/>, color: 'text-gray-800' },
                    ].map(k => (
                        <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">{k.icon}{k.label}</p>
                            <p className={`text-xl font-bold ${k.color}`}>
                                {k.val}<span className="text-sm font-normal text-gray-400">{k.unit}</span>
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Lista de semanas */}
            {loading ? (
                <Card>
                    <div className="p-10 text-center text-gray-400 text-sm">Cargando resúmenes...</div>
                </Card>
            ) : semanas.length === 0 ? (
                <Card>
                    <div className="p-10 text-center">
                        <BarChart2 size={36} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-600">Sin datos semanales</p>
                        <p className="text-xs text-gray-400 mt-1">
                            Registra operaciones diarias para ver el resumen aquí.
                        </p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-3">
                    {semanas.map(s => (
                        <SemanaCard key={`${s.anoNum}-${s.semanaNum}-${s.equipoNombre}`} semana={s} ingresoPorMetro={ingresoPorMetro} />
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
