"use client";

import { useEffect, useState } from 'react';
import { Wrench, Plus, Edit, Trash2, CheckCircle, XCircle, ClipboardList } from 'lucide-react';
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
    _count: { registrosDiarios: number };
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
    const [form, setForm] = useState({
        nombre:           equipo?.nombre           ?? '',
        modelo:           equipo?.modelo           ?? '',
        numeroSerie:      equipo?.numeroSerie      ?? '',
        numeroEconomico:  equipo?.numeroEconomico  ?? '',
        hodometroInicial: equipo?.hodometroInicial ?? 0,
        notas:            equipo?.notas            ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    const handleSave = async () => {
        if (!form.nombre.trim()) { setError('El nombre es requerido'); return; }
        setSaving(true); setError('');
        try {
            if (isEdit) {
                await fetchApi(`/equipos/${equipo!.id}`, { method: 'PUT', body: JSON.stringify(form) });
            } else {
                await fetchApi('/equipos', { method: 'POST', body: JSON.stringify(form) });
            }
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input
                type={type}
                value={String(form[key])}
                onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-800 mb-4">
                    {isEdit ? 'Editar Equipo' : 'Nuevo Equipo'}
                </h2>

                <div className="space-y-3">
                    {field('Nombre *', 'nombre', 'text', 'Ej: Perforadora Atlas Copco')}
                    {field('Modelo', 'modelo', 'text', 'Ej: ROC D7')}
                    <div className="grid grid-cols-2 gap-3">
                        {field('Número de serie', 'numeroSerie')}
                        {field('Número económico', 'numeroEconomico', 'text', 'Ej: EQ-001')}
                    </div>
                    {field('Horómetro inicial (hrs)', 'hodometroInicial', 'number')}
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

                {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
                    >
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
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
                </div>
            )}

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
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipo</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Modelo</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">N° Económico</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Horómetro ini.</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Registros</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Estado</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {equipos.map(eq => (
                                    <tr key={eq.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <Wrench size={14} className="text-blue-600" />
                                                </div>
                                                <div>
                                                    <Link href={`/dashboard/equipos/${eq.id}`} className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors">
                                                        {eq.nombre}
                                                    </Link>
                                                    {eq.numeroSerie && <p className="text-xs text-gray-400 font-mono">S/N: {eq.numeroSerie}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-sm text-gray-500">{eq.modelo || '—'}</td>
                                        <td className="p-3 text-sm font-mono text-gray-600">{eq.numeroEconomico || '—'}</td>
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
