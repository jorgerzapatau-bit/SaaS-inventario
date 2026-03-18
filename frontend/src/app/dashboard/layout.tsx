import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { CompanyProvider } from '@/context/CompanyContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <CompanyProvider>
            <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
                <Sidebar />
                <div className="flex flex-col flex-1 overflow-hidden">
                    <Topbar />
                    <main className="flex-1 overflow-y-auto p-8">
                        {children}
                    </main>
                </div>
            </div>
        </CompanyProvider>
    );
}
