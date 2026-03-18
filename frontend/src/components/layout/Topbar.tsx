"use client";
import { Bell, UserCircle } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useEffect, useState } from 'react';

export default function Topbar() {
    const { company } = useCompany();
    const [userName, setUserName] = useState('');

    useEffect(() => {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                setUserName(user.nombre || user.email || 'Admin');
            }
        } catch (e) {}
    }, []);

    return (
        <div className="flex items-center justify-between h-20 px-8 bg-white border-b border-gray-100 shadow-sm z-10 sticky top-0">
            <div>
                <h2 className="text-xl font-semibold text-gray-800">Panel de Control</h2>
                <p className="text-sm text-gray-500">{company?.nombre || ''}</p>
            </div>
            <div className="flex items-center gap-6">
                <button className="relative p-2 text-gray-400 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-600">
                    <Bell size={24} />
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
                <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
                    <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">{userName}</p>
                        <p className="text-xs text-gray-500">{company?.nombre || ''}</p>
                    </div>
                    <UserCircle size={36} className="text-gray-300" />
                </div>
            </div>
        </div>
    );
}
