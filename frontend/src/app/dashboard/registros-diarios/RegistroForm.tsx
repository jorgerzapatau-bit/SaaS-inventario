"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Save, HardHat, Drill, ChevronDown, ChevronUp,
    Lock, Pencil, AlertCircle, CheckCircle2, Copy,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

type Equipo = { id: string; nombre: string; numeroEconomico: string | null; hodometroInicial: number };
type ObraSimple = {
    id: string; nombre: string; status: string;
    bordo?: number | null; espaciamiento?: number | null;
    plantillas?: { id: string; numero: number; metrosContratados: number; barrenos: number; fechaInicio: string | null; fechaFin: string | null }[];
    obraEquipos?: { equipoId: string }[];
};
type ObraEquipo = { equipoId: string; obraId: string; horometroInicial: number | null };

export type RegistroFormValues = {
    equipoId: string;
    obraId: string;
    fecha: string;
    horometroInicio: string;
    horometroFin: string;
    barrenos: string;
    metrosLineales: string;
    litrosDiesel: string;
    precioDiesel: string;
    tanqueInicio: string;
    litrosTanqueInicio: string;
    tanqueFin: string;
    litrosTanqueFin: string;
    operadores: string;
    peones: string;
    obraNombre: string;
    notas: string;
    registrarDieselEnKardex: boolean;
    bordo: string;
    espaciamiento: string;
    volumenRoca: string;
    porcentajePerdida: string;
    profundidadPromedio: string;
    porcentajeAvance: string;
    rentaEquipoDiaria: string;
};

type Props = {
    mode: 'new' | 'edit';
    registroId?: string;
    initialValues?: Partial<RegistroFormValues>;
    /** Parámetros de URL para pre-selección (solo modo new) */
    equipoIdParam?: string;
    obraIdParam?: string;
};

const emptyForm = (hoy: string, equipoIdParam = '', obraIdParam = ''): RegistroFormValues => ({
    equipoId: equipoIdParam,
    obraId: obraIdParam,
    fecha: hoy,
    horometroInicio: '',
    horometroFin: '',
    barrenos: '',
    metrosLineales: '',
    litrosDiesel: '',
    precioDiesel: '21.95',
    tanqueInicio: '',
    litrosTanqueInicio: '',
    tanqueFin: '',
    litrosTanqueFin: '',
    operadores: '1',
    peones: '0',
    obraNombre: '',
    notas: '',
    registrarDieselEnKardex: true,
    bordo: '',
    espaciamiento: '',
    volumenRoca: '',
    porcentajePerdida: '',
    profundidadPromedio: '',
    porcentajeAvance: '',
    rentaEquipoDiaria: '',
});

