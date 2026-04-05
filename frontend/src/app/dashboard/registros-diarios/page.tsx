"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ClipboardList, Plus, Edit, Trash2, Gauge,
    Droplets, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

type Registro = {
    id: string;
    fecha: string;
    equipo: { nombre: string; numeroEconomico: string | null };
    cliente: { nombre: string } | null;
    obraNombre: string | null;
    horometroInicio: number;
    horometroFin: number;
    horasTrabajadas: number;
    barrenos: number;
    metrosLineales: number;
    litrosDiesel: number;
    precioDiesel: number;
    costoDiesel: number;
    operadores: number;
    peones: number;
    kpi: { litrosPorHora: number | null; litrosPorMetro: number | null; metrosPorHora: number | null };
    semanaNum: number | null;
    anoNum: number | null;
};

type Equipo = { id: string; nombre: string; numeroEconomico: string | null };

// ── Formulario Nuevo Registro ─────────────────────────────────────────────────
function NuevoRegistroModal({
    equipoIdInicial, equipos, almacenId, onClose, onSaved,
}: {
    equipoIdInicial?: string;
    equipos: Equipo[];
    almacenId: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const hoy = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({
        equipoId:            equipoIdInicial ?? (equipos[0]?.id ?? ''),
        fecha:               hoy,
        horometroInicio:     '',
        horometroFin:        '',
        barrenos:            '',
        metrosLineales:      '',
        litrosDiesel:        '',
        precioDiesel:        '21.95',
        tanqueInicio:        '',
        litrosTanqueInicio:  '',
        tanqueFin:           '',
        litrosTanqueFin:     '',
        operadores:          '1',
        peones:              '0',
        obraNombre:          '',
        notas:               '',
        registrarDieselEnKardex: true,
    });
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    // Horas calculadas en tiempo real
    const horas = form.horometroFin && form.horometroInicio
        ? Math.max(0, Number(form.horometroFin) - Number(form.horometroInicio))
        : null;

    const handleSave = async () => {
        if (!form.equipoId)          { setError('Selecciona un equipo'); return; }
        if (!form.horometroInicio)   { setError('Horómetro inicial requerido'); return; }
        if (!form.horometroFin)      { setError('Horómetro final requerido'); return; }
        if (Number(form.horometroFin) < Number(form.horometroInicio)) {
            setError('Horómetro final no puede ser menor al inicial'); return;
        }
        setSaving(true); setError('');
        try {
            await fetchApi('/registros-diarios', {
                method: 'POST',
                body: JSON.stringify({
                    ...form,
                    horometroInicio:    Number(form.horometroInicio),
                    horometroFin:       Number(form.horometroFin),
                    barrenos:           Number(form.barrenos    || 0),
                    metrosLineales:     Number(form.metrosLineales || 0),
                    litrosDiesel:       Number(form.litrosDiesel  || 0),
                    precioDiesel:       Number(form.precioDiesel  || 0),
                    tanqueInicio:       form.tanqueInicio       ? Number(form.tanqueInicio)       : null,
                    litrosTanqueInicio: form.litrosTanqueInicio ? Number(form.litrosTanqueInicio) : null,
                    tanqueFin:          form.tanqueFin          ? Number(form.tanqueFin)          : null,
                    litrosTanqueFin:    form.litrosTanqueFin    ? Number(form.litrosTanqueFin)    : null,
                    operadores:         Number(form.operadores),
                    peones:             Number(form.peones),
                    almacenId,
                }),
            });
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const inp = (label: string, key: keyof typeof form, type = 'text', placeholder = '', hint = '') => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input
                type={type}
                value={String(form[key])}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-800">Nuevo Registro Diario</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Equivalente a una fila de la hoja Rpte del Excel</p>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Equipo y fecha */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Equipo *</label>
                            <select
                                value={form.equipoId}
                                onChange={e => setForm(f => ({ ...f, equipoId: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                {equipos.map(eq => (
                                    <option key={eq.id} value={eq.id}>
                                        {eq.nombre} {eq.numeroEconomico ? `(${eq.numeroEconomico})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {inp('Fecha *', 'fecha', 'date')}
                    </div>

                    {/* Horómetro */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Horómetro</p>
                        <div className="grid grid-cols-3 gap-3">
                            {inp('H. Inicial (h i)', 'horometroInicio', 'number', '7662')}
                            {inp('H. Final (h f)',   'horometroFin',    'number', '7675')}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Horas trabajadas</label>
                                <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-bold text-blue-700">
                                    {horas !== null ? `${horas} hrs` : '—'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Producción */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Producción</p>
                        <div className="grid grid-cols-2 gap-3">
                            {inp('Barrenos (BARRNS)', 'barrenos',      'number', '13')}
                            {inp('Metros lineales (MTS)', 'metrosLineales', 'number', '134.7')}
                        </div>
                    </div>

                    {/* Diésel */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Diésel</p>
                        <div className="grid grid-cols-2 gap-3">
                            {inp('Litros cargados', 'litrosDiesel', 'number', '235')}
                            {inp('Precio unitario ($/lt)', 'precioDiesel', 'number', '21.95')}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="kardexDiesel"
                                checked={form.registrarDieselEnKardex}
                                onChange={e => setForm(f => ({ ...f, registrarDieselEnKardex: e.target.checked }))}
                                className="w-4 h-4 accent-blue-600 cursor-pointer"
                            />
                            <label htmlFor="kardexDiesel" className="text-xs text-gray-600 cursor-pointer">
                                Descontar litros del inventario de Diésel automáticamente
                            </label>
                        </div>
                    </div>

                    {/* Tanque (opcional) */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tanque interno (opcional)</p>
                        <div className="grid grid-cols-2 gap-3">
                            {inp('CM inicio (CM i)', 'tanqueInicio', 'number')}
                            {inp('Litros inicio', 'litrosTanqueInicio', 'number')}
                            {inp('CM fin (CM f)', 'tanqueFin', 'number')}
                            {inp('Litros fin', 'litrosTanqueFin', 'number')}
                        </div>
                    </div>

                    {/* Personal */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Personal (Op / Pn)</p>
                        <div className="grid grid-cols-2 gap-3">
                            {inp('Operadores', 'operadores', 'number')}
                            {inp('Peones', 'peones', 'number')}
                        </div>
                    </div>

                    {/* Obra */}
                    {inp('Nombre de obra / sitio', 'obraNombre', 'text', 'Ej: Mina El Toro - Frente 3')}
                    {inp('Notas', 'notas')}
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
                        {saving ? 'Guardando...' : 'Guardar registro'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Fila con KPIs expandible ──────────────────────────────────────────────────
function RegistroRow({ r, onDelete }: { r: Registro; onDelete: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const fecha = new Date(r.fecha).toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <>
            <tr className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => setExpanded(v => !v)}>
                <td className="p-3">
                    <div>
                        <p className="text-sm font-semibold text-gray-700">{fecha}</p>
                        {r.semanaNum && <p className="text-xs text-gray-400">Semana {r.semanaNum} / {r.anoNum}</p>}
                    </div>
                </td>
                <td className="p-3 text-sm text-gray-600">{r.equipo.nombre}</td>
                <td className="p-3 text-sm text-gray-500">{r.obraNombre || r.cliente?.nombre || '—'}</td>
                <td className="p-3 text-right">
                    <span className="text-sm font-bold text-gray-700">{r.horasTrabajadas}</span>
                    <span className="text-xs text-gray-400"> hrs</span>
                </td>
                <td className="p-3 text-right">
                    <span className="text-sm font-bold text-gray-700">{r.barrenos}</span>
                </td>
                <td className="p-3 text-right">
                    <span className="text-sm font-bold text-gray-700">{r.metrosLineales.toFixed(1)}</span>
                    <span className="text-xs text-gray-400"> m</span>
                </td>
                <td className="p-3 text-right">
                    <span className="text-sm font-semibold text-blue-600">{r.litrosDiesel}</span>
                    <span className="text-xs text-gray-400"> lt</span>
                </td>
                <td className="p-3 text-right text-sm font-semibold text-gray-700">
                    ${r.costoDiesel.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                </td>
                <td className="p-3 text-right">
                    <div className="flex justify-end items-center gap-1">
                        <button
                            onClick={e => { e.stopPropagation(); onDelete(r.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 size={13} />
                        </button>
                        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr className="bg-blue-50/20">
                    <td colSpan={9} className="px-6 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Horómetro</p>
                                <p className="font-semibold text-gray-700">{r.horometroInicio.toLocaleString()} → {r.horometroFin.toLocaleString()} hrs</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Personal (Op / Pn)</p>
                                <p className="font-semibold text-gray-700">{r.operadores} operador{r.operadores !== 1 ? 'es' : ''} / {r.peones} peón{r.peones !== 1 ? 'es' : ''}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Gauge size={11} /> KPIs operacionales</p>
                                <div className="space-y-0.5">
                                    <p className="text-xs text-gray-600">Lt/hr: <span className="font-bold">{r.kpi.litrosPorHora ?? 'N/A'}</span></p>
                                    <p className="text-xs text-gray-600">Lt/mt: <span className="font-bold">{r.kpi.litrosPorMetro ?? 'N/A'}</span></p>
                                    <p className="text-xs text-gray-600">Mt/hr: <span className="font-bold">{r.kpi.metrosPorHora ?? 'N/A'}</span></p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Droplets size={11} /> Diésel</p>
                                <p className="text-xs text-gray-600">{r.litrosDiesel} lt × ${r.precioDiesel}/lt</p>
                                <p className="text-xs font-bold text-gray-700">= ${r.costoDiesel.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
function RegistrosDiariosInner() {
    const searchParams   = useSearchParams();
    const equipoIdParam  = searchParams.get('equipoId') || undefined;

    const [registros, setRegistros] = useState<Registro[]>([]);
    const [equipos,   setEquipos]   = useState<Equipo[]>([]);
    const [almacenId, setAlmacenId] = useState('');
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState('');
    const [showModal, setShowModal] = useState(false);
    const [filtroEquipo, setFiltroEquipo] = useState(equipoIdParam ?? 'todos');

    const load = async () => {
        setLoading(true);
        try {
            const [regs, eqs, almacenes] = await Promise.all([
                fetchApi(`/registros-diarios${filtroEquipo !== 'todos' ? `?equipoId=${filtroEquipo}` : ''}`),
                fetchApi('/equipos'),
                fetchApi('/warehouse'),
            ]);
            setRegistros(regs);
            setEquipos(eqs);
            if (almacenes?.length > 0) setAlmacenId(almacenes[0].id);
        } catch (e: any) {
            setError(e.message || 'Error al cargar');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [filtroEquipo]);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
        try {
            await fetchApi(`/registros-diarios/${id}`, { method: 'DELETE' });
            setRegistros(r => r.filter(x => x.id !== id));
        } catch (e: any) {
            alert(e.message || 'Error al eliminar');
        }
    };

    // KPIs acumulados del período visible
    const totalHoras   = registros.reduce((a, r) => a + r.horasTrabajadas, 0);
    const totalMetros  = registros.reduce((a, r) => a + r.metrosLineales,  0);
    const totalLitros  = registros.reduce((a, r) => a + r.litrosDiesel,    0);
    const totalCosto   = registros.reduce((a, r) => a + r.costoDiesel,     0);
    const promLtHr     = totalHoras > 0 ? (totalLitros / totalHoras).toFixed(2) : '—';
    const promMtHr     = totalHoras > 0 ? (totalMetros / totalHoras).toFixed(2) : '—';

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Registro Diario</h1>
                    <p className="text-sm text-gray-500 mt-1">Control diario de operación — equivalente a la hoja Rpte del Excel.</p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={filtroEquipo}
                        onChange={e => setFiltroEquipo(e.target.value)}
                        className="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="todos">Todos los equipos</option>
                        {equipos.map(eq => (
                            <option key={eq.id} value={eq.id}>{eq.nombre}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
                    >
                        <Plus size={16} /> Nuevo Registro
                    </button>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            {/* KPIs acumulados */}
            {!loading && registros.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Registros',     value: registros.length,                        unit: '' },
                        { label: 'Horas totales', value: totalHoras.toFixed(1),                   unit: 'hrs' },
                        { label: 'Metros totales', value: totalMetros.toFixed(1),                 unit: 'm' },
                        { label: 'Diésel total',  value: totalLitros.toLocaleString('es-MX'),     unit: 'lt' },
                        { label: 'Costo diésel',  value: `$${totalCosto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, unit: '' },
                        { label: 'Lt/hr prom.',   value: promLtHr,                                unit: '' },
                    ].map(k => (
                        <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                            <p className="text-xl font-bold text-gray-800">{k.value} <span className="text-sm font-normal text-gray-400">{k.unit}</span></p>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabla */}
            <Card>
                {loading ? (
                    <div className="p-10 text-center text-gray-400 text-sm">Cargando registros...</div>
                ) : registros.length === 0 ? (
                    <div className="p-10 text-center">
                        <ClipboardList size={36} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-600">No hay registros diarios</p>
                        <p className="text-xs text-gray-400 mt-1">Crea el primer registro con el botón de arriba.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipo</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Obra</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Horas</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Barrenos</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Metros</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Diésel</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Costo</th>
                                    <th className="p-3 w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {registros.map(r => (
                                    <RegistroRow key={r.id} r={r} onDelete={handleDelete} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {showModal && (
                <NuevoRegistroModal
                    equipoIdInicial={filtroEquipo !== 'todos' ? filtroEquipo : undefined}
                    equipos={equipos}
                    almacenId={almacenId}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); load(); }}
                />
            )}
        </div>
    );
}

export default function RegistrosDiariosPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>}>
            <RegistrosDiariosInner />
        </Suspense>
    );
}
