"use client";

import { useEffect, useState, Suspense, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ClipboardList, Plus, Trash2, Gauge,
    Droplets, ChevronDown, ChevronUp,
    Search, X, Filter, Drill, Pencil, Copy,
    ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
    AlertTriangle, CheckCircle2, Loader2, Table2, Lock,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

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

type Equipo = { id: string; nombre: string; numeroEconomico: string | null };
type ObraSimple = { id: string; nombre: string };
type SortKey = 'fecha' | 'horas' | 'metros' | 'barrenos' | 'diesel' | 'costo';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

type EditingRow = {
    id: string;
    barrenos: string;
    metrosLineales: string;
    profundidadPromedio: string;
    litrosDiesel: string;
    precioDiesel: string;
    rentaEquipoDiaria: string;
    operadores: string;
    peones: string;
    horometroInicio: string;
    horometroFin: string;
};

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
                                title="Duplicar como nuevo registro (continúa desde el horómetro final)"
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                                <Copy size={13}/>
                            </button>
                        ) : (
                            <span className="p-1.5 w-[28px]"/>
                        )}
                        <button onClick={e => { e.stopPropagation(); onEdit(r.id); }}
                            title="Editar registro"
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                            <Pencil size={13}/>
                        </button>
                        <button onClick={e => { e.stopPropagation(); onDelete(r); }}
                            title="Eliminar registro"
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
                                <p className="text-xs font-semibold text-indigo-400 mb-2 flex items-center gap-1"><Drill size={11}/> Perforación (Track Drill)</p>
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

type GridRow = {
    fecha: string;
    horometroInicio: string;
    horometroFin: string;
    barrenos: string;
    metrosLineales: string;
    profundidadPromedio: string;
    litrosDiesel: string;
    precioDiesel: string;
    rentaEquipoDiaria: string;
    operadores: string;
    peones: string;
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
        fecha: nextFecha,
        horometroInicio: hIni,
        horometroFin: hFin,
        barrenos: prev.barrenos,
        metrosLineales: prev.metrosLineales,
        profundidadPromedio: prev.profundidadPromedio,
        litrosDiesel: prev.litrosDiesel,
        precioDiesel: prev.precioDiesel,
        rentaEquipoDiaria: prev.rentaEquipoDiaria,
        operadores: prev.operadores,
        peones: prev.peones,
    };
}

const COLS: { key: keyof Omit<GridRow,'_status'|'_error'>; label: string; width: number; type: string }[] = [
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
    return { fecha:'', horometroInicio:'', horometroFin:'', barrenos:'', metrosLineales:'',
        profundidadPromedio:'', litrosDiesel:'', precioDiesel:'21.95',
        rentaEquipoDiaria:'', operadores:'1', peones:'1',
        _status:'idle', _error:'', _suggested:{} };
}

function validateGridRow(r: GridRow) {
    if (!r.fecha) return 'Fecha requerida';
    if (!r.horometroInicio || isNaN(Number(r.horometroInicio))) return 'H. Ini requerido';
    if (!r.horometroFin   || isNaN(Number(r.horometroFin)))   return 'H. Fin requerido';
    if (Number(r.horometroFin) <= Number(r.horometroInicio))  return 'H. Fin debe ser mayor al H. Ini';
    if (Number(r.horometroFin) - Number(r.horometroInicio) > 24) return 'Diferencia mayor a 24 hrs';
    return '';
}

