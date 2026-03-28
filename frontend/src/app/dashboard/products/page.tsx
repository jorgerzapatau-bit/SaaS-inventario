"use client";

import { useEffect, useState, useRef } from 'react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { StockBarChart } from '@/components/dashboard/StockBarChart';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import { Card } from '@/components/ui/Card';
import {
    Search, Plus, Edit, Trash2, AlertTriangle, LayoutGrid, List,
    ChevronUp, ChevronDown, ChevronsUpDown, Download, Upload,
    ArrowUpCircle, ArrowDownCircle, X, Check, BarChart2, Filter
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

// ── Helpers ───────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
    'Electrónicos': '#3b82f6', 'Periféricos': '#8b5cf6', 'Consumibles': '#f59e0b',
    'Accesorios': '#10b981', 'Ropa': '#ec4899', 'default': '#6b7280',
};
function getCatColor(cat: string) { return CATEGORY_COLORS[cat] || CATEGORY_COLORS['default']; }
function getMargen(p: any) {
    const pv = Number(p.ultimoPrecioVenta ?? 0);
    const pc = Number(p.ultimoPrecioCompra ?? 0);
    return pv > 0 ? (pv - pc) / pv * 100 : 0;
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

function StockBadge({ stock, stockMinimo }: { stock: number; stockMinimo: number }) {
    if (stock === 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><AlertTriangle size={10} /> Sin stock</span>;
    if (stock <= stockMinimo) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700"><AlertTriangle size={10} /> Bajo mín.</span>;
    return null;
}

type SortKey = 'nombre' | 'sku' | 'stock' | 'precioCompra' | 'precioVenta' | 'margen';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
    if (col !== sortKey) return <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-blue-500 ml-1 inline" /> : <ChevronDown size={12} className="text-blue-500 ml-1 inline" />;
}

// ── Pill de filtro activo ─────────────────────────────────────────────────────
function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
            {label}
            <button onClick={onRemove} className="p-0.5 hover:bg-blue-200 rounded-full transition-colors">
                <X size={11} />
            </button>
        </span>
    );
}

