"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Receipt, Plus, Trash2, X, Filter, Package, ShoppingCart,
    AlertTriangle, Building2, Wrench, Users, GitBranch, ChevronDown, ChevronUp, Pencil, CheckCircle,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

type TipoGasto   = 'INSUMO' | 'EXTERNO';
type NivelGasto  = 'GENERAL' | 'POR_EQUIPO' | 'POR_PLANTILLA' | 'DISTRIBUIBLE';

type Distribucion = {
    id: string; plantillaId: string; porcentaje: number;
    montoAsignado: number; metodoAsignacion: string;
    plantilla: { numero: number };
};

type Gasto = {
    id: string; equipoId: string | null; obraId: string; plantillaId: string | null;
    nivelGasto: NivelGasto; distribuible: boolean; semanaNum: number; anoNum: number;
    fechaInicio: string | null; fechaFin: string | null; tipoGasto: TipoGasto;
    categoria: string; producto: string; productoId: string | null; unidad: string;
    cantidad: number; precioUnitario: number; total: number; moneda: 'MXN' | 'USD';
    tipoCambio: number | null; notas: string | null;
    equipo:        { nombre: string; numeroEconomico: string | null } | null;
    obra:          { nombre: string } | null;
    plantilla:     { numero: number; fechaInicio: string | null; fechaFin: string | null } | null;
    productoRef:   { nombre: string; unidad: string; stockActual: number } | null;
    distribuciones: Distribucion[];
};

type Equipo  = { id: string; nombre: string; numeroEconomico: string | null };
type Obra    = { id: string; nombre: string; status: string };
type Almacen = { id: string; nombre: string };
type ProductoCatalogo = {
    id: string; nombre: string; sku: string; unidad: string;
    precioCompra: number; stockActual: number; stockMinimo: number;
    stockBajo: boolean; moneda: string;
};
type PlantillaResumen = {
    id: string; numero: number; fechaInicio: string | null; fechaFin: string | null;
    status: string; plantillaEquipos: { equipoId: string; equipo: Equipo }[];
};
type DistribucionRow = { plantillaId: string; porcentaje: string };

const CATEGORIAS: Record<string, { label: string; color: string }> = {
    LUBRICANTE:   { label: 'Lubricante',   color: 'bg-yellow-100 text-yellow-700' },
    FILTRO:       { label: 'Filtro',       color: 'bg-orange-100 text-orange-700' },
    HERRAMIENTA:  { label: 'Herramienta',  color: 'bg-blue-100 text-blue-700'    },
    COMBUSTIBLE:  { label: 'Combustible',  color: 'bg-red-100 text-red-700'      },
    PERSONAL:     { label: 'Personal',     color: 'bg-purple-100 text-purple-700' },
    VEHICULO:     { label: 'Vehículo',     color: 'bg-indigo-100 text-indigo-700' },
    RENTA_EQUIPO: { label: 'Renta equipo', color: 'bg-orange-100 text-orange-800' },
    OTRO:         { label: 'Otro',         color: 'bg-gray-100 text-gray-600'    },
};

const NIVEL_INFO: Record<NivelGasto, { label: string; desc: string; sel: string; icon: React.ReactNode }> = {
    GENERAL:       { label: 'General de obra',  desc: 'Sin equipo ni plantilla',      sel: 'border-gray-400 bg-gray-50',       icon: <Building2 size={18} className="text-gray-500 mt-0.5 flex-shrink-0"/> },
    POR_EQUIPO:    { label: 'Por equipo',        desc: 'Asignado a un equipo',         sel: 'border-blue-400 bg-blue-50',       icon: <Wrench    size={18} className="text-blue-500 mt-0.5 flex-shrink-0"/>  },
    POR_PLANTILLA: { label: 'Por plantilla',     desc: 'Asignado a una plantilla',     sel: 'border-purple-400 bg-purple-50',   icon: <Users     size={18} className="text-purple-500 mt-0.5 flex-shrink-0"/>},
    DISTRIBUIBLE:  { label: 'Distribuible',      desc: 'Repartir entre plantillas',    sel: 'border-emerald-400 bg-emerald-50', icon: <GitBranch size={18} className="text-emerald-500 mt-0.5 flex-shrink-0"/>},
};

function NivelBadge({ nivel }: { nivel: NivelGasto }) {
    const m: Record<NivelGasto, { label: string; color: string }> = {
        GENERAL:       { label: 'General',     color: 'bg-gray-100 text-gray-600'       },
        POR_EQUIPO:    { label: 'Equipo',       color: 'bg-blue-100 text-blue-700'       },
        POR_PLANTILLA: { label: 'Plantilla',    color: 'bg-purple-100 text-purple-700'   },
        DISTRIBUIBLE:  { label: 'Distribuible', color: 'bg-emerald-100 text-emerald-700' },
    };
    const { label, color } = m[nivel] ?? m.GENERAL;
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}

