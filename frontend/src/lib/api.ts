export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
    let token = null;
    let empresaId = null;
    let companySlug = null;

    if (typeof window !== 'undefined') {
        token = localStorage.getItem('token');
        companySlug = localStorage.getItem('companySlug');
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                empresaId = user.empresaId;
            }
        } catch (e) {}
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
            headers[key] = String(value);
        });
    }

    if (token)     headers['Authorization'] = `Bearer ${token}`;
    if (empresaId) headers['X-Empresa-Id'] = empresaId;

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

    // Token expirado o inválido — redirigir al login automáticamente
    if (response.status === 401) {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            const loginUrl = companySlug ? `/login?company=${companySlug}` : '/login';
            window.location.href = loginUrl;
        }
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
    }

    if (!response.ok) {
        let errorMsg = 'Error en la petición';
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
    }

    return response.json();
};