// ── Quick Movement Modal ──────────────────────────────────────────────────────
function QuickMovModal({ product, type, onClose, onDone }: { product: any; type: 'entrada' | 'salida'; onClose: () => void; onDone: () => void }) {
    const [qty, setQty] = useState('1');
    const [motivo, setMotivo] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const isEntrada = type === 'entrada';

    const handleSubmit = async () => {
        if (!qty || Number(qty) <= 0) { setErr('Ingresa una cantidad válida'); return; }
        setSaving(true); setErr('');
        try {
            await fetchApi('/inventory/movements', {
                method: 'POST',
                body: JSON.stringify({
                    productoId: product.id,
                    tipoMovimiento: isEntrada ? 'ENTRADA' : 'SALIDA',
                    cantidad: Number(qty),
                    costoUnitario: Number(product.ultimoPrecioCompra ?? 0),
                    precioVenta: isEntrada ? null : Number(product.ultimoPrecioVenta ?? null),
                    motivo: motivo || (isEntrada ? 'Entrada rápida' : 'Salida rápida'),
                    almacenId: null,
                }),
            });
            onDone();
        } catch (e: any) { setErr(e.message || 'Error al registrar'); setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${isEntrada ? 'bg-green-100' : 'bg-red-100'}`}>
                            {isEntrada ? <ArrowUpCircle size={18} className="text-green-600" /> : <ArrowDownCircle size={18} className="text-red-500" />}
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800 text-sm">{isEntrada ? 'Entrada rápida' : 'Salida rápida'}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[180px]">{product.nombre}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
                </div>
                {err && <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
                <div className="space-y-3 mb-5">
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Cantidad ({product.unidad})</label>
                        <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} autoFocus
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                        <p className="text-xs text-gray-400 mt-1">Stock actual: <strong>{product.stock} {product.unidad}</strong></p>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Motivo (opcional)</label>
                        <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={isEntrada ? 'Ej: Compra a proveedor' : 'Ej: Venta #V-001'}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className={`flex-1 py-2 text-sm text-white font-medium rounded-lg transition-colors disabled:opacity-70 ${isEntrada ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
                        {saving ? 'Guardando...' : `Registrar ${isEntrada ? 'entrada' : 'salida'}`}
                    </button>
                </div>
            </div>
        </div>
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
                        unidad: row.unidad || 'pieza',
                        precioCompra: Number(row.preciocompra || row['precio compra'] || row.costo || 0),
                        precioVenta: Number(row.precioventa || row['precio venta'] || row.precio || 0),
                        stockMinimo: Number(row.stockminimo || row['stock minimo'] || row.minimo || 5),
                    }),
                });
                ok++;
            } catch { fail++; }
        }
        setResult(`${ok} productos importados${fail > 0 ? `, ${fail} fallaron` : ' correctamente'}.`);
        setImporting(false);
        if (ok > 0) setTimeout(() => { onDone(); }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <p className="font-semibold text-gray-800">Importar productos desde CSV</p>
                        <p className="text-xs text-gray-400 mt-0.5">El archivo debe tener columnas: sku, nombre, unidad, preciocompra, precioventa, stockminimo</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
                </div>
                <button onClick={() => {
                    const csv = 'sku,nombre,unidad,preciocompra,precioventa,stockminimo\nPRD-001,Producto ejemplo,pieza,100,150,5';
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_productos.csv'; a.click();
                }} className="flex items-center gap-2 text-xs text-blue-500 hover:underline mb-4">
                    <Download size={13} /> Descargar plantilla CSV
                </button>
                <div onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                    onDragOver={e => e.preventDefault()} onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all mb-4">
                    <Upload size={24} className="text-gray-400" />
                    <p className="text-sm text-gray-500">Haz clic o arrastra tu archivo CSV</p>
                    {rows.length > 0 && <p className="text-xs text-green-600 font-medium">{rows.length} productos listos para importar</p>}
                </div>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                {err && <p className="text-xs text-red-500 mb-3">{err}</p>}
                {result && <p className="text-xs text-green-600 mb-3 font-medium">{result}</p>}
                {rows.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
                        <p className="text-xs font-semibold text-gray-500 mb-2">Vista previa:</p>
                        {rows.slice(0, 5).map((r, i) => (
                            <div key={i} className="text-xs text-gray-600 py-1 border-b border-gray-100 last:border-0">
                                <span className="font-mono text-gray-400 mr-2">{r.sku}</span>{r.nombre} · {r.unidad || 'pieza'} · ${r.preciocompra||r['precio compra']||0} / ${r.precioventa||r['precio venta']||0}
                            </div>
                        ))}
                        {rows.length > 5 && <p className="text-xs text-gray-400 mt-1">...y {rows.length - 5} más</p>}
                    </div>
                )}
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleImport} disabled={rows.length === 0 || importing}
                        className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50">
                        {importing ? 'Importando...' : `Importar ${rows.length} productos`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProductsPage() {
    const [products, setProducts]       = useState<any[]>([]);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState('');
    const [search, setSearch]           = useState('');
    const [filterCat, setFilterCat]     = useState('Todas');
    const [filterStock, setFilterStock] = useState('Todos');
    const [view, setView]               = useState<'list' | 'grid'>('list');
    const [showStockModal, setShowStockModal] = useState(false);
    const [showTendencia, setShowTendencia]   = useState(false);
    const [allMovements, setAllMovements]     = useState<any[]>([]);
    const [sortKey, setSortKey]   = useState<SortKey>('nombre');
    const [sortDir, setSortDir]   = useState<SortDir>('asc');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [quickMov, setQuickMov] = useState<{ product: any; type: 'entrada' | 'salida' } | null>(null);
    const [showImport, setShowImport] = useState(false);

    const loadProducts = () => {
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

    // ── Limpiar todos los filtros ─────────────────────────────────────────────
    const clearAllFilters = () => {
        setSearch('');
        setFilterCat('Todas');
        setFilterStock('Todos');
    };
    const hayFiltrosActivos = search !== '' || filterCat !== 'Todas' || filterStock !== 'Todos';

    // ── CSV Export ────────────────────────────────────────────────────────────
    const exportCSV = () => {
        const toExport = selected.size > 0 ? sorted.filter(p => selected.has(p.id)) : sorted;
        const header = 'SKU,Nombre,Categoría,Stock,Precio Compra,Precio Venta,Margen %,Valor Almacén';
        const rows = toExport.map(p => [
            p.sku, `"${p.nombre}"`, p.categoria?.nombre || '',
            p.stock, Number(p.ultimoPrecioCompra ?? 0), Number(p.ultimoPrecioVenta ?? 0),
            getMargen(p).toFixed(1),
            (p.stock * Number(p.ultimoPrecioCompra ?? 0)).toFixed(0)
        ].join(','));
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `productos_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    };

    // ── Filtered & Sorted ─────────────────────────────────────────────────────
    const categories = ['Todas', ...Array.from(new Set(products.map(p => p.categoria?.nombre).filter(Boolean)))];

    const filtered = products.filter(p => {
        const q = search.toLowerCase();
        const matchSearch = !search || p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.categoria?.nombre || '').toLowerCase().includes(q);
        const matchCat    = filterCat === 'Todas' || p.categoria?.nombre === filterCat;
        const matchStock  = filterStock === 'Todos' || (filterStock === 'Bajo mínimo' && p.stock <= p.stockMinimo) || (filterStock === 'Sin stock' && p.stock === 0);
        return matchSearch && matchCat && matchStock;
    });

    const sorted = [...filtered].sort((a, b) => {
        let va: any, vb: any;
        if (sortKey === 'margen')       { va = getMargen(a); vb = getMargen(b); }
        else if (sortKey === 'stock')   { va = a.stock ?? 0; vb = b.stock ?? 0; }
        else if (sortKey === 'precioCompra') { va = Number(a.ultimoPrecioCompra??0); vb = Number(b.ultimoPrecioCompra??0); }
        else if (sortKey === 'precioVenta')  { va = Number(a.ultimoPrecioVenta??0);  vb = Number(b.ultimoPrecioVenta??0); }
        else { va = (a[sortKey] || '').toLowerCase(); vb = (b[sortKey] || '').toLowerCase(); }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    const maxMargen = Math.max(...sorted.map(p => getMargen(p)), 1);

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const totalValor = allMovements.reduce((a, m) => {
        const qty = Number(m.cantidad || 0), costo = Number(m.costoUnitario || 0);
        if (['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)) return a + qty * costo;
        if (['SALIDA','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento))  return a - qty * costo;
        return a;
    }, 0);
    const margenProm  = filtered.length > 0 ? filtered.reduce((a, p) => a + getMargen(p), 0) / filtered.length : 0;
    const bajosStock  = filtered.filter(p => p.stock <= p.stockMinimo).length;
    const catsActivas = new Set(filtered.map(p => p.categoria?.nombre).filter(Boolean)).size;

    // ── Category stats ────────────────────────────────────────────────────────
    const catStats = Array.from(new Set(products.map(p => p.categoria?.nombre).filter(Boolean))).map(cat => {
        const prods = products.filter(p => p.categoria?.nombre === cat);
        const valor = prods.reduce((a, p) => a + (p.stock * Number(p.ultimoPrecioCompra ?? 0)), 0);
        const mg    = prods.length > 0 ? prods.reduce((a, p) => a + getMargen(p), 0) / prods.length : 0;
        return { cat, count: prods.length, valor, mg };
    }).sort((a, b) => b.valor - a.valor);
    const maxCatValor = catStats.length > 0 ? catStats[0].valor : 1;

    const filteredProductIds = new Set(filtered.map(p => p.id));
    const filteredMovements  = filterCat === 'Todas'
        ? allMovements
        : allMovements.filter(m => filteredProductIds.has(m.productoId));

    const thClass = (key: SortKey) =>
        `p-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-blue-600 transition-colors whitespace-nowrap ${sortKey === key ? 'text-blue-600' : 'text-gray-400'}`;

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
                    <p className="text-sm text-gray-500 mt-1">Gestiona el catálogo de productos de tu empresa.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
                        <Upload size={15} /> Importar CSV
                    </button>
                    <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
                        <Download size={15} /> {selected.size > 0 ? `Exportar (${selected.size})` : 'Exportar CSV'}
                    </button>
                    <Link href="/dashboard/products/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                        <Plus size={16} /> Nuevo Producto
                    </Link>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            {/* ── KPIs ───────────────────────────────────────────────── */}
            {!loading && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1 mb-1">
                            <p className="text-xs text-gray-400">Productos</p>
                            <InfoTooltip text="SKUs visibles según los filtros aplicados." position="bottom" />
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{filtered.length}</p>
                        <p className="text-xs text-gray-400 mt-1">de {products.length} totales</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1 mb-1">
                            <p className="text-xs text-gray-400">Valor inventario</p>
                            <InfoTooltip text="Σ(entradas×costo) − Σ(salidas×costo). Mismo cálculo que el dashboard." position="bottom" />
                        </div>
                        <p className="text-2xl font-bold text-gray-800">${totalValor.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                        <p className="text-xs text-gray-400 mt-1">mismo cálculo que dashboard</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1 mb-1">
                            <p className="text-xs text-gray-400">Margen promedio</p>
                            <InfoTooltip text="Promedio de margen de los productos visibles. Verde ≥30%, amarillo ≥15%, rojo <15%." position="bottom" />
                        </div>
                        <p className={`text-2xl font-bold ${margenProm >= 30 ? 'text-green-600' : margenProm >= 15 ? 'text-amber-500' : 'text-red-500'}`}>{margenProm.toFixed(1)}%</p>
                        <p className="text-xs text-gray-400 mt-1">productos visibles</p>
                    </div>
                    {/* FIX: Stock bajo mínimo ahora es clickeable para activar el filtro */}
                    <button
                        onClick={() => setFilterStock(filterStock === 'Bajo mínimo' ? 'Todos' : 'Bajo mínimo')}
                        className={`rounded-xl border shadow-sm p-4 text-left transition-all hover:shadow-md ${bajosStock > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'} ${filterStock === 'Bajo mínimo' ? 'ring-2 ring-orange-400' : ''}`}
                    >
                        <div className="flex items-center gap-1 mb-1">
                            <p className={`text-xs ${bajosStock > 0 ? 'text-orange-500' : 'text-gray-400'}`}>Stock bajo mínimo</p>
                            <InfoTooltip text="Haz clic para filtrar solo estos productos." position="bottom" />
                        </div>
                        <p className={`text-2xl font-bold ${bajosStock > 0 ? 'text-orange-600' : 'text-gray-800'}`}>{bajosStock}</p>
                        <p className={`text-xs mt-1 ${bajosStock > 0 ? 'text-orange-400' : 'text-gray-400'}`}>
                            {filterStock === 'Bajo mínimo' ? '✓ Filtro activo — clic para quitar' : bajosStock > 0 ? 'clic para filtrar' : 'todo en orden'}
                        </p>
                    </button>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1 mb-1">
                            <p className="text-xs text-gray-400">Categorías</p>
                            <InfoTooltip text="Categorías distintas en los productos visibles." position="bottom" />
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{catsActivas}</p>
                        <p className="text-xs text-gray-400 mt-1">en selección actual</p>
                    </div>
                </div>
            )}

            {/* ── Distribución por categoría ──────────────────────────── */}
            {!loading && catStats.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-700">Distribución por categoría</p>
                            {/* FIX: indicador de filtro activo visible en el encabezado */}
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
                        {catStats.map(({ cat, count, valor, mg }) => {
                            const color    = getCatColor(cat);
                            const isActive = filterCat === cat;
                            return (
                                <button key={cat}
                                    onClick={() => setFilterCat(isActive ? 'Todas' : cat)}
                                    className={`text-left rounded-xl p-3 border transition-all cursor-pointer relative ${isActive ? 'border-2 shadow-md' : 'border hover:shadow-sm'}`}
                                    style={{ borderColor: isActive ? color : color + '30', background: color + '08' }}
                                >
                                    {/* FIX: ícono X visible cuando está activo */}
                                    {isActive && (
                                        <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold"
                                            style={{ background: color }}>
                                            ✕
                                        </span>
                                    )}
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-semibold truncate max-w-[80px]" style={{ color }}>{cat}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mr-5" style={{ background: color + '20', color }}>{count}</span>
                                    </div>
                                    <p className="text-base font-bold text-gray-800 mb-0.5">${valor.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                                    <p className="text-xs text-gray-400 mb-2">Margen <span className="font-semibold text-green-600">{mg.toFixed(1)}%</span></p>
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

            {/* ── Tendencia ──────────────────────────────────────────── */}
            {!loading && showTendencia && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <AnalyticsChart externalMovements={filteredMovements} title={filterCat !== 'Todas' ? filterCat : undefined} compact />
                </div>
            )}

            {/* ── Barra de filtros activos ─────────────────────────────
                Siempre visible cuando hay filtros, con pills removibles
            ──────────────────────────────────────────────────────────── */}
            {hayFiltrosActivos && (
                <div className="flex items-center gap-2 flex-wrap px-1">
                    <Filter size={13} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-400 font-medium">Filtros activos:</span>
                    {search && (
                        <FilterPill label={`Búsqueda: "${search}"`} onRemove={() => setSearch('')} />
                    )}
                    {filterCat !== 'Todas' && (
                        <FilterPill label={`Categoría: ${filterCat}`} onRemove={() => setFilterCat('Todas')} />
                    )}
                    {filterStock !== 'Todos' && (
                        <FilterPill label={`Stock: ${filterStock}`} onRemove={() => setFilterStock('Todos')} />
                    )}
                    <button onClick={clearAllFilters} className="text-xs text-red-400 hover:text-red-600 hover:underline ml-1">
                        Limpiar todo
                    </button>
                </div>
            )}

            {/* ── Barra de acciones masivas ───────────────────────────── */}
            {selected.size > 0 && (
                <div className="bg-blue-600 rounded-xl px-5 py-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <Check size={16} className="text-white" />
                        <span className="text-sm font-medium text-white">{selected.size} producto{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg transition-colors">
                            <Download size={13} /> Exportar selección
                        </button>
                        <button onClick={async () => {
                            if (!confirm(`¿Desactivar ${selected.size} productos?`)) return;
                            for (const id of Array.from(selected)) {
                                try { await fetchApi(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ activo: false }) }); } catch {}
                            }
                            setSelected(new Set()); loadProducts();
                        }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg transition-colors">
                            Desactivar
                        </button>
                        <button onClick={async () => {
                            if (!confirm(`¿Eliminar ${selected.size} productos?`)) return;
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

            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por SKU, nombre o categoría..."
                        className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-800" />
                    {/* FIX: botón limpiar búsqueda dentro del input */}
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={14} />
                        </button>
                    )}
                </div>
                {/* FIX: selects con indicador visual cuando tienen filtro activo */}
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                    className={`py-2 px-3 bg-white border rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${filterCat !== 'Todas' ? 'border-blue-400 text-blue-700 font-medium' : 'border-gray-200'}`}>
                    {categories.map(c => <option key={c}>{c}</option>)}
                </select>
                <select value={filterStock} onChange={e => setFilterStock(e.target.value)}
                    className={`py-2 px-3 bg-white border rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${filterStock !== 'Todos' ? 'border-blue-400 text-blue-700 font-medium' : 'border-gray-200'}`}>
                    <option>Todos</option><option>Bajo mínimo</option><option>Sin stock</option>
                </select>
                {/* FIX: botón limpiar filtros junto a los selects */}
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

            {/* ── Estado vacío cuando filtros no dan resultados ─────────
                Muestra qué filtros están activos y ofrece limpiarlos
            ──────────────────────────────────────────────────────────── */}
            {!loading && sorted.length === 0 && hayFiltrosActivos && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 flex flex-col items-center gap-3 text-center">
                    <div className="p-3 bg-gray-100 rounded-full">
                        <Search size={22} className="text-gray-400" />
                    </div>
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

            {/* ── VISTA GRILLA ────────────────────────────────────────── */}
            {view === 'grid' && sorted.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {loading ? <p className="col-span-full text-center text-gray-500 py-10">Cargando...</p>
                        : sorted.map(product => {
                            const isLow    = product.stock <= product.stockMinimo;
                            const mg       = getMargen(product).toFixed(0);
                            const isSelected = selected.has(product.id);
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
                                    </div>
                                    <div className="p-3">
                                        <p className="text-xs text-gray-400 font-mono mb-1">{product.sku}</p>
                                        <Link href={`/dashboard/products/${product.id}`}><p className="text-sm font-semibold text-gray-800 leading-tight hover:text-blue-600 line-clamp-2 mb-2">{product.nombre}</p></Link>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: getCatColor(product.categoria?.nombre) + '18', color: getCatColor(product.categoria?.nombre) }}>{product.categoria?.nombre || 'Sin cat.'}</span>
                                            <span className={`text-xs font-semibold ${Number(mg) >= 30 ? 'text-green-600' : Number(mg) >= 15 ? 'text-amber-500' : 'text-red-500'}`}>{mg}%</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                            <span className={`text-sm font-bold ${isLow ? 'text-orange-600' : 'text-gray-800'}`}>{product.stock}</span>
                                            <span className="text-sm font-semibold text-gray-800">{product.ultimoPrecioVenta ? `$${Number(product.ultimoPrecioVenta).toLocaleString()}` : '—'}</span>
                                        </div>
                                        {isLow && <div className="mt-1"><StockBadge stock={product.stock} stockMinimo={product.stockMinimo} /></div>}
                                        <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100">
                                            <button onClick={() => setQuickMov({ product, type: 'entrada' })} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-green-600 hover:bg-green-50 rounded-md transition-colors">
                                                <ArrowUpCircle size={13} /> Entrada
                                            </button>
                                            <button onClick={() => setQuickMov({ product, type: 'salida' })} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                                <ArrowDownCircle size={13} /> Salida
                                            </button>
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

            {/* ── VISTA LISTA ─────────────────────────────────────────── */}
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
                                    <th className={thClass('nombre')} onClick={() => handleSort('nombre')}>Producto <SortIcon col="nombre" sortKey={sortKey} sortDir={sortDir} /></th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Categoría</th>
                                    <th className={`${thClass('stock')} text-right`} onClick={() => handleSort('stock')}>Stock <SortIcon col="stock" sortKey={sortKey} sortDir={sortDir} /></th>
                                    <th className={`${thClass('precioCompra')} text-right`} onClick={() => handleSort('precioCompra')}>Últ. Compra <SortIcon col="precioCompra" sortKey={sortKey} sortDir={sortDir} /></th>
                                    <th className={`${thClass('precioVenta')} text-right`} onClick={() => handleSort('precioVenta')}>Últ. Venta <SortIcon col="precioVenta" sortKey={sortKey} sortDir={sortDir} /></th>
                                    <th className={`${thClass('margen')} text-right`} onClick={() => handleSort('margen')}>
                                        <span className="inline-flex items-center gap-1 justify-end w-full">
                                            Margen <SortIcon col="margen" sortKey={sortKey} sortDir={sortDir} />
                                            <InfoTooltip text="(últimoPrecioVenta − últimoCosto) ÷ últimoPrecioVenta × 100." position="top" />
                                        </span>
                                    </th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? <tr><td colSpan={10} className="p-8 text-center text-gray-500">Cargando...</td></tr>
                                    : sorted.map(product => {
                                        const isLow      = product.stock <= product.stockMinimo;
                                        const mg         = getMargen(product);
                                        const isSelected = selected.has(product.id);
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
                                                    {/* FIX: clic en categoría dentro de la tabla también filtra */}
                                                    <button
                                                        onClick={() => setFilterCat(filterCat === product.categoria?.nombre ? 'Todas' : (product.categoria?.nombre || 'Todas'))}
                                                        className="px-2 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80"
                                                        style={{ background: getCatColor(product.categoria?.nombre) + '18', color: getCatColor(product.categoria?.nombre) }}
                                                    >
                                                        {product.categoria?.nombre || 'Sin categoría'}
                                                    </button>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <span className={`text-sm font-bold ${isLow ? 'text-orange-600' : 'text-gray-700'}`}>{product.stock ?? 0}</span>
                                                    <span className="text-xs text-gray-400 ml-1">/ {product.stockMinimo}</span>
                                                </td>
                                                <td className="p-3 text-sm text-gray-500 text-right">{product.ultimoPrecioCompra ? `$${Number(product.ultimoPrecioCompra).toLocaleString()}` : <span className="text-gray-300">—</span>}</td>
                                                <td className="p-3 text-sm font-semibold text-gray-800 text-right">{product.ultimoPrecioVenta ? `$${Number(product.ultimoPrecioVenta).toLocaleString()}` : <span className="text-gray-300">—</span>}</td>
                                                <td className="p-3 text-right">
                                                    <span className={`text-sm font-semibold ${mg >= 30 ? 'text-green-600' : mg >= 15 ? 'text-amber-600' : 'text-red-500'}`}>{mg.toFixed(1)}%</span>
                                                    <div className="h-1 mt-1 rounded-full bg-gray-100 overflow-hidden w-16 ml-auto">
                                                        <div className="h-full rounded-full" style={{ width: `${(mg / maxMargen) * 100}%`, background: mg >= 30 ? '#22c55e' : mg >= 15 ? '#f59e0b' : '#ef4444' }} />
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setQuickMov({ product, type: 'entrada' })} className="p-1.5 text-green-500 hover:bg-green-50 rounded-md transition-colors" title="Entrada rápida">
                                                            <ArrowUpCircle size={15} />
                                                        </button>
                                                        <button onClick={() => setQuickMov({ product, type: 'salida' })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-md transition-colors" title="Salida rápida">
                                                            <ArrowDownCircle size={15} />
                                                        </button>
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
                                {sorted.length} producto{sorted.length !== 1 ? 's' : ''}
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

            {/* ── Modales ──────────────────────────────────────────────── */}
            {showStockModal && <StockBarChart products={sorted} onClose={() => setShowStockModal(false)} />}
            {quickMov && (
                <QuickMovModal product={quickMov.product} type={quickMov.type}
                    onClose={() => setQuickMov(null)}
                    onDone={() => { setQuickMov(null); loadProducts(); }} />
            )}
            {showImport && (
                <ImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); loadProducts(); }} />
            )}
        </div>
    );
}
