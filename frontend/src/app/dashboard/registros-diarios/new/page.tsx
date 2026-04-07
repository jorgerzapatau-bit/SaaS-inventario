"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, HardHat, Drill } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

type Equipo = { id: string; nombre: string; numeroEconomico: string | null; hodometroInicial: number };
type ObraSimple = { id: string; nombre: string; status: string; bordo?: number | null; espaciamiento?: number | null };

function NuevoRegistroDiarioInner() {
    const router        = useRouter();
    const searchParams  = useSearchParams();
    const equipoIdParam = searchParams.get('equipoId') ?? '';
    const obraIdParam   = searchParams.get('obraId')   ?? '';

    const [equipos,   setEquipos]   = useState<Equipo[]>([]);
    const [obras,     setObras]     = useState<ObraSimple[]>([]);
    const [almacenId, setAlmacenId] = useState('');
    const [saving,    setSaving]    = useState(false);
    const [error,     setError]     = useState('');

    const hoy = new Date().toISOString().slice(0, 10);

    const [form, setForm] = useState({
        equipoId:               equipoIdParam,
        obraId:                 obraIdParam,
        fecha:                  hoy,
        horometroInicio:        '',
        horometroFin:           '',
        barrenos:               '',
        metrosLineales:         '',
        litrosDiesel:           '',
        precioDiesel:           '21.95',
        tanqueInicio:           '',
        litrosTanqueInicio:     '',
        tanqueFin:              '',
        litrosTanqueFin:        '',
        operadores:             '1',
        peones:                 '0',
        obraNombre:             '',
        notas:                  '',
        registrarDieselEnKardex: true,
        // ── Campos de perforación (Track Drill) ──
        bordo:               '',
        espaciamiento:       '',
        volumenRoca:         '',
        porcentajePerdida:   '',
        profundidadPromedio: '',
        porcentajeAvance:    '',
        rentaEquipoDiaria:   '',
    });

    useEffect(() => {
        Promise.all([
            fetchApi('/equipos'),
            fetchApi('/warehouse'),
            fetchApi('/obras'),
        ]).then(([eqs, alms, obs]) => {
            setEquipos(eqs);
            setObras(obs);
            if (alms?.length > 0) setAlmacenId(alms[0].id);

            const targetId = equipoIdParam || eqs[0]?.id;
            const eq = eqs.find((e: Equipo) => e.id === targetId);
            if (eq) {
                setForm(f => ({
                    ...f,
                    equipoId:        eq.id,
                    horometroInicio: String(eq.hodometroInicial),
                }));
            }

            if (obraIdParam) {
                const ob = obs.find((o: ObraSimple) => o.id === obraIdParam);
                if (ob) {
                    setForm(f => ({
                        ...f,
                        obraId:       ob.id,
                        bordo:        ob.bordo        != null ? String(ob.bordo)        : f.bordo,
                        espaciamiento: ob.espaciamiento != null ? String(ob.espaciamiento) : f.espaciamiento,
                    }));
                }
            }
        }).catch(() => setError('Error al cargar datos'));
    }, []);

    const handleEquipoChange = (equipoId: string) => {
        const eq = equipos.find(e => e.id === equipoId);
        setForm(f => ({
            ...f,
            equipoId,
            horometroInicio: eq ? String(eq.hodometroInicial) : '',
        }));
    };

    const handleObraChange = (obraId: string) => {
        const ob = obras.find(o => o.id === obraId);
        setForm(f => ({
            ...f,
            obraId,
            bordo:         ob?.bordo        != null ? String(ob.bordo)         : f.bordo,
            espaciamiento: ob?.espaciamiento != null ? String(ob.espaciamiento) : f.espaciamiento,
        }));
    };

    const horas = form.horometroFin && form.horometroInicio
        ? Math.max(0, Number(form.horometroFin) - Number(form.horometroInicio))
        : null;

    const volumenCalculado =
        form.bordo && form.espaciamiento && form.profundidadPromedio
            ? (Number(form.bordo) * Number(form.espaciamiento) * Number(form.profundidadPromedio)).toFixed(3)
            : null;

    const set = (key: keyof typeof form, val: string | boolean) =>
        setForm(f => ({ ...f, [key]: val }));

    const handleSave = async () => {
        if (!form.equipoId)        { setError('Selecciona un equipo'); return; }
        if (!form.horometroInicio) { setError('Horómetro inicial requerido'); return; }
        if (!form.horometroFin)    { setError('Horómetro final requerido'); return; }
        if (Number(form.horometroFin) < Number(form.horometroInicio)) {
            setError('El horómetro final no puede ser menor al inicial'); return;
        }
        setSaving(true); setError('');
        try {
            await fetchApi('/registros-diarios', {
                method: 'POST',
                body: JSON.stringify({
                    ...form,
                    obraId:             form.obraId || null,
                    horometroInicio:    Number(form.horometroInicio),
                    horometroFin:       Number(form.horometroFin),
                    barrenos:           Number(form.barrenos    || 0),
                    metrosLineales:     Number(form.metrosLineales || 0),
                    litrosDiesel:       Number(form.litrosDiesel  || 0),
                    precioDiesel:       Number(form.precioDiesel  || 0),
                    tanqueInicio:       form.tanqueInicio       ? Number(form.tanqueInicio)       : null,
                    litrosTanqueInicio: form.litrosTanqueInicio ? Number(form.litrosTanqueInicio) : null,
                    tanqueFin:          form.tanqueFin          ? Number(form.tanqueFin)          : null,
                    litrosTanqueFin:    form.litrosTanqueFin    ? Number(form.litrosTanqueFin)    : null,
                    operadores:         Number(form.operadores),
                    peones:             Number(form.peones),
                    almacenId,
                    // ── Perforación ──
                    bordo:               form.bordo               ? Number(form.bordo)               : null,
                    espaciamiento:       form.espaciamiento       ? Number(form.espaciamiento)       : null,
                    volumenRoca:         form.volumenRoca         ? Number(form.volumenRoca)
                                        : volumenCalculado        ? Number(volumenCalculado)          : null,
                    porcentajePerdida:   form.porcentajePerdida   ? Number(form.porcentajePerdida)   : null,
                    profundidadPromedio: form.profundidadPromedio ? Number(form.profundidadPromedio) : null,
                    porcentajeAvance:    form.porcentajeAvance    ? Number(form.porcentajeAvance)    : null,
                    rentaEquipoDiaria:   form.rentaEquipoDiaria   ? Number(form.rentaEquipoDiaria)   : null,
                }),
            });
            router.push('/dashboard/registros-diarios');
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
            setSaving(false);
        }
    };

    const inp = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input type={type} value={String(form[key])}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
        </div>
    );

    const equipoSeleccionado = equipos.find(e => e.id === form.equipoId);

    return (
        <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft size={20}/>
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Nuevo Registro Diario</h1>
                    <p className="text-sm text-gray-400">Equivalente a una fila de la hoja Rpte del Excel</p>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 text-sm">{error}</div>}

            {/* Equipo y fecha */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Equipo y fecha</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Equipo *</label>
                            <select value={form.equipoId} onChange={e => handleEquipoChange(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="">-- Selecciona --</option>
                                {equipos.map(eq => (
                                    <option key={eq.id} value={eq.id}>
                                        {eq.nombre}{eq.numeroEconomico ? ` (${eq.numeroEconomico})` : ''}
                                    </option>
                                ))}
                            </select>
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

            {/* Obra */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <HardHat size={13}/> Obra / Notas
                    </p>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Obra del catálogo</label>
                        <select value={form.obraId} onChange={e => handleObraChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                            <option value="">— Sin vincular a obra —</option>
                            {obras.map(o => (
                                <option key={o.id} value={o.id}>
                                    {o.nombre} {o.status !== 'ACTIVA' ? `(${o.status})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    {!form.obraId && inp('Nombre de obra / sitio (texto libre)', 'obraNombre', 'text', 'Ej: Mina El Toro — Frente 3')}
                    {inp('Notas', 'notas')}
                </div>
            </Card>

            {/* Horómetro */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Horómetro</p>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">H. Inicial (h i) *</label>
                            <input
                                type="number"
                                value={form.horometroInicio}
                                readOnly
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-400 mt-1">Automático — horómetro actual del equipo</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">H. Final (h f) *</label>
                            <input
                                type="number"
                                value={form.horometroFin}
                                onChange={e => set('horometroFin', e.target.value)}
                                min={form.horometroInicio || 0}
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                                    form.horometroFin && Number(form.horometroFin) < Number(form.horometroInicio)
                                        ? 'border-red-400 bg-red-50 focus:ring-red-500/20 text-red-700'
                                        : 'border-gray-200 focus:ring-blue-500/20'
                                }`}
                            />
                            {form.horometroFin && Number(form.horometroFin) < Number(form.horometroInicio) && (
                                <p className="text-xs text-red-600 mt-1">No puede ser menor al inicial ({form.horometroInicio})</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Horas trabajadas</label>
                            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-bold text-blue-700">
                                {horas !== null ? `${horas} hrs` : '—'}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Producción */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Producción</p>
                    <div className="grid grid-cols-2 gap-4">
                        {inp('Barrenos (BARRNS)', 'barrenos',       'number', '13')}
                        {inp('Metros lineales (MTS)', 'metrosLineales', 'number', '134.7')}
                    </div>
                </div>
            </Card>

            {/* ── PERFORACIÓN (Track Drill) ── */}
            <Card>
                <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Drill size={13}/> Perforación
                        </p>
                        <span className="text-xs text-gray-300">Track Drill — opcional</span>
                    </div>

                    {/* Bordo / Espaciamiento / Profundidad */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Bordo / Burden (m)</label>
                            <input type="number" step="0.01" value={form.bordo}
                                onChange={e => set('bordo', e.target.value)}
                                placeholder="Ej: 3.5"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"/>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Espaciamiento (m)</label>
                            <input type="number" step="0.01" value={form.espaciamiento}
                                onChange={e => set('espaciamiento', e.target.value)}
                                placeholder="Ej: 4.0"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"/>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Profundidad prom. (m)</label>
                            <input type="number" step="0.01" value={form.profundidadPromedio}
                                onChange={e => set('profundidadPromedio', e.target.value)}
                                placeholder="Ej: 9.6"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"/>
                        </div>
                    </div>

                    {/* Volumen roca */}
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
                                placeholder={volumenCalculado ?? 'Bordo × Esp. × Prof.'}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"/>
                        </div>
                        {volumenCalculado && (
                            <div className="col-span-2 mt-5">
                                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 text-sm">
                                    <span className="text-indigo-400 text-xs">Auto:</span>
                                    <span className="font-semibold text-indigo-700">
                                        {form.bordo} × {form.espaciamiento} × {form.profundidadPromedio} = <strong>{volumenCalculado} m³</strong>
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

                    {/* % Pérdida / % Avance / Renta */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">% Pérdida</label>
                            <input type="number" step="0.1" min="0" max="100" value={form.porcentajePerdida}
                                onChange={e => set('porcentajePerdida', e.target.value)}
                                placeholder="Ej: 10"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"/>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">% Avance</label>
                            <input type="number" step="0.1" min="0" max="100" value={form.porcentajeAvance}
                                onChange={e => set('porcentajeAvance', e.target.value)}
                                placeholder="Ej: 75"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"/>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Renta equipo/día ($)</label>
                            <input type="number" step="0.01" value={form.rentaEquipoDiaria}
                                onChange={e => set('rentaEquipoDiaria', e.target.value)}
                                placeholder="Ej: 12500"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"/>
                        </div>
                    </div>

                    {/* Resumen inline si hay datos */}
                    {(form.bordo || form.espaciamiento || form.profundidadPromedio || form.porcentajePerdida || form.porcentajeAvance) && (
                        <div className="bg-indigo-50/70 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs border border-indigo-100">
                            {form.bordo && (
                                <div><p className="text-indigo-400 mb-0.5">Bordo</p><p className="font-bold text-indigo-700">{form.bordo} m</p></div>
                            )}
                            {form.espaciamiento && (
                                <div><p className="text-indigo-400 mb-0.5">Esp.</p><p className="font-bold text-indigo-700">{form.espaciamiento} m</p></div>
                            )}
                            {form.profundidadPromedio && (
                                <div><p className="text-indigo-400 mb-0.5">Prof.</p><p className="font-bold text-indigo-700">{form.profundidadPromedio} m</p></div>
                            )}
                            {(form.volumenRoca || volumenCalculado) && (
                                <div><p className="text-indigo-400 mb-0.5">Vol. roca</p><p className="font-bold text-indigo-700">{form.volumenRoca || volumenCalculado} m³</p></div>
                            )}
                            {form.porcentajePerdida && (
                                <div><p className="text-indigo-400 mb-0.5">% Pérdida</p><p className="font-bold text-indigo-700">{form.porcentajePerdida}%</p></div>
                            )}
                        </div>
                    )}
                </div>
            </Card>

            {/* Diésel */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Diésel</p>
                    <div className="grid grid-cols-2 gap-4">
                        {inp('Litros cargados', 'litrosDiesel', 'number', '235')}
                        {inp('Precio unitario ($/lt)', 'precioDiesel', 'number', '21.95')}
                    </div>
                    {form.litrosDiesel && form.precioDiesel && (
                        <div className="bg-blue-50 rounded-lg px-4 py-2 text-sm">
                            Costo: <span className="font-bold text-blue-700">
                                ${(Number(form.litrosDiesel) * Number(form.precioDiesel)).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="kardex"
                            checked={form.registrarDieselEnKardex}
                            onChange={e => set('registrarDieselEnKardex', e.target.checked)}
                            className="w-4 h-4 accent-blue-600 cursor-pointer"/>
                        <label htmlFor="kardex" className="text-xs text-gray-600 cursor-pointer">
                            Descontar litros del inventario de Diésel automáticamente
                        </label>
                    </div>
                </div>
            </Card>

            {/* Tanque interno */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Tanque interno <span className="text-gray-300 font-normal">(opcional)</span>
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        {inp('CM inicio (CM i)', 'tanqueInicio',       'number')}
                        {inp('Litros inicio',    'litrosTanqueInicio', 'number')}
                        {inp('CM fin (CM f)',     'tanqueFin',          'number')}
                        {inp('Litros fin',        'litrosTanqueFin',    'number')}
                    </div>
                </div>
            </Card>

            {/* Personal */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Personal (Op / Pn)</p>
                    <div className="grid grid-cols-2 gap-4">
                        {inp('Operadores', 'operadores', 'number')}
                        {inp('Peones',     'peones',     'number')}
                    </div>
                </div>
            </Card>

            {/* Acciones */}
            <div className="flex gap-3 pb-8">
                <button onClick={() => router.back()}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                    {saving ? 'Guardando...' : <><Save size={16}/> Guardar registro</>}
                </button>
            </div>
        </div>
    );
}

export default function NuevoRegistroDiarioPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center text-gray-400">Cargando...</div>}>
            <NuevoRegistroDiarioInner/>
        </Suspense>
    );
}
