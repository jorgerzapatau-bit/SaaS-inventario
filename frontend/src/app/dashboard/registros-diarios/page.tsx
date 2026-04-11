"use client";

import {
    useEffect, useState, useMemo, useRef, useCallback, Suspense,
} from 'react';
import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ClipboardList, Plus, Trash2, Gauge,
    Droplets, ChevronDown, ChevronUp,
    Search, X, Filter, Drill, Pencil, Copy,
    ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
    AlertTriangle, CheckCircle2, Loader2, Lock,
    Building2, Layers, Wrench, TableProperties,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
type Registro = {
    id: string; fecha: string;
    equipo: { id?: string; nombre: string; numeroEconomico: string | null };
    cliente: { nombre: string } | null;
    obra: { id: string; nombre: string } | null;
    obraNombre: string | null;
    horometroInicio: number; horometroFin: number; horasTrabajadas: number;
    barrenos: number; metrosLineales: number;
    litrosDiesel: number; precioDiesel: number; costoDiesel: number;
    operadores: number; peones: number;
    kpi: { litrosPorHora: number | null; litrosPorMetro: number | null; metrosPorHora: number | null };
    semanaNum: number | null; anoNum: number | null;
    corte: { id: string; numero: number; status: string } | null;
    bordo: number | null; espaciamiento: number | null; volumenRoca: number | null;
    porcentajePerdida: number | null; profundidadPromedio: number | null;
    porcentajeAvance: number | null; rentaEquipoDiaria: number | null;
    notas: string | null;
};

type Equipo = { id: string; nombre: string; numeroEconomico: string | null; hodometroInicial?: number };
type ObraSimple = { id: string; nombre: string };

type Plantilla = {
    id: string;
    numero: number;
    metrosContratados: number;
    barrenos: number;
    fechaInicio: string | null;
    fechaFin: string | null;
    notas: string | null;
};

type ObraConEquipos = ObraSimple & {
    obraEquipos?: { equipoId: string }[];
    plantillas?: Plantilla[];
};

type RegistroExistente = {
    id: string; fecha: string;
    horometroInicio: number | null;
    horometroFin: number;
    metrosLineales: number;
    barrenos: number;
    profundidadPromedio: number | null;
    litrosDiesel: number | null;
    precioDiesel: number | null;
    rentaEquipoDiaria: number | null;
    operadores: number | null;
    peones: number | null;
};

type EditingRow = {
    id: string;
    barrenos: string; metrosLineales: string; profundidadPromedio: string;
    litrosDiesel: string; precioDiesel: string; rentaEquipoDiaria: string;
    operadores: string; peones: string;
    horometroInicio: string; horometroFin: string;
};

type SortKey = 'fecha' | 'horas' | 'metros' | 'barrenos' | 'diesel' | 'costo';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function plantillaDeRegistro(fecha: string, plantillas: Plantilla[]): Plantilla | null {
    const iso = fecha.slice(0, 10);
    for (const p of plantillas) {
        const desde = p.fechaInicio ? p.fechaInicio.slice(0, 10) : null;
        const hasta = p.fechaFin   ? p.fechaFin.slice(0, 10)   : null;
        if (desde && iso >= desde && (!hasta || iso <= hasta)) return p;
    }
    return null;
}

function calcularAvancePorPlantilla(
    registros: RegistroExistente[],
    plantillas: Plantilla[],
): Map<number, { metros: number; barrenos: number }> {
    const map = new Map<number, { metros: number; barrenos: number }>();
    for (const p of plantillas) map.set(p.numero, { metros: 0, barrenos: 0 });
    for (const r of registros) {
        const p = plantillaDeRegistro(r.fecha, plantillas);
        if (p) {
            const cur = map.get(p.numero)!;
            cur.metros   += r.metrosLineales;
            cur.barrenos += r.barrenos;
        }
    }
    return map;
}

