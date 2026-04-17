"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchApi } from '@/lib/api';

interface CompanyInfo {
    id: string;
    nombre: string;
    url: string;
    logo?: string | null;
    moneda: string;
    tipoCambio?: number | null;
}

interface CompanyContextType {
    company: CompanyInfo | null;
    companySlug: string | null;
    loading: boolean;
    moneda: string;
    tipoCambio: number;
}

const CompanyContext = createContext<CompanyContextType>({
    company: null,
    companySlug: null,
    loading: true,
    moneda: 'MXN',
    tipoCambio: 17,
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
                .then((data) =>
                    setCompany({
                        ...data,
                        moneda: data.moneda || 'MXN',
                        tipoCambio: data.tipoCambio ?? 17,
                    })
                )
                .catch(() => {})
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    return (
        <CompanyContext.Provider
            value={{
                company,
                companySlug,
                loading,
                moneda: company?.moneda || 'MXN',
                tipoCambio: company?.tipoCambio ?? 17,
            }}
        >
            {children}
        </CompanyContext.Provider>
    );
}

export const useCompany = () => useContext(CompanyContext);
