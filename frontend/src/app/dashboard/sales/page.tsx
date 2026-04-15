"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import {
    Search, Plus, X, UserCircle2, Calendar, ChevronRight,
    AlertCircle, ChevronLeft, SlidersHorizontal, ChevronDown,
    TrendingDown, ShoppingCart, Coffee, AlertTriangle,
    MinusCircle, UserX, HelpCircle, Pencil,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

// ── Tooltip de ayuda ──────────────────────────────────────────────────────────
function KpiTooltip({ text }: { text: string }) {
    const [visible, setVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    return (
        <div ref={ref} className="relative inline-flex items-center">
            <button
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onClick={() => setVisible(v => !v)}
                className="text-gray-300 hover:text-gray-400 transition-colors cursor-pointer ml-1"
                aria-label="Más información"
            >
                <HelpCircle size={13}/>
            </button>
            {visible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                                w-52 bg-gray-900 text-white text-xs rounded-lg px-3 py-2
                                shadow-xl leading-relaxed pointer-events-none">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2
                                    border-4 border-transparent border-t-gray-900"/>
                </div>
            )}
        </div>
    );
}

// ── Interfaces ────────────────────────────────────────────────────────────────
interface DetalleConsumo {
    id: string;
    productoId: string;
    producto: { nombre: string; sku: string; unidad: string };
    cantidad: number;
    precioUnitario: number | string;
}

interface Consumo {
    id: string;
    tipo: string;
    referencia: string | null;
    fecha: string;
    clienteNombre: string | null;
    esFormal: boolean;
    usuario: { nombre?: string; email?: string } | null;
    detalles: DetalleConsumo[];
}

// ── Config visual por tipo ────────────────────────────────────────────────────
// AJUSTE_POSITIVO se excluye de esta página completamente.
const tipoConfig: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    VENTA:           { label: 'Consumo interno',          cls: 'bg-blue-100 text-blue-700',     Icon: ShoppingCart  },
    CONSUMO_INTERNO: { label: 'Consumo interno', cls: 'bg-amber-100 text-amber-700',   Icon: Coffee        },
    PERDIDA:         { label: 'Pérdida / Merma', cls: 'bg-red-100 text-red-600',       Icon: AlertTriangle },
    AJUSTE_NEGATIVO: { label: 'Ajuste (−)',       cls: 'bg-purple-100 text-purple-700', Icon: MinusCircle   },
};

const getTipoConfig = (tipo: string) =>
    tipoConfig[tipo] ?? { label: tipo, cls: 'bg-gray-100 text-gray-600', Icon: TrendingDown };

// Tipos que SÍ se muestran en esta página (sin AJUSTE_POSITIVO)
const TIPOS_VISIBLES = ['CONSUMO_INTERNO', 'CONSUMO_INTERNO', 'PERDIDA', 'AJUSTE_NEGATIVO'];

const PAGE_SIZE = 20;

type SortKey = 'fecha' | 'total' | 'referencia' | 'tipo';
type SortDir  = 'asc' | 'desc';

function calcTotal(s: Consumo) {
    return s.detalles?.reduce((sum, d) => sum + Number(d.precioUnitario) * d.cantidad, 0) ?? 0;
}

function sortConsumos(list: Consumo[], key: SortKey, dir: SortDir): Consumo[] {
    return [...list].sort((a, b) => {
        let va: any, vb: any;
        if      (key === 'fecha') { va = new Date(a.fecha).getTime(); vb = new Date(b.fecha).getTime(); }
        else if (key === 'total') { va = calcTotal(a);                vb = calcTotal(b);                }
        else if (key === 'tipo')  { va = a.tipo ?? '';                vb = b.tipo ?? '';                }
        else                      { va = a.referencia ?? '';          vb = b.referencia ?? '';          }
        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ?  1 : -1;
        return 0;
    });
}

