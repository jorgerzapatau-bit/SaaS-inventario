"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Wrench, ArrowLeft, Plus, Trash2,
    CheckCircle, XCircle, Gauge, Droplets,
    ChevronDown, ChevronUp, Calendar,
    Package, History, X, AlertCircle,
    ArrowRightLeft, MapPin, ClipboardList,
    AlertTriangle, BoxesIcon, DollarSign,
    CheckCheck, Clock, Settings2, Search, Pencil,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type Registro = {
    id: string;
    fecha: string;
    horasTrabajadas: number;
    barrenos: number;
    metrosLineales: number;
    litrosDiesel: number;
    precioDiesel: number;
    costoDiesel: number;
    operadores: number;
    peones: number;
    obraNombre: string | null;
    semanaNum: number | null;
    anoNum: number | null;
    kpi: { litrosPorHora: number | null; litrosPorMetro: number | null; metrosPorHora: number | null };
    usuario: { nombre: string };
};

type Equipo = {
    id: string;
    nombre: string;
    modelo: string | null;
    numeroSerie: string | null;
    numeroEconomico: string | null;
    hodometroInicial: number;
    activo: boolean;
    notas: string | null;
    apodo: string | null;
    seriePistolaActual: string | null;
    statusEquipo: string | null;
    _count: { registrosDiarios: number };
};

type MovimientoComponente = {
    id: string;
    tipo: string;
    fecha: string;
    notas: string;
    equipo: { id: string; nombre: string; numeroEconomico: string | null } | null;
};

type Componente = {
    id: string;
    nombre: string;
    serie: string | null;
    tipo: string | null;
    notas: string | null;
    equipoActualId: string | null;
    ubicacion: string;
    historial: MovimientoComponente[];
};

type RegistroMant = {
    id: string;
    fecha: string;
    tipo: string | null;
    descripcion: string;
    observaciones: string | null;
    horometro: number | null;
    hrsUso: number | null;
    costo: number | null;
    moneda: string | null;
    numeroParte: string | null;
    proveedorId: string | null;
};

type Pendiente = {
    id: string;
    descripcion: string;
    observacion: string | null;
    horometro: number | null;
    fecha: string;
    resuelto: boolean;
    fechaResuelto: string | null;
};

