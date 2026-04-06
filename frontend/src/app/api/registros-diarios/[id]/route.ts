"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Wrench, ArrowLeft, Plus, Trash2, Edit,
    CheckCircle, XCircle, Gauge, Droplets,
    ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

type Registro = {
    id: string;
    fecha: string;
    horasTrabajadas: number;
    barrenos: number;
    metrosLineales: number;
    litrosDiesel: number;
    precioDiesel: number;
    costoDiesel: number;
    operadores: number;
    peones: number;
    obraNombre: string | null;
    semanaNum: number | null;
    anoNum: number | null;
    kpi: { litrosPorHora: number | null; litrosPorMetro: number | null; metrosPorHora: number | null };
    usuario: { nombre: string };
};

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
    registrosDiarios: Registro[];
};

// ── Fila expandible ───────────────────────────────────────────────────────────
function RegistroRow({ r, onDelete }: { r: Registro; onDelete: (id: string) => void }) {
    const [exp, setExp] = useState(false);
    const fecha = new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });

    return (
        <>
            <tr
                className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                onClick={() => setExp(v => !v)}
            >
                <td className="p-3">
                    <div>
                        <p className="text-sm font-semibold text-gray-700">{fecha}</p>
                        {r.semanaNum && <p className="text-xs text-gray-400">Sem. {r.semanaNum} / {r.anoNum}</p>}
                    </div>
                </td>
                <td className="p-3 text-sm text-gray-500">{r.obraNombre || '—'}</td>
                <td className="p-3 text-right font-bold text-gray-700">{r.horasTrabajadas} <span className="text-xs font-normal text-gray-400">hrs</span></td>
                <td className="p-3 text-right text-gray-700">{r.barrenos}</td>
                <td className="p-3 text-right text-gray-700">{Number(r.metrosLineales).toFixed(1)} <span className="text-xs text-gray-400">m</span></td>
                <td className="p-3 text-right text-blue-600 font-semibold">{r.litrosDiesel} <span className="text-xs font-normal text-gray-400">lt</span></td>
                <td className="p-3 text-right text-gray-700">${Number(r.costoDiesel).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</td>
                <td className="p-3 text-right">
                    <div className="flex justify-end items-center gap-1">
                        <button
                            onClick={e => { e.stopPropagation(); onDelete(r.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 size={13} />
                        </button>
                        {exp ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                </td>
            </tr>
            {exp && (
                <tr className="bg-blue-50/20">
                    <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Personal</p>
                                <p className="font-semibold text-gray-700">{r.operadores} op. / {r.peones} peón{r.peones !== 1 ? 'es' : ''}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Gauge size={11} /> KPIs</p>
                                <p className="text-xs text-gray-600">Lt/hr: <span className="font-bold">{r.kpi.litrosPorHora ?? 'N/A'}</span></p>
                                <p className="text-xs text-gray-600">Lt/mt: <span className="font-bold">{r.kpi.litrosPorMetro ?? 'N/A'}</span></p>
                                <p className="text-xs text-gray-600">Mt/hr: <span className="font-bold">{r.kpi.metrosPorHora ?? 'N/A'}</span></p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Droplets size={11} /> Diésel</p>
                                <p className="text-xs text-gray-600">{r.litrosDiesel} lt × ${r.precioDiesel}/lt</p>
                                <p className="text-xs font-bold text-gray-700">= ${Number(r.costoDiesel).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Registrado por</p>
                                <p className="font-semibold text-gray-700">{r.usuario?.nombre}</p>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function EquipoDetallePage() {
    const params  = useParams();
    const router  = useRouter();
    const id      = params.id as string;

    const [equipo,   setEquipo]   = useState<Equipo | null>(null);
    const [registros, setRegistros] = useState<Registro[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');

    // Filtros
    const [filtroSemana, setFiltroSemana] = useState('todas');
    const [filtroDesde,  setFiltroDesde]  = useState('');
    const [filtroHasta,  setFiltroHasta]  = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const [eq, regs] = await Promise.all([
                fetchApi(`/equipos/${id}`),
                fetchApi(`/registros-diarios?equipoId=${id}`),
            ]);
            setEquipo(eq);
            setRegistros(regs);
        } catch (e: any) {
            setError(e.message || 'Error al cargar');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);

    const handleDelete = async (regId: string) => {
        if (!confirm('¿Eliminar este registro?')) return;
        try {
            await fetchApi(`/registros-diarios/${regId}`, { method: 'DELETE' });
            setRegistros(r => r.filter(x => x.id !== regId));
        } catch (e: any) { alert(e.message || 'Error'); }
    };

    // Semanas disponibles para filtro
    const semanas = Array.from(
        new Set(registros.filter(r => r.semanaNum).map(r => `${r.anoNum}-${String(r.semanaNum).padStart(2, '0')}`))
    ).sort().reverse();

    // Registros filtrados
    const filtrados = registros.filter(r => {
        if (filtroSemana !== 'todas') {
            const key = `${r.anoNum}-${String(r.semanaNum).padStart(2, '0')}`;
            if (key !== filtroSemana) return false;
        }
        if (filtroDesde && r.fecha.slice(0, 10) < filtroDesde) return false;
        if (filtroHasta && r.fecha.slice(0, 10) > filtroHasta) return false;
        return true;
    });

    // KPIs acumulados del filtro
    const totalHoras  = filtrados.reduce((a, r) => a + Number(r.horasTrabajadas), 0);
    const totalMetros = filtrados.reduce((a, r) => a + Number(r.metrosLineales),  0);
    const totalLitros = filtrados.reduce((a, r) => a + Number(r.litrosDiesel),    0);
    const totalCosto  = filtrados.reduce((a, r) => a + Number(r.costoDiesel),     0);
    const ltHr = totalHoras > 0 ? (totalLitros / totalHoras).toFixed(2) : '—';
    const mtHr = totalHoras > 0 ? (totalMetros / totalHoras).toFixed(2) : '—';

    if (loading) return <div className="p-10 text-center text-gray-400">Cargando...</div>;
    if (error)   return <div className="p-10 text-center text-red-500">{error}</div>;
    if (!equipo) return <div className="p-10 text-center text-gray-400">Equipo no encontrado</div>;

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Wrench size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{equipo.nombre}</h1>
                            <p className="text-sm text-gray-400">
                                {equipo.numeroEconomico && <span className="mr-2">N° {equipo.numeroEconomico}</span>}
                                {equipo.modelo && <span className="mr-2">· {equipo.modelo}</span>}
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${equipo.activo ? 'text-green-600' : 'text-gray-400'}`}>
                                    {equipo.activo ? <CheckCircle size={11} /> : <XCircle size={11} />}
                                    {equipo.activo ? 'Activo' : 'Inactivo'}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
                <Link
                    href={`/dashboard/registros-diarios/new?equipoId=${id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
                >
                    <Plus size={16} /> Nuevo Registro
                </Link>
            </div>

            {/* Info del equipo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-400 mb-1">Horómetro actual</p>
                    <p className="text-xl font-bold text-gray-800">{equipo.hodometroInicial.toLocaleString('es-MX')} <span className="text-sm font-normal text-gray-400">hrs</span></p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-400 mb-1">Total registros</p>
                    <p className="text-xl font-bold text-gray-800">{equipo._count.registrosDiarios}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-400 mb-1">Número de serie</p>
                    <p className="text-sm font-semibold text-gray-700">{equipo.numeroSerie || '—'}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-400 mb-1">Notas</p>
                    <p className="text-xs text-gray-600 line-clamp-2">{equipo.notas || '—'}</p>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <Calendar size={15} className="text-blue-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-600">Filtrar:</span>

                <select
                    value={filtroSemana}
                    onChange={e => { setFiltroSemana(e.target.value); setFiltroDesde(''); setFiltroHasta(''); }}
                    className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                    <option value="todas">Todas las semanas</option>
                    {semanas.map(s => {
                        const [ano, sem] = s.split('-');
                        return <option key={s} value={s}>Semana {parseInt(sem)} / {ano}</option>;
                    })}
                </select>

                <span className="text-xs text-gray-400">ó rango:</span>
                <div className="flex items-center gap-2">
                    <input type="date" value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setFiltroSemana('todas'); }}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 bg-white" />
                    <span className="text-xs text-gray-400">→</span>
                    <input type="date" value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setFiltroSemana('todas'); }}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 bg-white" />
                </div>

                {(filtroSemana !== 'todas' || filtroDesde || filtroHasta) && (
                    <button
                        onClick={() => { setFiltroSemana('todas'); setFiltroDesde(''); setFiltroHasta(''); }}
                        className="text-xs text-red-400 hover:text-red-600 hover:underline"
                    >
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* KPIs del período filtrado */}
            {filtrados.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                    {[
                        { label: 'Registros',    val: filtrados.length,              unit: '' },
                        { label: 'Horas',        val: totalHoras.toFixed(1),         unit: 'hrs' },
                        { label: 'Metros',       val: totalMetros.toFixed(1),        unit: 'm' },
                        { label: 'Diésel',       val: totalLitros.toLocaleString(),  unit: 'lt' },
                        { label: 'Lt/hr prom.',  val: ltHr,                          unit: '' },
                        { label: 'Costo diésel', val: `$${totalCosto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, unit: '' },
                    ].map(k => (
                        <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                            <p className="text-lg font-bold text-gray-800">{k.val} <span className="text-xs font-normal text-gray-400">{k.unit}</span></p>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabla de registros */}
            <Card>
                {filtrados.length === 0 ? (
                    <div className="p-10 text-center">
                        <p className="text-sm text-gray-500 font-medium">Sin registros para el filtro seleccionado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
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
                                {filtrados.map(r => (
                                    <RegistroRow key={r.id} r={r} onDelete={handleDelete} />
                                ))}
                            </tbody>
                        </table>
                        <div className="p-4 border-t border-gray-100 text-xs text-gray-400">
                            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
                            {filtrados.length !== registros.length && ` (de ${registros.length} totales)`}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
