"use client";

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ClipboardList, Plus, Trash2, Gauge,
    Droplets, ChevronDown, ChevronUp,
    Search, X, Filter, Drill,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

type Registro = {
    id: string;
    fecha: string;
    equipo: { id?: string; nombre: string; numeroEconomico: string | null };
    cliente: { nombre: string } | null;
    obra: { id: string; nombre: string } | null;
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
    corte: { id: string; numero: number; status: string } | null;
    // Campos de perforación
    bordo: number | null;
    espaciamiento: number | null;
    volumenRoca: number | null;
    porcentajePerdida: number | null;
    profundidadPromedio: number | null;
    porcentajeAvance: number | null;
    rentaEquipoDiaria: number | null;
};

type Equipo = { id: string; nombre: string; numeroEconomico: string | null };
type ObraSimple = { id: string; nombre: string };

function RegistroRow({ r, onDelete }: { r: Registro; onDelete: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    // Parsear fecha segura sin problemas de zona horaria
    const [yr, mo, dy] = r.fecha.slice(0, 10).split('-').map(Number);
    const fechaObj = new Date(yr, mo - 1, dy);
    const fecha = fechaObj.toLocaleDateString('es-MX', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
    const nombreObra = r.obra?.nombre || r.obraNombre || r.cliente?.nombre || '—';

    return (
        <>
            <tr className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => setExpanded(v => !v)}>
                <td className="p-3">
                    <p className="text-sm font-semibold text-gray-700">{fecha}</p>
                    {r.semanaNum && <p className="text-xs text-gray-400">Sem. {r.semanaNum} / {r.anoNum}</p>}
                </td>
                <td className="p-3 text-sm text-gray-600">{r.equipo.nombre}</td>
                <td className="p-3">
                    <span className={`text-sm ${r.obra ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                        {nombreObra}
                    </span>
                    {r.corte && (
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-semibold ${
                            r.corte.status === 'COBRADO'   ? 'bg-green-100 text-green-700' :
                            r.corte.status === 'FACTURADO' ? 'bg-blue-100 text-blue-700'   :
                            'bg-gray-100 text-gray-500'
                        }`}>Corte #{r.corte.numero}</span>
                    )}
                </td>
                <td className="p-3 text-right font-bold text-gray-700">
                    {r.horasTrabajadas}<span className="text-xs font-normal text-gray-400"> hrs</span>
                </td>
                <td className="p-3 text-right text-gray-700">{r.barrenos}</td>
                <td className="p-3 text-right text-gray-700">
                    {Number(r.metrosLineales).toFixed(1)}<span className="text-xs text-gray-400"> m</span>
                </td>
                <td className="p-3 text-right font-semibold text-blue-600">
                    {r.litrosDiesel}<span className="text-xs font-normal text-gray-400"> lt</span>
                </td>
                <td className="p-3 text-right font-semibold text-gray-700">
                    ${r.costoDiesel.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                </td>
                <td className="p-3 text-right">
                    <div className="flex justify-end items-center gap-1">
                        <button onClick={e => { e.stopPropagation(); onDelete(r.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={13}/>
                        </button>
                        {expanded ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr className="bg-blue-50/20">
                    <td colSpan={9} className="px-6 py-4 space-y-3">
                        {/* Fila 1: datos operativos */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Horómetro</p>
                                <p className="font-semibold text-gray-700">
                                    {r.horometroInicio.toLocaleString()} → {r.horometroFin.toLocaleString()} hrs
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Personal</p>
                                <p className="font-semibold text-gray-700">
                                    {r.operadores} op. / {r.peones} peón{r.peones !== 1 ? 'es' : ''}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Gauge size={11}/> KPIs</p>
                                <p className="text-xs text-gray-600">Lt/hr: <span className="font-bold">{r.kpi.litrosPorHora ?? 'N/A'}</span></p>
                                <p className="text-xs text-gray-600">Lt/mt: <span className="font-bold">{r.kpi.litrosPorMetro ?? 'N/A'}</span></p>
                                <p className="text-xs text-gray-600">Mt/hr: <span className="font-bold">{r.kpi.metrosPorHora ?? 'N/A'}</span></p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Droplets size={11}/> Diésel</p>
                                <p className="text-xs text-gray-600">{r.litrosDiesel} lt × ${r.precioDiesel}/lt</p>
                                <p className="text-xs font-bold text-gray-700">= ${r.costoDiesel.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>

                        {/* Fila 2: datos de perforación (solo si existen) */}
                        {(r.bordo != null || r.espaciamiento != null || r.profundidadPromedio != null || r.volumenRoca != null || r.porcentajePerdida != null || r.porcentajeAvance != null || r.rentaEquipoDiaria != null) && (
                            <div className="bg-indigo-50/80 border border-indigo-100 rounded-lg px-4 py-3">
                                <p className="text-xs font-semibold text-indigo-400 mb-2 flex items-center gap-1">
                                    <Drill size={11}/> Perforación (Track Drill)
                                </p>
                                <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 text-xs">
                                    {r.bordo != null && (
                                        <div>
                                            <p className="text-indigo-300 mb-0.5">Bordo</p>
                                            <p className="font-bold text-indigo-700">{r.bordo} m</p>
                                        </div>
                                    )}
                                    {r.espaciamiento != null && (
                                        <div>
                                            <p className="text-indigo-300 mb-0.5">Espaciam.</p>
                                            <p className="font-bold text-indigo-700">{r.espaciamiento} m</p>
                                        </div>
                                    )}
                                    {r.profundidadPromedio != null && (
                                        <div>
                                            <p className="text-indigo-300 mb-0.5">Prof. prom.</p>
                                            <p className="font-bold text-indigo-700">{r.profundidadPromedio} m</p>
                                        </div>
                                    )}
                                    {r.volumenRoca != null && (
                                        <div>
                                            <p className="text-indigo-300 mb-0.5">Vol. roca</p>
                                            <p className="font-bold text-indigo-700">{Number(r.volumenRoca).toFixed(2)} m³</p>
                                        </div>
                                    )}
                                    {r.porcentajePerdida != null && (
                                        <div>
                                            <p className="text-indigo-300 mb-0.5">% Pérdida</p>
                                            <p className="font-bold text-indigo-700">{r.porcentajePerdida}%</p>
                                        </div>
                                    )}
                                    {r.porcentajeAvance != null && (
                                        <div>
                                            <p className="text-indigo-300 mb-0.5">% Avance</p>
                                            <p className="font-bold text-indigo-700">{r.porcentajeAvance}%</p>
                                        </div>
                                    )}
                                    {r.rentaEquipoDiaria != null && (
                                        <div>
                                            <p className="text-indigo-300 mb-0.5">Renta/día</p>
                                            <p className="font-bold text-indigo-700">${Number(r.rentaEquipoDiaria).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

function RegistrosDiariosInner() {
    const searchParams  = useSearchParams();
    const router        = useRouter();
    const equipoIdParam = searchParams.get('equipoId') || undefined;
    const obraIdParam   = searchParams.get('obraId')   || undefined;

    const [registros,  setRegistros]  = useState<Registro[]>([]);
    const [equipos,    setEquipos]    = useState<Equipo[]>([]);
    const [obras,      setObras]      = useState<ObraSimple[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState('');

    // Filtros
    const [filtroEquipo, setFiltroEquipo] = useState(equipoIdParam ?? 'todos');
    const [filtroObra,   setFiltroObra]   = useState(obraIdParam   ?? 'todas');
    const [filtroDesde,  setFiltroDesde]  = useState('');
    const [filtroHasta,  setFiltroHasta]  = useState('');
    const [filtroSemana, setFiltroSemana] = useState('todas');
    const [busqueda,     setBusqueda]     = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const [regs, eqs, obs] = await Promise.all([
                fetchApi('/registros-diarios'),
                fetchApi('/equipos'),
                fetchApi('/obras'),
            ]);
            setRegistros(regs);
            setEquipos(eqs);
            setObras(obs);
        } catch (e: any) {
            setError(e.message || 'Error al cargar');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este registro?')) return;
        try {
            await fetchApi(`/registros-diarios/${id}`, { method: 'DELETE' });
            setRegistros(r => r.filter(x => x.id !== id));
        } catch (e: any) { alert(e.message || 'Error'); }
    };

    const semanas = useMemo(() =>
        Array.from(new Set(
            registros.filter(r => r.semanaNum)
                .map(r => `${r.anoNum}-${String(r.semanaNum).padStart(2, '0')}`)
        )).sort().reverse(),
    [registros]);

    const filtrados = useMemo(() => registros.filter(r => {
        if (filtroEquipo !== 'todos') {
            const eq = equipos.find(e => e.id === filtroEquipo);
            if (eq && r.equipo.nombre !== eq.nombre) return false;
        }
        if (filtroObra !== 'todas' && r.obra?.id !== filtroObra) return false;
        if (filtroSemana !== 'todas') {
            const key = `${r.anoNum}-${String(r.semanaNum).padStart(2, '0')}`;
            if (key !== filtroSemana) return false;
        }
        if (filtroDesde && r.fecha.slice(0, 10) < filtroDesde) return false;
        if (filtroHasta && r.fecha.slice(0, 10) > filtroHasta) return false;
        if (busqueda) {
            const q = busqueda.toLowerCase();
            return r.equipo.nombre.toLowerCase().includes(q)
                || (r.obra?.nombre || '').toLowerCase().includes(q)
                || (r.obraNombre  || '').toLowerCase().includes(q);
        }
        return true;
    }), [registros, filtroEquipo, filtroObra, filtroSemana, filtroDesde, filtroHasta, busqueda, equipos]);

    const hayFiltros = filtroEquipo !== 'todos' || filtroObra !== 'todas' ||
        filtroSemana !== 'todas' || !!filtroDesde || !!filtroHasta || !!busqueda;

    const clearFiltros = () => {
        setFiltroEquipo('todos'); setFiltroObra('todas');
        setFiltroSemana('todas'); setFiltroDesde(''); setFiltroHasta(''); setBusqueda('');
    };

    const totalHoras  = filtrados.reduce((a, r) => a + r.horasTrabajadas, 0);
    const totalMetros = filtrados.reduce((a, r) => a + r.metrosLineales,  0);
    const totalLitros = filtrados.reduce((a, r) => a + r.litrosDiesel,    0);
    const totalCosto  = filtrados.reduce((a, r) => a + r.costoDiesel,     0);
    const promLtHr    = totalHoras > 0 ? (totalLitros / totalHoras).toFixed(2) : '—';

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Registro Diario</h1>
                    <p className="text-sm text-gray-500 mt-1">Control diario de operación — equivalente a la hoja Rpte del Excel.</p>
                </div>
                <button
                    onClick={() => {
                        const params = new URLSearchParams();
                        if (filtroEquipo !== 'todos') params.set('equipoId', filtroEquipo);
                        if (filtroObra   !== 'todas') params.set('obraId',   filtroObra);
                        const qs = params.toString();
                        router.push(`/dashboard/registros-diarios/new${qs ? `?${qs}` : ''}`);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                    <Plus size={16}/> Nuevo Registro
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            {/* Filtros */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-blue-500"/>
                    <span className="text-sm font-semibold text-gray-600">Filtros</span>
                    {hayFiltros && (
                        <button onClick={clearFiltros}
                            className="ml-auto text-xs text-red-400 hover:text-red-600 hover:underline flex items-center gap-1">
                            <X size={12}/> Limpiar
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <div className="relative col-span-2 sm:col-span-1">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"/>
                    </div>

                    <select value={filtroEquipo} onChange={e => setFiltroEquipo(e.target.value)}
                        className={`py-1.5 px-2 text-xs border rounded-lg bg-white focus:outline-none ${filtroEquipo !== 'todos' ? 'border-blue-400 text-blue-700 font-semibold' : 'border-gray-200 text-gray-700'}`}>
                        <option value="todos">Todos los equipos</option>
                        {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
                    </select>

                    <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)}
                        className={`py-1.5 px-2 text-xs border rounded-lg bg-white focus:outline-none ${filtroObra !== 'todas' ? 'border-blue-400 text-blue-700 font-semibold' : 'border-gray-200 text-gray-700'}`}>
                        <option value="todas">Todas las obras</option>
                        {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                    </select>

                    <select value={filtroSemana}
                        onChange={e => { setFiltroSemana(e.target.value); setFiltroDesde(''); setFiltroHasta(''); }}
                        className={`py-1.5 px-2 text-xs border rounded-lg bg-white focus:outline-none ${filtroSemana !== 'todas' ? 'border-blue-400 text-blue-700 font-semibold' : 'border-gray-200 text-gray-700'}`}>
                        <option value="todas">Todas las semanas</option>
                        {semanas.map(s => {
                            const [ano, sem] = s.split('-');
                            return <option key={s} value={s}>Sem. {parseInt(sem)} / {ano}</option>;
                        })}
                    </select>

                    <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400 flex-shrink-0">Desde</span>
                        <input type="date" value={filtroDesde}
                            onChange={e => { setFiltroDesde(e.target.value); setFiltroSemana('todas'); }}
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white"/>
                    </div>

                    <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400 flex-shrink-0">Hasta</span>
                        <input type="date" value={filtroHasta}
                            onChange={e => { setFiltroHasta(e.target.value); setFiltroSemana('todas'); }}
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white"/>
                    </div>
                </div>

                {hayFiltros && (
                    <p className="text-xs text-blue-600">
                        Mostrando <span className="font-bold">{filtrados.length}</span> de {registros.length} registros
                    </p>
                )}
            </div>

            {/* KPIs */}
            {!loading && filtrados.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Registros',      value: String(filtrados.length),                                        unit: '' },
                        { label: 'Horas totales',  value: totalHoras.toFixed(1),                                           unit: 'hrs' },
                        { label: 'Metros totales', value: totalMetros.toFixed(1),                                          unit: 'm' },
                        { label: 'Diésel total',   value: totalLitros.toLocaleString('es-MX'),                             unit: 'lt' },
                        { label: 'Costo diésel',   value: `$${totalCosto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, unit: '' },
                        { label: 'Lt/hr prom.',    value: promLtHr,                                                        unit: '' },
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
                ) : filtrados.length === 0 ? (
                    <div className="p-10 text-center">
                        <ClipboardList size={36} className="text-gray-300 mx-auto mb-3"/>
                        <p className="text-sm font-semibold text-gray-600">
                            {registros.length === 0 ? 'No hay registros diarios' : 'Sin registros para los filtros aplicados'}
                        </p>
                        {hayFiltros && (
                            <button onClick={clearFiltros} className="mt-3 text-xs text-blue-500 hover:underline">
                                Limpiar filtros
                            </button>
                        )}
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
                                {filtrados.map(r => (
                                    <RegistroRow key={r.id} r={r} onDelete={handleDelete}/>
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

export default function RegistrosDiariosPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>}>
            <RegistrosDiariosInner/>
        </Suspense>
    );
}
