"use client";
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { Eye, EyeOff } from 'lucide-react';

const DEFAULT_BG = 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&q=80';

interface CompanyInfo {
    id: string;
    nombre: string;
    logo?: string | null;
    loginBg?: string | null;
}

function LoginForm() {
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);
    const [companyInfo, setCompanyInfo]         = useState<CompanyInfo | null>(null);
    const [loadingCompany, setLoadingCompany]   = useState(true);
    const [companyNotFound, setCompanyNotFound] = useState(false);
    const [bgImage, setBgImage] = useState<string>(DEFAULT_BG);

    const router       = useRouter();
    const searchParams = useSearchParams();
    const companySlug  = searchParams.get('company');

    useEffect(() => {
        if (companySlug) {
            fetchApi(`/company/${companySlug}`)
                .then((data: CompanyInfo) => {
                    setCompanyInfo(data);
                    if (data.loginBg) setBgImage(data.loginBg);
                })
                .catch(() => setCompanyNotFound(true))
                .finally(() => setLoadingCompany(false));
        } else {
            setLoadingCompany(false);
        }
    }, [companySlug]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const data = await fetchApi('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            if (companyInfo && data.user.empresaId !== companyInfo.id) {
                setError('Este usuario no pertenece a esta empresa.');
                setLoading(false); return;
            }
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            if (companySlug) localStorage.setItem('companySlug', companySlug);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Credenciales incorrectas');
        } finally {
            setLoading(false);
        }
    };

    if (loadingCompany) return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        </div>
    );

    if (companyNotFound) return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center">
            <div className="text-center bg-white rounded-2xl p-8 shadow-xl max-w-sm mx-4">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Empresa no encontrada</h2>
                <p className="text-gray-500 text-sm">La empresa <span className="font-semibold text-red-500">"{companySlug}"</span> no existe.</p>
                <p className="text-xs text-gray-400 mt-2">Verifica la URL e intenta de nuevo.</p>
            </div>
        </div>
    );

    return (
        /* Fondo: misma imagen con overlay azul oscuro */
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Imagen de fondo con overlay */}
            <div className="absolute inset-0">
                <img
                    src={bgImage}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setBgImage(DEFAULT_BG)}
                />
                <div className="absolute inset-0 bg-blue-900/70"/>
            </div>

            {/* Logo arriba a la izquierda */}
            {companyInfo?.logo && (
                <div className="absolute top-6 left-8 z-20">
                    <img src={companyInfo.logo} alt={companyInfo.nombre}
                        className="h-14 object-contain drop-shadow-lg"/>
                </div>
            )}

            {/* Tarjeta central — más ancha, menos alta */}
            <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">

                {/* Imagen superior de la tarjeta — menos altura */}
                <div className="h-44 overflow-hidden">
                    <img
                        src={bgImage}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => setBgImage(DEFAULT_BG)}
                    />
                </div>

                {/* Contenido del formulario */}
                <div className="px-10 py-7">

                    <h1 className="text-2xl font-extrabold text-gray-900 mb-1">¡Bienvenido de nuevo!</h1>
                    <p className="text-sm text-gray-400 mb-6">
                        {companyInfo ? companyInfo.nombre : 'Inventario SaaS'} · Inicia sesión para continuar
                    </p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Correo electrónico
                            </label>
                            <input
                                type="email" required
                                value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="tu@correo.com"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder-gray-300"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    type={showPass ? 'text' : 'password'} required
                                    value={password} onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder-gray-300 pr-12"
                                />
                                <button type="button" onClick={() => setShowPass(s => !s)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                                    {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading || !companyInfo}
                            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-md shadow-blue-500/25 transition-all disabled:opacity-60 text-sm mt-2">
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                                    Ingresando...
                                </span>
                            ) : 'Iniciar Sesión'}
                        </button>
                    </form>

                    {!companySlug && (
                        <div className="mt-5 text-center text-xs text-gray-400 space-y-1">
                            <p>Agrega <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">?company=slug</span> a la URL</p>
                            <p>Ej: <span className="font-mono text-blue-500">localhost:3000/login?company=demo</span></p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"/>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
