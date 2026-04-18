"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Wrench, ArrowLeft, Plus, Trash2,
    CheckCircle, XCircle, Gauge, Droplets,
    ChevronDown, ChevronUp, Calendar,
    Package, History, X, AlertCircle,
    ArrowRightLeft, MapPin,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_MOV: Record<string, { label: string; pill: string }> = {
    INSTALACION:         { label: 'Instalación',        pill: 'bg-green-100 text-green-700' },
    RETIRO:              { label: 'Retiro',              pill: 'bg-amber-100 text-amber-700' },
    ENVIO_REPARACION:    { label: 'Envío a reparación',  pill: 'bg-red-100 text-red-700'    },
    RETORNO_REPARACION:  { label: 'Retorno reparación',  pill: 'bg-blue-100 text-blue-700'  },
};

function fmtFecha(iso: string) {
    return new Date(iso + (iso.includes('T') ? '' : 'T12:00:00'))
        .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
                    {/* Tipo */}
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

                    {/* Fecha */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha</label>
                        <input
                            type="date"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                    </div>

                    {/* Notas */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            Notas <span className="text-gray-400 font-normal">(obligatorio — describe qué pasó)</span>
                        </label>
                        <textarea
                            value={notas}
                            onChange={e => setNotas(e.target.value)}
                            rows={3}
                            placeholder={
                                tipo === 'INSTALACION'       ? 'Ej: Se instaló en Track-02 para reemplazar pistola dañada' :
                                tipo === 'RETIRO'            ? 'Ej: Se retiró por desgaste en empaque, va a taller' :
                                tipo === 'ENVIO_REPARACION'  ? 'Ej: Enviada a taller Suárez para reparación de empaque' :
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
                    serie:           serie.trim()    || null,
                    tipo:            tipo.trim()     || null,
                    notas:           notas.trim()    || null,
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

                    {/* Toggle instalar */}
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

// ─── Tarjeta de componente ────────────────────────────────────────────────────

function ComponenteCard({
    comp,
    equipoId,
    onMovimiento,
}: {
    comp: Componente;
    equipoId: string;
    onMovimiento: (c: Componente) => void;
}) {
    const [verHistorial, setVerHistorial] = useState(false);
    const estaAqui = comp.equipoActualId === equipoId;

    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow transition-shadow flex flex-col">
            {/* Header */}
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

            {/* Último movimiento */}
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

            {/* Historial expandible */}
            {comp.historial.length > 1 && (
                <div className="px-4 pb-3">
                    <button
                        onClick={() => setVerHistorial(v => !v)}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium"
                    >
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
                                        {mov.equipo && (
                                            <p className="text-xs text-gray-400">
                                                {mov.equipo.nombre}{mov.equipo.numeroEconomico ? ` (${mov.equipo.numeroEconomico})` : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Acción */}
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

// ─── Fila de registro diario expandible ──────────────────────────────────────

function RegistroRow({ r, onDelete }: { r: Registro; onDelete: (id: string) => void }) {
    const [exp, setExp] = useState(false);
    const fecha = new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });

    return (
        <>
            <tr
                className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                onClick={() => setExp(v => !v)}
            >
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

    console.log('[EquipoDetalle] raw params:', params);
    console.log('[EquipoDetalle] id:', id);

    const [equipo,      setEquipo]      = useState<Equipo | null>(null);
    const [registros,   setRegistros]   = useState<Registro[]>([]);
    const [componentes, setComponentes] = useState<Componente[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState('');

    // Modales
    const [modalMov,   setModalMov]   = useState<Componente | null>(null);
    const [modalNuevo, setModalNuevo] = useState(false);

    // Filtros registros
    const [filtroSemana, setFiltroSemana] = useState('todas');
    const [filtroDesde,  setFiltroDesde]  = useState('');
    const [filtroHasta,  setFiltroHasta]  = useState('');

    const loadComponentes = useCallback(async () => {
        if (!id) return;
        try {
            const data = await fetchApi(`/componentes?equipoId=${id}`);
            setComponentes(data);
        } catch { /* silencioso */ }
    }, [id]);

    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const [eq, regs, comps] = await Promise.all([
                fetchApi(`/equipos/${id}`),
                fetchApi(`/registros-diarios?equipoId=${id}`),
                fetchApi(`/componentes?equipoId=${id}`),
            ]);
            if (eq.error) throw new Error(eq.error);
            setEquipo(eq);
            setRegistros(regs);
            setComponentes(comps);
        } catch (e: any) {
            setError(e.message || 'Error al cargar');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (!id) {
            console.log('[EquipoDetalle] id no válido todavía, abortando fetch');
            return;
        }
        load();
    }, [load, id]);

    const handleDeleteRegistro = async (regId: string) => {
        if (!confirm('¿Eliminar este registro?')) return;
        try {
            await fetchApi(`/registros-diarios/${regId}`, { method: 'DELETE' });
            setRegistros(r => r.filter(x => x.id !== regId));
        } catch (e: any) { alert(e.message || 'Error'); }
    };

    // Semanas disponibles para filtro
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

    if (!id || loading) return <div className="p-10 text-center text-gray-400">Cargando...</div>;
    if (error)   return <div className="p-10 text-center text-red-500">{error}</div>;
    if (!equipo) return <div className="p-10 text-center text-gray-400">Equipo no encontrado</div>;

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

            {/* ══════════════════════════════════════════════════════
                SECCIÓN COMPONENTES
            ══════════════════════════════════════════════════════ */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <Package size={16} className="text-blue-500" />
                            Componentes instalados
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Pistolas, cabezales y otros componentes trazables en este equipo
                        </p>
                    </div>
                    <button
                        onClick={() => setModalNuevo(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                    >
                        <Plus size={13} /> Agregar componente
                    </button>
                </div>

                {componentes.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                        <Package size={32} className="text-gray-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-500">Sin componentes instalados</p>
                        <p className="text-xs text-gray-400 mt-1 mb-4">
                            Registra pistolas, cabezales u otros componentes para tener trazabilidad completa.
                        </p>
                        <button
                            onClick={() => setModalNuevo(true)}
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

            {/* ── Filtros de registros ── */}
            <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <Calendar size={15} className="text-blue-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-600">Filtrar registros:</span>

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
                    <button
                        onClick={() => { setFiltroSemana('todas'); setFiltroDesde(''); setFiltroHasta(''); }}
                        className="text-xs text-red-400 hover:text-red-600 hover:underline"
                    >
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* ── KPIs período ── */}
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

            {/* ── Tabla registros ── */}
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

            {/* ══ Modales ══ */}
            {modalMov && (
                <MovimientoModal
                    componente={modalMov}
                    equipoActualId={id}
                    onClose={() => setModalMov(null)}
                    onSuccess={loadComponentes}
                />
            )}
            {modalNuevo && (
                <NuevoComponenteModal
                    equipoId={id}
                    onClose={() => setModalNuevo(false)}
                    onSuccess={loadComponentes}
                />
            )}
        </div>
    );
}
