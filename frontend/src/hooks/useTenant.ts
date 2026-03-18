"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface UserContext {
    id: string;
    empresaId: string;
    nombre: string;
    email: string;
    role: string;
}

export function useTenant() {
    const [user, setUser] = useState<UserContext | null>(null);
    const router = useRouter();

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            router.push('/login');
            return;
        }

        try {
            const parsedUser = JSON.parse(userStr);
            setUser(parsedUser);
        } catch {
            router.push('/login');
        }
    }, [router]);

    return { user, empresaId: user?.empresaId || '' };
}
