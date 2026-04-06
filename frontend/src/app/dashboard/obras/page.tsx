"use client";

import React, { useEffect, useState } from 'react';
import {
    HardHat, Plus, Edit, Trash2, Eye,
    TrendingUp, CheckCircle, Clock, PauseCircle,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Obra = {
    id: string;
    nombre: string;
    clienteNombre: string | null;
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
    const [form, setForm] = useState({
        nombre:            obra?.nombre            ?? '',
        clienteId:         obra?.cliente ? (clientes.find(c => c.nombre === obra.cliente!.nombre)?.id ?? '') : '',
        clienteNombre:     obra?.clienteNombre     ?? '',
        ubicacion:         obra?.ubicacion         ?? '',
        bordo:             '',
        espesor:           '',
        metrosContratados: obra?.metrosContratados?.toString() ?? '',
        precioUnitario:    obra?.precioUnitario?.toString()    ?? '',
        moneda:            obra?.moneda            ?? 'MXN',
        fechaInicio:       obra?.fechaInicio?.slice(0, 10)     ?? '',
        fechaFin:          obra?.fechaFin?.slice(0, 10)        ?? '',
        status:            obra?.status            ?? 'ACTIVA',
        notas:             obra?.notas             ?? '',
        // Equipo inicial (solo en creación)
        equipoId:          '',
    });
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    const set = (key: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setForm(f => ({ ...f, [key]: e.target.value }));

    const handleSave = async () => {
        if (!form.nombre.trim()) { setError('El nombre de la obra es requerido'); return; }
        setSaving(true); setError('');
        try {
            const body: Record<string, unknown> = {
                nombre:            form.nombre.trim(),
                clienteId:         form.clienteId         || null,
                clienteNombre:     form.clienteNombre      || null,
                ubicacion:         form.ubicacion          || null,
                bordo:             form.bordo              ? Number(form.bordo)              : null,
                espesor:           form.espesor            ? Number(form.espesor)            : null,
                metrosContratados: form.metrosContratados  ? Number(form.metrosContratados)  : null,
                precioUnitario:    form.precioUnitario     ? Number(form.precioUnitario)     : null,
                moneda:            form.moneda,
                fechaInicio:       form.fechaInicio        || null,
                fechaFin:          form.fechaFin           || null,
                status:            form.status,
                notas:             form.notas              || null,
            };
            if (!isEdit && form.equipoId) {
                body.equipoId = form.equipoId;
                body.equipoFechaInicio = form.fechaInicio || undefined;
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
            <input
                type={type}
                value={String(form[key])}
                onChange={set(key)}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                            <select value={form.status} onChange={set('status')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="ACTIVA">Activa</option>
                                <option value="PAUSADA">Pausada</option>
                                <option value="TERMINADA">Terminada</option>
                            </select>
                        </div>
                    </div>

                    {/* Cliente */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente (catálogo)</label>
                            <select value={form.clienteId} onChange={set('clienteId')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="">— Sin cliente del catálogo —</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        {inp('Cliente (nombre libre)', 'clienteNombre', 'text', 'Si no está en catálogo')}
                    </div>

                    {inp('Ubicación', 'ubicacion', 'text', 'Ej: Mun. Álamos, Sonora')}

                    {/* Dimensiones y contrato */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contrato</p>
                        <div className="grid grid-cols-2 gap-3">
                            {inp('Metros contratados (mt ln)', 'metrosContratados', 'number', '2000')}
                            {inp('Precio unitario ($/m³ o mt)', 'precioUnitario', 'number', '24.50')}
                            {inp('Bordo (m)', 'bordo', 'number', '2.7')}
                            {inp('Espesor (m)', 'espesor', 'number', '3.0')}
                        </div>
                        <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
                            <select value={form.moneda} onChange={set('moneda')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="MXN">MXN – Peso mexicano</option>
                                <option value="USD">USD – Dólar</option>
                            </select>
                        </div>
                    </div>

                    {/* Fechas */}
                    <div className="grid grid-cols-2 gap-3">
                        {inp('Fecha inicio', 'fechaInicio', 'date')}
                        {inp('Fecha fin estimada', 'fechaFin', 'date')}
                    </div>

                    {/* Equipo inicial (solo al crear) */}
                    {!isEdit && equipos.length > 0 && (
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Equipo inicial (opcional)</label>
                            <select value={form.equipoId} onChange={set('equipoId')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="">— Asignar equipo después —</option>
                                {equipos.map(eq => (
                                    <option key={eq.id} value={eq.id}>
                                        {eq.nombre}{eq.numeroEconomico ? ` (${eq.numeroEconomico})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                        <textarea
                            value={form.notas}
                            onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                        />
                    </div>
                </div>

                {error && <p className="text-xs text-red-500 px-6 pb-2">{error}</p>}

                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
                    >
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
    const [modal,    setModal]    = useState<{ open: boolean; obra?: Obra }>({ open: false });

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

    const handleDelete = async (id: string, nombre: string) => {
        if (!confirm(`¿Eliminar la obra "${nombre}"? Solo se puede si no tiene registros asociados.`)) return;
        try {
            await fetchApi(`/obras/${id}`, { method: 'DELETE' });
            setObras(o => o.filter(x => x.id !== id));
        } catch (e: any) {
            alert(e.message || 'Error al eliminar');
        }
    };

    const obrasFiltradas = filtro === 'TODAS' ? obras : obras.filter(o => o.status === filtro);
    const activas    = obras.filter(o => o.status === 'ACTIVA').length;
    const pausadas   = obras.filter(o => o.status === 'PAUSADA').length;
    const terminadas = obras.filter(o => o.status === 'TERMINADA').length;
    const totalFacturado = obras.reduce((a, o) => a + (o.metricas?.montoFacturado ?? 0), 0);

    const clienteNombre = (o: Obra) => o.cliente?.nombre || o.clienteNombre || '—';
    const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 0 });

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Obras</h1>
                    <p className="text-sm text-gray-500 mt-1">Contratos de perforación activos e históricos.</p>
                </div>
                <button
                    onClick={() => setModal({ open: true })}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
                >
                    <Plus size={16} /> Nueva Obra
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            {/* KPIs */}
            {!loading && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Activas',    value: activas,    color: 'text-green-600' },
                        { label: 'Pausadas',   value: pausadas,   color: 'text-yellow-600' },
                        { label: 'Terminadas', value: terminadas, color: 'text-gray-500' },
                        { label: 'Total facturado', value: `$${fmt(totalFacturado)}`, color: 'text-blue-600' },
                    ].map(k => (
                        <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
                {(['TODAS', 'ACTIVA', 'PAUSADA', 'TERMINADA'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFiltro(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            filtro === f
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {f === 'TODAS' ? 'Todas' : f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>

            {/* Tabla */}
            <Card>
                {loading ? (
                    <div className="p-10 text-center text-gray-400 text-sm">Cargando obras...</div>
                ) : obrasFiltradas.length === 0 ? (
                    <div className="p-10 text-center">
                        <HardHat size={36} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-600">
                            {filtro === 'TODAS' ? 'No hay obras registradas' : `No hay obras con status "${filtro}"`}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Crea la primera obra con el botón de arriba.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Obra</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipo activo</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Avance</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Facturado</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Status</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {obrasFiltradas.map(obra => {
                                    const pct = obra.metricas?.pctAvance;
                                    const equipoActivo = obra.obraEquipos[0]?.equipo;
                                    return (
                                        <tr key={obra.id} className="hover:bg-blue-50/30 transition-colors group">
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
                                            <td className="p-3 text-sm text-gray-500">{clienteNombre(obra)}</td>
                                            <td className="p-3 text-sm text-gray-500">
                                                {equipoActivo
                                                    ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                                        {equipoActivo.nombre}
                                                      </span>
                                                    : <span className="text-xs text-gray-300">—</span>
                                                }
                                            </td>
                                            <td className="p-3 text-right">
                                                {pct !== null && pct !== undefined ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 rounded-full"
                                                                style={{ width: `${Math.min(pct, 100)}%` }}
                                                            />
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
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Link
                                                        href={`/dashboard/obras/${obra.id}`}
                                                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-colors inline-flex"
                                                        title="Ver detalle"
                                                    >
                                                        <Eye size={15} />
                                                    </Link>
                                                    <button
                                                        onClick={() => setModal({ open: true, obra })}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(obra.id, obra.nombre)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                        title="Eliminar"
                                                    >
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
        </div>
    );
}