export function RegistroFormInner({ mode, registroId, initialValues, equipoIdParam = '', obraIdParam = '' }: Props) {
    const router = useRouter();
    const hoy = new Date().toISOString().slice(0, 10);

    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [obras, setObras] = useState<ObraSimple[]>([]);
    const [almacenId, setAlmacenId] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [horometroFuente, setHorometroFuente] = useState<'obra' | 'equipo' | null>(null);
    const [avancePlantilla, setAvancePlantilla] = useState<{
        plantilla: NonNullable<ObraSimple['plantillas']>[number];
        metrosAcumulados: number;
        barrenosAcumulados: number;
    } | null>(null);
    const [perforacionExpanded, setPerforacionExpanded] = useState(false);
    // En edición siempre bloqueado al inicio; en nuevo también (se puede desbloquear manualmente)
    const [horometroLocked, setHorometroLocked] = useState(true);

    const [form, setForm] = useState<RegistroFormValues>(() => ({
        ...emptyForm(hoy, equipoIdParam, obraIdParam),
        ...initialValues,
    }));

    // Si initialValues tiene datos de perforación, expandir la sección
    useEffect(() => {
        if (initialValues && (initialValues.bordo || initialValues.profundidadPromedio || initialValues.espaciamiento)) {
            setPerforacionExpanded(true);
        }
    }, []);

    const set = (key: keyof RegistroFormValues, val: string | boolean) =>
        setForm(f => ({ ...f, [key]: val }));

    const fetchHorometroObraEquipo = async (obraId: string, equipoId: string) => {
        if (!obraId || !equipoId) return;
        try {
            const obraEquipos: ObraEquipo[] = await fetchApi(`/obras/${obraId}/equipos`);
            const asignacion = obraEquipos.find(oe => oe.equipoId === equipoId);
            if (asignacion && asignacion.horometroInicial != null) {
                setForm(f => ({ ...f, horometroInicio: String(asignacion.horometroInicial) }));
                setHorometroFuente('obra');
            } else {
                const eq = equipos.find(e => e.id === equipoId);
                if (eq) {
                    setForm(f => ({ ...f, horometroInicio: String(eq.hodometroInicial) }));
                    setHorometroFuente('equipo');
                }
            }
        } catch {
            const eq = equipos.find(e => e.id === equipoId);
            if (eq) {
                setForm(f => ({ ...f, horometroInicio: String(eq.hodometroInicial) }));
                setHorometroFuente('equipo');
            }
        }
    };

    const fetchAvancePlantilla = async (obraId: string) => {
        if (!obraId) { setAvancePlantilla(null); return; }
        try {
            const obra = obras.find(o => o.id === obraId);
            if (!obra?.plantillas?.length) { setAvancePlantilla(null); return; }
            const ahora = new Date().toISOString().slice(0, 10);
            const activa = obra.plantillas.find(p =>
                (!p.fechaFin || p.fechaFin >= ahora) && (!p.fechaInicio || p.fechaInicio <= ahora)
            ) ?? obra.plantillas[0];
            const registros = await fetchApi(`/registros-diarios?obraId=${obraId}`);
            const metrosAcumulados = registros.reduce((a: number, r: { metrosLineales?: number }) => a + (r.metrosLineales ?? 0), 0);
            const barrenosAcumulados = registros.reduce((a: number, r: { barrenos?: number }) => a + (r.barrenos ?? 0), 0);
            setAvancePlantilla({ plantilla: activa, metrosAcumulados, barrenosAcumulados });
        } catch {
            setAvancePlantilla(null);
        }
    };

    useEffect(() => {
        Promise.all([
            fetchApi('/equipos'),
            fetchApi('/warehouse'),
            fetchApi('/obras'),
        ]).then(([eqs, alms, obs]) => {
            setEquipos(eqs);
            setObras(obs);
            if (alms?.length > 0) setAlmacenId(alms[0].id);

            if (mode === 'new') {
                const targetId = equipoIdParam || eqs[0]?.id;
                const eq = eqs.find((e: Equipo) => e.id === targetId);
                if (eq) {
                    setForm(f => ({ ...f, equipoId: eq.id, horometroInicio: String(eq.hodometroInicial) }));
                    setHorometroFuente('equipo');
                }
                if (obraIdParam) {
                    const ob = obs.find((o: ObraSimple) => o.id === obraIdParam);
                    if (ob) {
                        setForm(f => ({
                            ...f,
                            obraId: ob.id,
                            bordo: ob.bordo != null ? String(ob.bordo) : f.bordo,
                            espaciamiento: ob.espaciamiento != null ? String(ob.espaciamiento) : f.espaciamiento,
                        }));
                        if (targetId) fetchHorometroObraEquipo(obraIdParam, targetId);
                        fetchAvancePlantilla(obraIdParam);
                    }
                }
            } else {
                // Modo edición: si hay obra precargada, cargar su avance
                if (initialValues?.obraId) fetchAvancePlantilla(initialValues.obraId);
            }
        }).catch(() => setError('Error al cargar datos'));
    }, []);

    const handleEquipoChange = (equipoId: string) => {
        const eq = equipos.find(e => e.id === equipoId);
        setForm(f => ({ ...f, equipoId, horometroInicio: eq ? String(eq.hodometroInicial) : '' }));
        setHorometroFuente(eq ? 'equipo' : null);
        if (form.obraId && equipoId) fetchHorometroObraEquipo(form.obraId, equipoId);
    };

    const handleObraChange = (obraId: string) => {
        const ob = obras.find(o => o.id === obraId);
        const equiposNuevosIds = ob?.obraEquipos?.map(oe => oe.equipoId) ?? [];
        const equipoSigueValido = !ob?.obraEquipos?.length || equiposNuevosIds.includes(form.equipoId);
        const nuevoEquipoId = equipoSigueValido ? form.equipoId : '';
        setForm(f => ({
            ...f,
            obraId,
            equipoId: nuevoEquipoId,
            bordo: ob?.bordo != null ? String(ob.bordo) : f.bordo,
            espaciamiento: ob?.espaciamiento != null ? String(ob.espaciamiento) : f.espaciamiento,
        }));
        if (!equipoSigueValido) {
            setHorometroFuente(null);
            setForm(f => ({ ...f, horometroInicio: '' }));
        }
        if (obraId && nuevoEquipoId) fetchHorometroObraEquipo(obraId, nuevoEquipoId);
        fetchAvancePlantilla(obraId);
    };

    const horas = form.horometroFin && form.horometroInicio
        ? Math.max(0, Number(form.horometroFin) - Number(form.horometroInicio))
        : null;

    const volumenCalculado =
        form.bordo && form.espaciamiento && form.profundidadPromedio && form.barrenos
            ? (Number(form.bordo) * Number(form.espaciamiento) * Number(form.profundidadPromedio) * Number(form.barrenos)).toFixed(3)
            : form.bordo && form.espaciamiento && form.profundidadPromedio
                ? (Number(form.bordo) * Number(form.espaciamiento) * Number(form.profundidadPromedio)).toFixed(3)
                : null;

    const volumenLabel = form.barrenos
        ? `${form.bordo} × ${form.espaciamiento} × ${form.profundidadPromedio} × ${form.barrenos} bar.`
        : `${form.bordo} × ${form.espaciamiento} × ${form.profundidadPromedio}`;

    const metrosPorBarreno = form.barrenos && form.metrosLineales && Number(form.barrenos) > 0
        ? (Number(form.metrosLineales) / Number(form.barrenos)).toFixed(2) : null;
    const costoDiesel = form.litrosDiesel && form.precioDiesel
        ? Number(form.litrosDiesel) * Number(form.precioDiesel) : 0;
    const costoTotal = costoDiesel + (form.rentaEquipoDiaria ? Number(form.rentaEquipoDiaria) : 0);

    const camposFaltantes: string[] = [];
    if (!form.equipoId) camposFaltantes.push('Equipo');
    if (!form.horometroInicio) camposFaltantes.push('H. Inicial');
    if (!form.horometroFin) camposFaltantes.push('H. Final');
    const formularioListo = camposFaltantes.length === 0;

    const obraSeleccionada = obras.find(o => o.id === form.obraId);
    const equipoSeleccionado = equipos.find(e => e.id === form.equipoId);
    const equiposDeObra = obraSeleccionada?.obraEquipos?.length
        ? equipos.filter(eq => obraSeleccionada.obraEquipos!.some(oe => oe.equipoId === eq.id))
        : equipos;

    const handleSave = async () => {
        if (!form.equipoId) { setError('Selecciona un equipo'); return; }
        if (!form.horometroInicio) { setError('Horómetro inicial requerido'); return; }
        if (!form.horometroFin) { setError('Horómetro final requerido'); return; }
        if (Number(form.horometroFin) < Number(form.horometroInicio)) {
            setError('El horómetro final no puede ser menor al inicial'); return;
        }
        setSaving(true); setError('');
        const payload = {
            ...form,
            obraId: form.obraId || null,
            horometroInicio: Number(form.horometroInicio),
            horometroFin: Number(form.horometroFin),
            barrenos: Number(form.barrenos || 0),
            metrosLineales: Number(form.metrosLineales || 0),
            litrosDiesel: Number(form.litrosDiesel || 0),
            precioDiesel: Number(form.precioDiesel || 0),
            tanqueInicio: form.tanqueInicio ? Number(form.tanqueInicio) : null,
            litrosTanqueInicio: form.litrosTanqueInicio ? Number(form.litrosTanqueInicio) : null,
            tanqueFin: form.tanqueFin ? Number(form.tanqueFin) : null,
            litrosTanqueFin: form.litrosTanqueFin ? Number(form.litrosTanqueFin) : null,
            operadores: Number(form.operadores),
            peones: Number(form.peones),
            almacenId,
            bordo: form.bordo ? Number(form.bordo) : null,
            espaciamiento: form.espaciamiento ? Number(form.espaciamiento) : null,
            volumenRoca: form.volumenRoca ? Number(form.volumenRoca) : volumenCalculado ? Number(volumenCalculado) : null,
            porcentajePerdida: form.porcentajePerdida ? Number(form.porcentajePerdida) : null,
            profundidadPromedio: form.profundidadPromedio ? Number(form.profundidadPromedio) : null,
            porcentajeAvance: form.porcentajeAvance ? Number(form.porcentajeAvance) : null,
            rentaEquipoDiaria: form.rentaEquipoDiaria ? Number(form.rentaEquipoDiaria) : null,
        };
        try {
            if (mode === 'new') {
                await fetchApi('/registros-diarios', { method: 'POST', body: JSON.stringify(payload) });
            } else {
                await fetchApi(`/registros-diarios/${registroId}`, { method: 'PUT', body: JSON.stringify(payload) });
            }
            router.push('/dashboard/registros-diarios');
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
            setSaving(false);
        }
    };

    const inp = (label: string, key: keyof RegistroFormValues, type = 'text', placeholder = '') => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input type={type} value={String(form[key])}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {mode === 'new' ? 'Nuevo Registro Diario' : 'Editar Registro Diario'}
                    </h1>
                    <p className="text-sm text-gray-400">
                        {mode === 'new'
                            ? 'Equivalente a una fila de la hoja Rpte del Excel'
                            : 'Modifica los datos del registro. El kardex de diésel NO se recalcula automáticamente.'}
                    </p>
                </div>
                {mode === 'edit' && (
                    <span className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-semibold">
                        <Pencil size={12} /> Modo edición
                    </span>
                )}
            </div>

            {/* Resumen sticky */}
            {(form.obraId || form.equipoId) && (
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border border-gray-200 rounded-xl px-4 py-3 shadow-sm flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    {obraSeleccionada && (
                        <span className="flex items-center gap-1.5 text-gray-700">
                            <HardHat size={12} className="text-orange-500" />
                            <span className="font-semibold">{obraSeleccionada.nombre}</span>
                        </span>
                    )}
                    {equipoSeleccionado && (
                        <span className="flex items-center gap-1.5 text-gray-700">
                            <Drill size={12} className="text-blue-500" />
                            <span className="font-semibold">{equipoSeleccionado.nombre}</span>
                            {equipoSeleccionado.numeroEconomico && <span className="text-gray-400">({equipoSeleccionado.numeroEconomico})</span>}
                        </span>
                    )}
                    {form.fecha && (
                        <span className="text-gray-400 ml-auto">
                            {new Date(form.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                    )}
                </div>
            )}

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 text-sm flex items-center gap-2">
                    <AlertCircle size={15} />{error}
                </div>
            )}

            {/* Aviso edición kardex */}
            {mode === 'edit' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <p>Si cambias los litros de diésel, ajusta el kardex manualmente desde <strong>Kardex / Movimientos</strong>.</p>
                </div>
            )}

            {/* ── 1. Obra ── */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <HardHat size={13} /> Obra / Notas
                    </p>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Obra del catálogo <span className="text-red-500">*</span>
                        </label>
                        <select value={form.obraId} onChange={e => handleObraChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                            <option value="">— Selecciona una obra —</option>
                            {obras.filter(o => o.status === 'ACTIVA').map(o => (
                                <option key={o.id} value={o.id}>{o.nombre}</option>
                            ))}
                            {obras.some(o => o.status !== 'ACTIVA') && (
                                <>
                                    <option disabled>── Inactivas ──</option>
                                    {obras.filter(o => o.status !== 'ACTIVA').map(o => (
                                        <option key={o.id} value={o.id}>{o.nombre} ({o.status})</option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>

                    {/* Banner avance plantilla */}
                    {avancePlantilla && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs space-y-1">
                            <p className="font-semibold text-blue-700">
                                Plantilla {avancePlantilla.plantilla.numero}
                                {avancePlantilla.plantilla.fechaFin && (
                                    <span className="font-normal text-blue-400 ml-2">
                                        cierra {avancePlantilla.plantilla.fechaFin.slice(0, 10)}
                                    </span>
                                )}
                            </p>
                            <div className="flex gap-4 text-blue-600">
                                <span>
                                    Metros: <strong>
                                        {avancePlantilla.metrosAcumulados.toFixed(1)} / {avancePlantilla.plantilla.metrosContratados} m
                                    </strong>
                                    <span className="text-blue-400 ml-1">
                                        ({avancePlantilla.plantilla.metrosContratados > 0
                                            ? ((avancePlantilla.metrosAcumulados / avancePlantilla.plantilla.metrosContratados) * 100).toFixed(1)
                                            : 0}%)
                                    </span>
                                </span>
                                {avancePlantilla.plantilla.barrenos > 0 && (
                                    <span>
                                        Barrenos: <strong>
                                            {avancePlantilla.barrenosAcumulados} / {avancePlantilla.plantilla.barrenos}
                                        </strong>
                                    </span>
                                )}
                            </div>
                            <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden mt-1">
                                <div className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{
                                        width: `${Math.min(100, avancePlantilla.plantilla.metrosContratados > 0
                                            ? (avancePlantilla.metrosAcumulados / avancePlantilla.plantilla.metrosContratados) * 100 : 0)}%`
                                    }} />
                            </div>
                        </div>
                    )}

                    {!form.obraId && inp('Nombre de obra / sitio (texto libre)', 'obraNombre', 'text', 'Ej: Mina El Toro — Frente 3')}
                    {inp('Notas', 'notas')}
                </div>
            </Card>

            {/* ── 2. Equipo y fecha ── */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Equipo y fecha</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Equipo *</label>
                            <select value={form.equipoId} onChange={e => handleEquipoChange(e.target.value)}
                                disabled={!form.obraId}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed">
                                <option value="">
                                    {form.obraId ? '— Selecciona un equipo —' : '— Primero selecciona una obra —'}
                                </option>
                                {equiposDeObra.map(eq => (
                                    <option key={eq.id} value={eq.id}>
                                        {eq.nombre}{eq.numeroEconomico ? ` (${eq.numeroEconomico})` : ''}
                                    </option>
                                ))}
                            </select>
                            {!form.obraId && <p className="text-xs text-amber-600 mt-1">Selecciona la obra primero</p>}
                            {form.obraId && equiposDeObra.length === 0 && (
                                <p className="text-xs text-amber-600 mt-1">Sin equipos asignados. <a href="/dashboard/obras" className="underline">Asignar →</a></p>
                            )}
                            {equipoSeleccionado && (
                                <p className="text-xs text-blue-600 mt-1">
                                    Horómetro actual: <span className="font-bold">{Number(equipoSeleccionado.hodometroInicial).toLocaleString('es-MX')} hrs</span>
                                </p>
                            )}
                        </div>
                        {inp('Fecha *', 'fecha', 'date')}
                    </div>
                </div>
            </Card>

            {/* ── 3. Horómetro ── */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Horómetro</p>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-gray-600">H. Inicial (h i) *</label>
                                <button type="button" onClick={() => setHorometroLocked(l => !l)}
                                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                                    {horometroLocked ? <Lock size={11} /> : <Pencil size={11} />}
                                    {horometroLocked ? 'Editar' : 'Bloquear'}
                                </button>
                            </div>
                            <input
                                type="number"
                                value={form.horometroInicio}
                                readOnly={horometroLocked}
                                onChange={e => { set('horometroInicio', e.target.value); setHorometroFuente(null); }}
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${horometroLocked
                                    ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                                    : 'border-blue-300 focus:ring-blue-500/20 focus:border-blue-500'
                                    }`}
                            />
                            {horometroFuente === 'obra' && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Precargado desde asignación
                                </p>
                            )}
                            {horometroFuente === 'equipo' && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                    <AlertCircle size={11} /> Valor del equipo — verifica
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">H. Final (h f) *</label>
                            <input
                                type="number"
                                value={form.horometroFin}
                                onChange={e => set('horometroFin', e.target.value)}
                                min={form.horometroInicio || 0}
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${form.horometroFin && Number(form.horometroFin) < Number(form.horometroInicio)
                                    ? 'border-red-400 bg-red-50 focus:ring-red-500/20 text-red-700'
                                    : 'border-gray-200 focus:ring-blue-500/20'
                                    }`}
                            />
                            {form.horometroFin && Number(form.horometroFin) < Number(form.horometroInicio) && (
                                <p className="text-xs text-red-600 mt-1">Menor al inicial ({form.horometroInicio})</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Horas trabajadas</label>
                            <div className={`px-3 py-2 rounded-lg text-sm font-bold border ${horas !== null && horas > 0
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-blue-50 border-blue-200 text-blue-700'
                                }`}>
                                {horas !== null ? `${horas} hrs` : '—'}
                            </div>
                            {horas !== null && horas > 14 && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                    <AlertCircle size={11} /> Más de 14 hrs — ¿correcto?
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* ── 4. Producción + Costos ── */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Producción</p>
                    <div className="grid grid-cols-2 gap-4">
                        {inp('Barrenos (BARRNS)', 'barrenos', 'number', '13')}
                        {inp('Metros lineales (MTS)', 'metrosLineales', 'number', '134.7')}
                    </div>
                    {metrosPorBarreno && (
                        <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-2 text-xs flex gap-4">
                            <span className="text-gray-500">m/barreno: <span className="font-bold text-gray-700">{metrosPorBarreno} m</span></span>
                            {horas && Number(form.metrosLineales) > 0 && (
                                <span className="text-gray-500">Avance/hr: <span className="font-bold text-gray-700">
                                    {(Number(form.metrosLineales) / horas).toFixed(1)} m/hr
                                </span></span>
                            )}
                        </div>
                    )}

                    <div className="border-t border-gray-100 pt-4 space-y-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Costos del día</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Renta de equipo/día ($)</label>
                                <input type="number" step="0.01" value={form.rentaEquipoDiaria}
                                    onChange={e => set('rentaEquipoDiaria', e.target.value)}
                                    placeholder="Ej: 4950"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Litros diésel cargados</label>
                                <input type="number" step="0.1" value={form.litrosDiesel}
                                    onChange={e => set('litrosDiesel', e.target.value)}
                                    placeholder="235"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Precio diésel ($/lt)</label>
                                <input type="number" step="0.01" value={form.precioDiesel}
                                    onChange={e => set('precioDiesel', e.target.value)}
                                    placeholder="21.95"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                            </div>
                        </div>
                        {mode === 'new' && (
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="kardex"
                                    checked={form.registrarDieselEnKardex}
                                    onChange={e => set('registrarDieselEnKardex', e.target.checked)}
                                    className="w-4 h-4 accent-blue-600 cursor-pointer" />
                                <label htmlFor="kardex" className="text-xs text-gray-600 cursor-pointer">
                                    Descontar litros del inventario de Diésel automáticamente
                                </label>
                            </div>
                        )}
                        {(form.rentaEquipoDiaria || costoDiesel > 0) && (
                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1.5 text-xs">
                                {form.rentaEquipoDiaria && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Renta equipo</span>
                                        <span className="font-semibold">${Number(form.rentaEquipoDiaria).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
                                    </div>
                                )}
                                {costoDiesel > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Diésel ({form.litrosDiesel} lt × ${form.precioDiesel})</span>
                                        <span className="font-semibold">${costoDiesel.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
                                    </div>
                                )}
                                {form.rentaEquipoDiaria && costoDiesel > 0 && (
                                    <div className="flex justify-between text-gray-800 font-bold border-t border-gray-200 pt-1.5 mt-1">
                                        <span>Total del día</span>
                                        <span>${costoTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* ── 5. Perforación (colapsable) ── */}
            <Card>
                <button type="button"
                    onClick={() => setPerforacionExpanded(e => !e)}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-gray-50/50 rounded-2xl transition-colors">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Drill size={13} /> Perforación
                        <span className="font-normal text-gray-300 normal-case ml-1">Track Drill — opcional</span>
                    </p>
                    <div className="flex items-center gap-2">
                        {(form.bordo || form.profundidadPromedio) && !perforacionExpanded && (
                            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Con datos</span>
                        )}
                        {perforacionExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                </button>

                {perforacionExpanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-50 pt-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Bordo / Burden (m)</label>
                                <input type="number" step="0.01" value={form.bordo}
                                    onChange={e => set('bordo', e.target.value)} placeholder="2.7"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Espaciamiento (m)</label>
                                <input type="number" step="0.01" value={form.espaciamiento}
                                    onChange={e => set('espaciamiento', e.target.value)} placeholder="3.0"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Profundidad prom. (m)</label>
                                <input type="number" step="0.01" value={form.profundidadPromedio}
                                    onChange={e => set('profundidadPromedio', e.target.value)} placeholder="Ej: 9.6"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 items-start">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Volumen roca (m³)
                                    {volumenCalculado && !form.volumenRoca && (
                                        <span className="ml-1 text-indigo-500 font-normal">— calculado</span>
                                    )}
                                </label>
                                <input type="number" step="0.001" value={form.volumenRoca}
                                    onChange={e => set('volumenRoca', e.target.value)}
                                    placeholder={volumenCalculado ?? 'Bordo × Esp. × Prof. × Barrenos'}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                            </div>
                            {volumenCalculado && (
                                <div className="col-span-2 mt-5">
                                    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 text-sm">
                                        <span className="text-indigo-400 text-xs">Auto:</span>
                                        <span className="font-semibold text-indigo-700">
                                            {volumenLabel} = <strong>{volumenCalculado} m³</strong>
                                        </span>
                                        {!form.volumenRoca && (
                                            <button type="button"
                                                onClick={() => set('volumenRoca', volumenCalculado)}
                                                className="ml-auto text-xs text-indigo-600 hover:underline">
                                                Usar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">% Pérdida</label>
                                <input type="number" step="0.1" min="0" max="100" value={form.porcentajePerdida}
                                    onChange={e => set('porcentajePerdida', e.target.value)} placeholder="Ej: 10"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">% Avance</label>
                                <input type="number" step="0.1" min="0" max="100" value={form.porcentajeAvance}
                                    onChange={e => set('porcentajeAvance', e.target.value)} placeholder="Ej: 75"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                            </div>
                        </div>
                        {(form.bordo || form.espaciamiento || form.profundidadPromedio || form.porcentajePerdida || form.porcentajeAvance) && (
                            <div className="bg-indigo-50/70 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs border border-indigo-100">
                                {form.bordo && <div><p className="text-indigo-400 mb-0.5">Bordo</p><p className="font-bold text-indigo-700">{form.bordo} m</p></div>}
                                {form.espaciamiento && <div><p className="text-indigo-400 mb-0.5">Esp.</p><p className="font-bold text-indigo-700">{form.espaciamiento} m</p></div>}
                                {form.profundidadPromedio && <div><p className="text-indigo-400 mb-0.5">Prof.</p><p className="font-bold text-indigo-700">{form.profundidadPromedio} m</p></div>}
                                {(form.volumenRoca || volumenCalculado) && <div><p className="text-indigo-400 mb-0.5">Vol. roca</p><p className="font-bold text-indigo-700">{form.volumenRoca || volumenCalculado} m³</p></div>}
                                {form.porcentajePerdida && <div><p className="text-indigo-400 mb-0.5">% Pérdida</p><p className="font-bold text-indigo-700">{form.porcentajePerdida}%</p></div>}
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* ── 6. Tanque interno ── */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Tanque interno <span className="text-gray-300 font-normal">(opcional)</span>
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        {inp('CM inicio (CM i)', 'tanqueInicio', 'number')}
                        {inp('Litros inicio', 'litrosTanqueInicio', 'number')}
                        {inp('CM fin (CM f)', 'tanqueFin', 'number')}
                        {inp('Litros fin', 'litrosTanqueFin', 'number')}
                    </div>
                </div>
            </Card>

            {/* ── 7. Personal ── */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Personal (Op / Pn)</p>
                    <div className="grid grid-cols-2 gap-4">
                        {inp('Operadores', 'operadores', 'number')}
                        {inp('Peones', 'peones', 'number')}
                    </div>
                </div>
            </Card>

            {/* ── Acciones ── */}
            <div className="flex gap-3 pb-8">
                <button onClick={() => router.back()}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !formularioListo}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                    {saving
                        ? 'Guardando...'
                        : formularioListo
                            ? <><Save size={16} /> {mode === 'new' ? 'Guardar registro' : 'Guardar cambios'}</>
                            : <span className="text-sm">Falta: {camposFaltantes.join(', ')}</span>
                    }
                </button>
            </div>
        </div>
    );
}
