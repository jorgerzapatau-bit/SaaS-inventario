"use client";

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Search, Plus, X, Building2, Package, Calendar, ChevronRight,
         AlertCircle, ChevronLeft, SlidersHorizontal, ChevronDown, Pencil } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

interface DetalleCompra {
    id: string;
    productoId: string;
    producto: { nombre: string; sku: string; unidad: string };
    cantidad: number;
    precioUnitario: number | string;
    moneda?: string;
}

interface Compra {
    id: string;
    proveedorId: string;
    proveedor: { nombre: string; telefono?: string; email?: string } | null;
    referencia: string;
    fecha: string;
    total: number | string;
    moneda?: string;
    tipoCambio?: number | null;
    status: 'PENDIENTE' | 'COMPLETADA' | 'CANCELADA';
    esHuerfana: boolean;
    detalles: DetalleCompra[];
}

const statusConfig = {
    COMPLETADA: { label: 'Completada', cls: 'bg-green-100 text-green-700' },
    PENDIENTE:  { label: 'Pendiente',  cls: 'bg-orange-100 text-orange-700' },
    CANCELADA:  { label: 'Cancelada',  cls: 'bg-red-100 text-red-600' },
};

const PAGE_SIZE = 20;

// ── Ordenamiento ──────────────────────────────────────────────────────────────
type SortKey = 'fecha' | 'total' | 'referencia' | 'proveedor';
type SortDir = 'asc' | 'desc';

function sortCompras(list: Compra[], key: SortKey, dir: SortDir): Compra[] {
    return [...list].sort((a, b) => {
        let va: any, vb: any;
        if (key === 'fecha')      { va = new Date(a.fecha).getTime(); vb = new Date(b.fecha).getTime(); }
        else if (key === 'total') { va = Number(a.total); vb = Number(b.total); }
        else if (key === 'proveedor') { va = a.proveedor?.nombre ?? ''; vb = b.proveedor?.nombre ?? ''; }
        else                      { va = a.referencia ?? ''; vb = b.referencia ?? ''; }
        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
    });
}

