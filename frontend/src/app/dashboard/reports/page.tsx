"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { FileText, Download, Calendar, BarChart3, TrendingUp, Filter, Loader2, AlertTriangle } from 'lucide-react';
import { fetchApi } from '@/lib/api';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function DollarSignIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
    );
}

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Producto {
    id: string;
    nombre: string;
    sku: string;
    stock: number;
    ultimoPrecioCompra?: number | null;
    categoria?: { nombre: string } | null;
}

interface FilaInventario {
    nombre: string;
    sku: string;
    categoria: string;
    stock: number;
    costoUnitario: number;
    valorTotal: number;
}

// ── Generador de PDF en el browser ─────────────────────────────────────────────
// Carga un script externo una sola vez y devuelve promesa
function cargarScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload  = () => resolve();
        s.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
        document.head.appendChild(s);
    });
}

async function generarPDFInventario(filas: FilaInventario[], total: number, fecha: string) {
    // Cargar jsPDF y autoTable desde CDN via script tag (compatible con Next.js)
    await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');

    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();

    // ── Encabezado ──
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Inventario Valorizado', 14, 10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${fecha}`, 14, 16);

    // ── Resumen ──
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total productos: ${filas.length}`, 14, 30);
    doc.text(`Valor total inventario: $${fmt(total)} MXN`, 14, 36);
    doc.setFont('helvetica', 'normal');

    // ── Tabla ──
    (doc as any).autoTable({
        startY: 44,
        head: [['Producto', 'SKU', 'Categoría', 'Stock', 'Costo Unit.', 'Valor Total']],
        body: filas.map(f => [
            f.nombre,
            f.sku,
            f.categoria,
            f.stock.toString(),
            `$${fmt(f.costoUnitario)}`,
            `$${fmt(f.valorTotal)}`,
        ]),
        foot: [['TOTAL', '', '', '', '', `$${fmt(total)}`]],
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 55 },
            1: { cellWidth: 25 },
            2: { cellWidth: 28 },
            3: { cellWidth: 16, halign: 'center' },
            4: { cellWidth: 28, halign: 'right' },
            5: { cellWidth: 30, halign: 'right' },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
    });

    // ── Pie ──
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${i} de ${pageCount}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }

    doc.save(`inventario-valorizado-${new Date().toISOString().slice(0,10)}.pdf`);
}

// ── Sección de Inventario Valorizado ──────────────────────────────────────────
function InventarioValorizadoSection() {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loading, setLoading]     = useState(false);
    const [loaded, setLoaded]       = useState(false);
    const [error, setError]         = useState('');
    const [generando, setGenerando] = useState(false);

    const cargar = async () => {
        setLoading(true); setError('');
        try {
            const data = await fetchApi('/products');
            setProductos(data);
            setLoaded(true);
        } catch (e: any) {
            setError(e.message || 'Error al cargar productos');
        } finally {
            setLoading(false);
        }
    };

    const filas: FilaInventario[] = productos
        .map(p => ({
            nombre: p.nombre,
            sku: p.sku,
            categoria: p.categoria?.nombre || 'Sin categoría',
            stock: Number(p.stock ?? 0),
            costoUnitario: Number(p.ultimoPrecioCompra ?? 0),
            valorTotal: Number(p.stock ?? 0) * Number(p.ultimoPrecioCompra ?? 0),
        }))
        .sort((a, b) => b.valorTotal - a.valorTotal);

    const total = filas.reduce((a, f) => a + f.valorTotal, 0);

    const handleDescargar = async () => {
        if (!loaded) await cargar();
        setGenerando(true);
        try {
            const fecha = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
            await generarPDFInventario(filas, total, fecha);
        } catch (e: any) {
            setError('Error al generar el PDF. Intenta de nuevo.');
        } finally {
            setGenerando(false);
        }
    };

    return (
        <Card className="border-emerald-200 bg-emerald-50/30">
            <CardContent className="p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700 flex-shrink-0">
                        <DollarSignIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900">Inventario Valorizado</h3>
                        <p className="text-sm text-gray-500 mt-1 mb-4">
                            Tabla completa: producto, SKU, stock actual, costo unitario y valor total por producto.
                            El PDF se genera al momento con los datos actuales.
                        </p>

                        {error && (
                            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                                <AlertTriangle size={14} /> {error}
                            </div>
                        )}

                        {/* Vista previa de la tabla si ya se cargó */}
                        {loaded && filas.length > 0 && (
                            <div className="mb-4 rounded-xl border border-gray-100 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vista previa — {filas.length} productos</span>
                                    <span className="text-xs font-bold text-emerald-700">Total: ${fmt(total)}</span>
                                </div>
                                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-900 text-white sticky top-0">
                                            <tr>
                                                {['Producto','SKU','Categoría','Stock','Costo Unit.','Valor Total'].map(h => (
                                                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filas.map((f, i) => (
                                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[160px] truncate">{f.nombre}</td>
                                                    <td className="px-3 py-2 text-gray-500 font-mono">{f.sku}</td>
                                                    <td className="px-3 py-2 text-gray-500">{f.categoria}</td>
                                                    <td className="px-3 py-2 text-center text-gray-700">{f.stock}</td>
                                                    <td className="px-3 py-2 text-right text-gray-700">${fmt(f.costoUnitario)}</td>
                                                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">${fmt(f.valorTotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-100 border-t-2 border-slate-200">
                                            <tr>
                                                <td colSpan={5} className="px-3 py-2 font-bold text-gray-800 text-right">TOTAL</td>
                                                <td className="px-3 py-2 font-bold text-emerald-700 text-right">${fmt(total)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                            {!loaded && (
                                <button
                                    onClick={cargar}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors text-sm disabled:opacity-60"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                    {loading ? 'Cargando...' : 'Ver vista previa'}
                                </button>
                            )}
                            <button
                                onClick={handleDescargar}
                                disabled={generando || loading}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors text-sm shadow-sm disabled:opacity-60"
                            >
                                {generando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                {generando ? 'Generando PDF...' : 'Descargar PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ── Reportes estáticos (los otros 3) ──────────────────────────────────────────
const otrosReportes = [
    {
        id: 'rotacion',
        title: 'Rotación de Productos',
        description: 'Muestra los productos de mayor y menor movimiento (entradas/salidas) en el período.',
        icon: <TrendingUp size={24} />,
        color: 'bg-blue-100 text-blue-700',
    },
    {
        id: 'kardex_historico',
        title: 'Kardex Histórico Detallado',
        description: 'Exporta todos los movimientos de un producto o categoría a lo largo del tiempo.',
        icon: <FileText size={24} />,
        color: 'bg-purple-100 text-purple-700',
    },
    {
        id: 'compras_proveedor',
        title: 'Compras por Proveedor',
        description: 'Resumen de gastos y volumen de compra segmentado por cada proveedor.',
        icon: <BarChart3 size={24} />,
        color: 'bg-orange-100 text-orange-700',
    },
];

// ── Componente principal ───────────────────────────────────────────────────────
export default function ReportsPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
                    <p className="text-sm text-gray-500 mt-1">Genera y exporta análisis detallados de tu inventario.</p>
                </div>
            </div>

            {/* Configuración global (decorativa por ahora) */}
            <Card className="mb-8">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <Filter className="mr-2" size={20} /> Configuración Global de Reportes
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Período de Fecha</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <select className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 text-gray-800">
                                    <option>Últimos 30 días</option>
                                    <option>Este mes</option>
                                    <option>Mes anterior</option>
                                    <option>Este año</option>
                                    <option>Personalizado...</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Almacén</label>
                            <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 text-gray-800">
                                <option>Todos los almacenes</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Formato de Exportación</label>
                            <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 text-gray-800">
                                <option>Documento PDF (.pdf)</option>
                                <option>Hoja de Cálculo (.xlsx)</option>
                                <option>Datos (.csv)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </Card>

            <h2 className="text-xl font-bold text-gray-800 mb-4">Tipos de Reportes Disponibles</h2>

            <div className="space-y-4">
                {/* ── Inventario Valorizado — FUNCIONAL ── */}
                <InventarioValorizadoSection />

                {/* ── Otros reportes (placeholder) ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {otrosReportes.map((report) => (
                        <Card key={report.id} className="hover:border-blue-300 hover:shadow-md transition-all group opacity-70">
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl ${report.color}`}>
                                        {report.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
                                        <p className="text-sm text-gray-500 mt-1 mb-4">{report.description}</p>
                                        <div className="flex gap-2">
                                            <button disabled className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 font-medium rounded-lg text-sm cursor-not-allowed">
                                                <FileText size={16} /> Próximamente
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
