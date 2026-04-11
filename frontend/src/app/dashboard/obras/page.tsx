"use client";

import React, { useEffect, useState, useRef } from 'react';
import {
    HardHat, Plus, Edit, Trash2, Eye,
    CheckCircle, Clock, PauseCircle, Search, X, AlertTriangle,
    ChevronRight, ChevronLeft, Info, FileText, Layers, Wrench,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type PlantillaObra = {
    id?: string;
    numero: number;
    metrosContratados: string;
    barrenos: string;
    fechaInicio: string;
    fechaFin: string;
    notas: string;
    equipos: { equipoId: string; fechaInicio: string }[];
};

type PlantillaObraDB = {
    id: string;
    numero: number;
    metrosContratados: number;
    barrenos: number;
    fechaInicio: string | null;
    fechaFin: string | null;
    notas: string | null;
    status: string;
    plantillaEquipos?: { equipoId: string; equipo: { id: string; nombre: string; numeroEconomico: string | null } }[];
};

type EquipoSeleccionado = {
    equipoId: string;
    fechaInicio: string;
    horometroInicial: string;
};

type EquipoAsignado = {
    id: string;
    equipoId: string;
    nombre: string;
    numeroEconomico: string | null;
    fechaInicio: string;
    fechaFin: string | null;
    _eliminar?: boolean;
};

type Obra = {
    id: string;
    nombre: string;
    cliente: { nombre: string } | null;
    ubicacion: string | null;
    metrosContratados: number | null;
    precioUnitario: number | null;
    moneda: 'MXN' | 'USD';
    fechaInicio: string | null;
    fechaFin: string | null;
    bordo: number | null;
    espaciamiento: number | null;
    status: 'ACTIVA' | 'PAUSADA' | 'TERMINADA';
    notas: string | null;
    plantillas: PlantillaObraDB[];
    _count: { registrosDiarios: number; cortesFacturacion: number };
    obraEquipos: { equipoId: string; equipo: { nombre: string; numeroEconomico: string | null } }[];
    metricas: {
        metrosPerforados: number;
        horasTotales: number;
        barrenos: number;
        pctAvance: number | null;
        montoFacturado: number;
    };
};

type Cliente = { id: string; nombre: string };
type Equipo  = { id: string; nombre: string; numeroEconomico: string | null };

// ─── Badges ───────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
    ACTIVA:    'bg-green-100 text-green-700',
    PAUSADA:   'bg-yellow-100 text-yellow-700',
    TERMINADA: 'bg-gray-100 text-gray-500',
};
const STATUS_ICON: Record<string, React.ReactElement> = {
    ACTIVA:    <CheckCircle size={11} />,
    PAUSADA:   <PauseCircle size={11} />,
    TERMINADA: <Clock size={11} />,
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
    const [visible, setVisible] = useState(false);
    return (
        <span className="relative inline-flex items-center ml-1">
            <button
                type="button"
                className="text-gray-400 hover:text-blue-500 transition-colors focus:outline-none"
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onFocus={() => setVisible(true)}
                onBlur={() => setVisible(false)}
                aria-label="Mas informacion"
            >
                <Info size={13} />
            </button>
            {visible && (
                <span className="absolute z-50 left-5 top-0 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed pointer-events-none">
                    {text}
                    <span className="absolute -left-1 top-2 w-2 h-2 bg-gray-900 rotate-45" />
                </span>
            )}
        </span>
    );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
const STEPS = [
    { id: 1, label: 'Datos generales', icon: FileText },
    { id: 2, label: 'Contrato y malla', icon: Layers },
    { id: 3, label: 'Plantillas y equipos', icon: Wrench },
];

function StepIndicator({ current, completed }: { current: number; completed: Set<number> }) {
    return (
        <div className="flex items-center gap-0 mb-6">
            {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isActive = current === step.id;
                const isDone   = completed.has(step.id);
                return (
                    <React.Fragment key={step.id}>
                        <div className="flex flex-col items-center gap-1 flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm font-semibold ${
                                isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                : isDone  ? 'bg-green-500 text-white'
                                : 'bg-gray-100 text-gray-400'
                            }`}>
                                {isDone && !isActive ? <CheckCircle size={15} /> : <Icon size={14} />}
                            </div>
                            <span className={`text-xs text-center leading-tight transition-colors ${
                                isActive ? 'text-blue-600 font-semibold'
                                : isDone  ? 'text-green-600'
                                : 'text-gray-400'
                            }`}>
                                {step.label}
                            </span>
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-1 mb-5 rounded transition-colors ${
                                completed.has(step.id) ? 'bg-green-400' : 'bg-gray-200'
                            }`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function SectionBlock({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
    const borderMap: Record<string, string> = {
        blue:   'border-blue-400',
        amber:  'border-amber-400',
        purple: 'border-purple-400',
        green:  'border-green-400',
        teal:   'border-teal-400',
    };
    const textMap: Record<string, string> = {
        blue:   'text-blue-600',
        amber:  'text-amber-600',
        purple: 'text-purple-600',
        green:  'text-green-600',
        teal:   'text-teal-600',
    };
    return (
        <div className={`pl-3 border-l-2 ${borderMap[color] ?? 'border-gray-300'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${textMap[color] ?? 'text-gray-500'}`}>{title}</p>
            {children}
        </div>
    );
}

// ─── Field error ──────────────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
    if (!msg) return null;
    return (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <AlertTriangle size={11} />{msg}
        </p>
    );
}

// ─── Modal confirmacion eliminar ──────────────────────────────────────────────
function DeleteConfirmModal({
    nombre, onConfirm, onCancel, loading,
}: {
    nombre: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}) {
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={18} className="text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-800">Eliminar obra</h3>
                        <p className="text-xs text-gray-400">Esta accion no se puede deshacer</p>
                    </div>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                    Seguro que deseas eliminar <strong>&quot;{nombre}&quot;</strong>?
                    Solo es posible si no tiene registros asociados.
                </p>
                <div className="flex gap-2">
                    <button onClick={onCancel} disabled={loading}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex-1 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50">
                        {loading ? 'Eliminando...' : 'Si, eliminar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal Crear / Editar Obra (STEPPER) ──────────────────────────────────────
function ObraModal({
    obra, clientes, equipos, onClose, onSaved,
}: {
    obra?: Obra;
    clientes: Cliente[];
    equipos: Equipo[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEdit = !!obra;
    const [step, setStep] = useState(1);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

    // Equipos (creacion)
    const [equiposSeleccionados, setEquiposSeleccionados] = useState<EquipoSeleccionado[]>(
        [{ equipoId: '', fechaInicio: '', horometroInicial: '' }]
    );
    const [equiposAsignados, setEquiposAsignados] = useState<EquipoAsignado[]>([]);
    const [loadingEquipos, setLoadingEquipos] = useState(isEdit);
    const [equiposNuevos, setEquiposNuevos] = useState<EquipoSeleccionado[]>([]);
    const [savingPlantillaEquipo, setSavingPlantillaEquipo] = useState(false);

    useEffect(() => {
        if (!isEdit || !obra) return;
        fetchApi(`/obras/${obra.id}/equipos`)
            .then((data: any[]) => {
                setEquiposAsignados(data.map((oe: any) => ({
                    id:              oe.id,
                    equipoId:        oe.equipoId,
                    nombre:          oe.equipo.nombre,
                    numeroEconomico: oe.equipo.numeroEconomico,
                    fechaInicio:     oe.fechaInicio?.slice(0, 10) ?? '',
                    fechaFin:        oe.fechaFin?.slice(0, 10) ?? null,
                })));
            })
            .catch(() => {})
            .finally(() => setLoadingEquipos(false));
    }, []);

    const [plantillas, setPlantillas] = useState<PlantillaObra[]>(
        obra?.plantillas && obra.plantillas.length > 0
            ? obra.plantillas.map(p => ({
                id:                p.id,
                numero:            p.numero,
                metrosContratados: String(p.metrosContratados),
                barrenos:          String(p.barrenos ?? ''),
                fechaInicio:       p.fechaInicio ? p.fechaInicio.slice(0, 10) : '',
                fechaFin:          p.fechaFin    ? p.fechaFin.slice(0, 10)    : '',
                notas:             p.notas ?? '',
                equipos:           (p.plantillaEquipos ?? []).map(pe => ({
                    equipoId:    pe.equipoId,
                    fechaInicio: '',
                })),
            }))
            : [{ numero: 1, metrosContratados: '', barrenos: '', fechaInicio: '', fechaFin: '', notas: '', equipos: [] }]
    );

    const [form, setForm] = useState({
        nombre:            obra?.nombre            ?? '',
        clienteId:         obra?.cliente
            ? (clientes.find(c => c.nombre === obra.cliente!.nombre)?.id ?? '')
            : '',
        ubicacion:         obra?.ubicacion         ?? '',
        metrosContratados: obra?.metrosContratados?.toString() ?? '',
        precioUnitario:    obra?.precioUnitario?.toString()    ?? '',
        moneda:            obra?.moneda            ?? 'MXN',
        fechaInicio:       obra?.fechaInicio?.slice(0, 10)     ?? '',
        fechaFin:          obra?.fechaFin?.slice(0, 10)        ?? '',
        status:            obra?.status            ?? 'ACTIVA',
        bordo:             obra?.bordo?.toString()         ?? '',
        espaciamiento:     obra?.espaciamiento?.toString() ?? '',
        notas:             obra?.notas             ?? '',
    });

    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [dirty,   setDirty]   = useState(false);
    const [saving,  setSaving]  = useState(false);
    const [saveError, setSaveError] = useState('');

    const touch = (key: string) => setTouched(prev => new Set(prev).add(key));

    const fieldErrors: Record<string, string> = {};
    if (touched.has('nombre')    && !form.nombre.trim())    fieldErrors.nombre    = 'El nombre de la obra es requerido';
    if (touched.has('clienteId') && !form.clienteId)        fieldErrors.clienteId = 'Debes seleccionar un cliente';
    if (form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio)
        fieldErrors.fechaFin = 'La fecha fin no puede ser anterior a la fecha de inicio';

    const canAdvanceStep1 = form.nombre.trim() && form.clienteId;
    const canAdvanceStep2 = !fieldErrors.fechaFin;

    const handleFieldChange = (key: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            setForm(f => ({ ...f, [key]: e.target.value }));
            setDirty(true);
        };

    const handleBlur = (key: string) => touch(key);

    const importeTotal =
        form.metrosContratados && form.precioUnitario
            ? Number(form.metrosContratados) * Number(form.precioUnitario)
            : null;

    const areaCalculada =
        form.bordo && form.espaciamiento
            ? (Number(form.bordo) * Number(form.espaciamiento)).toFixed(2)
            : null;

    const fmtMoney = (n: number) =>
        n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handleClose = () => {
        if (dirty && !confirm('Tienes cambios sin guardar. Descartar cambios?')) return;
        onClose();
    };

    const goToStep = (n: number) => {
        setCompletedSteps(prev => new Set(prev).add(step));
        setStep(n);
        if (step === 1) {
            setTouched(prev => new Set([...prev, 'nombre', 'clienteId']));
        }
    };

    // Equipos helpers (creacion)
    const addEquipo = () =>
        setEquiposSeleccionados(prev => [...prev, { equipoId: '', fechaInicio: '', horometroInicial: '' }]);
    const removeEquipo = (idx: number) =>
        setEquiposSeleccionados(prev => prev.filter((_, i) => i !== idx));
    const updateEquipo = (idx: number, field: keyof EquipoSeleccionado, value: string) => {
        setEquiposSeleccionados(prev => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
        setDirty(true);
    };
    const equiposUsados = new Set(equiposSeleccionados.map(e => e.equipoId).filter(Boolean));

    // Equipos helpers (edicion)
    const toggleEliminarEquipo = (id: string) => {
        setEquiposAsignados(prev => prev.map(e => e.id === id ? { ...e, _eliminar: !e._eliminar } : e));
        setDirty(true);
    };
    const addEquipoNuevo = () =>
        setEquiposNuevos(prev => [...prev, { equipoId: '', fechaInicio: '', horometroInicial: '' }]);
    const removeEquipoNuevo = (idx: number) =>
        setEquiposNuevos(prev => prev.filter((_, i) => i !== idx));
    const updateEquipoNuevo = (idx: number, field: keyof EquipoSeleccionado, value: string) => {
        setEquiposNuevos(prev => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
        setDirty(true);
    };
    const equiposUsadosEdit = new Set([
        ...equiposAsignados.filter(e => !e._eliminar).map(e => e.equipoId),
        ...equiposNuevos.map(e => e.equipoId).filter(Boolean),
    ]);

    // Plantillas helpers
    const addPlantilla = () =>
        setPlantillas(prev => [
            ...prev,
            { numero: prev.length + 1, metrosContratados: '', barrenos: '', fechaInicio: '', fechaFin: '', notas: '', equipos: [] },
        ]);
    const removePlantilla = (idx: number) =>
        setPlantillas(prev =>
            prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, numero: i + 1 }))
        );
    const updatePlantilla = (idx: number, field: keyof Omit<PlantillaObra, 'equipos'>, value: string) => {
        setPlantillas(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
        setDirty(true);
    };
    const addEquipoToPlantilla = (pIdx: number) => {
        setPlantillas(prev => prev.map((p, i) =>
            i === pIdx ? { ...p, equipos: [...p.equipos, { equipoId: '', fechaInicio: '' }] } : p
        ));
        setDirty(true);
    };
    const removeEquipoFromPlantilla = (pIdx: number, eIdx: number) => {
        setPlantillas(prev => prev.map((p, i) =>
            i === pIdx ? { ...p, equipos: p.equipos.filter((_, j) => j !== eIdx) } : p
        ));
        setDirty(true);
    };
    const updateEquipoInPlantilla = (pIdx: number, eIdx: number, field: 'equipoId' | 'fechaInicio', value: string) => {
        setPlantillas(prev => prev.map((p, i) =>
            i === pIdx
                ? { ...p, equipos: p.equipos.map((e, j) => j === eIdx ? { ...e, [field]: value } : e) }
                : p
        ));
        setDirty(true);
    };

    // Guardar
    const handleSave = async () => {
        setTouched(new Set(['nombre', 'clienteId', 'fechaFin']));
        if (!form.nombre.trim()) { setSaveError('El nombre de la obra es requerido'); return; }
        if (!form.clienteId)     { setSaveError('Debes seleccionar un cliente del catalogo'); return; }
        if (fieldErrors.fechaFin){ setSaveError(fieldErrors.fechaFin); return; }

        const equiposValidos = equiposSeleccionados.filter(e => e.equipoId);
        if (!isEdit && equiposValidos.length === 0) {
            setSaveError('Debes asignar al menos un equipo a la obra');
            return;
        }
        const plantillasValidas = plantillas.filter(p => p.metrosContratados);
        if (!isEdit && plantillasValidas.length === 0) {
            setSaveError('Debes agregar al menos una plantilla con metros contratados');
            return;
        }

        setSaving(true); setSaveError('');
        try {
            const body: Record<string, unknown> = {
                nombre:            form.nombre.trim(),
                clienteId:         form.clienteId || null,
                ubicacion:         form.ubicacion  || null,
                metrosContratados: form.metrosContratados ? Number(form.metrosContratados) : null,
                precioUnitario:    form.precioUnitario    ? Number(form.precioUnitario)    : null,
                moneda:            form.moneda,
                fechaInicio:       form.fechaInicio       || null,
                fechaFin:          form.fechaFin          || null,
                status:            form.status,
                bordo:             form.bordo         ? Number(form.bordo)         : null,
                espaciamiento:     form.espaciamiento ? Number(form.espaciamiento) : null,
                notas:             form.notas         || null,
            };

            let obraId = obra?.id ?? '';

            if (!isEdit) {
                body.equipos = equiposValidos.map(e => ({
                    equipoId:         e.equipoId,
                    fechaInicio:      e.fechaInicio || form.fechaInicio || undefined,
                    horometroInicial: e.horometroInicial ? Number(e.horometroInicial) : null,
                }));
                body.plantillas = plantillasValidas.map(p => ({
                    numero:            p.numero,
                    metrosContratados: Number(p.metrosContratados),
                    barrenos:          p.barrenos ? Number(p.barrenos) : 0,
                    fechaInicio:       p.fechaInicio || null,
                    fechaFin:          p.fechaFin   || null,
                    notas:             p.notas      || null,
                }));
                const created: any = await fetchApi('/obras', { method: 'POST', body: JSON.stringify(body) });
                obraId = created.id;
            }

            if (isEdit) {
                body.plantillas = plantillasValidas.map(p => ({
                    id:                p.id || undefined,
                    numero:            p.numero,
                    metrosContratados: Number(p.metrosContratados),
                    barrenos:          p.barrenos ? Number(p.barrenos) : 0,
                    fechaInicio:       p.fechaInicio || null,
                    fechaFin:          p.fechaFin   || null,
                    notas:             p.notas      || null,
                }));
                body.equiposActualizados = equiposAsignados
                    .filter(e => !e._eliminar)
                    .map(e => ({
                        id:          e.id,
                        equipoId:    e.equipoId,
                        fechaInicio: e.fechaInicio || null,
                        fechaFin:    e.fechaFin    || null,
                    }));
                body.equiposEliminados = equiposAsignados.filter(e => e._eliminar).map(e => e.id);
                const nuevosValidos = equiposNuevos.filter(e => e.equipoId);
                if (nuevosValidos.length > 0) {
                    body.equiposNuevos = nuevosValidos.map(e => ({
                        equipoId:         e.equipoId,
                        fechaInicio:      e.fechaInicio || null,
                        horometroInicial: e.horometroInicial ? Number(e.horometroInicial) : null,
                    }));
                }
                await fetchApi(`/obras/${obra!.id}`, { method: 'PUT', body: JSON.stringify(body) });
            }

            if (plantillasValidas.some(p => p.equipos.length > 0)) {
                setSavingPlantillaEquipo(true);
                try {
                    const obraActualizada: any = await fetchApi(`/obras/${obraId}`);
                    const plantillasDB: any[] = obraActualizada.plantillas ?? [];
                    for (const plt of plantillasValidas) {
                        const pDB = plantillasDB.find((p: any) => p.numero === plt.numero);
                        if (!pDB) continue;
                        const eqValidos = plt.equipos.filter(e => e.equipoId);
                        for (const eq of eqValidos) {
                            const yaAsignado = (pDB.plantillaEquipos ?? []).some((pe: any) => pe.equipoId === eq.equipoId);
                            if (!yaAsignado) {
                                await fetchApi(`/obras/${obraId}/plantillas/${pDB.id}/equipos`, {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        equipoId:    eq.equipoId,
                                        fechaInicio: eq.fechaInicio || plt.fechaInicio || null,
                                    }),
                                }).catch(() => {});
                            }
                        }
                    }
                } finally {
                    setSavingPlantillaEquipo(false);
                }
            }

            onSaved();
        } catch (e: any) {
            setSaveError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    // Input helper
    const inp = (
        label: string,
        key: keyof typeof form,
        type = 'text',
        placeholder = '',
        tooltip?: string,
        required = false
    ) => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
                {tooltip && <Tooltip text={tooltip} />}
            </label>
            <input
                type={type}
                value={String(form[key])}
                onChange={handleFieldChange(key)}
                onBlur={() => handleBlur(key)}
                placeholder={placeholder}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
                    fieldErrors[key]
                        ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400 bg-red-50/30'
                        : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
            />
            <FieldError msg={fieldErrors[key]} />
        </div>
    );

    // Step 1: Datos generales
    const renderStep1 = () => (
        <div className="space-y-5">
            <SectionBlock color="blue" title="Identificacion">
                <div className="grid grid-cols-2 gap-3">
                    {inp('Nombre de la obra', 'nombre', 'text', 'Ej: Mina El Toro - Fase 2', undefined, true)}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <select
                            value={form.status}
                            onChange={handleFieldChange('status')}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="ACTIVA">Activa</option>
                            <option value="PAUSADA">Pausada</option>
                            <option value="TERMINADA">Terminada</option>
                        </select>
                    </div>
                </div>
                <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center">
                        Cliente <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <select
                        value={form.clienteId}
                        onChange={handleFieldChange('clienteId')}
                        onBlur={() => handleBlur('clienteId')}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
                            fieldErrors.clienteId
                                ? 'border-red-300 focus:ring-red-500/20 bg-red-50/30'
                                : 'border-gray-200 focus:ring-blue-500/20'
                        }`}
                    >
                        <option value="">Selecciona un cliente</option>
                        {clientes.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                    <FieldError msg={fieldErrors.clienteId} />
                    {clientes.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                            No hay clientes en el catalogo.{' '}
                            <a href="/dashboard/clients" className="underline">Crear cliente</a>
                        </p>
                    )}
                </div>
                <div className="mt-3">
                    {inp('Ubicacion', 'ubicacion', 'text', 'Ej: Mun. Alamos, Sonora')}
                </div>
            </SectionBlock>

            <SectionBlock color="purple" title="Fechas del proyecto">
                <div className="grid grid-cols-2 gap-3">
                    {inp('Fecha inicio', 'fechaInicio', 'date')}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Fecha fin estimada
                        </label>
                        <input
                            type="date"
                            value={form.fechaFin}
                            onChange={handleFieldChange('fechaFin')}
                            onBlur={() => handleBlur('fechaFin')}
                            min={form.fechaInicio || undefined}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
                                fieldErrors.fechaFin
                                    ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500 bg-red-50/30'
                                    : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500'
                            }`}
                        />
                        <FieldError msg={fieldErrors.fechaFin} />
                    </div>
                </div>
            </SectionBlock>

            <SectionBlock color="teal" title="Notas internas">
                <textarea
                    value={form.notas}
                    onChange={e => { setForm(f => ({ ...f, notas: e.target.value })); setDirty(true); }}
                    rows={2}
                    placeholder="Observaciones generales sobre la obra..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
            </SectionBlock>
        </div>
    );

    // Step 2: Contrato y malla
    const renderStep2 = () => (
        <div className="space-y-5">
            <SectionBlock color="blue" title="Contrato">
                <div className="grid grid-cols-2 gap-3">
                    {inp(
                        'Metros contratados totales (m)',
                        'metrosContratados',
                        'number',
                        '2000',
                        'Total de metros de perforacion comprometidos en el contrato con el cliente.'
                    )}
                    {inp(
                        'Precio unitario ($/m)',
                        'precioUnitario',
                        'number',
                        '24.50',
                        'Precio pactado por cada metro perforado, en la moneda seleccionada.'
                    )}
                </div>
                <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
                    <select
                        value={form.moneda}
                        onChange={handleFieldChange('moneda')}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="MXN">MXN - Peso mexicano</option>
                        <option value="USD">USD - Dolar</option>
                    </select>
                </div>
                <div className={`mt-3 rounded-xl px-4 py-3 flex justify-between items-center border transition-colors ${
                    importeTotal !== null
                        ? 'bg-blue-50 border-blue-100'
                        : 'bg-gray-50 border-gray-100'
                }`}>
                    <span className={`text-xs font-medium ${importeTotal !== null ? 'text-blue-600' : 'text-gray-400'}`}>
                        Importe total del contrato
                    </span>
                    <span className={`text-sm font-bold ${importeTotal !== null ? 'text-blue-700' : 'text-gray-300'}`}>
                        {importeTotal !== null
                            ? `$${fmtMoney(importeTotal)} ${form.moneda}`
                            : '—'}
                    </span>
                </div>
            </SectionBlock>

            <SectionBlock color="amber" title="Malla de perforacion">
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                    La malla define la distribucion espacial de los barrenos. El area se calcula automaticamente a partir del bordo y el espaciamiento.
                </p>
                <div className="grid grid-cols-3 gap-3">
                    {inp(
                        'Bordo (m)',
                        'bordo',
                        'number',
                        '2.7',
                        'Distancia entre filas de barrenos, medida de centro a centro.'
                    )}
                    {inp(
                        'Espaciamiento (m)',
                        'espaciamiento',
                        'number',
                        '3.0',
                        'Distancia entre barrenos dentro de la misma fila, medida de centro a centro.'
                    )}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center">
                            Area (m2)
                            <Tooltip text="Calculado automaticamente: Bordo x Espaciamiento." />
                        </label>
                        <div className={`px-3 py-2 rounded-lg text-sm border ${
                            areaCalculada
                                ? 'bg-amber-50 border-amber-100 text-amber-700 font-semibold'
                                : 'bg-gray-50 border-gray-200 text-gray-400'
                        }`}>
                            {areaCalculada ?? '—'}
                        </div>
                    </div>
                </div>
            </SectionBlock>
        </div>
    );

    // Step 3: Plantillas y equipos
    const renderStep3 = () => (
        <div className="space-y-5">
            <SectionBlock color="green" title="Plantillas de perforacion">
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-4">
                    <p className="text-xs text-green-800 leading-relaxed">
                        Cada plantilla representa un <strong>bloque o zona de trabajo</strong> dentro de la obra, con sus propios metros contratados y equipos.
                        Agrega mas de una si la obra se divide en fases o sectores.
                    </p>
                </div>

                <div className="flex justify-end mb-2">
                    <button type="button" onClick={addPlantilla}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Plus size={12} /> Agregar plantilla
                    </button>
                </div>

                <div className="space-y-3">
                    {plantillas.map((plt, idx) => {
                        const bordoN        = Number(form.bordo);
                        const espacN        = Number(form.espaciamiento);
                        const metros        = Number(plt.metrosContratados);
                        const areaPlantilla = bordoN && espacN ? (bordoN * espacN).toFixed(2) : null;
                        const volEstimado   = areaPlantilla && metros
                            ? (Number(areaPlantilla) * metros).toFixed(1) : null;

                        const equiposEnEstaPlantilla = new Set(plt.equipos.map(e => e.equipoId).filter(Boolean));
                        const equiposEnOtras = new Set(
                            plantillas.flatMap((p, i) => i === idx ? [] : p.equipos.map(e => e.equipoId).filter(Boolean))
                        );

                        return (
                            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-3 pt-3 pb-2 bg-gray-50">
                                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                                            {plt.numero}
                                        </span>
                                        Plantilla {plt.numero}
                                    </span>
                                    {plantillas.length > 1 && (
                                        <button type="button" onClick={() => removePlantilla(idx)}
                                            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                                            <X size={13} />
                                        </button>
                                    )}
                                </div>

                                <div className="px-3 pb-3 pt-2 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1 flex items-center">
                                                Metros contratados
                                                <span className="text-red-500 ml-0.5">*</span>
                                                <Tooltip text="Total de metros de perforacion asignados a esta plantilla especifica." />
                                            </label>
                                            <input type="number" placeholder="841.50" value={plt.metrosContratados}
                                                onChange={e => updatePlantilla(idx, 'metrosContratados', e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1 flex items-center">
                                                Barrenos
                                                <Tooltip text="Numero total de barrenos (pozos) contemplados en esta plantilla." />
                                            </label>
                                            <input type="number" placeholder="89" value={plt.barrenos}
                                                onChange={e => updatePlantilla(idx, 'barrenos', e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
                                            <input type="date" value={plt.fechaInicio}
                                                onChange={e => updatePlantilla(idx, 'fechaInicio', e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">
                                                Fecha fin <span className="text-gray-400 font-normal">(opcional)</span>
                                            </label>
                                            <input type="date" value={plt.fechaFin}
                                                onChange={e => updatePlantilla(idx, 'fechaFin', e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                        </div>
                                    </div>

                                    {(areaPlantilla || volEstimado) && (
                                        <div className="flex gap-4 bg-blue-50 rounded-lg px-3 py-2 text-xs">
                                            {areaPlantilla && (
                                                <span className="text-blue-600">
                                                    Area: <strong>{areaPlantilla} m2</strong>
                                                    <span className="text-blue-400 ml-1">({form.bordo} x {form.espaciamiento})</span>
                                                </span>
                                            )}
                                            {volEstimado && (
                                                <span className="text-blue-700 font-medium">
                                                    Vol. estimado: <strong>{Number(volEstimado).toLocaleString('es-MX')} m3</strong>
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="border-t border-gray-100 pt-2 mt-1">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-500">
                                                Equipos de esta plantilla
                                                <span className="text-gray-400 font-normal ml-1">
                                                    {plt.equipos.length === 0 ? '— usara los de la obra' : `(${plt.equipos.length})`}
                                                </span>
                                            </span>
                                            <button type="button" onClick={() => addEquipoToPlantilla(idx)}
                                                className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                                                <Plus size={11} /> Asignar equipo
                                            </button>
                                        </div>

                                        {plt.equipos.length > 0 && (
                                            <div className="space-y-1.5">
                                                {plt.equipos.map((eq, eIdx) => (
                                                    <div key={eIdx} className="flex gap-2 items-end">
                                                        <div className="flex-1">
                                                            <select
                                                                value={eq.equipoId}
                                                                onChange={e => updateEquipoInPlantilla(idx, eIdx, 'equipoId', e.target.value)}
                                                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                                                                <option value="">Selecciona equipo</option>
                                                                {equipos.map(e => (
                                                                    <option key={e.id} value={e.id}
                                                                        disabled={equiposEnEstaPlantilla.has(e.id) && eq.equipoId !== e.id}>
                                                                        {e.nombre}{e.numeroEconomico ? ` (${e.numeroEconomico})` : ''}
                                                                        {equiposEnOtras.has(e.id) && eq.equipoId !== e.id ? ' - tambien en otra plt.' : ''}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <button type="button" onClick={() => removeEquipoFromPlantilla(idx, eIdx)}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </SectionBlock>

            {isEdit ? (
                <SectionBlock color="teal" title="Equipos de la obra">
                    <p className="text-xs text-gray-400 mb-3">Equipos disponibles para todas las plantillas.</p>
                    <div className="flex justify-end mb-2">
                        <button type="button" onClick={addEquipoNuevo}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <Plus size={12} /> Agregar equipo
                        </button>
                    </div>
                    {loadingEquipos ? (
                        <p className="text-xs text-gray-400 py-2">Cargando equipos...</p>
                    ) : (
                        <div className="space-y-2">
                            {equiposAsignados.map(eq => (
                                <div key={eq.id}
                                    className={`border rounded-xl p-3 flex items-center gap-3 transition-colors ${eq._eliminar ? 'bg-red-50 border-red-200 opacity-60' : 'bg-gray-50/50 border-gray-100'}`}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-700 truncate">
                                            {eq.nombre}{eq.numeroEconomico ? ` (${eq.numeroEconomico})` : ''}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            Desde {eq.fechaInicio || '—'}
                                            {eq.fechaFin ? ` hasta ${eq.fechaFin}` : ' activo'}
                                        </p>
                                    </div>
                                    <button type="button" onClick={() => toggleEliminarEquipo(eq.id)}
                                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${eq._eliminar
                                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}>
                                        {eq._eliminar ? 'Deshacer' : <Trash2 size={13} />}
                                    </button>
                                </div>
                            ))}

                            {equiposNuevos.map((eq, idx) => (
                                <div key={idx} className="border border-blue-200 rounded-xl p-3 bg-blue-50/30 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-blue-600">Nuevo equipo</span>
                                        <button type="button" onClick={() => removeEquipoNuevo(idx)}
                                            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                                            <X size={13} />
                                        </button>
                                    </div>
                                    <div className="flex gap-2 flex-wrap items-end">
                                        <div className="flex-1 min-w-[160px]">
                                            <label className="block text-xs text-gray-500 mb-1">Equipo</label>
                                            <select value={eq.equipoId}
                                                onChange={e => updateEquipoNuevo(idx, 'equipoId', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                                <option value="">Selecciona</option>
                                                {equipos.map(e => (
                                                    <option key={e.id} value={e.id}
                                                        disabled={equiposUsadosEdit.has(e.id) && eq.equipoId !== e.id}>
                                                        {e.nombre}{e.numeroEconomico ? ` (${e.numeroEconomico})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Fecha asignacion</label>
                                            <input type="date" value={eq.fechaInicio}
                                                onChange={e => updateEquipoNuevo(idx, 'fechaInicio', e.target.value)}
                                                className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1 flex items-center">
                                                Horometro inicial (hrs)
                                                <Tooltip text="Horas acumuladas en el equipo al momento de asignarlo a esta obra." />
                                            </label>
                                            <input type="number" placeholder="7662" value={eq.horometroInicial}
                                                onChange={e => updateEquipoNuevo(idx, 'horometroInicial', e.target.value)}
                                                className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {equiposAsignados.length === 0 && equiposNuevos.length === 0 && (
                                <p className="text-xs text-gray-400 py-1">Sin equipos asignados a la obra.</p>
                            )}
                        </div>
                    )}
                </SectionBlock>
            ) : (
                <SectionBlock color="teal" title="Equipos asignados">
                    <p className="text-xs text-gray-400 mb-3">
                        Selecciona los equipos que trabajaran en esta obra. Cada equipo requiere la fecha de asignacion y su horometro de entrada.
                    </p>
                    <div className="flex justify-end mb-2">
                        <button type="button" onClick={addEquipo}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <Plus size={12} /> Agregar equipo
                        </button>
                    </div>
                    <div className="space-y-2">
                        {equiposSeleccionados.map((eq, idx) => (
                            <div key={idx} className="flex gap-2 items-end flex-wrap">
                                <div className="flex-1 min-w-[160px]">
                                    {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Equipo</label>}
                                    <select value={eq.equipoId}
                                        onChange={e => updateEquipo(idx, 'equipoId', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                        <option value="">Selecciona</option>
                                        {equipos.map(e => (
                                            <option key={e.id} value={e.id}
                                                disabled={equiposUsados.has(e.id) && eq.equipoId !== e.id}>
                                                {e.nombre}{e.numeroEconomico ? ` (${e.numeroEconomico})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    {idx === 0 && <label className="block text-xs text-gray-500 mb-1">Fecha asignacion</label>}
                                    <input type="date" value={eq.fechaInicio}
                                        onChange={e => updateEquipo(idx, 'fechaInicio', e.target.value)}
                                        className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div>
                                    {idx === 0 && (
                                        <label className="block text-xs text-gray-500 mb-1 flex items-center">
                                            Horometro inicial (hrs)
                                            <Tooltip text="Horas acumuladas en el equipo al momento de asignarlo a esta obra." />
                                        </label>
                                    )}
                                    <input type="number" placeholder="7662" value={eq.horometroInicial}
                                        onChange={e => updateEquipo(idx, 'horometroInicial', e.target.value)}
                                        className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                {equiposSeleccionados.length > 1 && (
                                    <button type="button" onClick={() => removeEquipo(idx)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mb-0.5">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    {equipos.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                            No hay equipos registrados.{' '}
                            <a href="/dashboard/equipos" className="underline">Crear equipo</a>
                        </p>
                    )}
                </SectionBlock>
            )}
        </div>
    );

    // Footer con navegacion y razon de bloqueo
    const renderFooter = () => {
        const isLastStep = step === 3;
        const isSaveDisabled = saving || savingPlantillaEquipo || !!fieldErrors.fechaFin;

        let blockReason = '';
        if (step === 1 && !canAdvanceStep1) {
            if (!form.nombre.trim() && !form.clienteId) blockReason = 'Completa el nombre y selecciona un cliente para continuar';
            else if (!form.nombre.trim()) blockReason = 'El nombre de la obra es requerido';
            else blockReason = 'Debes seleccionar un cliente para continuar';
        }
        if (step === 2 && !canAdvanceStep2) blockReason = fieldErrors.fechaFin || '';
        if (isLastStep && isSaveDisabled && !saving && !savingPlantillaEquipo) {
            blockReason = 'Corrige los errores arriba para continuar';
        }

        return (
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl">
                {saveError && (
                    <p className="text-xs text-red-500 mb-3 flex items-center gap-1">
                        <AlertTriangle size={12} />{saveError}
                    </p>
                )}
                {blockReason && !saveError && (
                    <p className="text-xs text-amber-600 mb-3 flex items-center gap-1">
                        <AlertTriangle size={12} />{blockReason}
                    </p>
                )}
                <div className="flex gap-2">
                    {step > 1 ? (
                        <button onClick={() => setStep(s => s - 1)}
                            className="flex items-center gap-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                            <ChevronLeft size={14} /> Anterior
                        </button>
                    ) : (
                        <button onClick={handleClose}
                            className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                            Cancelar
                        </button>
                    )}

                    {!isLastStep ? (
                        <button
                            onClick={() => {
                                if (step === 1) {
                                    setTouched(prev => new Set([...prev, 'nombre', 'clienteId']));
                                    if (!canAdvanceStep1) return;
                                }
                                if (step === 2 && !canAdvanceStep2) return;
                                goToStep(step + 1);
                            }}
                            disabled={(step === 1 && !canAdvanceStep1) || (step === 2 && !canAdvanceStep2)}
                            className="flex-1 flex items-center justify-center gap-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Siguiente <ChevronRight size={14} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={isSaveDisabled}
                            className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {savingPlantillaEquipo ? 'Asignando equipos...' : saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear obra'}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-2xl z-10">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">{isEdit ? 'Editar Obra' : 'Nueva Obra'}</h2>
                            <p className="text-xs text-gray-400 mt-0.5">Contrato / proyecto de perforacion</p>
                        </div>
                        <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                    <StepIndicator current={step} completed={completedSteps} />
                </div>

                <div className="px-6 py-5 flex-1 overflow-y-auto">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </div>

                {renderFooter()}
            </div>
        </div>
    );
}

// ─── Pagina principal ─────────────────────────────────────────────────────────
export default function ObrasPage() {
    const [obras,    setObras]    = useState<Obra[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [equipos,  setEquipos]  = useState<Equipo[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');
    const [filtro,   setFiltro]   = useState<'TODAS' | 'ACTIVA' | 'PAUSADA' | 'TERMINADA'>('TODAS');
    const [busqueda, setBusqueda] = useState('');
    const [modal,    setModal]    = useState<{ open: boolean; obra?: Obra }>({ open: false });
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; nombre: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [obs, cls, eqs] = await Promise.all([
                fetchApi('/obras'),
                fetchApi('/clients'),
                fetchApi('/equipos'),
            ]);
            setObras(obs);
            setClientes(cls);
            setEquipos(eqs);
        } catch (e: any) {
            setError(e.message || 'Error al cargar obras');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async () => {
        if (!deleteModal) return;
        setDeleting(true);
        try {
            await fetchApi(`/obras/${deleteModal.id}`, { method: 'DELETE' });
            setObras(o => o.filter(x => x.id !== deleteModal.id));
            setDeleteModal(null);
        } catch (e: any) {
            alert(e.message || 'Error al eliminar');
        } finally {
            setDeleting(false);
        }
    };

    const obrasFiltradas = obras
        .filter(o => filtro === 'TODAS' || o.status === filtro)
        .filter(o => {
            if (!busqueda.trim()) return true;
            const q = busqueda.toLowerCase();
            return (
                o.nombre.toLowerCase().includes(q) ||
                (o.cliente?.nombre ?? '').toLowerCase().includes(q)
            );
        });

    const activas    = obras.filter(o => o.status === 'ACTIVA').length;
    const pausadas   = obras.filter(o => o.status === 'PAUSADA').length;
    const terminadas = obras.filter(o => o.status === 'TERMINADA').length;
    const totalFacturado = obras.reduce((a, o) => a + (o.metricas?.montoFacturado ?? 0), 0);
    const metrosTotales  = obras
        .filter(o => o.status === 'ACTIVA')
        .reduce((a, o) => a + (o.metricas?.metrosPerforados ?? 0), 0);

    const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 0 });

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Obras</h1>
                    <p className="text-sm text-gray-500 mt-1">Contratos de perforacion activos e historicos.</p>
                </div>
                <button onClick={() => setModal({ open: true })}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                    <Plus size={16} /> Nueva Obra
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            {!loading && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                        { label: 'Activas',    value: activas,    color: 'text-green-600' },
                        { label: 'Pausadas',   value: pausadas,   color: 'text-yellow-600' },
                        { label: 'Terminadas', value: terminadas, color: 'text-gray-500' },
                        { label: 'Total facturado',             value: `$${fmt(totalFacturado)}`, color: 'text-blue-600' },
                        { label: 'Metros perforados (activas)', value: `${fmt(metrosTotales)} m`, color: 'text-purple-600' },
                    ].map(k => (
                        <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-2 flex-wrap">
                    {(['TODAS', 'ACTIVA', 'PAUSADA', 'TERMINADA'] as const).map(f => (
                        <button key={f} onClick={() => setFiltro(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                filtro === f
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}>
                            {f === 'TODAS' ? 'Todas' : f.charAt(0) + f.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
                <div className="relative sm:ml-auto">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar obra o cliente..."
                        className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-52" />
                    {busqueda && (
                        <button onClick={() => setBusqueda('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>

            <Card>
                {loading ? (
                    <div className="p-10 text-center text-gray-400 text-sm">Cargando obras...</div>
                ) : obrasFiltradas.length === 0 ? (
                    <div className="p-10 text-center">
                        <HardHat size={36} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-600">
                            {busqueda
                                ? `Sin resultados para "${busqueda}"`
                                : filtro === 'TODAS' ? 'No hay obras registradas' : `No hay obras con status "${filtro}"`}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            {busqueda ? 'Intenta con otro termino de busqueda.' : 'Crea la primera obra con el boton de arriba.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Obra</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipos activos</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Avance</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Facturado</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Status</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {obrasFiltradas.map(obra => {
                                    const pct = obra.metricas?.pctAvance;
                                    const equiposActivos = obra.obraEquipos;
                                    return (
                                        <tr key={obra.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                                                        <HardHat size={14} className="text-orange-600" />
                                                    </div>
                                                    <div>
                                                        <Link href={`/dashboard/obras/${obra.id}`}
                                                            className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors">
                                                            {obra.nombre}
                                                        </Link>
                                                        {obra.ubicacion && (
                                                            <p className="text-xs text-gray-400">{obra.ubicacion}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-sm text-gray-500">
                                                {obra.cliente?.nombre ?? '—'}
                                            </td>
                                            <td className="p-3">
                                                {equiposActivos.length === 0 ? (
                                                    <span className="text-xs text-gray-300">—</span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {equiposActivos.slice(0, 2).map((oe, i) => (
                                                            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                                                {oe.equipo.nombre}
                                                            </span>
                                                        ))}
                                                        {equiposActivos.length > 2 && (
                                                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                                                                +{equiposActivos.length - 2}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                {pct !== null && pct !== undefined ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500 rounded-full"
                                                                style={{ width: `${Math.min(pct, 100)}%` }} />
                                                        </div>
                                                        <span className="text-xs font-semibold text-gray-700 w-10 text-right">
                                                            {pct.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                                <p className="text-xs text-gray-400 mt-0.5 text-right">
                                                    {fmt(obra.metricas?.metrosPerforados ?? 0)} m
                                                    {obra.metrosContratados ? ` / ${fmt(obra.metrosContratados)} m` : ''}
                                                </p>
                                            </td>
                                            <td className="p-3 text-right">
                                                <span className="text-sm font-semibold text-gray-700">
                                                    ${fmt(obra.metricas?.montoFacturado ?? 0)}
                                                </span>
                                                <p className="text-xs text-gray-400">{obra.moneda}</p>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[obra.status]}`}>
                                                    {STATUS_ICON[obra.status]}
                                                    {obra.status.charAt(0) + obra.status.slice(1).toLowerCase()}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Link href={`/dashboard/obras/${obra.id}`}
                                                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-colors inline-flex"
                                                        title="Ver detalle">
                                                        <Eye size={15} />
                                                    </Link>
                                                    <button onClick={() => setModal({ open: true, obra })}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                        title="Editar">
                                                        <Edit size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteModal({ open: true, id: obra.id, nombre: obra.nombre })}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                        title="Eliminar">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {modal.open && (
                <ObraModal
                    obra={modal.obra}
                    clientes={clientes}
                    equipos={equipos}
                    onClose={() => setModal({ open: false })}
                    onSaved={() => { setModal({ open: false }); load(); }}
                />
            )}

            {deleteModal?.open && (
                <DeleteConfirmModal
                    nombre={deleteModal.nombre}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteModal(null)}
                    loading={deleting}
                />
            )}
        </div>
    );
}
