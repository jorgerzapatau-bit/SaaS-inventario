"use client";

import {
    useEffect, useState, useMemo, useCallback, Suspense,
} from 'react';
import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ClipboardList, Plus, Trash2, Gauge,
    Droplets, ChevronDown, ChevronUp,
    Search, X, Filter, Drill, Pencil, Copy,
    ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
    AlertTriangle, CheckCircle2, Loader2, Lock,
    Building2, Layers, Wrench, TableProperties, SlidersHorizontal,
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
    plantilla: { id: string; numero: number } | null;
    plantillaId: string | null;
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
    tanqueInicio: number | null; litrosTanqueInicio: number | null;
    tanqueFin: number | null; litrosTanqueFin: number | null;
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
    bordo: number | null;
    espaciamiento: number | null;
    volumenRoca: number | null;
    porcentajePerdida: number | null;
    porcentajeAvance: number | null;
    notas: string | null;
    tanqueInicio: number | null;
    litrosTanqueInicio: number | null;
    tanqueFin: number | null;
    litrosTanqueFin: number | null;
};

// EditingRow expandida con TODOS los campos
type EditingRow = {
    id: string;
    // Principales
    barrenos: string; metrosLineales: string;
    horometroInicio: string; horometroFin: string;
    // Costos / perforación
    litrosDiesel: string; precioDiesel: string;
    rentaEquipoDiaria: string;
    operadores: string; peones: string;
    bordo: string; espaciamiento: string;
    profundidadPromedio: string;
    // Opcionales — tanque interno + notas
    tanqueInicio: string; litrosTanqueInicio: string;
    tanqueFin: string; litrosTanqueFin: string;
    notas: string;
    volumenRoca: string; porcentajePerdida: string; porcentajeAvance: string;
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

function editingRowFromRegistro(r: RegistroExistente): EditingRow {
    return {
        id: r.id,
        barrenos:            String(r.barrenos ?? ''),
        metrosLineales:      String(r.metrosLineales ?? ''),
        horometroInicio:     r.horometroInicio != null ? String(r.horometroInicio) : '',
        horometroFin:        String(r.horometroFin ?? ''),
        litrosDiesel:        r.litrosDiesel        != null ? String(r.litrosDiesel)        : '',
        precioDiesel:        r.precioDiesel        != null ? String(r.precioDiesel)        : '21.95',
        rentaEquipoDiaria:   r.rentaEquipoDiaria   != null ? String(r.rentaEquipoDiaria)   : '',
        operadores:          r.operadores          != null ? String(r.operadores)          : '1',
        peones:              r.peones              != null ? String(r.peones)              : '0',
        bordo:               r.bordo               != null ? String(r.bordo)               : '',
        espaciamiento:       r.espaciamiento       != null ? String(r.espaciamiento)       : '',
        profundidadPromedio: r.profundidadPromedio != null ? String(r.profundidadPromedio) : '',
        tanqueInicio:        r.tanqueInicio        != null ? String(r.tanqueInicio)        : '',
        litrosTanqueInicio:  r.litrosTanqueInicio  != null ? String(r.litrosTanqueInicio)  : '',
        tanqueFin:           r.tanqueFin           != null ? String(r.tanqueFin)           : '',
        litrosTanqueFin:     r.litrosTanqueFin     != null ? String(r.litrosTanqueFin)     : '',
        notas:               r.notas               ?? '',
        volumenRoca:         r.volumenRoca         != null ? String(r.volumenRoca)         : '',
        porcentajePerdida:   r.porcentajePerdida   != null ? String(r.porcentajePerdida)   : '',
        porcentajeAvance:    r.porcentajeAvance    != null ? String(r.porcentajeAvance)    : '',
    };
}

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
    plantilla, avance, selected, onSelect,
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
            <p className="text-xs text-gray-500">
                {fmtFecha(plantilla.fechaInicio)} → {fmtFecha(plantilla.fechaFin)}
            </p>
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
// Panel de captura de nueva fila — todos los campos (mismo formato que edición)
// ─────────────────────────────────────────────────────────────────────────────
function NuevaFilaPanel({
    row,
    horometroLocked,
    onToggleLock,
    onChange,
    onSave,
    onCancel,
    saving,
    error,
    isDupe,
}: {
    row: GridRow;
    horometroLocked: boolean;
    onToggleLock: () => void;
    onChange: (key: keyof GridRow, val: string) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
    error: string;
    isDupe: boolean;
}) {
    const inp = (
        key: keyof GridRow,
        label: string,
        placeholder = '—',
        type: 'text' | 'number' | 'date' = 'text',
    ) => (
        <div className="space-y-1">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
            <input
                type={type === 'number' ? 'text' : type}
                inputMode={type === 'number' ? 'decimal' : undefined}
                value={row[key] as string}
                onChange={e => onChange(key, e.target.value)}
                placeholder={placeholder}
                onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); onSave(); }
                    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                }}
                className="w-full h-9 px-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
            />
        </div>
    );

    const textarea = (key: keyof GridRow, label: string) => (
        <div className="space-y-1 col-span-full">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
            <textarea
                value={row[key] as string}
                onChange={e => onChange(key, e.target.value)}
                placeholder="Observaciones del día..."
                rows={2}
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white resize-none"
            />
        </div>
    );

    const hrs = row.horometroFin && row.horometroInicio
        ? Math.max(0, Number(row.horometroFin) - Number(row.horometroInicio))
        : null;

    return (
        <tr className="bg-green-50/40 border-b-2 border-green-200">
            <td colSpan={100} className="p-0">
                <div className="px-4 pt-3 pb-4 space-y-4">
                    {/* Encabezado */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 border border-green-200 rounded-lg">
                                <Plus size={12} className="text-green-600"/>
                                <span className="text-xs font-bold text-green-700">Nuevo registro</span>
                            </div>
                            {hrs !== null && hrs > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 font-semibold rounded-full">
                                    {hrs} hrs trabajadas
                                </span>
                            )}
                            {isDupe && (
                                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 font-semibold rounded-full flex items-center gap-1">
                                    <AlertTriangle size={10}/> Fecha ya registrada en esta plantilla
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {error && (
                                <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                    <AlertTriangle size={12}/> {error}
                                </span>
                            )}
                            <button onClick={onCancel}
                                className="px-3 py-1.5 border border-gray-200 bg-white text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                                Esc · Cancelar
                            </button>
                            <button onClick={onSave} disabled={saving || isDupe}
                                className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
                                {saving ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>}
                                {saving ? 'Guardando…' : 'Enter · Guardar'}
                            </button>
                        </div>
                    </div>

                    {/* SECCIÓN 1: Fecha + Horómetro + Producción */}
                    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <TableProperties size={10}/> Horómetro y Producción
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3">
                            {/* Fecha */}
                            <div className={`space-y-1 ${isDupe ? 'ring-2 ring-amber-400 rounded-lg' : ''}`}>
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Fecha *</label>
                                <input
                                    type="date"
                                    value={row.fecha}
                                    onChange={e => onChange('fecha', e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') { e.preventDefault(); onSave(); }
                                        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                                    }}
                                    className={`w-full h-9 px-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white ${isDupe ? 'border-amber-400 bg-amber-50' : 'border-gray-200 text-gray-800'}`}
                                />
                            </div>
                            {/* H. Inicial con lock */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                    H. Inicial <Lock size={9} className="text-gray-300"/>
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        type="text" inputMode="decimal"
                                        value={row.horometroInicio}
                                        readOnly={horometroLocked}
                                        onChange={e => onChange('horometroInicio', e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') { e.preventDefault(); onSave(); }
                                            if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                                        }}
                                        placeholder="—"
                                        className={`w-full h-9 pl-2.5 pr-7 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
                                            horometroLocked
                                                ? 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed'
                                                : 'border-blue-300 text-gray-800 focus:ring-blue-500/30'
                                        }`}
                                    />
                                    <button
                                        type="button"
                                        title={horometroLocked ? 'Editar horómetro inicial' : 'Bloquear'}
                                        onClick={onToggleLock}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-blue-600 transition-colors">
                                        {horometroLocked ? <Lock size={11}/> : <Pencil size={11}/>}
                                    </button>
                                </div>
                            </div>
                            {inp('horometroFin',        'H. Final *',   '—', 'number')}
                            {inp('barrenos',            'Barrenos',     '—', 'number')}
                            {inp('metrosLineales',      'Metros Lin.',  '—', 'number')}
                            {inp('profundidadPromedio', 'Prof. (m)',    '—', 'number')}
                            {inp('bordo',               'Bordo (m)',    '—', 'number')}
                            {inp('espaciamiento',       'Espac. (m)',   '—', 'number')}
                            {/* Vol Roca placeholder */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Vol. Roca (m³)</label>
                                <div className="w-full h-9 px-2.5 border border-dashed border-gray-200 rounded-lg text-sm text-gray-400 flex items-center bg-gray-50/60 select-none text-xs italic">
                                    Auto
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN 2: Costos / Perforación / Personal */}
                    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <Droplets size={10}/> Costos · Perforación · Personal
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                            {inp('litrosDiesel',      'Litros Diésel',  '—', 'number')}
                            {inp('precioDiesel',      'P.U. Diésel ($)', '21.95', 'number')}
                            {inp('rentaEquipoDiaria', 'Renta/Día ($)',   '—', 'number')}
                            {inp('operadores',        'Operadores',      '1', 'number')}
                            {inp('peones',            'Peones',          '1', 'number')}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">% Pérdida</label>
                                <div className="w-full h-9 px-2.5 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 flex items-center bg-gray-50/60 italic">—</div>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">% Avance</label>
                                <div className="w-full h-9 px-2.5 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 flex items-center bg-gray-50/60 italic">—</div>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN 3: Tanque interno + Notas */}
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <SlidersHorizontal size={10}/> Opcional — Tanque Interno · Notas
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {inp('tanqueInicio',       'CM Inicio',     '—', 'number')}
                            {inp('litrosTanqueInicio', 'Litros Inicio', '—', 'number')}
                            {inp('tanqueFin',          'CM Fin',        '—', 'number')}
                            {inp('litrosTanqueFin',    'Litros Fin',    '—', 'number')}
                            {textarea('notas', 'Notas')}
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel de edición inline expandible — todos los campos
// ─────────────────────────────────────────────────────────────────────────────
function InlineEditPanel({
    row,
    fechaLabel,
    onChange,
    onSave,
    onCancel,
    saving,
    error,
}: {
    row: EditingRow;
    fechaLabel: string;
    onChange: (key: keyof EditingRow, val: string) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
    error: string;
}) {
    const inp = (
        key: keyof EditingRow,
        label: string,
        placeholder = '—',
        className = '',
    ) => (
        <div className={`space-y-1 ${className}`}>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
            <input
                type="text"
                inputMode="decimal"
                value={row[key] as string}
                onChange={e => onChange(key, e.target.value)}
                placeholder={placeholder}
                onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); onSave(); }
                    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                }}
                className="w-full h-9 px-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
            />
        </div>
    );

    const textarea = (key: keyof EditingRow, label: string) => (
        <div className="space-y-1 col-span-full">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
            <textarea
                value={row[key] as string}
                onChange={e => onChange(key, e.target.value)}
                placeholder="Observaciones del día..."
                rows={2}
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white resize-none"
            />
        </div>
    );

    const hrs = row.horometroFin && row.horometroInicio
        ? Math.max(0, Number(row.horometroFin) - Number(row.horometroInicio))
        : null;

    return (
        <tr className="bg-amber-50/60 border-b-2 border-amber-200">
            <td colSpan={100} className="p-0">
                <div className="px-4 pt-3 pb-4 space-y-4">
                    {/* Encabezado del panel */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-200 rounded-lg">
                                <Pencil size={12} className="text-amber-600"/>
                                <span className="text-xs font-bold text-amber-700">Editando: {fechaLabel}</span>
                            </div>
                            {hrs !== null && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 font-semibold rounded-full">
                                    {hrs} hrs trabajadas
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {error && (
                                <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                    <AlertTriangle size={12}/> {error}
                                </span>
                            )}
                            <button onClick={onCancel}
                                className="px-3 py-1.5 border border-gray-200 bg-white text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                                Esc · Cancelar
                            </button>
                            <button onClick={onSave} disabled={saving}
                                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
                                {saving ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>}
                                {saving ? 'Guardando…' : 'Enter · Guardar'}
                            </button>
                        </div>
                    </div>

                    {/* SECCIÓN 1: Campos principales */}
                    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <TableProperties size={10}/> Horómetro y Producción
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">H. Inicial <Lock size={9} className="inline text-gray-300"/></label>
                                <input
                                    type="text" inputMode="decimal"
                                    value={row.horometroInicio}
                                    onChange={e => onChange('horometroInicio', e.target.value)}
                                    className="w-full h-9 px-2.5 border border-gray-100 rounded-lg text-sm text-gray-500 bg-gray-50 focus:outline-none focus:border-blue-300"
                                />
                            </div>
                            {inp('horometroFin',   'H. Final *')}
                            {inp('barrenos',       'Barrenos')}
                            {inp('metrosLineales', 'Metros Lin.')}
                            {inp('profundidadPromedio', 'Prof. (m)')}
                            {inp('bordo',         'Bordo (m)')}
                            {inp('espaciamiento', 'Espac. (m)')}
                            {inp('volumenRoca',   'Vol. Roca (m³)')}
                        </div>
                    </div>

                    {/* SECCIÓN 2: Costos / Perforación / Personal */}
                    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <Droplets size={10}/> Costos · Perforación · Personal
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                            {inp('litrosDiesel',      'Litros Diésel')}
                            {inp('precioDiesel',      'P.U. Diésel ($)')}
                            {inp('rentaEquipoDiaria', 'Renta/Día ($)')}
                            {inp('operadores',        'Operadores')}
                            {inp('peones',            'Peones')}
                            {inp('porcentajePerdida', '% Pérdida')}
                            {inp('porcentajeAvance',  '% Avance')}
                        </div>
                    </div>

                    {/* SECCIÓN 3: Tanque interno + Notas (opcionales) */}
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <SlidersHorizontal size={10}/> Opcional — Tanque Interno · Notas
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {inp('tanqueInicio',       'CM Inicio')}
                            {inp('litrosTanqueInicio', 'Litros Inicio')}
                            {inp('tanqueFin',          'CM Fin')}
                            {inp('litrosTanqueFin',    'Litros Fin')}
                            {textarea('notas', 'Notas')}
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fila de historial global — con jerarquía visual + edición inline
// ─────────────────────────────────────────────────────────────────────────────
function RegistroRow({
    r, onDelete, onDuplicate, isLastForEquipo,
    editingId, onStartEdit, onCancelEdit, onSaveEdit,
    editingRow, onChangeEdit, savingEdit, editError,
}: {
    r: Registro;
    onDelete: (r: Registro) => void;
    onDuplicate: (r: Registro) => void;
    isLastForEquipo: boolean;
    editingId: string | null;
    onStartEdit: (id: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: () => void;
    editingRow: EditingRow | null;
    onChangeEdit: (key: keyof EditingRow, val: string) => void;
    savingEdit: boolean;
    editError: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const isEditing = editingId === r.id;
    const [yr, mo, dy] = r.fecha.slice(0, 10).split('-').map(Number);
    const fecha = new Date(yr, mo - 1, dy).toLocaleDateString('es-MX', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
    const fechaLabel = `${String(dy).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${yr}`;

    return (
        <>
            <tr
                className={`hover:bg-slate-50/80 transition-colors group cursor-pointer border-b border-gray-100 ${isEditing ? 'bg-amber-50/40' : ''}`}
                onClick={() => !isEditing && setExpanded(v => !v)}
            >
                <td className="pl-4 pr-2 py-3 w-36">
                    <p className="text-sm font-semibold text-gray-800">{fecha.split(', ')[1] ?? fecha}</p>
                    <p className="text-xs text-gray-400 capitalize">{fecha.split(', ')[0]}</p>
                    {r.semanaNum && <p className="text-[10px] text-gray-300 mt-0.5">Sem. {r.semanaNum}/{r.anoNum}</p>}
                </td>
                <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Wrench size={11} className="text-blue-600"/>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-800 leading-tight">{r.equipo.nombre}</p>
                            {r.equipo.numeroEconomico && (
                                <p className="text-[10px] text-gray-400">{r.equipo.numeroEconomico}</p>
                            )}
                        </div>
                    </div>
                </td>
                <td className="px-2 py-3 w-20 text-center">
                    {r.plantilla ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                            <Layers size={9}/> P{r.plantilla.numero}
                        </span>
                    ) : (
                        <span className="text-gray-300 text-xs">—</span>
                    )}
                </td>
                <td className="px-2 py-3 w-24 text-center">
                    {r.corte ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            r.corte.status === 'COBRADO'   ? 'bg-green-100 text-green-700' :
                            r.corte.status === 'FACTURADO' ? 'bg-blue-100 text-blue-700'   :
                            'bg-gray-100 text-gray-500'
                        }`}>#{r.corte.numero}</span>
                    ) : (
                        <span className="text-gray-200 text-xs">—</span>
                    )}
                </td>
                <td className="px-2 py-3 text-center">
                    <p className="text-xs font-mono text-gray-600">
                        {r.horometroInicio.toLocaleString('es-MX')}
                        <span className="text-gray-300 mx-0.5">→</span>
                        {r.horometroFin.toLocaleString('es-MX')}
                    </p>
                    <p className="text-[10px] text-gray-400">{r.horasTrabajadas} hrs</p>
                </td>
                <td className="px-2 py-3 text-right">
                    <p className="text-sm font-bold text-gray-800">{r.barrenos}</p>
                    <p className="text-[10px] text-gray-400">bar.</p>
                </td>
                <td className="px-2 py-3 text-right">
                    <p className="text-sm font-bold text-gray-800">{Number(r.metrosLineales).toFixed(1)}</p>
                    <p className="text-[10px] text-gray-400">m</p>
                </td>
                <td className="px-2 py-3 text-right">
                    <p className="text-sm font-semibold text-blue-600">{r.litrosDiesel}</p>
                    <p className="text-[10px] text-gray-400">lt</p>
                </td>
                <td className="px-2 py-3 text-right">
                    <p className="text-sm font-semibold text-gray-700">${r.costoDiesel.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-gray-400">diésel</p>
                </td>
                <td className="px-2 py-3 text-right">
                    {r.rentaEquipoDiaria != null ? (
                        <>
                            <p className="text-sm font-semibold text-emerald-700">${Number(r.rentaEquipoDiaria).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p className="text-[10px] text-gray-400">renta</p>
                        </>
                    ) : <span className="text-gray-200 text-xs">—</span>}
                </td>
                <td className="pr-3 py-3 text-right">
                    <div className="flex justify-end items-center gap-0.5">
                        {isLastForEquipo ? (
                            <button onClick={e => { e.stopPropagation(); onDuplicate(r); }}
                                title="Duplicar como nuevo registro"
                                className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                                <Copy size={13}/>
                            </button>
                        ) : <span className="p-1.5 w-[28px]"/>}
                        <button onClick={e => { e.stopPropagation(); isEditing ? onCancelEdit() : onStartEdit(r.id); }}
                            className={`p-1.5 rounded-md transition-colors ${isEditing ? 'text-amber-600 bg-amber-100' : 'text-gray-300 hover:text-amber-600 hover:bg-amber-50 opacity-0 group-hover:opacity-100'}`}>
                            <Pencil size={13}/>
                        </button>
                        <button onClick={e => { e.stopPropagation(); onDelete(r); }}
                            className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={13}/>
                        </button>
                        {!isEditing && (expanded
                            ? <ChevronUp size={13} className="text-gray-400 ml-1"/>
                            : <ChevronDown size={13} className="text-gray-400 ml-1"/>)}
                    </div>
                </td>
            </tr>

            {/* Panel de edición inline expandible */}
            {isEditing && editingRow && (
                <InlineEditPanel
                    row={editingRow}
                    fechaLabel={fechaLabel}
                    onChange={onChangeEdit}
                    onSave={onSaveEdit}
                    onCancel={onCancelEdit}
                    saving={savingEdit}
                    error={editError}
                />
            )}

            {/* Detalle expandido (cuando no está editando) */}
            {expanded && !isEditing && (
                <tr className="bg-slate-50/60">
                    <td colSpan={11} className="px-6 py-4 space-y-3 border-b border-gray-100">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Horómetro</p>
                                <p className="text-sm font-bold text-gray-700 font-mono">
                                    {r.horometroInicio.toLocaleString('es-MX')} → {r.horometroFin.toLocaleString('es-MX')}
                                </p>
                                <p className="text-xs text-gray-400">{r.horasTrabajadas} hrs efectivas</p>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Personal</p>
                                <p className="text-sm font-bold text-gray-700">{r.operadores} op. / {r.peones} peón{r.peones !== 1 ? 'es' : ''}</p>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1"><Gauge size={10}/> KPIs</p>
                                <div className="grid grid-cols-3 gap-1 text-center">
                                    <div><p className="text-[10px] text-gray-400">Lt/hr</p><p className="text-xs font-bold text-gray-700">{r.kpi.litrosPorHora ?? '—'}</p></div>
                                    <div><p className="text-[10px] text-gray-400">Lt/m</p><p className="text-xs font-bold text-gray-700">{r.kpi.litrosPorMetro ?? '—'}</p></div>
                                    <div><p className="text-[10px] text-gray-400">m/hr</p><p className="text-xs font-bold text-gray-700">{r.kpi.metrosPorHora ?? '—'}</p></div>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1"><Droplets size={10}/> Diésel</p>
                                <p className="text-xs text-gray-600">{r.litrosDiesel} lt × ${r.precioDiesel}/lt</p>
                                <p className="text-sm font-bold text-gray-700">= ${r.costoDiesel.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>
                        {r.notas && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 flex gap-2 items-start">
                                <span className="font-semibold flex-shrink-0">📝 Notas:</span>
                                <span>{r.notas}</span>
                            </div>
                        )}
                        {(r.bordo != null || r.espaciamiento != null || r.profundidadPromedio != null || r.volumenRoca != null || r.porcentajePerdida != null || r.porcentajeAvance != null || r.rentaEquipoDiaria != null) && (
                            <div className="bg-indigo-50/80 border border-indigo-100 rounded-lg px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 mb-2 flex items-center gap-1"><Drill size={10}/> Datos de perforación</p>
                                <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 text-xs">
                                    {r.bordo != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">Bordo</p><p className="font-bold text-indigo-700">{r.bordo} m</p></div>}
                                    {r.espaciamiento != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">Espa.</p><p className="font-bold text-indigo-700">{r.espaciamiento} m</p></div>}
                                    {r.profundidadPromedio != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">Prof.</p><p className="font-bold text-indigo-700">{r.profundidadPromedio} m</p></div>}
                                    {r.volumenRoca != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">Vol. roca</p><p className="font-bold text-indigo-700">{Number(r.volumenRoca).toFixed(2)} m³</p></div>}
                                    {r.porcentajePerdida != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">% Pérdida</p><p className="font-bold text-indigo-700">{r.porcentajePerdida}%</p></div>}
                                    {r.porcentajeAvance != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">% Avance</p><p className="font-bold text-indigo-700">{r.porcentajeAvance}%</p></div>}
                                    {r.rentaEquipoDiaria != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">Renta/día</p><p className="font-bold text-indigo-700">${Number(r.rentaEquipoDiaria).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>}
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
    // Campos opcionales (expandibles)
    bordo: string; espaciamiento: string;
    tanqueInicio: string; litrosTanqueInicio: string;
    tanqueFin: string; litrosTanqueFin: string;
    notas: string;
    _status: 'idle' | 'saving' | 'saved' | 'error';
    _error: string;
    _suggested: Record<string, boolean>;
    _expanded: boolean;
};

function emptyRow(): GridRow {
    return {
        fecha:'', horometroInicio:'', horometroFin:'', barrenos:'', metrosLineales:'',
        profundidadPromedio:'', litrosDiesel:'', precioDiesel:'21.95',
        rentaEquipoDiaria:'', operadores:'1', peones:'1',
        bordo:'', espaciamiento:'',
        tanqueInicio:'', litrosTanqueInicio:'', tanqueFin:'', litrosTanqueFin:'',
        notas:'',
        _status:'idle', _error:'', _suggested:{}, _expanded: false,
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
    const [expandedId,   setExpandedId]   = useState<string | null>(null);
    const [showSuccess,  setShowSuccess]  = useState(false);
    const [horometroLocked, setHorometroLocked] = useState(true);

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
                    bordo: r.bordo ?? null,
                    espaciamiento: r.espaciamiento ?? null,
                    volumenRoca: r.volumenRoca ?? null,
                    porcentajePerdida: r.porcentajePerdida ?? null,
                    porcentajeAvance: r.porcentajeAvance ?? null,
                    notas: r.notas ?? null,
                    tanqueInicio: r.tanqueInicio ?? null,
                    litrosTanqueInicio: r.litrosTanqueInicio ?? null,
                    tanqueFin: r.tanqueFin ?? null,
                    litrosTanqueFin: r.litrosTanqueFin ?? null,
                })));
            })
            .catch(() => {})
            .finally(() => { if (alive) setLoadingCtx(false); });
        return () => { alive = false; };
    }, [obraId, equipoId, plantilla.id]);

    const registrosOrdenados = useMemo(
        () => [...registrosExistentes].sort((a, b) => a.fecha.localeCompare(b.fecha)),
        [registrosExistentes]
    );

    const avancePlantilla = useMemo(() => {
        const regsPlantilla = registrosOrdenados.filter(r => plantillaDeRegistro(r.fecha, allPlantillas)?.id === plantilla.id);
        return {
            metros:   regsPlantilla.reduce((s, r) => s + r.metrosLineales, 0),
            barrenos: regsPlantilla.reduce((s, r) => s + r.barrenos,       0),
        };
    }, [registrosOrdenados, plantilla, allPlantillas]);

    const fechasExistentes = useMemo(() => new Set(registrosExistentes.map(r => r.fecha.slice(0, 10))), [registrosExistentes]);

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
        const hIni = ultimo
            ? String(ultimo.horometroFin)
            : equipoHodometro != null ? String(equipoHodometro) : '';
        setNuevaFila({ ...emptyRow(), horometroInicio: hIni });
    };

    const cancelNewRow = () => { setNuevaFila(null); setRowError(''); setHorometroLocked(true); };

    const updateNuevaFila = (key: keyof GridRow, val: string | boolean) => {
        setNuevaFila(prev => prev ? { ...prev, [key]: val, _status: 'idle', _error: '', _suggested: { ...prev._suggested, [key]: false } } : null);
        setRowError('');
    };

    const saveRowAndReset = async () => {
        if (!nuevaFila) return;
        setRowError('');
        const errMsg = validateGridRow(nuevaFila);
        if (errMsg) { setRowError(errMsg); return; }
        if (fechasExistentes.has(nuevaFila.fecha)) { setRowError('⚠ Fecha ya registrada en esta plantilla'); return; }
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
                    bordo:           nuevaFila.bordo           ? Number(nuevaFila.bordo)           : null,
                    espaciamiento:   nuevaFila.espaciamiento   ? Number(nuevaFila.espaciamiento)   : null,
                    tanqueInicio:        nuevaFila.tanqueInicio        ? Number(nuevaFila.tanqueInicio)        : null,
                    litrosTanqueInicio:  nuevaFila.litrosTanqueInicio  ? Number(nuevaFila.litrosTanqueInicio)  : null,
                    tanqueFin:           nuevaFila.tanqueFin           ? Number(nuevaFila.tanqueFin)           : null,
                    litrosTanqueFin:     nuevaFila.litrosTanqueFin     ? Number(nuevaFila.litrosTanqueFin)     : null,
                    notas:               nuevaFila.notas || null,
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
                bordo:               nuevaFila.bordo               ? Number(nuevaFila.bordo)               : null,
                espaciamiento:       nuevaFila.espaciamiento       ? Number(nuevaFila.espaciamiento)       : null,
                volumenRoca: null, porcentajePerdida: null, porcentajeAvance: null,
                notas: nuevaFila.notas || null,
                tanqueInicio:        nuevaFila.tanqueInicio        ? Number(nuevaFila.tanqueInicio)        : null,
                litrosTanqueInicio:  nuevaFila.litrosTanqueInicio  ? Number(nuevaFila.litrosTanqueInicio)  : null,
                tanqueFin:           nuevaFila.tanqueFin           ? Number(nuevaFila.tanqueFin)           : null,
                litrosTanqueFin:     nuevaFila.litrosTanqueFin     ? Number(nuevaFila.litrosTanqueFin)     : null,
            };
            setRegistrosExistentes(prev => [...prev, nuevoRegistro]);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            setNuevaFila(null);
            setRowError('');
        } catch (err: any) {
            const msg = err.message || 'Error';
            setRowError(msg.toLowerCase().includes('ya existe') || msg.includes('P2002') ? '⚠ Este equipo ya tiene un registro en esa fecha' : msg);
        } finally { setSavingRow(false); }
    };

    const startEditingRow = (r: RegistroExistente) => {
        setEditingRow(editingRowFromRegistro(r));
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
                    bordo:               editingRow.bordo               ? Number(editingRow.bordo)               : null,
                    espaciamiento:       editingRow.espaciamiento        ? Number(editingRow.espaciamiento)       : null,
                    volumenRoca:         editingRow.volumenRoca          ? Number(editingRow.volumenRoca)         : null,
                    porcentajePerdida:   editingRow.porcentajePerdida    ? Number(editingRow.porcentajePerdida)   : null,
                    porcentajeAvance:    editingRow.porcentajeAvance     ? Number(editingRow.porcentajeAvance)    : null,
                    tanqueInicio:        editingRow.tanqueInicio         ? Number(editingRow.tanqueInicio)        : null,
                    litrosTanqueInicio:  editingRow.litrosTanqueInicio   ? Number(editingRow.litrosTanqueInicio)  : null,
                    tanqueFin:           editingRow.tanqueFin            ? Number(editingRow.tanqueFin)           : null,
                    litrosTanqueFin:     editingRow.litrosTanqueFin      ? Number(editingRow.litrosTanqueFin)     : null,
                    notas:               editingRow.notas || null,
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
                bordo:               editingRow.bordo               ? Number(editingRow.bordo)               : r.bordo,
                espaciamiento:       editingRow.espaciamiento       ? Number(editingRow.espaciamiento)       : r.espaciamiento,
                volumenRoca:         editingRow.volumenRoca         ? Number(editingRow.volumenRoca)         : r.volumenRoca,
                porcentajePerdida:   editingRow.porcentajePerdida   ? Number(editingRow.porcentajePerdida)   : r.porcentajePerdida,
                porcentajeAvance:    editingRow.porcentajeAvance    ? Number(editingRow.porcentajeAvance)    : r.porcentajeAvance,
                tanqueInicio:        editingRow.tanqueInicio        ? Number(editingRow.tanqueInicio)        : r.tanqueInicio,
                litrosTanqueInicio:  editingRow.litrosTanqueInicio  ? Number(editingRow.litrosTanqueInicio)  : r.litrosTanqueInicio,
                tanqueFin:           editingRow.tanqueFin           ? Number(editingRow.tanqueFin)           : r.tanqueFin,
                litrosTanqueFin:     editingRow.litrosTanqueFin     ? Number(editingRow.litrosTanqueFin)     : r.litrosTanqueFin,
                notas:               editingRow.notas || r.notas,
            }));
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            setEditingRow(null);
        } catch (e: any) { setInlineError(e.message || 'Error al guardar'); }
        finally { setSavingInline(false); }
    };

    const isDupe       = nuevaFila ? (!!nuevaFila.fecha && fechasExistentes.has(nuevaFila.fecha)) : false;
    const colSpanTotal = 14; // # + 11 columnas de datos + Hrs + Acción

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Banner resumen */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
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
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm" style={{ minWidth: 980 }}>
                                <tbody>
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
                                        const isEditing  = editingRow?.id === r.id;
                                        const isExpanded = expandedId === r.id;
                                        const hrsReg = r.horometroInicio != null ? r.horometroFin - r.horometroInicio : null;
                                        const litrosPorHora  = hrsReg && hrsReg > 0 && r.litrosDiesel  ? +(r.litrosDiesel  / hrsReg).toFixed(2) : null;
                                        const litrosPorMetro = r.metrosLineales > 0 && r.litrosDiesel  ? +(r.litrosDiesel  / r.metrosLineales).toFixed(2) : null;
                                        const metrosPorHora  = hrsReg && hrsReg > 0 && r.metrosLineales ? +(r.metrosLineales / hrsReg).toFixed(2) : null;

                                        return (
                                            <React.Fragment key={r.id}>
                                                {/* Fila compacta — mismo look que historial */}
                                                <tr
                                                    className={`border-b border-gray-100 transition-colors group cursor-pointer ${isEditing ? 'bg-amber-50/40' : 'bg-blue-50/20 hover:bg-blue-100/30'}`}
                                                    onClick={() => { if (!isEditing) setExpandedId(v => v === r.id ? null : r.id); }}
                                                >
                                                    <td className="p-2 text-xs text-blue-300 text-center border-r w-8">{i + 1}</td>
                                                    <td className="border-r border-blue-100 px-2 h-9 text-xs font-medium text-blue-700 whitespace-nowrap">{fechaStr}</td>
                                                    <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600 font-mono">
                                                        {r.horometroInicio ?? '—'} → {r.horometroFin}
                                                        {hrsReg !== null && <span className="ml-1 text-gray-400">{hrsReg}h</span>}
                                                    </td>
                                                    <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-700 font-semibold text-right">{r.barrenos || '—'}</td>
                                                    <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-700 font-semibold text-right">{r.metrosLineales?.toFixed(1) || '—'}</td>
                                                    <td className="border-r border-blue-100 px-2 h-9 text-xs text-blue-600 font-semibold text-right">{r.litrosDiesel ?? '—'}</td>
                                                    <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600 text-right">
                                                        {r.litrosDiesel != null && r.precioDiesel != null
                                                            ? `$${(r.litrosDiesel * r.precioDiesel).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
                                                            : '—'}
                                                    </td>
                                                    <td className="border-r border-blue-100 px-2 h-9 text-xs text-right">
                                                        {r.rentaEquipoDiaria != null
                                                            ? <span className="font-semibold text-emerald-600">${Number(r.rentaEquipoDiaria).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
                                                            : <span className="text-gray-300">—</span>}
                                                    </td>
                                                    <td className="px-2 text-center w-16" onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => { isEditing ? setEditingRow(null) : startEditingRow(r); setExpandedId(null); }}
                                                                className={`p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 ${isEditing ? 'opacity-100 text-amber-600 bg-amber-100' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}>
                                                                {isEditing ? <X size={13}/> : <Pencil size={13}/>}
                                                            </button>
                                                            <button
                                                                onClick={() => { if (!isEditing) setExpandedId(v => v === r.id ? null : r.id); }}
                                                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                                                                {isExpanded && !isEditing
                                                                    ? <ChevronUp size={14}/>
                                                                    : <ChevronDown size={14}/>}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Panel de edición inline */}
                                                {isEditing && editingRow && (
                                                    <InlineEditPanel
                                                        row={editingRow}
                                                        fechaLabel={fechaStr}
                                                        onChange={(key, val) => setEditingRow(prev => prev ? { ...prev, [key]: val } : prev)}
                                                        onSave={saveInlineEdit}
                                                        onCancel={() => { setEditingRow(null); setInlineError(''); }}
                                                        saving={savingInline}
                                                        error={inlineError}
                                                    />
                                                )}

                                                {/* Panel de detalle expandido — igual al historial */}
                                                {isExpanded && !isEditing && (
                                                    <tr className="bg-slate-50/60">
                                                        <td colSpan={9} className="px-4 py-3 space-y-3 border-b border-gray-100">
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                                                <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Horómetro</p>
                                                                    <p className="text-sm font-bold text-gray-700 font-mono">
                                                                        {r.horometroInicio?.toLocaleString('es-MX')} → {r.horometroFin.toLocaleString('es-MX')}
                                                                    </p>
                                                                    <p className="text-xs text-gray-400">{hrsReg} hrs efectivas</p>
                                                                </div>
                                                                <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Personal</p>
                                                                    <p className="text-sm font-bold text-gray-700">{r.operadores} op. / {r.peones} peón{r.peones !== 1 ? 'es' : ''}</p>
                                                                </div>
                                                                <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-1">
                                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1"><Gauge size={10}/> KPIs</p>
                                                                    <div className="grid grid-cols-3 gap-1 text-center">
                                                                        <div><p className="text-[10px] text-gray-400">Lt/hr</p><p className="text-xs font-bold text-gray-700">{litrosPorHora ?? '—'}</p></div>
                                                                        <div><p className="text-[10px] text-gray-400">Lt/m</p><p className="text-xs font-bold text-gray-700">{litrosPorMetro ?? '—'}</p></div>
                                                                        <div><p className="text-[10px] text-gray-400">m/hr</p><p className="text-xs font-bold text-gray-700">{metrosPorHora ?? '—'}</p></div>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-0.5">
                                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1"><Droplets size={10}/> Diésel</p>
                                                                    <p className="text-xs text-gray-600">{r.litrosDiesel} lt × ${r.precioDiesel}/lt</p>
                                                                    <p className="text-sm font-bold text-gray-700">= ${r.litrosDiesel != null && r.precioDiesel != null ? (r.litrosDiesel * r.precioDiesel).toLocaleString('es-MX', { maximumFractionDigits: 0 }) : '0'}</p>
                                                                </div>
                                                            </div>
                                                            {r.notas && (
                                                                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 flex gap-2 items-start">
                                                                    <span className="font-semibold flex-shrink-0">📝 Notas:</span>
                                                                    <span>{r.notas}</span>
                                                                </div>
                                                            )}
                                                            {(r.bordo != null || r.espaciamiento != null || r.profundidadPromedio != null || r.volumenRoca != null || r.rentaEquipoDiaria != null) && (
                                                                <div className="bg-indigo-50/80 border border-indigo-100 rounded-lg px-4 py-3">
                                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 mb-2 flex items-center gap-1"><Drill size={10}/> Datos de perforación</p>
                                                                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 text-xs">
                                                                        {r.bordo != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">Bordo</p><p className="font-bold text-indigo-700">{r.bordo} m</p></div>}
                                                                        {r.espaciamiento != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">Espa.</p><p className="font-bold text-indigo-700">{r.espaciamiento} m</p></div>}
                                                                        {r.profundidadPromedio != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">Prof.</p><p className="font-bold text-indigo-700">{r.profundidadPromedio} m</p></div>}
                                                                        {r.volumenRoca != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">Vol. roca</p><p className="font-bold text-indigo-700">{Number(r.volumenRoca).toFixed(2)} m³</p></div>}
                                                                        {r.rentaEquipoDiaria != null && <div className="bg-white/60 rounded p-1.5"><p className="text-indigo-400 mb-0.5">Renta/día</p><p className="font-bold text-indigo-700">${Number(r.rentaEquipoDiaria).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p></div>}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}

                                    {/* Nueva fila — panel expandido igual que edición */}
                                    {nuevaFila && (
                                        <NuevaFilaPanel
                                            row={nuevaFila}
                                            horometroLocked={horometroLocked}
                                            onToggleLock={() => setHorometroLocked(l => !l)}
                                            onChange={(key, val) => updateNuevaFila(key, val)}
                                            onSave={saveRowAndReset}
                                            onCancel={cancelNewRow}
                                            saving={savingRow}
                                            error={rowError}
                                            isDupe={isDupe}
                                        />
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

    const [registros, setRegistros] = useState<Registro[]>([]);
    const [equipos,   setEquipos]   = useState<Equipo[]>([]);
    const [obras,     setObras]     = useState<ObraConEquipos[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState('');

    const [obraId,        setObraId]        = useState('');
    const [plantilla,     setPlantilla]     = useState<Plantilla | null>(null);
    const [equipoId,      setEquipoId]      = useState('');
    const [equipoNombre,  setEquipoNombre]  = useState('');

    const [equiposPlantilla, setEquiposPlantilla] = useState<Equipo[]>([]);
    const [loadingEquipos,   setLoadingEquipos]   = useState(false);

    const [vistaHistorial, setVistaHistorial] = useState(false);

    // Estado de edición inline para el historial
    const [histEditingId,   setHistEditingId]   = useState<string | null>(null);
    const [histEditingRow,  setHistEditingRow]  = useState<EditingRow | null>(null);
    const [histSaving,      setHistSaving]      = useState(false);
    const [histEditError,   setHistEditError]   = useState('');

    // Filtros historial
    const [filtroEquipo, setFiltroEquipo] = useState('todos');
    const [filtroObra,   setFiltroObra]   = useState('todas');
    const [filtroDesde,  setFiltroDesde]  = useState('');
    const [filtroHasta,  setFiltroHasta]  = useState('');
    const [filtroSemana, setFiltroSemana] = useState('todas');
    const [busqueda,     setBusqueda]     = useState('');
    const [sortKey,      setSortKey]      = useState<SortKey>('fecha');
    const [sortDir,      setSortDir]      = useState<SortDir>('asc');
    const [page,         setPage]         = useState(1);
    const [registroAEliminar, setRegistroAEliminar] = useState<Registro | null>(null);

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
            bordo: r.bordo,
            espaciamiento: r.espaciamiento,
            volumenRoca: r.volumenRoca,
            porcentajePerdida: r.porcentajePerdida,
            porcentajeAvance: r.porcentajeAvance,
            notas: r.notas,
            tanqueInicio: r.tanqueInicio,
            litrosTanqueInicio: r.litrosTanqueInicio,
            tanqueFin: r.tanqueFin,
            litrosTanqueFin: r.litrosTanqueFin,
        }));
        return calcularAvancePorPlantilla(regsExistentes, plantillas);
    }, [registros, obraId, plantillas]);

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
                const equiposObra = obraSeleccionada?.obraEquipos?.length
                    ? equipos.filter(eq => obraSeleccionada.obraEquipos!.some(oe => oe.equipoId === eq.id))
                    : equipos;
                setEquiposPlantilla(equiposObra);
            })
            .finally(() => setLoadingEquipos(false));
    }, [obraId, plantilla, obraSeleccionada, equipos]);

    const paso: 1|2|3|4 = !obraId ? 1 : !plantilla ? 2 : !equipoId ? 3 : 4;

    const resetWizard = () => {
        setObraId(''); setPlantilla(null); setEquipoId(''); setEquipoNombre('');
        setEquiposPlantilla([]);
    };

    const handleDeleteConfirm = async () => {
        if (!registroAEliminar) return;
        try {
            await fetchApi(`/registros-diarios/${registroAEliminar.id}`, { method: 'DELETE' });
            setRegistros(r => r.filter(x => x.id !== registroAEliminar.id));
        } catch (e: any) { alert(e.message || 'Error al eliminar'); }
        finally { setRegistroAEliminar(null); }
    };

    // Edición inline en historial
    const handleStartHistEdit = (id: string) => {
        const r = registros.find(x => x.id === id);
        if (!r) return;
        const re: RegistroExistente = {
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
            bordo: r.bordo,
            espaciamiento: r.espaciamiento,
            volumenRoca: r.volumenRoca,
            porcentajePerdida: r.porcentajePerdida,
            porcentajeAvance: r.porcentajeAvance,
            notas: r.notas,
            tanqueInicio: r.tanqueInicio,
            litrosTanqueInicio: r.litrosTanqueInicio,
            tanqueFin: r.tanqueFin,
            litrosTanqueFin: r.litrosTanqueFin,
        };
        setHistEditingRow(editingRowFromRegistro(re));
        setHistEditingId(id);
        setHistEditError('');
    };

    const handleCancelHistEdit = () => {
        setHistEditingId(null);
        setHistEditingRow(null);
        setHistEditError('');
    };

    const handleSaveHistEdit = async () => {
        if (!histEditingRow) return;
        setHistSaving(true);
        setHistEditError('');
        try {
            await fetchApi(`/registros-diarios/${histEditingRow.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    barrenos:            histEditingRow.barrenos            ? Number(histEditingRow.barrenos)            : 0,
                    metrosLineales:      histEditingRow.metrosLineales       ? Number(histEditingRow.metrosLineales)      : 0,
                    profundidadPromedio: histEditingRow.profundidadPromedio  ? Number(histEditingRow.profundidadPromedio) : null,
                    litrosDiesel:        histEditingRow.litrosDiesel         ? Number(histEditingRow.litrosDiesel)        : 0,
                    precioDiesel:        histEditingRow.precioDiesel         ? Number(histEditingRow.precioDiesel)        : 0,
                    rentaEquipoDiaria:   histEditingRow.rentaEquipoDiaria    ? Number(histEditingRow.rentaEquipoDiaria)   : null,
                    operadores:          histEditingRow.operadores           ? Number(histEditingRow.operadores)          : 1,
                    peones:              histEditingRow.peones               ? Number(histEditingRow.peones)              : 0,
                    horometroInicio:     Number(histEditingRow.horometroInicio),
                    horometroFin:        Number(histEditingRow.horometroFin),
                    bordo:               histEditingRow.bordo               ? Number(histEditingRow.bordo)               : null,
                    espaciamiento:       histEditingRow.espaciamiento        ? Number(histEditingRow.espaciamiento)       : null,
                    volumenRoca:         histEditingRow.volumenRoca          ? Number(histEditingRow.volumenRoca)         : null,
                    porcentajePerdida:   histEditingRow.porcentajePerdida    ? Number(histEditingRow.porcentajePerdida)   : null,
                    porcentajeAvance:    histEditingRow.porcentajeAvance     ? Number(histEditingRow.porcentajeAvance)    : null,
                    tanqueInicio:        histEditingRow.tanqueInicio         ? Number(histEditingRow.tanqueInicio)        : null,
                    litrosTanqueInicio:  histEditingRow.litrosTanqueInicio   ? Number(histEditingRow.litrosTanqueInicio)  : null,
                    tanqueFin:           histEditingRow.tanqueFin            ? Number(histEditingRow.tanqueFin)           : null,
                    litrosTanqueFin:     histEditingRow.litrosTanqueFin      ? Number(histEditingRow.litrosTanqueFin)     : null,
                    notas:               histEditingRow.notas || null,
                }),
            });
            // Actualizar en memoria
            setRegistros(prev => prev.map(r => {
                if (r.id !== histEditingRow.id) return r;
                const hIni = Number(histEditingRow.horometroInicio);
                const hFin = Number(histEditingRow.horometroFin);
                const lts  = histEditingRow.litrosDiesel ? Number(histEditingRow.litrosDiesel) : r.litrosDiesel;
                const pu   = histEditingRow.precioDiesel  ? Number(histEditingRow.precioDiesel)  : r.precioDiesel;
                return {
                    ...r,
                    barrenos:            histEditingRow.barrenos       ? Number(histEditingRow.barrenos)       : r.barrenos,
                    metrosLineales:      histEditingRow.metrosLineales  ? Number(histEditingRow.metrosLineales) : r.metrosLineales,
                    horometroInicio:     hIni,
                    horometroFin:        hFin,
                    horasTrabajadas:     hFin - hIni,
                    litrosDiesel:        lts,
                    precioDiesel:        pu,
                    costoDiesel:         lts * pu,
                    rentaEquipoDiaria:   histEditingRow.rentaEquipoDiaria   ? Number(histEditingRow.rentaEquipoDiaria)   : r.rentaEquipoDiaria,
                    operadores:          histEditingRow.operadores          ? Number(histEditingRow.operadores)          : r.operadores,
                    peones:              histEditingRow.peones              ? Number(histEditingRow.peones)              : r.peones,
                    profundidadPromedio: histEditingRow.profundidadPromedio ? Number(histEditingRow.profundidadPromedio) : r.profundidadPromedio,
                    bordo:               histEditingRow.bordo               ? Number(histEditingRow.bordo)               : r.bordo,
                    espaciamiento:       histEditingRow.espaciamiento       ? Number(histEditingRow.espaciamiento)       : r.espaciamiento,
                    volumenRoca:         histEditingRow.volumenRoca         ? Number(histEditingRow.volumenRoca)         : r.volumenRoca,
                    porcentajePerdida:   histEditingRow.porcentajePerdida   ? Number(histEditingRow.porcentajePerdida)   : r.porcentajePerdida,
                    porcentajeAvance:    histEditingRow.porcentajeAvance    ? Number(histEditingRow.porcentajeAvance)    : r.porcentajeAvance,
                    notas:               histEditingRow.notas || r.notas,
                    tanqueInicio:        histEditingRow.tanqueInicio        ? Number(histEditingRow.tanqueInicio)        : r.tanqueInicio,
                    litrosTanqueInicio:  histEditingRow.litrosTanqueInicio  ? Number(histEditingRow.litrosTanqueInicio)  : r.litrosTanqueInicio,
                    tanqueFin:           histEditingRow.tanqueFin           ? Number(histEditingRow.tanqueFin)           : r.tanqueFin,
                    litrosTanqueFin:     histEditingRow.litrosTanqueFin     ? Number(histEditingRow.litrosTanqueFin)     : r.litrosTanqueFin,
                };
            }));
            handleCancelHistEdit();
        } catch (e: any) { setHistEditError(e.message || 'Error al guardar'); }
        finally { setHistSaving(false); }
    };

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
                        <p className="text-sm text-gray-500 mt-1">Control diario de operación — Obra → Plantilla → Equipo.</p>
                    </div>
                    <button
                        onClick={() => setVistaHistorial(v => !v)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            vistaHistorial
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {vistaHistorial ? <><X size={14}/> Cerrar historial</> : <><ClipboardList size={14}/> Ver historial</>}
                    </button>
                </div>

                {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

                {/* ── WIZARD DE 4 PASOS ─────────────────────────────────────── */}
                {!vistaHistorial && (
                    <div className="space-y-4">
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
                                    { label: 'Registros',      value: String(filtrados.length),                                               unit: '',    color: 'text-gray-800' },
                                    { label: 'Horas totales',  value: totalHoras.toFixed(1),                                                  unit: 'hrs', color: 'text-gray-800' },
                                    { label: 'Metros totales', value: totalMetros.toFixed(1),                                                 unit: 'm',   color: 'text-blue-700' },
                                    { label: 'Diésel total',   value: totalLitros.toLocaleString('es-MX'),                                    unit: 'lt',  color: 'text-blue-600' },
                                    { label: 'Costo diésel',   value: `$${totalCosto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, unit: '',    color: 'text-gray-800' },
                                    { label: 'Lt/hr prom.',    value: promLtHr,                                                               unit: '',    color: 'text-gray-800' },
                                ].map(k => (
                                    <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                        <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                                        <p className={`text-xl font-bold ${k.color}`}>{k.value} <span className="text-sm font-normal text-gray-400">{k.unit}</span></p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Tabla jerárquica: Obra → Plantilla → Equipo */}
                        <Card>
                            {loading ? (
                                <div className="p-10 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                                    <Loader2 size={16} className="animate-spin"/> Cargando registros...
                                </div>
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
                                        <table className="w-full border-collapse text-sm" style={{ minWidth: 900 }}>
                                            <thead>
                                                <tr className="bg-gray-50 border-b-2 border-gray-200">
                                                    <th className="pl-4 pr-2 py-2.5 text-left cursor-pointer select-none hover:text-gray-700 transition-colors"
                                                        onClick={() => handleSort('fecha')}>
                                                        <span className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                            Fecha
                                                            {sortKey === 'fecha' ? (sortDir === 'asc' ? <ArrowUp size={10} className="text-blue-500"/> : <ArrowDown size={10} className="text-blue-500"/>) : <ArrowUpDown size={10} className="opacity-30"/>}
                                                        </span>
                                                    </th>
                                                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipo</th>
                                                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-indigo-400 uppercase tracking-wider">Plant.</th>
                                                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Corte</th>
                                                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Horómetro</th>
                                                    <SortTh label="Bar." sortKey="barrenos" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right"/>
                                                    <SortTh label="Metros" sortKey="metros" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right"/>
                                                    <SortTh label="Diésel" sortKey="diesel" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right"/>
                                                    <SortTh label="Costo" sortKey="costo" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right"/>
                                                    <th className="px-2 py-2.5 text-right text-xs font-semibold text-emerald-500 uppercase tracking-wider">Renta/Día</th>
                                                    <th className="pr-3 py-2.5 w-28"/>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const rows: React.ReactNode[] = [];
                                                    let lastObraId: string | null = null;
                                                    let lastPlantillaKey: string | null = null;

                                                    const sorted = [...paginated].sort((a, b) => {
                                                        const obraA = a.obra?.nombre || a.obraNombre || '~Sin obra';
                                                        const obraB = b.obra?.nombre || b.obraNombre || '~Sin obra';
                                                        if (obraA !== obraB) return obraA.localeCompare(obraB);
                                                        const pA = a.plantilla?.numero ?? 999;
                                                        const pB = b.plantilla?.numero ?? 999;
                                                        if (pA !== pB) return pA - pB;
                                                        const eA = a.equipo.nombre;
                                                        const eB = b.equipo.nombre;
                                                        if (eA !== eB) return eA.localeCompare(eB);
                                                        return a.fecha.localeCompare(b.fecha);
                                                    });

                                                    sorted.forEach((r, i) => {
                                                        const oId = r.obra?.id || 'sin-obra';
                                                        const obraLabel = r.obra?.nombre || r.obraNombre || 'Sin obra asignada';
                                                        const plantillaKey = `${oId}-p${r.plantilla?.numero ?? 'x'}`;

                                                        // Separador OBRA
                                                        if (oId !== lastObraId) {
                                                            lastObraId = oId;
                                                            lastPlantillaKey = null;
                                                            rows.push(
                                                                <tr key={`obra-${oId}-${i}`} className="bg-gray-800">
                                                                    <td colSpan={11} className="pl-4 pr-3 py-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Building2 size={13} className="text-gray-300 flex-shrink-0"/>
                                                                            <span className="text-xs font-bold text-white tracking-wide uppercase">{obraLabel}</span>
                                                                            <span className="ml-auto text-[10px] text-gray-400">
                                                                                {sorted.filter(x => (x.obra?.id || 'sin-obra') === oId).length} registros
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        }

                                                        // Separador PLANTILLA
                                                        if (plantillaKey !== lastPlantillaKey) {
                                                            lastPlantillaKey = plantillaKey;
                                                            const regsP = sorted.filter(x =>
                                                                (x.obra?.id || 'sin-obra') === oId &&
                                                                (x.plantilla?.numero ?? 'x') === (r.plantilla?.numero ?? 'x')
                                                            );
                                                            const totM = regsP.reduce((s, x) => s + x.metrosLineales, 0);
                                                            const totB = regsP.reduce((s, x) => s + x.barrenos, 0);
                                                            const totH = regsP.reduce((s, x) => s + x.horasTrabajadas, 0);
                                                            rows.push(
                                                                <tr key={`plant-${plantillaKey}-${i}`} className="bg-indigo-50 border-t border-indigo-100">
                                                                    <td colSpan={11} className="pl-6 pr-3 py-1.5">
                                                                        <div className="flex items-center gap-3 flex-wrap">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <Layers size={11} className="text-indigo-500"/>
                                                                                {r.plantilla ? (
                                                                                    <span className="text-xs font-bold text-indigo-700">Plantilla {r.plantilla.numero}</span>
                                                                                ) : (
                                                                                    <span className="text-xs font-semibold text-gray-400 italic">Sin plantilla</span>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-gray-300">·</span>
                                                                            <span className="text-[10px] text-indigo-500">{regsP.length} días · {totH} hrs · {totM.toFixed(1)} m · {totB} bar.</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        }

                                                        rows.push(
                                                            <RegistroRow
                                                                key={r.id}
                                                                r={r}
                                                                onDelete={setRegistroAEliminar}
                                                                onDuplicate={handleDuplicate}
                                                                isLastForEquipo={lastIdByEquipo.get(r.equipo.nombre) === r.id}
                                                                editingId={histEditingId}
                                                                onStartEdit={handleStartHistEdit}
                                                                onCancelEdit={handleCancelHistEdit}
                                                                onSaveEdit={handleSaveHistEdit}
                                                                editingRow={histEditingRow}
                                                                onChangeEdit={(key, val) => setHistEditingRow(prev => prev ? { ...prev, [key]: val } : prev)}
                                                                savingEdit={histSaving}
                                                                editError={histEditError}
                                                            />
                                                        );
                                                    });
                                                    return rows;
                                                })()}
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
