"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { StockBarChart } from '@/components/dashboard/StockBarChart';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import { Card } from '@/components/ui/Card';
import {
    Search, Plus, Edit, Trash2, AlertTriangle, LayoutGrid, List,
    ChevronUp, ChevronDown, ChevronsUpDown, Download, Upload,
    ArrowUpCircle, ArrowDownCircle, X, Check, BarChart2, Filter,
    TrendingUp, Package, Zap,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useCompany } from '@/context/CompanyContext';
import Link from 'next/link';

// ── Helpers ───────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
    'Electrónicos': '#3b82f6', 'Periféricos': '#8b5cf6', 'Consumibles': '#f59e0b',
    'Accesorios': '#10b981', 'Ropa': '#ec4899', 'default': '#6b7280',
};
function getCatColor(cat: string) { return CATEGORY_COLORS[cat] || CATEGORY_COLORS['default']; }

// ── Doble moneda ──────────────────────────────────────────────────────────────
/**
 * Formatea un valor monetario mostrando:
 *   - El precio en la moneda del producto (ej: USD 12.50)
 *   - Su equivalente en la moneda base de la empresa (ej: ≈ $187 MXN)
 *
 * @param valor        Importe a mostrar
 * @param monedaDoc    Moneda en que está denominado el valor ('MXN' | 'USD')
 * @param monedaBase   Moneda base de la empresa (del contexto CompanyContext)
 * @param tipoCambio   Tipo de cambio USD→MXN (puede venir de ultimaEntrada.tipoCambio)
 * @param compact      Si true devuelve solo el string principal sin el equivalente
 */
function formatDualCurrency(
    valor: number,
    monedaDoc: 'MXN' | 'USD' | string,
    monedaBase: string,
    tipoCambio: number | null | undefined,
    compact = false
): { principal: string; equivalente: string | null } {
    const fmt = (v: number, currency: string) =>
        new Intl.NumberFormat('es-MX', {
            style: 'currency', currency, maximumFractionDigits: 2,
        }).format(v);

    const principal = fmt(valor, monedaDoc || monedaBase);

    if (compact || !tipoCambio || monedaDoc === monedaBase || !monedaDoc) {
        return { principal, equivalente: null };
    }

    // Convertir al moneda base
    let valorBase: number;
    if (monedaDoc === 'USD' && monedaBase === 'MXN') {
        valorBase = valor * tipoCambio;
    } else if (monedaDoc === 'MXN' && monedaBase === 'USD') {
        valorBase = valor / tipoCambio;
    } else {
        return { principal, equivalente: null };
    }

    return {
        principal,
        equivalente: `≈ ${fmt(valorBase, monedaBase)}`,
    };
}

/** Badge de moneda para mostrar junto al precio */
function CurrencyBadge({ moneda }: { moneda: string }) {
    if (!moneda || moneda === 'MXN') return null;
    return (
        <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 align-middle">
            {moneda}
        </span>
    );
}

/** Precio con doble moneda — inline para tablas/grillas */
function DualPrice({
    valor,
    monedaDoc,
    monedaBase,
    tipoCambio,
    className = '',
}: {
    valor: number | null | undefined;
    monedaDoc?: string;
    monedaBase: string;
    tipoCambio?: number | null;
    className?: string;
}) {
    if (valor == null || isNaN(Number(valor))) return <span className="text-gray-300">—</span>;
    const v = Number(valor);
    const { principal, equivalente } = formatDualCurrency(v, monedaDoc || monedaBase, monedaBase, tipoCambio);
    return (
        <span className={className}>
            {principal}
            {monedaDoc && monedaDoc !== monedaBase && <CurrencyBadge moneda={monedaDoc} />}
            {equivalente && (
                <span className="block text-xs text-gray-400 font-normal leading-tight">{equivalente}</span>
            )}
        </span>
    );
}

function ProductImage({ imagen, nombre, categoria, size = 40 }: { imagen?: string; nombre: string; categoria?: string; size?: number }) {
    const color = getCatColor(categoria || '');
    if (imagen) return <img src={imagen} alt={nombre} style={{ width: size, height: size, objectFit: 'cover', borderRadius: 8 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
    return (
        <div style={{ width: size, height: size, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: size * 0.45, fontWeight: 600, color }}>{nombre?.[0]?.toUpperCase() || '?'}</span>
        </div>
    );
}

// ── Mini stock bar ────────────────────────────────────────────────────────────
function StockBar({ stock, stockMinimo }: { stock: number; stockMinimo: number }) {
    const max = Math.max(stockMinimo * 2, stock, 1);
    const pct = Math.min((stock / max) * 100, 100);
    const color = stock === 0 ? '#dc2626' : stock <= stockMinimo ? '#ea580c' : '#16a34a';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 48, height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color }}>{stock}</span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>/ {stockMinimo}</span>
        </div>
    );
}

