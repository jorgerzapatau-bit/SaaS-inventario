"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Receipt, Plus, Trash2, X, Filter } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Gasto = {
    id: string;
    equipoId: string;
    obraId: string | null;
    semanaNum: number;
    anoNum: number;
    fechaInicio: string | null;
    categoria: string;
    producto: string;
    unidad: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
    moneda: 'MXN' | 'USD';
    tipoCambio: number | null;
    notas: string | null;
    equipo: { nombre: string; numeroEconomico: string | null };
    obra: { nombre: string } | null;
};

type Equipo = { id: string; nombre: string; numeroEconomico: string | null };
type Obra   = { id: string; nombre: string; status: string };

const CATEGORIAS: Record<string, { label: string; color: string }> = {
    LUBRICANTE:  { label: 'Lubricante',  color: 'bg-yellow-100 text-yellow-700' },
    FILTRO:      { label: 'Filtro',      color: 'bg-orange-100 text-orange-700' },
    HERRAMIENTA: { label: 'Herramienta', color: 'bg-blue-100 text-blue-700' },
    COMBUSTIBLE: { label: 'Combustible', color: 'bg-red-100 text-red-700' },
    PERSONAL:    { label: 'Personal',    color: 'bg-purple-100 text-purple-700' },
    VEHICULO:    { label: 'Vehículo',    color: 'bg-indigo-100 text-indigo-700' },
    OTRO:        { label: 'Otro',        color: 'bg-gray-100 text-gray-600' },
};