// ── Componente principal ──────────────────────────────────────────────────────
function SalesPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [todasConsumos, setTodasConsumos] = useState<Consumo[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState('');
    const [detalle,      setDetalle]      = useState<Consumo | null>(null);
    const [page,         setPage]         = useState(1);
    const [showFiltros,  setShowFiltros]  = useState(false);

    const [busqueda,       setBusqueda]       = useState('');
    const [filtroTipo,     setFiltroTipo]     = useState<string>('todos');
    const [filtroDesde,    setFiltroDesde]    = useState('');
    const [filtroHasta,    setFiltroHasta]    = useState('');
    const [filtroMontoMin, setFiltroMontoMin] = useState('');
    const [filtroMontoMax, setFiltroMontoMax] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('fecha');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // ── Leer filtros desde URL (ej: ?desde=2026-03-01&hasta=2026-03-28&tipo=VENTA) ──
    useEffect(() => {
        const desde = searchParams.get('desde');
        const hasta = searchParams.get('hasta');
        const tipo  = searchParams.get('tipo');
        if (desde) setFiltroDesde(desde);
        if (hasta) setFiltroHasta(hasta);
        if (tipo)  setFiltroTipo(tipo);
        if (desde || hasta || tipo) setShowFiltros(true);
    }, [searchParams]);

    useEffect(() => {
        fetchApi('/sales')
            .then((data: Consumo[]) => {
                // Filtrar AJUSTE_POSITIVO — no pertenece a esta página
                setTodasConsumos(data.filter(s => TIPOS_VISIBLES.includes(s.tipo)));
            })
            .catch((err: any) => setError(err.message || 'Error al cargar consumos'))
            .finally(() => setLoading(false));
    }, []);

    const consumosFiltradas = useMemo(() => {
        let result = todasConsumos.filter(s => {
            if (busqueda.trim()) {
                const q = busqueda.toLowerCase();
                const match =
                    (s.referencia    || '').toLowerCase().includes(q) ||
                    (s.clienteNombre || '').toLowerCase().includes(q) ||
                    s.detalles?.some(d =>
                        d.producto?.nombre?.toLowerCase().includes(q) ||
                        d.producto?.sku?.toLowerCase().includes(q)
                    );
                if (!match) return false;
            }
            if (filtroTipo !== 'todos' && s.tipo !== filtroTipo) return false;
            if (filtroDesde && new Date(s.fecha) < new Date(filtroDesde))               return false;
            if (filtroHasta && new Date(s.fecha) > new Date(filtroHasta + 'T23:59:59')) return false;
            const total = calcTotal(s);
            if (filtroMontoMin && total < Number(filtroMontoMin)) return false;
            if (filtroMontoMax && total > Number(filtroMontoMax)) return false;
            return true;
        });
        return sortConsumos(result, sortKey, sortDir);
    }, [todasConsumos, busqueda, filtroTipo, filtroDesde, filtroHasta, filtroMontoMin, filtroMontoMax, sortKey, sortDir]);

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const kpiTotal     = consumosFiltradas.reduce((a, s) => a + calcTotal(s), 0);
    const kpiCount     = consumosFiltradas.length;
    const mesActual    = new Date().getMonth();
    const kpiMes       = consumosFiltradas.filter(s => new Date(s.fecha).getMonth() === mesActual).length;
    const kpiPromedio  = kpiCount > 0 ? kpiTotal / kpiCount : 0;
    const kpiVentas    = consumosFiltradas.filter(s => s.tipo === 'CONSUMO_INTERNO').length;
    const kpiPerdidas  = consumosFiltradas.filter(s => s.tipo === 'PERDIDA').length;
    const kpiAjusteNeg = consumosFiltradas.filter(s => s.tipo === 'AJUSTE_NEGATIVO').length;

    const totalPages = Math.max(1, Math.ceil(consumosFiltradas.length / PAGE_SIZE));
    const consumosPag = consumosFiltradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const hayFiltros =
        filtroTipo !== 'todos' || !!filtroDesde || !!filtroHasta || !!filtroMontoMin || !!filtroMontoMax;

    const resetFiltros = () => {
        setBusqueda(''); setFiltroTipo('todos'); setFiltroDesde(''); setFiltroHasta('');
        setFiltroMontoMin(''); setFiltroMontoMax(''); setPage(1);
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
        setPage(1);
    };

    const SortIcon = ({ col }: { col: SortKey }) => (
        <span className={`ml-1 text-xs ${sortKey === col ? 'text-orange-500' : 'text-gray-300'}`}>
            {sortKey === col ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
        </span>
    );

    // Conteo por tipo para los tabs (solo tipos visibles)
    const tiposCounts = useMemo(() => {
        const counts: Record<string, number> = { todos: todasConsumos.length };
        todasConsumos.forEach(s => { counts[s.tipo] = (counts[s.tipo] || 0) + 1; });
        return counts;
    }, [todasConsumos]);

    const tabsVisibles = [
        { key: 'todos',           label: 'Todas'           },
        { key: 'CONSUMO_INTERNO',           label: 'Consumos'         },
        { key: 'CONSUMO_INTERNO', label: 'Consumo interno' },
        { key: 'PERDIDA',         label: 'Pérdidas'        },
        { key: 'AJUSTE_NEGATIVO', label: 'Ajuste (−)'      },
    ].filter(t => t.key === 'todos' || (tiposCounts[t.key] ?? 0) > 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Salidas de Insumos</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Registra salidas de inventario, consumos internos, mermas o ajustes negativos.
                    </p>
                </div>
                <Link href="/dashboard/sales/new"
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700
                               text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                    <Plus size={16}/> Registrar Salida
                </Link>
            </div>

            {/* ── KPIs ───────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

                {/* Salidas totales */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1 flex items-center">
                        Salidas totales
                        <KpiTooltip text="Total de registros: salidas, consumos internos, mermas y ajustes negativos." />
                    </p>
                    <p className="text-2xl font-bold text-gray-800">{kpiCount}</p>
                    <p className="text-xs text-gray-400 mt-1">{kpiMes} este mes</p>
                </div>

                {/* Total despachado */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1 flex items-center">
                        Total despachado
                        <KpiTooltip text="Suma del valor de todas las salidas según el precio unitario registrado." />
                    </p>
                    <p className="text-2xl font-bold text-gray-800">
                        ${kpiTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{hayFiltros ? 'en selección' : 'todas las salidas'}</p>
                </div>

                {/* Ticket promedio */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1 flex items-center">
                        Ticket promedio
                        <KpiTooltip text="Total despachado dividido entre el número de salidas registradas." />
                    </p>
                    <p className="text-2xl font-bold text-gray-800">
                        ${kpiPromedio.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">por consumo</p>
                </div>

                {/* Consumos + Ajustes negativos */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-500 mb-1 flex items-center">
                        Consumos / Ajustes (−)
                        <KpiTooltip text="Consumos: movimientos por venta. Ajustes (−): correcciones manuales que reducen el stock sin ser una venta." />
                    </p>
                    <div className="flex items-baseline gap-3 mt-0.5">
                        <span className="text-2xl font-bold text-blue-600">{kpiVentas}</span>
                        <span className="text-gray-300 text-lg">/</span>
                        <span className="text-2xl font-bold text-purple-600">{kpiAjusteNeg}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{kpiPerdidas} pérdidas / mermas</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 flex items-center gap-2">
                    <AlertCircle size={16}/> {error}
                </div>
            )}

            {/* ── Tabla ──────────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Barra superior */}
                <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[220px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={e => { setBusqueda(e.target.value); setPage(1); }}
                            placeholder="Referencia, cliente o producto..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                                       focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                        {busqueda && (
                            <button onClick={() => { setBusqueda(''); setPage(1); }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={13}/>
                            </button>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex flex-wrap rounded-lg border border-gray-200 overflow-hidden text-xs">
                        {tabsVisibles.map(t => (
                            <button key={t.key}
                                onClick={() => { setFiltroTipo(t.key); setPage(1); }}
                                className={`px-3 py-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5
                                    ${filtroTipo === t.key
                                        ? 'bg-gray-800 text-white'
                                        : 'hover:bg-gray-50 text-gray-600'}`}>
                                {t.label}
                                {(tiposCounts[t.key] ?? 0) > 0 && (
                                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium
                                        ${filtroTipo === t.key
                                            ? 'bg-white/20 text-white'
                                            : 'bg-gray-100 text-gray-500'}`}>
                                        {tiposCounts[t.key]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Filtros avanzados */}
                    <button
                        onClick={() => setShowFiltros(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors cursor-pointer
                            ${showFiltros || hayFiltros
                                ? 'bg-orange-50 border-orange-200 text-orange-600'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        <SlidersHorizontal size={13}/>
                        Filtros
                        {hayFiltros && (
                            <span className="bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                                {[!!filtroDesde, !!filtroHasta, !!filtroMontoMin, !!filtroMontoMax].filter(Boolean).length}
                            </span>
                        )}
                        <ChevronDown size={12} className={`transition-transform ${showFiltros ? 'rotate-180' : ''}`}/>
                    </button>

                    <p className="text-sm text-gray-400 whitespace-nowrap ml-auto">
                        {consumosFiltradas.length} {consumosFiltradas.length === 1 ? 'resultado' : 'resultados'}
                        {(busqueda || hayFiltros) && (
                            <button onClick={resetFiltros}
                                className="ml-2 text-orange-500 hover:text-orange-700 underline cursor-pointer">
                                limpiar
                            </button>
                        )}
                    </p>
                </div>

                {/* Panel filtros avanzados */}
                {showFiltros && (
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Desde</label>
                            <input type="date" value={filtroDesde}
                                onChange={e => { setFiltroDesde(e.target.value); setPage(1); }}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white
                                           focus:outline-none focus:ring-2 focus:ring-orange-500/20"/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Hasta</label>
                            <input type="date" value={filtroHasta}
                                onChange={e => { setFiltroHasta(e.target.value); setPage(1); }}
                                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white
                                           focus:outline-none focus:ring-2 focus:ring-orange-500/20"/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Monto mínimo</label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                <input type="number" min="0" placeholder="0" value={filtroMontoMin}
                                    onChange={e => { setFiltroMontoMin(e.target.value); setPage(1); }}
                                    className="w-full pl-6 pr-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white
                                               focus:outline-none focus:ring-2 focus:ring-orange-500/20"/>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500">Monto máximo</label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                <input type="number" min="0" placeholder="Sin límite" value={filtroMontoMax}
                                    onChange={e => { setFiltroMontoMax(e.target.value); setPage(1); }}
                                    className="w-full pl-6 pr-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white
                                               focus:outline-none focus:ring-2 focus:ring-orange-500/20"/>
                            </div>
                        </div>
                        {hayFiltros && (
                            <div className="flex items-end col-span-2">
                                <button onClick={resetFiltros}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-600
                                               border border-gray-200 hover:border-red-200 rounded-lg bg-white transition-colors cursor-pointer">
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
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider
                                               cursor-pointer hover:text-gray-600 select-none"
                                    onClick={() => handleSort('referencia')}>
                                    Referencia <SortIcon col="referencia"/>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider
                                               cursor-pointer hover:text-gray-600 select-none"
                                    onClick={() => handleSort('tipo')}>
                                    Tipo <SortIcon col="tipo"/>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider
                                               cursor-pointer hover:text-gray-600 select-none"
                                    onClick={() => handleSort('fecha')}>
                                    Fecha <SortIcon col="fecha"/>
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Cliente
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Productos
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider
                                               cursor-pointer hover:text-gray-600 select-none"
                                    onClick={() => handleSort('total')}>
                                    Total <SortIcon col="total"/>
                                </th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                                        Cargando salidas...
                                    </td>
                                </tr>
                            ) : consumosPag.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <TrendingDown size={32} className="mx-auto text-gray-300 mb-2"/>
                                        <p className="text-gray-500 font-medium">
                                            {busqueda || hayFiltros
                                                ? 'Sin resultados para estos filtros'
                                                : 'No hay salidas registradas'}
                                        </p>
                                        {(busqueda || hayFiltros) && (
                                            <button onClick={resetFiltros}
                                                className="mt-2 text-sm text-orange-500 hover:underline cursor-pointer">
                                                Limpiar filtros
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                consumosPag.map(consumo => {
                                    const tc         = getTipoConfig(consumo.tipo);
                                    const total      = calcTotal(consumo);
                                    const totalItems = consumo.detalles?.reduce((a, d) => a + d.cantidad, 0) ?? 0;
                                    const sinCliente = consumo.tipo === 'CONSUMO_INTERNO' && !consumo.clienteNombre;

                                    return (
                                        <tr key={consumo.id}
                                            onClick={() => setDetalle(consumo)}
                                            className="hover:bg-orange-50/30 transition-colors cursor-pointer group">

                                            {/* Referencia */}
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-bold text-gray-800
                                                                 group-hover:text-orange-600 transition-colors">
                                                    {consumo.referencia || '—'}
                                                </span>
                                            </td>

                                            {/* Tipo con ícono */}
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1
                                                                  text-xs font-semibold rounded-full ${tc.cls}`}>
                                                    <tc.Icon size={11}/>
                                                    {tc.label}
                                                </span>
                                            </td>

                                            {/* Fecha */}
                                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                {new Date(consumo.fecha).toLocaleDateString('es-MX', {
                                                    day: '2-digit', month: 'short', year: 'numeric'
                                                })}
                                            </td>

                                            {/* Cliente */}
                                            <td className="px-4 py-3 text-sm">
                                                {consumo.clienteNombre ? (
                                                    <span className="font-medium text-gray-700">
                                                        {consumo.clienteNombre}
                                                    </span>
                                                ) : sinCliente ? (
                                                    <span className="inline-flex items-center gap-1 text-orange-500
                                                                     text-xs font-medium">
                                                        <UserX size={13}/>
                                                        Sin cliente
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>

                                            {/* Productos */}
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {consumo.detalles?.length ?? 0}{' '}
                                                {consumo.detalles?.length === 1 ? 'producto' : 'productos'}{' '}
                                                · {totalItems} uds
                                            </td>

                                            {/* Total */}
                                            <td className="px-4 py-3 text-sm font-bold text-gray-800">
                                                {total > 0
                                                    ? `$${total.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
                                                    : <span className="text-gray-400 font-normal">—</span>
                                                }
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                <ChevronRight size={16}
                                                    className="text-gray-300 group-hover:text-orange-400 transition-colors"/>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            Página {page} de {totalPages} · {consumosFiltradas.length} resultados
                        </p>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50
                                           disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                                <ChevronLeft size={14}/>
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const p = totalPages <= 5 ? i + 1
                                    : page <= 3              ? i + 1
                                    : page >= totalPages - 2 ? totalPages - 4 + i
                                    : page - 2 + i;
                                return (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={`w-7 h-7 text-xs rounded-lg border transition-colors cursor-pointer
                                            ${page === p
                                                ? 'bg-gray-800 text-white border-gray-800'
                                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                        {p}
                                    </button>
                                );
                            })}
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50
                                           disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                                <ChevronRight size={14}/>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal detalle ──────────────────────────────────────────── */}
            {detalle && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                     onClick={() => setDetalle(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                         onClick={e => e.stopPropagation()}>

                        {/* Header modal */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between
                                        sticky top-0 bg-white rounded-t-2xl z-10">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-lg font-bold text-gray-900">
                                    {detalle.referencia || 'Sin referencia'}
                                </span>
                                {(() => {
                                    const tc = getTipoConfig(detalle.tipo);
                                    return (
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5
                                                          text-xs font-semibold rounded-full ${tc.cls}`}>
                                            <tc.Icon size={11}/>
                                            {tc.label}
                                        </span>
                                    );
                                })()}
                            </div>
                            <button onClick={() => setDetalle(null)}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer flex-shrink-0">
                                <X size={18}/>
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            <div className="grid grid-cols-2 gap-3">
                                {/* Cliente */}
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                                        <UserCircle2 size={11}/> Cliente
                                    </p>
                                    {detalle.clienteNombre ? (
                                        <p className="text-sm font-semibold text-gray-800">{detalle.clienteNombre}</p>
                                    ) : detalle.tipo === 'CONSUMO_INTERNO' ? (
                                        <p className="text-sm text-orange-500 font-medium flex items-center gap-1">
                                            <UserX size={13}/> Sin cliente registrado
                                        </p>
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">N/A</p>
                                    )}
                                </div>
                                {/* Fecha */}
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                                        <Calendar size={11}/> Fecha
                                    </p>
                                    <p className="text-sm font-semibold text-gray-800">
                                        {new Date(detalle.fecha).toLocaleDateString('es-MX', { dateStyle: 'long' })}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {new Date(detalle.fecha).toLocaleTimeString('es-MX', {
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                        {detalle.usuario?.nombre && ` · ${detalle.usuario.nombre}`}
                                    </p>
                                </div>
                            </div>

                            {/* Productos */}
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                    Productos despachados
                                </p>
                                <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg overflow-hidden">
                                    {detalle.detalles?.map((d, i) => (
                                        <div key={d.id ?? i}
                                             className="flex items-center justify-between px-4 py-2.5">
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{d.producto?.nombre}</p>
                                                <p className="text-xs text-gray-400">
                                                    {d.producto?.sku} · {d.cantidad} {d.producto?.unidad}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                {Number(d.precioUnitario) > 0 ? (
                                                    <>
                                                        <p className="text-sm font-bold text-gray-800">
                                                            ${(Number(d.precioUnitario) * d.cantidad)
                                                                .toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            ${Number(d.precioUnitario).toLocaleString()} c/u
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-xs text-gray-400">Sin precio</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {calcTotal(detalle) > 0 && (
                                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                    <span className="text-sm font-semibold text-gray-700">Total despachado</span>
                                    <span className="text-xl font-bold text-gray-900">
                                        ${calcTotal(detalle).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="px-6 pb-5 flex gap-3">
                            <button onClick={() => setDetalle(null)}
                                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100
                                           hover:bg-gray-200 rounded-xl transition-colors cursor-pointer">
                                Cerrar
                            </button>
                            {detalle.esFormal && (
                                <button
                                    onClick={() => {
                                        setDetalle(null);
                                        router.push(`/dashboard/sales/new?editId=${detalle.id}`);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5
                                               text-sm font-semibold text-white bg-orange-600
                                               hover:bg-orange-700 rounded-xl transition-colors cursor-pointer">
                                    <Pencil size={14}/> Editar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SalesPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>}>
            <SalesPageInner />
        </Suspense>
    );
}
