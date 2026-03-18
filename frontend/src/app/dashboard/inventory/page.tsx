"use client";

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Search, Filter, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

export default function KardexPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [movements, setMovements] = useState<any[]>([]);

    useEffect(() => {
        const loadProducts = async () => {
            try {
                const data = await fetchApi('/products');
                setProducts(data);
                if (data.length > 0) {
                    setSelectedProduct(data[0].id);
                }
            } catch (err) {
                console.error("Error loading products");
            } finally {
                setLoading(false);
            }
        };
        loadProducts();
    }, []);

    useEffect(() => {
        if (!selectedProduct) return;
        const loadKardex = async () => {
            try {
                const data = await fetchApi(`/inventory/kardex/${selectedProduct}`);
                setMovements(data);
            } catch (err) {
                console.error("Error loading kardex");
            }
        };
        loadKardex();
    }, [selectedProduct]);


    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Kardex de Producto</h1>
                    <p className="text-sm text-gray-500 mt-1">Historial inmutable de inventario (Fuente de Verdad).</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/dashboard/purchases" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors shadow-sm">
                        <ArrowDownToLine size={18} className="text-green-600" />
                        Registrar Entrada
                    </Link>
                    <Link href="/dashboard/sales" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors shadow-sm">
                        <ArrowUpFromLine size={18} className="text-orange-600" />
                        Registrar Salida
                    </Link>
                </div>
            </div>

            <Card>
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between gap-4 bg-gray-50">
                    <div className="flex items-center gap-3 w-full max-w-md">
                        <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Seleccionar Producto:</label>
                        <select
                            className="bg-white border text-gray-800 border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                        >
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.sku} - {p.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white border-b border-gray-100">
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo Mov.</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Referencia</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Cant.</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Costo Unit.</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Costo Total</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {movements.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-500">
                                        No hay movimientos registrados para este producto.
                                    </td>
                                </tr>
                            ) : (
                                movements.map((mov) => {
                                    const total = Number(mov.costoUnitario) * mov.cantidad;
                                    const isIngreso = ['ENTRADA', 'AJUSTE_POSITIVO'].includes(mov.tipoMovimiento);

                                    return (
                                        <tr key={mov.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="p-4 text-sm font-medium text-gray-600 whitespace-nowrap">
                                                {new Date(mov.fecha).toLocaleString()}
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${isIngreso ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {mov.tipoMovimiento.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-700">{mov.referencia || '-'}</td>
                                            <td className="p-4 text-right">
                                                <span className={`text-sm font-bold ${isIngreso ? 'text-green-600' : 'text-orange-600'}`}>
                                                    {isIngreso ? '+' : '-'}{mov.cantidad}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm font-medium text-gray-600 text-right">${Number(mov.costoUnitario).toFixed(2)}</td>
                                            <td className="p-4 text-sm font-bold text-gray-700 text-right">${total.toFixed(2)}</td>
                                            <td className="p-4 text-sm text-gray-500">{mov.usuario?.nombre || 'Desconocido'}</td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