// ─── Modal nuevo gasto ────────────────────────────────────────────────────────
function GastoModal({
    equipos, obras, onClose, onSaved,
}: {
    equipos: Equipo[];
    obras: Obra[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const hoy = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({
        equipoId:       '',
        obraId:         '',
        fechaInicio:    hoy,
        categoria:      'OTRO',
        producto:       '',
        unidad:         'pza',
        cantidad:       '',
        precioUnitario: '',
        moneda:         'MXN',
        tipoCambio:     '',
        notas:          '',
    });
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    const total = form.cantidad && form.precioUnitario
        ? Number(form.cantidad) * Number(form.precioUnitario)
        : null;

    const set = (k: keyof typeof form, v: string) =>
        setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.equipoId)    { setError('Selecciona un equipo'); return; }
        if (!form.producto.trim()) { setError('El concepto / producto es requerido'); return; }
        if (!form.cantidad)    { setError('La cantidad es requerida'); return; }
        if (!form.precioUnitario) { setError('El precio unitario es requerido'); return; }

        setSaving(true); setError('');
        try {
            await fetchApi('/gastos-operativos', {
                method: 'POST',
                body: JSON.stringify({
                    ...form,
                    cantidad:       Number(form.cantidad),
                    precioUnitario: Number(form.precioUnitario),
                    tipoCambio:     form.tipoCambio ? Number(form.tipoCambio) : null,
                    obraId:         form.obraId || null,
                }),
            });
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
            <input type={type} value={String(form[key])}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-800">Nuevo Gasto Operativo</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Insumo, herramienta o costo de operación</p>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {/* Equipo y obra */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Equipo *</label>
                            <select value={form.equipoId} onChange={e => set('equipoId', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="">— Selecciona —</option>
                                {equipos.map(eq => (
                                    <option key={eq.id} value={eq.id}>
                                        {eq.nombre}{eq.numeroEconomico ? ` (${eq.numeroEconomico})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Obra (opcional)</label>
                            <select value={form.obraId} onChange={e => set('obraId', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="">— Sin obra —</option>
                                {obras.map(o => (
                                    <option key={o.id} value={o.id}>{o.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Fecha y categoría */}
                    <div className="grid grid-cols-2 gap-3">
                        {inp('Fecha', 'fechaInicio', 'date')}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                            <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                {Object.entries(CATEGORIAS).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Producto / concepto */}
                    {inp('Concepto / Producto *', 'producto', 'text', 'Ej: Aceite motor SAE 15W40')}

                    {/* Cantidad, unidad, precio */}
                    <div className="grid grid-cols-3 gap-3">
                        {inp('Cantidad *', 'cantidad', 'number', '4')}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
                            <select value={form.unidad} onChange={e => set('unidad', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                {['pza', 'lt', 'kg', 'caja', 'día', 'hr', 'servicio', 'mts'].map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                        {inp('Precio unit. *', 'precioUnitario', 'number', '450.00')}
                    </div>

                    {/* Moneda */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
                            <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="MXN">MXN</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                        {form.moneda === 'USD' && inp('Tipo de cambio', 'tipoCambio', 'number', '17.50')}
                    </div>

                    {/* Total calculado */}
                    {total !== null && (
                        <div className="bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center">
                            <span className="text-xs text-blue-600 font-medium">Total</span>
                            <span className="text-sm font-bold text-blue-700">
                                ${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {form.moneda}
                            </span>
                        </div>
                    )}

                    {inp('Notas', 'notas', 'text', 'Opcional')}
                </div>

                {error && <p className="text-xs text-red-500 px-6 pb-2">{error}</p>}

                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex gap-2">
                    <button onClick={onClose}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50">
                        {saving ? 'Guardando...' : 'Registrar gasto'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────
function GastosOperativosInner() {
    const searchParams  = useSearchParams();
    const equipoIdParam = searchParams.get('equipoId') || '';

    const [gastos,       setGastos]       = useState<Gasto[]>([]);
    const [equipos,      setEquipos]      = useState<Equipo[]>([]);
    const [obras,        setObras]        = useState<Obra[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState('');
    const [modal,        setModal]        = useState(false);
    const [filtroEquipo, setFiltroEquipo] = useState(equipoIdParam);
    const [filtroCateg,  setFiltroCateg]  = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filtroEquipo) params.set('equipoId', filtroEquipo);
            if (filtroCateg)  params.set('categoria', filtroCateg);

            const [gs, eqs, obs] = await Promise.all([
                fetchApi(`/gastos-operativos${params.toString() ? '?' + params.toString() : ''}`),
                fetchApi('/equipos'),
                fetchApi('/obras'),
            ]);
            setGastos(gs);
            setEquipos(eqs);
            setObras(obs);
        } catch (e: any) {
            setError(e.message || 'Error al cargar gastos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [filtroEquipo, filtroCateg]);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return;
        try {
            await fetchApi(`/gastos-operativos/${id}`, { method: 'DELETE' });
            setGastos(g => g.filter(x => x.id !== id));
        } catch (e: any) {
            alert(e.message || 'Error al eliminar');
        }
    };

    const totalMXN = gastos
        .filter(g => g.moneda === 'MXN')
        .reduce((a, g) => a + g.total, 0);
    const totalUSD = gastos
        .filter(g => g.moneda === 'USD')
        .reduce((a, g) => a + g.total, 0);

    // Agrupar por categoría para el resumen
    const porCategoria = Object.keys(CATEGORIAS).map(cat => ({
        cat,
        total: gastos.filter(g => g.categoria === cat && g.moneda === 'MXN').reduce((a, g) => a + g.total, 0),
    })).filter(x => x.total > 0);

    const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Gastos Operativos</h1>
                    <p className="text-sm text-gray-500 mt-1">Insumos, herramientas y costos de operación por equipo.</p>
                </div>
                <button onClick={() => setModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                    <Plus size={16} /> Nuevo gasto
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            {/* KPIs */}
            {!loading && gastos.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 col-span-2 lg:col-span-1">
                        <p className="text-xs text-gray-400 mb-1">Total MXN</p>
                        <p className="text-2xl font-bold text-gray-800">${fmt(totalMXN)}</p>
                    </div>
                    {totalUSD > 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <p className="text-xs text-gray-400 mb-1">Total USD</p>
                            <p className="text-2xl font-bold text-green-700">${fmt(totalUSD)}</p>
                        </div>
                    )}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 col-span-2 lg:col-span-2">
                        <p className="text-xs text-gray-400 mb-2">Por categoría (MXN)</p>
                        <div className="flex flex-wrap gap-2">
                            {porCategoria.map(({ cat, total }) => (
                                <span key={cat} className={`text-xs px-2 py-1 rounded-full font-medium ${CATEGORIAS[cat]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                                    {CATEGORIAS[cat]?.label}: ${total.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filtros */}
            <div className="flex gap-3 flex-wrap items-center">
                <Filter size={14} className="text-gray-400 flex-shrink-0" />
                <select value={filtroEquipo} onChange={e => setFiltroEquipo(e.target.value)}
                    className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Todos los equipos</option>
                    {equipos.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.nombre}</option>
                    ))}
                </select>
                <select value={filtroCateg} onChange={e => setFiltroCateg(e.target.value)}
                    className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Todas las categorías</option>
                    {Object.entries(CATEGORIAS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                {(filtroEquipo || filtroCateg) && (
                    <button onClick={() => { setFiltroEquipo(''); setFiltroCateg(''); }}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                        <X size={13} /> Limpiar
                    </button>
                )}
            </div>

            {/* Tabla */}
            <Card>
                {loading ? (
                    <div className="p-10 text-center text-gray-400 text-sm">Cargando gastos...</div>
                ) : gastos.length === 0 ? (
                    <div className="p-10 text-center">
                        <Receipt size={36} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-600">No hay gastos registrados</p>
                        <p className="text-xs text-gray-400 mt-1">Registra el primer gasto operativo con el botón de arriba.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipo</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Categoría</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Concepto</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Cant.</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">P. Unit.</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Total</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Obra</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {gastos.map(g => (
                                    <tr key={g.id} className="hover:bg-blue-50/20 transition-colors group">
                                        <td className="p-3 text-xs text-gray-500">
                                            {g.fechaInicio
                                                ? new Date(g.fechaInicio + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                                                : `S{g.semanaNum}/${g.anoNum}`}
                                        </td>
                                        <td className="p-3">
                                            <p className="text-sm font-medium text-gray-700">{g.equipo.nombre}</p>
                                            {g.equipo.numeroEconomico && (
                                                <p className="text-xs text-gray-400">{g.equipo.numeroEconomico}</p>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORIAS[g.categoria]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                                                {CATEGORIAS[g.categoria]?.label ?? g.categoria}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <p className="text-sm text-gray-800">{g.producto}</p>
                                            {g.notas && <p className="text-xs text-gray-400 mt-0.5">{g.notas}</p>}
                                        </td>
                                        <td className="p-3 text-right text-sm text-gray-600">
                                            {g.cantidad} {g.unidad}
                                        </td>
                                        <td className="p-3 text-right text-sm text-gray-600">
                                            ${fmt(g.precioUnitario)}
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className="text-sm font-bold text-gray-800">${fmt(g.total)}</span>
                                            <p className="text-xs text-gray-400">{g.moneda}</p>
                                        </td>
                                        <td className="p-3 text-sm text-gray-500">{g.obra?.nombre ?? '—'}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleDelete(g.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {modal && (
                <GastoModal
                    equipos={equipos}
                    obras={obras}
                    onClose={() => setModal(false)}
                    onSaved={() => { setModal(false); load(); }}
                />
            )}
        </div>
    );
}

export default function GastosOperativosPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>}>
            <GastosOperativosInner />
        </Suspense>
    );
}
