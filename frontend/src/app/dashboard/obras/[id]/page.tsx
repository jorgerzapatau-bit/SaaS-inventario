"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    HardHat, ArrowLeft, Plus, Edit, Trash2,
    CheckCircle, PauseCircle, Clock, Wrench,
    FileText, Package, ChevronDown, ChevronUp,
    AlertTriangle, X, CheckCircle2,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { RegistroDiarioExpandido } from '@/components/registro-diario/RegistroDiarioExpandido';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Corte = {
    id: string;
    numero: number;
    fechaInicio: string;
    fechaFin: string;
    barrenos: number;
    metrosLineales: number;
    bordo: number | null;
    espesor: number | null;
    profundidadCollar: number | null;
    volumenBruto: number | null;
    perdidaM3: number | null;
    porcentajePerdida: number | null;
    volumenNeto: number | null;
    precioUnitario: number | null;
    montoFacturado: number | null;
    moneda: string;
    status: 'BORRADOR' | 'FACTURADO' | 'COBRADO';
    notas: string | null;
    registros: { id: string; fecha: string; barrenos: number; metrosLineales: number }[];
};

// Nuevo tipo para los registros disponibles en el selector
type RegistroDisponible = {
    id: string;
    fecha: string;
    barrenos: number;
    metrosLineales: number;
    equipo: { nombre: string; numeroEconomico: string | null };
    plantillaId: string | null;
    plantillaNumero: number | null;
};

type RegistroDiario = {
    id: string;
    fecha: string;
    equipo: { nombre: string };
    horasTrabajadas: number;
    barrenos: number;
    metrosLineales: number;
    litrosDiesel: number;
    precioDiesel: number;
    horometroInicio: number | null;
    horometroFin: number | null;
    plantillaId: string | null;
    operadores: number | null;
    peones: number | null;
    rentaEquipoDiaria: number | null;
};

type ObraEquipo = {
    id: string;
    equipoId: string;
    fechaInicio: string;
    fechaFin: string | null;
    equipo: { nombre: string; numeroEconomico: string | null; modelo: string | null };
};

type Movimiento = {
    id: string;
    fecha: string;
    producto: { nombre: string; unidad: string };
    tipoMovimiento: string;
    cantidad: number;
    costoUnitario: number;
    moneda: string;
};

type PlantillaObraDetalle = {
    id: string;
    numero: number;
    metrosContratados: number;
    barrenos: number;
    precioUnitario: number | null;
    fechaInicio: string | null;
    fechaFin: string | null;
    status: 'ACTIVA' | 'PAUSADA' | 'TERMINADA';
    notas: string | null;
    plantillaEquipos?: {
        equipoId: string;
        equipo: { id: string; nombre: string; numeroEconomico: string | null; modelo: string | null };
    }[];
};

type ObraDetalle = {
    id: string;
    nombre: string;
    clienteNombre: string | null;
    cliente: { nombre: string; telefono: string | null; email: string | null } | null;
    ubicacion: string | null;
    metrosContratados: number | null;
    precioUnitario: number | null;
    bordo: number | null;
    espesor: number | null;
    espaciamiento: number | null;
    profundidadCollar: number | null;
    moneda: string;
    fechaInicio: string | null;
    fechaFin: string | null;
    status: 'ACTIVA' | 'PAUSADA' | 'TERMINADA';
    notas: string | null;
    plantillas: PlantillaObraDetalle[];   // Mejora 10
    obraEquipos: ObraEquipo[];
    cortesFacturacion: Corte[];
    metricas: {
        metrosPerforados: number;
        horasTotales: number;
        litrosDiesel: number;
        barrenos: number;
        pctAvance: number | null;
        montoFacturado: number;
        costoInsumos: number;
    };
    resumenFinanciero?: {
        facturado: number;
        costoProduccion: number;
        gastosAdicionales: number;
        costoInsumos: number;
        costoTotal: number;
        utilidad: number;
        margenPct: number | null;
        costoPorMetro: number | null;
    };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
    ACTIVA:    'bg-green-100 text-green-700',
    PAUSADA:   'bg-yellow-100 text-yellow-700',
    TERMINADA: 'bg-gray-100 text-gray-500',
};
const CORTE_STATUS_STYLE: Record<string, string> = {
    BORRADOR:  'bg-gray-100 text-gray-600',
    FACTURADO: 'bg-blue-100 text-blue-700',
    COBRADO:   'bg-green-100 text-green-700',
};

const fmt   = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
const fmt2  = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fDate = (s: string) => new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── Modal Regularizar registros sin plantilla ────────────────────────────────
type PlantillaElegible = {
    id: string;
    numero: number;
    status: 'ACTIVA' | 'PAUSADA';
    metrosContratados: number;
    metrosUsados: number;
    capacidadDisponible: number;
    elegible: boolean;
    precioUnitario: number | null;
    moneda: string;
    fechaInicio: string | null;
    fechaFin: string | null;
    notas: string | null;
};

type RegistroSinPlantilla = {
    id: string;
    fecha: string;
    barrenos: number | null;
    metrosLineales: number;
    equipo: { nombre: string; numeroEconomico: string | null } | null;
};

type RegularizarData = {
    registrosSinPlantilla: number;
    metrosSinPlantilla: number;
    plantillasElegibles: PlantillaElegible[];
    registros: RegistroSinPlantilla[];
};