const fmtFecha = (iso: string | null) => {
    if (!iso) return '—';
    const [yr, mo, dy] = iso.slice(0, 10).split('-').map(Number);
    return new Date(yr, mo - 1, dy).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Stepper visual
// ─────────────────────────────────────────────────────────────────────────────
function Stepper({ paso }: { paso: 1 | 2 | 3 | 4 }) {
    const pasos = [
        { num: 1, label: 'Obra',      icon: <Building2 size={14}/> },
        { num: 2, label: 'Plantilla', icon: <Layers size={14}/> },
        { num: 3, label: 'Equipo',    icon: <Wrench size={14}/> },
        { num: 4, label: 'Captura',   icon: <TableProperties size={14}/> },
    ];
    return (
        <div className="flex items-center gap-0">
            {pasos.map((p, i) => {
                const done    = paso > p.num;
                const current = paso === p.num;
                return (
                    <React.Fragment key={p.num}>
                        <div className="flex items-center gap-1.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                done    ? 'bg-green-500 text-white' :
                                current ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                                          'bg-gray-100 text-gray-400'
                            }`}>
                                {done ? <CheckCircle2 size={14}/> : p.icon}
                            </div>
                            <span className={`text-xs font-semibold hidden sm:block ${
                                done ? 'text-green-600' : current ? 'text-blue-700' : 'text-gray-400'
                            }`}>{p.label}</span>
                        </div>
                        {i < pasos.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-2 min-w-[20px] transition-all ${done ? 'bg-green-400' : 'bg-gray-200'}`}/>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de plantilla (selector)
// ─────────────────────────────────────────────────────────────────────────────
function PlantillaCard({
    plantilla,
    avance,
    selected,
    onSelect,
}: {
    plantilla: Plantilla;
    avance: { metros: number; barrenos: number };
    selected: boolean;
    onSelect: () => void;
}) {
    const pctMetros   = plantilla.metrosContratados > 0 ? Math.min(100, (avance.metros / plantilla.metrosContratados) * 100) : 0;
    const pctBarrenos = plantilla.barrenos          > 0 ? Math.min(100, (avance.barrenos / plantilla.barrenos)          * 100) : 0;
    const completa    = pctMetros >= 100 && pctBarrenos >= 100;
    const faltanM     = Math.max(0, plantilla.metrosContratados - avance.metros);
    const faltanB     = Math.max(0, plantilla.barrenos          - avance.barrenos);

    return (
        <button
            onClick={onSelect}
            className={`w-full text-left rounded-xl border-2 p-4 space-y-3 transition-all ${
                selected
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : completa
                    ? 'border-green-200 bg-green-50/60 opacity-60 hover:opacity-90'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        selected ? 'bg-blue-500 text-white' :
                        completa ? 'bg-green-200 text-green-800' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                        P{plantilla.numero}
                    </div>
                    <span className={`text-sm font-bold ${selected ? 'text-blue-800' : completa ? 'text-green-800' : 'text-gray-800'}`}>
                        Plantilla {plantilla.numero}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {completa ? (
                        <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-200 text-green-800">
                            <CheckCircle2 size={10}/> Completa
                        </span>
                    ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            En progreso
                        </span>
                    )}
                    {selected && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                            ✓ Seleccionada
                        </span>
                    )}
                </div>
            </div>

            {/* Fechas */}
            <p className="text-xs text-gray-500">
                {fmtFecha(plantilla.fechaInicio)} → {fmtFecha(plantilla.fechaFin)}
            </p>

            {/* Barra metros */}
            <div className="space-y-1">
                <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Metros</span>
                    <span className={`font-semibold ${completa ? 'text-green-700' : selected ? 'text-blue-700' : 'text-indigo-700'}`}>
                        {avance.metros.toFixed(1)} / {plantilla.metrosContratados} m
                    </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            completa ? 'bg-green-500' : selected ? 'bg-blue-500' : 'bg-indigo-400'
                        }`}
                        style={{ width: `${pctMetros}%` }}
                    />
                </div>
                {!completa && faltanM > 0 && (
                    <p className="text-xs text-amber-600 font-medium">
                        Faltan {faltanM.toFixed(1)} m · {pctMetros.toFixed(1)}% completado
                    </p>
                )}
            </div>

            {/* Barrenos */}
            <div className="flex justify-between text-xs">
                <span className="text-gray-500">Barrenos</span>
                <span className={`font-semibold ${pctBarrenos >= 100 ? 'text-green-700' : selected ? 'text-blue-700' : 'text-indigo-600'}`}>
                    {avance.barrenos} / {plantilla.barrenos}
                    {!completa && faltanB > 0 && (
                        <span className="ml-1 text-amber-600 font-normal">(faltan {faltanB})</span>
                    )}
                </span>
            </div>

            {completa && !selected && (
                <p className="text-xs text-gray-400 italic flex items-center gap-1">
                    <Lock size={10}/> Completa — clic para editar de todas formas
                </p>
            )}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de eliminación
// ─────────────────────────────────────────────────────────────────────────────
function DeleteModal({ registro, onConfirm, onCancel }: {
    registro: Registro; onConfirm: () => void; onCancel: () => void;
}) {
    const [confirmText, setConfirmText] = useState('');
    const [yr, mo, dy] = registro.fecha.slice(0, 10).split('-').map(Number);
    const fecha = new Date(yr, mo - 1, dy).toLocaleDateString('es-MX', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-red-100 rounded-xl flex-shrink-0">
                        <AlertTriangle size={20} className="text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900">¿Eliminar este registro?</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Esta acción no se puede deshacer.</p>
                    </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1 border border-gray-100">
                    <p className="font-semibold text-gray-700">{registro.equipo.nombre}</p>
                    <p className="text-gray-500">{fecha} · {registro.horasTrabajadas} hrs · {Number(registro.metrosLineales).toFixed(1)} m</p>
                    {(registro.obra?.nombre || registro.obraNombre) && (
                        <p className="text-gray-500">{registro.obra?.nombre || registro.obraNombre}</p>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Escribe <span className="font-mono font-bold text-red-600">ELIMINAR</span> para confirmar
                    </label>
                    <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
                        placeholder="ELIMINAR" autoFocus
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400" />
                </div>
                <div className="flex gap-3 pt-1">
                    <button onClick={onCancel}
                        className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} disabled={confirmText !== 'ELIMINAR'}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                        Sí, eliminar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fila de lista general (historial)
// ─────────────────────────────────────────────────────────────────────────────
function RegistroRow({ r, onDelete, onEdit, onDuplicate, isLastForEquipo }: {
    r: Registro;
    onDelete: (r: Registro) => void;
    onEdit: (id: string) => void;
    onDuplicate: (r: Registro) => void;
    isLastForEquipo: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const [yr, mo, dy] = r.fecha.slice(0, 10).split('-').map(Number);
    const fecha = new Date(yr, mo - 1, dy).toLocaleDateString('es-MX', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
    const nombreObra = r.obra?.nombre || r.obraNombre || r.cliente?.nombre || '—';

    return (
        <>
            <tr className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => setExpanded(v => !v)}>
                <td className="p-3">
                    <p className="text-sm font-semibold text-gray-700">{fecha}</p>
                    {r.semanaNum && <p className="text-xs text-gray-400">Sem. {r.semanaNum} / {r.anoNum}</p>}
                </td>
                <td className="p-3 text-sm text-gray-600">{r.equipo.nombre}</td>
                <td className="p-3">
                    <span className={`text-sm ${r.obra ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{nombreObra}</span>
                    {r.corte && (
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-semibold ${
                            r.corte.status === 'COBRADO'   ? 'bg-green-100 text-green-700' :
                            r.corte.status === 'FACTURADO' ? 'bg-blue-100 text-blue-700'   :
                            'bg-gray-100 text-gray-500'
                        }`}>Corte #{r.corte.numero}</span>
                    )}
                </td>
                <td className="p-3 text-right font-bold text-gray-700">
                    {r.horasTrabajadas}<span className="text-xs font-normal text-gray-400"> hrs</span>
                </td>
                <td className="p-3 text-right text-gray-700">{r.barrenos}</td>
                <td className="p-3 text-right text-gray-700">
                    {Number(r.metrosLineales).toFixed(1)}<span className="text-xs text-gray-400"> m</span>
                </td>
                <td className="p-3 text-right font-semibold text-blue-600">
                    {r.litrosDiesel}<span className="text-xs font-normal text-gray-400"> lt</span>
                </td>
                <td className="p-3 text-right font-semibold text-gray-700">
                    ${r.costoDiesel.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                </td>
                <td className="p-3 text-right">
                    <div className="flex justify-end items-center gap-1">
                        {isLastForEquipo ? (
                            <button onClick={e => { e.stopPropagation(); onDuplicate(r); }}
                                title="Duplicar como nuevo registro"
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                                <Copy size={13}/>
                            </button>
                        ) : (
                            <span className="p-1.5 w-[28px]"/>
                        )}
                        <button onClick={e => { e.stopPropagation(); onEdit(r.id); }}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                            <Pencil size={13}/>
                        </button>
                        <button onClick={e => { e.stopPropagation(); onDelete(r); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={13}/>
                        </button>
                        {expanded ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr className="bg-blue-50/20">
                    <td colSpan={9} className="px-6 py-4 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Horómetro</p>
                                <p className="font-semibold text-gray-700">{r.horometroInicio.toLocaleString()} → {r.horometroFin.toLocaleString()} hrs</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Personal</p>
                                <p className="font-semibold text-gray-700">{r.operadores} op. / {r.peones} peón{r.peones !== 1 ? 'es' : ''}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Gauge size={11}/> KPIs</p>
                                <p className="text-xs text-gray-600">Lt/hr: <span className="font-bold">{r.kpi.litrosPorHora ?? 'N/A'}</span></p>
                                <p className="text-xs text-gray-600">Lt/mt: <span className="font-bold">{r.kpi.litrosPorMetro ?? 'N/A'}</span></p>
                                <p className="text-xs text-gray-600">Mt/hr: <span className="font-bold">{r.kpi.metrosPorHora ?? 'N/A'}</span></p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Droplets size={11}/> Diésel</p>
                                <p className="text-xs text-gray-600">{r.litrosDiesel} lt × ${r.precioDiesel}/lt</p>
                                <p className="text-xs font-bold text-gray-700">= ${r.costoDiesel.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>
                        {r.notas && (
                            <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-xs text-yellow-800">
                                <span className="font-semibold">Notas: </span>{r.notas}
                            </div>
                        )}
                        {(r.bordo != null || r.espaciamiento != null || r.profundidadPromedio != null || r.volumenRoca != null || r.porcentajePerdida != null || r.porcentajeAvance != null || r.rentaEquipoDiaria != null) && (
                            <div className="bg-indigo-50/80 border border-indigo-100 rounded-lg px-4 py-3">
                                <p className="text-xs font-semibold text-indigo-400 mb-2 flex items-center gap-1"><Drill size={11}/> Perforación</p>
                                <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 text-xs">
                                    {r.bordo != null && <div><p className="text-indigo-300 mb-0.5">Bordo</p><p className="font-bold text-indigo-700">{r.bordo} m</p></div>}
                                    {r.espaciamiento != null && <div><p className="text-indigo-300 mb-0.5">Espaciam.</p><p className="font-bold text-indigo-700">{r.espaciamiento} m</p></div>}
                                    {r.profundidadPromedio != null && <div><p className="text-indigo-300 mb-0.5">Prof. prom.</p><p className="font-bold text-indigo-700">{r.profundidadPromedio} m</p></div>}
                                    {r.volumenRoca != null && <div><p className="text-indigo-300 mb-0.5">Vol. roca</p><p className="font-bold text-indigo-700">{Number(r.volumenRoca).toFixed(2)} m³</p></div>}
                                    {r.porcentajePerdida != null && <div><p className="text-indigo-300 mb-0.5">% Pérdida</p><p className="font-bold text-indigo-700">{r.porcentajePerdida}%</p></div>}
                                    {r.porcentajeAvance != null && <div><p className="text-indigo-300 mb-0.5">% Avance</p><p className="font-bold text-indigo-700">{r.porcentajeAvance}%</p></div>}
                                    {r.rentaEquipoDiaria != null && <div><p className="text-indigo-300 mb-0.5">Renta/día</p><p className="font-bold text-indigo-700">${Number(r.rentaEquipoDiaria).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p></div>}
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
// Encabezado ordenable
// ─────────────────────────────────────────────────────────────────────────────
function SortTh({ label, sortKey, current, dir, onSort, className = '' }: {
    label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
    onSort: (k: SortKey) => void; className?: string;
}) {
    const active = current === sortKey;
    return (
        <th className={`p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 transition-colors ${className}`}
            onClick={() => onSort(sortKey)}>
            <span className="flex items-center gap-1 justify-end">
                {label}
                {active ? (dir === 'asc' ? <ArrowUp size={11} className="text-blue-500"/> : <ArrowDown size={11} className="text-blue-500"/>)
                    : <ArrowUpDown size={11} className="opacity-30"/>}
            </span>
        </th>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid de captura (Planilla)
// ─────────────────────────────────────────────────────────────────────────────
type GridRow = {
    fecha: string; horometroInicio: string; horometroFin: string;
    barrenos: string; metrosLineales: string; profundidadPromedio: string;
    litrosDiesel: string; precioDiesel: string; rentaEquipoDiaria: string;
    operadores: string; peones: string;
    _status: 'idle' | 'saving' | 'saved' | 'error';
    _error: string;
    _suggested: Record<string, boolean>;
};

function buildSuggestedRow(prev: GridRow): Partial<GridRow> {
    let nextFecha = '';
    if (prev.fecha) {
        const d = new Date(prev.fecha + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        nextFecha = d.toISOString().slice(0, 10);
    }
    const hIni = prev.horometroFin || '';
    const hFin = hIni && !isNaN(Number(hIni)) ? String(Number(hIni) + 8) : '';
    return {
        fecha: nextFecha, horometroInicio: hIni, horometroFin: hFin,
        barrenos: prev.barrenos, metrosLineales: prev.metrosLineales,
        profundidadPromedio: prev.profundidadPromedio,
        litrosDiesel: prev.litrosDiesel, precioDiesel: prev.precioDiesel,
        rentaEquipoDiaria: prev.rentaEquipoDiaria,
        operadores: prev.operadores, peones: prev.peones,
    };
}

const COLS: { key: keyof Omit<GridRow, '_status'|'_error'|'_suggested'>; label: string; width: number; type: string }[] = [
    { key: 'fecha',               label: 'Fecha',        width: 130, type: 'date'   },
    { key: 'horometroInicio',     label: 'H. Ini',       width: 90,  type: 'number' },
    { key: 'horometroFin',        label: 'H. Fin',       width: 90,  type: 'number' },
    { key: 'barrenos',            label: 'Barrenos',     width: 85,  type: 'number' },
    { key: 'metrosLineales',      label: 'Metros Lin.',  width: 95,  type: 'number' },
    { key: 'profundidadPromedio', label: 'Prof. (m)',    width: 85,  type: 'number' },
    { key: 'litrosDiesel',        label: 'Litros Diés.', width: 95,  type: 'number' },
    { key: 'precioDiesel',        label: 'P.U. Diés.',   width: 90,  type: 'number' },
    { key: 'rentaEquipoDiaria',   label: 'Renta/Día',    width: 95,  type: 'number' },
    { key: 'operadores',          label: 'Op.',          width: 55,  type: 'number' },
    { key: 'peones',              label: 'Pn.',          width: 55,  type: 'number' },
];

function emptyRow(): GridRow {
    return {
        fecha:'', horometroInicio:'', horometroFin:'', barrenos:'', metrosLineales:'',
        profundidadPromedio:'', litrosDiesel:'', precioDiesel:'21.95',
        rentaEquipoDiaria:'', operadores:'1', peones:'1',
        _status:'idle', _error:'', _suggested:{},
    };
}

function validateGridRow(r: GridRow) {
    if (!r.fecha) return 'Fecha requerida';
    if (!r.horometroInicio || isNaN(Number(r.horometroInicio))) return 'H. Ini requerido';
    if (!r.horometroFin   || isNaN(Number(r.horometroFin)))   return 'H. Fin requerido';
    if (Number(r.horometroFin) <= Number(r.horometroInicio))  return 'H. Fin debe ser mayor al H. Ini';
    if (Number(r.horometroFin) - Number(r.horometroInicio) > 24) return 'Diferencia mayor a 24 hrs';
    return '';
}

// Separador de plantilla dentro de la tabla
function PlantillaSeparator({ plantilla, avance, colSpan }: {
    plantilla: Plantilla;
    avance: { metros: number; barrenos: number };
    colSpan: number;
}) {
    const pctM    = plantilla.metrosContratados > 0 ? Math.min(100, (avance.metros / plantilla.metrosContratados) * 100) : 0;
    const completa = pctM >= 100 && avance.barrenos >= plantilla.barrenos;

    return (
        <tr>
            <td colSpan={colSpan} className="px-3 py-1.5">
                <div className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${completa ? 'bg-green-100 border border-green-300' : 'bg-indigo-100 border border-indigo-200'}`}>
                    <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${completa ? 'bg-green-300 text-green-900' : 'bg-indigo-300 text-indigo-900'}`}>
                        P{plantilla.numero}
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`font-semibold ${completa ? 'text-green-800' : 'text-indigo-800'}`}>Plantilla {plantilla.numero}</span>
                        <span className={`${completa ? 'text-green-600' : 'text-indigo-500'}`}>{fmtFecha(plantilla.fechaInicio)} → {fmtFecha(plantilla.fechaFin)}</span>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-white/70 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${completa ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${pctM}%` }}/>
                            </div>
                            <span className={`font-semibold ${completa ? 'text-green-700' : 'text-indigo-700'}`}>
                                {avance.metros.toFixed(1)} / {plantilla.metrosContratados} m
                            </span>
                        </div>
                        <span className={`font-semibold ${avance.barrenos >= plantilla.barrenos ? 'text-green-700' : 'text-indigo-600'}`}>
                            {avance.barrenos} / {plantilla.barrenos} barrenos
                        </span>
                        {completa && <span className="flex items-center gap-1 text-green-700 font-semibold"><CheckCircle2 size={12}/> Completa</span>}
                    </div>
                </div>
            </td>
        </tr>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid de captura principal (paso 4)
// ─────────────────────────────────────────────────────────────────────────────
function CapturaGrid({
    obraId, plantilla, equipoId, equipoNombre,
    plantillas, allPlantillas,
    equipoHodometro,
    onReset,
}: {
    obraId: string;
    plantilla: Plantilla;
    equipoId: string;
    equipoNombre: string;
    plantillas: Plantilla[];
    allPlantillas: Plantilla[];
    equipoHodometro?: number;
    onReset: () => void;
}) {
    const [registrosExistentes, setRegistrosExistentes] = useState<RegistroExistente[]>([]);
    const [loadingCtx,          setLoadingCtx]          = useState(true);
    const [nuevaFila,  setNuevaFila]  = useState<GridRow | null>(null);
    const [savingRow,  setSavingRow]  = useState(false);
    const [rowError,   setRowError]   = useState('');
    const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
    const [savingInline, setSavingInline] = useState(false);
    const [inlineError,  setInlineError]  = useState('');
    const [showSuccess,  setShowSuccess]  = useState(false);
    const [horometroLocked, setHorometroLocked] = useState(true);

    const inputRefs = useRef<(HTMLInputElement|null)[]>([]);

    // Cargar registros existentes filtrados por equipo + obra
    useEffect(() => {
        let alive = true;
        setLoadingCtx(true);
        fetchApi(`/registros-diarios?obraId=${obraId}&equipoId=${equipoId}&plantillaId=${plantilla.id}`)
            .then((data: any[]) => {
                if (!alive) return;
                setRegistrosExistentes(data.map((r: any) => ({
                    id: r.id, fecha: r.fecha,
                    horometroInicio: r.horometroInicio ?? null,
                    horometroFin: r.horometroFin,
                    metrosLineales: r.metrosLineales,
                    barrenos: r.barrenos,
                    profundidadPromedio: r.profundidadPromedio ?? null,
                    litrosDiesel: r.litrosDiesel ?? null,
                    precioDiesel: r.precioDiesel ?? null,
                    rentaEquipoDiaria: r.rentaEquipoDiaria ?? null,
                    operadores: r.operadores ?? null,
                    peones: r.peones ?? null,
                })));
            })
            .catch(() => {})
            .finally(() => { if (alive) setLoadingCtx(false); });
        return () => { alive = false; };
    }, [obraId, equipoId]);

    const registrosOrdenados = useMemo(
        () => [...registrosExistentes].sort((a, b) => a.fecha.localeCompare(b.fecha)),
        [registrosExistentes]
    );

    // Avance filtrado por la plantilla seleccionada
    const avancePlantilla = useMemo(() => {
        const regsPlantilla = registrosOrdenados.filter(r => plantillaDeRegistro(r.fecha, allPlantillas)?.id === plantilla.id);
        return {
            metros:   regsPlantilla.reduce((s, r) => s + r.metrosLineales, 0),
            barrenos: regsPlantilla.reduce((s, r) => s + r.barrenos,       0),
        };
    }, [registrosOrdenados, plantilla, allPlantillas]);

    const fechasExistentes = useMemo(() => new Set(registrosExistentes.map(r => r.fecha.slice(0, 10))), [registrosExistentes]);

    // Totales
    const totalMetros   = registrosOrdenados.reduce((s, r) => s + r.metrosLineales, 0);
    const totalBarrenos = registrosOrdenados.reduce((s, r) => s + r.barrenos,       0);
    const totalHrs      = registrosOrdenados.reduce((s, r) => s + Math.max(0, r.horometroFin - (r.horometroInicio ?? 0)), 0);
    const totalDiesel   = registrosOrdenados.reduce((s, r) => s + (r.litrosDiesel ?? 0), 0);

    const pctMetros   = plantilla.metrosContratados > 0 ? Math.min(100, (avancePlantilla.metros / plantilla.metrosContratados) * 100) : 0;
    const pctBarrenos = plantilla.barrenos          > 0 ? Math.min(100, (avancePlantilla.barrenos / plantilla.barrenos)          * 100) : 0;
    const completa    = pctMetros >= 100 && pctBarrenos >= 100;
    const ultimoHorometro = registrosOrdenados[registrosOrdenados.length - 1]?.horometroFin;

    const addNewRow = () => {
        if (nuevaFila) return;
        setHorometroLocked(true);
        const ultimo = registrosOrdenados[registrosOrdenados.length - 1];
        // El horómetro inicial es el horometroFin del último registro, o el hodometroInicial del equipo
        const hIni = ultimo
            ? String(ultimo.horometroFin)
            : equipoHodometro != null ? String(equipoHodometro) : '';
        setNuevaFila({
            ...emptyRow(),
            horometroInicio: hIni,
            horometroFin: '',
            barrenos: '', metrosLineales: '', profundidadPromedio: '',
            litrosDiesel: '', rentaEquipoDiaria: '',
            operadores: '1', peones: '1',
        });
    };

    const cancelNewRow = () => { setNuevaFila(null); setRowError(''); setHorometroLocked(true); };

    const updateNuevaFila = (key: keyof GridRow, val: string) => {
        setNuevaFila(prev => prev ? { ...prev, [key]: val, _status: 'idle', _error: '', _suggested: { ...prev._suggested, [key]: false } } : null);
        setRowError('');
    };

    const handleKeyDown = (e: React.KeyboardEvent, ci: number) => {
        if (e.key === 'Enter') { e.preventDefault(); saveRowAndReset(); }
        else if (e.key === 'Tab') { e.preventDefault(); inputRefs.current[ci + 1]?.focus(); }
        else if (e.key === 'Escape') cancelNewRow();
    };

    const saveRowAndReset = async () => {
        if (!nuevaFila) return;
        setRowError('');
        const errMsg = validateGridRow(nuevaFila);
        if (errMsg) { setRowError(errMsg); return; }
        if (fechasExistentes.has(nuevaFila.fecha)) { setRowError('⚠ Fecha ya registrada'); return; }
        setSavingRow(true);
        try {
            await fetchApi('/registros-diarios', {
                method: 'POST',
                body: JSON.stringify({
                    equipoId, obraId, plantillaId: plantilla.id,
                    fecha: nuevaFila.fecha,
                    horometroInicio: Number(nuevaFila.horometroInicio),
                    horometroFin:    Number(nuevaFila.horometroFin),
                    barrenos:        nuevaFila.barrenos        ? Number(nuevaFila.barrenos)        : 0,
                    metrosLineales:  nuevaFila.metrosLineales  ? Number(nuevaFila.metrosLineales)  : 0,
                    profundidadPromedio: nuevaFila.profundidadPromedio ? Number(nuevaFila.profundidadPromedio) : null,
                    litrosDiesel:    nuevaFila.litrosDiesel    ? Number(nuevaFila.litrosDiesel)    : 0,
                    precioDiesel:    nuevaFila.precioDiesel    ? Number(nuevaFila.precioDiesel)    : 0,
                    rentaEquipoDiaria: nuevaFila.rentaEquipoDiaria ? Number(nuevaFila.rentaEquipoDiaria) : null,
                    operadores:      nuevaFila.operadores      ? Number(nuevaFila.operadores)      : 1,
                    peones:          nuevaFila.peones          ? Number(nuevaFila.peones)          : 0,
                }),
            });
            const nuevoRegistro: RegistroExistente = {
                id: `temp-${Date.now()}`, fecha: nuevaFila.fecha,
                horometroInicio: Number(nuevaFila.horometroInicio),
                horometroFin:    Number(nuevaFila.horometroFin),
                metrosLineales:  Number(nuevaFila.metrosLineales),
                barrenos:        Number(nuevaFila.barrenos),
                profundidadPromedio: nuevaFila.profundidadPromedio ? Number(nuevaFila.profundidadPromedio) : null,
                litrosDiesel:        nuevaFila.litrosDiesel        ? Number(nuevaFila.litrosDiesel)        : null,
                precioDiesel:        nuevaFila.precioDiesel        ? Number(nuevaFila.precioDiesel)        : null,
                rentaEquipoDiaria:   nuevaFila.rentaEquipoDiaria   ? Number(nuevaFila.rentaEquipoDiaria)   : null,
                operadores:          nuevaFila.operadores          ? Number(nuevaFila.operadores)          : null,
                peones:              nuevaFila.peones              ? Number(nuevaFila.peones)              : null,
            };
            setRegistrosExistentes(prev => [...prev, nuevoRegistro]);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            setNuevaFila(null);
            setRowError('');
        } catch (err: any) {
            const msg = err.message || 'Error';
            setRowError(msg.toLowerCase().includes('ya existe') || msg.includes('P2002') ? '⚠ Fecha ya registrada' : msg);
        } finally { setSavingRow(false); }
    };

    const startEditingRow = (r: RegistroExistente) => {
        setEditingRow({
            id: r.id,
            barrenos:            String(r.barrenos        ?? ''),
            metrosLineales:      String(r.metrosLineales  ?? ''),
            profundidadPromedio: r.profundidadPromedio != null ? String(r.profundidadPromedio) : '',
            litrosDiesel:        r.litrosDiesel        != null ? String(r.litrosDiesel)        : '',
            precioDiesel:        r.precioDiesel        != null ? String(r.precioDiesel)        : '21.95',
            rentaEquipoDiaria:   r.rentaEquipoDiaria   != null ? String(r.rentaEquipoDiaria)   : '',
            operadores:          r.operadores          != null ? String(r.operadores)          : '1',
            peones:              r.peones              != null ? String(r.peones)              : '0',
            horometroInicio:     String(r.horometroInicio ?? ''),
            horometroFin:        String(r.horometroFin    ?? ''),
        });
        setInlineError('');
    };

    const saveInlineEdit = async () => {
        if (!editingRow) return;
        setSavingInline(true);
        setInlineError('');
        try {
            await fetchApi(`/registros-diarios/${editingRow.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    barrenos:            editingRow.barrenos            ? Number(editingRow.barrenos)            : 0,
                    metrosLineales:      editingRow.metrosLineales       ? Number(editingRow.metrosLineales)      : 0,
                    profundidadPromedio: editingRow.profundidadPromedio  ? Number(editingRow.profundidadPromedio) : null,
                    litrosDiesel:        editingRow.litrosDiesel         ? Number(editingRow.litrosDiesel)        : 0,
                    precioDiesel:        editingRow.precioDiesel         ? Number(editingRow.precioDiesel)        : 0,
                    rentaEquipoDiaria:   editingRow.rentaEquipoDiaria    ? Number(editingRow.rentaEquipoDiaria)   : null,
                    operadores:          editingRow.operadores           ? Number(editingRow.operadores)          : 1,
                    peones:              editingRow.peones               ? Number(editingRow.peones)              : 0,
                    horometroInicio:     Number(editingRow.horometroInicio),
                    horometroFin:        Number(editingRow.horometroFin),
                }),
            });
            setRegistrosExistentes(prev => prev.map(r => r.id !== editingRow.id ? r : {
                ...r,
                barrenos:            Number(editingRow.barrenos)            || r.barrenos,
                metrosLineales:      Number(editingRow.metrosLineales)       || r.metrosLineales,
                horometroInicio:     Number(editingRow.horometroInicio),
                horometroFin:        Number(editingRow.horometroFin),
                profundidadPromedio: editingRow.profundidadPromedio ? Number(editingRow.profundidadPromedio) : r.profundidadPromedio,
                litrosDiesel:        editingRow.litrosDiesel        ? Number(editingRow.litrosDiesel)        : r.litrosDiesel,
                precioDiesel:        editingRow.precioDiesel        ? Number(editingRow.precioDiesel)        : r.precioDiesel,
                rentaEquipoDiaria:   editingRow.rentaEquipoDiaria   ? Number(editingRow.rentaEquipoDiaria)   : r.rentaEquipoDiaria,
                operadores:          editingRow.operadores          ? Number(editingRow.operadores)          : r.operadores,
                peones:              editingRow.peones              ? Number(editingRow.peones)              : r.peones,
            }));
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            setEditingRow(null);
        } catch (e: any) { setInlineError(e.message || 'Error al guardar'); }
        finally { setSavingInline(false); }
    };

    const isDupe  = nuevaFila ? (!!nuevaFila.fecha && fechasExistentes.has(nuevaFila.fecha)) : false;
    const isEmpty = nuevaFila ? (!nuevaFila.fecha && !nuevaFila.horometroFin) : true;
    const hrs     = nuevaFila && nuevaFila.horometroFin && nuevaFila.horometroInicio
        ? Math.max(0, Number(nuevaFila.horometroFin) - Number(nuevaFila.horometroInicio)) : null;
    const hFinValid = nuevaFila
        ? (nuevaFila.horometroFin && nuevaFila.horometroInicio
            ? Number(nuevaFila.horometroFin) > Number(nuevaFila.horometroInicio)
              && (Number(nuevaFila.horometroFin) - Number(nuevaFila.horometroInicio)) <= 24
            : true)
        : true;
    const canSave = nuevaFila && !isEmpty && !isDupe && !savingRow && hFinValid;
    const colSpanTotal = COLS.length + 3;

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Banner resumen de selección */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">

                {/* Breadcrumb de selección */}
                <div className="flex items-center gap-2 text-sm flex-wrap">
                    <button onClick={onReset} className="text-blue-500 hover:underline font-medium flex items-center gap-1">
                        <ChevronLeft size={14}/> Cambiar selección
                    </button>
                    <span className="text-gray-300">›</span>
                    <span className="text-gray-600 font-semibold">{equipoNombre}</span>
                    <span className="text-gray-300">›</span>
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                        <Layers size={10}/> P{plantilla.numero}
                    </span>
                </div>

                {/* Progreso de plantilla */}
                <div className={`rounded-xl border p-3 space-y-2 ${completa ? 'bg-green-50 border-green-200' : 'bg-indigo-50/60 border-indigo-200'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${completa ? 'bg-green-200 text-green-800' : 'bg-indigo-200 text-indigo-800'}`}>
                                P{plantilla.numero}
                            </div>
                            <div>
                                <span className={`text-sm font-bold ${completa ? 'text-green-800' : 'text-indigo-800'}`}>Plantilla {plantilla.numero}</span>
                                <span className="text-xs text-gray-500 ml-2">{fmtFecha(plantilla.fechaInicio)} → {fmtFecha(plantilla.fechaFin)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {ultimoHorometro && (
                                <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                                    Último horómetro: <strong>{ultimoHorometro}</strong>
                                </span>
                            )}
                            {completa
                                ? <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-200 text-green-800"><CheckCircle2 size={11}/> Completa</span>
                                : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-700">En progreso</span>
                            }
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Metros</span>
                                <span className={`font-semibold ${completa ? 'text-green-700' : 'text-indigo-700'}`}>
                                    {avancePlantilla.metros.toFixed(1)} / {plantilla.metrosContratados} m
                                </span>
                            </div>
                            <div className="h-2 bg-white/70 rounded-full overflow-hidden border border-white">
                                <div className={`h-full rounded-full transition-all ${completa ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${pctMetros}%` }}/>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Barrenos</span>
                                <span className={`font-semibold ${pctBarrenos >= 100 ? 'text-green-700' : 'text-indigo-600'}`}>
                                    {avancePlantilla.barrenos} / {plantilla.barrenos}
                                </span>
                            </div>
                            <div className="h-2 bg-white/70 rounded-full overflow-hidden border border-white">
                                <div className={`h-full rounded-full transition-all ${pctBarrenos >= 100 ? 'bg-green-500' : 'bg-indigo-400'}`} style={{ width: `${pctBarrenos}%` }}/>
                            </div>
                        </div>
                    </div>
                </div>

                {completa && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                        <Lock size={13} className="flex-shrink-0"/>
                        <span>Esta plantilla está <strong>completa</strong>. Puedes seguir editando registros existentes.</span>
                    </div>
                )}

                {showSuccess && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-xs text-green-700 flex items-center gap-2 animate-in fade-in duration-200">
                        <CheckCircle2 size={14} className="text-green-600"/>
                        <span className="font-medium">✓ Registro guardado exitosamente</span>
                    </div>
                )}

                <p className="text-xs text-gray-400">
                    💡 Presiona <kbd className="px-1 bg-gray-100 rounded text-xs font-mono">Enter</kbd> para guardar.
                    <kbd className="px-1 mx-1 bg-gray-100 rounded text-xs font-mono">Esc</kbd> para cancelar.
                </p>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {loadingCtx && (
                    <div className="flex items-center justify-center py-10 gap-2 text-sm text-gray-400">
                        <Loader2 size={16} className="animate-spin"/> Cargando registros…
                    </div>
                )}

                {!loadingCtx && (
                    <>
                        {editingRow && (
                            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border-b-2 border-amber-300">
                                <div className="flex items-center gap-2 text-sm text-amber-800">
                                    <Pencil size={14} className="text-amber-500"/>
                                    <span className="font-semibold">Editando registro</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {inlineError && <span className="text-xs text-red-600">{inlineError}</span>}
                                    <button onClick={() => { setEditingRow(null); setInlineError(''); }}
                                        className="px-3 py-1.5 border border-gray-300 bg-white text-gray-600 text-xs rounded-lg hover:bg-gray-50">
                                        Cancelar
                                    </button>
                                    <button onClick={saveInlineEdit} disabled={savingInline}
                                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1">
                                        {savingInline ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>}
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm" style={{ minWidth: 980 }}>
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="w-8 p-2 text-xs text-gray-400 font-medium text-center border-r">#</th>
                                        {COLS.map(col => (
                                            <th key={col.key} className="p-2 text-xs font-semibold uppercase text-left border-r text-gray-500 whitespace-nowrap" style={{ minWidth: col.width }}>
                                                {col.label}
                                            </th>
                                        ))}
                                        <th className="p-2 text-xs font-semibold text-center border-r text-green-600 whitespace-nowrap" style={{ minWidth: 64 }}>Hrs</th>
                                        <th className="p-2 text-xs font-semibold text-center" style={{ minWidth: 120 }}>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Separador de plantilla activa */}
                                    <PlantillaSeparator plantilla={plantilla} avance={avancePlantilla} colSpan={colSpanTotal}/>

                                    {registrosOrdenados.length === 0 && !nuevaFila && (
                                        <tr>
                                            <td colSpan={colSpanTotal} className="text-center py-8 text-sm text-gray-400 italic">
                                                Sin registros para esta plantilla — agrega el primer día
                                            </td>
                                        </tr>
                                    )}

                                    {registrosOrdenados.map((r, i) => {
                                        const iso = (r.fecha || '').slice(0, 10);
                                        const [yr, mo, dy] = iso.split('-').map(Number);
                                        const fechaStr = `${String(dy).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${yr}`;
                                        const isEditing = editingRow?.id === r.id;
                                        const hrsReg = r.horometroInicio != null ? r.horometroFin - r.horometroInicio : null;

                                        if (isEditing) {
                                            const hrsEdit = editingRow.horometroFin && editingRow.horometroInicio
                                                ? Math.max(0, Number(editingRow.horometroFin) - Number(editingRow.horometroInicio)) : null;
                                            const editInp = (key: keyof EditingRow, placeholder = '') => (
                                                <input type="text" inputMode="decimal"
                                                    value={editingRow[key] as string}
                                                    onChange={e => setEditingRow(prev => prev ? { ...prev, [key]: e.target.value } : prev)}
                                                    placeholder={placeholder}
                                                    className="w-full h-9 px-2 bg-white border border-blue-300 rounded text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                                            );
                                            return (
                                                <tr key={r.id} className="border-b border-amber-200 bg-amber-50/60">
                                                    <td className="p-2 text-xs text-amber-400 text-center border-r w-8">{i + 1}</td>
                                                    <td className="border-r border-amber-100 px-2 h-9 text-xs font-medium text-amber-700 whitespace-nowrap">{fechaStr}</td>
                                                    {COLS.slice(1).map(col => (
                                                        <td key={col.key} className="border-r border-amber-100 p-1" style={{ minWidth: col.width }}>
                                                            {editInp(col.key as keyof EditingRow, '—')}
                                                        </td>
                                                    ))}
                                                    <td className="border-r border-amber-100 text-center px-1">
                                                        {hrsEdit !== null ? <span className="text-xs font-bold px-1.5 py-0.5 rounded text-amber-700 bg-amber-100">{hrsEdit}h</span> : <span className="text-gray-200">—</span>}
                                                    </td>
                                                    <td className="text-center px-2"><span className="text-xs text-amber-600 font-semibold">Editando…</span></td>
                                                </tr>
                                            );
                                        }

                                        return (
                                            <tr key={r.id} className="border-b border-gray-100 bg-blue-50/20 hover:bg-blue-100/30">
                                                <td className="p-2 text-xs text-blue-300 text-center border-r w-8">{i + 1}</td>
                                                <td className="border-r border-blue-100 px-2 h-9 text-xs font-medium text-blue-700 whitespace-nowrap">{fechaStr}</td>
                                                <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.horometroInicio ?? '—'}</td>
                                                <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600 font-semibold">{r.horometroFin}</td>
                                                <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.barrenos || '—'}</td>
                                                <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.metrosLineales?.toFixed(1) || '—'}</td>
                                                <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.profundidadPromedio ?? '—'}</td>
                                                <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.litrosDiesel ?? '—'}</td>
                                                <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.precioDiesel ?? '—'}</td>
                                                <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.rentaEquipoDiaria != null ? `$${Number(r.rentaEquipoDiaria).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                                                <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.operadores ?? '—'}</td>
                                                <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.peones ?? '—'}</td>
                                                <td className="border-r border-blue-100 text-center px-1">
                                                    {hrsReg !== null ? <span className="text-xs font-bold px-1.5 py-0.5 rounded text-blue-600 bg-blue-100">{hrsReg}h</span> : <span className="text-gray-200">—</span>}
                                                </td>
                                                <td className="text-center px-2">
                                                    <button onClick={() => startEditingRow(r)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-700 text-xs font-semibold rounded-md">
                                                        <Pencil size={10}/> Editar
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* Nueva fila */}
                                    {nuevaFila && (
                                        <tr className={`border-b transition-colors ${isDupe ? 'bg-amber-50' : isEmpty ? 'bg-gray-50' : 'bg-green-50/40'}`}>
                                            <td className="p-2 text-xs font-semibold text-center border-r w-8">+</td>
                                            {COLS.map((col, ci) => {
                                                const val = nuevaFila[col.key] as string;
                                                const isHIni = col.key === 'horometroInicio';
                                                const isHFin = col.key === 'horometroFin';
                                                const hFinNum = Number(nuevaFila.horometroFin);
                                                const hIniNum = Number(nuevaFila.horometroInicio);
                                                const isErrorMenor = isHFin && val && nuevaFila.horometroInicio && hFinNum <= hIniNum;
                                                const isError24    = isHFin && val && nuevaFila.horometroInicio && (hFinNum - hIniNum) > 24;
                                                const isError = isErrorMenor || isError24;
                                                const isLocked = isHIni && horometroLocked;

                                                return (
                                                    <td key={col.key} className={`p-1 border-r ${isDupe && col.key === 'fecha' ? 'bg-amber-100' : ''} ${isError ? 'bg-red-50' : ''} ${isLocked ? 'bg-gray-50' : ''}`} style={{ minWidth: col.width }}>
                                                        {isHIni ? (
                                                            <div className="relative flex items-center h-9">
                                                                <input
                                                                    ref={el => { inputRefs.current[ci] = el; }}
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    value={val}
                                                                    readOnly={horometroLocked}
                                                                    onChange={e => updateNuevaFila(col.key, e.target.value)}
                                                                    onKeyDown={e => handleKeyDown(e, ci)}
                                                                    placeholder="—"
                                                                    className={`w-full h-9 pl-2 pr-7 text-xs focus:outline-none focus:ring-2 transition-colors ${
                                                                        horometroLocked
                                                                            ? 'bg-gray-50 border border-gray-200 text-gray-500 cursor-not-allowed'
                                                                            : 'border border-blue-300 text-gray-800 focus:ring-blue-500'
                                                                    }`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    title={horometroLocked ? 'Editar horómetro inicial' : 'Bloquear'}
                                                                    onClick={() => setHorometroLocked(l => !l)}
                                                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-blue-600 transition-colors"
                                                                >
                                                                    {horometroLocked ? <Lock size={11}/> : <Pencil size={11}/>}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <input
                                                                ref={el => { inputRefs.current[ci] = el; }}
                                                                type={col.type === 'date' ? 'date' : 'text'}
                                                                inputMode={col.type === 'number' ? 'decimal' : undefined}
                                                                value={val}
                                                                onChange={e => updateNuevaFila(col.key, e.target.value)}
                                                                onKeyDown={e => handleKeyDown(e, ci)}
                                                                placeholder={col.type === 'date' ? 'DD/MM/YYYY' : '—'}
                                                                className={`w-full h-9 px-2 text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
                                                                    ${isError ? 'text-red-600 border-red-300 bg-red-50' : 'border-gray-200 text-gray-800'}
                                                                `}
                                                            />
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="p-2 text-xs text-center border-r">
                                                {hrs !== null
                                                    ? <span className={`px-2 py-1 rounded font-bold ${hrs > 24 ? 'bg-red-100 text-red-700' : hrs > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{hrs}h{hrs > 24 ? ' ⚠' : ''}</span>
                                                    : '—'}
                                            </td>
                                            <td className="text-center px-2 min-w-[120px] space-y-1">
                                                {isDupe && !isEmpty ? (
                                                    <span className="text-amber-600 font-medium text-xs block">⚠ Duplicada</span>
                                                ) : isEmpty ? (
                                                    <span className="text-gray-300 text-xs block">—</span>
                                                ) : (
                                                    <div className="flex gap-1 justify-center">
                                                        <button onClick={saveRowAndReset} disabled={!canSave}
                                                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors ${canSave ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                                            {savingRow ? <Loader2 size={10} className="animate-spin"/> : <CheckCircle2 size={10}/>}
                                                            {savingRow ? '…' : 'OK'}
                                                        </button>
                                                        <button onClick={cancelNewRow}
                                                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors">
                                                            ✕
                                                        </button>
                                                    </div>
                                                )}
                                                {nuevaFila && nuevaFila.horometroFin && nuevaFila.horometroInicio && Number(nuevaFila.horometroFin) <= Number(nuevaFila.horometroInicio) && (
                                                    <p className="text-red-500 text-xs leading-tight mt-1">H. Fin debe ser mayor al Inicial</p>
                                                )}
                                                {nuevaFila && nuevaFila.horometroFin && nuevaFila.horometroInicio && (Number(nuevaFila.horometroFin) - Number(nuevaFila.horometroInicio)) > 24 && (
                                                    <p className="text-red-500 text-xs leading-tight mt-1">⚠ Supera 24 hrs</p>
                                                )}
                                                {rowError && <p className="text-red-500 text-xs leading-tight mt-1">{rowError}</p>}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Totales */}
                        {registrosExistentes.length > 0 && (
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 border-t border-gray-100 bg-gray-50/80 text-xs">
                                <span className="text-gray-400 font-medium">Totales (equipo en obra):</span>
                                <span className="text-gray-600"><span className="font-semibold text-gray-800">{registrosExistentes.length}</span> registros</span>
                                <span className="text-gray-600"><span className="font-semibold text-gray-800">{totalBarrenos}</span> barrenos</span>
                                <span className="text-gray-600"><span className="font-semibold text-blue-700">{totalMetros.toFixed(1)} m</span></span>
                                <span className="text-gray-600"><span className="font-semibold text-gray-800">{totalHrs}</span> hrs</span>
                                <span className="text-gray-600"><span className="font-semibold text-gray-800">{totalDiesel.toLocaleString('es-MX')}</span> lt diésel</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                            <span className="text-xs text-gray-500">
                                {registrosExistentes.length} registro{registrosExistentes.length !== 1 ? 's' : ''} guardado{registrosExistentes.length !== 1 ? 's' : ''}
                            </span>
                            {!nuevaFila && !completa && (
                                <button onClick={addNewRow}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                                    <Plus size={14}/> Agregar fila
                                </button>
                            )}
                            {!nuevaFila && completa && (
                                <button onClick={addNewRow}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors">
                                    <Plus size={14}/> Agregar igualmente
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal — flujo de 4 pasos
// ─────────────────────────────────────────────────────────────────────────────
function RegistrosDiariosInner() {
    const searchParams = useSearchParams();
    const router       = useRouter();

    // Estado global
    const [registros, setRegistros] = useState<Registro[]>([]);
    const [equipos,   setEquipos]   = useState<Equipo[]>([]);
    const [obras,     setObras]     = useState<ObraConEquipos[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState('');

    // Selecciones del wizard
    const [obraId,     setObraId]     = useState('');
    const [plantilla,  setPlantilla]  = useState<Plantilla | null>(null);
    const [equipoId,   setEquipoId]   = useState('');
    const [equipoNombre, setEquipoNombre] = useState('');

    // Equipos de la plantilla (cargados dinámicamente)
    const [equiposPlantilla, setEquiposPlantilla] = useState<Equipo[]>([]);
    const [loadingEquipos,   setLoadingEquipos]   = useState(false);

    // Vista historial
    const [vistaHistorial,  setVistaHistorial]  = useState(false);
    const [filtroEquipo,    setFiltroEquipo]    = useState('todos');
    const [filtroObra,      setFiltroObra]      = useState('todas');
    const [filtroDesde,     setFiltroDesde]     = useState('');
    const [filtroHasta,     setFiltroHasta]     = useState('');
    const [filtroSemana,    setFiltroSemana]    = useState('todas');
    const [busqueda,        setBusqueda]        = useState('');
    const [sortKey,         setSortKey]         = useState<SortKey>('fecha');
    const [sortDir,         setSortDir]         = useState<SortDir>('asc');
    const [page,            setPage]            = useState(1);
    const [registroAEliminar, setRegistroAEliminar] = useState<Registro | null>(null);

    // Carga inicial
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [regs, eqs, obs] = await Promise.all([
                fetchApi('/registros-diarios'),
                fetchApi('/equipos'),
                fetchApi('/obras'),
            ]);
            setRegistros(regs); setEquipos(eqs); setObras(obs);
        } catch (e: any) { setError(e.message || 'Error al cargar'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [filtroEquipo, filtroObra, filtroSemana, filtroDesde, filtroHasta, busqueda, sortKey, sortDir]);

    const obraSeleccionada = obras.find(o => o.id === obraId);
    const plantillas: Plantilla[] = useMemo(
        () => (obraSeleccionada?.plantillas ?? []).sort((a, b) => a.numero - b.numero),
        [obraSeleccionada]
    );

    // Cargar avance general para mostrar en las tarjetas de plantilla
    const avancePorPlantilla = useMemo(() => {
        const regsObra = registros.filter(r => r.obra?.id === obraId);
        const regsExistentes: RegistroExistente[] = regsObra.map(r => ({
            id: r.id, fecha: r.fecha,
            horometroInicio: r.horometroInicio,
            horometroFin: r.horometroFin,
            metrosLineales: r.metrosLineales,
            barrenos: r.barrenos,
            profundidadPromedio: r.profundidadPromedio,
            litrosDiesel: r.litrosDiesel,
            precioDiesel: r.precioDiesel,
            rentaEquipoDiaria: r.rentaEquipoDiaria,
            operadores: r.operadores,
            peones: r.peones,
        }));
        return calcularAvancePorPlantilla(regsExistentes, plantillas);
    }, [registros, obraId, plantillas]);

    // Cargar equipos de la plantilla seleccionada
    useEffect(() => {
        if (!obraId || !plantilla) { setEquiposPlantilla([]); return; }
        setLoadingEquipos(true);
        fetchApi(`/obras/${obraId}/plantillas/${plantilla.id}/equipos`)
            .then((data: any[]) => {
                setEquiposPlantilla(data.map((pe: any) => ({
                    id: pe.equipo.id,
                    nombre: pe.equipo.nombre,
                    numeroEconomico: pe.equipo.numeroEconomico,
                    hodometroInicial: pe.equipo.hodometroInicial != null ? Number(pe.equipo.hodometroInicial) : undefined,
                })));
            })
            .catch(() => {
                // Fallback: usar equipos de la obra
                const equiposObra = obraSeleccionada?.obraEquipos?.length
                    ? equipos.filter(eq => obraSeleccionada.obraEquipos!.some(oe => oe.equipoId === eq.id))
                    : equipos;
                setEquiposPlantilla(equiposObra);
            })
            .finally(() => setLoadingEquipos(false));
    }, [obraId, plantilla, obraSeleccionada, equipos]);

    // Paso actual del wizard
    const paso: 1|2|3|4 = !obraId ? 1 : !plantilla ? 2 : !equipoId ? 3 : 4;

    const resetWizard = () => {
        setObraId(''); setPlantilla(null); setEquipoId(''); setEquipoNombre('');
        setEquiposPlantilla([]);
    };

    // Historial / lista
    const handleDeleteConfirm = async () => {
        if (!registroAEliminar) return;
        try {
            await fetchApi(`/registros-diarios/${registroAEliminar.id}`, { method: 'DELETE' });
            setRegistros(r => r.filter(x => x.id !== registroAEliminar.id));
        } catch (e: any) { alert(e.message || 'Error al eliminar'); }
        finally { setRegistroAEliminar(null); }
    };

    const handleEdit      = (id: string) => router.push(`/dashboard/registros-diarios/${id}/edit`);
    const handleDuplicate = (r: Registro) => {
        const params = new URLSearchParams();
        const eq = equipos.find(e => e.nombre === r.equipo.nombre);
        if (eq)         params.set('equipoId', eq.id);
        if (r.obra?.id) params.set('obraId', r.obra.id);
        const copia = {
            barrenos: r.barrenos, metrosLineales: r.metrosLineales,
            litrosDiesel: r.litrosDiesel, precioDiesel: r.precioDiesel,
            operadores: r.operadores, peones: r.peones,
            horometroInicio: r.horometroFin,
            bordo: r.bordo, espaciamiento: r.espaciamiento,
            profundidadPromedio: r.profundidadPromedio,
            rentaEquipoDiaria: r.rentaEquipoDiaria,
        };
        params.set('copia', btoa(JSON.stringify(copia)));
        router.push(`/dashboard/registros-diarios/new?${params.toString()}`);
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const semanas = useMemo(() =>
        Array.from(new Set(registros.filter(r => r.semanaNum)
            .map(r => `${r.anoNum}-${String(r.semanaNum).padStart(2, '0')}`)
        )).sort().reverse(), [registros]);

    const filtrados = useMemo(() => {
        let list = registros.filter(r => {
            if (filtroEquipo !== 'todos') {
                const eq = equipos.find(e => e.id === filtroEquipo);
                if (eq && r.equipo.nombre !== eq.nombre) return false;
            }
            if (filtroObra !== 'todas' && r.obra?.id !== filtroObra) return false;
            if (filtroSemana !== 'todas') {
                const key = `${r.anoNum}-${String(r.semanaNum).padStart(2, '0')}`;
                if (key !== filtroSemana) return false;
            }
            if (filtroDesde && r.fecha.slice(0, 10) < filtroDesde) return false;
            if (filtroHasta && r.fecha.slice(0, 10) > filtroHasta) return false;
            if (busqueda) {
                const q = busqueda.toLowerCase();
                return r.equipo.nombre.toLowerCase().includes(q)
                    || (r.obra?.nombre || '').toLowerCase().includes(q)
                    || (r.obraNombre  || '').toLowerCase().includes(q);
            }
            return true;
        });
        list = [...list].sort((a, b) => {
            let va: number, vb: number;
            switch (sortKey) {
                case 'fecha':    va = new Date(a.fecha).getTime(); vb = new Date(b.fecha).getTime(); break;
                case 'horas':    va = a.horasTrabajadas; vb = b.horasTrabajadas; break;
                case 'metros':   va = a.metrosLineales;  vb = b.metrosLineales;  break;
                case 'barrenos': va = a.barrenos;        vb = b.barrenos;        break;
                case 'diesel':   va = a.litrosDiesel;    vb = b.litrosDiesel;    break;
                case 'costo':    va = a.costoDiesel;     vb = b.costoDiesel;     break;
                default:         va = 0; vb = 0;
            }
            return sortDir === 'asc' ? va - vb : vb - va;
        });
        return list;
    }, [registros, filtroEquipo, filtroObra, filtroSemana, filtroDesde, filtroHasta, busqueda, equipos, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
    const paginated  = filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const hayFiltros = filtroEquipo !== 'todos' || filtroObra !== 'todas' || filtroSemana !== 'todas' || !!filtroDesde || !!filtroHasta || !!busqueda;
    const clearFiltros = () => { setFiltroEquipo('todos'); setFiltroObra('todas'); setFiltroSemana('todas'); setFiltroDesde(''); setFiltroHasta(''); setBusqueda(''); };

    const lastIdByEquipo = useMemo(() => {
        const map = new Map<string, string>();
        for (const r of registros) {
            const key     = r.equipo.nombre;
            const current = registros.find(x => x.id === map.get(key));
            if (!current || r.horometroFin > current.horometroFin) map.set(key, r.id);
        }
        return map;
    }, [registros]);

    const totalHoras  = filtrados.reduce((a, r) => a + r.horasTrabajadas, 0);
    const totalMetros = filtrados.reduce((a, r) => a + r.metrosLineales,  0);
    const totalLitros = filtrados.reduce((a, r) => a + r.litrosDiesel,    0);
    const totalCosto  = filtrados.reduce((a, r) => a + r.costoDiesel,     0);
    const promLtHr    = totalHoras > 0 ? (totalLitros / totalHoras).toFixed(2) : '—';

    return (
        <>
            {registroAEliminar && (
                <DeleteModal registro={registroAEliminar} onConfirm={handleDeleteConfirm} onCancel={() => setRegistroAEliminar(null)}/>
            )}

            <div className="space-y-5 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Registro Diario</h1>
                        <p className="text-sm text-gray-500 mt-1">Control diario de operación — equivalente a la hoja Rpte del Excel.</p>
                    </div>
                    <button
                        onClick={() => setVistaHistorial(v => !v)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            vistaHistorial
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {vistaHistorial ? <><X size={14}/> Cerrar historial</> : <><ClipboardList size={14}/> Ver historial</>}
                    </button>
                </div>

                {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

                {/* ── WIZARD DE 4 PASOS ─────────────────────────────────────── */}
                {!vistaHistorial && (
                    <div className="space-y-4">
                        {/* Stepper */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
                            <Stepper paso={paso}/>
                        </div>

                        {/* PASO 1: Obra */}
                        <div className={`bg-white rounded-xl border shadow-sm p-5 space-y-3 transition-all ${paso === 1 ? 'border-blue-300' : 'border-gray-200'}`}>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${paso > 1 ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}>
                                    {paso > 1 ? <CheckCircle2 size={13}/> : '1'}
                                </div>
                                <h2 className="text-sm font-bold text-gray-700">Selecciona la Obra</h2>
                                {paso > 1 && (
                                    <button onClick={() => { setObraId(''); setPlantilla(null); setEquipoId(''); setEquipoNombre(''); }}
                                        className="ml-auto text-xs text-blue-500 hover:underline flex items-center gap-1">
                                        <Pencil size={11}/> Cambiar
                                    </button>
                                )}
                            </div>

                            {paso === 1 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {obras.length === 0 && loading && (
                                        <p className="text-sm text-gray-400 col-span-full">Cargando obras…</p>
                                    )}
                                    {obras.map(o => (
                                        <button key={o.id} onClick={() => { setObraId(o.id); setPlantilla(null); setEquipoId(''); }}
                                            className="text-left px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-sm font-semibold text-gray-700">
                                            <Building2 size={14} className="inline mr-2 text-gray-400"/>
                                            {o.nombre}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Building2 size={14} className="text-green-500"/>
                                    {obraSeleccionada?.nombre}
                                </p>
                            )}
                        </div>

                        {/* PASO 2: Plantilla */}
                        {paso >= 2 && (
                            <div className={`bg-white rounded-xl border shadow-sm p-5 space-y-3 transition-all ${paso === 2 ? 'border-blue-300' : 'border-gray-200'}`}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${paso > 2 ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}>
                                        {paso > 2 ? <CheckCircle2 size={13}/> : '2'}
                                    </div>
                                    <h2 className="text-sm font-bold text-gray-700">Selecciona la Plantilla</h2>
                                    {paso > 2 && (
                                        <button onClick={() => { setPlantilla(null); setEquipoId(''); setEquipoNombre(''); }}
                                            className="ml-auto text-xs text-blue-500 hover:underline flex items-center gap-1">
                                            <Pencil size={11}/> Cambiar
                                        </button>
                                    )}
                                </div>

                                {paso === 2 && (
                                    <>
                                        {plantillas.length === 0 && (
                                            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                                Esta obra no tiene plantillas configuradas.
                                            </p>
                                        )}
                                        <div className={`grid gap-3 ${plantillas.length === 1 ? 'grid-cols-1 max-w-sm' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                                            {plantillas.map(p => (
                                                <PlantillaCard
                                                    key={p.id}
                                                    plantilla={p}
                                                    avance={avancePorPlantilla.get(p.numero) ?? { metros: 0, barrenos: 0 }}
                                                    selected={plantilla?.id === p.id}
                                                    onSelect={() => { setPlantilla(p); setEquipoId(''); setEquipoNombre(''); }}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}

                                {paso > 2 && plantilla && (
                                    <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <Layers size={14} className="text-green-500"/>
                                        Plantilla {plantilla.numero}
                                        <span className="text-xs text-gray-400 font-normal">
                                            {fmtFecha(plantilla.fechaInicio)} → {fmtFecha(plantilla.fechaFin)}
                                        </span>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* PASO 3: Equipo */}
                        {paso >= 3 && (
                            <div className={`bg-white rounded-xl border shadow-sm p-5 space-y-3 transition-all ${paso === 3 ? 'border-blue-300' : 'border-gray-200'}`}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${paso > 3 ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}>
                                        {paso > 3 ? <CheckCircle2 size={13}/> : '3'}
                                    </div>
                                    <h2 className="text-sm font-bold text-gray-700">Selecciona el Equipo</h2>
                                    {paso > 3 && (
                                        <button onClick={() => { setEquipoId(''); setEquipoNombre(''); }}
                                            className="ml-auto text-xs text-blue-500 hover:underline flex items-center gap-1">
                                            <Pencil size={11}/> Cambiar
                                        </button>
                                    )}
                                </div>

                                {paso === 3 && (
                                    <>
                                        {loadingEquipos && <p className="text-sm text-gray-400">Cargando equipos…</p>}
                                        {!loadingEquipos && equiposPlantilla.length === 0 && (
                                            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                                No hay equipos asignados a esta plantilla.
                                            </p>
                                        )}
                                        {!loadingEquipos && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {equiposPlantilla.map(eq => (
                                                    <button key={eq.id}
                                                        onClick={() => { setEquipoId(eq.id); setEquipoNombre(eq.nombre + (eq.numeroEconomico ? ` (${eq.numeroEconomico})` : '')); }}
                                                        className="text-left px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-sm font-semibold text-gray-700">
                                                        <Wrench size={14} className="inline mr-2 text-gray-400"/>
                                                        {eq.nombre}
                                                        {eq.numeroEconomico && <span className="ml-1 text-xs text-gray-400">({eq.numeroEconomico})</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {paso > 3 && (
                                    <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <Wrench size={14} className="text-green-500"/>
                                        {equipoNombre}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* PASO 4: Captura */}
                        {paso === 4 && plantilla && (
                            <CapturaGrid
                                obraId={obraId}
                                plantilla={plantilla}
                                equipoId={equipoId}
                                equipoNombre={equipoNombre}
                                plantillas={plantillas}
                                allPlantillas={plantillas}
                                equipoHodometro={equipos.find(e => e.id === equipoId)?.hodometroInicial}
                                onReset={resetWizard}
                            />
                        )}
                    </div>
                )}

                {/* ── HISTORIAL ─────────────────────────────────────────────── */}
                {vistaHistorial && (
                    <div className="space-y-4">
                        {/* Filtros */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Filter size={14} className="text-blue-500"/>
                                <span className="text-sm font-semibold text-gray-600">Filtros</span>
                                {hayFiltros && (
                                    <button onClick={clearFiltros} className="ml-auto text-xs text-red-400 hover:text-red-600 hover:underline flex items-center gap-1">
                                        <X size={12}/> Limpiar
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                <div className="relative col-span-2 sm:col-span-1">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                                    <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..."
                                        className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"/>
                                </div>
                                <select value={filtroEquipo} onChange={e => setFiltroEquipo(e.target.value)}
                                    className={`py-1.5 px-2 text-xs border rounded-lg bg-white focus:outline-none ${filtroEquipo !== 'todos' ? 'border-blue-400 text-blue-700 font-semibold' : 'border-gray-200'}`}>
                                    <option value="todos">Todos los equipos</option>
                                    {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
                                </select>
                                <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)}
                                    className={`py-1.5 px-2 text-xs border rounded-lg bg-white focus:outline-none ${filtroObra !== 'todas' ? 'border-blue-400 text-blue-700 font-semibold' : 'border-gray-200'}`}>
                                    <option value="todas">Todas las obras</option>
                                    {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                </select>
                                <select value={filtroSemana} onChange={e => { setFiltroSemana(e.target.value); setFiltroDesde(''); setFiltroHasta(''); }}
                                    className={`py-1.5 px-2 text-xs border rounded-lg bg-white focus:outline-none ${filtroSemana !== 'todas' ? 'border-blue-400 text-blue-700 font-semibold' : 'border-gray-200'}`}>
                                    <option value="todas">Todas las semanas</option>
                                    {semanas.map(s => { const [ano, sem] = s.split('-'); return <option key={s} value={s}>Sem. {parseInt(sem)} / {ano}</option>; })}
                                </select>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-400 flex-shrink-0">Desde</span>
                                    <input type="date" value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setFiltroSemana('todas'); }}
                                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white"/>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-400 flex-shrink-0">Hasta</span>
                                    <input type="date" value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setFiltroSemana('todas'); }}
                                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white"/>
                                </div>
                            </div>
                            {hayFiltros && <p className="text-xs text-blue-600">Mostrando <span className="font-bold">{filtrados.length}</span> de {registros.length} registros</p>}
                        </div>

                        {/* KPIs */}
                        {!loading && filtrados.length > 0 && (
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                                {[
                                    { label: 'Registros',      value: String(filtrados.length),                                               unit: '' },
                                    { label: 'Horas totales',  value: totalHoras.toFixed(1),                                                  unit: 'hrs' },
                                    { label: 'Metros totales', value: totalMetros.toFixed(1),                                                 unit: 'm' },
                                    { label: 'Diésel total',   value: totalLitros.toLocaleString('es-MX'),                                    unit: 'lt' },
                                    { label: 'Costo diésel',   value: `$${totalCosto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, unit: '' },
                                    { label: 'Lt/hr prom.',    value: promLtHr,                                                               unit: '' },
                                ].map(k => (
                                    <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                        <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                                        <p className="text-xl font-bold text-gray-800">{k.value} <span className="text-sm font-normal text-gray-400">{k.unit}</span></p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Tabla de historial */}
                        <Card>
                            {loading ? (
                                <div className="p-10 text-center text-gray-400 text-sm">Cargando registros...</div>
                            ) : filtrados.length === 0 ? (
                                <div className="p-10 text-center">
                                    <ClipboardList size={36} className="text-gray-300 mx-auto mb-3"/>
                                    <p className="text-sm font-semibold text-gray-600">
                                        {registros.length === 0 ? 'No hay registros diarios' : 'Sin registros para los filtros aplicados'}
                                    </p>
                                    {hayFiltros && <button onClick={clearFiltros} className="mt-3 text-xs text-blue-500 hover:underline">Limpiar filtros</button>}
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 transition-colors"
                                                        onClick={() => handleSort('fecha')}>
                                                        <span className="flex items-center gap-1">Fecha
                                                            {sortKey === 'fecha' ? (sortDir === 'asc' ? <ArrowUp size={11} className="text-blue-500"/> : <ArrowDown size={11} className="text-blue-500"/>)
                                                                : <ArrowUpDown size={11} className="opacity-30"/>}
                                                        </span>
                                                    </th>
                                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipo</th>
                                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Obra</th>
                                                    <SortTh label="Horas"     sortKey="horas"     current={sortKey} dir={sortDir} onSort={handleSort}/>
                                                    <SortTh label="Barrenos"  sortKey="barrenos"  current={sortKey} dir={sortDir} onSort={handleSort}/>
                                                    <SortTh label="Metros"    sortKey="metros"    current={sortKey} dir={sortDir} onSort={handleSort}/>
                                                    <SortTh label="Diésel"    sortKey="diesel"    current={sortKey} dir={sortDir} onSort={handleSort}/>
                                                    <SortTh label="Costo"     sortKey="costo"     current={sortKey} dir={sortDir} onSort={handleSort}/>
                                                    <th className="p-3 w-28"/>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {paginated.map(r => (
                                                    <RegistroRow key={r.id} r={r}
                                                        onDelete={setRegistroAEliminar}
                                                        onEdit={handleEdit}
                                                        onDuplicate={handleDuplicate}
                                                        isLastForEquipo={lastIdByEquipo.get(r.equipo.nombre) === r.id}/>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="p-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                                        <p className="text-xs text-gray-400">
                                            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
                                            {filtrados.length !== registros.length && ` (de ${registros.length} totales)`}
                                            {totalPages > 1 && ` · Página ${page} de ${totalPages}`}
                                        </p>
                                        {totalPages > 1 && (
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                                    <ChevronLeft size={14}/>
                                                </button>
                                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                    .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                                                    .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                                                        if (idx > 0 && (n as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                                                        acc.push(n); return acc;
                                                    }, [])
                                                    .map((n, i) => n === '...'
                                                        ? <span key={`e${i}`} className="px-1.5 text-xs text-gray-400">…</span>
                                                        : <button key={n} onClick={() => setPage(n as number)}
                                                            className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${page === n ? 'bg-blue-600 text-white shadow-sm' : 'border border-gray-200 hover:bg-gray-50'}`}>
                                                            {n}
                                                          </button>
                                                    )}
                                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                                    <ChevronRight size={14}/>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </Card>
                    </div>
                )}
            </div>
        </>
    );
}

export default function RegistrosDiariosPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>}>
            <RegistrosDiariosInner/>
        </Suspense>
    );
}