type InventarioItem = {
    id: string;
    descripcion: string;
    cantidad: number;
    observacion: string | null;
    fecha: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_MOV: Record<string, { label: string; pill: string }> = {
    INSTALACION:        { label: 'Instalación',       pill: 'bg-green-100 text-green-700' },
    RETIRO:             { label: 'Retiro',             pill: 'bg-amber-100 text-amber-700' },
    ENVIO_REPARACION:   { label: 'Envío a reparación', pill: 'bg-red-100 text-red-700'    },
    RETORNO_REPARACION: { label: 'Retorno reparación', pill: 'bg-blue-100 text-blue-700'  },
};

const TIPO_MANT: Record<string, { label: string; pill: string }> = {
    PREVENTIVO:  { label: 'Preventivo',  pill: 'bg-blue-100 text-blue-700'   },
    CORRECTIVO:  { label: 'Correctivo',  pill: 'bg-red-100 text-red-700'     },
    PREDICTIVO:  { label: 'Predictivo',  pill: 'bg-purple-100 text-purple-700'},
    INSPECCION:  { label: 'Inspección',  pill: 'bg-gray-100 text-gray-600'   },
};

function fmtFecha(iso: string) {
    return new Date(iso + (iso.includes('T') ? '' : 'T12:00:00'))
        .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'registros' | 'mantenimiento' | 'pendientes' | 'inventario' | 'componentes';

// ─── Modal: Registrar movimiento de componente ────────────────────────────────

type MovModalProps = {
    componente: Componente;
    equipoActualId: string;
    onClose: () => void;
    onSuccess: () => void;
};

function MovimientoModal({ componente, equipoActualId, onClose, onSuccess }: MovModalProps) {
    const estaAqui = componente.equipoActualId === equipoActualId;
    const [tipo,   setTipo]   = useState(estaAqui ? 'RETIRO' : 'INSTALACION');
    const [fecha,  setFecha]  = useState(new Date().toISOString().slice(0, 10));
    const [notas,  setNotas]  = useState('');
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    const handleGuardar = async () => {
        if (notas.trim().length < 5) { setError('Las notas deben tener al menos 5 caracteres.'); return; }
        setSaving(true); setError('');
        try {
            const body: Record<string, unknown> = { tipo, fecha, notas: notas.trim() };
            if (tipo === 'INSTALACION' || tipo === 'RETORNO_REPARACION') {
                body.equipoId = equipoActualId;
            }
            await fetchApi(`/componentes/${componente.id}/movimientos`, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Registrar movimiento</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {componente.nombre}{componente.serie ? ` · S/N ${componente.serie}` : ''}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Tipo de movimiento</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(TIPO_MOV).map(([key, { label }]) => (
                                <button
                                    key={key}
                                    onClick={() => setTipo(key)}
                                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-left ${
                                        tipo === key
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha</label>
                        <input
                            type="date"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            Notas <span className="text-gray-400 font-normal">(obligatorio)</span>
                        </label>
                        <textarea
                            value={notas}
                            onChange={e => setNotas(e.target.value)}
                            rows={3}
                            placeholder={
                                tipo === 'INSTALACION'      ? 'Ej: Se instaló en Track-02 para reemplazar pistola dañada' :
                                tipo === 'RETIRO'           ? 'Ej: Se retiró por desgaste en empaque, va a taller' :
                                tipo === 'ENVIO_REPARACION' ? 'Ej: Enviada a taller Suárez para reparación de empaque' :
                                                              'Ej: Retornó de reparación en buen estado, lista para instalar'
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                        />
                    </div>

                    {(tipo === 'INSTALACION' || tipo === 'RETORNO_REPARACION') && (
                        <div className="flex items-start gap-2 bg-blue-50 text-blue-700 rounded-lg px-3 py-2 text-xs">
                            <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                            <span>El componente quedará registrado en <strong>este equipo</strong> después del movimiento.</span>
                        </div>
                    )}
                    {(tipo === 'RETIRO' || tipo === 'ENVIO_REPARACION') && (
                        <div className="flex items-start gap-2 bg-amber-50 text-amber-700 rounded-lg px-3 py-2 text-xs">
                            <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                            <span>El componente quedará en <strong>Taller / Almacén</strong> y se desvinculará de este equipo.</span>
                        </div>
                    )}

                    {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleGuardar}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                    >
                        {saving ? 'Guardando...' : 'Guardar movimiento'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Nuevo componente ──────────────────────────────────────────────────

type NuevoCompModalProps = {
    equipoId: string;
    onClose: () => void;
    onSuccess: () => void;
};

function NuevoComponenteModal({ equipoId, onClose, onSuccess }: NuevoCompModalProps) {
    const [nombre,   setNombre]   = useState('');
    const [serie,    setSerie]    = useState('');
    const [tipo,     setTipo]     = useState('');
    const [notas,    setNotas]    = useState('');
    const [instalar, setInstalar] = useState(true);
    const [fecha,    setFecha]    = useState(new Date().toISOString().slice(0, 10));
    const [notasMov, setNotasMov] = useState('');
    const [saving,   setSaving]   = useState(false);
    const [error,    setError]    = useState('');

    const handleGuardar = async () => {
        if (!nombre.trim()) { setError('El nombre es requerido.'); return; }
        if (instalar && notasMov.trim().length < 5) { setError('Las notas de instalación deben tener al menos 5 caracteres.'); return; }
        setSaving(true); setError('');
        try {
            await fetchApi('/componentes', {
                method: 'POST',
                body: JSON.stringify({
                    nombre:          nombre.trim(),
                    serie:           serie.trim()  || null,
                    tipo:            tipo.trim()   || null,
                    notas:           notas.trim()  || null,
                    equipoActualId:  instalar ? equipoId : null,
                    fechaMovimiento: instalar ? fecha : undefined,
                    notasMovimiento: instalar ? notasMov.trim() : undefined,
                }),
            });
            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Error al crear componente');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">Nuevo componente</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre *</label>
                            <input
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                placeholder="Ej: Pistola VL140"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">N° de serie</label>
                            <input
                                value={serie}
                                onChange={e => setSerie(e.target.value)}
                                placeholder="Ej: 4521"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo</label>
                            <input
                                value={tipo}
                                onChange={e => setTipo(e.target.value)}
                                placeholder="Ej: Pistola"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notas del componente</label>
                            <input
                                value={notas}
                                onChange={e => setNotas(e.target.value)}
                                placeholder="Observaciones generales…"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            />
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div
                            onClick={() => setInstalar(v => !v)}
                            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${instalar ? 'bg-blue-600' : 'bg-gray-200'}`}
                        >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${instalar ? 'left-5' : 'left-0.5'}`} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Instalar en este equipo ahora</span>
                    </label>

                    {instalar && (
                        <div className="space-y-3 pl-3 border-l-2 border-blue-200">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha de instalación</label>
                                <input
                                    type="date"
                                    value={fecha}
                                    onChange={e => setFecha(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    Notas de instalación <span className="text-gray-400 font-normal">(obligatorio)</span>
                                </label>
                                <textarea
                                    value={notasMov}
                                    onChange={e => setNotasMov(e.target.value)}
                                    rows={2}
                                    placeholder="Ej: Se instaló Pistola VL140 S/N 4521 para reemplazar la anterior"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleGuardar}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                    >
                        {saving ? 'Guardando...' : 'Crear componente'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Nuevo registro de mantenimiento ───────────────────────────────────

function NuevoMantModal({ equipoId, onClose, onSuccess }: { equipoId: string; onClose: () => void; onSuccess: () => void }) {
    const [fecha,        setFecha]        = useState(new Date().toISOString().slice(0, 10));
    const [tipo,         setTipo]         = useState('CORRECTIVO');
    const [descripcion,  setDescripcion]  = useState('');
    const [observaciones,setObservaciones]= useState('');
    const [horometro,    setHorometro]    = useState('');
    const [hrsUso,       setHrsUso]       = useState('');
    const [costo,        setCosto]        = useState('');
    const [moneda,       setMoneda]       = useState('MXN');
    const [numeroParte,  setNumeroParte]  = useState('');
    const [saving,       setSaving]       = useState(false);
    const [error,        setError]        = useState('');

    const handleGuardar = async () => {
        if (!descripcion.trim()) { setError('La descripción es requerida.'); return; }
        setSaving(true); setError('');
        try {
            await fetchApi(`/equipos/${equipoId}/mantenimiento`, {
                method: 'POST',
                body: JSON.stringify({
                    fecha,
                    tipo,
                    descripcion: descripcion.trim(),
                    observaciones: observaciones.trim() || null,
                    horometro:   horometro   ? Number(horometro)   : null,
                    hrsUso:      hrsUso      ? Number(hrsUso)      : null,
                    costo:       costo       ? Number(costo)       : null,
                    moneda,
                    numeroParte: numeroParte.trim() || null,
                }),
            });
            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">Nuevo registro de mantenimiento</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {/* Tipo */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Tipo</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(TIPO_MANT).map(([key, { label }]) => (
                                <button
                                    key={key}
                                    onClick={() => setTipo(key)}
                                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-left ${
                                        tipo === key
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha *</label>
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Horómetro (hrs)</label>
                            <input type="number" value={horometro} onChange={e => setHorometro(e.target.value)}
                                placeholder="Ej: 1450"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción *</label>
                        <textarea
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            rows={2}
                            placeholder="Ej: Cambio de aceite de motor y filtros"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Observaciones</label>
                        <textarea
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                            rows={2}
                            placeholder="Notas adicionales..."
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hrs de uso</label>
                            <input type="number" value={hrsUso} onChange={e => setHrsUso(e.target.value)}
                                placeholder="Ej: 250"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Costo</label>
                            <input type="number" value={costo} onChange={e => setCosto(e.target.value)}
                                placeholder="0.00"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Moneda</label>
                            <select value={moneda} onChange={e => setMoneda(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="MXN">MXN</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Número de parte</label>
                        <input type="text" value={numeroParte} onChange={e => setNumeroParte(e.target.value)}
                            placeholder="Ej: 15400-RTA-003"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                    </div>

                    {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleGuardar}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                    >
                        {saving ? 'Guardando...' : 'Guardar registro'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Editar registro de mantenimiento ──────────────────────────────────

type EditMantModalProps = {
    registro: RegistroMant;
    equipoId: string;
    onClose: () => void;
    onSuccess: () => void;
};

function EditMantModal({ registro, equipoId, onClose, onSuccess }: EditMantModalProps) {
    const [fecha,         setFecha]         = useState(registro.fecha.slice(0, 10));
    const [tipo,         setTipo]           = useState(registro.tipo ?? 'CORRECTIVO');
    const [descripcion,  setDescripcion]    = useState(registro.descripcion);
    const [observaciones,setObservaciones]  = useState(registro.observaciones ?? '');
    const [horometro,    setHorometro]      = useState(registro.horometro != null ? String(registro.horometro) : '');
    const [hrsUso,       setHrsUso]         = useState(registro.hrsUso != null ? String(registro.hrsUso) : '');
    const [costo,        setCosto]          = useState(registro.costo != null ? String(registro.costo) : '');
    const [moneda,       setMoneda]         = useState(registro.moneda ?? 'MXN');
    const [numeroParte,  setNumeroParte]    = useState(registro.numeroParte ?? '');
    const [saving,       setSaving]         = useState(false);
    const [error,        setError]          = useState('');

    const handleGuardar = async () => {
        if (!descripcion.trim()) { setError('La descripción es requerida.'); return; }
        setSaving(true); setError('');
        try {
            await fetchApi(`/equipos/${equipoId}/mantenimiento/${registro.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    fecha,
                    tipo,
                    descripcion: descripcion.trim(),
                    observaciones: observaciones.trim() || null,
                    horometro:   horometro   ? Number(horometro)   : null,
                    hrsUso:      hrsUso      ? Number(hrsUso)      : null,
                    costo:       costo       ? Number(costo)       : null,
                    moneda,
                    numeroParte: numeroParte.trim() || null,
                }),
            });
            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Editar registro de mantenimiento</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Modifica los datos del registro seleccionado</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {/* Tipo */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Tipo</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(TIPO_MANT).map(([key, { label }]) => (
                                <button
                                    key={key}
                                    onClick={() => setTipo(key)}
                                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-left ${
                                        tipo === key
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha *</label>
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Horómetro (hrs)</label>
                            <input type="number" value={horometro} onChange={e => setHorometro(e.target.value)}
                                placeholder="Ej: 1450"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción *</label>
                        <textarea
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            rows={2}
                            placeholder="Ej: Cambio de aceite de motor y filtros"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Observaciones</label>
                        <textarea
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                            rows={2}
                            placeholder="Notas adicionales..."
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hrs de uso</label>
                            <input type="number" value={hrsUso} onChange={e => setHrsUso(e.target.value)}
                                placeholder="Ej: 250"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Costo</label>
                            <input type="number" value={costo} onChange={e => setCosto(e.target.value)}
                                placeholder="0.00"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Moneda</label>
                            <select value={moneda} onChange={e => setMoneda(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="MXN">MXN</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Número de parte</label>
                        <input type="text" value={numeroParte} onChange={e => setNumeroParte(e.target.value)}
                            placeholder="Ej: 15400-RTA-003"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                    </div>

                    {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleGuardar}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                    >
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal de confirmación de borrado ─────────────────────────────────────────

type ConfirmDeleteModalProps = {
    mensaje: string;
    onConfirm: () => void;
    onCancel: () => void;
};

function ConfirmDeleteModal({ mensaje, onConfirm, onCancel }: ConfirmDeleteModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="px-6 py-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                        <Trash2 size={18} className="text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">¿Eliminar registro?</h3>
                        <p className="text-xs text-gray-500 mt-1">{mensaje}</p>
                        <p className="text-xs text-red-500 mt-2 font-medium">Esta acción no se puede deshacer.</p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
                        Sí, eliminar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Nuevo pendiente/falla ─────────────────────────────────────────────

function NuevoPendienteModal({ equipoId, onClose, onSuccess }: { equipoId: string; onClose: () => void; onSuccess: () => void }) {
    const [descripcion,  setDescripcion]  = useState('');
    const [observacion,  setObservacion]  = useState('');
    const [horometro,    setHorometro]    = useState('');
    const [fecha,        setFecha]        = useState(new Date().toISOString().slice(0, 10));
    const [saving,       setSaving]       = useState(false);
    const [error,        setError]        = useState('');

    const handleGuardar = async () => {
        if (descripcion.trim().length < 3) { setError('La descripción debe tener al menos 3 caracteres.'); return; }
        setSaving(true); setError('');
        try {
            await fetchApi(`/equipos/${equipoId}/pendientes`, {
                method: 'POST',
                body: JSON.stringify({
                    descripcion: descripcion.trim(),
                    observacion: observacion.trim() || null,
                    horometro:   horometro ? Number(horometro) : null,
                    fecha,
                }),
            });
            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">Nueva falla / pendiente</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción *</label>
                        <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                            placeholder="Ej: Fuga de aceite en compresor"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Observaciones</label>
                        <textarea value={observacion} onChange={e => setObservacion(e.target.value)} rows={2}
                            placeholder="Detalles adicionales..."
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha *</label>
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Horómetro (hrs)</label>
                            <input type="number" value={horometro} onChange={e => setHorometro(e.target.value)}
                                placeholder="Ej: 1200"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                    </div>
                    {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
                    <button onClick={handleGuardar} disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                        {saving ? 'Guardando...' : 'Registrar pendiente'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Nuevo ítem de inventario ─────────────────────────────────────────

function NuevoInventarioModal({ equipoId, onClose, onSuccess }: { equipoId: string; onClose: () => void; onSuccess: () => void }) {
    const [descripcion, setDescripcion] = useState('');
    const [cantidad,    setCantidad]    = useState('1');
    const [observacion, setObservacion] = useState('');
    const [fecha,       setFecha]       = useState(new Date().toISOString().slice(0, 10));
    const [saving,      setSaving]      = useState(false);
    const [error,       setError]       = useState('');

    const handleGuardar = async () => {
        if (!descripcion.trim()) { setError('La descripción es requerida.'); return; }
        setSaving(true); setError('');
        try {
            await fetchApi(`/equipos/${equipoId}/inventario`, {
                method: 'POST',
                body: JSON.stringify({
                    descripcion: descripcion.trim(),
                    cantidad: Number(cantidad) || 1,
                    observacion: observacion.trim() || null,
                    fecha,
                }),
            });
            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">Nuevo ítem de inventario</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción *</label>
                        <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                            placeholder="Ej: Filtro de aceite"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cantidad</label>
                            <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} min="0" step="0.01"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha</label>
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Observaciones</label>
                        <input type="text" value={observacion} onChange={e => setObservacion(e.target.value)}
                            placeholder="Notas opcionales..."
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                    </div>
                    {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
                    <button onClick={handleGuardar} disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                        {saving ? 'Guardando...' : 'Agregar ítem'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── ComponenteCard ───────────────────────────────────────────────────────────

function ComponenteCard({ comp, equipoId, onMovimiento }: { comp: Componente; equipoId: string; onMovimiento: (c: Componente) => void }) {
    const [verHistorial, setVerHistorial] = useState(false);
    const estaAqui = comp.equipoActualId === equipoId;

    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow transition-shadow flex flex-col">
            <div className="flex items-start justify-between p-4 pb-3">
                <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${estaAqui ? 'bg-green-50' : 'bg-amber-50'}`}>
                        <Package size={16} className={estaAqui ? 'text-green-600' : 'text-amber-500'} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-800 leading-tight">{comp.nombre}</p>
                        {comp.tipo && <p className="text-xs text-gray-400 mt-0.5">{comp.tipo}</p>}
                        {comp.serie && (
                            <p className="text-xs text-gray-500 mt-1 font-mono bg-gray-50 rounded px-1.5 py-0.5 inline-block">
                                S/N {comp.serie}
                            </p>
                        )}
                    </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ml-2 ${estaAqui ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {estaAqui ? 'Instalado' : 'En taller'}
                </span>
            </div>

            {comp.notas && (
                <div className="px-4 pb-3">
                    <p className="text-xs text-gray-500 italic">{comp.notas}</p>
                </div>
            )}

            {comp.historial.length > 0 && (
                <div className="px-4 pb-3">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-400 mb-1">Último movimiento</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${TIPO_MOV[comp.historial[0].tipo]?.pill ?? 'bg-gray-100 text-gray-600'}`}>
                                {TIPO_MOV[comp.historial[0].tipo]?.label ?? comp.historial[0].tipo}
                            </span>
                            <span className="text-xs text-gray-500">{fmtFecha(comp.historial[0].fecha)}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-1">{comp.historial[0].notas}</p>
                    </div>
                </div>
            )}

            {comp.historial.length > 1 && (
                <div className="px-4 pb-3">
                    <button onClick={() => setVerHistorial(v => !v)} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium">
                        <History size={11} />
                        {verHistorial ? 'Ocultar historial' : `Ver historial (${comp.historial.length} mov.)`}
                        {verHistorial ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>

                    {verHistorial && (
                        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                            {comp.historial.slice(1).map(mov => (
                                <div key={mov.id} className="flex items-start gap-2 border-l-2 border-gray-100 pl-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${TIPO_MOV[mov.tipo]?.pill ?? 'bg-gray-100 text-gray-600'}`}>
                                                {TIPO_MOV[mov.tipo]?.label ?? mov.tipo}
                                            </span>
                                            <span className="text-xs text-gray-400">{fmtFecha(mov.fecha)}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5 truncate">{mov.notas}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="px-4 pb-4 pt-2 mt-auto border-t border-gray-50">
                <button
                    onClick={() => onMovimiento(comp)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-100 hover:border-blue-200 transition-colors"
                >
                    <ArrowRightLeft size={12} />
                    Registrar movimiento
                </button>
            </div>
        </div>
    );
}

// ─── RegistroRow ──────────────────────────────────────────────────────────────

function RegistroRow({ r, onDelete }: { r: Registro; onDelete: (id: string) => void }) {
    const [exp, setExp] = useState(false);
    const fecha = new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });

    return (
        <>
            <tr className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => setExp(v => !v)}>
                <td className="p-3">
                    <div>
                        <p className="text-sm font-semibold text-gray-700">{fecha}</p>
                        {r.semanaNum && <p className="text-xs text-gray-400">Sem. {r.semanaNum} / {r.anoNum}</p>}
                    </div>
                </td>
                <td className="p-3 text-sm text-gray-500">{r.obraNombre || '—'}</td>
                <td className="p-3 text-right font-bold text-gray-700">{r.horasTrabajadas} <span className="text-xs font-normal text-gray-400">hrs</span></td>
                <td className="p-3 text-right text-gray-700">{r.barrenos}</td>
                <td className="p-3 text-right text-gray-700">{Number(r.metrosLineales).toFixed(1)} <span className="text-xs text-gray-400">m</span></td>
                <td className="p-3 text-right text-blue-600 font-semibold">{r.litrosDiesel} <span className="text-xs font-normal text-gray-400">lt</span></td>
                <td className="p-3 text-right text-gray-700">${Number(r.costoDiesel).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</td>
                <td className="p-3 text-right">
                    <div className="flex justify-end items-center gap-1">
                        <button
                            onClick={e => { e.stopPropagation(); onDelete(r.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 size={13} />
                        </button>
                        {exp ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                </td>
            </tr>
            {exp && (
                <tr className="bg-blue-50/20">
                    <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Personal</p>
                                <p className="font-semibold text-gray-700">{r.operadores} op. / {r.peones} peón{r.peones !== 1 ? 'es' : ''}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Gauge size={11} /> KPIs</p>
                                <p className="text-xs text-gray-600">Lt/hr: <span className="font-bold">{r.kpi.litrosPorHora ?? 'N/A'}</span></p>
                                <p className="text-xs text-gray-600">Lt/mt: <span className="font-bold">{r.kpi.litrosPorMetro ?? 'N/A'}</span></p>
                                <p className="text-xs text-gray-600">Mt/hr: <span className="font-bold">{r.kpi.metrosPorHora ?? 'N/A'}</span></p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Droplets size={11} /> Diésel</p>
                                <p className="text-xs text-gray-600">{r.litrosDiesel} lt × ${r.precioDiesel}/lt</p>
                                <p className="text-xs font-bold text-gray-700">= ${Number(r.costoDiesel).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Registrado por</p>
                                <p className="font-semibold text-gray-700">{r.usuario?.nombre}</p>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EquipoDetallePage() {
    const params = useParams();
    const router = useRouter();

    const rawId = params?.id;
    const id: string | undefined =
        typeof rawId === 'string' && rawId.trim() !== '' ? rawId : undefined;

    const [equipo,      setEquipo]      = useState<Equipo | null>(null);
    const [registros,   setRegistros]   = useState<Registro[]>([]);
    const [componentes, setComponentes] = useState<Componente[]>([]);
    const [mantenimiento, setMantenimiento] = useState<RegistroMant[]>([]);
    const [pendientes,  setPendientes]  = useState<Pendiente[]>([]);
    const [inventario,  setInventario]  = useState<InventarioItem[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState('');

    // Tab activa
    const [tab, setTab] = useState<Tab>('registros');

    // Modales
    const [modalMov,        setModalMov]        = useState<Componente | null>(null);
    const [modalNuevoComp,  setModalNuevoComp]  = useState(false);
    const [modalNuevoMant,  setModalNuevoMant]  = useState(false);
    const [modalNuevoPend,  setModalNuevoPend]  = useState(false);
    const [modalNuevoInv,   setModalNuevoInv]   = useState(false);

    // Filtros registros
    const [filtroSemana, setFiltroSemana] = useState('todas');
    const [filtroDesde,  setFiltroDesde]  = useState('');
    const [filtroHasta,  setFiltroHasta]  = useState('');

    // Filtro pendientes
    const [filtroPend, setFiltroPend] = useState<'abiertos' | 'resueltos' | 'todos'>('abiertos');

    // Filtros bitácora de mantenimiento
    const [mantSearch,      setMantSearch]      = useState('');
    const [mantFiltroTipo,  setMantFiltroTipo]  = useState('todos');
    const [mantFiltroFecha, setMantFiltroFecha] = useState('todos'); // 'todos' | '3m' | '6m' | '1a' | '2a' | 'personalizado'
    const [mantDesde,       setMantDesde]       = useState('');
    const [mantHasta,       setMantHasta]       = useState('');

    // Modal editar mantenimiento
    const [modalEditMant,   setModalEditMant]   = useState<RegistroMant | null>(null);

    // Confirmación de borrado
    const [confirmDelete, setConfirmDelete] = useState<{ mensaje: string; onConfirm: () => void } | null>(null);

    const loadComponentes = useCallback(async () => {
        if (!id) return;
        try {
            const data = await fetchApi(`/componentes?equipoId=${id}`);
            setComponentes(data);
        } catch { /* silencioso */ }
    }, [id]);

    const loadMantenimiento = useCallback(async () => {
        if (!id) return;
        try {
            const data = await fetchApi(`/equipos/${id}/mantenimiento`);
            setMantenimiento(data);
        } catch { /* silencioso */ }
    }, [id]);

    const loadPendientes = useCallback(async () => {
        if (!id) return;
        try {
            const data = await fetchApi(`/equipos/${id}/pendientes?resuelto=all`);
            setPendientes(data);
        } catch { /* silencioso */ }
    }, [id]);

    const loadInventario = useCallback(async () => {
        if (!id) return;
        try {
            const data = await fetchApi(`/equipos/${id}/inventario`);
            setInventario(data);
        } catch { /* silencioso */ }
    }, [id]);

    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const [eq, regs, comps, mant, pend, inv] = await Promise.all([
                fetchApi(`/equipos/${id}`),
                fetchApi(`/registros-diarios?equipoId=${id}`),
                fetchApi(`/componentes?equipoId=${id}`),
                fetchApi(`/equipos/${id}/mantenimiento`),
                fetchApi(`/equipos/${id}/pendientes?resuelto=all`),
                fetchApi(`/equipos/${id}/inventario`),
            ]);
            if (eq.error) throw new Error(eq.error);
            setEquipo(eq);
            setRegistros(regs);
            setComponentes(comps);
            setMantenimiento(mant);
            setPendientes(pend);
            setInventario(inv);
        } catch (e: any) {
            setError(e.message || 'Error al cargar');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (!id) return;
        load();
    }, [load, id]);

    const handleDeleteRegistro = async (regId: string) => {
        if (!confirm('¿Eliminar este registro?')) return;
        try {
            await fetchApi(`/registros-diarios/${regId}`, { method: 'DELETE' });
            setRegistros(r => r.filter(x => x.id !== regId));
        } catch (e: any) { alert(e.message || 'Error'); }
    };

    const handleDeleteMant = (regId: string, descripcion: string) => {
        setConfirmDelete({
            mensaje: `Se eliminará el registro: "${descripcion.slice(0, 80)}${descripcion.length > 80 ? '...' : ''}"`,
            onConfirm: async () => {
                setConfirmDelete(null);
                try {
                    await fetchApi(`/equipos/${id}/mantenimiento/${regId}`, { method: 'DELETE' });
                    setMantenimiento(m => m.filter(x => x.id !== regId));
                } catch (e: any) { alert(e.message || 'Error'); }
            },
        });
    };

    const handleResolverPendiente = async (pend: Pendiente) => {
        if (!confirm('¿Marcar este pendiente como resuelto?')) return;
        try {
            await fetchApi(`/equipos/${id}/pendientes/${pend.id}`, {
                method: 'PUT',
                body: JSON.stringify({ resuelto: true, fechaResuelto: new Date().toISOString().slice(0, 10) }),
            });
            loadPendientes();
        } catch (e: any) { alert(e.message || 'Error'); }
    };

    const handleDeletePendiente = async (pendId: string) => {
        if (!confirm('¿Eliminar este pendiente?')) return;
        try {
            await fetchApi(`/equipos/${id}/pendientes/${pendId}`, { method: 'DELETE' });
            setPendientes(p => p.filter(x => x.id !== pendId));
        } catch (e: any) { alert(e.message || 'Error'); }
    };

    const handleDeleteInventario = async (itemId: string) => {
        if (!confirm('¿Eliminar este ítem del inventario?')) return;
        try {
            await fetchApi(`/equipos/${id}/inventario/${itemId}`, { method: 'DELETE' });
            setInventario(i => i.filter(x => x.id !== itemId));
        } catch (e: any) { alert(e.message || 'Error'); }
    };

    // ── Semanas disponibles para filtro ────────────────────────────────────────
    const semanas = Array.from(
        new Set(registros.filter(r => r.semanaNum).map(r => `${r.anoNum}-${String(r.semanaNum).padStart(2, '0')}`))
    ).sort().reverse();

    const filtrados = registros.filter(r => {
        if (filtroSemana !== 'todas') {
            if (`${r.anoNum}-${String(r.semanaNum).padStart(2, '0')}` !== filtroSemana) return false;
        }
        if (filtroDesde && r.fecha.slice(0, 10) < filtroDesde) return false;
        if (filtroHasta && r.fecha.slice(0, 10) > filtroHasta) return false;
        return true;
    });

    const totalHoras  = filtrados.reduce((a, r) => a + Number(r.horasTrabajadas), 0);
    const totalMetros = filtrados.reduce((a, r) => a + Number(r.metrosLineales),  0);
    const totalLitros = filtrados.reduce((a, r) => a + Number(r.litrosDiesel),    0);
    const totalCosto  = filtrados.reduce((a, r) => a + Number(r.costoDiesel),     0);
    const ltHr = totalHoras > 0 ? (totalLitros / totalHoras).toFixed(2) : '—';
    const mtHr = totalHoras > 0 ? (totalMetros / totalHoras).toFixed(2) : '—';

    const pendientesFiltrados = pendientes.filter(p => {
        if (filtroPend === 'abiertos')  return !p.resuelto;
        if (filtroPend === 'resueltos') return p.resuelto;
        return true;
    });

    const pendientesAbiertos = pendientes.filter(p => !p.resuelto).length;

    // ── Filtrado bitácora de mantenimiento ──────────────────────────────────────
    const mantFechaMin = mantenimiento.length > 0
        ? mantenimiento.reduce((min, m) => m.fecha < min ? m.fecha : min, mantenimiento[0].fecha).slice(0, 10)
        : '';

    const mantFiltrados = mantenimiento.filter(m => {
        // Búsqueda por texto
        if (mantSearch.trim()) {
            const q = mantSearch.toLowerCase();
            if (
                !m.descripcion.toLowerCase().includes(q) &&
                !(m.observaciones ?? '').toLowerCase().includes(q) &&
                !(m.numeroParte ?? '').toLowerCase().includes(q)
            ) return false;
        }
        // Filtro por tipo
        if (mantFiltroTipo !== 'todos' && m.tipo !== mantFiltroTipo) return false;
        // Filtro por fecha preestablecida
        const hoy = new Date();
        const fechaM = new Date(m.fecha + (m.fecha.includes('T') ? '' : 'T12:00:00'));
        if (mantFiltroFecha === '3m') {
            const desde = new Date(hoy); desde.setMonth(desde.getMonth() - 3);
            if (fechaM < desde) return false;
        } else if (mantFiltroFecha === '6m') {
            const desde = new Date(hoy); desde.setMonth(desde.getMonth() - 6);
            if (fechaM < desde) return false;
        } else if (mantFiltroFecha === '1a') {
            const desde = new Date(hoy); desde.setFullYear(desde.getFullYear() - 1);
            if (fechaM < desde) return false;
        } else if (mantFiltroFecha === '2a') {
            const desde = new Date(hoy); desde.setFullYear(desde.getFullYear() - 2);
            if (fechaM < desde) return false;
        } else if (mantFiltroFecha === 'personalizado') {
            if (mantDesde && m.fecha.slice(0, 10) < mantDesde) return false;
            if (mantHasta && m.fecha.slice(0, 10) > mantHasta) return false;
        }
        return true;
    });

    if (!id || loading) return <div className="p-10 text-center text-gray-400">Cargando...</div>;
    if (error)          return <div className="p-10 text-center text-red-500">{error}</div>;
    if (!equipo)        return <div className="p-10 text-center text-gray-400">Equipo no encontrado</div>;

    // ── Definición de tabs ──────────────────────────────────────────────────────
    const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { key: 'registros',    label: 'Registros diarios',  icon: <ClipboardList size={14} /> },
        { key: 'mantenimiento',label: 'Bitácora',           icon: <Settings2 size={14} />,     badge: mantenimiento.length },
        { key: 'pendientes',   label: 'Pendientes',         icon: <AlertTriangle size={14} />, badge: pendientesAbiertos || undefined },
        { key: 'inventario',   label: 'Inventario',         icon: <BoxesIcon size={14} />,     badge: inventario.length },
        { key: 'componentes',  label: 'Componentes',        icon: <Package size={14} />,       badge: componentes.length },
    ];

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* ── Header ── */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Wrench size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{equipo.nombre}</h1>
                            <p className="text-sm text-gray-400">
                                {equipo.numeroEconomico && <span className="mr-2">N° {equipo.numeroEconomico}</span>}
                                {equipo.modelo && <span className="mr-2">· {equipo.modelo}</span>}
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${equipo.activo ? 'text-green-600' : 'text-gray-400'}`}>
                                    {equipo.activo ? <CheckCircle size={11} /> : <XCircle size={11} />}
                                    {equipo.activo ? 'Activo' : 'Inactivo'}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
                <Link
                    href={`/dashboard/registros-diarios/new?equipoId=${id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
                >
                    <Plus size={16} /> Nuevo Registro
                </Link>
            </div>

            {/* ── Fichas de info ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-400 mb-1">Horómetro actual</p>
                    <p className="text-xl font-bold text-gray-800">{equipo.hodometroInicial.toLocaleString('es-MX')} <span className="text-sm font-normal text-gray-400">hrs</span></p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-400 mb-1">Total registros</p>
                    <p className="text-xl font-bold text-gray-800">{equipo._count.registrosDiarios}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-400 mb-1">Número de serie</p>
                    <p className="text-sm font-semibold text-gray-700">{equipo.numeroSerie || '—'}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs text-gray-400 mb-1">{equipo.apodo ? 'Apodo' : 'Notas'}</p>
                    <p className="text-xs text-gray-600 line-clamp-2">{equipo.apodo || equipo.notas || '—'}</p>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap relative ${
                            tab === t.key
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                        }`}
                    >
                        {t.icon}
                        {t.label}
                        {t.badge !== undefined && t.badge > 0 && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                t.key === 'pendientes'
                                    ? 'bg-orange-100 text-orange-600'
                                    : 'bg-blue-100 text-blue-600'
                            }`}>
                                {t.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                TAB: REGISTROS DIARIOS
            ══════════════════════════════════════════════════════════════════ */}
            {tab === 'registros' && (
                <div className="space-y-4">
                    {/* Filtros */}
                    <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <Calendar size={15} className="text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-semibold text-gray-600">Filtrar:</span>

                        <select
                            value={filtroSemana}
                            onChange={e => { setFiltroSemana(e.target.value); setFiltroDesde(''); setFiltroHasta(''); }}
                            className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="todas">Todas las semanas</option>
                            {semanas.map(s => {
                                const [ano, sem] = s.split('-');
                                return <option key={s} value={s}>Semana {parseInt(sem)} / {ano}</option>;
                            })}
                        </select>

                        <span className="text-xs text-gray-400">ó rango:</span>
                        <div className="flex items-center gap-2">
                            <input type="date" value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setFiltroSemana('todas'); }}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 bg-white" />
                            <span className="text-xs text-gray-400">→</span>
                            <input type="date" value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setFiltroSemana('todas'); }}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 bg-white" />
                        </div>

                        {(filtroSemana !== 'todas' || filtroDesde || filtroHasta) && (
                            <button onClick={() => { setFiltroSemana('todas'); setFiltroDesde(''); setFiltroHasta(''); }}
                                className="text-xs text-red-400 hover:text-red-600 hover:underline">
                                Limpiar filtros
                            </button>
                        )}
                    </div>

                    {/* KPIs período */}
                    {filtrados.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                            {[
                                { label: 'Registros',    val: filtrados.length,             unit: '' },
                                { label: 'Horas',        val: totalHoras.toFixed(1),        unit: 'hrs' },
                                { label: 'Metros',       val: totalMetros.toFixed(1),       unit: 'm' },
                                { label: 'Diésel',       val: totalLitros.toLocaleString(), unit: 'lt' },
                                { label: 'Lt/hr prom.',  val: ltHr,                         unit: '' },
                                { label: 'Costo diésel', val: `$${totalCosto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`, unit: '' },
                            ].map(k => (
                                <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                                    <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                                    <p className="text-lg font-bold text-gray-800">{k.val} <span className="text-xs font-normal text-gray-400">{k.unit}</span></p>
                                </div>
                            ))}
                        </div>
                    )}

                    <Card>
                        {filtrados.length === 0 ? (
                            <div className="p-10 text-center">
                                <p className="text-sm text-gray-500 font-medium">Sin registros para el filtro seleccionado</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Obra</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Horas</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Barrenos</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Metros</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Diésel</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Costo</th>
                                            <th className="p-3 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filtrados.map(r => (
                                            <RegistroRow key={r.id} r={r} onDelete={handleDeleteRegistro} />
                                        ))}
                                    </tbody>
                                </table>
                                <div className="p-4 border-t border-gray-100 text-xs text-gray-400">
                                    {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
                                    {filtrados.length !== registros.length && ` (de ${registros.length} totales)`}
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB: BITÁCORA DE MANTENIMIENTO
            ══════════════════════════════════════════════════════════════════ */}
            {tab === 'mantenimiento' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <Settings2 size={16} className="text-blue-500" />
                                Bitácora de mantenimiento
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">Historial de mantenimientos preventivos y correctivos</p>
                        </div>
                        <button
                            onClick={() => setModalNuevoMant(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                        >
                            <Plus size={13} /> Nuevo registro
                        </button>
                    </div>

                    {/* ── Búsqueda y filtros ── */}
                    {mantenimiento.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                            {/* Búsqueda */}
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={mantSearch}
                                    onChange={e => setMantSearch(e.target.value)}
                                    placeholder="Buscar por descripción, observaciones o número de parte..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>

                            <div className="flex flex-wrap gap-3 items-center">
                                {/* Filtro por tipo */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Tipo:</span>
                                    <div className="flex gap-1">
                                        {[{ key: 'todos', label: 'Todos' }, ...Object.entries(TIPO_MANT).map(([key, { label }]) => ({ key, label }))].map(({ key, label }) => (
                                            <button
                                                key={key}
                                                onClick={() => setMantFiltroTipo(key)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                                    mantFiltroTipo === key
                                                        ? 'bg-gray-800 text-white border-gray-800'
                                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Filtro por fecha */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Período:</span>
                                    <div className="flex gap-1 flex-wrap">
                                        {[
                                            { key: 'todos',         label: 'Todo el historial' },
                                            { key: '3m',            label: 'Últimos 3 meses'   },
                                            { key: '6m',            label: 'Últimos 6 meses'   },
                                            { key: '1a',            label: 'Último año'        },
                                            { key: '2a',            label: 'Últimos 2 años'    },
                                            { key: 'personalizado', label: 'Personalizado'     },
                                        ].map(({ key, label }) => (
                                            <button
                                                key={key}
                                                onClick={() => setMantFiltroFecha(key)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                                    mantFiltroFecha === key
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Rango personalizado */}
                            {mantFiltroFecha === 'personalizado' && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-gray-400">Desde:</span>
                                    <input
                                        type="date"
                                        value={mantDesde}
                                        min={mantFechaMin}
                                        max={new Date().toISOString().slice(0, 10)}
                                        onChange={e => setMantDesde(e.target.value)}
                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 bg-white"
                                    />
                                    <span className="text-xs text-gray-400">→ Hasta:</span>
                                    <input
                                        type="date"
                                        value={mantHasta}
                                        min={mantDesde || mantFechaMin}
                                        max={new Date().toISOString().slice(0, 10)}
                                        onChange={e => setMantHasta(e.target.value)}
                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:ring-1 focus:ring-blue-500 bg-white"
                                    />
                                </div>
                            )}

                            {/* Limpiar filtros */}
                            {(mantSearch || mantFiltroTipo !== 'todos' || mantFiltroFecha !== 'todos') && (
                                <button
                                    onClick={() => { setMantSearch(''); setMantFiltroTipo('todos'); setMantFiltroFecha('todos'); setMantDesde(''); setMantHasta(''); }}
                                    className="text-xs text-red-400 hover:text-red-600 hover:underline"
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                    )}

                    {mantenimiento.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                            <Settings2 size={32} className="text-gray-200 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-500">Sin registros de mantenimiento</p>
                            <p className="text-xs text-gray-400 mt-1 mb-4">Registra los mantenimientos realizados al equipo.</p>
                            <button
                                onClick={() => setModalNuevoMant(true)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                                <Plus size={13} /> Agregar primer registro
                            </button>
                        </div>
                    ) : mantFiltrados.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                            <Search size={28} className="text-gray-200 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-500">Sin resultados para los filtros aplicados</p>
                            <p className="text-xs text-gray-400 mt-1">Intenta con otros criterios de búsqueda.</p>
                        </div>
                    ) : (
                        <Card>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipo</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Descripción</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Horómetro</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Costo</th>
                                            <th className="p-3 w-20"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {mantFiltrados.map(m => (
                                            <tr key={m.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="p-3 text-sm text-gray-600 whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                                                <td className="p-3">
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIPO_MANT[m.tipo ?? '']?.pill ?? 'bg-gray-100 text-gray-600'}`}>
                                                        {TIPO_MANT[m.tipo ?? '']?.label ?? (m.tipo || '—')}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <p className="text-sm text-gray-700">{m.descripcion}</p>
                                                    {m.observaciones && <p className="text-xs text-gray-400 mt-0.5">{m.observaciones}</p>}
                                                    {m.numeroParte && <p className="text-xs text-gray-400 font-mono">P/N: {m.numeroParte}</p>}
                                                </td>
                                                <td className="p-3 text-right text-sm text-gray-600 whitespace-nowrap">
                                                    {m.horometro != null ? `${m.horometro} hrs` : '—'}
                                                </td>
                                                <td className="p-3 text-right text-sm font-semibold text-gray-700 whitespace-nowrap">
                                                    {m.costo != null && m.costo > 0
                                                        ? `${m.moneda === 'USD' ? 'US$' : '$'}${Number(m.costo).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
                                                        : '—'}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setModalEditMant(m)}
                                                            title="Editar registro"
                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteMant(m.id, m.descripcion)}
                                                            title="Eliminar registro"
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t border-gray-100 bg-gray-50/30">
                                            <td colSpan={6} className="p-3 text-xs text-gray-400">
                                                {mantFiltrados.length} registro{mantFiltrados.length !== 1 ? 's' : ''}
                                                {mantFiltrados.length !== mantenimiento.length && ` (de ${mantenimiento.length} totales)`}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB: PENDIENTES / FALLAS
            ══════════════════════════════════════════════════════════════════ */}
            {tab === 'pendientes' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-orange-500" />
                                Pendientes y fallas
                                {pendientesAbiertos > 0 && (
                                    <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {pendientesAbiertos} abierto{pendientesAbiertos !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">Fallas y tareas pendientes de atender</p>
                        </div>
                        <button
                            onClick={() => setModalNuevoPend(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                        >
                            <Plus size={13} /> Nueva falla
                        </button>
                    </div>

                    {/* Filtro */}
                    <div className="flex gap-2">
                        {(['abiertos', 'resueltos', 'todos'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFiltroPend(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                                    filtroPend === f
                                        ? 'bg-gray-800 text-white border-gray-800'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                {f === 'abiertos' ? 'Abiertos' : f === 'resueltos' ? 'Resueltos' : 'Todos'}
                            </button>
                        ))}
                    </div>

                    {pendientesFiltrados.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                            <CheckCheck size={32} className="text-gray-200 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-500">
                                {filtroPend === 'abiertos' ? '¡Sin pendientes abiertos! Todo en orden.' : 'Sin registros para mostrar'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {pendientesFiltrados.map(p => (
                                <div key={p.id} className={`bg-white border rounded-xl p-4 flex items-start gap-4 ${p.resuelto ? 'border-gray-100 opacity-75' : 'border-orange-100'}`}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${p.resuelto ? 'bg-green-50' : 'bg-orange-50'}`}>
                                        {p.resuelto
                                            ? <CheckCircle size={16} className="text-green-500" />
                                            : <AlertTriangle size={16} className="text-orange-500" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-sm font-semibold ${p.resuelto ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                                {p.descripcion}
                                            </p>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${p.resuelto ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {p.resuelto ? 'Resuelto' : 'Abierto'}
                                            </span>
                                        </div>
                                        {p.observacion && <p className="text-xs text-gray-500 mt-1">{p.observacion}</p>}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                            <span className="flex items-center gap-1"><Calendar size={10} /> {fmtFecha(p.fecha)}</span>
                                            {p.horometro != null && <span className="flex items-center gap-1"><Gauge size={10} /> {p.horometro} hrs</span>}
                                            {p.resuelto && p.fechaResuelto && (
                                                <span className="flex items-center gap-1 text-green-500"><CheckCircle size={10} /> Resuelto: {fmtFecha(p.fechaResuelto)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {!p.resuelto && (
                                            <button
                                                onClick={() => handleResolverPendiente(p)}
                                                title="Marcar como resuelto"
                                                className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
                                            >
                                                <CheckCheck size={15} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeletePendiente(p.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB: INVENTARIO DEL EQUIPO
            ══════════════════════════════════════════════════════════════════ */}
            {tab === 'inventario' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <BoxesIcon size={16} className="text-blue-500" />
                                Inventario del equipo
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">Piezas, refacciones y materiales asignados a este equipo</p>
                        </div>
                        <button
                            onClick={() => setModalNuevoInv(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                        >
                            <Plus size={13} /> Agregar ítem
                        </button>
                    </div>

                    {inventario.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                            <BoxesIcon size={32} className="text-gray-200 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-500">Sin ítems de inventario</p>
                            <p className="text-xs text-gray-400 mt-1 mb-4">Registra las piezas o refacciones asignadas a este equipo.</p>
                            <button
                                onClick={() => setModalNuevoInv(true)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                                <Plus size={13} /> Agregar primer ítem
                            </button>
                        </div>
                    ) : (
                        <Card>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Descripción</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Cantidad</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Observación</th>
                                            <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                                            <th className="p-3 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {inventario.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="p-3 text-sm font-medium text-gray-700">{item.descripcion}</td>
                                                <td className="p-3 text-right">
                                                    <span className="text-sm font-bold text-gray-800 bg-blue-50 px-2 py-0.5 rounded-lg">
                                                        {Number(item.cantidad).toLocaleString('es-MX')}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-xs text-gray-500">{item.observacion || '—'}</td>
                                                <td className="p-3 text-xs text-gray-400">{fmtFecha(item.fecha)}</td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => handleDeleteInventario(item.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t border-gray-100 bg-gray-50/30">
                                            <td className="p-3 text-xs text-gray-400">{inventario.length} ítem{inventario.length !== 1 ? 's' : ''}</td>
                                            <td colSpan={4}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB: COMPONENTES
            ══════════════════════════════════════════════════════════════════ */}
            {tab === 'componentes' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <Package size={16} className="text-blue-500" />
                                Componentes instalados
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">Pistolas, cabezales y otros componentes trazables</p>
                        </div>
                        <button
                            onClick={() => setModalNuevoComp(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                        >
                            <Plus size={13} /> Agregar componente
                        </button>
                    </div>

                    {componentes.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                            <Package size={32} className="text-gray-200 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-500">Sin componentes instalados</p>
                            <p className="text-xs text-gray-400 mt-1 mb-4">Registra pistolas, cabezales u otros componentes para tener trazabilidad completa.</p>
                            <button
                                onClick={() => setModalNuevoComp(true)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                                <Plus size={13} /> Agregar primer componente
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {componentes.map(comp => (
                                <ComponenteCard
                                    key={comp.id}
                                    comp={comp}
                                    equipoId={id}
                                    onMovimiento={setModalMov}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══ Modales ══ */}
            {modalMov && (
                <MovimientoModal
                    componente={modalMov}
                    equipoActualId={id}
                    onClose={() => setModalMov(null)}
                    onSuccess={loadComponentes}
                />
            )}
            {modalNuevoComp && (
                <NuevoComponenteModal
                    equipoId={id}
                    onClose={() => setModalNuevoComp(false)}
                    onSuccess={loadComponentes}
                />
            )}
            {modalNuevoMant && (
                <NuevoMantModal
                    equipoId={id}
                    onClose={() => setModalNuevoMant(false)}
                    onSuccess={loadMantenimiento}
                />
            )}
            {modalEditMant && (
                <EditMantModal
                    registro={modalEditMant}
                    equipoId={id}
                    onClose={() => setModalEditMant(null)}
                    onSuccess={loadMantenimiento}
                />
            )}
            {confirmDelete && (
                <ConfirmDeleteModal
                    mensaje={confirmDelete.mensaje}
                    onConfirm={confirmDelete.onConfirm}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}
            {modalNuevoPend && (
                <NuevoPendienteModal
                    equipoId={id}
                    onClose={() => setModalNuevoPend(false)}
                    onSuccess={loadPendientes}
                />
            )}
            {modalNuevoInv && (
                <NuevoInventarioModal
                    equipoId={id}
                    onClose={() => setModalNuevoInv(false)}
                    onSuccess={loadInventario}
                />
            )}
        </div>
    );
}
