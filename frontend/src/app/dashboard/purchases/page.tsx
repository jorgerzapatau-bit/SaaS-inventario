"use client";

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Search, Plus, Filter } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

export default function PurchasesPage() {
    const [compras, setCompras] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadCompras = async () => {
            try {
                const data = await fetchApi('/purchases');
                setCompras(data);
            } catch (err: any) {
                setError(err.message || 'Error al cargar compras');
            } finally {
                setLoading(false);
            }
        };

        loadCompras();
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Compras (Entradas)</h1>
                    <p className="text-sm text-gray-500 mt-1">Registra órdenes de compra y recibe el inventario automáticamente.</p>
                </div>
                <Link href="/dashboard/purchases/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm">
                    <Plus size={18} />
                    Nueva Compra
                </Link>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">
                    {error}
                </div>
            )}

            <Card>
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por referencia o proveedor..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans text-gray-800"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                            <Filter size={16} /> Filtrar
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Referencia</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Proveedor</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Items Contenidos</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total Facturado</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        Cargando compras...
                                    </td>
                                </tr>
                            ) : compras.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        No se encontraron compras. Registra tu primera orden.
                                    </td>
                                </tr>
                            ) : (
                                compras.map((compra) => (
                                    <tr key={compra.id} className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                                        <td className="p-4 text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{compra.referencia}</td>
                                        <td className="p-4 text-sm font-medium text-gray-600">{compra.proveedor?.nombre || 'Desconocido'}</td>
                                        <td className="p-4 text-sm text-gray-500">{new Date(compra.fechaEmision).toLocaleDateString()}</td>
                                        <td className="p-4 text-sm font-medium text-gray-700 text-right">{compra.detalles?.length || 0} unidades</td>
                                        <td className="p-4 text-sm font-bold text-gray-800 text-right">${Number(compra.total).toFixed(2)}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${compra.estado === 'COMPLETADA' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                {compra.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
