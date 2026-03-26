"use client";

import { useEffect, useState, useMemo } from 'react';
import { Search, X, Building2, User, ChevronRight, ChevronLeft,
         SlidersHorizontal, ChevronDown, ArrowDownToLine, ArrowUpFromLine,
         Package, TrendingDown, TrendingUp, Activity } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Movimiento {
    id: string;
    tipoMovimiento: 'ENTRADA' | 'SALIDA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO';
    cantidad: number;
    costoUnitario: number;
    precioVenta?: number | null;
    referencia?: string | null;
    fecha: string;
    producto:  { nombre: string } | null;
    almacen:   { nombre: string } | null;
    usuario:   { nombre: string } | null;
    proveedor: { nombre: string } | null;
    clienteNombre?: string | null;
    compra?:   { referencia: string; status: string } | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const tipoColor = (t: string) => ({
    ENTRADA:         'bg-green-100 text-green-700',
    SALIDA:          'bg-red-100 text-red-700',
    AJUSTE_POSITIVO: 'bg-blue-100 text-blue-700',
    AJUSTE_NEGATIVO: 'bg-orange-100 text-orange-700',
}[t] || 'bg-gray-100 text-gray-600');

const tipoLabel = (t: string) => ({
    ENTRADA: 'Entrada', SALIDA: 'Salida',
    AJUSTE_POSITIVO: 'Ajuste +', AJUSTE_NEGATIVO: 'Ajuste -',
}[t] || t);

const isPositive = (t: string) => ['ENTRADA', 'AJUSTE_POSITIVO'].includes(t);

type SortKey  = 'fecha' | 'producto' | 'cantidad' | 'costo';
type SortDir  = 'asc' | 'desc';
const PAGE_SIZE = 30;

// ─── Component ─────────────────────────────────────────────────────────────────

export default function KardexPage() {
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState('');
    const [page,        setPage]        = useState(1);
    const [showPanel,   setShowPanel]   = useState(false);
    const [detalle,     setDetalle]     = useState<Movimiento | null>(null);

    // ── Filtros ───────────────────────────────────────────────────────────────
    const [busqueda,       setBusqueda]        = useState('');
    const [filtroTipo,     setFiltroTipo]      = useState('todos');
    const [filtroProducto, setFiltroProducto]  = useState('todos');
    const [filtroAlmacen,  setFiltroAlmacen]   = useState('todos');
    const [filtroDesde,    setFiltroDesde]      = useState('');
    const [filtroHasta,    setFiltroHasta]      = useState('');
    const [filtroMontoMin, setFiltroMontoMin]   = useState('');
    const [filtroMontoMax, setFiltroMontoMax]   = useState('');
    const [sortKey,        setSortKey]          = useState<SortKey>('fecha');
    const [sortDir,        setSortDir]          = useState<SortDir>('desc');

    useEffect(() => {
        fetchApi('/inventory/movements')
            .then(setMovimientos)
            .catch((err: any) => setError(err.message || 'Error al cargar movimientos'))
            .finally(() => setLoading(false));
    }, []);

    // ── Opciones únicas para selects ──────────────────────────────────────────
    const productosUnicos = useMemo(() => {
        const map = new Map<string, string>();
        movimientos.forEach(m => { if (m.producto?.nombre) map.set(m.producto.nombre, m.producto.nombre); });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [movimientos]);

    const almacenesUnicos = useMemo(() => {
        const map = new Map<string, string>();
        movimientos.forEach(m => { if (m.almacen?.nombre) map.set(m.almacen.nombre, m.almacen.nombre); });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [movimientos]);

    // ── Filtrado + ordenamiento ───────────────────────────────────────────────
    const movsFiltrados = useMemo(() => {
        let result = movimientos.filter(m => {
            if (busqueda.trim()) {
                const q = busqueda.toLowerCase();
                if (!(
                    m.producto?.nombre?.toLowerCase().includes(q) ||
                    (m.referencia || '').toLowerCase().includes(q) ||
                    m.proveedor?.nombre?.toLowerCase().includes(q) ||
                    m.clienteNombre?.toLowerCase().includes(q) ||
                    m.almacen?.nombre?.toLowerCase().includes(q)
                )) return false;
            }
            if (filtroTipo !== 'todos' && m.tipoMovimiento !== filtroTipo) return false;
            if (filtroProducto !== 'todos' && m.producto?.nombre !== filtroProducto) return false;
            if (filtroAlmacen  !== 'todos' && m.almacen?.nombre  !== filtroAlmacen)  return false;
            if (filtroDesde && new Date(m.fecha) < new Date(filtroDesde)) return false;
            if (filtroHasta && new Date(m.fecha) > new Date(filtroHasta + 'T23:59:59')) return false;
            const costo = Number(m.costoUnitario) * m.cantidad;
            if (filtroMontoMin && costo < Number(filtroMontoMin)) return false;
            if (filtroMontoMax && costo > Number(filtroMontoMax)) return false;
            return true;
        });

        result.sort((a, b) => {
            let va: any, vb: any;
            if      (sortKey === 'fecha')    { va = new Date(a.fecha).getTime(); vb = new Date(b.fecha).getTime(); }
            else if (sortKey === 'producto') { va = a.producto?.nombre ?? ''; vb = b.producto?.nombre ?? ''; }
            else if (sortKey === 'cantidad') { va = a.cantidad; vb = b.cantidad; }
            else                             { va = Number(a.costoUnitario) * a.cantidad; vb = Number(b.costoUnitario) * b.cantidad; }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1  : -1;
            return 0;
        });
        return result;
    }, [movimientos, busqueda, filtroTipo, filtroProducto, filtroAlmacen,
        filtroDesde, filtroHasta, filtroMontoMin, filtroMontoMax, sortKey, sortDir]);

    // ── KPIs dinámicos ────────────────────────────────────────────────────────
    const entradas  = movsFiltrados.filter(m => m.tipoMovimiento === 'ENTRADA');
    const salidas   = movsFiltrados.filter(m => m.tipoMovimiento === 'SALIDA');
    const totalEntradas = entradas.reduce((a, m) => a + Number(m.costoUnitario) * m.cantidad, 0);
    const totalSalidas  = salidas.reduce((a, m) => a + (m.precioVenta ?? Number(m.costoUnitario)) * m.cantidad, 0);
    const unidadesIn    = entradas.reduce((a, m) => a + m.cantidad, 0);
    const unidadesOut   = salidas.reduce((a, m) => a + m.cantidad, 0);

    // ── Paginación ────────────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(movsFiltrados.length / PAGE_SIZE));
    const movsPage   = movsFiltrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const hayFiltros = filtroTipo !== 'todos' || filtroProducto !== 'todos' || filtroAlmacen !== 'todos' ||
        filtroDesde || filtroHasta || filtroMontoMin || filtroMontoMax;
    const filtrosActivos = [filtroTipo!=='todos', filtroProducto!=='todos', filtroAlmacen!=='todos',
        !!filtroDesde, !!filtroHasta, !!filtroMontoMin, !!filtroMontoMax].filter(Boolean).length;

    const resetFiltros = () => {
        setBusqueda(''); setFiltroTipo('todos'); setFiltroProducto('todos');
        setFiltroAlmacen('todos'); setFiltroDesde(''); setFiltroHasta('');
        setFiltroMontoMin(''); setFiltroMontoMax(''); setPage(1);
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

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Kardex / Movimientos</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Historial completo de todos los movimientos de inventario.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/dashboard/purchases/new"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors shadow-sm text-sm">
                        <ArrowDownToLine size={16} className="text-green-600"/> Registrar Entrada
                    </Link>
                    <Link href="/dashboard/sales/new"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors shadow-sm text-sm">
                        <ArrowUpFromLine size={16} className="text-orange-600"/> Registrar Salida
                    </Link>
                </div>
            </div>

            {/* ── KPIs dinámicos ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-500">Movimientos</p>
                        <Activity size={14} className="text-gray-400"/>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{movsFiltrados.length}</p>
                    <p className="text-xs text-gray-400 mt-1">
                        {entradas.length} entradas · {salidas.length} salidas
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-500">Total comprado</p>
                        <TrendingDown size={14} className="text-green-500"/>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                        ${totalEntradas.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{unidadesIn.toLocaleString()} unidades recibidas</p>
                </div>
                <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-500">Total vendido</p>
                        <TrendingUp size={14} className="text-red-400"/>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                        ${totalSalidas.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{unidadesOut.toLocaleString()} unidades despachadas</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-500">Margen bruto</p>
                        <Package size={14} className="text-amber-400"/>
                    </div>
                    <p className={`text-2xl font-bold ${totalSalidas - totalEntradas >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ${(totalSalidas - totalEntradas).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {totalSalidas > 0 ? ((totalSalidas - totalEntradas) / totalSalidas * 100).toFixed(1) + '%' : '—'} sobre ventas
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 text-sm">{error}</div>
            )}

            {/* ── Tabla ───────────────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Barra de búsqueda + filtros rápidos */}
                <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[220px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/>
                        <input type="text" value={busqueda}
                            onChange={e => { setBusqueda(e.target.value); setPage(1); }}
                            placeholder="Producto, referencia, proveedor..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
                        {busqueda && (
                            <button onClick={() => { setBusqueda(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                                <X size={13}/>
                            </button>
                        )}
                    </div>

                    {/* Tipo rápido */}
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                        {([
                            ['todos',         'Todos'],
                            ['ENTRADA',       'Entradas'],
                            ['SALIDA',        'Salidas'],
                            ['AJUSTE_POSITIVO','Aj +'],
                            ['AJUSTE_NEGATIVO','Aj −'],
                        ] as const).map(([val, label]) => (
                            <button key={val}
                                onClick={() => { setFiltroTipo(val); setPage(1); }}
                                className={`px-3 py-2 transition-colors cursor-pointer whitespace-nowrap ${filtroTipo === val ? 'bg-gray-800 text-white' : 'hover:bg-gray-50 text-gray-600'}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Filtros avanzados */}
                    <button
                        onClick={() => setShowPanel(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors cursor-pointer ${showPanel || hayFiltros ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        <SlidersHorizontal size={13}/>
                        Filtros
                        {filtrosActivos > 0 && (
                            <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                                {filtrosActivos}
                            </span>
                        )}
                        <ChevronDown size={12} className={`transition-transform ${showPanel ? 'rotate-180' : ''}`}/>
                    </button>

                    <p className="text-sm text-gray-400 whitespace-nowrap ml-auto">
                        {movsFiltrados.length} {movsFiltrados.length === 1 ? 'resultado' : 'resultados'}
                        {hayFiltros && (
                            <button onClick={resetFiltros} className="ml-2 text-blue-500 hover:text-blue-700 underline cursor-pointer">
                                limpiar
                            </button>
                        )}
                    </p>
                </div>

                {/* Panel de filtros avanzados */}
                {showPanel && (
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Producto</label>
                            <select value={filtroProducto}
                                onChange={e => { setFiltroProducto(e.target.value); setPage(1); }}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
                                <option value="todos">Todos los productos</option>
                                {productosUnicos.map(([k]) => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Almacén</label>
                            <select value={filtroAlmacen}
                                onChange={e => { setFiltroAlmacen(e.target.value); setPage(1); }}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
                                <option value="todos">Todos los almacenes</option>
                                {almacenesUnicos.map(([k]) => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Desde</label>
                            <input type="date" value={filtroDesde}
                                onChange={e => { setFiltroDesde(e.target.value); setPage(1); }}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Hasta</label>
                            <input type="date" value={filtroHasta}
                                onChange={e => { setFiltroHasta(e.target.value); setPage(1); }}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Costo total mínimo</label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                <input type="number" min="0" placeholder="0" value={filtroMontoMin}
                                    onChange={e => { setFiltroMontoMin(e.target.value); setPage(1); }}
                                    className="w-full pl-6 pr-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"/>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Costo total máximo</label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                <input type="number" min="0" placeholder="Sin límite" value={filtroMontoMax}
                                    onChange={e => { setFiltroMontoMax(e.target.value); setPage(1); }}
                                    className="w-full pl-6 pr-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"/>
                            </div>
                        </div>
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
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none"
                                    onClick={() => handleSort('fecha')}>
                                    Fecha <SortIcon col="fecha"/>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none"
                                    onClick={() => handleSort('producto')}>
                                    Producto <SortIcon col="producto"/>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipo</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Referencia</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Proveedor / Cliente</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Almacén</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right cursor-pointer hover:text-gray-600 select-none"
                                    onClick={() => handleSort('cantidad')}>
                                    Cant. <SortIcon col="cantidad"/>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Costo unit.</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right cursor-pointer hover:text-gray-600 select-none"
                                    onClick={() => handleSort('costo')}>
                                    Costo total <SortIcon col="costo"/>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Usuario</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={11} className="px-6 py-10 text-center text-gray-400">Cargando movimientos...</td></tr>
                            ) : movsPage.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-6 py-12 text-center">
                                        <Package size={32} className="mx-auto text-gray-300 mb-2"/>
                                        <p className="text-gray-500 font-medium">
                                            {busqueda || hayFiltros ? 'Sin resultados para estos filtros' : 'No hay movimientos registrados'}
                                        </p>
                                        {(busqueda || hayFiltros) && (
                                            <button onClick={resetFiltros} className="mt-2 text-sm text-blue-500 hover:underline cursor-pointer">
                                                Limpiar filtros
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : movsPage.map(mov => {
                                const pos = isPositive(mov.tipoMovimiento);
                                const contacto = mov.proveedor?.nombre || mov.clienteNombre;
                                const costoTotal = Number(mov.costoUnitario) * mov.cantidad;
                                return (
                                    <tr key={mov.id} onClick={() => setDetalle(mov)}
                                        className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                            {new Date(mov.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link href={`/dashboard/products`}
                                                onClick={e => e.stopPropagation()}
                                                className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors hover:underline">
                                                {mov.producto?.nombre || '—'}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${tipoColor(mov.tipoMovimiento)}`}>
                                                {tipoLabel(mov.tipoMovimiento)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[130px] truncate">
                                            {mov.referencia || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {contacto
                                                ? <span className="flex items-center gap-1.5 text-gray-700">
                                                    {mov.proveedor
                                                        ? <Building2 size={13} className="text-blue-400 flex-shrink-0"/>
                                                        : <User      size={13} className="text-green-400 flex-shrink-0"/>}
                                                    {contacto}
                                                  </span>
                                                : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{mov.almacen?.nombre || '—'}</td>
                                        <td className={`px-4 py-3 text-sm font-bold text-right ${pos ? 'text-green-600' : 'text-red-500'}`}>
                                            {pos ? '+' : '−'}{mov.cantidad}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                                            ${Number(mov.costoUnitario).toLocaleString('es-MX')}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">
                                            ${costoTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{mov.usuario?.nombre || '—'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <ChevronRight size={15} className="text-gray-300 group-hover:text-blue-400 transition-colors"/>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            Página {page} de {totalPages} · {movsFiltrados.length} resultados
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
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetalle(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${tipoColor(detalle.tipoMovimiento)}`}>
                                    {tipoLabel(detalle.tipoMovimiento)}
                                </span>
                                <h3 className="text-lg font-bold text-gray-900 mt-2">{detalle.referencia || 'Sin referencia'}</h3>
                            </div>
                            <button onClick={() => setDetalle(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">
                                <X size={20}/>
                            </button>
                        </div>
                        <div className="space-y-0">
                            {([
                                ['Producto',      detalle.producto?.nombre],
                                ['Fecha',         new Date(detalle.fecha).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })],
                                ['Almacén',       detalle.almacen?.nombre],
                                ['Cantidad',      `${isPositive(detalle.tipoMovimiento) ? '+' : '−'}${detalle.cantidad}`],
                                ['Costo unitario',`$${Number(detalle.costoUnitario).toLocaleString()}`],
                                ['Costo total',   `$${(detalle.cantidad * Number(detalle.costoUnitario)).toLocaleString()}`],
                                ...(detalle.precioVenta ? [['Precio de venta', `$${Number(detalle.precioVenta).toLocaleString()}`]] : []),
                                ...(detalle.proveedor   ? [['Proveedor', detalle.proveedor.nombre]] : []),
                                ...(detalle.clienteNombre ? [['Cliente', detalle.clienteNombre]] : []),
                                ['Registrado por', detalle.usuario?.nombre],
                            ] as [string, string][]).map(([l, v]) => v ? (
                                <div key={l} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                                    <span className="text-sm text-gray-500">{l}</span>
                                    <span className="text-sm font-medium text-gray-800 text-right max-w-[220px]">{v}</span>
                                </div>
                            ) : null)}
                        </div>
                        <button onClick={() => setDetalle(null)}
                            className="mt-5 w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer">
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
