"use client";

import { useEffect, useState, useMemo } from 'react';
import {
    Search, Plus, Users, MapPin, Mail, Phone,
    Edit2, Trash2, X, Save, Package, TrendingUp,
    ShoppingBag, DollarSign, Calendar, AlertTriangle,
    User, ChevronUp, ChevronDown, ChevronsUpDown, Download
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import FiscalFields, { FiscalData, EMPTY_FISCAL } from '@/components/ui/FiscalFields';

interface Cliente {
    id: string; nombre: string; contacto?: string; telefono?: string;
    email?: string; direccion?: string; createdAt: string;
    rfc?: string; razonSocial?: string; codigoPostal?: string;
    regimenFiscal?: string; usoCFDI?: string;
    totalVentas: number; ultimaVenta: string | null; montoTotal: number;
}
interface Stats { totalVentas: number; montoTotal: number; ultimaVenta: string | null; totalProductos: number; }
interface Movimiento {
    id: string; fecha: string; cantidad: number; precioVenta: number; costoUnitario: number; referencia?: string;
    producto: { nombre: string; sku: string; unidad: string };
    almacen: { nombre: string }; usuario: { nombre: string };
}

type FormData = { nombre: string; contacto: string; telefono: string; email: string; direccion: string } & FiscalData;
const EMPTY_FORM: FormData = { nombre: '', contacto: '', telefono: '', email: '', direccion: '', ...EMPTY_FISCAL };
const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'];
const colorFor = (n: string) => COLORS[n.charCodeAt(0) % COLORS.length];
type SortKey = 'nombre' | 'montoTotal' | 'totalVentas' | 'ultimaVenta';
type SortDir = 'asc' | 'desc';
type ActivityFilter = 'all' | 'active' | 'inactive';

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
    if (col !== sortKey) return <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-blue-500 ml-1 inline" /> : <ChevronDown size={12} className="text-blue-500 ml-1 inline" />;
}

