"use client";

import { useEffect, useState } from 'react';
import {
    HardHat, Plus, CheckCircle, PauseCircle, Clock,
    Search, Trash2, ChevronRight, Wrench, FileText,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type PlantillaResumen = {
    id: string;
    numero: number;
    metrosContratados: number;
    status: 'ACTIVA' | 'PAUSADA' | 'TERMINADA';
};

type ObraListItem = {
    id: string;
    nombre: string;
    ubicacion: string | null;
    moneda: string;
    fechaInicio: string | null;
    fechaFin: string | null;
    status: 'ACTIVA' | 'PAUSADA' | 'TERMINADA';
    notas: string | null;
    cliente: { nombre: string } | null;
    plantillas: PlantillaResumen[];
    obraEquipos: { id: string; equipo: { nombre: string; numeroEconomico: string | null } }[];
    metricas: {
        metrosPerforados: number;
        metrosContratadosEfectivos: number;
        horasTotales: number;
        litrosDiesel: number;
        barrenos: number;
        pctAvance: number | null;
        montoFacturado: number;
    };
};

// ─── Modal Crear Obra ─────────────────────────────────────────────────────────
type Cliente = { id: string; nombre: string };
type Equipo  = { id: string; nombre: string; numeroEconomico: string | null };

function ObraModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [equipos,  setEquipos]  = useState<Equipo[]>([]);
    const [saving,   setSaving]   = useState(false);
    const [error,    setError]    = useState('');

    const [form, setForm] = useState({
        nombre: '', clienteId: '', ubicacion: '',
        metrosContratados: '', precioUnitario: '',
        moneda: 'MXN', fechaInicio: '', fechaFin: '',
        status: 'ACTIVA', notas: '',
    });
    const [equipoIds, setEquipoIds] = useState<string[]>([]);

    useEffect(() => {
        fetchApi('/clients').then((d: Cliente[]) => setClientes(d)).catch(() => {});
        fetchApi('/equipos').then((d: Equipo[]) => setEquipos(d)).catch(() => {});
    }, []);

    const set = (k: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setForm(f => ({ ...f, [k]: e.target.value }));

    const toggleEquipo = (id: string) =>
        setEquipoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const handleSave = async () => {
        if (!form.nombre.trim()) { setError('El nombre es requerido'); return; }
        if (!form.clienteId)     { setError('El cliente es requerido'); return; }
        setSaving(true); setError('');
        try {
            const body = {
                nombre:            form.nombre.trim(),
                clienteId:         form.clienteId,
                ubicacion:         form.ubicacion         || null,
                metrosContratados: form.metrosContratados ? Number(form.metrosContratados) : null,
                precioUnitario:    form.precioUnitario    ? Number(form.precioUnitario)    : null,
                moneda:            form.moneda,
                fechaInicio:       form.fechaInicio       || null,
                fechaFin:          form.fechaFin          || null,
                status:            form.status,
                notas:             form.notas             || null,
                equipos:           equipoIds.map(id => ({ equipoId: id })),
            };
            await fetchApi('/obras', { method: 'POST', body: JSON.stringify(body) });
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Error al crear obra');
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
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}>

                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-800">Nueva obra</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Complete los datos del proyecto</p>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
                            {error}
                        </div>
                    )}

                    {inp('Nombre de la obra *', 'nombre', 'text', 'Ej: Proyecto Minas Norte')}

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Cliente *</label>
                        <select
                            value={form.clienteId}
                            onChange={set('clienteId')}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                            <option value="">Seleccionar cliente...</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {inp('Ubicación', 'ubicacion', 'text', 'Ej: Municipio, Estado')}

                    <div className="grid grid-cols-2 gap-3">
                        {inp('Metros contratados', 'metrosContratados', 'number', '0')}
                        {inp('Precio unitario', 'precioUnitario', 'number', '0.00')}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
                            <select
                                value={form.moneda}
                                onChange={set('moneda')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                <option value="MXN">MXN</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                            <select
                                value={form.status}
                                onChange={set('status')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                <option value="ACTIVA">Activa</option>
                                <option value="PAUSADA">Pausada</option>
                                <option value="TERMINADA">Terminada</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {inp('Fecha inicio', 'fechaInicio', 'date')}
                        {inp('Fecha fin estimada', 'fechaFin', 'date')}
                    </div>

                    {equipos.length > 0 && (
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">Equipos asignados</label>
                            <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-100 rounded-lg p-2">
                                {equipos.map(eq => (
                                    <label key={eq.id} className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-gray-50">
                                        <input
                                            type="checkbox"
                                            checked={equipoIds.includes(eq.id)}
                                            onChange={() => toggleEquipo(eq.id)}
                                            className="rounded border-gray-300 text-blue-600"
                                        />
                                        <span className="text-sm text-gray-700">
                                            {eq.nombre}
                                            {eq.numeroEconomico && (
                                                <span className="text-xs text-gray-400 ml-1">#{eq.numeroEconomico}</span>
                                            )}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                        <textarea
                            value={form.notas}
                            onChange={set('notas')}
                            rows={2}
                            placeholder="Observaciones adicionales..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors"
                    >
                        {saving ? 'Guardando...' : 'Crear obra'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
    ACTIVA:    'bg-green-100 text-green-700',
    PAUSADA:   'bg-yellow-100 text-yellow-700',
    TERMINADA: 'bg-gray-100 text-gray-500',
};
const STATUS_LABEL: Record<string, string> = {
    ACTIVA: 'Activa', PAUSADA: 'Pausada', TERMINADA: 'Terminada',
};

const fmt  = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
const fmt2 = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Card de obra ─────────────────────────────────────────────────────────────
function ObraCard({ obra, onDeleted }: { obra: ObraListItem; onDeleted: () => void }) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm(`¿Eliminar la obra "${obra.nombre}"? Esta acción no se puede deshacer.`)) return;
        setDeleting(true);
        try {
            await fetchApi(`/obras/${obra.id}`, { method: 'DELETE' });
            onDeleted();
        } catch (err: any) {
            alert(err.message || 'Error al eliminar');
        } finally {
            setDeleting(false);
        }
    };

    const pct = obra.metricas.pctAvance;
    const equiposActivos = obra.obraEquipos.length;

    return (
        <Link href={`/dashboard/obras/${obra.id}`}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group p-5">

                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <HardHat size={18} className="text-orange-600" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-gray-900 text-sm truncate group-hover:text-blue-700 transition-colors">
                                {obra.nombre}
                            </h3>
                            {obra.cliente && (
                                <p className="text-xs text-gray-400 truncate">{obra.cliente.nombre}</p>
                            )}
                            {obra.ubicacion && (
                                <p className="text-xs text-gray-400 truncate">{obra.ubicacion}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[obra.status]}`}>
                            {obra.status === 'ACTIVA'    && <CheckCircle size={11} />}
                            {obra.status === 'PAUSADA'   && <PauseCircle size={11} />}
                            {obra.status === 'TERMINADA' && <Clock size={11} />}
                            {STATUS_LABEL[obra.status]}
                        </span>
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50"
                            title="Eliminar obra"
                        >
                            <Trash2 size={13} />
                        </button>
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
                    </div>
                </div>

                {pct !== null && (
                    <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Avance</span>
                            <span className={pct >= 100 ? 'text-green-600 font-semibold' : 'text-blue-600 font-semibold'}>
                                {pct.toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-xl p-2">
                        <p className="text-xs text-gray-400">Metros</p>
                        <p className="text-sm font-bold text-gray-800">{fmt(obra.metricas.metrosPerforados)} m</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2">
                        <p className="text-xs text-gray-400">Facturado</p>
                        <p className="text-sm font-bold text-green-700">${fmt(obra.metricas.montoFacturado)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2">
                        <p className="text-xs text-gray-400">Horas</p>
                        <p className="text-sm font-bold text-gray-800">{fmt2(obra.metricas.horasTotales)}</p>
                    </div>
                </div>

                {(equiposActivos > 0 || obra.plantillas.length > 0) && (
                    <div className="flex gap-3 mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                        {equiposActivos > 0 && (
                            <span className="flex items-center gap-1">
                                <Wrench size={10} className="text-blue-400" />
                                {equiposActivos} equipo{equiposActivos !== 1 ? 's' : ''}
                            </span>
                        )}
                        {obra.plantillas.length > 0 && (
                            <span className="flex items-center gap-1">
                                <FileText size={10} className="text-purple-400" />
                                {obra.plantillas.length} plantilla{obra.plantillas.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </Link>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ObrasPage() {
    const [obras,   setObras]   = useState<ObraListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');
    const [modal,   setModal]   = useState(false);
    const [search,  setSearch]  = useState('');
    const [filtro,  setFiltro]  = useState<'TODAS' | 'ACTIVA' | 'PAUSADA' | 'TERMINADA'>('TODAS');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchApi('/obras');
            setObras(data);
        } catch (e: any) {
            setError(e.message || 'Error al cargar obras');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtradas = obras.filter(o => {
        const matchStatus = filtro === 'TODAS' || o.status === filtro;
        const q = search.toLowerCase();
        const matchSearch = !q ||
            o.nombre.toLowerCase().includes(q) ||
            (o.cliente?.nombre ?? '').toLowerCase().includes(q) ||
            (o.ubicacion ?? '').toLowerCase().includes(q);
        return matchStatus && matchSearch;
    });

    const counts = {
        TODAS:     obras.length,
        ACTIVA:    obras.filter(o => o.status === 'ACTIVA').length,
        PAUSADA:   obras.filter(o => o.status === 'PAUSADA').length,
        TERMINADA: obras.filter(o => o.status === 'TERMINADA').length,
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Obras</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        {counts.ACTIVA} activa{counts.ACTIVA !== 1 ? 's' : ''} · {obras.length} total
                    </p>
                </div>
                <button
                    onClick={() => setModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                    <Plus size={16} /> Nueva obra
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-shrink-0">
                    {(['TODAS', 'ACTIVA', 'PAUSADA', 'TERMINADA'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setFiltro(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                filtro === s
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {s === 'TODAS' ? 'Todas' : STATUS_LABEL[s]}
                            <span className="ml-1 text-gray-400">({counts[s]})</span>
                        </button>
                    ))}
                </div>

                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, cliente o ubicación..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400 text-sm">Cargando obras...</div>
            ) : error ? (
                <div className="text-center py-20">
                    <p className="text-red-500 text-sm mb-2">{error}</p>
                    <button onClick={load} className="text-blue-600 text-sm hover:underline">Reintentar</button>
                </div>
            ) : filtradas.length === 0 ? (
                <Card>
                    <div className="py-16 text-center">
                        <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <HardHat size={24} className="text-orange-500" />
                        </div>
                        <p className="text-gray-500 font-medium">
                            {search || filtro !== 'TODAS' ? 'Sin resultados' : 'Aún no hay obras'}
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                            {search || filtro !== 'TODAS'
                                ? 'Prueba con otro filtro o término de búsqueda'
                                : 'Crea tu primera obra con el botón de arriba'}
                        </p>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtradas.map(obra => (
                        <ObraCard key={obra.id} obra={obra} onDeleted={load} />
                    ))}
                </div>
            )}

            {modal && (
                <ObraModal
                    onClose={() => setModal(false)}
                    onSaved={() => { setModal(false); load(); }}
                />
            )}
        </div>
    );
}