function RegularizarModal({
    obraId,
    metrosSinPlantilla,
    onClose,
    onSaved,
}: {
    obraId: string;
    metrosSinPlantilla: number;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [datos, setDatos] = useState<RegularizarData | null>(null);
    const [loadingDatos, setLoadingDatos] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form nueva plantilla
    const [formNueva, setFormNueva] = useState({
        numero: '',
        metrosContratados: '',
        precioUnitario: '',
        moneda: 'MXN',
        fechaInicio: '',
        fechaFin: '',
        notas: '',
    });

    // Opción avanzada: selección parcial
    const [seleccionParcialActiva, setSeleccionParcialActiva] = useState(false);
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchApi(`/obras/${obraId}/regularizar`)
            .then((d: RegularizarData) => setDatos(d))
            .catch(() => setError('No se pudieron cargar los datos'))
            .finally(() => setLoadingDatos(false));
    }, [obraId]);

    const registros = datos?.registros ?? [];

    const setNueva = (key: keyof typeof formNueva) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setFormNueva(f => ({ ...f, [key]: e.target.value }));

    const inpNueva = (label: string, key: keyof typeof formNueva, type = 'text', placeholder = '') => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input
                type={type}
                value={String(formNueva[key])}
                onChange={setNueva(key)}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
        </div>
    );

    const toggleRegistro = (id: string) => {
        setSeleccionados(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleTodos = () => {
        if (seleccionados.size === registros.length) {
            setSeleccionados(new Set());
        } else {
            setSeleccionados(new Set(registros.map(r => r.id)));
        }
    };

    const metrosSeleccionados = registros
        .filter(r => seleccionados.has(r.id))
        .reduce((s, r) => s + r.metrosLineales, 0);

    const handleCrearYAsignar = async () => {
        if (!formNueva.numero || !formNueva.metrosContratados) {
            setError('Número y metros contratados son requeridos');
            return;
        }
        // Si selección parcial activa pero sin registros seleccionados, el botón ya está deshabilitado
        setSaving(true); setError('');
        try {
            const body: Record<string, unknown> = {
                crearPlantilla: {
                    numero:            Number(formNueva.numero),
                    metrosContratados: Number(formNueva.metrosContratados),
                    precioUnitario:    formNueva.precioUnitario ? Number(formNueva.precioUnitario) : null,
                    moneda:            formNueva.moneda,
                    fechaInicio:       formNueva.fechaInicio || null,
                    fechaFin:          formNueva.fechaFin    || null,
                    notas:             formNueva.notas       || null,
                },
            };
            // Solo enviar registroIds si la selección parcial está activa
            if (seleccionParcialActiva && seleccionados.size > 0) {
                body.registroIds = Array.from(seleccionados);
            }
            const res = await fetchApi(`/obras/${obraId}/regularizar`, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            setSuccess(`Plantilla creada y ${res.registrosActualizados} registro${res.registrosActualizados !== 1 ? 's' : ''} asignado${res.registrosActualizados !== 1 ? 's' : ''}`);
            setTimeout(() => { onSaved(); }, 1200);
        } catch (e: any) {
            setError(e.message || 'Error al crear plantilla');
        } finally {
            setSaving(false);
        }
    };

    const botonDeshabilitado = saving || (seleccionParcialActiva && seleccionados.size === 0);

    const labelBoton = () => {
        if (saving) return 'Guardando...';
        if (seleccionParcialActiva && seleccionados.size > 0) {
            return `Crear y asignar ${seleccionados.size} registro${seleccionados.size !== 1 ? 's' : ''}`;
        }
        return 'Crear y asignar';
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="border-b border-gray-100 px-6 pt-6 pb-4 flex-shrink-0 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Crear nueva plantilla</h2>
                        {!loadingDatos && (
                            <p className="text-xs text-gray-400 mt-0.5">
                                {datos?.registrosSinPlantilla ?? 0} registro{(datos?.registrosSinPlantilla ?? 0) !== 1 ? 's' : ''} sin plantilla
                                · {metrosSinPlantilla.toFixed(1)} m
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 px-6">
                            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 size={28} className="text-green-600" />
                            </div>
                            <p className="text-base font-semibold text-gray-800 text-center">{success}</p>
                            <p className="text-xs text-gray-400 text-center">Recargando vista...</p>
                        </div>
                    ) : (
                        <div className="px-6 py-5 space-y-4">

                            {/* ── Formulario principal ── */}
                            <div className="grid grid-cols-2 gap-3">
                                {inpNueva('Número de plantilla', 'numero', 'number', 'ej. 3')}
                                {inpNueva('Metros contratados', 'metrosContratados', 'number', 'ej. 500')}
                                {inpNueva('Precio unitario (P.U.)', 'precioUnitario', 'number', 'ej. 24.50')}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
                                    <select
                                        value={formNueva.moneda}
                                        onChange={setNueva('moneda')}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="MXN">MXN</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>
                                {inpNueva('Fecha inicio', 'fechaInicio', 'date')}
                                {inpNueva('Fecha fin', 'fechaFin', 'date')}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                                <textarea
                                    value={formNueva.notas}
                                    onChange={e => setFormNueva(f => ({ ...f, notas: e.target.value }))}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none resize-none"
                                    placeholder="Opcional"
                                />
                            </div>

                            {/* ── Separador y opción avanzada ── */}
                            <div className="border-t border-gray-100 pt-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSeleccionParcialActiva(v => !v);
                                        setSeleccionados(new Set());
                                        setError('');
                                    }}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors select-none"
                                >
                                    {/* Toggle visual */}
                                    <span className={`relative inline-flex h-4 w-7 flex-shrink-0 rounded-full transition-colors duration-200 ${seleccionParcialActiva ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                        <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${seleccionParcialActiva ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                    </span>
                                    <span>Seleccionar registros específicos</span>
                                </button>

                                {/* ── Lista de registros (solo si activado) ── */}
                                {seleccionParcialActiva && (
                                    <div className="mt-3 space-y-2">
                                        {loadingDatos ? (
                                            <p className="text-xs text-gray-400 text-center py-4">Cargando registros...</p>
                                        ) : registros.length === 0 ? (
                                            <p className="text-xs text-gray-400 text-center py-4">No hay registros sin plantilla</p>
                                        ) : (
                                            <>
                                                {/* Resumen + Seleccionar todos */}
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-gray-500">
                                                        {seleccionados.size} de {registros.length} seleccionado{seleccionados.size !== 1 ? 's' : ''}
                                                        {seleccionados.size > 0 && (
                                                            <span className="text-blue-600 font-medium"> · {metrosSeleccionados.toFixed(1)} m</span>
                                                        )}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={toggleTodos}
                                                        className="text-xs text-blue-600 hover:underline"
                                                    >
                                                        {seleccionados.size === registros.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                                    </button>
                                                </div>

                                                {/* Registros */}
                                                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                                    {registros.map(r => {
                                                        const checked = seleccionados.has(r.id);
                                                        return (
                                                            <label
                                                                key={r.id}
                                                                className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                                                    checked
                                                                        ? 'border-blue-300 bg-blue-50'
                                                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggleRegistro(r.id)}
                                                                    className="accent-blue-600 flex-shrink-0"
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-xs font-medium text-gray-700">
                                                                        {fDate(r.fecha)}
                                                                    </span>
                                                                    {r.equipo && (
                                                                        <span className="text-xs text-gray-400 ml-2">
                                                                            {r.equipo.nombre}{r.equipo.numeroEconomico ? ` (${r.equipo.numeroEconomico})` : ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs font-medium text-emerald-600 flex-shrink-0">
                                                                    {r.metrosLineales.toFixed(1)} m
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Info según modo */}
                                {!seleccionParcialActiva && (
                                    <p className="text-xs text-gray-400 mt-2">
                                        Se asignarán <strong>todos</strong> los registros sin plantilla al guardar.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <p className="text-xs text-red-500 px-6 pb-2 flex-shrink-0">{error}</p>
                )}

                {/* Mensaje de validación de selección parcial */}
                {seleccionParcialActiva && seleccionados.size === 0 && !success && (
                    <p className="text-xs text-amber-500 px-6 pb-2 flex-shrink-0">
                        Selecciona al menos un registro
                    </p>
                )}

                {/* Footer */}
                {!success && (
                    <div className="border-t border-gray-100 px-6 py-4 flex gap-2 flex-shrink-0">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCrearYAsignar}
                            disabled={botonDeshabilitado}
                            className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {labelBoton()}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Modal Corte de Facturación (replica hoja Plantilla) ──────────────────────
function CorteModal({
    obraId, obra, corte, onClose, onSaved,
}: {
    obraId: string;
    obra: ObraDetalle;
    corte?: Corte;
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEdit = !!corte;

    // Paso del modal: 1 = selección de registros, 2 = dimensiones y facturación
    const [paso, setPaso] = useState<1 | 2>(isEdit ? 2 : 1);

    // Registros disponibles (solo en creación)
    const [registrosDisponibles, setRegistrosDisponibles] = useState<RegistroDisponible[]>([]);
    const [loadingRegistros, setLoadingRegistros]         = useState(!isEdit);
    const [seleccionados, setSeleccionados]               = useState<Set<string>>(new Set());

    // Form de dimensiones/facturación
    const [form, setForm] = useState({
        bordo:             corte?.bordo?.toString()             ?? (obra.bordo?.toString()              ?? ''),
        espesor:           corte?.espesor?.toString()           ?? (obra.espesor?.toString()            ?? ''),
        profundidadCollar: corte?.profundidadCollar?.toString()
                           ?? ((obra as any).profundidadCollar?.toString() ?? ''),
        perdidaM3:         corte?.perdidaM3?.toString()         ?? '0',
        precioUnitario:    corte?.precioUnitario?.toString()    ?? (obra.precioUnitario?.toString() ?? ''),
        moneda:            corte?.moneda                        ?? obra.moneda ?? 'MXN',
        status:            corte?.status                        ?? 'BORRADOR',
        notas:             corte?.notas                         ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    // Cargar registros disponibles al abrir (solo creación)
    useEffect(() => {
        if (isEdit) return;
        fetchApi(`/obras/${obraId}/cortes?disponibles=true`)
            .then(setRegistrosDisponibles)
            .catch(() => setRegistrosDisponibles([]))
            .finally(() => setLoadingRegistros(false));
    }, [obraId, isEdit]);

    const toggleRegistro = (id: string) => {
        setSeleccionados(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleTodos = () => {
        if (seleccionados.size === registrosDisponibles.length) {
            setSeleccionados(new Set());
        } else {
            setSeleccionados(new Set(registrosDisponibles.map(r => r.id)));
        }
    };

    // Totales calculados de los registros seleccionados
    const registrosSeleccionados = registrosDisponibles.filter(r => seleccionados.has(r.id));
    const barrenosTotal = registrosSeleccionados.reduce((s, r) => s + r.barrenos, 0);
    const metrosTotal   = +registrosSeleccionados.reduce((s, r) => s + r.metrosLineales, 0).toFixed(2);
    const fechaMin      = registrosSeleccionados.length > 0
        ? registrosSeleccionados.map(r => r.fecha).sort()[0]
        : null;
    const fechaMax      = registrosSeleccionados.length > 0
        ? registrosSeleccionados.map(r => r.fecha).sort().at(-1)!
        : null;

    // Cálculos de volumen en tiempo real (paso 2)
    const bordoN    = Number(form.bordo)             || 0;
    const espesorN  = Number(form.espesor)           || 0;
    const collarN   = Number(form.profundidadCollar) || 0;
    const puN       = Number(form.precioUnitario)    || 0;

    const barrenosN = isEdit ? (corte?.barrenos ?? 0) : barrenosTotal;
    const metrosN   = isEdit ? (corte?.metrosLineales ?? 0) : metrosTotal;

    const modoAutomatico = collarN > 0 && bordoN > 0 && espesorN > 0;
    const perdidaAuto    = modoAutomatico
        ? +(barrenosN * collarN * bordoN * espesorN).toFixed(4)
        : null;
    const perdidaNum     = modoAutomatico ? perdidaAuto! : (Number(form.perdidaM3) || 0);
    const volBruto       = bordoN && espesorN ? +(bordoN * espesorN * metrosN).toFixed(4) : null;
    const volNeto        = volBruto != null   ? +(volBruto - perdidaNum).toFixed(4)        : null;
    const monto          = volNeto  != null && puN ? +(volNeto * puN).toFixed(2)           : null;

    const fmt2 = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const fDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });

    const set = (key: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setForm(f => ({ ...f, [key]: e.target.value }));

    const inp = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input type={type} value={String(form[key])} onChange={set(key)} placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
        </div>
    );

    const handleSave = async () => {
        if (!isEdit && seleccionados.size === 0) {
            setError('Selecciona al menos un registro diario');
            return;
        }
        setSaving(true); setError('');
        try {
            if (isEdit) {
                // Editar: solo actualiza dimensiones, pérdida, precio, status
                await fetchApi(`/obras/${obraId}/cortes/${corte!.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        ...form,
                        bordo:             form.bordo      ? Number(form.bordo)      : null,
                        espesor:           form.espesor    ? Number(form.espesor)    : null,
                        profundidadCollar: form.profundidadCollar ? Number(form.profundidadCollar) : null,
                        perdidaM3:         modoAutomatico ? undefined : (Number(form.perdidaM3) || 0),
                        precioUnitario:    form.precioUnitario ? Number(form.precioUnitario) : null,
                    }),
                });
            } else {
                // Crear: envía registroIds y dimensiones
                await fetchApi(`/obras/${obraId}/cortes`, {
                    method: 'POST',
                    body: JSON.stringify({
                        registroIds:       Array.from(seleccionados),
                        bordo:             form.bordo      ? Number(form.bordo)      : null,
                        espesor:           form.espesor    ? Number(form.espesor)    : null,
                        profundidadCollar: form.profundidadCollar ? Number(form.profundidadCollar) : null,
                        perdidaM3:         modoAutomatico ? undefined : (Number(form.perdidaM3) || 0),
                        precioUnitario:    form.precioUnitario ? Number(form.precioUnitario) : null,
                        moneda:            form.moneda,
                        status:            form.status,
                        notas:             form.notas,
                    }),
                });
            }
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    // ── PASO 1: Selector de registros (agrupado por Plantilla → Equipo) ──────────
    const renderPaso1 = () => {
        // Agrupar: plantillaKey → equipoKey → registros
        type Grupo = {
            plantillaId: string | null;
            plantillaLabel: string;
            equipos: {
                equipoKey: string;
                equipoLabel: string;
                registros: RegistroDisponible[];
            }[];
        };

        const gruposMap: Map<string, Grupo> = new Map();
        for (const r of registrosDisponibles) {
            const pKey = r.plantillaId ?? '__sin_plantilla__';

            // Buscar los datos de la plantilla en obra.plantillas para enriquecer el label
            const plantillaInfo = r.plantillaNumero != null
                ? obra.plantillas?.find(p => p.numero === r.plantillaNumero)
                : null;

            let pLabel: string;
            if (r.plantillaNumero != null) {
                const inicio = plantillaInfo?.fechaInicio
                    ? fDate(String(plantillaInfo.fechaInicio).slice(0, 10))
                    : null;
                const fin = plantillaInfo?.fechaFin
                    ? fDate(String(plantillaInfo.fechaFin).slice(0, 10))
                    : null;
                const rango  = inicio && fin ? ` · ${inicio} – ${fin}` : inicio ? ` · desde ${inicio}` : '';
                pLabel = `Plantilla ${r.plantillaNumero}${rango}`;
            } else {
                pLabel = 'Sin plantilla asignada';
            }

            if (!gruposMap.has(pKey)) {
                gruposMap.set(pKey, { plantillaId: r.plantillaId, plantillaLabel: pLabel, equipos: [] });
            }
            const grupo = gruposMap.get(pKey)!;
            const eKey = r.equipo.nombre + (r.equipo.numeroEconomico ?? '');
            let eq = grupo.equipos.find(e => e.equipoKey === eKey);
            if (!eq) {
                const label = r.equipo.nombre + (r.equipo.numeroEconomico ? ` (${r.equipo.numeroEconomico})` : '');
                eq = { equipoKey: eKey, equipoLabel: label, registros: [] };
                grupo.equipos.push(eq);
            }
            eq.registros.push(r);
        }
        const grupos = Array.from(gruposMap.values());

        // Toggle todos los registros de un equipo
        const toggleEquipo = (ids: string[]) => {
            const allChecked = ids.every(id => seleccionados.has(id));
            setSeleccionados(prev => {
                const next = new Set(prev);
                ids.forEach(id => allChecked ? next.delete(id) : next.add(id));
                return next;
            });
        };

        // Toggle todos los de una plantilla
        const togglePlantilla = (ids: string[]) => {
            const allChecked = ids.every(id => seleccionados.has(id));
            setSeleccionados(prev => {
                const next = new Set(prev);
                ids.forEach(id => allChecked ? next.delete(id) : next.add(id));
                return next;
            });
        };

        return (
        <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Registros diarios disponibles ({registrosDisponibles.length})
                </p>
                {registrosDisponibles.length > 0 && (
                    <button onClick={toggleTodos}
                        className="text-xs text-blue-600 hover:underline">
                        {seleccionados.size === registrosDisponibles.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </button>
                )}
            </div>

            {loadingRegistros ? (
                <div className="text-center py-8 text-gray-400 text-sm">Cargando registros...</div>
            ) : registrosDisponibles.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <p className="text-sm font-semibold text-gray-500">No hay registros pendientes</p>
                    <p className="text-xs text-gray-400 mt-1">Todos los registros de esta obra ya tienen corte asignado.</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {grupos.map(grupo => {
                        const plantillaIds = grupo.equipos.flatMap(e => e.registros.map(r => r.id));
                        const plantillaCheckedCount = plantillaIds.filter(id => seleccionados.has(id)).length;
                        const plantillaAllChecked = plantillaCheckedCount === plantillaIds.length;
                        const plantillaSomeChecked = plantillaCheckedCount > 0 && !plantillaAllChecked;

                        return (
                            <div key={grupo.plantillaId ?? '__sin_plantilla__'} className="border border-gray-100 rounded-xl overflow-hidden">
                                {/* Header de plantilla */}
                                <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={plantillaAllChecked}
                                            ref={el => { if (el) el.indeterminate = plantillaSomeChecked; }}
                                            onChange={() => togglePlantilla(plantillaIds)}
                                            className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
                                        />
                                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                            <FileText size={11} className="text-purple-500" />
                                            {grupo.plantillaLabel}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {plantillaCheckedCount}/{plantillaIds.length} seleccionados
                                    </span>
                                </div>

                                {/* Equipos dentro de la plantilla */}
                                <div className="divide-y divide-gray-50">
                                    {grupo.equipos.map(eq => {
                                        const eqIds = eq.registros.map(r => r.id);
                                        const eqChecked = eqIds.every(id => seleccionados.has(id));
                                        const eqSome = eqIds.some(id => seleccionados.has(id)) && !eqChecked;
                                        const eqMetros = eq.registros.reduce((s, r) => s + r.metrosLineales, 0);
                                        const eqBarrenos = eq.registros.reduce((s, r) => s + r.barrenos, 0);

                                        return (
                                            <div key={eq.equipoKey} className="bg-white">
                                                {/* Sub-header del equipo */}
                                                <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50/50">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={eqChecked}
                                                            ref={el => { if (el) el.indeterminate = eqSome; }}
                                                            onChange={() => toggleEquipo(eqIds)}
                                                            className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
                                                        />
                                                        <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                                                            <Wrench size={10} />
                                                            {eq.equipoLabel}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-gray-400">
                                                        {eqBarrenos} bar · {eqMetros.toFixed(1)} m
                                                    </span>
                                                </div>

                                                {/* Registros del equipo */}
                                                <div className="px-3 py-1 space-y-1">
                                                    {eq.registros.map(r => {
                                                        const checked = seleccionados.has(r.id);
                                                        return (
                                                            <label key={r.id}
                                                                className={`flex items-center gap-3 px-2 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                                                                    checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:border-gray-200'
                                                                }`}>
                                                                <input type="checkbox" checked={checked}
                                                                    onChange={() => toggleRegistro(r.id)}
                                                                    className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0" />
                                                                <div className="flex-1 flex items-center justify-between gap-2">
                                                                    <span className="text-xs font-semibold text-gray-700">{fDate(r.fecha)}</span>
                                                                    <div className="flex gap-3 text-xs text-gray-400">
                                                                        <span>{r.barrenos} bar</span>
                                                                        <span>{r.metrosLineales.toFixed(1)} m</span>
                                                                    </div>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Resumen de selección */}
            {seleccionados.size > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 text-xs space-y-1">
                    <p className="font-semibold text-blue-700">{seleccionados.size} registro{seleccionados.size !== 1 ? 's' : ''} seleccionado{seleccionados.size !== 1 ? 's' : ''}</p>
                    <div className="flex gap-6 text-gray-600 mt-1">
                        <span>Período: <strong>{fechaMin ? fDate(fechaMin) : '—'} → {fechaMax ? fDate(fechaMax) : '—'}</strong></span>
                        <span>Barrenos: <strong>{barrenosTotal}</strong></span>
                        <span>Metros: <strong>{metrosTotal.toFixed(1)} m</strong></span>
                    </div>
                </div>
            )}
        </div>
    );
    };

    // ── PASO 2: Dimensiones y facturación ─────────────────────────────────────
    const renderPaso2 = () => (
        <div className="px-6 py-5 space-y-5">
            {/* Resumen del período (informativo) */}
            {!isEdit && (
                <div className="bg-gray-50 rounded-xl p-4 text-xs">
                    <p className="font-semibold text-gray-600 mb-1">Producción del corte (de registros)</p>
                    <div className="flex gap-6 text-gray-500">
                        <span>Período: <strong className="text-gray-700">{fechaMin ? fDate(fechaMin) : '—'} → {fechaMax ? fDate(fechaMax) : '—'}</strong></span>
                        <span>Barrenos: <strong className="text-gray-700">{barrenosTotal}</strong></span>
                        <span>Metros: <strong className="text-gray-700">{metrosTotal.toFixed(1)} m</strong></span>
                    </div>
                </div>
            )}
            {isEdit && (
                <div className="bg-gray-50 rounded-xl p-4 text-xs">
                    <p className="font-semibold text-gray-600 mb-1">Producción del corte</p>
                    <div className="flex gap-6 text-gray-500">
                        <span>Barrenos: <strong className="text-gray-700">{corte!.barrenos}</strong></span>
                        <span>Metros: <strong className="text-gray-700">{corte!.metrosLineales.toFixed(1)} m</strong></span>
                        <span className="text-gray-400">{corte!.registros.length} registro{corte!.registros.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            )}

            {/* Dimensiones */}
            <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cálculo de volumen</p>
                <div className="grid grid-cols-2 gap-3">
                    {inp('Bordo (m)',   'bordo',   'number', '2.7')}
                    {inp('Espesor (m)', 'espesor', 'number', '3.0')}
                </div>
                <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        Profundidad de collar (m)
                        <span className="ml-1 text-gray-400 font-normal">— vacío = pérdida manual</span>
                    </label>
                    <input type="number" value={form.profundidadCollar} onChange={set('profundidadCollar')}
                        placeholder="ej. 0.30"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                {!modoAutomatico && (
                    <div className="mt-3">
                        {inp('Pérdida m³ (manual — "% Perd." del Excel)', 'perdidaM3', 'number', '39.69')}
                    </div>
                )}
                {/* Vista previa */}
                <div className="mt-3 bg-blue-50 rounded-xl p-4 space-y-1.5 text-xs">
                    <p className="text-gray-500 font-semibold mb-2">Vista previa</p>
                    {modoAutomatico && (
                        <div className="flex justify-between text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 mb-2">
                            <span>Pérdida auto = {barrenosN} bar × {collarN} m × {bordoN} × {espesorN}</span>
                            <span className="font-bold">{fmt2(perdidaAuto!)} m³</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-gray-500">Vol. bruto = {bordoN} × {espesorN} × {metrosN} mt ln</span>
                        <span className="font-bold text-gray-700">{volBruto !== null ? `${fmt2(volBruto)} m³` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Vol. neto (−{fmt2(perdidaNum)} m³)</span>
                        <span className="font-bold text-gray-700">{volNeto !== null ? `${fmt2(volNeto)} m³` : '—'}</span>
                    </div>
                    <div className="flex justify-between border-t border-blue-100 pt-1.5">
                        <span className="text-gray-500">Monto = Vol. neto × ${puN}/m³</span>
                        <span className="font-bold text-blue-700 text-sm">{monto !== null ? `$${fmt2(monto)}` : '—'}</span>
                    </div>
                </div>
            </div>

            {/* Facturación */}
            <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Facturación</p>
                <div className="grid grid-cols-2 gap-3">
                    {inp('Precio unitario (P.U.)', 'precioUnitario', 'number', '24.50')}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
                        <select value={form.moneda} onChange={set('moneda')}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                            <option value="MXN">MXN</option>
                            <option value="USD">USD</option>
                        </select>
                    </div>
                </div>
                <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select value={form.status} onChange={set('status')}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option value="BORRADOR">Borrador</option>
                        <option value="FACTURADO">Facturado</option>
                        <option value="COBRADO">Cobrado</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                    rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none resize-none" />
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-2xl flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-800">
                        {isEdit ? `Editar Corte #${corte!.numero}` : 'Nuevo Corte de Facturación'}
                    </h2>
                    {!isEdit && (
                        <div className="flex items-center gap-2 mt-2">
                            <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${paso === 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${paso === 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'}`}>1</span>
                                Seleccionar registros
                            </div>
                            <div className="h-px flex-1 bg-gray-200" />
                            <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${paso === 2 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${paso === 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'}`}>2</span>
                                Dimensiones y precio
                            </div>
                        </div>
                    )}
                </div>

                {/* Body scrollable */}
                <div className="overflow-y-auto flex-1">
                    {!isEdit && paso === 1 ? renderPaso1() : renderPaso2()}
                </div>

                {error && <p className="text-xs text-red-500 px-6 pb-2 flex-shrink-0">{error}</p>}

                {/* Footer */}
                <div className="border-t border-gray-100 px-6 py-4 rounded-b-2xl flex gap-2 flex-shrink-0">
                    {!isEdit && paso === 2 ? (
                        <>
                            <button onClick={() => setPaso(1)}
                                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                                ← Atrás
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50">
                                {saving ? 'Guardando...' : 'Crear corte'}
                            </button>
                        </>
                    ) : !isEdit ? (
                        <>
                            <button onClick={onClose}
                                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (seleccionados.size === 0) { setError('Selecciona al menos un registro'); return; }
                                    setError('');
                                    setPaso(2);
                                }}
                                disabled={seleccionados.size === 0}
                                className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-40">
                                Siguiente → ({seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''})
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={onClose}
                                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                                Cancelar
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50">
                                {saving ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Tab Operación ────────────────────────────────────────────────────────────
function TabOperacion({ obraId, obra }: { obraId: string; obra: ObraDetalle }) {
    const [registros, setRegistros] = useState<RegistroDiario[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [expanded,  setExpanded]  = useState<string | null>(null);

    useEffect(() => {
        fetchApi(`/registros-diarios?obraId=${obraId}`)
            .then(setRegistros)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [obraId]);

    if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Cargando registros...</div>;

    const plantillas = obra.plantillas ?? [];

    // ── Agrupar registros por plantillaId explícito ──────────────────────────
    // Usamos el campo plantillaId del registro (asignado al momento de crear).
    // Si es null, cae en "Sin plantilla asignada".
    const plantillasOrdenadas = [...plantillas].sort((a, b) => a.numero - b.numero);
    const grupos: { plantilla: PlantillaObraDetalle | null; regs: RegistroDiario[] }[] = plantillasOrdenadas.map(p => ({
        plantilla: p,
        regs: registros.filter(r => r.plantillaId === p.id),
    }));

    // Registros sin plantillaId asignado (registros antiguos o sin obra con plantillas)
    const sinPlantilla = registros.filter(r => !r.plantillaId || !plantillasOrdenadas.some(p => p.id === r.plantillaId));
    if (sinPlantilla.length > 0) grupos.push({ plantilla: null, regs: sinPlantilla });

    // ── Tabla de registros reutilizable ──────────────────────────────────────
    const renderTabla = (regs: RegistroDiario[], colorAccent: string) => (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
                <thead>
                    <tr className="border-b border-gray-100">
                        <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Fecha</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase">Equipo</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase text-right">H. Ini</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase text-right">H. Fin</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase text-right">Horas</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase text-right">Barrenos</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase text-right">Metros</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase text-right">Prof./Bar.</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase text-right">Diésel</th>
                        <th className="px-3 py-2 w-8"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {regs.map(r => {
                        const profProm = r.barrenos > 0 ? (r.metrosLineales / r.barrenos) : null;
                        return (
                            <>
                                <tr key={r.id}
                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                                    <td className="px-3 py-2.5 text-gray-700 font-medium">{fDate(r.fecha)}</td>
                                    <td className="px-3 py-2.5 text-gray-500">{r.equipo.nombre}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-400 font-mono text-xs">{r.horometroInicio ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-400 font-mono text-xs">{r.horometroFin ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-right font-semibold text-gray-700">{r.horasTrabajadas} hrs</td>
                                    <td className="px-3 py-2.5 text-right text-gray-700">{r.barrenos}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-700">{r.metrosLineales.toFixed(1)} m</td>
                                    <td className="px-3 py-2.5 text-right text-gray-400 text-xs">{profProm ? `${profProm.toFixed(2)} m` : '—'}</td>
                                    <td className="px-3 py-2.5 text-right text-blue-600">{r.litrosDiesel} lt</td>
                                    <td className="px-3 py-2.5 text-gray-400">
                                        {expanded === r.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                    </td>
                                </tr>
                                {expanded === r.id && (() => {
                                    const ltHr      = r.horasTrabajadas > 0 ? r.litrosDiesel / r.horasTrabajadas : null;
                                    const ltMt      = r.metrosLineales  > 0 ? r.litrosDiesel / r.metrosLineales  : null;
                                    const mtHr      = r.horasTrabajadas > 0 ? r.metrosLineales / r.horasTrabajadas : null;
                                    const costoDiesel = r.litrosDiesel * r.precioDiesel;
                                    const profProm  = r.barrenos > 0 ? r.metrosLineales / r.barrenos : null;
                                    return (
                                        <tr key={`${r.id}-exp`} className="bg-slate-50/60">
                                            <td colSpan={10} className="px-6 py-4 border-b border-gray-100">
                                                <RegistroDiarioExpandido
                                                    data={{
                                                        horometroInicio:     r.horometroInicio,
                                                        horometroFin:        r.horometroFin,
                                                        horasTrabajadas:     r.horasTrabajadas,
                                                        operadores:          r.operadores,
                                                        peones:              r.peones,
                                                        kpi: {
                                                            litrosPorHora:  ltHr != null ? +ltHr.toFixed(2) : null,
                                                            litrosPorMetro: ltMt != null ? +ltMt.toFixed(2) : null,
                                                            metrosPorHora:  mtHr != null ? +mtHr.toFixed(2) : null,
                                                        },
                                                        litrosDiesel:        r.litrosDiesel,
                                                        precioDiesel:        r.precioDiesel,
                                                        costoDiesel,
                                                        notas:               null,
                                                        bordo:               null,
                                                        espaciamiento:       null,
                                                        profundidadPromedio: profProm != null ? +profProm.toFixed(2) : null,
                                                        volumenRoca:         null,
                                                        porcentajePerdida:   null,
                                                        porcentajeAvance:    null,
                                                        rentaEquipoDiaria:   r.rentaEquipoDiaria,
                                                    }}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })()}
                            </>
                        );
                    })}
                </tbody>
                {/* Subtotales del grupo */}
                <tfoot>
                    <tr className={`border-t border-gray-200 ${colorAccent}`}>
                        <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-gray-500">
                            {regs.length} registro{regs.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-gray-700">
                            {regs.reduce((s, r) => s + r.horasTrabajadas, 0)} hrs
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-gray-700">
                            {regs.reduce((s, r) => s + r.barrenos, 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-gray-700">
                            {regs.reduce((s, r) => s + r.metrosLineales, 0).toFixed(1)} m
                        </td>
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-blue-600">
                            {regs.reduce((s, r) => s + r.litrosDiesel, 0).toLocaleString()} lt
                        </td>
                        <td className="px-3 py-2"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );

    return (
        <div className="space-y-3">

            {/* Botón nuevo registro */}
            <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-gray-700">
                    Registros diarios ({registros.length})
                </p>
                <Link href={`/dashboard/registros-diarios/new?obraId=${obraId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus size={13} /> Nuevo registro
                </Link>
            </div>

            {registros.length === 0 && plantillas.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">Sin registros diarios para esta obra.</div>
            )}

            {/* Un bloque por plantilla */}
            {grupos.map((g, gi) => {
                const p = g.plantilla;

                // Calcular métricas de este grupo para las barras
                const mRegs = g.regs.reduce((s, r) => s + r.metrosLineales, 0);
                const bRegs = g.regs.reduce((s, r) => s + r.barrenos, 0);
                const metaM = p?.metrosContratados ?? 0;
                const metaB = p?.barrenos ?? 0;
                const pctM  = metaM > 0 ? Math.min(100, (mRegs / metaM) * 100) : null;
                const pctB  = metaB > 0 ? Math.min(100, (bRegs / metaB) * 100) : null;
                const completa = pctM !== null && pctM >= 100 && (metaB === 0 || (pctB !== null && pctB >= 100));
                const enProgreso = !completa && g.regs.length > 0;

                const borderColor = p === null
                    ? 'border-gray-200'
                    : completa
                        ? 'border-green-300'
                        : enProgreso
                            ? 'border-blue-300'
                            : 'border-gray-200';

                const headerBg = p === null
                    ? 'bg-gray-50'
                    : completa
                        ? 'bg-green-50'
                        : enProgreso
                            ? 'bg-blue-50'
                            : 'bg-gray-50';

                const badgeStyle = p === null
                    ? 'bg-gray-100 text-gray-500'
                    : completa
                        ? 'bg-green-100 text-green-700'
                        : enProgreso
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-500';

                const badgeLabel = p === null
                    ? 'Sin plantilla'
                    : completa
                        ? '✓ Completa'
                        : enProgreso
                            ? 'En progreso'
                            : 'Pendiente';

                const avatarStyle = p === null
                    ? 'bg-gray-200 text-gray-500'
                    : completa
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700';

                return (
                    <div key={gi} className={`rounded-xl border ${borderColor} overflow-hidden`}>

                        {/* Header de plantilla */}
                        <div className={`${headerBg} px-4 py-3`}>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${avatarStyle}`}>
                                        {p ? `P${p.numero}` : '—'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">
                                            {p ? `Plantilla ${p.numero}` : 'Sin plantilla asignada'}
                                        </p>
                                        {p && (p.fechaInicio || p.fechaFin) && (
                                            <p className="text-xs text-gray-400">
                                                {p.fechaInicio && fDate(p.fechaInicio)}
                                                {p.fechaFin && ` → ${fDate(p.fechaFin)}`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStyle}`}>
                                    {badgeLabel}
                                </span>
                            </div>

                            {/* Barras de progreso si hay plantilla */}
                            {p && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                                    {/* Metros */}
                                    {metaM > 0 && (
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-500">Metros</span>
                                                <span className={`font-semibold ${completa ? 'text-green-600' : 'text-blue-600'}`}>
                                                    {mRegs.toFixed(1)} / {metaM} m
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/70 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${pctM! >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${pctM}%` }} />
                                            </div>
                                            {!completa && pctM! < 100 && (
                                                <p className="text-xs text-orange-500 mt-0.5">
                                                    Faltan {(metaM - mRegs).toFixed(1)} m · {pctM!.toFixed(1)}% completado
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    {/* Barrenos */}
                                    {metaB > 0 && (
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-500">Barrenos</span>
                                                <span className={`font-semibold ${(pctB ?? 0) >= 100 ? 'text-green-600' : 'text-blue-600'}`}>
                                                    {bRegs} / {metaB}
                                                    {(pctB ?? 0) < 100 && (
                                                        <span className="text-gray-400 font-normal"> (faltan {metaB - bRegs})</span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/70 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${(pctB ?? 0) >= 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                                                    style={{ width: `${pctB ?? 0}%` }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Tabla de registros del grupo */}
                        {g.regs.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-gray-400 bg-white">
                                Sin registros para esta plantilla — agrega el primer día
                            </div>
                        ) : (
                            renderTabla(g.regs, 'bg-gray-50')
                        )}
                    </div>
                );
            })}

            {/* Si no hay plantillas, mostrar tabla plana global */}
            {plantillas.length === 0 && registros.length > 0 && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                    {renderTabla(registros, 'bg-gray-50')}
                </div>
            )}
        </div>
    );
}

// ─── Modal Editar Plantilla ───────────────────────────────────────────────────
function EditarPlantillaModal({
    plantilla,
    obraId,
    equiposObra,
    onClose,
    onSaved,
    abrirEnEquipos,
}: {
    plantilla: PlantillaObraDetalle;
    obraId: string;
    equiposObra: ObraEquipo[];
    onClose: () => void;
    onSaved: () => void;
    abrirEnEquipos?: boolean;
}) {
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState('');
    const [success, setSuccess] = useState('');

    // Campos editables
    const [form, setForm] = useState({
        metrosContratados: String(plantilla.metrosContratados),
        precioUnitario:    plantilla.precioUnitario != null ? String(plantilla.precioUnitario) : '',
        fechaInicio:       plantilla.fechaInicio ? String(plantilla.fechaInicio).slice(0, 10) : '',
        fechaFin:          plantilla.fechaFin    ? String(plantilla.fechaFin).slice(0, 10)    : '',
        notas:             plantilla.notas ?? '',
    });

    // Equipos asignados a esta plantilla
    const equiposAsignados = new Set((plantilla.plantillaEquipos ?? []).map(pe => pe.equipoId));
    const [selEquipos, setSelEquipos] = useState<Set<string>>(new Set(equiposAsignados));

    // Equipos activos de la obra disponibles para asignar
    const equiposDisponibles = equiposObra.filter(oe => !oe.fechaFin);

    const setF = (key: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setForm(f => ({ ...f, [key]: e.target.value }));

    const toggleEquipo = (equipoId: string) =>
        setSelEquipos(prev => {
            const next = new Set(prev);
            next.has(equipoId) ? next.delete(equipoId) : next.add(equipoId);
            return next;
        });

    const handleGuardar = async () => {
        if (!form.metrosContratados) { setError('Metros contratados es requerido'); return; }
        setSaving(true); setError('');
        try {
            // 1. Actualizar campos escalares de la plantilla via PUT /obras/[id]
            await fetchApi(`/obras/${obraId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    plantillas: [{
                        id:                plantilla.id,
                        metrosContratados: Number(form.metrosContratados),
                        barrenos:          plantilla.barrenos ?? 0,
                        precioUnitario:    form.precioUnitario ? Number(form.precioUnitario) : null,
                        fechaInicio:       form.fechaInicio || null,
                        fechaFin:          form.fechaFin    || null,
                        notas:             form.notas       || null,
                        status:            plantilla.status,
                    }],
                }),
            });

            // 2. Sincronizar equipos: añadir los nuevos, quitar los removidos
            const equiposBase = new Set((plantilla.plantillaEquipos ?? []).map(pe => pe.equipoId));

            // Agregar los que no estaban
            for (const equipoId of selEquipos) {
                if (!equiposBase.has(equipoId)) {
                    await fetchApi(`/obras/${obraId}/plantillas/${plantilla.id}/equipos`, {
                        method: 'POST',
                        body: JSON.stringify({ equipoId }),
                    });
                }
            }
            // Quitar los que se deseleccionaron
            for (const equipoId of equiposBase) {
                if (!selEquipos.has(equipoId)) {
                    await fetchApi(`/obras/${obraId}/plantillas/${plantilla.id}/equipos`, {
                        method: 'DELETE',
                        body: JSON.stringify({ equipoId }),
                    });
                }
            }

            setSuccess('Plantilla actualizada correctamente');
            setTimeout(() => { onSaved(); }, 1000);
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="border-b border-gray-100 px-6 pt-6 pb-4 flex-shrink-0 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Editar Plantilla {plantilla.numero}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Modifica los datos del contrato y equipos asignados</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 px-6">
                            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 size={28} className="text-green-600" />
                            </div>
                            <p className="text-base font-semibold text-gray-800 text-center">{success}</p>
                            <p className="text-xs text-gray-400 text-center">Recargando...</p>
                        </div>
                    ) : (
                        <div className="px-6 py-5 space-y-5">

                            {/* ── Campos del contrato ── */}
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos del contrato</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Metros contratados *</label>
                                        <input type="number" value={form.metrosContratados} onChange={setF('metrosContratados')}
                                            placeholder="ej. 500"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Precio unitario (P.U.)</label>
                                        <input type="number" value={form.precioUnitario} onChange={setF('precioUnitario')}
                                            placeholder="ej. 24.50"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
                                        <input type="date" value={form.fechaInicio} onChange={setF('fechaInicio')}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</label>
                                        <input type="date" value={form.fechaFin} onChange={setF('fechaFin')}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                                    <textarea value={form.notas} onChange={setF('notas')} rows={2}
                                        placeholder="Opcional"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none resize-none" />
                                </div>
                            </div>

                            {/* ── Equipos asignados ── */}
                            <div className="border-t border-gray-100 pt-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                    <Wrench size={11} /> Equipos asignados
                                </p>
                                {equiposDisponibles.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">
                                        No hay equipos activos en esta obra. Asigna equipos a la obra primero.
                                    </p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {equiposDisponibles.map(oe => {
                                            const checked = selEquipos.has(oe.equipoId);
                                            return (
                                                <label
                                                    key={oe.equipoId}
                                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                                        checked
                                                            ? 'border-blue-300 bg-blue-50'
                                                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleEquipo(oe.equipoId)}
                                                        className="accent-blue-600 flex-shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm font-medium text-gray-700">{oe.equipo.nombre}</span>
                                                        {oe.equipo.numeroEconomico && (
                                                            <span className="text-xs text-gray-400 ml-2">({oe.equipo.numeroEconomico})</span>
                                                        )}
                                                        {oe.equipo.modelo && (
                                                            <span className="text-xs text-gray-400 ml-1">· {oe.equipo.modelo}</span>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>

                {error && (
                    <p className="text-xs text-red-500 px-6 pb-2 flex-shrink-0">{error}</p>
                )}

                {/* Footer */}
                {!success && (
                    <div className="border-t border-gray-100 px-6 py-4 flex gap-2 flex-shrink-0">
                        <button onClick={onClose}
                            className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button onClick={handleGuardar} disabled={saving}
                            className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors">
                            {saving ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Tab Plantillas ───────────────────────────────────────────────────────────
function TabPlantillas({ obra, onReload }: { obra: ObraDetalle; onReload: () => void }) {
    const plantillas = obra.plantillas ?? [];

    const STATUS_PLANTILLA: Record<string, { label: string; style: string }> = {
        ACTIVA:    { label: 'Activa',    style: 'bg-green-100 text-green-700' },
        PAUSADA:   { label: 'Pausada',   style: 'bg-yellow-100 text-yellow-700' },
        TERMINADA: { label: '✓ Terminada', style: 'bg-gray-100 text-gray-500' },
    };

    // Modal de edición
    const [editModal, setEditModal] = useState<{
        plantilla: PlantillaObraDetalle;
        abrirEnEquipos?: boolean;
    } | null>(null);

    const handleStatusChange = async (plantillaId: string, status: string) => {
        try {
            await fetchApi(`/obras/${obra.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    plantillas: [{ id: plantillaId, status, metrosContratados: plantillas.find(p => p.id === plantillaId)?.metrosContratados }],
                }),
            });
            onReload();
        } catch (e: any) {
            alert(e.message || 'Error al cambiar estado');
        }
    };

    const handleRemoveEquipo = async (plantillaId: string, equipoId: string) => {
        if (!confirm('¿Desasignar este equipo de la plantilla?')) return;
        try {
            await fetchApi(`/obras/${obra.id}/plantillas/${plantillaId}/equipos`, {
                method: 'DELETE',
                body: JSON.stringify({ equipoId }),
            });
            onReload();
        } catch (e: any) {
            alert(e.message || 'Error al desasignar equipo');
        }
    };

    if (plantillas.length === 0) {
        return (
            <div className="text-center py-10 text-gray-400 text-sm">
                <HardHat size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="font-semibold text-gray-500">Sin plantillas registradas</p>
                <p className="text-xs mt-1">Edita la obra para agregar plantillas de contrato.</p>
            </div>
        );
    }

    return (
        <>
        <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-700">Plantillas del contrato ({plantillas.length})</p>
            <div className="space-y-4">
                {plantillas.map(p => {
                    const registrosDePlantilla = [];  // avance per-plantilla viene del TabOperacion
                    const st = STATUS_PLANTILLA[p.status] ?? STATUS_PLANTILLA['ACTIVA'];
                    const equiposAsignados = p.plantillaEquipos ?? [];

                    return (
                        <div key={p.id} className={`border rounded-xl p-4 ${p.status === 'TERMINADA' ? 'border-green-200 bg-green-50/30' : p.status === 'PAUSADA' ? 'border-yellow-200 bg-yellow-50/20' : 'border-gray-100 bg-white'}`}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${p.status === 'TERMINADA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                        P{p.numero}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">Plantilla {p.numero}</p>
                                        <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                                            {p.fechaInicio && <span>Inicio: {fDate(p.fechaInicio)}</span>}
                                            {p.fechaFin    && <span>Cierre: {fDate(p.fechaFin)}</span>}
                                            {p.notas       && <span className="italic">{p.notas}</span>}
                                        </div>
                                    </div>
                                </div>
                            {/* Status selector + botón Editar */}
                                <div className="flex items-center gap-2">
                                    <select
                                        value={p.status}
                                        onChange={e => handleStatusChange(p.id, e.target.value)}
                                        className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${st.style}`}
                                    >
                                        <option value="ACTIVA">Activa</option>
                                        <option value="PAUSADA">Pausada</option>
                                        <option value="TERMINADA">✓ Terminada</option>
                                    </select>
                                    <button
                                        onClick={() => setEditModal({ plantilla: p })}
                                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-2 py-1 rounded-lg transition-colors"
                                        title="Editar plantilla"
                                    >
                                        <Edit size={11} /> Editar
                                    </button>
                                </div>
                            </div>

                            {/* Métricas */}
                            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 mb-3">
                                <div>
                                    <span className="text-gray-400">Metros contratados: </span>
                                    <strong className="text-gray-700">{p.metrosContratados} m</strong>
                                </div>
                                {p.barrenos > 0 && (
                                    <div>
                                        <span className="text-gray-400">Barrenos: </span>
                                        <strong className="text-gray-700">{p.barrenos}</strong>
                                    </div>
                                )}
                            </div>

                            {/* Equipos asignados a esta plantilla */}
                            <div className="border-t border-gray-100 pt-3">
                                <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                                    <Wrench size={11} /> Equipos asignados ({equiposAsignados.length})
                                </p>
                                {equiposAsignados.length === 0 ? (
                                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                        <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-amber-700 font-medium">
                                                Esta plantilla no tiene equipos asignados
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setEditModal({ plantilla: p, abrirEnEquipos: true })}
                                            className="text-xs text-amber-700 font-semibold hover:text-blue-600 hover:underline flex-shrink-0 transition-colors"
                                        >
                                            Asignar equipo
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {equiposAsignados.map(pe => (
                                            <div key={pe.equipoId}
                                                className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                                                <span className="font-medium">{pe.equipo.nombre}</span>
                                                {pe.equipo.numeroEconomico && (
                                                    <span className="text-blue-400">({pe.equipo.numeroEconomico})</span>
                                                )}
                                                <button
                                                    onClick={() => handleRemoveEquipo(p.id, pe.equipoId)}
                                                    className="ml-1 text-blue-400 hover:text-red-500 transition-colors"
                                                    title="Desasignar equipo">
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Modal de edición de plantilla */}
        {editModal && (
            <EditarPlantillaModal
                plantilla={editModal.plantilla}
                obraId={obra.id}
                equiposObra={obra.obraEquipos}
                abrirEnEquipos={editModal.abrirEnEquipos}
                onClose={() => setEditModal(null)}
                onSaved={() => { setEditModal(null); onReload(); }}
            />
        )}
        </>
    );
}

// ─── Tab Cortes ───────────────────────────────────────────────────────────────
function TabCortes({ obraId, obra, cortes, onReload }: {
    obraId: string;
    obra: ObraDetalle;
    cortes: Corte[];
    onReload: () => void;
}) {
    const [modal, setModal] = useState<{ open: boolean; corte?: Corte }>({ open: false });

    const handleDelete = async (id: string, num: number) => {
        if (!confirm(`¿Eliminar el Corte #${num}?`)) return;
        try {
            await fetchApi(`/obras/${obraId}/cortes/${id}`, { method: 'DELETE' });
            onReload();
        } catch (e: any) {
            alert(e.message || 'Error al eliminar');
        }
    };

    const handleStatusChange = async (corte: Corte, status: string) => {
        try {
            await fetchApi(`/obras/${obraId}/cortes/${corte.id}`, {
                method: 'PUT',
                body: JSON.stringify({ status }),
            });
            onReload();
        } catch (e: any) {
            alert(e.message || 'Error');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-gray-700">Cortes de facturación ({cortes.length})</p>
                <button onClick={() => setModal({ open: true })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus size={13} /> Nuevo corte
                </button>
            </div>

            {cortes.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Sin cortes de facturación registrados.</div>
            ) : (
                <div className="space-y-3">
                    {cortes.map(c => (
                        <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm flex-shrink-0">
                                        #{c.numero}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">
                                            {fDate(c.fechaInicio)} → {fDate(c.fechaFin)}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {c.barrenos} barrenos · {fmt2(c.metrosLineales)} mt ln
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={c.status}
                                        onChange={e => handleStatusChange(c, e.target.value)}
                                        className={`text-xs font-semibold px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer ${CORTE_STATUS_STYLE[c.status]}`}
                                    >
                                        <option value="BORRADOR">Borrador</option>
                                        <option value="FACTURADO">Facturado</option>
                                        <option value="COBRADO">Cobrado</option>
                                    </select>
                                    <button onClick={() => setModal({ open: true, corte: c })}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                                        <Edit size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(c.id, c.numero)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Cálculo de volumen */}
                            {c.volumenBruto !== null && (
                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-50">
                                    <div>
                                        <p className="text-xs text-gray-400">Vol. bruto</p>
                                        <p className="text-sm font-semibold text-gray-700">{fmt2(c.volumenBruto!)} m³</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">Pérdida</p>
                                        <p className="text-sm font-semibold text-gray-700">{c.perdidaM3 !== null ? `${fmt2(c.perdidaM3)} m³` : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">Vol. neto</p>
                                        <p className="text-sm font-semibold text-gray-700">{c.volumenNeto !== null ? `${fmt2(c.volumenNeto)} m³` : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">Monto facturado</p>
                                        <p className="text-sm font-bold text-blue-700">
                                            {c.montoFacturado !== null ? `$${fmt2(c.montoFacturado)} ${c.moneda}` : '—'}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {c.notas && <p className="text-xs text-gray-400 mt-2 italic">{c.notas}</p>}
                        </div>
                    ))}
                </div>
            )}

            {modal.open && (
                <CorteModal
                    obraId={obraId}
                    obra={obra}
                    corte={modal.corte}
                    onClose={() => setModal({ open: false })}
                    onSaved={() => { setModal({ open: false }); onReload(); }}
                />
            )}
        </div>
    );
}

// ─── Tab Costos ───────────────────────────────────────────────────────────────
function TabCostos({ obraId }: { obraId: string }) {
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [loading,     setLoading]     = useState(true);

    useEffect(() => {
        fetchApi(`/inventory/movements?obraId=${obraId}`)
            .then(data => setMovimientos(Array.isArray(data) ? data : (data.movimientos ?? [])))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [obraId]);

    const totalCosto = movimientos
    .reduce((a, m) => a + (m.cantidad * m.costoUnitario), 0);

    if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Cargando costos...</div>;

    return (
        <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Costo total de insumos</p>
                    <p className="text-2xl font-bold text-blue-700">${fmt(totalCosto)}</p>
                </div>
                <Package size={32} className="text-blue-300" />
            </div>

            {movimientos.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Sin movimientos de inventario vinculados a esta obra.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase">Fecha</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase">Producto</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-right">Cantidad</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-right">Costo u.</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-right">Total</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-center">Tipo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {movimientos.map(m => (
                                <tr key={m.id} className="hover:bg-gray-50/50">
                                    <td className="p-3 text-gray-600">{fDate(m.fecha)}</td>
                                    <td className="p-3 text-gray-800 font-medium">{m.producto.nombre}</td>
                                    <td className="p-3 text-right text-gray-700">{m.cantidad} {m.producto.unidad}</td>
                                    <td className="p-3 text-right text-gray-600">${fmt2(m.costoUnitario)}</td>
                                    <td className="p-3 text-right font-semibold text-gray-800">
                                        ${fmt2(m.cantidad * m.costoUnitario)}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                            m.tipoMovimiento === 'ENTRADA'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            {m.tipoMovimiento}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────
// ─── Resumen Financiero ───────────────────────────────────────────────────────
function ResumenFinanciero({ rf, moneda, metrosPerforados, cortes, plantillas, onGoToPlantillas, onRegularizar }: {
    rf: NonNullable<ObraDetalle['resumenFinanciero']>;
    moneda: string;
    metrosPerforados?: number;
    cortes?: Corte[];
    plantillas?: PlantillaObraDetalle[];
    onGoToPlantillas?: () => void;
    onRegularizar?: () => void;
}) {
    const mxn = (n: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
    const pct = (n: number | null) => n != null ? `${n.toFixed(1)}%` : '—';
    const metro = (n: number | null) => n != null ? `${mxn(n)}/m` : '—';

    const utilPos     = (rf.utilidad ?? 0) >= 0;
    const costoTotal  = (rf.costoProduccion ?? 0) + (rf.gastosAdicionales ?? 0) + (rf.costoInsumos ?? 0);
    const utilPrefix  = utilPos ? '+' : '';

    // Insight: utilidad por metro perforado
    const utilPorMetro = (metrosPerforados && metrosPerforados > 0 && rf.utilidad != null)
        ? rf.utilidad / metrosPerforados
        : null;

    // ── Estado de facturación ─────────────────────────────────────────────────
    const produccionTotalMetros = metrosPerforados ?? 0;
    const metrosFacturados      = (cortes ?? [])
        .filter(c => (c.montoFacturado ?? 0) > 0)
        .reduce((s, c) => s + (c.metrosLineales ?? 0), 0);
    const hayCortes = (cortes ?? []).length > 0;
    const hayMontoFacturado = (cortes ?? []).some(c => (c.montoFacturado ?? 0) > 0);

    type EstadoFacturacion = 'sin_facturar' | 'parcial' | 'completa';
    let estadoFacturacion: EstadoFacturacion;
    if (!hayMontoFacturado) {
        estadoFacturacion = 'sin_facturar';
    } else if (produccionTotalMetros > 0 && metrosFacturados < produccionTotalMetros - 0.01) {
        estadoFacturacion = 'parcial';
    } else {
        estadoFacturacion = 'completa';
    }

    const estadoConfig = {
        sin_facturar: {
            label: 'Producción en proceso — pendiente de facturación',
            color: 'text-amber-600',
            bg:    'bg-amber-50 border-amber-100',
            dot:   'bg-amber-400',
        },
        parcial: {
            label: 'Facturación parcial — faltan cortes por registrar',
            color: 'text-blue-600',
            bg:    'bg-blue-50 border-blue-100',
            dot:   'bg-blue-400',
        },
        completa: {
            label: 'Obra completamente facturada',
            color: 'text-green-600',
            bg:    'bg-green-50 border-green-100',
            dot:   'bg-green-500',
        },
    }[estadoFacturacion];

    // ── Metros y monto pendiente ──────────────────────────────────────────────
    const metrosPendientes = Math.max(0, produccionTotalMetros - metrosFacturados);

    // Estimación de facturación pendiente desde plantillas (metrosContratados - produccionYaFacturada)
    // Por cada plantilla: pendiente = max(0, metrosContratados - metrosFacturadosDeEsaPlantilla)
    // Como los registros de cortes no tienen plantillaId, usamos una distribución proporcional:
    // peso de cada plantilla = metrosContratados / totalContratado → metros facturados asignados proporcionalmente
    const totalContratadoPlantillas = (plantillas ?? []).reduce((s, p) => s + p.metrosContratados, 0);
    let montoPendienteEstimado       = 0;
    let plantillasSinPrecio          = 0;
    let hayAlgunPrecio               = false;

    for (const p of (plantillas ?? [])) {
        const peso = totalContratadoPlantillas > 0
            ? p.metrosContratados / totalContratadoPlantillas
            : 0;
        // Metros ya facturados asignados a esta plantilla (por proporción)
        const metrosFacturadosPlantilla = peso * metrosFacturados;
        const metrosPendientesPlantilla = Math.max(0, p.metrosContratados - metrosFacturadosPlantilla);
        if ((p.precioUnitario ?? 0) > 0) {
            montoPendienteEstimado += metrosPendientesPlantilla * p.precioUnitario!;
            hayAlgunPrecio = true;
        } else if (p.metrosContratados > 0) {
            plantillasSinPrecio++;
        }
    }
    const calcParcialPorPrecio = plantillasSinPrecio > 0 && hayAlgunPrecio;
    const sinPreciosEnAbsoluto = !hayAlgunPrecio && (plantillas ?? []).length > 0;

    // Detectar si hay metros producidos fuera de cualquier plantilla
    // (producción en "Sin plantilla asignada" → no incluida en la estimación)
    const metrosSinPlantilla = Math.max(0, produccionTotalMetros - totalContratadoPlantillas);
    const hayMetrosSinPlantilla = metrosSinPlantilla > 0.01;

    // Construir mensaje explicativo según causa real de la estimación parcial
    const mensajeEstimacionParcial: string | null = (() => {
        if (!calcParcialPorPrecio && !sinPreciosEnAbsoluto && !hayMetrosSinPlantilla) return null;
        const causas: string[] = [];
        if (plantillasSinPrecio > 0) causas.push('faltan precios en algunas plantillas');
        if (hayMetrosSinPlantilla)   causas.push('hay metros producidos no cubiertos por las plantillas configuradas');
        return `estimación parcial — ${causas.join(' y ')}`;
    })();

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Resumen Financiero</h2>

            {/* Indicador de estado de facturación */}
            <div className={`rounded-lg border px-3 py-2.5 mb-3 ${estadoConfig.bg}`}>
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${estadoConfig.dot}`} />
                    <p className={`text-xs font-medium ${estadoConfig.color}`}>{estadoConfig.label}</p>
                    {estadoFacturacion === 'parcial' && produccionTotalMetros > 0 && (
                        <p className="text-xs text-blue-400 ml-auto flex-shrink-0">
                            {metrosFacturados.toFixed(1)} / {produccionTotalMetros.toFixed(1)} m
                        </p>
                    )}
                </div>
                <div className="mt-1.5 ml-4 space-y-0.5">
                    <p className={`text-xs ${estadoConfig.color} opacity-80`}>
                        Pendiente por facturar: <span className="font-semibold">{metrosPendientes.toFixed(1)} m</span>
                    </p>
                    {hayMetrosSinPlantilla && (
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <p className="text-xs text-amber-500 font-medium">
                                ⚠️ {metrosSinPlantilla.toFixed(1)} m sin plantilla asignada
                            </p>
                            {onRegularizar ? (
                                <button
                                    onClick={onRegularizar}
                                    className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <AlertTriangle size={10} />
                                    Asignar a plantilla
                                </button>
                            ) : onGoToPlantillas && (
                                <button
                                    onClick={onGoToPlantillas}
                                    className="text-xs text-blue-500 underline hover:text-blue-700 transition-colors"
                                >
                                    Asignar a plantilla
                                </button>
                            )}
                        </div>
                    )}
                    <p className={`text-xs ${estadoConfig.color} opacity-80`}>
                        Facturación pendiente estimada:{' '}
                        {mensajeEstimacionParcial
                            ? <>
                                <span className="font-medium">No disponible</span>
                                <span className="font-normal italic opacity-70"> ({mensajeEstimacionParcial})</span>
                              </>
                            : <span className="font-semibold">{mxn(montoPendienteEstimado)}</span>
                        }
                    </p>
                </div>
            </div>

            {/* Fila 1: desglose de costos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {/* Facturado */}
                <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">Facturado</p>
                    <p className="text-sm font-bold text-gray-800">{mxn(rf.facturado ?? 0)}</p>
                    <p className="text-xs text-gray-400">{moneda}</p>
                </div>
                {/* Costo Producción */}
                <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">Costo Producción</p>
                    <p className="text-sm font-bold text-gray-800">{mxn(rf.costoProduccion ?? 0)}</p>
                    <p className="text-xs text-gray-400">(Registro diario)</p>
                </div>
                {/* Gastos Adicionales */}
                <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">Gastos Adicionales</p>
                    <p className="text-sm font-bold text-gray-800">{mxn(rf.gastosAdicionales ?? 0)}</p>
                    <p className="text-xs text-gray-400">(No incluidos en operación)</p>
                </div>
                {/* Insumos */}
                <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">Insumos</p>
                    <p className="text-sm font-bold text-gray-800">{mxn(rf.costoInsumos ?? 0)}</p>
                    <p className="text-xs text-gray-400">Costo de insumos vinculados</p>
                </div>
            </div>

            {/* Fila 2: costo total — subtotal destacado */}
            <div className="flex items-center justify-between bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 mb-3">
                <div>
                    <p className="text-xs font-semibold text-gray-600">Costo total</p>
                    <p className="text-xs text-gray-400">Producción + gastos + insumos</p>
                </div>
                <p className="text-xl font-extrabold text-gray-800">{mxn(costoTotal)}</p>
            </div>

            {/* Fila 3: utilidad (protagonista, 2 cols) + costo/m (secundaria, 1 col) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Utilidad — protagonista ocupa 2 columnas en desktop */}
                <div className={`rounded-xl px-4 py-3 sm:col-span-2 ${utilPos ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Utilidad</p>
                    <p className={`text-3xl font-extrabold tracking-tight leading-none ${utilPos ? 'text-green-600' : 'text-red-600'}`}>
                        {utilPrefix}{mxn(rf.utilidad ?? 0)}
                    </p>
                    <p className={`text-sm font-semibold mt-1 ${utilPos ? 'text-green-500' : 'text-red-500'}`}>
                        {pct(rf.margenPct)} <span className="font-normal text-gray-400">de margen</span>
                    </p>
                </div>
                {/* Costo real por metro — tarjeta secundaria */}
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                    <p className="text-xs text-gray-400 mb-0.5">Costo real por metro</p>
                    <p className="text-2xl font-bold text-gray-800">{metro(rf.costoPorMetro ?? null)}</p>
                    <p className="text-xs text-gray-400 mt-1">Costo total / metros perf.</p>
                    <p className={`text-xs mt-1.5 font-medium ${utilPorMetro != null ? (utilPos ? 'text-green-500' : 'text-red-500') : 'text-gray-400'}`}>
                        Ganancia por metro: {utilPorMetro != null ? `${utilPos ? '' : '-'}${mxn(Math.abs(utilPorMetro))}/m` : '—'}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function ObraDetallePage() {
    const params = useParams();
    const router = useRouter();

    // App Router: params.id puede ser string | string[] | undefined durante hidratación
    const rawId = params?.id;
    const obraId: string | undefined =
        typeof rawId === 'string' && rawId.trim() !== '' ? rawId : undefined;

    console.log('[ObraDetalle] raw params:', params);
    console.log('[ObraDetalle] obraId:', obraId);

    const [obra,    setObra]    = useState<ObraDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');
    const [tab, setTab] = useState<'operacion' | 'plantillas' | 'cortes' | 'costos'>('operacion');
    const [regularizarOpen, setRegularizarOpen] = useState(false);

    const load = async (id: string) => {
        setLoading(true);
        setError('');
        try {
            console.log('[ObraDetalle] fetchUrl:', `/obras/${id}`);
            const data = await fetchApi(`/obras/${id}`);
            console.log('[ObraDetalle] data recibida:', data);
            setObra(data);
        } catch (e: any) {
            console.error('[ObraDetalle] error en fetch:', e);
            setError(e.message || 'Error al cargar la obra');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('[ObraDetalle] useEffect disparado, obraId:', obraId, 'tipo:', typeof obraId);
        // Guard: no hacer fetch si obraId aún no está disponible
        if (typeof obraId !== 'string' || obraId.trim() === '') {
            console.log('[ObraDetalle] obraId no válido todavía, abortando fetch');
            return;
        }
        load(obraId);
    }, [obraId]);

    // Mientras el id de ruta no esté resuelto, mostrar loading (nunca "Obra no encontrada")
    if (!obraId || loading) {
        return <div className="p-10 text-center text-gray-400 text-sm">Cargando obra...</div>;
    }
    if (error || !obra) {
        console.warn('[ObraDetalle] Mostrando error. error:', error, '| obra:', obra);
        return (
            <div className="p-10 text-center">
                <p className="text-red-500 text-sm mb-3">{error || 'Obra no encontrada'}</p>
                <button onClick={() => router.back()} className="text-blue-600 text-sm hover:underline">← Volver</button>
            </div>
        );
    }

    const fmt2Local = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link href="/dashboard/obras" className="hover:text-blue-600 flex items-center gap-1">
                    <ArrowLeft size={14} /> Obras
                </Link>
                <span>/</span>
                <span className="text-gray-800 font-medium truncate">{obra.nombre}</span>
            </div>

            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <HardHat size={22} className="text-orange-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl font-bold text-gray-900">{obra.nombre}</h1>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[obra.status]}`}>
                                    {obra.status === 'ACTIVA'    && <CheckCircle size={10}/>}
                                    {obra.status === 'PAUSADA'   && <PauseCircle size={10}/>}
                                    {obra.status === 'TERMINADA' && <Clock size={10}/>}
                                    {obra.status.charAt(0) + obra.status.slice(1).toLowerCase()}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                                {(obra.cliente?.nombre || obra.clienteNombre) && (
                                    <span>Cliente: <strong>{obra.cliente?.nombre || obra.clienteNombre}</strong></span>
                                )}
                                {obra.ubicacion && <span>📍 {obra.ubicacion}</span>}
                                {obra.fechaInicio && <span>Inicio: {fDate(obra.fechaInicio)}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPIs */}
                {(() => {
                    const metrosPerf = obra.metricas?.metrosPerforados ?? 0;
                    const metrosTotales = obra.plantillas?.reduce((s, p) => s + p.metrosContratados, 0) ?? obra.metrosContratados ?? 0;
                    const barrenosPerf = obra.metricas?.barrenos ?? 0;
                    const barrTotales = obra.plantillas?.reduce((s, p) => s + p.barrenos, 0) ?? 0;
                    const pctMetros = metrosTotales > 0 ? Math.min(100, (metrosPerf / metrosTotales) * 100) : null;
                    const pctBarr = barrTotales > 0 ? Math.min(100, (barrenosPerf / barrTotales) * 100) : null;
                    const equiposActivos = obra.obraEquipos.filter(e => !e.fechaFin).length;
                    const diasTranscurridos = obra.fechaInicio
                        ? Math.floor((Date.now() - new Date(obra.fechaInicio).getTime()) / 86400000)
                        : null;

                    return (
                        <>
                            {/* Info extra en el header */}
                            <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400">
                                {equiposActivos > 0 && (
                                    <span className="flex items-center gap-1">
                                        <Wrench size={11} className="text-blue-400"/>
                                        {equiposActivos} equipo{equiposActivos !== 1 ? 's' : ''} activo{equiposActivos !== 1 ? 's' : ''}
                                    </span>
                                )}
                                {diasTranscurridos !== null && (
                                    <span className="flex items-center gap-1">
                                        <Clock size={11} className="text-gray-400"/>
                                        {diasTranscurridos} días transcurridos
                                    </span>
                                )}
                                {obra.plantillas?.length > 0 && (
                                    <span className="flex items-center gap-1">
                                        <FileText size={11} className="text-purple-400"/>
                                        {obra.plantillas.length} plantilla{obra.plantillas.length !== 1 ? 's' : ''} de contrato
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                                {/* Metros perforados con barra */}
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <p className="text-xs text-gray-400 mb-1">Metros perforados</p>
                                    <p className="text-lg font-bold text-gray-800">{fmt(metrosPerf)} m</p>
                                    {metrosTotales > 0 && (
                                        <>
                                            <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${pctMetros! >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${pctMetros}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{fmt(metrosPerf)} / {fmt(metrosTotales)} m</p>
                                        </>
                                    )}
                                </div>

                                {/* % Avance */}
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <p className="text-xs text-gray-400 mb-1">% Avance</p>
                                    {pctMetros !== null ? (
                                        <>
                                            <p className={`text-lg font-bold ${pctMetros >= 100 ? 'text-green-600' : 'text-blue-600'}`}>
                                                {pctMetros.toFixed(1)}%
                                            </p>
                                            <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${pctMetros >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min(pctMetros, 100)}%` }}
                                                />
                                            </div>
                                            {pctMetros < 100 && metrosTotales > 0 && (
                                                <p className="text-xs text-orange-500 mt-1">Faltan {fmt(metrosTotales - metrosPerf)} m</p>
                                            )}
                                            {pctMetros >= 100 && <p className="text-xs text-green-600 mt-1">✓ Completado</p>}
                                        </>
                                    ) : <p className="text-lg font-bold text-gray-400">—</p>}
                                </div>

                                {/* Barrenos */}
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <p className="text-xs text-gray-400 mb-1">Barrenos</p>
                                    <p className="text-lg font-bold text-gray-800">{fmt(barrenosPerf)}</p>
                                    {barrTotales > 0 && (
                                        <>
                                            <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${pctBarr! >= 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                                                    style={{ width: `${pctBarr}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{barrenosPerf} / {barrTotales}</p>
                                        </>
                                    )}
                                </div>

                                {/* Horas + Monto */}
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <p className="text-xs text-gray-400 mb-1">Horas / Facturado</p>
                                    <p className="text-lg font-bold text-gray-800">{fmt2Local(obra.metricas?.horasTotales ?? 0)} hrs</p>
                                    <p className="text-sm font-semibold text-green-700 mt-0.5">${fmt(obra.metricas?.montoFacturado ?? 0)} <span className="text-xs font-normal text-gray-400">{obra.moneda}</span></p>
                                </div>
                            </div>
                        </>
                    );
                })()}
            </div>

            {/* Resumen Financiero */}
            {obra.resumenFinanciero && (
                <ResumenFinanciero
                    rf={obra.resumenFinanciero}
                    moneda={obra.moneda}
                    metrosPerforados={obra.metricas?.metrosPerforados}
                    cortes={obra.cortesFacturacion}
                    plantillas={obra.plantillas}
                    onGoToPlantillas={() => setTab('plantillas')}
                    onRegularizar={() => setRegularizarOpen(true)}
                />
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
                {([
                    { key: 'operacion',  label: 'Operación',  icon: <ClipboardListIcon /> },
                    { key: 'plantillas', label: 'Plantillas', icon: <HardHat size={14}/> },
                    { key: 'cortes',     label: 'Cortes',     icon: <FileText size={14}/> },
                    { key: 'costos',     label: 'Costos',     icon: <Package size={14}/> },
                ] as const).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            tab === t.key
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t.icon} {t.label}
                        {t.key === 'plantillas' && (obra.plantillas?.length ?? 0) > 0 && (
                            <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">
                                {obra.plantillas.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <Card>
                <div className="p-5">
                    {tab === 'operacion'  && <TabOperacion obraId={obraId} obra={obra} />}
                    {tab === 'plantillas' && <TabPlantillas obra={obra} onReload={() => { if (obraId) load(obraId); }} />}
                    {tab === 'cortes'     && <TabCortes obraId={obraId} obra={obra} cortes={obra.cortesFacturacion} onReload={() => { if (obraId) load(obraId); }} />}
                    {tab === 'costos'     && <TabCostos obraId={obraId} />}
                </div>
            </Card>

            {/* Modal de regularización */}
            {regularizarOpen && (
                <RegularizarModal
                    obraId={obraId}
                    metrosSinPlantilla={Math.max(
                        0,
                        (obra.metricas?.metrosPerforados ?? 0) -
                        (obra.plantillas?.reduce((s, p) => s + p.metrosContratados, 0) ?? 0)
                    )}
                    onClose={() => setRegularizarOpen(false)}
                    onSaved={() => { setRegularizarOpen(false); if (obraId) load(obraId); }}
                />
            )}
        </div>
    );
}

// Pequeño wrapper para evitar importar ClipboardList directamente (ya está en lucide)
function ClipboardListIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
        </svg>
    );
}
