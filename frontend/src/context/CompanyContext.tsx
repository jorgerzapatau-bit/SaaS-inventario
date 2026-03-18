"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchApi } from '@/lib/api';

interface CompanyInfo {
    id: string;
    nombre: string;
    url: string;
    logo?: string | null;
}

interface CompanyContextType {
    company: CompanyInfo | null;
    companySlug: string | null;
    loading: boolean;
}

const CompanyContext = createContext<CompanyContextType>({
    company: null,
    companySlug: null,
    loading: true,
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
                .then((data) => setCompany(data))
                .catch(() => {})
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    return (
        <CompanyContext.Provider value={{ company, companySlug, loading }}>
            {children}
        </CompanyContext.Provider>
    );
}

export const useCompany = () => useContext(CompanyContext);
