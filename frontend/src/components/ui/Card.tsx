import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
            {children}
        </div>
    );
}

export function CardHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: React.ReactNode }) {
    return (
        <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
                {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
            </div>
            {icon && <div className="text-blue-500 bg-blue-50 p-3 rounded-lg">{icon}</div>}
        </div>
    );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`p-6 ${className}`}>{children}</div>;
}
