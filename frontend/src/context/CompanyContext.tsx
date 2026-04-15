"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchApi } from '@/lib/api';

interface CompanyInfo {
    id: string;
    nombre: string;
    url: string;
    logo?: string | null;
    moneda: string;
}

interface CompanyContextType {
    company: CompanyInfo | null;
    companySlug: string | null;
    loading: boolean;
    moneda: string;
}

const CompanyContext = createContext<CompanyContextType>({
    company: null,
    companySlug: null,
    loading: true,
    moneda: 'MXN',
});

export function CompanyProvider({ children }: { children: ReactNode }) {
    const [company, setCompany] = useState<CompanyInfo | null>(null);
    const [companySlug, setCompanySlug] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const slug = localStorage.getItem('companySlug');
        setCompanySlug(slug);

        if (slug) {
            fetchApi(`/company/${slug}`)
                .then((data) => setCompany({ ...data, moneda: data.moneda || 'MXN' }))
                .catch(() => {})
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    return (
        <CompanyContext.Provider value={{ company, companySlug, loading, moneda: company?.moneda || 'MXN' }}>
            {children}
        </CompanyContext.Provider>
    );
}

export const useCompany = () => useContext(CompanyContext);
