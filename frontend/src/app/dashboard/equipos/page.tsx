"use client";

import { useEffect, useState, useMemo } from 'react';
import { Wrench, Plus, Edit, Trash2, CheckCircle, XCircle, ClipboardList, ChevronDown, ChevronUp, Search, X, Filter } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';

type Equipo = {
    id: string;
    nombre: string;
    modelo: string | null;
    numeroSerie: string | null;
    numeroEconomico: string | null;
    hodometroInicial: number;
    activo: boolean;
    notas: string | null;
    // Campos técnicos (C2-A)
    marca: string | null;
    anoFabricacion: number | null;
    facturaCompra: string | null;
    apodo: string | null;
    acopladoCon: string | null;
    seriePistolaActual: string | null;
    statusEquipo: string | null;
    _count: { registrosDiarios: number; componentesInstalados: number };
};

// ── Modal Crear / Editar Equipo ───────────────────────────────────────────────
function EquipoModal({
    equipo, onClose, onSaved,
}: {
    equipo?: Equipo;
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEdit = !!equipo;
    const [showTecnicos, setShowTecnicos] = useState(false);

    const [form, setForm] = useState({
        // Datos básicos
        nombre:             equipo?.nombre             ?? '',
        modelo:             equipo?.modelo             ?? '',
        numeroSerie:        equipo?.numeroSerie        ?? '',
        numeroEconomico:    equipo?.numeroEconomico    ?? '',
        hodometroInicial:   equipo?.hodometroInicial   ?? 0,
        notas:              equipo?.notas              ?? '',
        // Datos técnicos / ficha (C2-A)
        marca:              equipo?.marca              ?? '',
        anoFabricacion:     equipo?.anoFabricacion?.toString() ?? '',
        facturaCompra:      equipo?.facturaCompra      ?? '',
        apodo:              equipo?.apodo              ?? '',
        acopladoCon:        equipo?.acopladoCon        ?? '',
        seriePistolaActual: equipo?.seriePistolaActual ?? '',
        statusEquipo:       equipo?.statusEquipo       ?? 'ACTIVO',
    });

    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    // Abrir la sección técnica automáticamente si hay datos al editar
    useEffect(() => {
        if (isEdit && (equipo?.marca || equipo?.apodo || equipo?.acopladoCon || equipo?.seriePistolaActual)) {
            setShowTecnicos(true);
        }
    }, []);

    const handleSave = async () => {
        if (!form.nombre.trim()) { setError('El nombre es requerido'); return; }
        setSaving(true); setError('');
        try {
            const body = {
                nombre:             form.nombre.trim(),
                modelo:             form.modelo             || null,
                numeroSerie:        form.numeroSerie        || null,
                numeroEconomico:    form.numeroEconomico    || null,
                hodometroInicial:   Number(form.hodometroInicial),
                notas:              form.notas              || null,
                // Técnicos (C2-A)
                marca:              form.marca              || null,
                anoFabricacion:     form.anoFabricacion     ? Number(form.anoFabricacion) : null,
                facturaCompra:      form.facturaCompra      || null,
                apodo:              form.apodo              || null,
                acopladoCon:        form.acopladoCon        || null,
                seriePistolaActual: form.seriePistolaActual || null,
                statusEquipo:       form.statusEquipo       || 'ACTIVO',
            };
            if (isEdit) {
                await fetchApi(`/equipos/${equipo!.id}`, { method: 'PUT', body: JSON.stringify(body) });
            } else {
                await fetchApi('/equipos', { method: 'POST', body: JSON.stringify(body) });
            }
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const txt = (label: string, key: keyof typeof form, placeholder = '') => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input
                type="text"
                value={String(form[key])}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
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
                    <h2 className="text-lg font-bold text-gray-800">
                        {isEdit ? 'Editar Equipo' : 'Nuevo Equipo'}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">Maquinaria y equipos de perforación</p>
                </div>

                <div className="px-6 py-5 space-y-4">

                    {/* ── Datos básicos ─────────────────────────────────── */}
                    <div className="space-y-3">
                        {txt('Nombre *', 'nombre', 'Ej: Track Drill JOVERO #1')}

                        <div className="grid grid-cols-2 gap-3">
                            {txt('Modelo', 'modelo', 'Ej: ECM350')}
                            {txt('Número económico', 'numeroEconomico', 'Ej: TD-10')}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {txt('Número de serie', 'numeroSerie', 'Ej: R10565JD')}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Horómetro inicial (hrs)</label>
                                <input
                                    type="number"
                                    value={form.hodometroInicial}
                                    onChange={e => setForm(f => ({ ...f, hodometroInicial: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Datos técnicos / ficha (C2-A) — sección colapsable ── */}
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowTecnicos(v => !v)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/70 hover:bg-gray-100/70 transition-colors text-left"
                        >
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Datos técnicos / ficha
                            </span>
                            {showTecnicos
                                ? <ChevronUp size={15} className="text-gray-400" />
                                : <ChevronDown size={15} className="text-gray-400" />
                            }
                        </button>

                        {showTecnicos && (
                            <div className="px-4 pb-4 pt-3 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    {txt('Marca', 'marca', 'Ej: Ingersoll-Rand')}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Año de fabricación</label>
                                        <input
                                            type="number"
                                            value={form.anoFabricacion}
                                            onChange={e => setForm(f => ({ ...f, anoFabricacion: e.target.value }))}
                                            placeholder="Ej: 1996"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                {txt('Factura / referencia de compra', 'facturaCompra', 'Ej: 219 SIETE CERROS')}

                                <div className="grid grid-cols-2 gap-3">
                                    {txt('Apodo', 'apodo', 'Ej: perf VL140 Nueva')}
                                    {txt('Acoplado con', 'acopladoCon', 'Ej: XP825-2015 #1')}
                                </div>

                                {txt('Serie pistola VL140 actual', 'seriePistolaActual', 'Ej: 4521')}

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Status del equipo</label>
                                    <select
                                        value={form.statusEquipo}
                                        onChange={e => setForm(f => ({ ...f, statusEquipo: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="ACTIVO">Activo</option>
                                        <option value="EN_TALLER">En taller</option>
                                        <option value="VENDIDO">Vendido</option>
                                        <option value="ABANDONO">Abandono</option>
                                        <option value="BAJA">Baja</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Notas */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                        <textarea
                            value={form.notas}
                            onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                        />
                    </div>
                </div>

                {error && <p className="text-xs text-red-500 px-6 pb-2">{error}</p>}

                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex gap-2">
                    <button onClick={onClose}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50">
                        {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear equipo'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function EquiposPage() {
    const [equipos,  setEquipos]  = useState<Equipo[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');
    const [modal,    setModal]    = useState<{ open: boolean; equipo?: Equipo }>({ open: false });

    // ── Búsqueda y filtros ────────────────────────────────────────────────────
    const [search,       setSearch]       = useState('');
    const [filterEstado, setFilterEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos');
    const [filterTipo,   setFilterTipo]   = useState('todos');
    const [showFilters,  setShowFilters]  = useState(false);

    // Tipos únicos derivados de los nombres
    const tiposUnicos = useMemo(() => {
        const nombres = equipos.map(e => {
            const n = e.nombre.toLowerCase();
            if (n.includes('track drill')) return 'Track Drill';
            if (n.includes('compr') && n.includes('aire')) return 'Compresor de Aire';
            if (n.includes('perforadora')) return 'Perforadora';
            if (n.includes('hidrotrack')) return 'Hidrotrack';
            return 'Otro';
        });
        return ['todos', ...Array.from(new Set(nombres))];
    }, [equipos]);

    const equiposFiltrados = useMemo(() => {
        const q = search.toLowerCase().trim();
        return equipos.filter(eq => {
            // Búsqueda de texto
            if (q) {
                const haystack = [
                    eq.nombre, eq.modelo, eq.marca, eq.numeroSerie,
                    eq.numeroEconomico, eq.apodo, eq.acopladoCon,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            // Filtro estado
            if (filterEstado === 'activo'   && !eq.activo) return false;
            if (filterEstado === 'inactivo' &&  eq.activo) return false;
            // Filtro tipo
            if (filterTipo !== 'todos') {
                const n = eq.nombre.toLowerCase();
                const tipo =
                    n.includes('track drill')             ? 'Track Drill'        :
                    n.includes('compr') && n.includes('aire') ? 'Compresor de Aire' :
                    n.includes('perforadora')             ? 'Perforadora'        :
                    n.includes('hidrotrack')              ? 'Hidrotrack'         : 'Otro';
                if (tipo !== filterTipo) return false;
            }
            return true;
        });
    }, [equipos, search, filterEstado, filterTipo]);

    const hayFiltrosActivos = search || filterEstado !== 'todos' || filterTipo !== 'todos';

    const limpiarFiltros = () => {
        setSearch('');
        setFilterEstado('todos');
        setFilterTipo('todos');
    };

    const load = async () => {
        setLoading(true);
        try {
            const data = await fetchApi('/equipos');
            setEquipos(data);
        } catch (e: any) {
            setError(e.message || 'Error al cargar equipos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (id: string, nombre: string) => {
        if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
        try {
            await fetchApi(`/equipos/${id}`, { method: 'DELETE' });
            setEquipos(e => e.filter(x => x.id !== id));
        } catch (e: any) {
            alert(e.message || 'Error al eliminar');
        }
    };

    const handleToggleActivo = async (equipo: Equipo) => {
        try {
            await fetchApi(`/equipos/${equipo.id}`, {
                method: 'PUT',
                body: JSON.stringify({ activo: !equipo.activo }),
            });
            setEquipos(es => es.map(e => e.id === equipo.id ? { ...e, activo: !equipo.activo } : e));
        } catch (e: any) {
            alert(e.message || 'Error al actualizar');
        }
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Equipos</h1>
                    <p className="text-sm text-gray-500 mt-1">Gestión de maquinaria y equipos de perforación.</p>
                </div>
                <button
                    onClick={() => setModal({ open: true })}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
                >
                    <Plus size={16} /> Nuevo Equipo
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            {/* KPIs */}
            {!loading && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-400 mb-1">Total equipos</p>
                        <p className="text-2xl font-bold text-gray-800">{equipos.length}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-400 mb-1">Activos</p>
                        <p className="text-2xl font-bold text-green-600">{equipos.filter(e => e.activo).length}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-400 mb-1">Total registros diarios</p>
                        <p className="text-2xl font-bold text-gray-800">
                            {equipos.reduce((a, e) => a + e._count.registrosDiarios, 0)}
                        </p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-400 mb-1">Componentes instalados</p>
                        <p className="text-2xl font-bold text-purple-600">
                            {equipos.reduce((a, e) => a + (e._count.componentesInstalados ?? 0), 0)}
                        </p>
                    </div>
                </div>
            )}

            {/* ── Búsqueda y filtros ─────────────────────────────────────────── */}
            <div className="space-y-3">
                {/* Barra de búsqueda */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por nombre, modelo, serie, N° económico, apodo…"
                            className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Botón mostrar/ocultar filtros */}
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium rounded-lg border transition-colors shadow-sm ${
                            showFilters || (filterEstado !== 'todos' || filterTipo !== 'todos')
                                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <Filter size={15} />
                        Filtros
                        {(filterEstado !== 'todos' || filterTipo !== 'todos') && (
                            <span className="ml-0.5 w-5 h-5 rounded-full bg-white/20 text-xs flex items-center justify-center font-bold">
                                {(filterEstado !== 'todos' ? 1 : 0) + (filterTipo !== 'todos' ? 1 : 0)}
                            </span>
                        )}
                    </button>
                </div>

                {/* Panel de filtros desplegable */}
                {showFilters && (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-end animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Filtro estado */}
                        <div className="min-w-[160px]">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Estado</label>
                            <div className="flex gap-1.5">
                                {(['todos', 'activo', 'inactivo'] as const).map(op => (
                                    <button
                                        key={op}
                                        onClick={() => setFilterEstado(op)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                            filterEstado === op
                                                ? op === 'activo'   ? 'bg-green-100 text-green-700 border-green-200'
                                                : op === 'inactivo' ? 'bg-gray-200 text-gray-700 border-gray-300'
                                                                    : 'bg-blue-100 text-blue-700 border-blue-200'
                                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        {op === 'todos' ? 'Todos' : op === 'activo' ? '✓ Activo' : '✗ Inactivo'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Filtro tipo */}
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Tipo de equipo</label>
                            <select
                                value={filterTipo}
                                onChange={e => setFilterTipo(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white
                                           focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                {tiposUnicos.map(t => (
                                    <option key={t} value={t}>{t === 'todos' ? 'Todos los tipos' : t}</option>
                                ))}
                            </select>
                        </div>

                        {/* Limpiar filtros */}
                        {hayFiltrosActivos && (
                            <button
                                onClick={limpiarFiltros}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-100 transition-colors"
                            >
                                <X size={13} /> Limpiar filtros
                            </button>
                        )}
                    </div>
                )}

                {/* Contador de resultados */}
                {(hayFiltrosActivos || search) && !loading && (
                    <p className="text-xs text-gray-400">
                        Mostrando <span className="font-semibold text-gray-600">{equiposFiltrados.length}</span> de{' '}
                        <span className="font-semibold text-gray-600">{equipos.length}</span> equipos
                        {hayFiltrosActivos && (
                            <button onClick={limpiarFiltros} className="ml-2 text-blue-500 hover:underline">
                                Limpiar
                            </button>
                        )}
                    </p>
                )}
            </div>

            {/* Tabla */}
            <Card>
                {loading ? (
                    <div className="p-10 text-center text-gray-400 text-sm">Cargando equipos...</div>
                ) : equipos.length === 0 ? (
                    <div className="p-10 text-center">
                        <Wrench size={36} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-600">No hay equipos registrados</p>
                        <p className="text-xs text-gray-400 mt-1">Crea el primer equipo con el botón de arriba.</p>
                    </div>
                ) : equiposFiltrados.length === 0 ? (
                    <div className="p-10 text-center">
                        <Search size={32} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-600">Sin resultados</p>
                        <p className="text-xs text-gray-400 mt-1">Ningún equipo coincide con los filtros aplicados.</p>
                        <button
                            onClick={limpiarFiltros}
                            className="mt-3 text-xs text-blue-500 hover:underline"
                        >
                            Limpiar filtros
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipo</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Modelo / Marca</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">N° Econ.</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Acoplado</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Horómetro ini.</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Registros</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Estado</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {equiposFiltrados.map(eq => (
                                    <tr key={eq.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <Wrench size={14} className="text-blue-600" />
                                                </div>
                                                <div>
                                                    <Link href={`/dashboard/equipos/${eq.id}`}
                                                        className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors">
                                                        {eq.nombre}
                                                    </Link>
                                                    {eq.apodo && (
                                                        <p className="text-xs text-gray-400 italic">"{eq.apodo}"</p>
                                                    )}
                                                    {!eq.apodo && eq.numeroSerie && (
                                                        <p className="text-xs text-gray-400 font-mono">S/N: {eq.numeroSerie}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <p className="text-sm text-gray-600">{eq.modelo || '—'}</p>
                                            {eq.marca && <p className="text-xs text-gray-400">{eq.marca}{eq.anoFabricacion ? ` · ${eq.anoFabricacion}` : ''}</p>}
                                        </td>
                                        <td className="p-3 text-sm font-mono text-gray-600">{eq.numeroEconomico || '—'}</td>
                                        <td className="p-3 text-sm text-gray-500">{eq.acopladoCon || '—'}</td>
                                        <td className="p-3 text-right text-sm font-semibold text-gray-700">
                                            {eq.hodometroInicial.toLocaleString('es-MX')} hrs
                                        </td>
                                        <td className="p-3 text-center">
                                            <Link
                                                href={`/dashboard/registros-diarios?equipoId=${eq.id}`}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                                            >
                                                <ClipboardList size={11} />
                                                {eq._count.registrosDiarios}
                                            </Link>
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={() => handleToggleActivo(eq)}
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold transition-colors ${
                                                    eq.activo
                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                }`}
                                            >
                                                {eq.activo
                                                    ? <><CheckCircle size={11} /> Activo</>
                                                    : <><XCircle size={11} /> Inactivo</>
                                                }
                                            </button>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    href={`/dashboard/registros-diarios/new?equipoId=${eq.id}`}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-colors inline-flex"
                                                    title="Nuevo registro diario"
                                                >
                                                    <ClipboardList size={15} />
                                                </Link>
                                                <button
                                                    onClick={() => setModal({ open: true, equipo: eq })}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit size={15} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(eq.id, eq.nombre)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {modal.open && (
                <EquipoModal
                    equipo={modal.equipo}
                    onClose={() => setModal({ open: false })}
                    onSaved={() => { setModal({ open: false }); load(); }}
                />
            )}
        </div>
    );
}
