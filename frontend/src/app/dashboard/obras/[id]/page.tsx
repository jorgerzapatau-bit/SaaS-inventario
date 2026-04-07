"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    HardHat, ArrowLeft, Plus, Edit, Trash2,
    CheckCircle, PauseCircle, Clock, Wrench,
    FileText, Package, ChevronDown, ChevronUp,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Corte = {
    id: string;
    numero: number;
    fechaInicio: string;
    fechaFin: string;
    barrenos: number;
    metrosLineales: number;
    bordo: number | null;
    espesor: number | null;
    profundidadCollar: number | null;   // ← NUEVO
    volumenBruto: number | null;
    perdidaM3: number | null;
    porcentajePerdida: number | null;
    volumenNeto: number | null;
    precioUnitario: number | null;
    montoFacturado: number | null;
    moneda: string;
    status: 'BORRADOR' | 'FACTURADO' | 'COBRADO';
    notas: string | null;
};

type RegistroDiario = {
    id: string;
    fecha: string;
    equipo: { nombre: string };
    horasTrabajadas: number;
    barrenos: number;
    metrosLineales: number;
    litrosDiesel: number;
    precioDiesel: number;
};

type ObraEquipo = {
    id: string;
    equipoId: string;
    fechaInicio: string;
    fechaFin: string | null;
    equipo: { nombre: string; numeroEconomico: string | null; modelo: string | null };
};

type Movimiento = {
    id: string;
    fecha: string;
    producto: { nombre: string; unidad: string };
    tipoMovimiento: string;
    cantidad: number;
    costoUnitario: number;
    moneda: string;
};

type ObraDetalle = {
    id: string;
    nombre: string;
    clienteNombre: string | null;
    cliente: { nombre: string; telefono: string | null; email: string | null } | null;
    ubicacion: string | null;
    metrosContratados: number | null;
    precioUnitario: number | null;
    bordo: number | null;
    espesor: number | null;
    profundidadCollar: number | null; 
    moneda: string;
    fechaInicio: string | null;
    fechaFin: string | null;
    status: 'ACTIVA' | 'PAUSADA' | 'TERMINADA';
    notas: string | null;
    obraEquipos: ObraEquipo[];
    cortesFacturacion: Corte[];
    metricas: {
        metrosPerforados: number;
        horasTotales: number;
        litrosDiesel: number;
        barrenos: number;
        pctAvance: number | null;
        montoFacturado: number;
        costoInsumos: number;
    };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
    ACTIVA:    'bg-green-100 text-green-700',
    PAUSADA:   'bg-yellow-100 text-yellow-700',
    TERMINADA: 'bg-gray-100 text-gray-500',
};
const CORTE_STATUS_STYLE: Record<string, string> = {
    BORRADOR:  'bg-gray-100 text-gray-600',
    FACTURADO: 'bg-blue-100 text-blue-700',
    COBRADO:   'bg-green-100 text-green-700',
};

