"use client";

import React, { useEffect, useState } from 'react';
import {
    HardHat, Plus, Edit, Trash2, Eye,
    CheckCircle, Clock, PauseCircle, Search, X, AlertTriangle,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

// ─── Tipos ────────────────────────────────────────────────────────────────────
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
    status: 'ACTIVA' | 'PAUSADA' | 'TERMINADA';
    notas: string | null;
    _count: { registrosDiarios: number; cortesFacturacion: number };
    obraEquipos: { equipo: { nombre: string; numeroEconomico: string | null } }[];
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

// ─── Modal confirmación eliminar ──────────────────────────────────────────────
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
                        <p className="text-xs text-gray-400">Esta acción no se puede deshacer</p>
                    </div>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                    ¿Estás seguro de que deseas eliminar <strong>"{nombre}"</strong>?
                    Solo es posible si no tiene registros asociados.
                </p>
                <div className="flex gap-2">
                    <button onClick={onCancel} disabled={loading}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex-1 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50">
                        {loading ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal Crear / Editar Obra ────────────────────────────────────────────────
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

    const [equiposSeleccionados, setEquiposSeleccionados] = useState<
        { equipoId: string; fechaInicio: string }[]
    >([{ equipoId: '', fechaInicio: '' }]);

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
        notas:             obra?.notas             ?? '',
    });
    const [dirty,  setDirty]  = useState(false);
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    const handleFieldChange = (key: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            setForm(f => ({ ...f, [key]: e.target.value }));
            setDirty(true);
        };

    const fechaError =
        form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio
            ? 'La fecha fin no puede ser anterior a la fecha de inicio'
            : '';

    const importeTotal =
        form.metrosContratados && form.precioUnitario
            ? Number(form.metrosContratados) * Number(form.precioUnitario)
            : null;
    const fmtMoney = (n: number) =>
        n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handleClose = () => {
        if (dirty && !confirm('Tienes cambios sin guardar. ¿Descartar cambios?')) return;
        onClose();
    };

    const addEquipo = () =>
        setEquiposSeleccionados(prev => [...prev, { equipoId: '', fechaInicio: '' }]);

    const removeEquipo = (idx: number) =>
        setEquiposSeleccionados(prev => prev.filter((_, i) => i !== idx));

    const updateEquipo = (idx: number, field: 'equipoId' | 'fechaInicio', value: string) => {
        setEquiposSeleccionados(prev =>
            prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e))
        );
        setDirty(true);
    };

    const equiposUsados = new Set(equiposSeleccionados.map(e => e.equipoId).filter(Boolean));

    const handleSave = async () => {
        if (!form.nombre.trim()) { setError('El nombre de la obra es requerido'); return; }
        if (!form.clienteId)     { setError('Debes seleccionar un cliente del catálogo'); return; }
        if (fechaError)          { setError(fechaError); return; }

        const equiposValidos = equiposSeleccionados.filter(e => e.equipoId);
        if (!isEdit && equiposValidos.length === 0) {
            setError('Debes asignar al menos un equipo a la obra');
            return;
        }

        setSaving(true); setError('');
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
                notas:             form.notas             || null,
            };
            if (!isEdit) {
                body.equipos = equiposValidos.map(e => ({
                    equipoId:    e.equipoId,
                    fechaInicio: e.fechaInicio || form.fechaInicio || undefined,
                }));
            }
            if (isEdit) {
                await fetchApi(`/obras/${obra!.id}`, { method: 'PUT', body: JSON.stringify(body) });
            } else {
                await fetchApi('/obras', { method: 'POST', body: JSON.stringify(body) });
            }
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const inp = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input type={type} value={String(form[key])} onChange={handleFieldChange(key)}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-800">{isEdit ? 'Editar Obra' : 'Nueva Obra'}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Contrato / proyecto de perforación</p>
                </div>

                <div className="px-6 py-5 space-y-5">

                    {/* Nombre y status */}
                    <div className="grid grid-cols-2 gap-3">
                        {inp('Nombre de la obra *', 'nombre', 'text', 'Ej: Mina El Toro – Frente 3')}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                            <select value={form.status} onChange={handleFieldChange('status')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="ACTIVA">Activa</option>
                                <option value="PAUSADA">Pausada</option>
                                <option value="TERMINADA">Terminada</option>
                            </select>
                        </div>
                    </div>

                    {/* Cliente — solo catálogo */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Cliente <span className="text-red-500">*</span>
                        </label>
                        <select value={form.clienteId} onChange={handleFieldChange('clienteId')}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                            <option value="">— Selecciona un cliente —</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                        </select>
                        {clientes.length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">
                                No hay clientes en el catálogo.{' '}
                                <a href="/dashboard/clients" className="underline">Crear cliente →</a>
                            </p>
                        )}
                    </div>

                    {inp('Ubicación', 'ubicacion', 'text', 'Ej: Mun. Álamos, Sonora')}

                    {/* Contrato */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contrato</p>
                        <div className="grid grid-cols-2 gap-3">
                            {inp('Metros contratados (mt ln)', 'metrosContratados', 'number', '2000')}
                            {inp('Precio unitario ($/m³ o mt)', 'precioUnitario', 'number', '24.50')}
                        </div>
                        <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
                            <select value={form.moneda} onChange={handleFieldChange('moneda')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="MXN">MXN – Peso mexicano</option>
                                <option value="USD">USD – Dólar</option>
                            </select>
                        </div>
                        {importeTotal !== null && (
                            <div className="mt-3 bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center">
                                <span className="text-xs text-blue-600 font-medium">Importe total del contrato</span>
                                <span className="text-sm font-bold text-blue-700">
                                    ${fmtMoney(importeTotal)} {form.moneda}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Fechas con validación cruzada */}
                    <div className="grid grid-cols-2 gap-3">
                        {inp('Fecha inicio', 'fechaInicio', 'date')}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin estimada</label>
                            <input type="date" value={form.fechaFin} onChange={handleFieldChange('fechaFin')}
                                min={form.fechaInicio || undefined}
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                                    fechaError
                                        ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                                        : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500'
                                }`} />
                        </div>
                    </div>
                    {fechaError && <p className="text-xs text-red-500 -mt-3">{fechaError}</p>}

                    {/* Equipos: lista dinámica (solo en creación) */}
                    {!isEdit && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Equipos asignados <span className="text-red-500">*</span>
                                </p>
                                <button type="button" onClick={addEquipo}
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                    <Plus size={12} /> Agregar equipo
                                </button>
                            </div>
                            <div className="space-y-2">
                                {equiposSeleccionados.map((eq, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <select value={eq.equipoId}
                                            onChange={e => updateEquipo(idx, 'equipoId', e.target.value)}
                                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                            <option value="">— Selecciona un equipo —</option>
                                            {equipos.map(e => (
                                                <option key={e.id} value={e.id}
                                                    disabled={equiposUsados.has(e.id) && eq.equipoId !== e.id}>
                                                    {e.nombre}{e.numeroEconomico ? ` (${e.numeroEconomico})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <input type="date" value={eq.fechaInicio}
                                            onChange={e => updateEquipo(idx, 'fechaInicio', e.target.value)}
                                            className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                        {equiposSeleccionados.length > 1 && (
                                            <button type="button" onClick={() => removeEquipo(idx)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {equipos.length === 0 && (
                                <p className="text-xs text-amber-600 mt-1">
                                    No hay equipos registrados.{' '}
                                    <a href="/dashboard/equipos" className="underline">Crear equipo →</a>
                                </p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                        <textarea value={form.notas}
                            onChange={e => { setForm(f => ({ ...f, notas: e.target.value })); setDirty(true); }}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
                    </div>
                </div>

                {error && <p className="text-xs text-red-500 px-6 pb-2">{error}</p>}

                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex gap-2">
                    <button onClick={handleClose}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving || !!fechaError}
                        className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50">
                        {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear obra'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────
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

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Obras</h1>
                    <p className="text-sm text-gray-500 mt-1">Contratos de perforación activos e históricos.</p>
                </div>
                <button onClick={() => setModal({ open: true })}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                    <Plus size={16} /> Nueva Obra
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            {/* KPIs */}
            {!loading && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                        { label: 'Activas',    value: activas,    color: 'text-green-600' },
                        { label: 'Pausadas',   value: pausadas,   color: 'text-yellow-600' },
                        { label: 'Terminadas', value: terminadas, color: 'text-gray-500' },
                        { label: 'Total facturado',              value: `$${fmt(totalFacturado)}`, color: 'text-blue-600' },
                        { label: 'Metros perforados (activas)',  value: `${fmt(metrosTotales)} m`, color: 'text-purple-600' },
                    ].map(k => (
                        <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filtros + búsqueda */}
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

            {/* Tabla */}
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
                            {busqueda ? 'Intenta con otro término de búsqueda.' : 'Crea la primera obra con el botón de arriba.'}
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
                                            {/* Todos los equipos activos */}
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
