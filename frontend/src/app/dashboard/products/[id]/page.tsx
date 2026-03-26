"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import {
    ArrowLeft, Plus, Minus, Edit, AlertTriangle, X,
    TrendingUp, TrendingDown, DollarSign, FileDown,
    Building2, User, Save, Upload, ToggleLeft, ToggleRight,
    Check, SlidersHorizontal, RefreshCcw, Search, ChevronLeft, ChevronRight,
    FileSpreadsheet, StickyNote
} from 'lucide-react';
import { MovimientoModal } from '@/components/ui/MovimientoModal';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import ProductChart from '@/components/dashboard/ProductChart';

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface Proveedor { id?: string; nombre: string; telefono?: string; email?: string; }
interface Movimiento {
    id: string;
    tipoMovimiento: 'ENTRADA' | 'SALIDA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO';
    cantidad: number; costoUnitario: number; precioVenta?: number;
    proveedorId?: string; proveedor?: Proveedor; clienteNombre?: string;
    referencia?: string; fecha: string;
    almacen: { nombre: string }; usuario: { nombre: string }; saldo?: number;
}
interface Producto {
    id: string; nombre: string; sku: string; unidad: string;
    stockMinimo: number; ultimoPrecioCompra?: number | null; ultimoPrecioVenta?: number | null;
    activo: boolean; stock: number; imagen?: string | null;
    descripcion?: string; notas?: string; categoriaId: string;
    categoria: { id: string; nombre: string };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const tipoColor = (t: string) => ({
    ENTRADA: 'bg-green-100 text-green-700',
    SALIDA: 'bg-red-100 text-red-700',
    AJUSTE_POSITIVO: 'bg-blue-100 text-blue-700',
    AJUSTE_NEGATIVO: 'bg-orange-100 text-orange-700',
}[t] || 'bg-gray-100 text-gray-600');

const tipoLabel = (t: string) => ({
    ENTRADA: 'Entrada', SALIDA: 'Salida',
    AJUSTE_POSITIVO: 'Ajuste +', AJUSTE_NEGATIVO: 'Ajuste -',
}[t] || t);

const MAX_SIZE_BYTES = 300 * 1024;
const MAX_DIM = 500;
const PAGE_SIZE = 25;

async function compressImage(file: File): Promise<{ base64: string; error?: string }> {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) { resolve({ base64: '', error: 'Debe ser imagen JPG, PNG o WebP' }); return; }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
                else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
            }
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
            let quality = 0.85;
            let base64 = canvas.toDataURL('image/jpeg', quality);
            while (base64.length * 0.75 > MAX_SIZE_BYTES && quality > 0.2) { quality -= 0.1; base64 = canvas.toDataURL('image/jpeg', quality); }
            if (base64.length * 0.75 > MAX_SIZE_BYTES) resolve({ base64: '', error: 'Imagen demasiado grande. Usa una más pequeña.' });
            else resolve({ base64 });
        };
        img.onerror = () => resolve({ base64: '', error: 'No se pudo leer la imagen' });
        img.src = url;
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductDetailPage({ isNew = false }: { isNew?: boolean } = {}) {
    const { id } = useParams();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [product, setProduct] = useState<Producto | null>(null);
    const [movements, setMovements] = useState<Movimiento[]>([]);
    const [loading, setLoading] = useState(!isNew);
    const [selectedMov, setSelectedMov] = useState<Movimiento | null>(null);
    const [editing, setEditing] = useState(isNew);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [imgError, setImgError] = useState('');
    const [imgUploading, setImgUploading] = useState(false);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [saved, setSaved] = useState(false);
    const [movModal, setMovModal] = useState<'entrada' | 'salida' | 'ajuste' | null>(null);
    const [totalInventarioValor, setTotalInventarioValor] = useState<number>(0);
    const [editData, setEditData] = useState({
        sku: '', nombre: '', descripcion: '', notas: '',
        categoriaId: '', stockMinimo: '5', unidad: 'pieza',
        imagen: null as string | null, activo: true,
    });

    // ── Mejora 1: Filtros del historial ──────────────────────────────────────
    const [filtroTipo, setFiltroTipo] = useState<string>('todos');
    const [filtroDesde, setFiltroDesde] = useState('');
    const [filtroHasta, setFiltroHasta] = useState('');
    const [filtroBusqueda, setFiltroBusqueda] = useState('');
    const [historialPage, setHistorialPage] = useState(1);

    // ── Mejora 2: Notas internas ──────────────────────────────────────────────
    const [notasDraft, setNotasDraft] = useState('');
    const [savingNotas, setSavingNotas] = useState(false);
    const [notasGuardadas, setNotasGuardadas] = useState(false);
    const [showNotas, setShowNotas] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────

    const reloadData = async () => {
        if (!id || isNew) return;
        try {
            const [prod, movs, products, totalMovs] = await Promise.all([
                fetchApi(`/products/${id}`),
                fetchApi(`/inventory/kardex/${id}`),
                fetchApi('/products'),
                fetchApi('/inventory/movements').catch(() => []),
            ]);
            let saldo = 0;
            const movsWithBalance = [...movs]
                .sort((a: Movimiento, b: Movimiento) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
                .map((m: Movimiento) => { saldo += (['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento) ? m.cantidad : -m.cantidad); return { ...m, saldo }; });
            const fp = products.find((p: any) => p.id === id);
            setProduct({ ...prod, stock: fp?.stock ?? 0, ultimoPrecioCompra: fp?.ultimoPrecioCompra, ultimoPrecioVenta: fp?.ultimoPrecioVenta });
            setMovements([...movsWithBalance].reverse());
            if (Array.isArray(totalMovs)) {
                const totalVal = totalMovs.reduce((a: number, m: any) => {
                    const q = Number(m.cantidad || 0), c = Number(m.costoUnitario || 0);
                    if (['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento)) return a + q * c;
                    if (['SALIDA', 'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)) return a - q * c;
                    return a;
                }, 0);
                setTotalInventarioValor(totalVal);
            }
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        const load = async () => {
            try {
                if (isNew) {
                    const products = await fetchApi('/products');
                    const cats = Array.from(new Map(products.filter((p: any) => p.categoria).map((p: any) => [p.categoria.id, p.categoria])).values());
                    setCategorias(cats as any[]);
                    return;
                }
                await reloadData();
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        load();
    }, [id, isNew]);

    // Sync notas draft when product loads
    useEffect(() => {
        if (product) setNotasDraft((product as any).notas || '');
    }, [product?.id]);

    const startEdit = () => {
        if (!product) return;
        setEditData({
            sku: product?.sku ?? '', nombre: product?.nombre ?? '',
            descripcion: (product as any)?.descripcion || '',
            notas: (product as any)?.notas || '',
            categoriaId: product?.categoria?.id || '',
            stockMinimo: String(product?.stockMinimo ?? 5),
            unidad: product?.unidad ?? 'pieza',
            imagen: product?.imagen ?? null, activo: product?.activo ?? true,
        });
        setEditing(true); setSaveError(''); setImgError('');
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditData(p => ({ ...p, [name]: value }));
    };

    const handleImageFile = async (file: File) => {
        setImgError(''); setImgUploading(true);
        const { base64, error } = await compressImage(file);
        setImgUploading(false);
        if (error) { setImgError(error); return; }
        setEditData(p => ({ ...p, imagen: base64 }));
    };

    const handleSave = async () => {
        if (isNew && (!editData.nombre || !editData.sku)) { setSaveError('SKU y nombre son obligatorios'); return; }
        setSaving(true); setSaveError('');
        try {
            if (isNew) {
                const created = await fetchApi('/products', {
                    method: 'POST',
                    body: JSON.stringify({
                        sku: editData.sku, nombre: editData.nombre, descripcion: editData.descripcion,
                        notas: editData.notas, categoriaId: editData.categoriaId || undefined,
                        unidad: editData.unidad, stockMinimo: Number(editData.stockMinimo) || 5,
                        imagen: editData.imagen, activo: editData.activo,
                    }),
                });
                router.replace(`/dashboard/products/${created.id}`);
                return;
            }
            if (!product) return;
            const updated = await fetchApi(`/products/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    nombre: editData.nombre, categoriaId: editData.categoriaId,
                    unidad: editData.unidad, stockMinimo: Number(editData.stockMinimo),
                    imagen: editData.imagen, activo: editData.activo,
                    notas: editData.notas,
                }),
            });
            const cat = categorias.find((c: any) => c.id === editData.categoriaId);
            setProduct(p => p ? { ...p, ...updated, stock: p.stock, categoria: cat || p.categoria } : p);
            setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
        } catch (err: any) { setSaveError(err.message || 'Error al guardar'); }
        finally { setSaving(false); }
    };

    // ── Mejora 3: Guardar notas sin salir del modo vista ──────────────────────
    const handleSaveNotas = async () => {
        if (!product) return;
        setSavingNotas(true);
        try {
            await fetchApi(`/products/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ notas: notasDraft }),
            });
            setProduct(p => p ? { ...p, notas: notasDraft } : p);
            setNotasGuardadas(true);
            setTimeout(() => setNotasGuardadas(false), 2500);
        } catch (err) { console.error(err); }
        finally { setSavingNotas(false); }
    };

    // ── Mejora 4: Export CSV ──────────────────────────────────────────────────
    const exportCSV = () => {
        if (!product || movements.length === 0) return;
        const headers = ['Fecha', 'Tipo', 'Referencia', 'Proveedor/Cliente', 'Almacén', 'Cantidad', 'Costo unit.', 'P. Venta', 'Saldo', 'Usuario'];
        const rows = [...movements].reverse().map(m => [
            new Date(m.fecha).toLocaleDateString('es-MX'),
            tipoLabel(m.tipoMovimiento),
            m.referencia || '',
            m.proveedor?.nombre || m.clienteNombre || '',
            m.almacen?.nombre || '',
            (['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento) ? '+' : '-') + m.cantidad,
            Number(m.costoUnitario).toLocaleString(),
            m.precioVenta ? Number(m.precioVenta).toLocaleString() : '',
            String(m.saldo ?? ''),
            m.usuario?.nombre || '',
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `kardex-${product.sku}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    // ── Mejora 5: PDF export (unchanged) ─────────────────────────────────────
    const exportPDF = async () => {
        if (!product) return;
        const jsPDF = (await import('jspdf')).default;
        await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape' });
        const empresa = localStorage.getItem('companySlug') || 'Empresa';
        doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('Kardex de Producto', 14, 18);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(`Empresa: ${empresa.toUpperCase()}`, 14, 26);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}`, 14, 31);
        doc.setFillColor(245, 247, 250); doc.roundedRect(14, 36, 268, 28, 2, 2, 'F');
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.text(product?.nombre ?? '', 18, 45);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text(`SKU: ${product?.sku}`, 18, 51);
        doc.text(`Categoría: ${product?.categoria?.nombre}`, 18, 56);
        doc.text(`Stock actual: ${product?.stock} ${product?.unidad}`, 140, 51);
        doc.text(`Valor almacén: $${((product?.stock ?? 0) * Number(ultimaEntrada?.costoUnitario ?? product?.ultimoPrecioCompra ?? 0)).toLocaleString()}`, 140, 56);
        const tableData = [...movements].reverse().map(m => [
            new Date(m.fecha).toLocaleDateString('es-MX'), tipoLabel(m.tipoMovimiento),
            m.referencia || '—', m.proveedor?.nombre || m.clienteNombre || '—',
            m.almacen?.nombre,
            (['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento) ? '+' : '-') + m.cantidad,
            `$${Number(m.costoUnitario).toLocaleString()}`,
            m.precioVenta ? `$${Number(m.precioVenta).toLocaleString()}` : '—',
            String(m.saldo), m.usuario?.nombre,
        ]);
        (doc as any).autoTable({
            startY: 70,
            head: [['Fecha', 'Tipo', 'Referencia', 'Prov/Cliente', 'Almacén', 'Cant.', 'Costo', 'P.Venta', 'Saldo', 'Usuario']],
            body: tableData,
            styles: { fontSize: 7.5, cellPadding: 2.5 },
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        doc.save(`kardex-${product?.sku}-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // ─── Derived values ───────────────────────────────────────────────────────

    if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Cargando producto...</p></div>;
    if (!isNew && !product) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Producto no encontrado.</p></div>;

    const totalEntradas = !isNew ? movements.filter(m => ['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento)).reduce((a, m) => a + m.cantidad, 0) : 0;
    const totalSalidas = !isNew ? movements.filter(m => ['SALIDA', 'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)).reduce((a, m) => a + m.cantidad, 0) : 0;
    const lowStock = !isNew && product ? product.stock <= product.stockMinimo : false;
    const margen = product && Number(product?.ultimoPrecioVenta ?? 0) > 0
        ? ((Number(product?.ultimoPrecioVenta ?? 0) - Number(product?.ultimoPrecioCompra ?? 0)) / Number(product?.ultimoPrecioVenta ?? 0) * 100).toFixed(1)
        : '0';
    const ultimaEntrada = !isNew ? movements.find(m => m.tipoMovimiento === 'ENTRADA') : undefined;
    const ultimaSalida = !isNew ? movements.find(m => m.tipoMovimiento === 'SALIDA') : undefined;
    const pC = Number(product?.ultimoPrecioCompra ?? 0);
    const pV = Number(product?.ultimoPrecioVenta ?? 0);
    const editMargen = pV > 0 ? ((pV - pC) / pV * 100) : 0;
    const editMargenColor = editMargen >= 30 ? 'text-green-600' : editMargen >= 15 ? 'text-amber-500' : 'text-red-500';
    const CATEGORY_COLORS: Record<string, string> = { 'Electrónicos': '#3b82f6', 'Periféricos': '#8b5cf6', 'Consumibles': '#f59e0b', 'Accesorios': '#10b981', 'default': '#6b7280' };
    const catColor = CATEGORY_COLORS[product?.categoria?.nombre || ''] || CATEGORY_COLORS['default'];

    const ultimoCosto = Number(ultimaEntrada?.costoUnitario ?? 0);
    const valorEsteProducto = (product?.stock ?? 0) * ultimoCosto;
    const hace30d = useMemo(() => new Date(Date.now() - 30 * 86400000), []);
    const salidasUltimos30d = !isNew ? movements.filter(m => ['SALIDA', 'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento) && new Date(m.fecha) >= hace30d).reduce((a, m) => a + m.cantidad, 0) : 0;
    const rotacionProducto = product?.stock && product.stock > 0 ? (salidasUltimos30d / product.stock * 100).toFixed(1) : null;
    const promedioSalidasDiarias = salidasUltimos30d / 30;
    const diasStock = promedioSalidasDiarias > 0 && product?.stock ? Math.round(product.stock / promedioSalidasDiarias) : null;
    const diasStockAlerta = diasStock !== null && diasStock <= (product?.stockMinimo ?? 5) * 2;

    // ── Mejora 6: Punto de reorden inteligente ────────────────────────────────
    // = stockMinimo + (promedio salidas diarias × 7 días de margen de seguridad)
    const puntoReorden = product ? Math.ceil((product.stockMinimo ?? 0) + promedioSalidasDiarias * 7) : null;
    const necesitaReorden = product ? product.stock <= (puntoReorden ?? 0) : false;

    // ── Filtrado y paginación del historial ───────────────────────────────────
    const movimientosFiltrados = useMemo(() => {
        return movements.filter(m => {
            if (filtroTipo !== 'todos' && m.tipoMovimiento !== filtroTipo) return false;
            if (filtroDesde && new Date(m.fecha) < new Date(filtroDesde)) return false;
            if (filtroHasta && new Date(m.fecha) > new Date(filtroHasta + 'T23:59:59')) return false;
            if (filtroBusqueda) {
                const q = filtroBusqueda.toLowerCase();
                if (!(m.referencia?.toLowerCase().includes(q) ||
                    m.proveedor?.nombre?.toLowerCase().includes(q) ||
                    m.clienteNombre?.toLowerCase().includes(q))) return false;
            }
            return true;
        });
    }, [movements, filtroTipo, filtroDesde, filtroHasta, filtroBusqueda]);

    const totalPages = Math.max(1, Math.ceil(movimientosFiltrados.length / PAGE_SIZE));
    const movsPagina = movimientosFiltrados.slice((historialPage - 1) * PAGE_SIZE, historialPage * PAGE_SIZE);
    const hayFiltrosActivos = filtroTipo !== 'todos' || filtroDesde || filtroHasta || filtroBusqueda;

    const resetFiltros = () => {
        setFiltroTipo('todos'); setFiltroDesde(''); setFiltroHasta('');
        setFiltroBusqueda(''); setHistorialPage(1);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* ── Mejora 7: Banner de stock bajo ─────────────────────────────── */}
            {!isNew && lowStock && product && (
                <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
                    <div className="flex items-center gap-3">
                        <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-red-700">
                                Stock bajo — {product.stock} {product.unidad} disponibles (mínimo: {product.stockMinimo})
                            </p>
                            <p className="text-xs text-red-500 mt-0.5">
                                {diasStock !== null
                                    ? `Al ritmo actual quedan ~${diasStock} días de inventario`
                                    : 'Sin ventas recientes para estimar días restantes'}
                                {puntoReorden && necesitaReorden && ` · Punto de reorden: ${puntoReorden} ${product.unidad}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setMovModal('entrada')}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors whitespace-nowrap flex-shrink-0 cursor-pointer"
                    >
                        <RefreshCcw size={14} /> Reordenar ahora
                    </button>
                </div>
            )}

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-start gap-4">
                    <button onClick={() => router.back()} className="mt-1 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <p className="text-sm text-gray-500">{isNew ? 'Nuevo producto' : `${product?.sku} · ${product?.categoria?.nombre}`}</p>
                        <h1 className="text-3xl font-bold text-gray-900">{isNew ? (editData.nombre || 'Nuevo Producto') : product?.nombre}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            {!product?.activo && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>}
                            {saved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1"><Check size={11} /> Guardado</span>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {!isNew && (
                        <>
                            <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer">
                                <FileDown size={16} /> Kardex PDF
                            </button>
                            {/* ── Mejora 8: Export CSV ── */}
                            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer">
                                <FileSpreadsheet size={16} /> CSV
                            </button>
                        </>
                    )}
                    {!editing
                        ? <button onClick={startEdit} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"><Edit size={16} /> Editar</button>
                        : <>
                            <button onClick={() => { setEditing(false); setSaveError(''); }} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"><X size={16} /> Cancelar</button>
                            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-70">
                                <Save size={16} />{saving ? 'Guardando...' : (isNew ? 'Crear producto' : 'Guardar cambios')}
                            </button>
                        </>
                    }
                    {!isNew && <button onClick={() => setMovModal('entrada')} className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors cursor-pointer"><Plus size={16} /> Entrada</button>}
                    {!isNew && <button onClick={() => setMovModal('salida')} className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer"><Minus size={16} /> Salida</button>}
                    {!isNew && <button onClick={() => setMovModal('ajuste')} className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors cursor-pointer"><SlidersHorizontal size={16} /> Ajuste</button>}
                </div>
            </div>

            {/* ── BLOQUE SUPERIOR: imagen + datos ────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">

                {/* Imagen */}
                <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${editing ? 'border-blue-200' : 'border-gray-100'}`}>
                    {editing ? (
                        <div className="p-3 space-y-2">
                            <div
                                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
                                onDragOver={e => e.preventDefault()}
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all overflow-hidden"
                            >
                                {imgUploading ? <p className="text-xs text-gray-400">Procesando...</p>
                                    : editData.imagen ? <img src={editData.imagen} alt="Preview" className="w-full h-full object-cover" />
                                        : <><Upload size={20} className="text-gray-400" /><p className="text-xs text-gray-500 text-center">Clic o arrastra<br /><span className="text-gray-400 text-xs">JPG·PNG·WebP</span></p></>}
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
                            {imgError && <p className="text-xs text-red-500">{imgError}</p>}
                            <p className="text-xs text-gray-400 text-center">máx 300KB · 500×500px<br />Compresión automática</p>
                            {editData.imagen && <button type="button" onClick={() => setEditData(p => ({ ...p, imagen: null }))} className="w-full text-xs text-red-500 hover:bg-red-50 border border-red-100 rounded-lg py-1.5 flex items-center justify-center gap-1 cursor-pointer"><X size={11} /> Eliminar</button>}
                        </div>
                    ) : (
                        <div className="w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                            {product?.imagen
                                ? <img src={product.imagen} alt={product?.nombre} className="w-full h-full object-cover" />
                                : <div className="flex flex-col items-center gap-2">
                                    <div style={{ width: 72, height: 72, borderRadius: 12, background: catColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ fontSize: 32, fontWeight: 700, color: catColor }}>{product?.nombre?.[0].toUpperCase()}</span>
                                    </div>
                                    <p className="text-xs text-gray-400">Sin imagen</p>
                                </div>
                            }
                        </div>
                    )}
                </div>

                {/* Datos del producto */}
                <div className={`bg-white rounded-xl border shadow-sm p-5 ${editing ? 'border-blue-200' : 'border-gray-100'}`}>
                    {editing ? (
                        <div className="space-y-4">
                            {saveError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs border border-red-100">{saveError}</div>}
                            <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
                                <Edit size={14} className="text-blue-500" />
                                <p className="text-xs font-semibold text-blue-600">Editando — los campos calculados se actualizarán automáticamente</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">{isNew ? "SKU *" : <span>SKU <span className="text-gray-400 font-normal">(no editable)</span></span>}</label>
                                    {isNew
                                        ? <input required type="text" name="sku" value={editData.sku} onChange={handleEditChange} placeholder="Ej: LAP-001" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                        : <input value={product?.sku ?? ''} readOnly className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-400 font-mono cursor-not-allowed" />
                                    }
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">Nombre *</label>
                                    <input required type="text" name="nombre" value={editData.nombre} onChange={handleEditChange} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-700 block mb-1">Descripción</label>
                                <textarea name="descripcion" value={editData.descripcion} onChange={handleEditChange} rows={2} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" placeholder="Características del producto..." />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">Categoría *</label>
                                    <select name="categoriaId" value={editData.categoriaId} onChange={handleEditChange} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                        <option value="">Seleccionar</option>
                                        {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">Unidad *</label>
                                    <select name="unidad" value={editData.unidad} onChange={handleEditChange} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                        {['pieza', 'unidad', 'caja', 'litro', 'kg', 'gramo', 'metro', 'rollo', 'resma', 'par'].map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3 border border-dashed border-gray-200">
                                    <p className="text-xs text-gray-400 mb-1">Precio compra <span className="text-gray-300 text-xs">(última entrada)</span></p>
                                    <p className="text-sm font-bold text-gray-700">{ultimaEntrada ? `$${Number(ultimaEntrada.costoUnitario).toLocaleString()}` : <span className="text-gray-400 italic text-xs">Sin entradas aún</span>}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 border border-dashed border-gray-200">
                                    <p className="text-xs text-gray-400 mb-1">Precio venta <span className="text-gray-300 text-xs">(última salida)</span></p>
                                    <p className="text-sm font-bold text-gray-700">{ultimaSalida?.precioVenta ? `$${Number(ultimaSalida.precioVenta).toLocaleString()}` : <span className="text-gray-400 italic text-xs">Sin ventas aún</span>}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">Stock mínimo *</label>
                                    <input required type="number" min="0" name="stockMinimo" value={editData.stockMinimo} onChange={handleEditChange} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                                <div className="bg-gray-50 rounded-lg px-3 py-2">
                                    <p className="text-xs text-gray-400 mb-0.5">Stock actual <span className="text-gray-300">(calculado)</span></p>
                                    <p className="text-sm font-bold text-gray-700">{isNew ? `0 ${editData.unidad}` : `${product?.stock ?? 0} ${editData.unidad}`}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg px-3 py-2">
                                    <p className="text-xs text-gray-400 mb-0.5">Valor almacén <span className="text-gray-300">(calculado)</span></p>
                                    <p className="text-sm font-bold text-gray-700">${((product?.stock ?? 0) * pC).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                                </div>
                                <div className={`rounded-lg px-3 py-2 ${editMargen >= 30 ? 'bg-green-50' : editMargen >= 15 ? 'bg-amber-50' : pV > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                                    <p className="text-xs text-gray-400 mb-0.5">Margen <span className="text-gray-300">(calculado)</span></p>
                                    <p className={`text-sm font-bold ${editMargenColor}`}>{pV > 0 ? `${editMargen.toFixed(1)}%` : '—'} {pV > 0 && pC > 0 && <span className="text-xs font-normal">· ${(pV - pC).toLocaleString('es-MX')}/{editData.unidad}</span>}</p>
                                </div>
                            </div>
                            {/* ── Notas internas en modo edición ── */}
                            <div>
                                <label className="text-xs font-medium text-gray-700 block mb-1 flex items-center gap-1"><StickyNote size={12} className="text-amber-500" /> Notas internas <span className="text-gray-400 font-normal">(solo visible para tu equipo)</span></label>
                                <textarea name="notas" value={editData.notas} onChange={handleEditChange} rows={2} className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/20 resize-none" placeholder="Ej: Pedir solo a proveedor X · Frágil · Revisar antes de vender..." />
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                <div><p className="text-sm font-medium text-gray-700">Producto activo</p><p className="text-xs text-gray-400">Visible en entradas/salidas</p></div>
                                <button type="button" onClick={() => setEditData(p => ({ ...p, activo: !p.activo }))} className="cursor-pointer">
                                    {editData.activo ? <ToggleRight size={32} className="text-green-500" /> : <ToggleLeft size={32} className="text-gray-300" />}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
                                <div className={`rounded-xl border p-4 ${lowStock ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1"><p className="text-xs text-gray-500">Stock actual</p><InfoTooltip text="Suma de todas las entradas y ajustes positivos menos todas las salidas y ajustes negativos registrados en el kardex." position="bottom" /></div>
                                        {lowStock && <AlertTriangle size={14} className="text-red-500" />}
                                    </div>
                                    <p className={`text-2xl font-bold ${lowStock ? 'text-red-600' : 'text-gray-800'}`}>{product?.stock}</p>
                                    <p className="text-xs text-gray-400">{product?.unidad} · mín {product?.stockMinimo}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                                    <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-1"><p className="text-xs text-gray-500">Último precio compra</p><InfoTooltip text="CostoUnitario del último movimiento de ENTRADA registrado." position="bottom" /></div><TrendingDown size={14} className="text-blue-400" /></div>
                                    <p className="text-2xl font-bold text-gray-800">${Number(ultimaEntrada?.costoUnitario ?? product?.ultimoPrecioCompra ?? 0).toLocaleString()}</p>
                                    <p className="text-xs text-gray-400">{ultimaEntrada ? `${new Date(ultimaEntrada.fecha).toLocaleDateString('es-MX')}${ultimaEntrada.proveedor ? ` · ${ultimaEntrada.proveedor.nombre}` : ''}` : 'Sin entradas'}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                                    <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-1"><p className="text-xs text-gray-500">Último precio venta</p><InfoTooltip text="Precio de venta al cliente del último movimiento de SALIDA registrado." position="bottom" /></div><TrendingUp size={14} className="text-green-400" /></div>
                                    <p className="text-2xl font-bold text-gray-800">${Number(ultimaSalida?.precioVenta ?? product?.ultimoPrecioVenta ?? 0).toLocaleString()}</p>
                                    <p className="text-xs text-gray-400">{ultimaSalida ? new Date(ultimaSalida.fecha).toLocaleDateString('es-MX') : 'Precio catálogo'}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                                    <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-1"><p className="text-xs text-gray-500">Valor en almacén</p><InfoTooltip text="Stock actual × costo unitario de la última entrada." position="bottom" /></div><DollarSign size={14} className="text-gray-400" /></div>
                                    <p className="text-2xl font-bold text-gray-800">${((product?.stock ?? 0) * Number(ultimaEntrada?.costoUnitario ?? product?.ultimoPrecioCompra ?? 0)).toLocaleString()}</p>
                                    <p className="text-xs text-gray-400">{product?.stock} × ${Number(ultimaEntrada?.costoUnitario ?? product?.ultimoPrecioCompra ?? 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
                                    <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-1"><p className="text-xs text-gray-500">Valor inventario</p><InfoTooltip text="Σ(entradas×costo) − Σ(salidas×costo) sobre todos los movimientos." position="bottom" /></div><DollarSign size={14} className="text-amber-400" /></div>
                                    <p className="text-2xl font-bold text-gray-800">${movements.reduce((a, m) => { const q = Number(m.cantidad || 0), c = Number(m.costoUnitario || 0); if (['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento)) return a + q * c; if (['SALIDA', 'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)) return a - q * c; return a; }, 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                                    <p className="text-xs text-gray-400">Desde todos los movimientos</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Información general</p>
                                    <table className="w-full text-sm"><tbody className="divide-y divide-gray-50">
                                        {[['Nombre', product?.nombre ?? ''], ['Categoría', product?.categoria?.nombre ?? ''], ['Unidad', product?.unidad ?? ''], ['Margen', margen + '%'], ['Stock mínimo', `${product?.stockMinimo} ${product?.unidad}`], ['Estado', product?.activo ? 'Activo' : 'Inactivo']].map(([l, v]) => (
                                            <tr key={l}><td className="py-1.5 text-gray-500 text-xs">{l}</td><td className="py-1.5 text-right font-medium text-gray-800 text-xs">{v}</td></tr>
                                        ))}
                                    </tbody></table>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resumen de movimientos</p>
                                    <table className="w-full text-sm"><tbody className="divide-y divide-gray-50">
                                        <tr><td className="py-1.5 text-gray-500 text-xs">Total entradas</td><td className="py-1.5 text-right font-medium text-green-600 text-xs">+{totalEntradas} {product?.unidad}</td></tr>
                                        <tr><td className="py-1.5 text-gray-500 text-xs">Total salidas</td><td className="py-1.5 text-right font-medium text-red-500 text-xs">-{totalSalidas} {product?.unidad}</td></tr>
                                        <tr className="border-t-2 border-gray-200"><td className="py-1.5 font-semibold text-gray-800 text-xs">Stock actual</td><td className="py-1.5 text-right font-bold text-gray-800 text-xs">= {product?.stock} {product?.unidad}</td></tr>
                                        <tr><td className="py-1.5 text-gray-500 text-xs">Total movimientos</td><td className="py-1.5 text-right font-medium text-gray-700 text-xs">{movements.length}</td></tr>
                                        <tr><td className="py-1.5 text-gray-500 text-xs">Valor total comprado</td><td className="py-1.5 text-right font-medium text-gray-700 text-xs">${movements.filter(m => m.tipoMovimiento === 'ENTRADA').reduce((a, m) => a + m.cantidad * Number(m.costoUnitario), 0).toLocaleString()}</td></tr>
                                    </tbody></table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Métricas de contexto ────────────────────────────────────────── */}
            {!isNew && !editing && (
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1.5 mb-2"><p className="text-xs text-gray-500">% del inventario total</p><InfoTooltip text="(stock × último costo) ÷ valor total inventario × 100." position="bottom" /></div>
                        {valorEsteProducto > 0 && ultimoCosto > 0 && totalInventarioValor > 0 ? (
                            <><p className="text-2xl font-bold text-gray-800">{((valorEsteProducto / totalInventarioValor) * 100).toFixed(1)}%</p>
                                <p className="text-xs text-gray-400 mt-1">${valorEsteProducto.toLocaleString('es-MX', { maximumFractionDigits: 0 })} de valor en almacén</p></>
                        ) : <p className="text-sm text-gray-400 italic mt-1">Sin entradas registradas</p>}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1.5 mb-2"><p className="text-xs text-gray-500">Rotación últimos 30 días</p><InfoTooltip text="(Salidas 30d ÷ stock actual) × 100." position="bottom" /></div>
                        {rotacionProducto !== null ? (
                            <><p className={`text-2xl font-bold ${Number(rotacionProducto) >= 50 ? 'text-green-600' : Number(rotacionProducto) >= 20 ? 'text-amber-500' : 'text-gray-800'}`}>{rotacionProducto}%</p>
                                <p className="text-xs text-gray-400 mt-1">{salidasUltimos30d} {product?.unidad} vendidas · {salidasUltimos30d === 0 ? 'sin movimiento' : 'en 30 días'}</p></>
                        ) : <p className="text-sm text-gray-400 italic mt-1">Sin stock para calcular</p>}
                    </div>

                    <div className={`bg-white rounded-xl border shadow-sm p-4 ${diasStockAlerta ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100'}`}>
                        <div className="flex items-center gap-1.5 mb-2"><p className={`text-xs ${diasStockAlerta ? 'text-orange-600' : 'text-gray-500'}`}>Días de stock restante</p><InfoTooltip text="Stock actual ÷ promedio de salidas diarias de los últimos 30 días." position="bottom" /></div>
                        {diasStock !== null ? (
                            <><p className={`text-2xl font-bold ${diasStockAlerta ? 'text-orange-600' : 'text-gray-800'}`}>~{diasStock} días</p>
                                <p className="text-xs text-gray-400 mt-1">{diasStockAlerta ? '⚠ Considerar reabastecimiento pronto' : `Al ritmo de ${promedioSalidasDiarias.toFixed(1)} ${product?.unidad}/día`}</p></>
                        ) : <p className="text-sm text-gray-400 italic mt-1">{salidasUltimos30d === 0 ? 'Sin ventas en 30 días' : 'Sin stock disponible'}</p>}
                    </div>

                    {/* ── Mejora 9: Punto de reorden inteligente ── */}
                    <div className={`rounded-xl border shadow-sm p-4 ${necesitaReorden ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <p className={`text-xs ${necesitaReorden ? 'text-amber-600' : 'text-gray-500'}`}>Punto de reorden</p>
                            <InfoTooltip text="Stock mínimo + (promedio ventas diarias × 7 días de margen de seguridad). Cuando el stock cae a este nivel, es momento de ordenar." position="bottom" />
                        </div>
                        {puntoReorden !== null && promedioSalidasDiarias > 0 ? (
                            <>
                                <p className={`text-2xl font-bold ${necesitaReorden ? 'text-amber-600' : 'text-gray-800'}`}>{puntoReorden} {product?.unidad}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {necesitaReorden
                                        ? <span className="text-amber-600 font-medium">⚠ Reordenar ahora</span>
                                        : `Reordenar cuando queden ≤${puntoReorden} ${product?.unidad}`}
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-gray-400 italic mt-1">Sin historial de ventas</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── Mejora: Notas internas (modo vista) ────────────────────────── */}
            {!isNew && !editing && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <button
                        onClick={() => setShowNotas(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors rounded-xl cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <StickyNote size={15} className="text-amber-500" />
                            <span className="text-sm font-medium text-gray-700">Notas internas</span>
                            {product?.notas && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Con notas</span>}
                        </div>
                        <span className="text-xs text-gray-400">{showNotas ? '▲ cerrar' : '▼ ver y editar'}</span>
                    </button>
                    {showNotas && (
                        <div className="px-5 pb-4 space-y-3 border-t border-gray-50">
                            <p className="text-xs text-gray-400 pt-3">Solo visible para tu equipo. Usa este espacio para instrucciones especiales, notas de proveedor, advertencias de manejo, etc.</p>
                            <textarea
                                value={notasDraft}
                                onChange={e => setNotasDraft(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/20 resize-none"
                                placeholder="Ej: Pedir solo a proveedor X · Frágil, no apilar · Requiere revisión antes de vender..."
                            />
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSaveNotas}
                                    disabled={savingNotas}
                                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                                >
                                    <Save size={12} />{savingNotas ? 'Guardando...' : 'Guardar notas'}
                                </button>
                                {notasGuardadas && <span className="text-xs text-green-600 flex items-center gap-1"><Check size={11} /> Guardado</span>}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Gráfica ─────────────────────────────────────────────────────── */}
            {!isNew && (
                <ProductChart
                    movements={[...movements].reverse()}
                    unidad={product?.unidad ?? ''}
                />
            )}

            {/* ── Historial de movimientos ────────────────────────────────────── */}
            {!isNew && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Header del historial */}
                    <div className="px-6 py-4 border-b border-gray-100">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-base font-semibold text-gray-800">Historial de movimientos</h2>
                            <p className="text-sm text-gray-400">
                                {hayFiltrosActivos
                                    ? `${movimientosFiltrados.length} de ${movements.length} registros`
                                    : `${movements.length} registros · haz clic para ver detalle`}
                            </p>
                        </div>

                        {/* ── Mejora 1: Filtros ── */}
                        <div className="flex flex-wrap gap-2 items-center">
                            {/* Tipo */}
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                                {[['todos', 'Todos'], ['ENTRADA', 'Entradas'], ['SALIDA', 'Salidas'], ['AJUSTE_POSITIVO', 'Aj+'], ['AJUSTE_NEGATIVO', 'Aj-']].map(([val, label]) => (
                                    <button
                                        key={val}
                                        onClick={() => { setFiltroTipo(val); setHistorialPage(1); }}
                                        className={`px-3 py-1.5 transition-colors cursor-pointer ${filtroTipo === val ? 'bg-gray-800 text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {/* Búsqueda */}
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Referencia, proveedor..."
                                    value={filtroBusqueda}
                                    onChange={e => { setFiltroBusqueda(e.target.value); setHistorialPage(1); }}
                                    className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>
                            {/* Rango de fechas */}
                            <input type="date" value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setHistorialPage(1); }} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            <span className="text-xs text-gray-400">—</span>
                            <input type="date" value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setHistorialPage(1); }} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            {/* Reset */}
                            {hayFiltrosActivos && (
                                <button onClick={resetFiltros} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                                    <X size={11} /> Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabla */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    {['Fecha', 'Tipo', 'Referencia', 'Proveedor / Cliente', 'Almacén', 'Cant.', 'Costo unit.', 'P. Venta', 'Saldo', 'Usuario'].map(h => (
                                        <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {movsPagina.length === 0
                                    ? <tr><td colSpan={10} className="px-6 py-10 text-center text-gray-400">{hayFiltrosActivos ? 'Sin resultados para estos filtros.' : 'No hay movimientos.'}</td></tr>
                                    : movsPagina.map(mov => {
                                        const isPos = ['ENTRADA', 'AJUSTE_POSITIVO'].includes(mov.tipoMovimiento);
                                        const contacto = mov.proveedor?.nombre || mov.clienteNombre;
                                        return (
                                            <tr
                                                key={mov.id}
                                                onClick={() => setSelectedMov(mov)}
                                                className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{new Date(mov.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                <td className="px-4 py-3"><span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${tipoColor(mov.tipoMovimiento)}`}>{tipoLabel(mov.tipoMovimiento)}</span></td>
                                                <td className="px-4 py-3 text-sm text-gray-700 max-w-[140px] truncate">{mov.referencia || '—'}</td>
                                                <td className="px-4 py-3 text-sm">{contacto ? <span className="flex items-center gap-1.5 text-gray-700">{mov.proveedor ? <Building2 size={13} className="text-blue-400 flex-shrink-0" /> : <User size={13} className="text-green-400 flex-shrink-0" />}{contacto}</span> : <span className="text-gray-300">—</span>}</td>
                                                <td className="px-4 py-3 text-sm text-gray-500">{mov.almacen?.nombre}</td>
                                                <td className={`px-4 py-3 text-sm font-bold text-right ${isPos ? 'text-green-600' : 'text-red-500'}`}>{isPos ? '+' : '-'}{mov.cantidad}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700 text-right">${Number(mov.costoUnitario).toLocaleString()}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700 text-right">{mov.precioVenta ? `$${Number(mov.precioVenta).toLocaleString()}` : <span className="text-gray-300">—</span>}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{mov.saldo}</td>
                                                <td className="px-4 py-3 text-sm text-gray-500">{mov.usuario?.nombre}</td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Paginación ── */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                Página {historialPage} de {totalPages} · {movimientosFiltrados.length} registros
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setHistorialPage(p => Math.max(1, p - 1))}
                                    disabled={historialPage === 1}
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const page = totalPages <= 5 ? i + 1 : historialPage <= 3 ? i + 1 : historialPage >= totalPages - 2 ? totalPages - 4 + i : historialPage - 2 + i;
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => setHistorialPage(page)}
                                            className={`w-7 h-7 text-xs rounded-lg border transition-colors cursor-pointer ${historialPage === page ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {page}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setHistorialPage(p => Math.min(totalPages, p + 1))}
                                    disabled={historialPage === totalPages}
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Modal detalle movimiento ────────────────────────────────────── */}
            {!isNew && selectedMov && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMov(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${tipoColor(selectedMov.tipoMovimiento)}`}>{tipoLabel(selectedMov.tipoMovimiento)}</span>
                                <h3 className="text-lg font-bold text-gray-900 mt-2">{selectedMov.referencia || 'Sin referencia'}</h3>
                            </div>
                            <button onClick={() => setSelectedMov(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="space-y-0">
                            {([
                                ['Producto', product?.nombre],
                                ['Fecha', new Date(selectedMov.fecha).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })],
                                ['Almacén', selectedMov.almacen?.nombre],
                                ['Cantidad', `${['ENTRADA', 'AJUSTE_POSITIVO'].includes(selectedMov.tipoMovimiento) ? '+' : '-'}${selectedMov.cantidad} ${product?.unidad}`],
                                ['Costo unitario', `$${Number(selectedMov.costoUnitario).toLocaleString()}`],
                                ...(selectedMov.precioVenta ? [['Precio de venta', `$${Number(selectedMov.precioVenta).toLocaleString()}`]] : []),
                                ['Costo total', `$${(selectedMov.cantidad * Number(selectedMov.costoUnitario)).toLocaleString()}`],
                                ['Saldo después', `${selectedMov.saldo} ${product?.unidad}`],
                                ...(selectedMov.proveedor ? [['Proveedor', selectedMov.proveedor.nombre], ...(selectedMov.proveedor.telefono ? [['Tel.', selectedMov.proveedor.telefono]] : []), ...(selectedMov.proveedor.email ? [['Email', selectedMov.proveedor.email]] : [])] : []),
                                ...(selectedMov.clienteNombre ? [['Cliente', selectedMov.clienteNombre]] : []),
                                ['Registrado por', selectedMov.usuario?.nombre],
                            ] as [string, string][]).map(([l, v]) => (
                                <div key={l} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                                    <span className="text-sm text-gray-500">{l}</span>
                                    <span className="text-sm font-medium text-gray-800 text-right max-w-[220px]">{v}</span>
                                </div>
                            ))}
                        </div>
                        {/* ── Acción rápida: Repetir entrada ── */}
                        {selectedMov.tipoMovimiento === 'ENTRADA' && (
                            <button
                                onClick={() => {
                                    setSelectedMov(null);
                                    setMovModal('entrada');
                                }}
                                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors cursor-pointer"
                            >
                                <RefreshCcw size={14} /> Repetir esta entrada
                            </button>
                        )}
                        <button onClick={() => setSelectedMov(null)} className="mt-2 w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer">Cerrar</button>
                    </div>
                </div>
            )}

            {/* ── Modal Entrada / Salida / Ajuste ────────────────────────────── */}
            {movModal && product && (
                <MovimientoModal
                    producto={{
                        id: product.id, nombre: product.nombre, sku: product.sku,
                        unidad: product.unidad, stock: product.stock,
                        ultimoPrecioCompra: product.ultimoPrecioCompra,
                        ultimoPrecioVenta: product.ultimoPrecioVenta,
                    }}
                    tipo={movModal}
                    onClose={() => setMovModal(null)}
                    onDone={async () => { setMovModal(null); await reloadData(); }}
                />
            )}
        </div>
    );
}