const fmt   = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
const fmt2  = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fDate = (s: string) => new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── Modal Corte de Facturación (replica hoja Plantilla) ──────────────────────
function CorteModal({
    obraId, obra, corte, onClose, onSaved,
}: {
    obraId: string;
    obra: ObraDetalle;
    corte?: Corte;
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEdit = !!corte;

    const [form, setForm] = useState({
        fechaInicio:       corte?.fechaInicio?.slice(0, 10)     ?? '',
        fechaFin:          corte?.fechaFin?.slice(0, 10)        ?? '',
        barrenos:          corte?.barrenos?.toString()          ?? '0',
        metrosLineales:    corte?.metrosLineales?.toString()    ?? '',
        bordo:             corte?.bordo?.toString()             ?? (obra.bordo?.toString()              ?? ''),
        espesor:           corte?.espesor?.toString()           ?? (obra.espesor?.toString()            ?? ''),
        // Profundidad de collar: prioridad corte → obra → vacío
        profundidadCollar: corte?.profundidadCollar?.toString()
                           ?? (obra.profundidadCollar?.toString() ?? ''),
        // perdidaM3 solo se usa si profundidadCollar está vacío (modo manual)
        perdidaM3:         corte?.perdidaM3?.toString()         ?? '0',
        precioUnitario:    corte?.precioUnitario?.toString()    ?? (obra.precioUnitario?.toString() ?? ''),
        moneda:            corte?.moneda                        ?? obra.moneda ?? 'MXN',
        status:            corte?.status                        ?? 'BORRADOR',
        notas:             corte?.notas                         ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    const set = (key: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setForm(f => ({ ...f, [key]: e.target.value }));

    // ── Cálculos en tiempo real ──────────────────────────────────────────────
    const bordoN    = Number(form.bordo)              || 0;
    const espesorN  = Number(form.espesor)            || 0;
    const metrosN   = Number(form.metrosLineales)     || 0;
    const barrenosN = Number(form.barrenos)           || 0;
    const collarN   = Number(form.profundidadCollar)  || 0;
    const puN       = Number(form.precioUnitario)     || 0;

    // Si hay profundidadCollar, la pérdida se calcula automáticamente
    const modoAutomatico = collarN > 0 && bordoN > 0 && espesorN > 0;
    const perdidaAuto    = modoAutomatico
        ? +(barrenosN * collarN * bordoN * espesorN).toFixed(4)
        : null;
    const perdidaNum     = modoAutomatico
        ? perdidaAuto!
        : (Number(form.perdidaM3) || 0);

    const volBruto = bordoN && espesorN ? +(bordoN * espesorN * metrosN).toFixed(4) : null;
    const volNeto  = volBruto != null   ? +(volBruto - perdidaNum).toFixed(4)        : null;
    const monto    = volNeto  != null && puN ? +(volNeto * puN).toFixed(2)           : null;

    const fmt2 = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

    const handleSave = async () => {
        if (!form.fechaInicio || !form.fechaFin) { setError('Las fechas son requeridas'); return; }
        setSaving(true); setError('');
        try {
            const body = {
                ...form,
                barrenos:          Number(form.barrenos)           || 0,
                metrosLineales:    Number(form.metrosLineales)     || 0,
                bordo:             form.bordo      ? Number(form.bordo)      : null,
                espesor:           form.espesor    ? Number(form.espesor)    : null,
                // Enviar null si vacío → API sabe que la pérdida es manual
                profundidadCollar: form.profundidadCollar ? Number(form.profundidadCollar) : null,
                // Si modo automático, no enviamos perdidaM3 (la API la calcula)
                // Si modo manual, enviamos el valor del campo
                perdidaM3:         modoAutomatico ? undefined : (Number(form.perdidaM3) || 0),
                precioUnitario:    form.precioUnitario ? Number(form.precioUnitario) : null,
            };
            if (isEdit) {
                await fetchApi(`/obras/${obraId}/cortes/${corte!.id}`, { method: 'PUT', body: JSON.stringify(body) });
            } else {
                await fetchApi(`/obras/${obraId}/cortes`, { method: 'POST', body: JSON.stringify(body) });
            }
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const inp = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input type={type} value={String(form[key])} onChange={set(key)} placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-800">{isEdit ? `Editar Corte #${corte!.numero}` : 'Nuevo Corte de Facturación'}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Replica la hoja Plantilla del Excel</p>
                </div>

                <div className="px-6 py-5 space-y-5">

                    {/* Período */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Período del corte</p>
                        <div className="grid grid-cols-2 gap-3">
                            {inp('Fecha inicio (f i)', 'fechaInicio', 'date')}
                            {inp('Fecha fin (f f)',    'fechaFin',    'date')}
                        </div>
                    </div>

                    {/* Producción */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Producción del período</p>
                        <div className="grid grid-cols-2 gap-3">
                            {inp('Barrenos',                 'barrenos',       'number', '0')}
                            {inp('Metros lineales (Mt. Ln.)', 'metrosLineales', 'number', '0')}
                        </div>
                    </div>

                    {/* Dimensiones + cálculo de volumen */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cálculo de volumen</p>
                        <div className="grid grid-cols-2 gap-3">
                            {inp('Bordo (m)',   'bordo',   'number', '2.7')}
                            {inp('Espesor (m)', 'espesor', 'number', '3.0')}
                        </div>

                        {/* Profundidad de collar */}
                        <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Profundidad de collar (m)
                                <span className="ml-1 text-gray-400 font-normal">
                                    — déjalo vacío para ingresar la pérdida manualmente
                                </span>
                            </label>
                            <input
                                type="number"
                                value={form.profundidadCollar}
                                onChange={set('profundidadCollar')}
                                placeholder={obra.profundidadCollar ? `${obra.profundidadCollar} (valor de la obra)` : 'ej. 0.30'}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* Campo pérdida manual — solo visible si NO hay profundidadCollar */}
                        {!modoAutomatico && (
                            <div className="mt-3">
                                {inp('Pérdida m³ (ingreso manual — \"% Perd.\" del Excel)', 'perdidaM3', 'number', '39.69')}
                            </div>
                        )}

                        {/* Vista previa de cálculo */}
                        <div className="mt-3 bg-blue-50 rounded-xl p-4 space-y-1.5 text-xs">
                            <p className="text-gray-500 font-semibold mb-2">Vista previa (replica Plantilla)</p>

                            {modoAutomatico && (
                                <div className="flex justify-between text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 mb-2">
                                    <span>Pérdida auto = {barrenosN} bar × {collarN} m × {bordoN} × {espesorN}</span>
                                    <span className="font-bold">{fmt2(perdidaAuto!)} m³</span>
                                </div>
                            )}

                            <div className="flex justify-between">
                                <span className="text-gray-500">Vol. bruto = {bordoN} × {espesorN} × {metrosN} mt ln</span>
                                <span className="font-bold text-gray-700">{volBruto !== null ? `${fmt2(volBruto)} m³` : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Vol. neto (−{fmt2(perdidaNum)} m³ pérdida)</span>
                                <span className="font-bold text-gray-700">{volNeto !== null ? `${fmt2(volNeto)} m³` : '—'}</span>
                            </div>
                            <div className="flex justify-between border-t border-blue-100 pt-1.5">
                                <span className="text-gray-500">Monto = Vol. neto × ${puN}/m³</span>
                                <span className="font-bold text-blue-700 text-sm">{monto !== null ? `$${fmt2(monto)}` : '—'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Facturación */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Facturación</p>
                        <div className="grid grid-cols-2 gap-3">
                            {inp('Precio unitario (P.U.)', 'precioUnitario', 'number', '24.50')}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
                                <select value={form.moneda} onChange={set('moneda')}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                    <option value="MXN">MXN</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                            <select value={form.status} onChange={set('status')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="BORRADOR">Borrador</option>
                                <option value="FACTURADO">Facturado</option>
                                <option value="COBRADO">Cobrado</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                        <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                            rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none resize-none" />
                    </div>
                </div>

                {error && <p className="text-xs text-red-500 px-6 pb-2">{error}</p>}

                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50">
                        {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear corte'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Tab Operación ────────────────────────────────────────────────────────────
function TabOperacion({ obraId, obra }: { obraId: string; obra: ObraDetalle }) {
    const [registros, setRegistros] = useState<RegistroDiario[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [expanded,  setExpanded]  = useState<string | null>(null);

    useEffect(() => {
        fetchApi(`/registros-diarios?obraId=${obraId}`)
            .then(setRegistros)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [obraId]);

    if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Cargando registros...</div>;

    return (
        <div className="space-y-4">
            {/* Equipos asignados */}
            {obra.obraEquipos.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wider">Equipos asignados</p>
                    <div className="flex flex-wrap gap-2">
                        {obra.obraEquipos.map(oe => (
                            <span key={oe.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${oe.fechaFin ? 'bg-gray-100 text-gray-500' : 'bg-white text-blue-700 border border-blue-200'}`}>
                                <Wrench size={11} />
                                {oe.equipo.nombre}
                                {oe.equipo.numeroEconomico && ` (${oe.equipo.numeroEconomico})`}
                                {oe.fechaFin
                                    ? <span className="text-gray-400 ml-1">hasta {fDate(oe.fechaFin)}</span>
                                    : <span className="text-green-600 ml-1">● activo</span>
                                }
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Registros diarios */}
            <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-gray-700">Registros diarios ({registros.length})</p>
                <Link href={`/dashboard/registros-diarios/new?obraId=${obraId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus size={13} /> Nuevo registro
                </Link>
            </div>

            {registros.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Sin registros diarios para esta obra.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase">Fecha</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase">Equipo</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-right">Horas</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-right">Barrenos</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-right">Metros</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-right">Diésel</th>
                                <th className="p-3 w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {registros.map(r => (
                                <>
                                    <tr key={r.id} className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                                        <td className="p-3 text-gray-700 font-medium">{fDate(r.fecha)}</td>
                                        <td className="p-3 text-gray-500">{r.equipo.nombre}</td>
                                        <td className="p-3 text-right font-semibold text-gray-700">{r.horasTrabajadas} hrs</td>
                                        <td className="p-3 text-right text-gray-700">{r.barrenos}</td>
                                        <td className="p-3 text-right text-gray-700">{r.metrosLineales.toFixed(1)} m</td>
                                        <td className="p-3 text-right text-blue-600">{r.litrosDiesel} lt</td>
                                        <td className="p-3 text-gray-400">
                                            {expanded === r.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                        </td>
                                    </tr>
                                    {expanded === r.id && (
                                        <tr key={`${r.id}-exp`} className="bg-blue-50/20">
                                            <td colSpan={7} className="px-6 py-3 text-xs text-gray-600">
                                                Costo diésel: <span className="font-bold">${fmt((r.litrosDiesel * r.precioDiesel))}</span>
                                                {' '}({r.litrosDiesel} lt × ${r.precioDiesel}/lt)
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Tab Cortes ───────────────────────────────────────────────────────────────
function TabCortes({ obraId, obra, cortes, onReload }: {
    obraId: string;
    obra: ObraDetalle;
    cortes: Corte[];
    onReload: () => void;
}) {
    const [modal, setModal] = useState<{ open: boolean; corte?: Corte }>({ open: false });

    const handleDelete = async (id: string, num: number) => {
        if (!confirm(`¿Eliminar el Corte #${num}?`)) return;
        try {
            await fetchApi(`/obras/${obraId}/cortes/${id}`, { method: 'DELETE' });
            onReload();
        } catch (e: any) {
            alert(e.message || 'Error al eliminar');
        }
    };

    const handleStatusChange = async (corte: Corte, status: string) => {
        try {
            await fetchApi(`/obras/${obraId}/cortes/${corte.id}`, {
                method: 'PUT',
                body: JSON.stringify({ status }),
            });
            onReload();
        } catch (e: any) {
            alert(e.message || 'Error');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-gray-700">Cortes de facturación ({cortes.length})</p>
                <button onClick={() => setModal({ open: true })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus size={13} /> Nuevo corte
                </button>
            </div>

            {cortes.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Sin cortes de facturación registrados.</div>
            ) : (
                <div className="space-y-3">
                    {cortes.map(c => (
                        <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm flex-shrink-0">
                                        #{c.numero}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">
                                            {fDate(c.fechaInicio)} → {fDate(c.fechaFin)}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {c.barrenos} barrenos · {fmt2(c.metrosLineales)} mt ln
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={c.status}
                                        onChange={e => handleStatusChange(c, e.target.value)}
                                        className={`text-xs font-semibold px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer ${CORTE_STATUS_STYLE[c.status]}`}
                                    >
                                        <option value="BORRADOR">Borrador</option>
                                        <option value="FACTURADO">Facturado</option>
                                        <option value="COBRADO">Cobrado</option>
                                    </select>
                                    <button onClick={() => setModal({ open: true, corte: c })}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                                        <Edit size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(c.id, c.numero)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Cálculo de volumen */}
                            {c.volumenBruto !== null && (
                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-50">
                                    <div>
                                        <p className="text-xs text-gray-400">Vol. bruto</p>
                                        <p className="text-sm font-semibold text-gray-700">{fmt2(c.volumenBruto!)} m³</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">Pérdida</p>
                                        <p className="text-sm font-semibold text-gray-700">{c.perdidaM3 !== null ? `${fmt2(c.perdidaM3)} m³` : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">Vol. neto</p>
                                        <p className="text-sm font-semibold text-gray-700">{c.volumenNeto !== null ? `${fmt2(c.volumenNeto)} m³` : '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">Monto facturado</p>
                                        <p className="text-sm font-bold text-blue-700">
                                            {c.montoFacturado !== null ? `$${fmt2(c.montoFacturado)} ${c.moneda}` : '—'}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {c.notas && <p className="text-xs text-gray-400 mt-2 italic">{c.notas}</p>}
                        </div>
                    ))}
                </div>
            )}

            {modal.open && (
                <CorteModal
                    obraId={obraId}
                    obra={obra}
                    corte={modal.corte}
                    onClose={() => setModal({ open: false })}
                    onSaved={() => { setModal({ open: false }); onReload(); }}
                />
            )}
        </div>
    );
}

// ─── Tab Costos ───────────────────────────────────────────────────────────────
function TabCostos({ obraId }: { obraId: string }) {
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [loading,     setLoading]     = useState(true);

    useEffect(() => {
        fetchApi(`/inventory/movements?obraId=${obraId}`)
            .then(data => setMovimientos(Array.isArray(data) ? data : (data.movimientos ?? [])))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [obraId]);

    const totalCosto = movimientos
        .filter(m => m.tipoMovimiento === 'SALIDA' || m.tipoMovimiento === 'AJUSTE_NEGATIVO')
        .reduce((a, m) => a + (m.cantidad * m.costoUnitario), 0);

    if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Cargando costos...</div>;

    return (
        <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Costo total de insumos</p>
                    <p className="text-2xl font-bold text-blue-700">${fmt(totalCosto)}</p>
                </div>
                <Package size={32} className="text-blue-300" />
            </div>

            {movimientos.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Sin movimientos de inventario vinculados a esta obra.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase">Fecha</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase">Producto</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-right">Cantidad</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-right">Costo u.</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-right">Total</th>
                                <th className="p-3 text-xs font-semibold text-gray-400 uppercase text-center">Tipo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {movimientos.map(m => (
                                <tr key={m.id} className="hover:bg-gray-50/50">
                                    <td className="p-3 text-gray-600">{fDate(m.fecha)}</td>
                                    <td className="p-3 text-gray-800 font-medium">{m.producto.nombre}</td>
                                    <td className="p-3 text-right text-gray-700">{m.cantidad} {m.producto.unidad}</td>
                                    <td className="p-3 text-right text-gray-600">${fmt2(m.costoUnitario)}</td>
                                    <td className="p-3 text-right font-semibold text-gray-800">
                                        ${fmt2(m.cantidad * m.costoUnitario)}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                            m.tipoMovimiento === 'ENTRADA'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            {m.tipoMovimiento}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ObraDetallePage() {
    const params = useParams();
    const router = useRouter();
    const obraId = params.id as string;

    const [obra,    setObra]    = useState<ObraDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');
    const [tab,     setTab]     = useState<'operacion' | 'cortes' | 'costos'>('operacion');

    const load = async () => {
        setLoading(true);
        try {
            const data = await fetchApi(`/obras/${obraId}`);
            setObra(data);
        } catch (e: any) {
            setError(e.message || 'Error al cargar la obra');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [obraId]);

    if (loading) return <div className="p-10 text-center text-gray-400 text-sm">Cargando obra...</div>;
    if (error || !obra) return (
        <div className="p-10 text-center">
            <p className="text-red-500 text-sm mb-3">{error || 'Obra no encontrada'}</p>
            <button onClick={() => router.back()} className="text-blue-600 text-sm hover:underline">← Volver</button>
        </div>
    );

    const pct = obra.metricas?.pctAvance;
    const fmt2Local = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link href="/dashboard/obras" className="hover:text-blue-600 flex items-center gap-1">
                    <ArrowLeft size={14} /> Obras
                </Link>
                <span>/</span>
                <span className="text-gray-800 font-medium truncate">{obra.nombre}</span>
            </div>

            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <HardHat size={22} className="text-orange-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl font-bold text-gray-900">{obra.nombre}</h1>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[obra.status]}`}>
                                    {obra.status === 'ACTIVA'    && <CheckCircle size={10}/>}
                                    {obra.status === 'PAUSADA'   && <PauseCircle size={10}/>}
                                    {obra.status === 'TERMINADA' && <Clock size={10}/>}
                                    {obra.status.charAt(0) + obra.status.slice(1).toLowerCase()}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                                {(obra.cliente?.nombre || obra.clienteNombre) && (
                                    <span>Cliente: <strong>{obra.cliente?.nombre || obra.clienteNombre}</strong></span>
                                )}
                                {obra.ubicacion && <span>📍 {obra.ubicacion}</span>}
                                {obra.fechaInicio && <span>Inicio: {fDate(obra.fechaInicio)}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                    <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">Metros perforados</p>
                        <p className="text-lg font-bold text-gray-800">{fmt(obra.metricas?.metrosPerforados ?? 0)} m</p>
                        {obra.metrosContratados && (
                            <p className="text-xs text-gray-400">de {fmt(obra.metrosContratados)} contratados</p>
                        )}
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">% Avance</p>
                        {pct !== null && pct !== undefined ? (
                            <>
                                <p className="text-lg font-bold text-blue-600">{pct.toFixed(1)}%</p>
                                <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                            </>
                        ) : <p className="text-lg font-bold text-gray-400">—</p>}
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">Horas totales</p>
                        <p className="text-lg font-bold text-gray-800">{fmt2Local(obra.metricas?.horasTotales ?? 0)} hrs</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">Monto facturado</p>
                        <p className="text-lg font-bold text-green-700">${fmt(obra.metricas?.montoFacturado ?? 0)}</p>
                        <p className="text-xs text-gray-400">{obra.moneda}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {([
                    { key: 'operacion', label: 'Operación',  icon: <ClipboardListIcon /> },
                    { key: 'cortes',    label: 'Cortes',     icon: <FileText size={14}/> },
                    { key: 'costos',    label: 'Costos',     icon: <Package size={14}/> },
                ] as const).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            tab === t.key
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <Card>
                <div className="p-5">
                    {tab === 'operacion' && <TabOperacion obraId={obraId} obra={obra} />}
                    {tab === 'cortes'    && <TabCortes obraId={obraId} obra={obra} cortes={obra.cortesFacturacion} onReload={load} />}
                    {tab === 'costos'    && <TabCostos obraId={obraId} />}
                </div>
            </Card>
        </div>
    );
}

// Pequeño wrapper para evitar importar ClipboardList directamente (ya está en lucide)
function ClipboardListIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
        </svg>
    );
}
