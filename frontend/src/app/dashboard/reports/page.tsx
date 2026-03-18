import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { FileText, Download, Calendar, BarChart3, TrendingUp, Filter } from 'lucide-react';

const reportTypes = [
    {
        id: 'stock_valorizado',
        title: 'Inventario Valorizado',
        description: 'Calcula el valor monetario total del inventario actual por categoría y almacén.',
        icon: <DollarSignIcon />,
        color: 'bg-emerald-100 text-emerald-700'
    },
    {
        id: 'rotacion',
        title: 'Rotación de Productos',
        description: 'Muestra los productos de mayor y menor movimiento (entradas/salidas) en el período.',
        icon: <TrendingUp />,
        color: 'bg-blue-100 text-blue-700'
    },
    {
        id: 'kardex_historico',
        title: 'Kardex Histórico Detallado',
        description: 'Exporta todos los movimientos de un producto o categoría a lo largo del tiempo.',
        icon: <FileText />,
        color: 'bg-purple-100 text-purple-700'
    },
    {
        id: 'compras_proveedor',
        title: 'Compras por Proveedor',
        description: 'Resumen de gastos y volumen de compra segmentado por cada proveedor.',
        icon: <BarChart3 />,
        color: 'bg-orange-100 text-orange-700'
    }
];

function DollarSignIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
    );
}

export default function ReportsPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
                    <p className="text-sm text-gray-500 mt-1">Genera y exporta análisis detallados de tu inventario.</p>
                </div>
            </div>

            {/* Report Configuration Area */}
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
                                <option>Almacén Principal</option>
                                <option>Sucursal Norte</option>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reportTypes.map((report) => (
                    <Card key={report.id} className="hover:border-blue-300 hover:shadow-md transition-all group">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${report.color}`}>
                                    {report.icon}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{report.title}</h3>
                                    <p className="text-sm text-gray-500 mt-1 mb-4">{report.description}</p>

                                    <div className="flex gap-2">
                                        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors text-sm">
                                            <FileText size={16} /> Ver Vista Previa
                                        </button>
                                        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors text-sm shadow-sm">
                                            <Download size={16} /> Exportar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