type ObraConEquipos = ObraSimple & {
    obraEquipos?: { equipoId: string }[];
    plantillas?:  { metrosContratados: number; barrenos: number }[];
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

function PlanillaGrid({ equipos, obras }: { equipos: Equipo[]; obras: ObraConEquipos[] }) {
    const [obraId,   setObraId]   = useState('');
    const [equipoId, setEquipoId] = useState('');
    const [registrosExistentes, setRegistrosExistentes] = useState<RegistroExistente[]>([]);
    const [loadingCtx,          setLoadingCtx]          = useState(false);
    const [plantillaAvance,     setPlantillaAvance]      = useState<{metros: number; barrenos: number; metrosTotal: number; barrenosTotal: number} | null>(null);

    // ✅ NUEVA FILA ÚNICA
    const [nuevaFila, setNuevaFila]   = useState<GridRow>(emptyRow());
    const [savingRow, setSavingRow]   = useState(false);
    const [rowError,  setRowError]    = useState('');
    const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
    const [savingInline, setSavingInline] = useState(false);
    const [inlineError, setInlineError] = useState('');

    const gridRef   = useRef<HTMLDivElement>(null);
    const inputRefs = useRef<(HTMLInputElement|null)[]>([]);

    const obraSeleccionada = obras.find(o => o.id === obraId);
    const equiposDeObra    = obraSeleccionada?.obraEquipos?.length
        ? equipos.filter(eq => obraSeleccionada.obraEquipos!.some(oe => oe.equipoId === eq.id))
        : equipos;

    // ✅ FECHAS EXISTENTES SE ACTUALIZA CORRECTAMENTE
    const fechasExistentes = useMemo(
        () => new Set(registrosExistentes.map(r => r.fecha.slice(0, 10))),
        [registrosExistentes]
    );

    const handleObraChange = (newObraId: string) => {
        setObraId(newObraId);
        setEquipoId('');
        setRegistrosExistentes([]);
        setPlantillaAvance(null);
        setNuevaFila(emptyRow());
        setRowError('');
    };

    const handleEquipoChange = useCallback(async (newEquipoId: string) => {
        setEquipoId(newEquipoId);
        if (!newEquipoId || !obraId) return;

        setLoadingCtx(true);
        try {
            const todos: any[] = await fetchApi('/registros-diarios');
            const eq = equipos.find(e => e.id === newEquipoId);
            const existentes: RegistroExistente[] = todos
                .filter((r: any) => r.obra?.id === obraId && r.equipo?.nombre === eq?.nombre)
                .sort((a: any, b: any) => b.horometroFin - a.horometroFin)
                .map((r: any) => ({
                    id: r.id,
                    fecha: r.fecha,
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
                }));

            // ✅ ACTUALIZA registrosExistentes CON TODOS LOS REGISTROS CARGADOS
            setRegistrosExistentes(existentes);

            // Precarga con sugerencias desde último registro
            const ultimoHFin = existentes.length > 0 ? String(existentes[0].horometroFin) : '';
            if (existentes.length > 0) {
                const ult = existentes[0];
                const ultRow: GridRow = {
                    ...emptyRow(),
                    fecha: (ult.fecha || '').slice(0, 10),
                    horometroInicio: '',
                    horometroFin: ultimoHFin,
                    barrenos: String(ult.barrenos || ''),
                    metrosLineales: String(ult.metrosLineales || ''),
                };
                const sug = buildSuggestedRow(ultRow);
                setNuevaFila({
                    ...emptyRow(),
                    ...sug,
                    _suggested: Object.fromEntries(Object.keys(sug).map(k => [k, true])) as any,
                });
            } else {
                setNuevaFila(prev => ({ ...prev, horometroInicio: ultimoHFin }));
            }

            const obra = obras.find(o => o.id === obraId);
            if (obra?.plantillas?.length) {
                const plt = obra.plantillas[0];
                const metrosAcum   = existentes.reduce((s, r) => s + r.metrosLineales, 0);
                const barrenosAcum = existentes.reduce((s, r) => s + r.barrenos, 0);
                setPlantillaAvance({
                    metros:        metrosAcum,
                    barrenos:      barrenosAcum,
                    metrosTotal:   plt.metrosContratados,
                    barrenosTotal: plt.barrenos,
                });
            }
        } catch { /* silencioso */ }
        finally { setLoadingCtx(false); }
    }, [obraId, equipos, obras]);

    const updateNuevaFila = (key: keyof GridRow, val: string) => {
        setNuevaFila(prev => ({
            ...prev,
            [key]: val,
            _status: 'idle' as const,
            _error: '',
            _suggested: { ...prev._suggested, [key]: false },
        }));
        setRowError('');
    };

    // ✅ GUARDAR UNA FILA - CORRIGE EL BUG DE DUPLICADOS
    const saveRowAndReset = async () => {
        if (!equipoId) {
            alert('Selecciona equipo antes de guardar');
            return;
        }

        setRowError('');
        setSavingRow(true);

        try {
            const errMsg = validateGridRow(nuevaFila);
            if (errMsg) {
                setRowError(errMsg);
                setSavingRow(false);
                return;
            }

            // Validar duplicado
            if (fechasExistentes.has(nuevaFila.fecha)) {
                setRowError('⚠ Fecha ya registrada');
                setSavingRow(false);
                return;
            }

            // Guardar en BD
            await fetchApi('/registros-diarios', {
                method: 'POST',
                body: JSON.stringify({
                    equipoId,
                    obraId: obraId || null,
                    fecha: nuevaFila.fecha,
                    horometroInicio: Number(nuevaFila.horometroInicio),
                    horometroFin: Number(nuevaFila.horometroFin),
                    barrenos: nuevaFila.barrenos ? Number(nuevaFila.barrenos) : 0,
                    metrosLineales: nuevaFila.metrosLineales ? Number(nuevaFila.metrosLineales) : 0,
                    profundidadPromedio: nuevaFila.profundidadPromedio ? Number(nuevaFila.profundidadPromedio) : null,
                    litrosDiesel: nuevaFila.litrosDiesel ? Number(nuevaFila.litrosDiesel) : 0,
                    precioDiesel: nuevaFila.precioDiesel ? Number(nuevaFila.precioDiesel) : 0,
                    rentaEquipoDiaria: nuevaFila.rentaEquipoDiaria ? Number(nuevaFila.rentaEquipoDiaria) : null,
                    operadores: nuevaFila.operadores ? Number(nuevaFila.operadores) : 1,
                    peones: nuevaFila.peones ? Number(nuevaFila.peones) : 0,
                }),
            });

            // ✅ AGREGAR A registrosExistentes PARA QUE fechasExistentes SE ACTUALICE
            const nuevoRegistro: RegistroExistente = {
                id: `temp-${Date.now()}`,
                fecha: nuevaFila.fecha,
                horometroInicio: Number(nuevaFila.horometroInicio),
                horometroFin: Number(nuevaFila.horometroFin),
                metrosLineales: Number(nuevaFila.metrosLineales),
                barrenos: Number(nuevaFila.barrenos),
                profundidadPromedio: nuevaFila.profundidadPromedio ? Number(nuevaFila.profundidadPromedio) : null,
                litrosDiesel: nuevaFila.litrosDiesel ? Number(nuevaFila.litrosDiesel) : null,
                precioDiesel: nuevaFila.precioDiesel ? Number(nuevaFila.precioDiesel) : null,
                rentaEquipoDiaria: nuevaFila.rentaEquipoDiaria ? Number(nuevaFila.rentaEquipoDiaria) : null,
                operadores: nuevaFila.operadores ? Number(nuevaFila.operadores) : null,
                peones: nuevaFila.peones ? Number(nuevaFila.peones) : null,
            };

            setRegistrosExistentes(prev => [...prev, nuevoRegistro]);

            // Actualizar plantilla avance
            if (plantillaAvance) {
                setPlantillaAvance(prev => prev ? {
                    ...prev,
                    metros:   prev.metros   + (nuevaFila.metrosLineales  ? Number(nuevaFila.metrosLineales)  : 0),
                    barrenos: prev.barrenos + (nuevaFila.barrenos        ? Number(nuevaFila.barrenos)        : 0),
                } : null);
            }

            // Generar siguiente fila con sugerencias
            const nextSuggestions = buildSuggestedRow(nuevaFila);
            setNuevaFila({
                ...emptyRow(),
                ...nextSuggestions,
                _suggested: Object.fromEntries(Object.keys(nextSuggestions).map(k => [k, true])) as any,
            });

            setRowError('');
        } catch (err: any) {
            const msg = err.message || 'Error';
            const isDupe = msg.toLowerCase().includes('ya existe') || msg.includes('P2002');
            setRowError(isDupe ? '⚠ Fecha ya registrada' : msg);
        } finally {
            setSavingRow(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, ci: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveRowAndReset();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const nextInput = inputRefs.current[ci + 1];
            if (nextInput) nextInput.focus();
        }
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
            setRegistrosExistentes(prev => prev.map(r => r.id === editingRow.id ? {
                ...r,
                barrenos:            Number(editingRow.barrenos)            || r.barrenos,
                metrosLineales:      Number(editingRow.metrosLineales)       || r.metrosLineales,
                horometroInicio:     Number(editingRow.horometroInicio),
                horometroFin:        Number(editingRow.horometroFin),
                profundidadPromedio: editingRow.profundidadPromedio ? Number(editingRow.profundidadPromedio) : r.profundidadPromedio,
                litrosDiesel:        editingRow.litrosDiesel        ? Number(editingRow.litrosDiesel)        : r.litrosDiesel,
                precioDiesel:        editingRow.precioDiesel         ? Number(editingRow.precioDiesel)        : r.precioDiesel,
                rentaEquipoDiaria:   editingRow.rentaEquipoDiaria    ? Number(editingRow.rentaEquipoDiaria)   : r.rentaEquipoDiaria,
                operadores:          editingRow.operadores           ? Number(editingRow.operadores)           : r.operadores,
                peones:              editingRow.peones               ? Number(editingRow.peones)               : r.peones,
            } : r));
            setEditingRow(null);
        } catch (e: any) {
            setInlineError(e.message || 'Error al guardar');
        } finally {
            setSavingInline(false);
        }
    };

    const startEditingRow = (r: RegistroExistente) => {
        setEditingRow({
            id: r.id,
            barrenos:            String(r.barrenos        ?? ''),
            metrosLineales:      String(r.metrosLineales  ?? ''),
            profundidadPromedio: r.profundidadPromedio != null ? String(r.profundidadPromedio) : '',
            litrosDiesel:        r.litrosDiesel        != null ? String(r.litrosDiesel)        : '',
            precioDiesel:        r.precioDiesel         != null ? String(r.precioDiesel)        : '21.95',
            rentaEquipoDiaria:   r.rentaEquipoDiaria    != null ? String(r.rentaEquipoDiaria)   : '',
            operadores:          r.operadores           != null ? String(r.operadores)           : '1',
            peones:              r.peones               != null ? String(r.peones)               : '0',
            horometroInicio:     String(r.horometroInicio ?? ''),
            horometroFin:        String(r.horometroFin    ?? ''),
        });
        setInlineError('');
    };

    const listoParaEditar = !!obraId && !!equipoId;
    const isDupe = !!nuevaFila.fecha && fechasExistentes.has(nuevaFila.fecha);
    const isEmpty = !nuevaFila.fecha && !nuevaFila.horometroFin && !nuevaFila.horometroInicio;
    const hrs = nuevaFila.horometroFin && nuevaFila.horometroInicio
        ? Math.max(0, Number(nuevaFila.horometroFin) - Number(nuevaFila.horometroInicio))
        : null;
    const canSave = !isEmpty && !isDupe && !savingRow;

    const pctAvance = plantillaAvance && plantillaAvance.metrosTotal > 0
        ? Math.min(100, (plantillaAvance.metros / plantillaAvance.metrosTotal) * 100)
        : 0;
    const plantillaCompleta = pctAvance >= 100;

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* SELECTORES */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                            Obra <span className="text-red-500">*</span>
                        </label>
                        <select value={obraId} onChange={e => handleObraChange(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                            <option value="">— Selecciona una obra —</option>
                            {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                            Equipo <span className="text-red-500">*</span>
                        </label>
                        <select value={equipoId} onChange={e => handleEquipoChange(e.target.value)}
                            disabled={!obraId || loadingCtx}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed">
                            <option value="">{obraId ? (loadingCtx ? 'Cargando…' : '— Selecciona un equipo —') : '— Primero selecciona una obra —'}</option>
                            {equiposDeObra.map(eq => (
                                <option key={eq.id} value={eq.id}>
                                    {eq.nombre}{eq.numeroEconomico ? ` (${eq.numeroEconomico})` : ''}
                                </option>
                            ))}
                        </select>
                        {!obraId && <p className="text-xs text-amber-600 mt-1">Selecciona la obra primero</p>}
                        {obraId && !loadingCtx && equiposDeObra.length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">Sin equipos asignados a esta obra.</p>
                        )}
                    </div>
                </div>

                {listoParaEditar && registrosExistentes.length > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-700 flex items-center gap-2">
                        <CheckCircle2 size={12} className="shrink-0"/>
                        <span>
                            <strong>{registrosExistentes.length} registro{registrosExistentes.length !== 1 ? 's' : ''}</strong> ya cargados.
                            Último H. Fin: <strong>{registrosExistentes[0]?.horometroFin}</strong>
                        </span>
                    </div>
                )}

                {/* PLANTILLA AVANCE */}
                {plantillaAvance && (
                    <div className={`border rounded-xl px-4 py-3 text-xs space-y-2 ${plantillaCompleta ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-100'}`}>
                        <div className="flex items-center justify-between">
                            <p className={`font-semibold ${plantillaCompleta ? 'text-green-700' : 'text-indigo-700'}`}>
                                {plantillaCompleta ? '🎉 Plantilla completada' : `Plantilla · ${pctAvance.toFixed(1)}%`}
                            </p>
                            <span className={`text-xs ${plantillaCompleta ? 'text-green-600' : 'text-indigo-500'}`}>
                                {plantillaAvance.metros.toFixed(1)} / {plantillaAvance.metrosTotal} m
                            </span>
                        </div>
                        <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden border border-white">
                            <div className={`h-full rounded-full transition-all duration-500 ${plantillaCompleta ? 'bg-green-500' : 'bg-indigo-500'}`}
                                style={{width: `${pctAvance}%`}}/>
                        </div>
                    </div>
                )}

                <p className="text-xs text-gray-400">
                    💡 Presiona <kbd className="px-1 bg-gray-100 rounded text-xs font-mono">Enter</kbd> para guardar una fila.
                    <kbd className="px-1 mx-1 bg-gray-100 rounded text-xs font-mono">Tab</kbd> para moverte entre campos.
                    Cada fila se guarda automáticamente y la siguiente se precarga con sugerencias.
                </p>
            </div>

            {/* TABLA */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative" ref={gridRef}>
                {!listoParaEditar && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
                        <div className="text-center space-y-2 px-6">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                                <Lock size={20} className="text-gray-400"/>
                            </div>
                            <p className="text-sm font-semibold text-gray-600">
                                {!obraId ? 'Selecciona una obra para continuar' : 'Selecciona un equipo para continuar'}
                            </p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
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
                    <table className="w-full border-collapse text-sm" style={{minWidth: 980}}>
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="w-8 p-2 text-xs text-gray-400 font-medium text-center border-r">#</th>
                                {COLS.map(col => (
                                    <th key={col.key} className="p-2 text-xs font-semibold uppercase text-left border-r text-gray-500 whitespace-nowrap"
                                        style={{minWidth: col.width}}>
                                        {col.label}
                                    </th>
                                ))}
                                <th className="p-2 text-xs font-semibold text-center border-r text-green-600 whitespace-nowrap" style={{minWidth:64}}>Hrs</th>
                                <th className="p-2 text-xs font-semibold text-center" style={{minWidth:120}}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* REGISTROS GUARDADOS */}
                            {registrosExistentes.map((r, i) => {
                                const iso = (r.fecha || '').slice(0, 10);
                                const fechaStr = iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' }) : '—';
                                const isEditing = editingRow?.id === r.id;

                                if (isEditing) {
                                    const hrsEdit = editingRow.horometroFin && editingRow.horometroInicio
                                        ? Math.max(0, Number(editingRow.horometroFin) - Number(editingRow.horometroInicio))
                                        : null;
                                    const editInp = (key: keyof EditingRow, placeholder = '') => (
                                        <input
                                            type="text" inputMode="decimal"
                                            value={editingRow[key] as string}
                                            onChange={e => setEditingRow(prev => prev ? {...prev, [key]: e.target.value} : prev)}
                                            placeholder={placeholder}
                                            className="w-full h-9 px-2 bg-white border border-blue-300 rounded text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                        />
                                    );
                                    return (
                                        <tr key={`ex-${r.id}`} className="border-b border-amber-200 bg-amber-50/60">
                                            <td className="p-2 text-xs text-amber-400 text-center border-r w-8">{i+1}</td>
                                            <td className="border-r border-amber-100 px-2 h-9 text-xs font-medium text-amber-700 whitespace-nowrap">{fechaStr}</td>
                                            {COLS.slice(1).map(col => (
                                                <td key={col.key} className="border-r border-amber-100 p-1" style={{minWidth: col.width}}>
                                                    {editInp(col.key as keyof EditingRow, '—')}
                                                </td>
                                            ))}
                                            <td className="border-r border-amber-100 text-center px-1">
                                                {hrsEdit !== null ? <span className="text-xs font-bold px-1.5 py-0.5 rounded text-amber-700 bg-amber-100">{hrsEdit}h</span>
                                                    : <span className="text-gray-200">—</span>}
                                            </td>
                                            <td className="text-center px-2">
                                                <span className="text-xs text-amber-600 font-semibold">Editando…</span>
                                            </td>
                                        </tr>
                                    );
                                }

                                const hrs = r.horometroInicio != null ? r.horometroFin - r.horometroInicio : null;
                                return (
                                    <tr key={`ex-${r.id}`} className="border-b border-blue-100 bg-blue-50/30 hover:bg-blue-100/40">
                                        <td className="p-2 text-xs text-blue-300 text-center border-r w-8">{i+1}</td>
                                        <td className="border-r border-blue-100 px-2 h-9 text-xs font-medium text-blue-700 whitespace-nowrap">{fechaStr}</td>
                                        <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.horometroInicio ?? '—'}</td>
                                        <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600 font-semibold">{r.horometroFin}</td>
                                        <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.barrenos || '—'}</td>
                                        <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.metrosLineales?.toFixed(1) || '—'}</td>
                                        <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.profundidadPromedio ?? '—'}</td>
                                        <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.litrosDiesel ?? '—'}</td>
                                        <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.precioDiesel ?? '—'}</td>
                                        <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.rentaEquipoDiaria ?? '—'}</td>
                                        <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.operadores ?? '—'}</td>
                                        <td className="border-r border-blue-100 px-2 h-9 text-xs text-gray-600">{r.peones ?? '—'}</td>
                                        <td className="border-r border-blue-100 text-center px-1">
                                            {hrs !== null ? <span className="text-xs font-bold px-1.5 py-0.5 rounded text-blue-600 bg-blue-100">{hrs}h</span>
                                                : <span className="text-gray-200">—</span>}
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

                            {/* SEPARADOR */}
                            {registrosExistentes.length > 0 && (
                                <tr className="border-b-2 border-blue-200">
                                    <td colSpan={COLS.length + 3} className="px-3 py-1 bg-blue-100/40 text-xs text-blue-500 font-semibold">
                                        ↓ Nueva entrada
                                    </td>
                                </tr>
                            )}

                            {/* NUEVA FILA - UNA SOLA */}
                            <tr className={`border-b transition-colors ${
                                isDupe ? 'bg-amber-50' : isEmpty ? 'bg-white' : 'bg-green-50/30'
                            }`}>
                                <td className="p-2 text-xs font-semibold text-center border-r w-8">
                                    {registrosExistentes.length + 1}
                                </td>

                                {COLS.map((col, ci) => {
                                    const val = nuevaFila[col.key] as string;
                                    const isSuggested = !!nuevaFila._suggested?.[col.key as keyof GridRow];
                                    const isError = col.key === 'horometroFin' && val && nuevaFila.horometroInicio &&
                                        (Number(val) <= Number(nuevaFila.horometroInicio));

                                    return (
                                        <td key={col.key} className={`p-1 border-r ${
                                            isDupe && col.key === 'fecha' ? 'bg-amber-100' : ''
                                        } ${isSuggested && !isEmpty ? 'bg-green-100/50' : ''} ${isError ? 'bg-red-50' : ''}`}
                                            style={{minWidth: col.width}}>
                                            <input
                                                ref={el => { inputRefs.current[ci] = el; }}
                                                type={col.type === 'date' ? 'date' : 'text'}
                                                inputMode={col.type === 'number' ? 'decimal' : undefined}
                                                value={val}
                                                onChange={e => updateNuevaFila(col.key, e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, ci)}
                                                placeholder={col.type === 'date' ? 'YYYY-MM-DD' : '—'}
                                                className={`w-full h-9 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
                                                    ${isSuggested && !isEmpty ? 'italic text-green-600 bg-green-50 border-green-200' : 'border border-gray-200 text-gray-800'}
                                                    ${isError ? 'text-red-600 border-red-300' : ''}
                                                `}
                                            />
                                        </td>
                                    );
                                })}

                                <td className="p-2 text-xs text-center border-r">
                                    {hrs !== null ? (
                                        <span className={`px-2 py-1 rounded font-bold ${
                                            hrs > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                                        }`}>
                                            {hrs}h
                                        </span>
                                    ) : '—'}
                                </td>

                                <td className="text-center px-2 min-w-[120px]">
                                    {isDupe && !isEmpty ? (
                                        <span className="text-amber-600 font-medium text-xs">⚠ Duplicada</span>
                                    ) : isEmpty ? (
                                        <span className="text-gray-300 text-xs">—</span>
                                    ) : (
                                        <>
                                            {savingRow ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <Loader2 size={13} className="animate-spin text-blue-500" />
                                                    <span className="text-xs text-blue-600 font-medium">Guardando…</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={saveRowAndReset}
                                                    disabled={!canSave}
                                                    className={`flex items-center gap-1 mx-auto px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                                        canSave
                                                            ? 'bg-green-500 hover:bg-green-600 text-white'
                                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                    }`}
                                                    title="O presiona Enter">
                                                    <CheckCircle2 size={12}/>
                                                    Guardar
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {rowError && <p className="text-red-500 text-xs mt-1 leading-tight">{rowError}</p>}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                    <span className="text-xs text-gray-500">
                        {registrosExistentes.length} registro{registrosExistentes.length !== 1 ? 's' : ''} guardado{registrosExistentes.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-gray-400">
                        Presiona <kbd className="px-1 bg-white border border-gray-300 rounded">Enter</kbd> para guardar
                    </span>
                </div>
            </div>
        </div>
    );
}

function NuevoRegistroDropdown({ onIndividual, onPlanilla }: {
    onIndividual: () => void;
    onPlanilla: () => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <div className="flex items-stretch rounded-lg shadow-sm overflow-hidden">
                <button
                    onClick={onIndividual}
                    className="flex items-center gap-2 pl-4 pr-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors">
                    <Plus size={16}/> Nuevo Registro
                </button>
                <div className="w-px bg-blue-500"/>
                <button
                    onClick={() => setOpen(o => !o)}
                    className="px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                    <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`}/>
                </button>
            </div>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)}/>
                    <div className="absolute right-0 top-full mt-1.5 z-20 bg-white rounded-xl shadow-lg border border-gray-100 w-56 py-1.5 animate-in fade-in zoom-in-95 duration-100">
                        <button
                            onClick={() => { setOpen(false); onIndividual(); }}
                            className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                            <div className="mt-0.5 p-1.5 bg-blue-50 rounded-md flex-shrink-0">
                                <Plus size={13} className="text-blue-600"/>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">Registro individual</p>
                                <p className="text-xs text-gray-400">Formulario completo, un día</p>
                            </div>
                        </button>
                        <button
                            onClick={() => { setOpen(false); onPlanilla(); }}
                            className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                            <div className="mt-0.5 p-1.5 bg-indigo-50 rounded-md flex-shrink-0">
                                <Table2 size={13} className="text-indigo-600"/>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">Carga en planilla</p>
                                <p className="text-xs text-gray-400">Varios días, estilo Excel</p>
                            </div>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

function RegistrosDiariosInner() {
    const searchParams  = useSearchParams();
    const router        = useRouter();
    const equipoIdParam = searchParams.get('equipoId') || undefined;
    const obraIdParam   = searchParams.get('obraId')   || undefined;

    const [registros, setRegistros] = useState<Registro[]>([]);
    const [equipos,   setEquipos]   = useState<Equipo[]>([]);
    const [obras,     setObras]     = useState<ObraSimple[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState('');
    const [vista,     setVista]     = useState<'lista'|'planilla'>('lista');

    const [filtroEquipo, setFiltroEquipo] = useState(equipoIdParam ?? 'todos');
    const [filtroObra,   setFiltroObra]   = useState(obraIdParam   ?? 'todas');
    const [filtroDesde,  setFiltroDesde]  = useState('');
    const [filtroHasta,  setFiltroHasta]  = useState('');
    const [filtroSemana, setFiltroSemana] = useState('todas');
    const [busqueda,     setBusqueda]     = useState('');
    const [sortKey,      setSortKey]      = useState<SortKey>('fecha');
    const [sortDir,      setSortDir]      = useState<SortDir>('desc');
    const [page,         setPage]         = useState(1);
    const [registroAEliminar, setRegistroAEliminar] = useState<Registro | null>(null);

    const load = async () => {
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
    };

    useEffect(() => { load(); }, []);
    useEffect(() => { setPage(1); }, [filtroEquipo, filtroObra, filtroSemana, filtroDesde, filtroHasta, busqueda, sortKey, sortDir]);

    const handleDeleteConfirm = async () => {
        if (!registroAEliminar) return;
        try {
            await fetchApi(`/registros-diarios/${registroAEliminar.id}`, { method: 'DELETE' });
            setRegistros(r => r.filter(x => x.id !== registroAEliminar.id));
        } catch (e: any) { alert(e.message || 'Error al eliminar'); }
        finally { setRegistroAEliminar(null); }
    };

    const handleEdit = (id: string) => router.push(`/dashboard/registros-diarios/${id}/edit`);

    const handleDuplicate = (r: Registro) => {
        const params = new URLSearchParams();
        const eq = equipos.find(e => e.nombre === r.equipo.nombre);
        if (eq)       params.set('equipoId', eq.id);
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
        else { setSortKey(key); setSortDir('desc'); }
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
            const key = r.equipo.nombre;
            const current = registros.find(x => x.id === map.get(key));
            if (!current || r.horometroFin > current.horometroFin) {
                map.set(key, r.id);
            }
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Registro Diario</h1>
                        <p className="text-sm text-gray-500 mt-1">Control diario de operación — equivalente a la hoja Rpte del Excel.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <NuevoRegistroDropdown
                            onIndividual={() => {
                                const params = new URLSearchParams();
                                if (filtroEquipo !== 'todos') params.set('equipoId', filtroEquipo);
                                if (filtroObra   !== 'todas') params.set('obraId',   filtroObra);
                                const qs = params.toString();
                                router.push(`/dashboard/registros-diarios/new${qs ? `?${qs}` : ''}`);
                            }}
                            onPlanilla={() => setVista('planilla')}
                        />
                    </div>
                </div>

                {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

                {vista === 'planilla' && (
                    <>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setVista('lista')}
                                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                                <ChevronUp size={14} className="-rotate-90"/> Volver a la lista
                            </button>
                            <span className="text-gray-200">|</span>
                            <p className="text-sm text-gray-400 flex items-center gap-1.5">
                                <Table2 size={14} className="text-indigo-500"/> Carga masiva en planilla
                            </p>
                        </div>
                        <PlanillaGrid equipos={equipos} obras={obras as any} />
                    </>
                )}

                {vista === 'lista' && (<>
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

                {!loading && filtrados.length > 0 && (
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        {[
                            { label: 'Registros',      value: String(filtrados.length),                                              unit: '' },
                            { label: 'Horas totales',  value: totalHoras.toFixed(1),                                                 unit: 'hrs' },
                            { label: 'Metros totales', value: totalMetros.toFixed(1),                                                unit: 'm' },
                            { label: 'Diésel total',   value: totalLitros.toLocaleString('es-MX'),                                   unit: 'lt' },
                            { label: 'Costo diésel',   value: `$${totalCosto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, unit: '' },
                            { label: 'Lt/hr prom.',    value: promLtHr,                                                              unit: '' },
                        ].map(k => (
                            <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                                <p className="text-xl font-bold text-gray-800">{k.value} <span className="text-sm font-normal text-gray-400">{k.unit}</span></p>
                            </div>
                        ))}
                    </div>
                )}

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
                                            <th className="p-3 w-28"></th>
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
                </>)}
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