function PurchasesPageInner() {
    const searchParams = useSearchParams();
    const router       = useRouter();

    const [compras,  setCompras]  = useState<Compra[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');
    const [detalle,  setDetalle]  = useState<Compra | null>(null);
    const [page,     setPage]     = useState(1);
    const [showFiltros, setShowFiltros] = useState(false);
    const [savingStatus,   setSavingStatus]   = useState(false);
    const [statusError,    setStatusError]    = useState('');
    const [confirmCancel,  setConfirmCancel]  = useState(false);

    // ── Filtros ───────────────────────────────────────────────────────────────
    const [busqueda,       setBusqueda]       = useState('');
    const [filtroStatus,   setFiltroStatus]   = useState<string>('todos');
    const [filtroProveedor,setFiltroProveedor]= useState<string>('todos');
    const [filtroTipo,     setFiltroTipo]     = useState<string>('todos'); // todos | directa | orden
    const [filtroDesde,    setFiltroDesde]    = useState('');
    const [filtroHasta,    setFiltroHasta]    = useState('');
    const [filtroMontoMin, setFiltroMontoMin] = useState('');
    const [filtroMontoMax, setFiltroMontoMax] = useState('');
    const [sortKey,        setSortKey]        = useState<SortKey>('fecha');
    const [sortDir,        setSortDir]        = useState<SortDir>('desc');

    // ── Leer filtros desde URL (ej: ?desde=2026-03-01&hasta=2026-03-28&status=PENDIENTE) ──
    useEffect(() => {
        const desde  = searchParams.get('desde');
        const hasta  = searchParams.get('hasta');
        const status = searchParams.get('status');
        if (desde)  setFiltroDesde(desde);
        if (hasta)  setFiltroHasta(hasta);
        if (status) setFiltroStatus(status);
        if (desde || hasta || status) setShowFiltros(true);
    }, [searchParams]);

    useEffect(() => {
        setLoading(true);
        fetchApi('/purchases')
            .then(data => {
                console.log('✅ Compras recibidas:', data?.length, data);
                setCompras(data);
            })
            .catch((err: any) => {
                console.error('❌ Error al cargar compras:', err);
                setError(err.message || 'Error al cargar compras');
            })
            .finally(() => setLoading(false));
    }, [searchParams.toString()]);

    // ── Proveedores únicos para el select ─────────────────────────────────────
    const proveedoresUnicos = useMemo(() => {
        const map = new Map<string, string>();
        compras.forEach(c => { if (c.proveedorId && c.proveedor?.nombre) map.set(c.proveedorId, c.proveedor.nombre); });
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [compras]);

    // ── Filtrado ──────────────────────────────────────────────────────────────
    const comprasFiltradas = useMemo(() => {
        let result = compras.filter(c => {
            // Búsqueda texto
            if (busqueda.trim()) {
                const q = busqueda.toLowerCase();
                const match = (c.referencia || '').toLowerCase().includes(q) ||
                    (c.proveedor?.nombre || '').toLowerCase().includes(q) ||
                    c.detalles?.some(d => d.producto?.nombre?.toLowerCase().includes(q) || d.producto?.sku?.toLowerCase().includes(q));
                if (!match) return false;
            }
            // Status
            if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
            // Proveedor
            if (filtroProveedor !== 'todos' && c.proveedorId !== filtroProveedor) return false;
            // Tipo (directa / orden)
            if (filtroTipo === 'directa' && !c.esHuerfana) return false;
            if (filtroTipo === 'orden'   &&  c.esHuerfana) return false;
            // Rango de fechas
            if (filtroDesde && new Date(c.fecha) < new Date(filtroDesde)) return false;
            if (filtroHasta && new Date(c.fecha) > new Date(filtroHasta + 'T23:59:59')) return false;
            // Monto
            if (filtroMontoMin && Number(c.total) < Number(filtroMontoMin)) return false;
            if (filtroMontoMax && Number(c.total) > Number(filtroMontoMax)) return false;
            return true;
        });
        return sortCompras(result, sortKey, sortDir);
    }, [compras, busqueda, filtroStatus, filtroProveedor, filtroTipo,
        filtroDesde, filtroHasta, filtroMontoMin, filtroMontoMax, sortKey, sortDir]);

    // ── KPIs dinámicos (sobre filtradas) ─────────────────────────────────────
    const kpiTotal     = comprasFiltradas.reduce((a, c) => a + Number(c.total), 0);
    const kpiCount     = comprasFiltradas.length;
    const kpiProvs     = new Set(comprasFiltradas.map(c => c.proveedorId)).size;
    const mesActual    = new Date().getMonth();
    const kpiMes       = comprasFiltradas.filter(c => new Date(c.fecha).getMonth() === mesActual).length;
    const kpiPromedio  = kpiCount > 0 ? kpiTotal / kpiCount : 0;

    // ── Paginación ────────────────────────────────────────────────────────────
    const totalPages  = Math.max(1, Math.ceil(comprasFiltradas.length / PAGE_SIZE));
    const comprasPag  = comprasFiltradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const hayFiltros = filtroStatus !== 'todos' || filtroProveedor !== 'todos' ||
        filtroTipo !== 'todos' || filtroDesde || filtroHasta || filtroMontoMin || filtroMontoMax;

    const resetFiltros = () => {
        setBusqueda(''); setFiltroStatus('todos'); setFiltroProveedor('todos');
        setFiltroTipo('todos'); setFiltroDesde(''); setFiltroHasta('');
        setFiltroMontoMin(''); setFiltroMontoMax(''); setPage(1);
    };

    const handleStatusChange = async (compraId: string, newStatus: 'COMPLETADA' | 'CANCELADA') => {
        setSavingStatus(true);
        setStatusError('');
        try {
            const updated = await fetchApi(`/purchases/${compraId}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus }),
            });
            // Actualizar la lista local
            setCompras(prev => prev.map(c => c.id === compraId ? { ...c, ...updated } : c));
            setDetalle(prev => prev?.id === compraId ? { ...prev, ...updated } : prev);
        } catch (e: any) {
            setStatusError(e.message || 'Error al actualizar el estado');
        } finally {
            setSavingStatus(false);
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
        setPage(1);
    };

    const SortIcon = ({ col }: { col: SortKey }) => (
        <span className={`ml-1 text-xs ${sortKey === col ? 'text-blue-500' : 'text-gray-300'}`}>
            {sortKey === col ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
        </span>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Compras (Entradas)</h1>
                    <p className="text-sm text-gray-500 mt-1">Historial de órdenes de compra y entradas al inventario.</p>
                </div>
                <Link href="/dashboard/purchases/new"
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                    <Plus size={16}/> Nueva Compra
                </Link>
            </div>

            {/* ── KPIs dinámicos ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1">Órdenes</p>
                    <p className="text-2xl font-bold text-gray-800">{kpiCount}</p>
                    <p className="text-xs text-gray-400 mt-1">{kpiMes} este mes</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1">Total invertido</p>
                    <p className="text-2xl font-bold text-gray-800">
                        ${kpiTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{hayFiltros ? 'en selección' : 'todas las entradas'}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1">Ticket promedio</p>
                    <p className="text-2xl font-bold text-gray-800">
                        ${kpiPromedio.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">por orden</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1">Proveedores</p>
                    <p className="text-2xl font-bold text-gray-800">{kpiProvs}</p>
                    <p className="text-xs text-gray-400 mt-1">en selección</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1">Completadas</p>
                    <p className="text-2xl font-bold text-green-600">
                        {comprasFiltradas.filter(c => c.status === 'COMPLETADA').length}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {comprasFiltradas.filter(c => c.status === 'PENDIENTE').length} pendientes
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 flex items-center gap-2">
                    <AlertCircle size={16}/> {error}
                </div>
            )}

            {/* ── Tabla con filtros ───────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Barra superior: búsqueda + toggle filtros */}
                <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[220px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={e => { setBusqueda(e.target.value); setPage(1); }}
                            placeholder="Referencia, proveedor o producto..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        {busqueda && (
                            <button onClick={() => { setBusqueda(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={13}/>
                            </button>
                        )}
                    </div>

                    {/* Filtro rápido: status */}
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                        {(['todos', 'COMPLETADA', 'PENDIENTE', 'CANCELADA'] as const).map(s => (
                            <button key={s}
                                onClick={() => { setFiltroStatus(s); setPage(1); }}
                                className={`px-3 py-2 transition-colors cursor-pointer whitespace-nowrap ${filtroStatus === s ? 'bg-gray-800 text-white' : 'hover:bg-gray-50 text-gray-600'}`}>
                                {s === 'todos' ? 'Todos' : statusConfig[s].label}
                            </button>
                        ))}
                    </div>

                    {/* Botón filtros avanzados */}
                    <button
                        onClick={() => setShowFiltros(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors cursor-pointer ${showFiltros || hayFiltros ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        <SlidersHorizontal size={13}/>
                        Filtros
                        {hayFiltros && <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                            {[filtroProveedor!=='todos',filtroTipo!=='todos',!!filtroDesde,!!filtroHasta,!!filtroMontoMin,!!filtroMontoMax].filter(Boolean).length}
                        </span>}
                        <ChevronDown size={12} className={`transition-transform ${showFiltros ? 'rotate-180' : ''}`}/>
                    </button>

                    <p className="text-sm text-gray-400 whitespace-nowrap ml-auto">
                        {comprasFiltradas.length} {comprasFiltradas.length === 1 ? 'resultado' : 'resultados'}
                        {hayFiltros && <button onClick={resetFiltros} className="ml-2 text-blue-500 hover:text-blue-700 underline cursor-pointer">limpiar</button>}
                    </p>
                </div>

                {/* Panel de filtros avanzados */}
                {showFiltros && (
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 grid grid-cols-2 md:grid-cols-4 gap-3">

                        {/* Proveedor */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Proveedor</label>
                            <select
                                value={filtroProveedor}
                                onChange={e => { setFiltroProveedor(e.target.value); setPage(1); }}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
                                <option value="todos">Todos los proveedores</option>
                                {proveedoresUnicos.map(([id, nombre]) => (
                                    <option key={id} value={id}>{nombre}</option>
                                ))}
                            </select>
                        </div>

                        {/* Tipo */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Tipo de entrada</label>
                            <select
                                value={filtroTipo}
                                onChange={e => { setFiltroTipo(e.target.value); setPage(1); }}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
                                <option value="todos">Todos los tipos</option>
                                <option value="orden">Orden de compra</option>
                                <option value="directa">Entrada directa</option>
                            </select>
                        </div>

                        {/* Rango fechas */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Desde</label>
                            <input type="date" value={filtroDesde}
                                onChange={e => { setFiltroDesde(e.target.value); setPage(1); }}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Hasta</label>
                            <input type="date" value={filtroHasta}
                                onChange={e => { setFiltroHasta(e.target.value); setPage(1); }}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                        </div>

                        {/* Rango monto */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Monto mínimo</label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                <input type="number" min="0" placeholder="0" value={filtroMontoMin}
                                    onChange={e => { setFiltroMontoMin(e.target.value); setPage(1); }}
                                    className="w-full pl-6 pr-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Monto máximo</label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                <input type="number" min="0" placeholder="Sin límite" value={filtroMontoMax}
                                    onChange={e => { setFiltroMontoMax(e.target.value); setPage(1); }}
                                    className="w-full pl-6 pr-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                            </div>
                        </div>

                        {/* Botón limpiar */}
                        {hayFiltros && (
                            <div className="flex items-end col-span-2">
                                <button onClick={resetFiltros}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg bg-white transition-colors cursor-pointer">
                                    <X size={11}/> Limpiar todos los filtros
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Tabla */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort('referencia')}>
                                    Referencia <SortIcon col="referencia"/>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort('proveedor')}>
                                    Proveedor <SortIcon col="proveedor"/>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort('fecha')}>
                                    Fecha <SortIcon col="fecha"/>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Productos</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => handleSort('total')}>
                                    Total <SortIcon col="total"/>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">Cargando compras...</td></tr>
                            ) : comprasPag.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <Package size={32} className="mx-auto text-gray-300 mb-2"/>
                                        <p className="text-gray-500 font-medium">
                                            {busqueda || hayFiltros ? 'Sin resultados para estos filtros' : 'No hay compras registradas'}
                                        </p>
                                        {(busqueda || hayFiltros) && (
                                            <button onClick={resetFiltros} className="mt-2 text-sm text-blue-500 hover:underline cursor-pointer">
                                                Limpiar filtros
                                            </button>
                                        )}
                                        {!busqueda && !hayFiltros && (
                                            <p className="mt-2 text-xs text-gray-400">
                                                Si acabas de registrar una compra, abre la consola del navegador (F12) y revisa la pestaña <strong>Console</strong> para ver el resultado del fetch.
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                comprasPag.map(compra => {
                                    const st = statusConfig[compra.status] ?? statusConfig.COMPLETADA;
                                    const totalItems = compra.detalles?.reduce((a, d) => a + d.cantidad, 0) ?? 0;
                                    return (
                                        <tr key={compra.id}
                                            onClick={() => setDetalle(compra)}
                                            className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                                    {compra.referencia || '—'}
                                                </span>
                                                {compra.esHuerfana && (
                                                    <span className="ml-2 text-xs bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                                        entrada directa
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="flex items-center gap-1.5 text-sm text-gray-700">
                                                    <Building2 size={13} className="text-blue-400 flex-shrink-0"/>
                                                    {compra.proveedor?.nombre || 'Sin proveedor'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                {new Date(compra.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {compra.detalles?.length === 1 ? (
                                                    <span>
                                                        <span className="text-gray-800 font-medium">{compra.detalles[0].producto?.nombre}</span>
                                                        {' · '}
                                                        <span className="font-semibold text-gray-900">{totalItems}</span>
                                                        {' '}
                                                        <span className="text-gray-500">{compra.detalles[0].producto?.unidad ?? 'uds'}</span>
                                                    </span>
                                                ) : (
                                                    <span>
                                                        {compra.detalles?.length ?? 0} productos · {totalItems} uds
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-gray-800 whitespace-nowrap">
                                                ${Number(compra.total).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                                                <span className="ml-1 text-[10px] font-normal text-gray-400">{compra.moneda ?? 'MXN'}</span>
                                                {compra.moneda === 'USD' && compra.tipoCambio && (
                                                    <p className="text-[10px] text-gray-400 font-normal">
                                                        ≈ ${(Number(compra.total) * compra.tipoCambio).toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${st.cls}`}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 transition-colors"/>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Paginación ── */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            Página {page} de {totalPages} · {comprasFiltradas.length} resultados
                        </p>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                                <ChevronLeft size={14}/>
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const p = totalPages <= 5 ? i + 1
                                    : page <= 3 ? i + 1
                                    : page >= totalPages - 2 ? totalPages - 4 + i
                                    : page - 2 + i;
                                return (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={`w-7 h-7 text-xs rounded-lg border transition-colors cursor-pointer ${page === p ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                        {p}
                                    </button>
                                );
                            })}
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                                <ChevronRight size={14}/>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal detalle ───────────────────────────────────────────────── */}
            {detalle && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setDetalle(null); setConfirmCancel(false); }}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between sticky top-0 bg-white rounded-t-2xl z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-lg font-bold text-gray-900">{detalle.referencia || 'Sin referencia'}</span>
                                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusConfig[detalle.status]?.cls}`}>
                                        {statusConfig[detalle.status]?.label}
                                    </span>
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-50 text-blue-600 border border-blue-100">
                                        {detalle.moneda ?? 'MXN'}
                                    </span>
                                </div>
                                {detalle.esHuerfana && (
                                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 inline-block">
                                        Entrada directa — registrada desde el producto
                                    </p>
                                )}
                            </div>
                            <button onClick={() => { setDetalle(null); setConfirmCancel(false); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer">
                                <X size={18}/>
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-5">
                            {/* Proveedor + Fecha */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Building2 size={11}/> Proveedor</p>
                                    {detalle.proveedor?.nombre
                                        ? <p className="text-sm font-semibold text-gray-800">{detalle.proveedor.nombre}</p>
                                        : <p className="text-sm text-gray-400 italic">Sin proveedor</p>
                                    }
                                    {detalle.proveedor?.telefono && <p className="text-xs text-gray-500 mt-0.5">{detalle.proveedor.telefono}</p>}
                                    {detalle.proveedor?.email   && <p className="text-xs text-gray-500">{detalle.proveedor.email}</p>}
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Calendar size={11}/> Fecha</p>
                                    <p className="text-sm font-semibold text-gray-800">
                                        {new Date(detalle.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        {', '}
                                        {new Date(detalle.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </p>
                                </div>
                            </div>

                            {/* Productos recibidos */}
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Productos recibidos</p>
                                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                                    {detalle.detalles?.map((d, i) => (
                                        <div key={d.id ?? i} className="flex items-start justify-between px-4 py-3 bg-white">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{d.producto?.nombre}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {d.producto?.sku}
                                                    {' · '}
                                                    <span className="font-semibold text-gray-700">{d.cantidad} {d.producto?.unidad ?? 'uds'}</span>
                                                    {' a '}
                                                    ${Number(d.precioUnitario).toLocaleString('es-MX', { maximumFractionDigits: 2 })}/{d.producto?.unidad ?? 'u'}
                                                    {' '}
                                                    <span className="font-semibold">{d.moneda ?? detalle.moneda ?? 'MXN'}</span>
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0 ml-4">
                                                <p className="text-sm font-bold text-gray-900">
                                                    ${(Number(d.precioUnitario) * d.cantidad).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                                                    <span className="ml-1 text-[10px] font-semibold text-gray-400">{d.moneda ?? detalle.moneda ?? 'MXN'}</span>
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {d.cantidad} × ${Number(d.precioUnitario).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                                                </p>
                                                {(d.moneda === 'USD' || detalle.moneda === 'USD') && detalle.tipoCambio && (
                                                    <p className="text-[10px] text-blue-500 mt-0.5">
                                                        ≈ ${(Number(d.precioUnitario) * d.cantidad * detalle.tipoCambio).toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Total */}
                            <div className="flex justify-between items-end pt-3 border-t border-gray-200">
                                <div>
                                    <p className="text-sm font-semibold text-gray-700">Total facturado</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {detalle.detalles?.length ?? 0} {detalle.detalles?.length === 1 ? 'producto' : 'productos'}
                                        {' · '}
                                        {detalle.detalles?.reduce((a, d) => a + d.cantidad, 0) ?? 0}
                                        {' '}
                                        {detalle.detalles?.length === 1 ? (detalle.detalles[0].producto?.unidad ?? 'uds') : 'uds'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-gray-900 leading-none">
                                        ${Number(detalle.total).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs font-semibold text-gray-400 mt-1">{detalle.moneda ?? 'MXN'}</p>
                                    {detalle.moneda === 'USD' && detalle.tipoCambio && (
                                        <p className="text-xs text-blue-500 mt-0.5">
                                            ≈ ${(Number(detalle.total) * detalle.tipoCambio).toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN
                                            <span className="text-gray-400"> (TC: ${detalle.tipoCambio})</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 pb-5 space-y-3">
                            {statusError && (
                                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    {statusError}
                                </p>
                            )}
                            {/* Acciones solo para compras PENDIENTES y no huérfanas */}
                            {detalle.status === 'PENDIENTE' && !detalle.esHuerfana && (
                                <div className="space-y-2">
                                    {/* Botón Editar */}
                                    <button
                                        onClick={() => {
                                            setDetalle(null);
                                            setConfirmCancel(false);
                                            router.push(`/dashboard/purchases/edit?id=${detalle.id}`);
                                        }}
                                        className="w-full py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Pencil size={15}/> Editar orden
                                    </button>
                                    {!confirmCancel ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleStatusChange(detalle.id, 'COMPLETADA')}
                                                disabled={savingStatus}
                                                className="flex-1 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
                                            >
                                                {savingStatus ? 'Guardando...' : '✓ Marcar como completada'}
                                            </button>
                                            <button
                                                onClick={() => setConfirmCancel(true)}
                                                disabled={savingStatus}
                                                className="flex-1 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
                                            >
                                                Cancelar orden
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="border border-red-200 bg-red-50 rounded-xl p-3 space-y-2">
                                            <p className="text-sm font-semibold text-red-700 text-center">
                                                ¿Confirmar cancelación?
                                            </p>
                                            <p className="text-xs text-red-500 text-center">
                                                Esta acción no se puede deshacer. La orden quedará como cancelada y no afectará el inventario.
                                            </p>
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={() => setConfirmCancel(false)}
                                                    disabled={savingStatus}
                                                    className="flex-1 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
                                                >
                                                    No, volver
                                                </button>
                                                <button
                                                    onClick={() => { setConfirmCancel(false); handleStatusChange(detalle.id, 'CANCELADA'); }}
                                                    disabled={savingStatus}
                                                    className="flex-1 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
                                                >
                                                    {savingStatus ? 'Cancelando...' : 'Sí, cancelar'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {detalle.status === 'COMPLETADA' && (
                                <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
                                    ✓ Mercancía recibida — entradas registradas en el kardex
                                </p>
                            )}
                            {detalle.status === 'CANCELADA' && (
                                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center">
                                    Esta orden fue cancelada y no afectó el inventario
                                </p>
                            )}
                            <button onClick={() => { setDetalle(null); setStatusError(''); setConfirmCancel(false); }}
                                className="w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PurchasesPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>}>
            <PurchasesPageInner />
        </Suspense>
    );
}
