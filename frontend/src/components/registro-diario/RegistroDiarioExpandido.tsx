/**
 * RegistroDiarioExpandido
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente reutilizable para el panel expandido de un Registro Diario.
 * Fuente de verdad visual: resumen-semanal/page.tsx
 *
 * Secciones (orden fijo):
 *   1. Horómetro
 *   2. Personal
 *   3. KPIs
 *   4. Diésel
 *   5. Notas (condicional)
 *   6. Datos de perforación (condicional)
 *
 * Este componente NO gestiona el estado de expansión ni renderiza <tr> /
 * <td>. El padre envuelve el componente con el wrapper de tabla que necesite.
 */

import { Gauge, Droplets, Drill } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

/** Datos mínimos que necesita el panel expandido. */
export type RegistroDiarioExpandidoData = {
    // Horómetro
    horometroInicio: number | null;
    horometroFin: number | null;
    horasTrabajadas: number;

    // Personal
    operadores: number | null;
    peones: number | null;

    // KPIs (calculados por el backend o en el cliente)
    kpi: {
        litrosPorHora:  number | null;
        litrosPorMetro: number | null;
        metrosPorHora:  number | null;
    };

    // Diésel
    litrosDiesel:  number;
    precioDiesel:  number;
    costoDiesel:   number;

    // Notas
    notas: string | null;

    // Perforación (todos opcionales)
    bordo:              number | null;
    espaciamiento:      number | null;
    profundidadPromedio: number | null;
    volumenRoca:        number | null;
    porcentajePerdida:  number | null;
    porcentajeAvance:   number | null;
    rentaEquipoDiaria:  number | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers locales
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Semáforo de eficiencia para KPIs:
 *  Verde  ≤ bueno  → eficiente
 *  Ámbar  ≤ malo   → moderado
 *  Rojo   > malo   → consumo elevado
 */
function kpiColor(val: number | null, bueno: number, malo: number): string {
    if (val === null) return 'text-gray-400';
    if (val <= bueno) return 'text-green-600';
    if (val <= malo)  return 'text-amber-500';
    return 'text-red-500';
}

/**
 * Calcula el volumen de roca en el cliente cuando el backend devolvió null.
 * Fórmula: bordo × espaciamiento × profundidadPromedio
 */
function calcVolumenRoca(data: Pick<
    RegistroDiarioExpandidoData,
    'volumenRoca' | 'bordo' | 'espaciamiento' | 'profundidadPromedio'
>): { valor: number | null; calculado: boolean } {
    if (data.volumenRoca != null) return { valor: data.volumenRoca, calculado: false };
    if (data.bordo != null && data.espaciamiento != null && data.profundidadPromedio != null) {
        return { valor: data.bordo * data.espaciamiento * data.profundidadPromedio, calculado: true };
    }
    return { valor: null, calculado: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

interface RegistroDiarioExpandidoProps {
    data: RegistroDiarioExpandidoData;
    /**
     * Clase CSS opcional para el contenedor raíz.
     * Útil si el padre necesita ajustar el padding externo (p. ej. px-6 py-4).
     */
    className?: string;
}

export function RegistroDiarioExpandido({
    data,
    className = '',
}: RegistroDiarioExpandidoProps) {
    const volRoca = calcVolumenRoca(data);

    const tienePerforacion =
        data.bordo              != null ||
        data.espaciamiento      != null ||
        data.profundidadPromedio!= null ||
        data.volumenRoca        != null ||
        data.porcentajePerdida  != null ||
        data.porcentajeAvance   != null ||
        data.rentaEquipoDiaria  != null;

    return (
        <div className={`space-y-3 ${className}`}>

            {/* ── Tarjetas: Horómetro · Personal · KPIs · Diésel ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">

                {/* 1. Horómetro */}
                <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Horómetro
                    </p>
                    <p className="text-sm font-bold text-gray-700 font-mono">
                        {data.horometroInicio != null
                            ? data.horometroInicio.toLocaleString('es-MX')
                            : '—'}
                        {' → '}
                        {data.horometroFin != null
                            ? data.horometroFin.toLocaleString('es-MX')
                            : '—'}
                    </p>
                    <p className="text-xs text-gray-400">{data.horasTrabajadas} hrs efectivas</p>
                </div>

                {/* 2. Personal */}
                <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Personal
                    </p>
                    <p className="text-sm font-bold text-gray-700">
                        {data.operadores ?? 1} op. / {data.peones ?? 0} peón
                        {(data.peones ?? 0) !== 1 ? 'es' : ''}
                    </p>
                </div>

                {/* 3. KPIs */}
                <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                        <Gauge size={10} /> KPIs
                    </p>
                    <div className="grid grid-cols-3 gap-1 text-center">
                        <div>
                            <p className="text-[10px] text-gray-400">Lt/hr</p>
                            <p className={`text-xs font-bold ${kpiColor(data.kpi.litrosPorHora, 15, 20)}`}>
                                {data.kpi.litrosPorHora ?? '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400">Lt/m</p>
                            <p className={`text-xs font-bold ${kpiColor(data.kpi.litrosPorMetro, 1.5, 2)}`}>
                                {data.kpi.litrosPorMetro ?? '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400">m/hr</p>
                            <p className="text-xs font-bold text-gray-700">
                                {data.kpi.metrosPorHora ?? '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 4. Diésel */}
                <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                        <Droplets size={10} /> Diésel
                    </p>
                    <p className="text-xs text-gray-600">
                        {data.litrosDiesel} lt × ${data.precioDiesel}/lt
                    </p>
                    <p className="text-sm font-bold text-gray-700">
                        = ${data.costoDiesel.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </p>
                </div>
            </div>

            {/* 5. Notas (condicional) */}
            {data.notas && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 flex gap-2 items-start">
                    <span className="font-semibold flex-shrink-0">📝 Notas:</span>
                    <span>{data.notas}</span>
                </div>
            )}

            {/* 6. Datos de perforación (condicional) */}
            {tienePerforacion && (
                <div className="bg-indigo-50/80 border border-indigo-100 rounded-lg px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 mb-2 flex items-center gap-1">
                        <Drill size={10} /> Datos de perforación
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 text-xs">
                        {data.bordo != null && (
                            <div className="bg-white/60 rounded p-1.5">
                                <p className="text-indigo-400 mb-0.5">Bordo</p>
                                <p className="font-bold text-indigo-700">{data.bordo} m</p>
                            </div>
                        )}
                        {data.espaciamiento != null && (
                            <div className="bg-white/60 rounded p-1.5">
                                <p className="text-indigo-400 mb-0.5">Espa.</p>
                                <p className="font-bold text-indigo-700">{data.espaciamiento} m</p>
                            </div>
                        )}
                        {data.profundidadPromedio != null && (
                            <div className="bg-white/60 rounded p-1.5">
                                <p className="text-indigo-400 mb-0.5">Prof.</p>
                                <p className="font-bold text-indigo-700">{data.profundidadPromedio} m</p>
                            </div>
                        )}
                        {(data.volumenRoca != null || volRoca.calculado) && (
                            <div className="bg-white/60 rounded p-1.5">
                                <p className="text-indigo-400 mb-0.5">
                                    Vol. roca
                                    {volRoca.calculado && (
                                        <span className="ml-1 text-[9px] text-indigo-300">calc.</span>
                                    )}
                                </p>
                                <p className="font-bold text-indigo-700">
                                    {Number(volRoca.valor).toFixed(2)} m³
                                </p>
                            </div>
                        )}
                        {data.porcentajePerdida != null && (
                            <div className="bg-white/60 rounded p-1.5">
                                <p className="text-indigo-400 mb-0.5">% Pérdida</p>
                                <p className="font-bold text-indigo-700">{data.porcentajePerdida}%</p>
                            </div>
                        )}
                        {data.porcentajeAvance != null && (
                            <div className="bg-white/60 rounded p-1.5">
                                <p className="text-indigo-400 mb-0.5">% Avance</p>
                                <p className="font-bold text-indigo-700">{data.porcentajeAvance}%</p>
                            </div>
                        )}
                        {data.rentaEquipoDiaria != null && (
                            <div className="bg-white/60 rounded p-1.5">
                                <p className="text-indigo-400 mb-0.5">Renta/día</p>
                                <p className="font-bold text-indigo-700">
                                    ${Number(data.rentaEquipoDiaria).toLocaleString('es-MX', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