function GastoRow({ g, fmt, onDelete, onEdit }: { g: Gasto; fmt: (n: number) => string; onDelete: (id: string) => void; onEdit: (g: Gasto) => void }) {
    const [expanded, setExpanded] = useState(false);
    const hasDist = g.distribuciones && g.distribuciones.length > 0;
    const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
    return (<>
        <tr className="hover:bg-blue-50/20 transition-colors group">
            <td className="p-3 text-xs text-gray-500">
                {g.fechaInicio ? fmtDate(g.fechaInicio) : `S${g.semanaNum}/${g.anoNum}`}
                {g.fechaFin && <span className="block text-gray-400">→ {fmtDate(g.fechaFin)}</span>}
            </td>
            <td className="p-3">
                <div className="flex flex-col gap-1">
                    <NivelBadge nivel={g.nivelGasto ?? 'GENERAL'}/>
                    {g.tipoGasto === 'INSUMO'
                        ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600"><Package size={9}/> Insumo</span>
                        : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600"><ShoppingCart size={9}/> Externo</span>}
                </div>
            </td>
            <td className="p-3">
                {g.equipo
                    ? <><p className="text-sm font-medium text-gray-700">{g.equipo.nombre}</p>
                        {g.equipo.numeroEconomico && <p className="text-xs text-gray-400">{g.equipo.numeroEconomico}</p>}</>
                    : <span className="text-xs text-gray-400">—</span>}
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
            <td className="p-3 text-right text-sm text-gray-600">{g.cantidad} {g.unidad}</td>
            <td className="p-3 text-right text-sm text-gray-600">${fmt(g.precioUnitario)}</td>
            <td className="p-3 text-right">
                <span className="text-sm font-bold text-gray-800">${fmt(g.total)}</span>
                <p className="text-xs text-gray-400">{g.moneda}</p>
            </td>
            <td className="p-3">
                <p className="text-xs text-gray-600">{g.obra?.nombre ?? '—'}</p>
                {g.plantilla && <p className="text-xs text-gray-400">Plt. {g.plantilla.numero}</p>}
                {hasDist && (
                    <button onClick={() => setExpanded(e => !e)}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 mt-0.5">
                        {g.distribuciones.length} plt. {expanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
                    </button>
                )}
            </td>
            <td className="p-3 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(g)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Editar gasto">
                        <Pencil size={13}/>
                    </button>
                    <button onClick={() => onDelete(g.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title={g.tipoGasto === 'INSUMO' ? 'Eliminar (restaura stock)' : 'Eliminar'}>
                        <Trash2 size={14}/>
                    </button>
                </div>
            </td>
        </tr>
        {expanded && hasDist && (
            <tr>
                <td colSpan={10} className="bg-emerald-50/50 px-6 py-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">Distribución entre plantillas</p>
                    <div className="flex flex-wrap gap-3">
                        {g.distribuciones.map(d => (
                            <div key={d.id} className="bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-xs">
                                <span className="font-medium text-gray-700">Plt. {d.plantilla.numero}</span>
                                <span className="text-emerald-600 ml-2">{Number(d.porcentaje).toFixed(1)}%</span>
                                <span className="text-gray-500 ml-2">${fmt(Number(d.montoAsignado))}</span>
                            </div>
                        ))}
                    </div>
                </td>
            </tr>
        )}
    </>);
}

function GastoModal({ equipos, obras, onClose, onSaved }: {
    equipos: Equipo[]; obras: Obra[]; onClose: () => void; onSaved: () => void;
}) {
    const hoy = new Date().toISOString().slice(0, 10);
    const [nivelGasto,  setNivelGasto]  = useState<NivelGasto | ''>('');
    const [tipoGasto,   setTipoGasto]   = useState<TipoGasto | ''>('');
    const [obraId,      setObraId]      = useState('');
    const [equipoId,    setEquipoId]    = useState('');
    const [plantillaId, setPlantillaId] = useState('');
    const [fechaInicio, setFechaInicio] = useState(hoy);
    const [fechaFin,    setFechaFin]    = useState('');
    const [plantillas,        setPlantillas]        = useState<PlantillaResumen[]>([]);
    const [loadingPlantillas, setLoadingPlantillas] = useState(false);
    const [busqueda,    setBusqueda]    = useState('');
    const [productoSel, setProductoSel] = useState<ProductoCatalogo | null>(null);
    const [cantidadIn,  setCantidadIn]  = useState('');
    const [almacenId,   setAlmacenId]   = useState('');
    const [almacenes,   setAlmacenes]   = useState<Almacen[]>([]);
    const [catFiltrado, setCatFiltrado] = useState<ProductoCatalogo[]>([]);
    const [catTodos,    setCatTodos]    = useState<ProductoCatalogo[]>([]);
    const [loadCat,     setLoadCat]     = useState(false);
    const [extForm, setExtForm] = useState({ categoria:'OTRO', producto:'', unidad:'pza', cantidad:'', precioUnitario:'', moneda:'MXN', tipoCambio:'', notas:'' });
    const [distRows, setDistRows] = useState<DistribucionRow[]>([{ plantillaId: '', porcentaje: '' }]);
    const [saving,  setSaving]  = useState(false);
    const [err,     setErr]     = useState('');

    useEffect(() => {
        setLoadCat(true);
        Promise.all([fetchApi('/products'), fetchApi('/warehouse')])
            .then(([p, a]) => { setCatTodos(p); setCatFiltrado(p); setAlmacenes(a); if (a.length) setAlmacenId(a[0].id); })
            .catch(() => {}).finally(() => setLoadCat(false));
    }, []);

    useEffect(() => {
        const q = busqueda.toLowerCase().trim();
        setCatFiltrado(!q ? catTodos : catTodos.filter(p => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
    }, [busqueda, catTodos]);

    useEffect(() => {
        if (!obraId) { setPlantillas([]); setPlantillaId(''); setEquipoId(''); return; }
        setLoadingPlantillas(true);
        fetchApi(`/obras/${obraId}`).then((o: any) => setPlantillas(o.plantillas ?? [])).catch(() => setPlantillas([])).finally(() => setLoadingPlantillas(false));
        setPlantillaId(''); setEquipoId('');
    }, [obraId]);

    const equiposFilt: Equipo[] = (() => {
        if (plantillaId) { const p = plantillas.find(x => x.id === plantillaId); return p ? p.plantillaEquipos.map(pe => pe.equipo) : []; }
        if (obraId) { const ids = new Set<string>(); const res: Equipo[] = []; plantillas.forEach(p => p.plantillaEquipos.forEach(pe => { if (!ids.has(pe.equipoId)) { ids.add(pe.equipoId); res.push(pe.equipo); } })); return res.length ? res : equipos; }
        return equipos;
    })();

    const totalExt  = extForm.cantidad && extForm.precioUnitario ? Number(extForm.cantidad) * Number(extForm.precioUnitario) : null;
    const totalInsu = productoSel && cantidadIn ? Number(cantidadIn) * productoSel.precioCompra : null;
    const totalAct  = tipoGasto === 'INSUMO' ? totalInsu : totalExt;
    const sumaPct   = distRows.reduce((a, r) => a + (Number(r.porcentaje) || 0), 0);
    const distOk    = nivelGasto !== 'DISTRIBUIBLE' || (distRows.every(r => r.plantillaId && Number(r.porcentaje) > 0) && Math.abs(sumaPct - 100) < 0.01);
    const setExt    = (k: keyof typeof extForm, v: string) => setExtForm(f => ({ ...f, [k]: v }));
    const addRow    = () => setDistRows(r => [...r, { plantillaId: '', porcentaje: '' }]);
    const rmRow     = (i: number) => setDistRows(r => r.filter((_, idx) => idx !== i));
    const setRow    = (i: number, k: keyof DistribucionRow, v: string) => setDistRows(r => r.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
    const distribuirEq = () => {
        const n = distRows.length; if (!n) return;
        const base = Math.floor(10000 / n) / 100;
        const resto = parseFloat((100 - base * n).toFixed(2));
        setDistRows(r => r.map((x, i) => ({ ...x, porcentaje: i === 0 ? String(base + resto) : String(base) })));
    };
    const fmtD = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });

    const handleSave = async () => {
        setErr('');
        if (!nivelGasto) { setErr('Selecciona el nivel del gasto'); return; }
        if (!tipoGasto)  { setErr('Selecciona si es insumo o gasto externo'); return; }
        if (!obraId)     { setErr('La obra es obligatoria'); return; }
        if (nivelGasto === 'POR_EQUIPO'    && !equipoId)    { setErr('Selecciona el equipo'); return; }
        if (nivelGasto === 'POR_PLANTILLA' && !plantillaId) { setErr('Selecciona la plantilla'); return; }
        if (nivelGasto === 'DISTRIBUIBLE') {
            if (distRows.some(r => !r.plantillaId)) { setErr('Selecciona la plantilla en cada fila'); return; }
            if (Math.abs(sumaPct - 100) > 0.01) { setErr(`Los % deben sumar 100%. Suma actual: ${sumaPct.toFixed(2)}%`); return; }
        }
        setSaving(true);
        try {
            const base: Record<string, unknown> = {
                obraId, equipoId: equipoId || null,
                plantillaId: nivelGasto === 'POR_PLANTILLA' ? plantillaId : null,
                fechaInicio, fechaFin: fechaFin || null,
                nivelGasto, distribuible: nivelGasto === 'DISTRIBUIBLE',
                distribuciones: nivelGasto === 'DISTRIBUIBLE'
                    ? distRows.map(r => ({ plantillaId: r.plantillaId, porcentaje: Number(r.porcentaje), metodoAsignacion: 'MANUAL' }))
                    : [],
            };
            if (tipoGasto === 'INSUMO') {
                if (!productoSel) { setErr('Selecciona un producto'); setSaving(false); return; }
                if (!cantidadIn || Number(cantidadIn) <= 0) { setErr('Cantidad inválida'); setSaving(false); return; }
                if (Number(cantidadIn) > productoSel.stockActual) { setErr(`Stock insuficiente (disp: ${productoSel.stockActual})`); setSaving(false); return; }
                await fetchApi('/gastos-operativos', { method: 'POST', body: JSON.stringify({ ...base, tipoGasto: 'INSUMO', productoId: productoSel.id, almacenId: almacenId || null, cantidad: Number(cantidadIn), moneda: productoSel.moneda }) });
            } else {
                if (!extForm.producto.trim()) { setErr('El concepto es requerido'); setSaving(false); return; }
                if (!extForm.precioUnitario)  { setErr('El precio es requerido'); setSaving(false); return; }
                if (!extForm.cantidad || Number(extForm.cantidad) <= 0) { setErr('La cantidad debe ser > 0'); setSaving(false); return; }
                await fetchApi('/gastos-operativos', { method: 'POST', body: JSON.stringify({ ...base, tipoGasto: 'EXTERNO', categoria: extForm.categoria, producto: extForm.producto, unidad: extForm.unidad, cantidad: Number(extForm.cantidad), precioUnitario: Number(extForm.precioUnitario), moneda: extForm.moneda, tipoCambio: extForm.tipoCambio ? Number(extForm.tipoCambio) : null, notas: extForm.notas || null }) });
            }
            onSaved();
        } catch (e: any) { setErr(e.message || 'Error al guardar'); } finally { setSaving(false); }
    };

    const sel = (nivel: NivelGasto) => nivelGasto === nivel ? NIVEL_INFO[nivel].sel + ' border-2' : 'border-gray-200 hover:border-gray-300';

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[94vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-5 pb-4 rounded-t-2xl flex items-start justify-between z-10">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Nuevo Gasto Operativo</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{nivelGasto ? NIVEL_INFO[nivelGasto].label : 'Selecciona el nivel del gasto'}</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={18}/></button>
                </div>
                <div className="px-6 py-5 space-y-6">

                    {/* PASO 1: Nivel */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">1 · Nivel del gasto <span className="text-red-500">*</span></p>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(NIVEL_INFO) as [NivelGasto, typeof NIVEL_INFO[NivelGasto]][]).map(([key, def]) => (
                                <button key={key} onClick={() => setNivelGasto(key)} className={`flex items-start gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${sel(key)}`}>
                                    {def.icon}
                                    <div>
                                        <p className="text-sm font-semibold text-gray-700 leading-tight">{def.label}</p>
                                        <p className="text-xs text-gray-400 mt-0.5 leading-tight">{def.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {nivelGasto && (<>
                        <div className="border-t border-gray-100"/>
                        {/* PASO 2: Tipo */}
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">2 · Tipo de gasto <span className="text-red-500">*</span></p>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => { setTipoGasto('INSUMO'); setProductoSel(null); setBusqueda(''); }}
                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${tipoGasto === 'INSUMO' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <Package size={18} className={tipoGasto === 'INSUMO' ? 'text-purple-600' : 'text-gray-400'}/>
                                    <span className={`text-sm font-semibold ${tipoGasto === 'INSUMO' ? 'text-purple-700' : 'text-gray-600'}`}>Insumo del almacén</span>
                                    <span className="text-xs text-gray-400 text-center leading-tight">Descuenta stock</span>
                                </button>
                                <button onClick={() => { setTipoGasto('EXTERNO'); setProductoSel(null); }}
                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${tipoGasto === 'EXTERNO' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <ShoppingCart size={18} className={tipoGasto === 'EXTERNO' ? 'text-blue-600' : 'text-gray-400'}/>
                                    <span className={`text-sm font-semibold ${tipoGasto === 'EXTERNO' ? 'text-blue-700' : 'text-gray-600'}`}>Gasto externo</span>
                                    <span className="text-xs text-gray-400 text-center leading-tight">Compra directa / servicio</span>
                                </button>
                            </div>
                        </div>

                        {tipoGasto && (<>
                            <div className="border-t border-gray-100"/>
                            {/* PASO 3: Contexto */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">3 · Contexto</p>
                                {/* Obra */}
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Obra <span className="text-red-500">*</span></label>
                                    <select value={obraId} onChange={e => setObraId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                        <option value="">— Selecciona una obra —</option>
                                        {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                    </select>
                                </div>
                                {/* Equipo — obligatorio POR_EQUIPO, opcional resto (excepto POR_PLANTILLA que lo muestra debajo) */}
                                {nivelGasto !== 'POR_PLANTILLA' && (
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Equipo {nivelGasto === 'POR_EQUIPO' ? <span className="text-red-500">*</span> : <span className="text-gray-400">(opcional)</span>}
                                        </label>
                                        <select value={equipoId} onChange={e => setEquipoId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                            <option value="">— Sin equipo específico —</option>
                                            {equiposFilt.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}{eq.numeroEconomico ? ` (${eq.numeroEconomico})` : ''}</option>)}
                                        </select>
                                    </div>
                                )}
                                {/* Plantilla POR_PLANTILLA */}
                                {nivelGasto === 'POR_PLANTILLA' && obraId && (
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Plantilla <span className="text-red-500">*</span></label>
                                        {loadingPlantillas ? <p className="text-xs text-gray-400 py-1">Cargando...</p>
                                        : plantillas.length === 0 ? <p className="text-xs text-amber-600 italic py-1">Esta obra no tiene plantillas.</p>
                                        : <div className="space-y-1">
                                            {plantillas.map(p => {
                                                const ini = p.fechaInicio ? fmtD(String(p.fechaInicio).slice(0,10)) : null;
                                                const fin = p.fechaFin    ? fmtD(String(p.fechaFin).slice(0,10))    : null;
                                                return (
                                                    <label key={p.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${plantillaId===p.id ? 'bg-purple-50 border-purple-300' : 'border-gray-100 hover:border-gray-200'}`}>
                                                        <input type="radio" name="plt" checked={plantillaId===p.id} onChange={() => setPlantillaId(p.id)} className="accent-purple-600 flex-shrink-0"/>
                                                        <span className="text-sm font-semibold text-gray-700 flex-1">Plantilla {p.numero}</span>
                                                        {ini && fin && <span className="text-xs text-gray-400">{ini}–{fin}</span>}
                                                    </label>
                                                );
                                            })}
                                        </div>}
                                        {plantillaId && (
                                            <div className="mt-2">
                                                <label className="block text-xs text-gray-400 mb-1">Equipo (opcional)</label>
                                                <select value={equipoId} onChange={e => setEquipoId(e.target.value)} className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none">
                                                    <option value="">— Sin equipo —</option>
                                                    {equiposFilt.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}{eq.numeroEconomico ? ` (${eq.numeroEconomico})` : ''}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Fechas */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
                                        <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Fecha fin <span className="text-gray-400">(opcional)</span></label>
                                        <input type="date" value={fechaFin} min={fechaInicio} onChange={e => setFechaFin(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-100"/>

                            {/* PASO 4A: INSUMO */}
                            {tipoGasto === 'INSUMO' && (
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">4 · Insumo del catálogo</p>
                                    <input type="text" placeholder="Buscar por nombre o SKU..." value={busqueda} onChange={e => { setBusqueda(e.target.value); setProductoSel(null); }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"/>
                                    {productoSel ? (
                                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-purple-800">{productoSel.nombre}</p>
                                                <p className="text-xs text-purple-600 mt-0.5">
                                                    Stock: <strong>{productoSel.stockActual} {productoSel.unidad}</strong>
                                                    {productoSel.stockBajo && <span className="ml-2 inline-flex items-center gap-1 text-amber-600"><AlertTriangle size={11}/> Stock bajo</span>}
                                                    &nbsp;· ${productoSel.precioCompra.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {productoSel.moneda}
                                                </p>
                                            </div>
                                            <button onClick={() => setProductoSel(null)} className="text-purple-400 hover:text-purple-700"><X size={14}/></button>
                                        </div>
                                    ) : loadCat ? <p className="text-xs text-gray-400">Cargando catálogo...</p>
                                    : <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                                        {catFiltrado.slice(0, 30).map(p => (
                                            <button key={p.id} onClick={() => { setProductoSel(p); setBusqueda(p.nombre); }} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-purple-50 transition-colors text-left">
                                                <div><p className="text-sm text-gray-800">{p.nombre}</p><p className="text-xs text-gray-400">{p.sku} · {p.unidad}</p></div>
                                                <p className={`text-xs font-medium ml-2 flex-shrink-0 ${p.stockBajo ? 'text-amber-600' : 'text-gray-500'}`}>{p.stockActual} {p.unidad}</p>
                                            </button>
                                        ))}
                                        {catFiltrado.length === 0 && <p className="text-xs text-gray-400 italic p-3">No se encontraron productos.</p>}
                                    </div>}
                                    {productoSel && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Cantidad <span className="text-red-500">*</span> <span className="text-gray-400">(máx. {productoSel.stockActual})</span></label>
                                                <input type="number" min="0.01" step="0.01" max={productoSel.stockActual} value={cantidadIn} onChange={e => setCantidadIn(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"/>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Almacén</label>
                                                <select value={almacenId} onChange={e => setAlmacenId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20">
                                                    {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PASO 4B: EXTERNO */}
                            {tipoGasto === 'EXTERNO' && (
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">4 · Detalle del gasto</p>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                                        <select value={extForm.categoria} onChange={e => setExt('categoria', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                            {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Concepto / Producto <span className="text-red-500">*</span></label>
                                        <input type="text" value={extForm.producto} onChange={e => setExt('producto', e.target.value)} placeholder="Ej: Aceite motor SAE 15W40, Gasolina, Refacción..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Cantidad <span className="text-red-500">*</span></label>
                                            <input type="number" min="0" step="0.01" value={extForm.cantidad} onChange={e => setExt('cantidad', e.target.value)} placeholder="1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Unidad</label>
                                            <select value={extForm.unidad} onChange={e => setExt('unidad', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                                {['pza','lt','kg','caja','día','hr','servicio','mts'].map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Precio unit. <span className="text-red-500">*</span></label>
                                            <input type="number" min="0" step="0.01" value={extForm.precioUnitario} onChange={e => setExt('precioUnitario', e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Moneda</label>
                                            <select value={extForm.moneda} onChange={e => setExt('moneda', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                                <option value="MXN">MXN</option><option value="USD">USD</option>
                                            </select>
                                        </div>
                                        {extForm.moneda === 'USD' && (
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Tipo de cambio</label>
                                                <input type="number" min="0" step="0.01" value={extForm.tipoCambio} onChange={e => setExt('tipoCambio', e.target.value)} placeholder="17.50" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Notas</label>
                                        <input type="text" value={extForm.notas} onChange={e => setExt('notas', e.target.value)} placeholder="Opcional" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                    </div>
                                </div>
                            )}

                            {/* Total preview */}
                            {totalAct !== null && (
                                <div className={`rounded-xl px-4 py-3 flex justify-between items-center ${tipoGasto==='INSUMO' ? 'bg-purple-50' : 'bg-blue-50'}`}>
                                    <span className={`text-xs font-medium ${tipoGasto==='INSUMO' ? 'text-purple-600' : 'text-blue-600'}`}>Total</span>
                                    <span className={`text-sm font-bold ${tipoGasto==='INSUMO' ? 'text-purple-700' : 'text-blue-700'}`}>
                                        ${totalAct.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {tipoGasto==='INSUMO' ? productoSel?.moneda : extForm.moneda}
                                    </span>
                                </div>
                            )}

                            {/* PASO 5: Distribución */}
                            {nivelGasto === 'DISTRIBUIBLE' && obraId && (
                                <div className="space-y-3">
                                    <div className="border-t border-gray-100"/>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">5 · Distribución entre plantillas</p>
                                        <button onClick={distribuirEq} className="text-xs text-emerald-600 hover:text-emerald-800 underline">Distribuir equitativo</button>
                                    </div>
                                    {loadingPlantillas ? <p className="text-xs text-gray-400">Cargando plantillas...</p>
                                    : plantillas.length === 0 ? <p className="text-xs text-amber-600 italic">Esta obra no tiene plantillas para distribuir.</p>
                                    : <div className="space-y-2">
                                        {distRows.map((row, i) => (
                                            <div key={i} className="flex gap-2 items-center">
                                                <select value={row.plantillaId} onChange={e => setRow(i, 'plantillaId', e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                    <option value="">— Plantilla —</option>
                                                    {plantillas.map(p => <option key={p.id} value={p.id}>Plt. {p.numero}</option>)}
                                                </select>
                                                <div className="relative w-24">
                                                    <input type="number" min="0" max="100" step="0.01" value={row.porcentaje} onChange={e => setRow(i, 'porcentaje', e.target.value)} placeholder="0" className="w-full pr-6 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"/>
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                                                </div>
                                                {distRows.length > 1 && <button onClick={() => rmRow(i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><X size={14}/></button>}
                                            </div>
                                        ))}
                                        <div className={`flex justify-between items-center px-3 py-2 rounded-lg text-xs font-medium ${Math.abs(sumaPct-100)<0.01 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                            <span>Suma de %</span>
                                            <span className="font-bold">{sumaPct.toFixed(2)}% {Math.abs(sumaPct-100)<0.01 ? '✓' : '(debe ser 100%)'}</span>
                                        </div>
                                        {totalAct && distRows.some(r => r.plantillaId && r.porcentaje) && (
                                            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                                                <p className="text-xs text-gray-400 mb-1.5">Monto asignado por plantilla:</p>
                                                {distRows.map((r, i) => {
                                                    const plt = plantillas.find(p => p.id === r.plantillaId);
                                                    const monto = totalAct * (Number(r.porcentaje)||0) / 100;
                                                    if (!plt || !r.porcentaje) return null;
                                                    return <div key={i} className="flex justify-between text-xs text-gray-600"><span>Plt. {plt.numero}</span><span className="font-medium">${monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>;
                                                })}
                                            </div>
                                        )}
                                        <button onClick={addRow} className="w-full py-1.5 border border-dashed border-emerald-300 rounded-lg text-xs text-emerald-600 hover:bg-emerald-50 transition-colors">+ Agregar plantilla</button>
                                    </div>}
                                </div>
                            )}
                        </>)}
                    </>)}
                </div>
                {err && <p className="text-xs text-red-500 px-6 pb-3 flex items-center gap-1"><AlertTriangle size={12}/> {err}</p>}
                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleSave} disabled={saving || !tipoGasto || !nivelGasto || (nivelGasto==='DISTRIBUIBLE' && !distOk)} className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-40 transition-colors">
                        {saving ? 'Guardando...' : 'Registrar gasto'}
                    </button>
                </div>
            </div>
        </div>
    );
}


// ─── Modal Confirmar Eliminación ──────────────────────────────────────────────
function DeleteConfirmModal({ gasto, onConfirm, onCancel, loading }: {
    gasto: Gasto; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={18} className="text-red-600"/>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-800">Eliminar gasto</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Esta acción no se puede deshacer</p>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 space-y-1 border border-gray-100">
                    <p className="text-sm font-semibold text-gray-800 truncate">{gasto.producto}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORIAS[gasto.categoria]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                            {CATEGORIAS[gasto.categoria]?.label ?? gasto.categoria}
                        </span>
                        <span className="text-xs text-gray-500">{gasto.cantidad} {gasto.unidad}</span>
                        <span className="text-xs font-semibold text-gray-700">
                            ${Number(gasto.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {gasto.moneda}
                        </span>
                    </div>
                    {gasto.obra && <p className="text-xs text-gray-400">{gasto.obra.nombre}{gasto.plantilla ? ` · Plt. ${gasto.plantilla.numero}` : ''}</p>}
                </div>

                {gasto.tipoGasto === 'INSUMO' && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                        <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0"/>
                        <p className="text-xs text-amber-700">
                            Este es un <strong>insumo del almacén</strong>. Al eliminar, se restaurarán <strong>{gasto.cantidad} {gasto.unidad}</strong> al stock de <em>{gasto.producto}</em>.
                        </p>
                    </div>
                )}

                <div className="flex gap-2">
                    <button onClick={onCancel} disabled={loading}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex-1 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors">
                        {loading ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal Editar Gasto ────────────────────────────────────────────────────────
function EditGastoModal({ gasto, onClose, onSaved }: { gasto: Gasto; onClose: () => void; onSaved: (g: Gasto) => void }) {
    const [form, setForm] = useState({
        categoria:      gasto.categoria,
        producto:       gasto.producto,
        unidad:         gasto.unidad,
        cantidad:       String(gasto.cantidad),
        precioUnitario: String(gasto.precioUnitario),
        moneda:         gasto.moneda,
        tipoCambio:     gasto.tipoCambio != null ? String(gasto.tipoCambio) : '',
        notas:          gasto.notas ?? '',
    });
    const [saving,  setSaving]  = useState(false);
    const [success, setSuccess] = useState(false);
    const [error,   setError]   = useState('');

    const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    const total = (Number(form.cantidad) || 0) * (Number(form.precioUnitario) || 0);

    const handleSave = async () => {
        if (!form.cantidad || !form.precioUnitario) { setError('Cantidad y precio son requeridos'); return; }
        setSaving(true); setError('');
        try {
            const updated = await fetchApi(`/gastos-operativos/${gasto.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    categoria:      form.categoria,
                    unidad:         form.unidad,
                    cantidad:       Number(form.cantidad),
                    precioUnitario: Number(form.precioUnitario),
                    moneda:         form.moneda,
                    tipoCambio:     form.tipoCambio ? Number(form.tipoCambio) : null,
                    notas:          form.notas || null,
                }),
            });
            setSuccess(true);
            setTimeout(() => { onSaved(updated); }, 800);
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-gray-800">Editar gasto</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {gasto.tipoGasto === 'INSUMO'
                                ? 'Solo se pueden editar cantidad, precio y notas (el insumo no cambia)'
                                : 'Modifica los datos del gasto externo'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        <X size={15}/>
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4 space-y-4">
                    {success ? (
                        <div className="flex flex-col items-center py-8 gap-2">
                            <CheckCircle size={32} className="text-green-500"/>
                            <p className="text-sm font-semibold text-gray-700">Gasto actualizado</p>
                        </div>
                    ) : (
                        <>
                            {/* Concepto — solo lectura si es insumo */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Concepto</label>
                                <p className="text-sm font-semibold text-gray-800 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                    {gasto.producto}
                                    {gasto.tipoGasto === 'INSUMO' && <span className="ml-2 text-xs text-purple-500 font-normal">Insumo almacén</span>}
                                </p>
                            </div>

                            {/* Categoría */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
                                <select value={form.categoria} onChange={setF('categoria')}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                    {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                            </div>

                            {/* Cantidad + Unidad */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
                                    <input type="number" min="0.001" step="any" value={form.cantidad} onChange={setF('cantidad')}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Unidad</label>
                                    <input type="text" value={form.unidad} onChange={setF('unidad')}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                </div>
                            </div>

                            {/* Precio + Moneda */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Precio unitario</label>
                                    <input type="number" min="0" step="any" value={form.precioUnitario} onChange={setF('precioUnitario')}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Moneda</label>
                                    <select value={form.moneda} onChange={setF('moneda')}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                        <option value="MXN">MXN</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>
                            </div>

                            {/* T.C. si es USD */}
                            {form.moneda === 'USD' && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de cambio</label>
                                    <input type="number" min="0" step="0.01" value={form.tipoCambio} onChange={setF('tipoCambio')}
                                        placeholder="ej. 17.50"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                </div>
                            )}

                            {/* Notas */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
                                <textarea value={form.notas} onChange={setF('notas')} rows={2} placeholder="Opcional"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                            </div>

                            {/* Total preview */}
                            {total > 0 && (
                                <div className="flex justify-between items-center bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                                    <span className="text-xs text-blue-600 font-medium">Total estimado</span>
                                    <span className="text-sm font-bold text-blue-700">
                                        {form.moneda === 'USD' ? 'US$' : '$'}{total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}

                            {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={11}/> {error}</p>}
                        </>
                    )}
                </div>

                {/* Footer */}
                {!success && (
                    <div className="px-6 pb-5 flex gap-2">
                        <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
                        <button onClick={handleSave} disabled={saving}
                            className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors">
                            {saving ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function GastosOperativosInner() {
    const searchParams  = useSearchParams();
    const equipoIdParam = searchParams.get('equipoId') || '';
    const [gastos,       setGastos]       = useState<Gasto[]>([]);
    const [equipos,      setEquipos]      = useState<Equipo[]>([]);
    const [obras,        setObras]        = useState<Obra[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState('');
    const [modal,        setModal]        = useState(false);
    const [gastoEditar,  setGastoEditar]  = useState<Gasto | null>(null);
    const [gastoAEliminar, setGastoAEliminar] = useState<Gasto | null>(null);
    const [deletingId,     setDeletingId]     = useState(false);
    const [filtroEquipo, setFiltroEquipo] = useState(equipoIdParam);
    const [filtroCateg,  setFiltroCateg]  = useState('');
    const [filtroTipo,   setFiltroTipo]   = useState('');
    const [filtroNivel,  setFiltroNivel]  = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams();
            if (filtroEquipo) p.set('equipoId',   filtroEquipo);
            if (filtroCateg)  p.set('categoria',  filtroCateg);
            if (filtroTipo)   p.set('tipoGasto',  filtroTipo);
            if (filtroNivel)  p.set('nivelGasto', filtroNivel);
            const [gs, eqs, obs] = await Promise.all([fetchApi(`/gastos-operativos${p.toString() ? '?' + p : ''}`), fetchApi('/equipos'), fetchApi('/obras')]);
            setGastos(gs); setEquipos(eqs); setObras(obs);
        } catch (e: any) { setError(e.message || 'Error al cargar gastos'); } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [filtroEquipo, filtroCateg, filtroTipo, filtroNivel]);

    const handleDelete = (id: string) => {
        const g = gastos.find(x => x.id === id);
        if (g) setGastoAEliminar(g);
    };
    const confirmarDelete = async () => {
        if (!gastoAEliminar) return;
        setDeletingId(true);
        try {
            await fetchApi(`/gastos-operativos/${gastoAEliminar.id}`, { method: 'DELETE' });
            setGastos(g => g.filter(x => x.id !== gastoAEliminar.id));
            setGastoAEliminar(null);
        } catch (e: any) { alert(e.message || 'Error al eliminar'); }
        finally { setDeletingId(false); }
    };

    const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalMXN = gastos.filter(g => g.moneda === 'MXN').reduce((a, g) => a + g.total, 0);
    const totalUSD = gastos.filter(g => g.moneda === 'USD').reduce((a, g) => a + g.total, 0);
    const totalInsumos  = gastos.filter(g => g.tipoGasto === 'INSUMO'  && g.moneda === 'MXN').reduce((a, g) => a + g.total, 0);
    const totalExternos = gastos.filter(g => g.tipoGasto === 'EXTERNO' && g.moneda === 'MXN').reduce((a, g) => a + g.total, 0);
    const totalDist     = gastos.filter(g => g.distribuible && g.moneda === 'MXN').reduce((a, g) => a + g.total, 0);

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Gastos Operativos</h1>
                    <p className="text-sm text-gray-500 mt-1">Gastos generales de obra por nivel: general, equipo, plantilla o distribuible.</p>
                </div>
                <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                    <Plus size={16}/> Nuevo gasto
                </button>
            </div>
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}
            {!loading && gastos.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Total MXN</p><p className="text-2xl font-bold text-gray-800">${fmt(totalMXN)}</p></div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Insumos almacén</p><p className="text-xl font-bold text-purple-700">${fmt(totalInsumos)}</p></div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Gastos externos</p><p className="text-xl font-bold text-blue-700">${fmt(totalExternos)}</p></div>
                    {totalUSD > 0
                        ? <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Total USD</p><p className="text-xl font-bold text-green-700">${fmt(totalUSD)}</p></div>
                        : <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Con distribución</p><p className="text-xl font-bold text-emerald-700">${fmt(totalDist)}</p></div>}
                </div>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-amber-700"><strong>Gastos directos</strong> (diésel, operadores, peones, renta de equipo) ya están en <strong>Registros Diarios</strong> — no duplicar aquí.</p>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
                <Filter size={14} className="text-gray-400 flex-shrink-0"/>
                <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)} className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Todos los niveles</option>
                    <option value="GENERAL">General de obra</option>
                    <option value="POR_EQUIPO">Por equipo</option>
                    <option value="POR_PLANTILLA">Por plantilla</option>
                    <option value="DISTRIBUIBLE">Distribuible</option>
                </select>
                <select value={filtroEquipo} onChange={e => setFiltroEquipo(e.target.value)} className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Todos los equipos</option>
                    {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
                </select>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Todos los tipos</option>
                    <option value="INSUMO">Insumo del almacén</option>
                    <option value="EXTERNO">Gasto externo</option>
                </select>
                <select value={filtroCateg} onChange={e => setFiltroCateg(e.target.value)} className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Todas las categorías</option>
                    {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {(filtroEquipo || filtroCateg || filtroTipo || filtroNivel) && (
                    <button onClick={() => { setFiltroEquipo(''); setFiltroCateg(''); setFiltroTipo(''); setFiltroNivel(''); }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"><X size={13}/> Limpiar</button>
                )}
            </div>
            <Card>
                {loading ? <div className="p-10 text-center text-gray-400 text-sm">Cargando gastos...</div>
                : gastos.length === 0 ? (
                    <div className="p-10 text-center">
                        <Receipt size={36} className="text-gray-300 mx-auto mb-3"/>
                        <p className="text-sm font-semibold text-gray-600">No hay gastos registrados</p>
                        <p className="text-xs text-gray-400 mt-1">Registra el primer gasto operativo con el botón de arriba.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    {['Fecha','Nivel / Tipo','Equipo','Categoría','Concepto','Cant.','P. Unit.','Total','Obra / Plt.','Acciones'].map((h, i) => (
                                        <th key={h} className={`p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${i >= 5 && i <= 7 ? 'text-right' : ''} ${i === 9 ? 'text-right' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {gastos.map(g => <GastoRow key={g.id} g={g} fmt={fmt} onDelete={handleDelete} onEdit={setGastoEditar}/>)}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
            {modal && <GastoModal equipos={equipos} obras={obras} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }}/>}
            {gastoAEliminar && (
                <DeleteConfirmModal
                    gasto={gastoAEliminar}
                    loading={deletingId}
                    onConfirm={confirmarDelete}
                    onCancel={() => setGastoAEliminar(null)}
                />
            )}
            {gastoEditar && (
                <EditGastoModal
                    gasto={gastoEditar}
                    onClose={() => setGastoEditar(null)}
                    onSaved={(updated) => {
                        setGastos(gs => gs.map(g => g.id === updated.id ? { ...g, ...updated } : g));
                        setGastoEditar(null);
                    }}
                />
            )}
        </div>
    );
}

export default function GastosOperativosPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>}>
            <GastosOperativosInner/>
        </Suspense>
    );
}