function StockBadge({ stock, stockMinimo }: { stock: number; stockMinimo: number }) {
    if (stock === 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><AlertTriangle size={10} /> Sin stock</span>;
    if (stock <= stockMinimo) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700"><AlertTriangle size={10} /> Bajo mín.</span>;
    return null;
}

type SortKey = 'nombre' | 'sku' | 'stock' | 'precioCompra';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
    if (col !== sortKey) return <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-blue-500 ml-1 inline" /> : <ChevronDown size={12} className="text-blue-500 ml-1 inline" />;
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
            {label}
            <button onClick={onRemove} className="p-0.5 hover:bg-blue-200 rounded-full transition-colors"><X size={11} /></button>
        </span>
    );
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState('');
    const [err, setErr] = useState('');

    const parseCSV = (text: string) => {
        const lines = text.trim().split('\n').filter(l => l.trim());
        if (lines.length < 2) { setErr('El archivo debe tener encabezados y al menos una fila.'); return; }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s/g, ''));
        const parsed = lines.slice(1).map(line => {
            const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const obj: any = {};
            headers.forEach((h, i) => obj[h] = vals[i] || '');
            return obj;
        }).filter(r => r.nombre || r.sku);
        setRows(parsed); setErr('');
    };

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = e => parseCSV(e.target?.result as string);
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (rows.length === 0) return;
        setImporting(true); setErr('');
        let ok = 0, fail = 0;
        for (const row of rows) {
            try {
                await fetchApi('/products', {
                    method: 'POST',
                    body: JSON.stringify({
                        sku: row.sku || `IMP-${Date.now()}`,
                        nombre: row.nombre,
                        unidad: row.unidad || 'litro',
                        precioCompra: Number(row.costounitario || row.preciocompra || row['costo unitario'] || row.costo || 0),
                        stockMinimo: Number(row.stockminimo || row['stock minimo'] || row.minimo || 5),
                        moneda: (row.moneda || 'MXN').toUpperCase(),
                    }),
                });
                ok++;
            } catch { fail++; }
        }
        setResult(`${ok} insumos importados${fail > 0 ? `, ${fail} fallaron` : ' correctamente'}.`);
        setImporting(false);
        if (ok > 0) setTimeout(() => { onDone(); }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <p className="font-semibold text-gray-800">Importar insumos desde CSV</p>
                        <p className="text-xs text-gray-400 mt-0.5">Columnas: sku, nombre, unidad, costounitario, stockminimo, moneda</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
                </div>
                <button onClick={() => {
                    const csv = 'sku,nombre,unidad,costounitario,stockminimo,moneda\nPRD-001,Insumo ejemplo,litro,100,5,MXN\nPRD-002,Insumo USD,pieza,12.50,3,USD';
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_insumos.csv'; a.click();
                }} className="flex items-center gap-2 text-xs text-blue-500 hover:underline mb-4">
                    <Download size={13} /> Descargar plantilla CSV
                </button>
                <div onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                    onDragOver={e => e.preventDefault()} onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all mb-4">
                    <Upload size={24} className="text-gray-400" />
                    <p className="text-sm text-gray-500">Haz clic o arrastra tu archivo CSV</p>
                    {rows.length > 0 && <p className="text-xs text-green-600 font-medium">{rows.length} insumos listos para importar</p>}
                </div>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                {err && <p className="text-xs text-red-500 mb-3">{err}</p>}
                {result && <p className="text-xs text-green-600 mb-3 font-medium">{result}</p>}
                {rows.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
                        <p className="text-xs font-semibold text-gray-500 mb-2">Vista previa:</p>
                        {rows.slice(0, 5).map((r, i) => (
                            <div key={i} className="text-xs text-gray-600 py-1 border-b border-gray-100 last:border-0">
                                <span className="font-mono text-gray-400 mr-2">{r.sku}</span>{r.nombre} · {r.unidad || 'pieza'} · ${r.costounitario || 0}
                                {r.moneda && r.moneda !== 'MXN' && (
                                    <span className="ml-1 text-[10px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-600">{r.moneda}</span>
                                )}
                            </div>
                        ))}
                        {rows.length > 5 && <p className="text-xs text-gray-400 mt-1">...y {rows.length - 5} más</p>}
                    </div>
                )}
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleImport} disabled={rows.length === 0 || importing}
                        className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50">
                        {importing ? 'Importando...' : `Importar ${rows.length} insumos`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── MEJORA 1: Banner de alerta inteligente ────────────────────────────────────
function AlertBanner({ productos, onFilter }: { productos: any[]; onFilter: () => void }) {
    const criticos = productos.filter(p => p.stock === 0);
    const bajos = productos.filter(p => p.stock > 0 && p.stock <= p.stockMinimo);
    const total = criticos.length + bajos.length;
    if (total === 0) return null;

    const nombres = [...criticos, ...bajos].slice(0, 3).map(p => p.nombre).join(', ');
    const hayMas = total > 3;

    return (
        <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-xl px-5 py-3.5">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                    <AlertTriangle size={16} className="text-red-600" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-red-700">
                        {criticos.length > 0 && `${criticos.length} sin stock`}
                        {criticos.length > 0 && bajos.length > 0 && ' · '}
                        {bajos.length > 0 && `${bajos.length} bajo mínimo`}
                        {' — requieren atención'}
                    </p>
                    <p className="text-xs text-red-500 mt-0.5">
                        {nombres}{hayMas ? ` y ${total - 3} más` : ''}
                    </p>
                </div>
            </div>
            <button
                onClick={onFilter}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
            >
                <Filter size={13} /> Ver críticos
            </button>
        </div>
    );
}

// ── MEJORA 3: Acciones rápidas ────────────────────────────────────────────────
function QuickActions() {
    return (
        <div className="grid grid-cols-3 gap-3">
            <Link href="/dashboard/purchases/new"
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-green-200 transition-all group">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 group-hover:bg-green-100 transition-colors">
                    <ArrowUpCircle size={18} className="text-green-600" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-800">Registrar entrada</p>
                    <p className="text-xs text-gray-400 mt-0.5">Compra o abastecimiento</p>
                </div>
            </Link>
            <Link href="/dashboard/sales/new"
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-orange-200 transition-all group">
                <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-100 transition-colors">
                    <ArrowDownCircle size={18} className="text-orange-500" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-800">Registrar consumo</p>
                    <p className="text-xs text-gray-400 mt-0.5">Salida hacia obra</p>
                </div>
            </Link>
            <Link href="/dashboard/inventory"
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                    <TrendingUp size={18} className="text-blue-600" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-800">Ver movimientos</p>
                    <p className="text-xs text-gray-400 mt-0.5">Kardex completo</p>
                </div>
            </Link>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function ProductsPageInner() {
    const [products, setProducts]       = useState<any[]>([]);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState('');
    const [search, setSearch]           = useState('');
    const [filterCat, setFilterCat]     = useState('Todas');
    const [filterStock, setFilterStock] = useState('Todos');
    const [filterSinMovimiento, setFilterSinMovimiento] = useState(false);
    const [sinMovimientoDesde, setSinMovimientoDesde] = useState('');
    const [sinMovimientoHasta, setSinMovimientoHasta] = useState('');
    const [view, setView]               = useState<'list' | 'grid'>('list');
    const [showStockModal, setShowStockModal] = useState(false);
    const [showTendencia, setShowTendencia]   = useState(false);
    const [allMovements, setAllMovements]     = useState<any[]>([]);
    const [sortKey, setSortKey]   = useState<SortKey>('nombre');
    const [sortDir, setSortDir]   = useState<SortDir>('asc');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [showImport, setShowImport] = useState(false);

    // ── Moneda base de la empresa ──────────────────────────────────────────────
    const { moneda: monedaBase, tipoCambio: tcGlobal } = useCompany();

    const searchParams = useSearchParams();

    useEffect(() => {
        if (searchParams.get('stock') === 'bajo')    setFilterStock('Bajo mínimo');
        if (searchParams.get('stock') === 'sinStock') setFilterStock('Sin stock');
        if (searchParams.get('sinMovimiento') === '1') {
            setFilterSinMovimiento(true);
            const desde = searchParams.get('desde');
            const hasta = searchParams.get('hasta');
            if (desde) setSinMovimientoDesde(desde);
            if (hasta) setSinMovimientoHasta(hasta);
        }
    }, [searchParams]);

    const loadProducts = async () => {
        setLoading(true);
        Promise.all([fetchApi('/products'), fetchApi('/inventory/movements')])
            .then(([prods, movs]) => { setProducts(prods); setAllMovements(movs); })
            .catch(err => setError(err.message || 'Error al cargar'))
            .finally(() => setLoading(false));
    };
    useEffect(() => { loadProducts(); }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar "${name}"?`)) return;
        try { await fetchApi(`/products/${id}`, { method: 'DELETE' }); setProducts(p => p.filter(x => x.id !== id)); }
        catch (err: any) { alert(err.message || 'Error al eliminar'); }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const toggleSelect = (id: string) => setSelected(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });
    const toggleAll = () => setSelected(prev => prev.size === sorted.length ? new Set() : new Set(sorted.map(p => p.id)));

    const clearAllFilters = () => {
        setSearch(''); setFilterCat('Todas'); setFilterStock('Todos');
        setFilterSinMovimiento(false); setSinMovimientoDesde(''); setSinMovimientoHasta('');
    };
    const hayFiltrosActivos = search !== '' || filterCat !== 'Todas' || filterStock !== 'Todos' || filterSinMovimiento;

    const handleFilterCriticos = () => {
        clearAllFilters();
        setFilterStock('Bajo mínimo');
    };

    const exportCSV = () => {
        const toExport = selected.size > 0 ? sorted.filter(p => selected.has(p.id)) : sorted;
        const header = 'SKU,Nombre,Categoría,Stock,Moneda,Costo Unitario,Tipo Cambio,Valor Almacén (base),Nivel Reorden';
        const rows = toExport.map(p => {
            const monedaDoc = p.moneda || monedaBase;
            const tc = p.ultimaEntrada?.tipoCambio ?? null;
            const costo = Number(p.ultimoPrecioCompra ?? 0);
            // Valor en moneda base
            let valorBase = p.stock * costo;
            if (monedaDoc === 'USD' && monedaBase === 'MXN' && tc) valorBase = p.stock * costo * tc;
            else if (monedaDoc === 'MXN' && monedaBase === 'USD' && tc) valorBase = p.stock * costo / tc;
            return [
                p.sku, `"${p.nombre}"`, p.categoria?.nombre || '',
                p.stock, monedaDoc, costo,
                tc ?? '',
                valorBase.toFixed(0),
                p.stockMinimo,
            ].join(',');
        });
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `insumos_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    };

    // ── Filtered & Sorted ─────────────────────────────────────────────────────
    const categories = ['Todas', ...Array.from(new Set(products.map(p => p.categoria?.nombre).filter(Boolean)))];

    const filtered = products.filter(p => {
        const q = search.toLowerCase();
        const matchSearch = !search || p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.categoria?.nombre || '').toLowerCase().includes(q);
        const matchCat    = filterCat === 'Todas' || p.categoria?.nombre === filterCat;
        const matchStock  = filterStock === 'Todos' || (filterStock === 'Bajo mínimo' && p.stock <= p.stockMinimo) || (filterStock === 'Sin stock' && p.stock === 0);
        let matchSinMov = true;
        if (filterSinMovimiento) {
            const desde = sinMovimientoDesde ? new Date(sinMovimientoDesde + 'T00:00:00') : new Date(0);
            const hasta = sinMovimientoHasta ? new Date(sinMovimientoHasta + 'T23:59:59') : new Date();
            const tuvMov = allMovements.some(m => m.productoId === p.id && new Date(m.fecha) >= desde && new Date(m.fecha) <= hasta);
            matchSinMov = !tuvMov;
        }
        return matchSearch && matchCat && matchStock && matchSinMov;
    });

    const sorted = [...filtered].sort((a, b) => {
        let va: any, vb: any;
        if (sortKey === 'stock')            { va = a.stock ?? 0; vb = b.stock ?? 0; }
        else if (sortKey === 'precioCompra') { va = Number(a.ultimoPrecioCompra ?? 0); vb = Number(b.ultimoPrecioCompra ?? 0); }
        else { va = (a[sortKey] || '').toLowerCase(); vb = (b[sortKey] || '').toLowerCase(); }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    // ── KPIs ─────────────────────────────────────────────────────────────────
    // Valor almacén = Σ(stock_actual × último_costo) de productos FILTRADOS, en moneda base.
    // TC preferido: el del último movimiento registrado; fallback: TC global de la empresa.
    const totalValor = filtered.reduce((a, p) => {
        const stock = Number(p.stock ?? 0);
        const costo = Number(p.ultimoPrecioCompra ?? 0);
        if (stock <= 0 || costo <= 0) return a;
        const monedaDoc = (p.moneda || monedaBase) as string;
        const tc = (p.ultimaEntrada as any)?.tipoCambio ?? tcGlobal;
        let costoBase = costo;
        if (monedaDoc === 'USD' && monedaBase === 'MXN') {
            costoBase = tc > 0 ? costo * tc : costo;
        } else if (monedaDoc === 'MXN' && monedaBase === 'USD') {
            costoBase = tc > 0 ? costo / tc : costo;
        }
        return a + stock * costoBase;
    }, 0);

    // Costo prom. unitario normalizado a moneda base (usa tcGlobal si no hay TC por movimiento)
    const costoPromUnitario = (() => {
        const conPrecio = filtered.filter(p => p.ultimoPrecioCompra);
        if (conPrecio.length === 0) return 0;
        const suma = conPrecio.reduce((a, p) => {
            const costo = Number(p.ultimoPrecioCompra ?? 0);
            const monedaDoc = (p.moneda || monedaBase) as string;
            const tc = (p.ultimaEntrada as any)?.tipoCambio ?? tcGlobal;
            let costoBase = costo;
            if (monedaDoc === 'USD' && monedaBase === 'MXN') costoBase = tc > 0 ? costo * tc : costo;
            else if (monedaDoc === 'MXN' && monedaBase === 'USD') costoBase = tc > 0 ? costo / tc : costo;
            return a + costoBase;
        }, 0);
        return suma / conPrecio.length;
    })();

    const bajosStock = filtered.filter(p => p.stock <= p.stockMinimo).length;

    const hace30d = new Date(Date.now() - 30 * 86400000);
    const consumo30d = allMovements
        .filter(m => ['SALIDA', 'CONSUMO_INTERNO', 'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento) && new Date(m.fecha) >= hace30d)
        .reduce((a, m) => {
            const tc = m.tipoCambio ?? 1;
            const monedaDoc = m.moneda || monedaBase;
            let costoBase = Number(m.costoUnitario || 0);
            if (monedaDoc === 'USD' && monedaBase === 'MXN') costoBase *= tc;
            else if (monedaDoc === 'MXN' && monedaBase === 'USD') costoBase = tc > 0 ? costoBase / tc : costoBase;
            return a + Number(m.cantidad || 0) * costoBase;
        }, 0);

    // ── Formateador moneda base ───────────────────────────────────────────────
    const fmtBase = (v: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: monedaBase, maximumFractionDigits: 0 }).format(v);

    // ── Category stats ────────────────────────────────────────────────────────
    // Distribución por categoría — usa `filtered` + tcGlobal como fallback de conversión
    const catStats = Array.from(new Set(filtered.map(p => p.categoria?.nombre).filter(Boolean))).map(cat => {
        const prods = filtered.filter(p => p.categoria?.nombre === cat);
        const valor = prods.reduce((a, p) => {
            const costo = Number(p.ultimoPrecioCompra ?? 0);
            const tc = (p.ultimaEntrada as any)?.tipoCambio ?? tcGlobal;
            const monedaDoc = (p.moneda || monedaBase) as string;
            let costoBase = costo;
            if (monedaDoc === 'USD' && monedaBase === 'MXN') costoBase = tc > 0 ? costo * tc : costo;
            else if (monedaDoc === 'MXN' && monedaBase === 'USD') costoBase = tc > 0 ? costo / tc : costo;
            return a + (Number(p.stock ?? 0) * costoBase);
        }, 0);
        return { cat, count: prods.length, valor };
    }).sort((a, b) => b.valor - a.valor);
    const maxCatValor = catStats.length > 0 ? catStats[0].valor : 1;

    const filteredProductIds = new Set(filtered.map(p => p.id));
    const filteredMovements  = filterCat === 'Todas'
        ? allMovements
        : allMovements.filter(m => filteredProductIds.has(m.productoId));

    const consumo30dPorProducto = (productoId: string) => {
        return allMovements
            .filter(m => m.productoId === productoId && ['SALIDA', 'CONSUMO_INTERNO'].includes(m.tipoMovimiento) && new Date(m.fecha) >= hace30d)
            .reduce((a, m) => a + Number(m.cantidad || 0), 0);
    };

    const thClass = (key: SortKey) =>
        `p-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-blue-600 transition-colors whitespace-nowrap ${sortKey === key ? 'text-blue-600' : 'text-gray-400'}`;

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Insumos</h1>
                    <p className="text-sm text-gray-500 mt-1">Catálogo de insumos y materiales consumidos en obra.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
                        <Upload size={15} /> Importar CSV
                    </button>
                    <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
                        <Download size={15} /> {selected.size > 0 ? `Exportar (${selected.size})` : 'Exportar CSV'}
                    </button>
                    <Link href="/dashboard/products/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                        <Plus size={16} /> Nuevo Insumo
                    </Link>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            {!loading && (
                <AlertBanner productos={products} onFilter={handleFilterCriticos} />
            )}

            {!loading && <QuickActions />}

            {/* ── KPIs ─────────────────────────────────────────────────── */}
            {!loading && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1 mb-1">
                            <p className="text-xs text-gray-400">Insumos</p>
                            <InfoTooltip text="SKUs visibles según los filtros aplicados." position="bottom" />
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{filtered.length}</p>
                        <p className="text-xs text-gray-400 mt-1">de {products.length} totales</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1 mb-1">
                            <p className="text-xs text-gray-400">Valor almacén ({monedaBase})</p>
                            <InfoTooltip text="Stock actual × último precio de compra por insumo. Convertido a moneda base de la empresa." position="bottom" />
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{fmtBase(totalValor)}</p>
                        <p className="text-xs text-gray-400 mt-1">normalizado a {monedaBase}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1 mb-1">
                            <p className="text-xs text-gray-400">Costo prom. unitario ({monedaBase})</p>
                            <InfoTooltip text={`Promedio del último costo de compra convertido a ${monedaBase}. Usa tipo de cambio del último movimiento o el TC global de la empresa.`} position="bottom" />
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{fmtBase(costoPromUnitario)}</p>
                        <p className="text-xs text-gray-400 mt-1">normalizado a {monedaBase}</p>
                    </div>

                    <button
                        onClick={() => setFilterStock(filterStock === 'Bajo mínimo' ? 'Todos' : 'Bajo mínimo')}
                        className={`rounded-xl border shadow-sm p-4 text-left transition-all hover:shadow-md ${bajosStock > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'} ${filterStock === 'Bajo mínimo' ? 'ring-2 ring-red-400' : ''}`}
                    >
                        <div className="flex items-center gap-1 mb-1">
                            <p className={`text-xs ${bajosStock > 0 ? 'text-red-500' : 'text-gray-400'}`}>Stock bajo mínimo</p>
                            <InfoTooltip text="Haz clic para filtrar solo estos insumos." position="bottom" />
                        </div>
                        <p className={`text-2xl font-bold ${bajosStock > 0 ? 'text-red-600' : 'text-gray-800'}`}>{bajosStock}</p>
                        <p className={`text-xs mt-1 ${bajosStock > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {filterStock === 'Bajo mínimo' ? '✓ Filtro activo — clic para quitar' : bajosStock > 0 ? 'clic para filtrar' : 'todo en orden'}
                        </p>
                    </button>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1 mb-1">
                            <p className="text-xs text-gray-400">Consumo últimos 30d</p>
                            <InfoTooltip text="Valor total de salidas en los últimos 30 días, normalizado a moneda base." position="bottom" />
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{fmtBase(consumo30d)}</p>
                        <p className="text-xs text-gray-400 mt-1">en todas las obras</p>
                    </div>
                </div>
            )}

            {/* ── Distribución por categoría ─────────────────────────── */}
            {!loading && catStats.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-700">Distribución por categoría</p>
                            {filterCat !== 'Todas' && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{ background: getCatColor(filterCat) + '20', color: getCatColor(filterCat) }}>
                                    Filtrando: {filterCat}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setShowTendencia(v => !v)}
                                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${showTendencia ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                                <BarChart2 size={13} /> {showTendencia ? 'Ocultar tendencia' : 'Ver tendencia'}
                            </button>
                            <p className="text-xs text-gray-400 hidden sm:block">Clic en tarjeta para filtrar</p>
                        </div>
                    </div>

                    <div className={`grid gap-3 ${catStats.length <= 2 ? 'grid-cols-2' : catStats.length === 3 ? 'grid-cols-3' : catStats.length === 4 ? 'grid-cols-2 md:grid-cols-4' : catStats.length === 5 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'}`}>
                        {catStats.map(({ cat, count, valor }) => {
                            const color    = getCatColor(cat);
                            const isActive = filterCat === cat;
                            return (
                                <button key={cat}
                                    onClick={() => setFilterCat(isActive ? 'Todas' : cat)}
                                    className={`text-left rounded-xl p-3 border transition-all cursor-pointer relative ${isActive ? 'border-2 shadow-md' : 'border hover:shadow-sm'}`}
                                    style={{ borderColor: isActive ? color : color + '30', background: color + '08' }}
                                >
                                    {isActive && (
                                        <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold"
                                            style={{ background: color }}>✕</span>
                                    )}
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-semibold truncate max-w-[80px]" style={{ color }}>{cat}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mr-5" style={{ background: color + '20', color }}>{count}</span>
                                    </div>
                                    <p className="text-base font-bold text-gray-800 mb-0.5">{fmtBase(valor)}</p>
                                    <p className="text-xs text-gray-400 mb-2">{count} insumo{count !== 1 ? 's' : ''}</p>
                                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(valor / maxCatValor) * 100}%`, background: color }} />
                                    </div>
                                    {isActive && (
                                        <p className="text-xs mt-2 font-medium" style={{ color }}>Clic para quitar filtro</p>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Tendencia ─────────────────────────────────────────────── */}
            {!loading && showTendencia && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <AnalyticsChart externalMovements={filteredMovements} title={filterCat !== 'Todas' ? filterCat : undefined} compact />
                </div>
            )}

            {/* ── Filtros activos ──────────────────────────────────────── */}
            {hayFiltrosActivos && (
                <div className="flex items-center gap-2 flex-wrap px-1">
                    <Filter size={13} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-400 font-medium">Filtros activos:</span>
                    {search && <FilterPill label={`Búsqueda: "${search}"`} onRemove={() => setSearch('')} />}
                    {filterCat !== 'Todas' && <FilterPill label={`Categoría: ${filterCat}`} onRemove={() => setFilterCat('Todas')} />}
                    {filterStock !== 'Todos' && <FilterPill label={`Stock: ${filterStock}`} onRemove={() => setFilterStock('Todos')} />}
                    <button onClick={clearAllFilters} className="text-xs text-red-400 hover:text-red-600 hover:underline ml-1">Limpiar todo</button>
                </div>
            )}

            {/* ── Barra de acciones masivas ─────────────────────────────── */}
            {selected.size > 0 && (
                <div className="bg-blue-600 rounded-xl px-5 py-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <Check size={16} className="text-white" />
                        <span className="text-sm font-medium text-white">{selected.size} insumo{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg transition-colors">
                            <Download size={13} /> Exportar selección
                        </button>
                        <button onClick={async () => {
                            if (!confirm(`¿Desactivar ${selected.size} insumos?`)) return;
                            for (const id of Array.from(selected)) {
                                try { await fetchApi(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ activo: false }) }); } catch {}
                            }
                            setSelected(new Set()); loadProducts();
                        }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg transition-colors">
                            Desactivar
                        </button>
                        <button onClick={async () => {
                            if (!confirm(`¿Eliminar ${selected.size} insumos?`)) return;
                            for (const id of Array.from(selected)) {
                                try { await fetchApi(`/products/${id}`, { method: 'DELETE' }); } catch {}
                            }
                            setProducts(p => p.filter(x => !selected.has(x.id)));
                            setSelected(new Set());
                        }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors">
                            <Trash2 size={13} /> Eliminar
                        </button>
                        <button onClick={() => setSelected(new Set())} className="p-1.5 text-white/70 hover:text-white"><X size={16} /></button>
                    </div>
                </div>
            )}

            {/* ── Toolbar ───────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por SKU, nombre o categoría..."
                        className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-800" />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                    className={`py-2 px-3 bg-white border rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${filterCat !== 'Todas' ? 'border-blue-400 text-blue-700 font-medium' : 'border-gray-200'}`}>
                    {categories.map(c => <option key={c}>{c}</option>)}
                </select>
                <select value={filterStock} onChange={e => setFilterStock(e.target.value)}
                    className={`py-2 px-3 bg-white border rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${filterStock !== 'Todos' ? 'border-blue-400 text-blue-700 font-medium' : 'border-gray-200'}`}>
                    <option>Todos</option><option>Bajo mínimo</option><option>Sin stock</option>
                </select>
                {hayFiltrosActivos && (
                    <button onClick={clearAllFilters}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium">
                        <X size={13} /> Limpiar filtros
                    </button>
                )}
                <div className="flex border border-gray-200 rounded-lg overflow-hidden ml-auto">
                    <button onClick={() => setView('list')} className={`p-2 transition-colors ${view === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-400 hover:text-gray-600'}`}><List size={18} /></button>
                    <button onClick={() => setView('grid')} className={`p-2 transition-colors border-l border-gray-200 ${view === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={18} /></button>
                </div>
            </div>

            {/* ── Estado vacío ──────────────────────────────────────────── */}
            {!loading && sorted.length === 0 && hayFiltrosActivos && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 flex flex-col items-center gap-3 text-center">
                    <div className="p-3 bg-gray-100 rounded-full"><Search size={22} className="text-gray-400" /></div>
                    <div>
                        <p className="text-sm font-semibold text-gray-700">Sin resultados con los filtros actuales</p>
                        <p className="text-xs text-gray-400 mt-1">
                            {filterCat !== 'Todas' && `Categoría: "${filterCat}" `}
                            {filterStock !== 'Todos' && `· Stock: "${filterStock}" `}
                            {search && `· Búsqueda: "${search}"`}
                        </p>
                    </div>
                    <button onClick={clearAllFilters} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                        Limpiar todos los filtros
                    </button>
                </div>
            )}

            {/* ── VISTA GRILLA ──────────────────────────────────────────── */}
            {view === 'grid' && sorted.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {loading ? <p className="col-span-full text-center text-gray-500 py-10">Cargando...</p>
                        : sorted.map(product => {
                            const isLow      = product.stock <= product.stockMinimo;
                            const isSelected = selected.has(product.id);
                            const c30d       = consumo30dPorProducto(product.id);
                            const monedaDoc  = product.moneda || monedaBase;
                            const tipoCambio = product.ultimaEntrada?.tipoCambio ?? null;
                            const costo      = Number(product.ultimoPrecioCompra ?? 0);
                            const { principal: costoPrincipal, equivalente: costoEquiv } = formatDualCurrency(
                                costo, monedaDoc, monedaBase, tipoCambio
                            );
                            return (
                                <div key={product.id} className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${isLow ? 'border-orange-200' : isSelected ? 'border-blue-400' : 'border-gray-100'}`}>
                                    <div className="relative">
                                        <Link href={`/dashboard/products/${product.id}`}>
                                            <div className="h-28 bg-gray-50 flex items-center justify-center border-b border-gray-100">
                                                <ProductImage imagen={product.imagen} nombre={product.nombre} categoria={product.categoria?.nombre} size={64} />
                                            </div>
                                        </Link>
                                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(product.id)}
                                            className="absolute top-2 left-2 w-4 h-4 cursor-pointer accent-blue-600" />
                                        {/* Badge de moneda extranjera */}
                                        {monedaDoc !== monedaBase && (
                                            <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                                                {monedaDoc}
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <p className="text-xs text-gray-400 font-mono mb-1">{product.sku}</p>
                                        <Link href={`/dashboard/products/${product.id}`}><p className="text-sm font-semibold text-gray-800 leading-tight hover:text-blue-600 line-clamp-2 mb-2">{product.nombre}</p></Link>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: getCatColor(product.categoria?.nombre) + '18', color: getCatColor(product.categoria?.nombre) }}>{product.categoria?.nombre || 'Sin cat.'}</span>
                                            <span className="text-xs text-gray-400">{product.unidad}</span>
                                        </div>
                                        <div className="mb-2">
                                            <StockBar stock={product.stock} stockMinimo={product.stockMinimo} />
                                        </div>
                                        <div className="flex justify-between items-start pt-2 border-t border-gray-100">
                                            {/* Precio con doble moneda */}
                                            <div>
                                                {costo > 0 ? (
                                                    <>
                                                        <span className="text-xs text-gray-600 font-medium">{costoPrincipal} /u</span>
                                                        {costoEquiv && (
                                                            <span className="block text-[10px] text-gray-400 leading-tight">{costoEquiv}</span>
                                                        )}
                                                    </>
                                                ) : <span className="text-xs text-gray-300">—</span>}
                                            </div>
                                            {c30d > 0 && <span className="text-xs text-blue-500 font-medium">{c30d} {product.unidad}/30d</span>}
                                        </div>
                                        {isLow && <div className="mt-1"><StockBadge stock={product.stock} stockMinimo={product.stockMinimo} /></div>}
                                        <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100">
                                            <Link href={`/dashboard/purchases/new?productoId=${product.id}`} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-green-600 hover:bg-green-50 rounded-md transition-colors">
                                                <ArrowUpCircle size={13} /> Entrada
                                            </Link>
                                            <Link href={`/dashboard/sales/new?productoId=${product.id}`} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-orange-500 hover:bg-orange-50 rounded-md transition-colors">
                                                <ArrowDownCircle size={13} /> Consumo
                                            </Link>
                                            <Link href={`/dashboard/products/${product.id}/edit`} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-md transition-colors">
                                                <Edit size={13} />
                                            </Link>
                                            <button onClick={() => handleDelete(product.id, product.nombre)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}

            {/* ── VISTA LISTA ───────────────────────────────────────────── */}
            {view === 'list' && (sorted.length > 0 || loading) && (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="p-3 w-10">
                                        <input type="checkbox" checked={selected.size === sorted.length && sorted.length > 0} onChange={toggleAll} className="w-4 h-4 cursor-pointer accent-blue-600" />
                                    </th>
                                    <th className="p-3 w-10"></th>
                                    <th className={thClass('sku')} onClick={() => handleSort('sku')}>SKU <SortIcon col="sku" sortKey={sortKey} sortDir={sortDir} /></th>
                                    <th className={thClass('nombre')} onClick={() => handleSort('nombre')}>Insumo <SortIcon col="nombre" sortKey={sortKey} sortDir={sortDir} /></th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Categoría</th>
                                    <th className={`${thClass('stock')}`} onClick={() => handleSort('stock')}>Stock <SortIcon col="stock" sortKey={sortKey} sortDir={sortDir} /></th>
                                    <th className={`${thClass('precioCompra')} text-right`} onClick={() => handleSort('precioCompra')}>
                                        Costo unit.
                                        <SortIcon col="precioCompra" sortKey={sortKey} sortDir={sortDir} />
                                    </th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">
                                        Valor almacén ({monedaBase})
                                    </th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Consumo 30d</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? <tr><td colSpan={10} className="p-8 text-center text-gray-500">Cargando...</td></tr>
                                    : sorted.map(product => {
                                        const isLow      = product.stock <= product.stockMinimo;
                                        const isSelected = selected.has(product.id);
                                        const c30d       = consumo30dPorProducto(product.id);
                                        const monedaDoc  = product.moneda || monedaBase;
                                        const tipoCambio = product.ultimaEntrada?.tipoCambio ?? null;
                                        const costo      = Number(product.ultimoPrecioCompra ?? 0);

                                        // Valor almacén en moneda base
                                        let valorAlmacenBase = product.stock * costo;
                                        if (monedaDoc === 'USD' && monedaBase === 'MXN' && tipoCambio) {
                                            valorAlmacenBase = product.stock * costo * tipoCambio;
                                        } else if (monedaDoc === 'MXN' && monedaBase === 'USD' && tipoCambio) {
                                            valorAlmacenBase = product.stock * costo / tipoCambio;
                                        }

                                        const { principal: costoPrincipal, equivalente: costoEquiv } = formatDualCurrency(
                                            costo, monedaDoc, monedaBase, tipoCambio
                                        );

                                        return (
                                            <tr key={product.id} className={`hover:bg-blue-50/30 transition-colors group ${isLow ? 'bg-orange-50/30' : ''} ${isSelected ? 'bg-blue-50/40' : ''}`}>
                                                <td className="p-3">
                                                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(product.id)} className="w-4 h-4 cursor-pointer accent-blue-600" />
                                                </td>
                                                <td className="p-2"><ProductImage imagen={product.imagen} nombre={product.nombre} categoria={product.categoria?.nombre} size={32} /></td>
                                                <td className="p-3 text-xs font-mono text-gray-500">{product.sku}</td>
                                                <td className="p-3">
                                                    <Link href={`/dashboard/products/${product.id}`} className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors">{product.nombre}</Link>
                                                    {isLow && <div className="mt-0.5"><StockBadge stock={product.stock} stockMinimo={product.stockMinimo} /></div>}
                                                </td>
                                                <td className="p-3">
                                                    <button
                                                        onClick={() => setFilterCat(filterCat === product.categoria?.nombre ? 'Todas' : (product.categoria?.nombre || 'Todas'))}
                                                        className="px-2 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80"
                                                        style={{ background: getCatColor(product.categoria?.nombre) + '18', color: getCatColor(product.categoria?.nombre) }}
                                                    >
                                                        {product.categoria?.nombre || 'Sin categoría'}
                                                    </button>
                                                </td>
                                                <td className="p-3">
                                                    <StockBar stock={product.stock ?? 0} stockMinimo={product.stockMinimo} />
                                                </td>
                                                {/* Costo unitario con doble moneda */}
                                                <td className="p-3 text-sm text-right">
                                                    {costo > 0 ? (
                                                        <span>
                                                            <span className="font-medium text-gray-700">{costoPrincipal}</span>
                                                            {monedaDoc !== monedaBase && (
                                                                <CurrencyBadge moneda={monedaDoc} />
                                                            )}
                                                            {costoEquiv && (
                                                                <span className="block text-xs text-gray-400 leading-tight">{costoEquiv}</span>
                                                            )}
                                                        </span>
                                                    ) : <span className="text-gray-300">—</span>}
                                                </td>
                                                {/* Valor almacén en moneda base */}
                                                <td className="p-3 text-sm font-semibold text-gray-700 text-right">
                                                    {costo > 0
                                                        ? fmtBase(valorAlmacenBase)
                                                        : <span className="text-gray-300">—</span>
                                                    }
                                                </td>
                                                <td className="p-3 text-right">
                                                    {c30d > 0
                                                        ? <span className="text-sm font-medium text-blue-600">{c30d} <span className="text-xs text-gray-400 font-normal">{product.unidad}</span></span>
                                                        : <span className="text-gray-300 text-sm">—</span>
                                                    }
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Link href={`/dashboard/purchases/new?productoId=${product.id}`} className="p-1.5 text-green-500 hover:bg-green-50 rounded-md transition-colors inline-flex" title="Registrar entrada">
                                                            <ArrowUpCircle size={15} />
                                                        </Link>
                                                        <Link href={`/dashboard/sales/new?productoId=${product.id}`} className="p-1.5 text-orange-400 hover:bg-orange-50 rounded-md transition-colors inline-flex" title="Registrar consumo">
                                                            <ArrowDownCircle size={15} />
                                                        </Link>
                                                        <Link href={`/dashboard/products/${product.id}/edit`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex">
                                                            <Edit size={15} />
                                                        </Link>
                                                        <button onClick={() => handleDelete(product.id, product.nombre)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                    {!loading && (
                        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                            <span>
                                {sorted.length} insumo{sorted.length !== 1 ? 's' : ''}
                                {hayFiltrosActivos && products.length !== sorted.length && (
                                    <span className="text-xs text-blue-500 ml-1">
                                        (de {products.length} totales —{' '}
                                        <button onClick={clearAllFilters} className="underline">ver todos</button>)
                                    </span>
                                )}
                                {selected.size > 0 && <span className="text-blue-600 font-medium ml-2">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>}
                            </span>
                            {sortKey !== 'nombre' && (
                                <span className="text-xs text-blue-500">Ordenado por <strong>{sortKey}</strong> {sortDir === 'asc' ? '↑' : '↓'} ·{' '}
                                    <button onClick={() => { setSortKey('nombre'); setSortDir('asc'); }} className="underline">limpiar</button>
                                </span>
                            )}
                        </div>
                    )}
                </Card>
            )}

            {/* ── Modales ───────────────────────────────────────────────── */}
            {showStockModal && <StockBarChart products={sorted} onClose={() => setShowStockModal(false)} />}
            {showImport && (
                <ImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); loadProducts(); }} />
            )}
        </div>
    );
}

export default function ProductsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Cargando insumos...</div>}>
            <ProductsPageInner />
        </Suspense>
    );
}
