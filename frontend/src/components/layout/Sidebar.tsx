"use client";
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Truck, ShoppingCart, LogOut, ArrowRightLeft, FileText, Upload, Settings, Users } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';

const NAV = [
    { href: '/dashboard',           icon: <LayoutDashboard size={20}/>, label: 'Dashboard' },
    { href: '/dashboard/products',  icon: <Package size={20}/>,         label: 'Productos' },
    { href: '/dashboard/inventory', icon: <ArrowRightLeft size={20}/>,  label: 'Kardex / Movimientos' },
    { href: '/dashboard/purchases', icon: <ShoppingCart size={20}/>,    label: 'Compras (Entradas)' },
    { href: '/dashboard/sales',     icon: <Upload size={20}/>,          label: 'Registrar Salidas' },
    { href: '/dashboard/suppliers', icon: <Truck size={20}/>,           label: 'Proveedores' },
    { href: '/dashboard/clients',   icon: <Users size={20}/>,           label: 'Clientes' },
    { href: '/dashboard/reports',   icon: <FileText size={20}/>,        label: 'Reportes' },
    { href: '/dashboard/settings',  icon: <Settings size={20}/>,        label: 'Parámetros' },
];

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const { company, companySlug } = useCompany();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('companySlug');
        router.push(companySlug ? `/login?company=${companySlug}` : '/login');
    };

    const isActive = (href: string) =>
        href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

    return (
        <div className="flex flex-col w-64 h-screen bg-gray-900 text-white shadow-xl">

            {/* Header — logo o iniciales */}
            <div className="flex items-center justify-center h-20 border-b border-gray-800 px-4">
                {company ? (
                    company.logo ? (
                        /* Logo subido */
                        <div className="flex items-center justify-center w-full h-full py-3 px-2">
                            <img
                                src={company.logo}
                                alt={company.nombre}
                                className="max-h-10 max-w-full object-contain"
                                style={{ filter: 'brightness(0) invert(1)' }} // blanco sobre fondo oscuro
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </div>
                    ) : (
                        /* Iniciales + nombre */
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-bold text-lg">{company.nombre[0].toUpperCase()}</span>
                            </div>
                            <h1 className="text-base font-bold text-white truncate">{company.nombre}</h1>
                        </div>
                    )
                ) : (
                    <h1 className="text-2xl font-bold tracking-tight text-blue-400">Inventory<span className="text-white">SaaS</span></h1>
                )}
            </div>

            {/* Nav */}
            <div className="flex flex-col flex-1 p-4 space-y-1 overflow-y-auto">
                {NAV.map(item => (
                    <Link key={item.href} href={item.href}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                            isActive(item.href)
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }`}>
                        {item.icon}
                        <span>{item.label}</span>
                    </Link>
                ))}
            </div>

            {/* Logout */}
            <div className="p-4 border-t border-gray-800">
                <button onClick={handleLogout}
                    className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-gray-400 transition-colors rounded-lg hover:bg-red-900/50 hover:text-red-400">
                    <LogOut size={20}/>
                    <span className="font-medium">Cerrar Sesión</span>
                </button>
            </div>
        </div>
    );
}
