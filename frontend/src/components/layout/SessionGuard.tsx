'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ── Tiempos ────────────────────────────────────────────────────────────────────
const INACTIVITY_MS   = 15 * 60 * 1000;  // 15 min sin actividad → mostrar aviso
const WARNING_MS      =  2 * 60 * 1000;  // 2 min para responder antes de cerrar sesión
const REFRESH_MS      = 30 * 60 * 1000;  // Renovar token silencioso cada 30 min de actividad

// ── Eventos de actividad del usuario ─────────────────────────────────────────
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
    'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click',
];

function logout(companySlug: string | null) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    const url = companySlug ? `/login?company=${companySlug}&reason=expired` : '/login?reason=expired';
    window.location.href = url;
}

async function refreshToken(): Promise<boolean> {
    try {
        const token = localStorage.getItem('token');
        if (!token) return false;
        const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!res.ok) return false;
        const { token: newToken } = await res.json();
        localStorage.setItem('token', newToken);
        return true;
    } catch {
        return false;
    }
}

// ── Contador regresivo ─────────────────────────────────────────────────────────
function Countdown({ seconds }: { seconds: number }) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return (
        <span className="font-mono font-bold text-red-600 tabular-nums">
            {m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`}
        </span>
    );
}

// ── Modal de advertencia ───────────────────────────────────────────────────────
function SessionWarningModal({
    secondsLeft,
    onStay,
    onLogout,
}: {
    secondsLeft: number;
    onStay: () => void;
    onLogout: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                {/* Icono */}
                <div className="flex justify-center">
                    <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                        <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    </div>
                </div>

                {/* Texto */}
                <div className="text-center space-y-1.5">
                    <h3 className="text-lg font-bold text-gray-900">¿Sigues ahí?</h3>
                    <p className="text-sm text-gray-500">
                        Llevas 15 minutos sin actividad. Tu sesión se cerrará en{' '}
                        <Countdown seconds={secondsLeft} />.
                    </p>
                </div>

                {/* Barra de progreso */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${(secondsLeft / (WARNING_MS / 1000)) * 100}%` }}
                    />
                </div>

                {/* Botones */}
                <div className="flex gap-3">
                    <button
                        onClick={onLogout}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        Cerrar sesión
                    </button>
                    <button
                        onClick={onStay}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                    >
                        Seguir conectado
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function SessionGuard({ children }: { children: React.ReactNode }) {
    const [showWarning, setShowWarning] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(WARNING_MS / 1000);

    const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const warningTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
    const refreshTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastActivityRef = useRef<number>(Date.now());

    const companySlug = typeof window !== 'undefined' ? localStorage.getItem('companySlug') : null;

    // ── Limpiar todos los timers ──
    const clearAll = useCallback(() => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (warningTimer.current)    clearTimeout(warningTimer.current);
        if (countdownRef.current)    clearInterval(countdownRef.current);
        if (refreshTimer.current)    clearTimeout(refreshTimer.current);
    }, []);

    // ── Iniciar contador de cierre de sesión (modal visible) ──
    const startCountdown = useCallback(() => {
        setSecondsLeft(WARNING_MS / 1000);
        countdownRef.current = setInterval(() => {
            setSecondsLeft(s => {
                if (s <= 1) {
                    clearInterval(countdownRef.current!);
                    logout(companySlug);
                    return 0;
                }
                return s - 1;
            });
        }, 1000);

        // Seguro extra: cerrar sesión cuando se agote el tiempo
        warningTimer.current = setTimeout(() => {
            logout(companySlug);
        }, WARNING_MS + 500);
    }, [companySlug]);

    // ── Mostrar modal de advertencia ──
    const showInactivityWarning = useCallback(() => {
        setShowWarning(true);
        startCountdown();
    }, [startCountdown]);

    // ── Reiniciar el timer de inactividad ──
    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(showInactivityWarning, INACTIVITY_MS);
    }, [showInactivityWarning]);

    // ── Renovar token silenciosamente y reiniciar timer de renovación ──
    const scheduleRefresh = useCallback(() => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(async () => {
            const ok = await refreshToken();
            if (ok) scheduleRefresh(); // volver a programar si tuvo éxito
            // Si falla, el próximo fetchApi recibirá 401 y redirigirá al login
        }, REFRESH_MS);
    }, []);

    // ── Manejador de actividad del usuario ──
    const handleActivity = useCallback(() => {
        if (showWarning) return; // si el modal está visible, ignorar actividad
        lastActivityRef.current = Date.now();
        resetInactivityTimer();
    }, [showWarning, resetInactivityTimer]);

    // ── El usuario hace clic en "Seguir conectado" ──
    const handleStay = useCallback(async () => {
        clearAll();
        setShowWarning(false);
        const ok = await refreshToken();
        if (!ok) {
            logout(companySlug);
            return;
        }
        resetInactivityTimer();
        scheduleRefresh();
    }, [clearAll, companySlug, resetInactivityTimer, scheduleRefresh]);

    // ── El usuario hace clic en "Cerrar sesión" ──
    const handleLogout = useCallback(() => {
        clearAll();
        logout(companySlug);
    }, [clearAll, companySlug]);

    // ── Montar: registrar listeners y arrancar timers ──
    useEffect(() => {
        // No ejecutar en SSR
        if (typeof window === 'undefined') return;

        // Verificar que hay token; si no, no hace nada (login se encarga)
        const token = localStorage.getItem('token');
        if (!token) return;

        ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
        resetInactivityTimer();
        scheduleRefresh();

        return () => {
            ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity));
            clearAll();
        };
    }, [handleActivity, resetInactivityTimer, scheduleRefresh, clearAll]);

    return (
        <>
            {children}
            {showWarning && (
                <SessionWarningModal
                    secondsLeft={secondsLeft}
                    onStay={handleStay}
                    onLogout={handleLogout}
                />
            )}
        </>
    );
}