function ClienteModal({ initial, onSave, onClose, saving, error }: {
    initial?: Cliente | null; onSave: (d: FormData) => void;
    onClose: () => void; saving: boolean; error: string;
}) {
    const [form, setForm] = useState<FormData>(initial ? {
        nombre: initial.nombre, contacto: initial.contacto||'', telefono: initial.telefono||'',
        email: initial.email||'', direccion: initial.direccion||'',
        rfc: initial.rfc||'', razonSocial: initial.razonSocial||'',
        codigoPostal: initial.codigoPostal||'', regimenFiscal: initial.regimenFiscal||'', usoCFDI: initial.usoCFDI||'',
    } : { ...EMPTY_FORM });

    const h = (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    const setFiscal = (field: keyof FiscalData, value: string) => setForm(p => ({ ...p, [field]: value }));

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-50 p-2 rounded-lg"><Users size={18} className="text-green-600" /></div>
                        <h2 className="text-lg font-bold text-gray-900">{initial ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">{error}</div>}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Nombre del cliente *</label>
                            <input name="nombre" value={form.nombre} onChange={h} required placeholder="Ej: Juan Pérez o Empresa ABC"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"/>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Contacto</label>
                            <input name="contacto" value={form.contacto} onChange={h} placeholder="Persona de contacto"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"/>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Teléfono</label>
                            <input name="telefono" value={form.telefono} onChange={h} placeholder="+52 55 1234 5678"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"/>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Email</label>
                            <input name="email" type="email" value={form.email} onChange={h} placeholder="cliente@empresa.com"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"/>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Dirección</label>
                            <input name="direccion" value={form.direccion} onChange={h} placeholder="Av. Principal 123"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"/>
                        </div>
                    </div>
                    <FiscalFields data={{ rfc: form.rfc, razonSocial: form.razonSocial, codigoPostal: form.codigoPostal, regimenFiscal: form.regimenFiscal, usoCFDI: form.usoCFDI }} onChange={setFiscal} collapsed={true}/>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={() => onSave(form)} disabled={saving || !form.nombre}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-60">
                        <Save size={14}/>{saving ? 'Guardando...' : (initial ? 'Guardar cambios' : 'Crear cliente')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function DeleteConfirmModal({ nombre, onConfirm, onClose, deleting, error }: {
    nombre: string; onConfirm: () => void; onClose: () => void; deleting: boolean; error: string;
}) {
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-50 p-2 rounded-lg"><AlertTriangle size={20} className="text-red-500"/></div>
                    <h2 className="text-lg font-bold text-gray-900">Eliminar cliente</h2>
                </div>
                <p className="text-sm text-gray-600 mb-2">¿Estás seguro de eliminar a <strong>{nombre}</strong>?</p>
                <p className="text-xs text-gray-400 mb-4">Si tiene ventas asociadas, no podrá eliminarse.</p>
                {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 mb-4">{error}</div>}
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={onConfirm} disabled={deleting} className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg disabled:opacity-60">
                        {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ClientesPage() {
    const [clientes, setClientes]       = useState<Cliente[]>([]);
    const [loading, setLoading]         = useState(true);
    const [search, setSearch]           = useState('');
    const [activity, setActivity]       = useState<ActivityFilter>('all');
    const [sortKey, setSortKey]         = useState<SortKey>('nombre');
    const [sortDir, setSortDir]         = useState<SortDir>('asc');
    const [selected, setSelected]       = useState<Cliente | null>(null);
    const [stats, setStats]             = useState<Stats | null>(null);
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [loadingStats, setLoadingStats] = useState(false);

    // Filtros del historial de ventas
    const [histPeriod, setHistPeriod] = useState<'7d'|'30d'|'90d'|'1y'|'all'>('all');
    const [histDesde, setHistDesde]   = useState('');
    const [histHasta, setHistHasta]   = useState('');

    const [modalOpen, setModalOpen]     = useState(false);
    const [editTarget, setEditTarget]   = useState<Cliente | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
    const [saving, setSaving]           = useState(false);
    const [deleting, setDeleting]       = useState(false);
    const [modalError, setModalError]   = useState('');
    const [deleteError, setDeleteError] = useState('');

    const load = async () => {
        setLoading(true);
        try { setClientes(await fetchApi('/clients')); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    useEffect(() => {
        if (!selected) { setStats(null); setMovimientos([]); return; }
        setLoadingStats(true);
        setHistPeriod('all'); setHistDesde(''); setHistHasta('');
        fetchApi(`/clients/${selected.id}/stats`)
            .then(data => { setStats(data.stats); setMovimientos(data.movimientos); })
            .catch(() => {}).finally(() => setLoadingStats(false));
    }, [selected]);

    const ingresoTotal  = clientes.reduce((a, c) => a + c.montoTotal, 0);
    const conVentas     = clientes.filter(c => c.totalVentas > 0).length;
    const sinVentas     = clientes.filter(c => c.totalVentas === 0).length;

    const sorted = useMemo(() => {
        let list = clientes.filter(c => {
            const q = search.toLowerCase();
            const matchSearch = c.nombre.toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q) || (c.rfc||'').toLowerCase().includes(q);
            const matchActivity = activity === 'all' ? true : activity === 'active' ? c.totalVentas > 0 : c.totalVentas === 0;
            return matchSearch && matchActivity;
        });
        return [...list].sort((a, b) => {
            let va: string|number='', vb: string|number='';
            if (sortKey === 'nombre')     { va=a.nombre.toLowerCase(); vb=b.nombre.toLowerCase(); }
            if (sortKey === 'montoTotal') { va=a.montoTotal; vb=b.montoTotal; }
            if (sortKey === 'totalVentas'){ va=a.totalVentas; vb=b.totalVentas; }
            if (sortKey === 'ultimaVenta'){ va=a.ultimaVenta||''; vb=b.ultimaVenta||''; }
            if (va < vb) return sortDir==='asc'?-1:1;
            if (va > vb) return sortDir==='asc'?1:-1;
            return 0;
        });
    }, [clientes, search, activity, sortKey, sortDir]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d==='asc'?'desc':'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };
    const thClass = (key: SortKey) =>
        `px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-green-600 transition-colors ${sortKey===key?'text-green-600':'text-gray-400'}`;

    const exportCSV = () => {
        const headers = ['Nombre','Contacto','Teléfono','Email','Dirección','RFC','Razón Social','CP','Régimen Fiscal','Uso CFDI','Total Ventas','Monto Total','Última Venta'];
        const rows = sorted.map(c => [
            c.nombre, c.contacto||'', c.telefono||'', c.email||'', c.direccion||'',
            c.rfc||'', c.razonSocial||'', c.codigoPostal||'', c.regimenFiscal||'', c.usoCFDI||'',
            c.totalVentas, c.montoTotal.toFixed(2),
            c.ultimaVenta ? new Date(c.ultimaVenta).toLocaleDateString('es-MX') : '',
        ]);
        const csv = [headers,...rows].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url; a.download='clientes.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const openCreate = () => { setEditTarget(null); setModalError(''); setModalOpen(true); };
    const openEdit   = (c: Cliente, e: React.MouseEvent) => { e.stopPropagation(); setEditTarget(c); setModalError(''); setModalOpen(true); };
    const openDelete = (c: Cliente, e: React.MouseEvent) => { e.stopPropagation(); setDeleteTarget(c); setDeleteError(''); };

    const handleSave = async (form: FormData) => {
        setSaving(true); setModalError('');
        try {
            if (editTarget) {
                const updated = await fetchApi(`/clients/${editTarget.id}`, { method:'PUT', body:JSON.stringify(form) });
                setClientes(cs => cs.map(c => c.id===updated.id ? { ...c,...updated } : c));
                if (selected?.id===updated.id) setSelected(s => s ? { ...s,...updated } : s);
            } else {
                const created = await fetchApi('/clients', { method:'POST', body:JSON.stringify(form) });
                setClientes(cs => [...cs, created]);
            }
            setModalOpen(false);
        } catch (e: any) { setModalError(e.message||'Error al guardar'); }
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true); setDeleteError('');
        try {
            await fetchApi(`/clients/${deleteTarget.id}`, { method:'DELETE' });
            setClientes(cs => cs.filter(c => c.id!==deleteTarget.id));
            if (selected?.id===deleteTarget.id) setSelected(null);
            setDeleteTarget(null);
        } catch (e: any) { setDeleteError(e.message||'Error al eliminar'); }
        finally { setDeleting(false); }
    };

    const toDate = (d: Date) => d.toISOString().split('T')[0];
    const applyHistPeriod = (p: typeof histPeriod) => {
        setHistPeriod(p);
        const now = new Date();
        if (p==='7d')  { setHistDesde(toDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()-7)));   setHistHasta(toDate(now)); }
        else if (p==='30d') { setHistDesde(toDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()-30)));  setHistHasta(toDate(now)); }
        else if (p==='90d') { setHistDesde(toDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()-90)));  setHistHasta(toDate(now)); }
        else if (p==='1y')  { setHistDesde(toDate(new Date(now.getFullYear()-1, now.getMonth(), now.getDate()))); setHistHasta(toDate(now)); }
        else {
            if (movimientos.length > 0) {
                const fechas = movimientos.map(m => new Date(m.fecha).getTime());
                setHistDesde(toDate(new Date(Math.min(...fechas))));
            }
            setHistHasta(toDate(now));
        }
    };

    const histDesdeEfectivo = histPeriod === 'all' && movimientos.length > 0 && !histDesde
        ? toDate(new Date(Math.min(...movimientos.map(m => new Date(m.fecha).getTime()))))
        : histDesde;
    const histHastaEfectivo = histPeriod === 'all' && !histHasta
        ? toDate(new Date())
        : histHasta;

    const filteredMovimientos = movimientos.filter(m => {
        if (!histDesdeEfectivo && !histHastaEfectivo) return true;
        const f = new Date(m.fecha);
        if (histDesdeEfectivo && f < new Date(histDesdeEfectivo + 'T00:00:00Z')) return false;
        if (histHastaEfectivo && f > new Date(histHastaEfectivo + 'T23:59:59Z')) return false;
        return true;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
                    <p className="text-sm text-gray-500 mt-1">Gestión de clientes y datos fiscales para facturación.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                        <Download size={15}/> Exportar CSV
                    </button>
                    <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                        <Plus size={16}/> Nuevo Cliente
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon:<Users size={15} className="text-green-400"/>, label:'Total clientes', value:clientes.length, sub:'registrados' },
                    { icon:<DollarSign size={15} className="text-blue-400"/>, label:'Ingresos totales', value:`$${ingresoTotal.toLocaleString('es-MX',{maximumFractionDigits:0})}`, sub:'en todas las ventas' },
                    { icon:<TrendingUp size={15} className="text-purple-400"/>, label:'Con ventas', value:conVentas, sub:`${sinVentas} sin actividad` },
                    { icon:<ShoppingBag size={15} className="text-amber-400"/>, label:'Total movimientos', value:clientes.reduce((a,c)=>a+c.totalVentas,0), sub:'salidas registradas' },
                ].map(({ icon, label, value, sub }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">{label}</p>{icon}</div>
                        <p className="text-2xl font-bold text-gray-800">{value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, email o RFC..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 shadow-sm"/>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {([['all','Todos'],['active','Con ventas'],['inactive','Sin ventas']] as [ActivityFilter,string][]).map(([val,lbl]) => (
                        <button key={val} onClick={() => setActivity(val)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activity===val?'bg-white text-green-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                            {lbl}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-gray-400 ml-auto">{sorted.length} cliente{sorted.length!==1?'s':''}</p>
                {sortKey!=='nombre' && <button onClick={() => { setSortKey('nombre'); setSortDir('asc'); }} className="text-xs text-green-500 hover:underline">Limpiar orden</button>}
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-gray-400 text-sm">Cargando clientes...</div>
                ) : sorted.length === 0 ? (
                    <div className="py-16 text-center">
                        <Users size={36} className="mx-auto text-gray-200 mb-3"/>
                        <p className="text-gray-400 font-medium">{search||activity!=='all'?'Sin resultados':'No hay clientes registrados'}</p>
                        {!search && activity==='all' && <button onClick={openCreate} className="mt-3 text-sm text-green-500 hover:underline">Crear el primer cliente</button>}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100">
                                    <th className={thClass('nombre')} onClick={() => handleSort('nombre')}>Cliente <SortIcon col="nombre" sortKey={sortKey} sortDir={sortDir}/></th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Contacto / Fiscal</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Email / Tel.</th>
                                    <th className={`${thClass('totalVentas')} text-right`} onClick={() => handleSort('totalVentas')}>Ventas <SortIcon col="totalVentas" sortKey={sortKey} sortDir={sortDir}/></th>
                                    <th className={`${thClass('montoTotal')} text-right`} onClick={() => handleSort('montoTotal')}>Ingresos <SortIcon col="montoTotal" sortKey={sortKey} sortDir={sortDir}/></th>
                                    <th className={`${thClass('ultimaVenta')} text-right`} onClick={() => handleSort('ultimaVenta')}>Última venta <SortIcon col="ultimaVenta" sortKey={sortKey} sortDir={sortDir}/></th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sorted.map(cli => {
                                    const isActive = selected?.id === cli.id;
                                    return (
                                        <tr key={cli.id} onClick={() => setSelected(isActive ? null : cli)}
                                            className={`cursor-pointer transition-colors ${isActive?'bg-green-50/50':'hover:bg-gray-50/60'}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: colorFor(cli.nombre) }}>
                                                        {cli.nombre[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-semibold ${isActive?'text-green-700':'text-gray-800'}`}>{cli.nombre}</p>
                                                        {cli.direccion && <p className="text-xs text-gray-400 truncate max-w-[180px]">{cli.direccion}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {cli.contacto && <div className="flex items-center gap-1.5 text-sm text-gray-600"><User size={12} className="text-gray-400"/>{cli.contacto}</div>}
                                                {cli.rfc && <div className="text-xs font-mono text-gray-400 mt-0.5">RFC: {cli.rfc}</div>}
                                                {!cli.contacto && !cli.rfc && <span className="text-gray-300 text-sm">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-0.5">
                                                    {cli.email && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Mail size={11} className="text-gray-300"/>{cli.email}</div>}
                                                    {cli.telefono && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Phone size={11} className="text-gray-300"/>{cli.telefono}</div>}
                                                    {!cli.email && !cli.telefono && <span className="text-gray-300 text-sm">—</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {cli.totalVentas > 0
                                                    ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700"><ShoppingBag size={12} className="text-green-400"/>{cli.totalVentas}</span>
                                                    : <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Sin ventas</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {cli.montoTotal > 0
                                                    ? <span className="text-sm font-bold text-gray-800">${cli.montoTotal.toLocaleString('es-MX',{maximumFractionDigits:0})}</span>
                                                    : <span className="text-gray-300 text-sm">$0</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {cli.ultimaVenta
                                                    ? <span className="text-sm text-gray-600">{new Date(cli.ultimaVenta).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}</span>
                                                    : <span className="text-gray-300 text-sm">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={e => openEdit(cli,e)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Edit2 size={14}/></button>
                                                    <button onClick={e => openDelete(cli,e)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Panel detalle */}
            {selected && (
                <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="px-6 py-5 border-b border-gray-100">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0" style={{ background: colorFor(selected.nombre) }}>
                                    {selected.nombre[0].toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{selected.nombre}</h2>
                                    {selected.razonSocial && <p className="text-xs text-gray-500 font-medium mt-0.5">{selected.razonSocial}</p>}
                                    {selected.contacto && <div className="flex items-center gap-1.5 mt-0.5"><User size={12} className="text-gray-400"/><span className="text-sm text-gray-500">{selected.contacto}</span></div>}
                                    <div className="flex flex-wrap gap-4 mt-2">
                                        {selected.telefono && <div className="flex items-center gap-1.5 text-sm text-gray-500"><Phone size={12} className="text-gray-400"/>{selected.telefono}</div>}
                                        {selected.email && <a href={`mailto:${selected.email}`} className="flex items-center gap-1.5 text-sm text-blue-500 hover:underline"><Mail size={12}/>{selected.email}</a>}
                                        {selected.direccion && <div className="flex items-center gap-1.5 text-sm text-gray-500"><MapPin size={12} className="text-gray-400"/>{selected.direccion}</div>}
                                        {selected.rfc && <div className="flex items-center gap-1.5 text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">RFC: {selected.rfc}</div>}
                                        {selected.usoCFDI && <div className="text-xs text-gray-400">CFDI: {selected.usoCFDI}</div>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={e => openEdit(selected,e)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"><Edit2 size={14}/> Editar</button>
                                <button onClick={e => openDelete(selected,e)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-100 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={14}/> Eliminar</button>
                                <button onClick={() => setSelected(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg ml-1"><X size={16}/></button>
                            </div>
                        </div>
                    </div>

                    {/* KPIs detalle */}
                    {loadingStats ? (
                        <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">{[...Array(4)].map((_,i)=><div key={i} className="h-20 animate-pulse bg-gray-50"/>)}</div>
                    ) : stats && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-gray-100 border-b border-gray-100">
                            {[
                                { icon:<ShoppingBag size={14} className="text-green-400"/>, label:'Total ventas', value:String(stats.totalVentas), sub:'movimientos de salida' },
                                { icon:<DollarSign size={14} className="text-blue-400"/>, label:'Ingresos totales', value:`$${stats.montoTotal.toLocaleString('es-MX',{maximumFractionDigits:0})}`, sub:'suma de precios de venta' },
                                { icon:<Package size={14} className="text-purple-400"/>, label:'Productos distintos', value:String(stats.totalProductos), sub:'productos comprados' },
                                { icon:<Calendar size={14} className="text-amber-400"/>, label:'Última venta', value:stats.ultimaVenta?new Date(stats.ultimaVenta).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'—', sub:stats.ultimaVenta?new Date(stats.ultimaVenta).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'Sin ventas' },
                            ].map(({ icon, label, value, sub }) => (
                                <div key={label} className="px-6 py-4">
                                    <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">{label}</p>{icon}</div>
                                    <p className="text-2xl font-bold text-gray-800">{value}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Historial de ventas */}
                    <div className="px-6 py-4 border-b border-gray-50">
                        <div className="flex items-center justify-between mb-3">
                            <div><h3 className="text-base font-semibold text-gray-800">Historial de ventas</h3><p className="text-xs text-gray-400 mt-0.5">Movimientos de salida asociados a este cliente</p></div>
                            {stats && stats.totalVentas > 0 && <span className="text-xs bg-green-50 text-green-600 font-semibold px-2.5 py-1 rounded-full">{filteredMovimientos.length} de {stats.totalVentas} registros</span>}
                        </div>
                        {movimientos.length > 0 && (
                            <div className="flex flex-wrap items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="flex bg-gray-200/50 rounded-md p-0.5">
                                    {(['7d','30d','90d','1y','all'] as const).map((p, i) => (
                                        <button key={p} onClick={() => applyHistPeriod(p)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${histPeriod===p?'bg-white text-green-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                                            {['7d','30d','90d','1 año','Todo'][i]}
                                        </button>
                                    ))}
                                </div>
                                <div className="w-px h-4 bg-gray-200"/>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 font-medium">Desde</span>
                                    <input type="date" value={histDesdeEfectivo} onChange={e => { setHistDesde(e.target.value); setHistPeriod('all'); }}
                                        className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-green-500 focus:border-green-500"/>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 font-medium">Hasta</span>
                                    <input type="date" value={histHastaEfectivo} onChange={e => { setHistHasta(e.target.value); setHistPeriod('all'); }}
                                        className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-green-500 focus:border-green-500"/>
                                </div>
                                <div className="ml-auto flex items-center gap-3 text-xs font-semibold">
                                    <span className="text-red-500">-{filteredMovimientos.length} ventas</span>
                                    <span className="text-gray-700">${filteredMovimientos.reduce((a,m)=>a+m.cantidad*Number(m.precioVenta||0),0).toLocaleString('es-MX',{maximumFractionDigits:0})}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {loadingStats ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Cargando historial...</div>
                    ) : movimientos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12"><ShoppingBag size={32} className="text-gray-200 mb-3"/><p className="text-sm font-medium text-gray-400">Sin ventas registradas</p></div>
                    ) : filteredMovimientos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8"><p className="text-sm text-gray-400">No hay ventas en el periodo seleccionado.</p></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead><tr className="bg-gray-50/50 border-b border-gray-100">
                                    {['Fecha','Producto','SKU','Cantidad','P. Venta','Total','Almacén','Referencia','Usuario'].map(h => (
                                        <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredMovimientos.map(mov => (
                                        <tr key={mov.id} className="hover:bg-green-50/20 transition-colors">
                                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{new Date(mov.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-[160px] truncate">{mov.producto.nombre}</td>
                                            <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 font-mono px-2 py-0.5 rounded">{mov.producto.sku}</span></td>
                                            <td className="px-4 py-3 text-sm font-bold text-red-500 text-right whitespace-nowrap">-{mov.cantidad} <span className="text-xs font-normal text-gray-400">{mov.producto.unidad}</span></td>
                                            <td className="px-4 py-3 text-sm text-gray-700 text-right">${Number(mov.precioVenta||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">${(mov.cantidad*Number(mov.precioVenta||0)).toLocaleString('es-MX',{maximumFractionDigits:0})}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{mov.almacen.nombre}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{mov.referencia||'—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{mov.usuario.nombre}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot><tr className="bg-gray-50 border-t-2 border-gray-200">
                                    <td colSpan={3} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Total</td>
                                    <td className="px-4 py-3 text-sm font-bold text-red-500 text-right whitespace-nowrap">{filteredMovimientos.reduce((a,m)=>a+m.cantidad,0).toLocaleString('es-MX')} uds.</td>
                                    <td/>
                                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">${filteredMovimientos.reduce((a,m)=>a+m.cantidad*Number(m.precioVenta||0),0).toLocaleString('es-MX',{maximumFractionDigits:0})}</td>
                                    <td colSpan={3}/>
                                </tr></tfoot>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {modalOpen && <ClienteModal initial={editTarget} onSave={handleSave} onClose={() => setModalOpen(false)} saving={saving} error={modalError}/>}
            {deleteTarget && <DeleteConfirmModal nombre={deleteTarget.nombre} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} deleting={deleting} error={deleteError}/>}
        </div>
    );
}
