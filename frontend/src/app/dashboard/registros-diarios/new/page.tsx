"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, HardHat } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

type Equipo = { id: string; nombre: string; numeroEconomico: string | null; hodometroInicial: number };
type ObraSimple = { id: string; nombre: string; status: string };

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

            // Pre-llenar horómetro inicial con el valor actual del equipo
            const targetId = equipoIdParam || eqs[0]?.id;
            const eq = eqs.find((e: Equipo) => e.id === targetId);
            if (eq) {
                setForm(f => ({
                    ...f,
                    equipoId:        eq.id,
                    horometroInicio: String(eq.hodometroInicial),
                }));
            }

            // Pre-llenar nombre de obra si viene de URL
            if (obraIdParam) {
                const ob = obs.find((o: ObraSimple) => o.id === obraIdParam);
                if (ob) setForm(f => ({ ...f, obraId: ob.id }));
            }
        }).catch(() => setError('Error al cargar datos'));
    }, []);

    // Cuando cambia el equipo, actualizar horómetro
    const handleEquipoChange = (equipoId: string) => {
        const eq = equipos.find(e => e.id === equipoId);
        setForm(f => ({
            ...f,
            equipoId,
            horometroInicio: eq ? String(eq.hodometroInicial) : '',
        }));
    };

    const horas = form.horometroFin && form.horometroInicio
        ? Math.max(0, Number(form.horometroFin) - Number(form.horometroInicio))
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

    // Equipo seleccionado para mostrar horómetro actual
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

            {/* Obra — sección destacada */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <HardHat size={13}/> Obra / Notas
                    </p>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Obra del catálogo</label>
                        <select value={form.obraId} onChange={e => set('obraId', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                            <option value="">— Sin vincular a obra —</option>
                            {obras.map(o => (
                                <option key={o.id} value={o.id}>
                                    {o.nombre} {o.status !== 'ACTIVA' ? `(${o.status})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    {inp('Nombre de obra / sitio (texto libre)', 'obraNombre', 'text', 'Ej: Mina El Toro — Frente 3')}
                    {inp('Notas', 'notas')}
                </div>
            </Card>

            {/* Horómetro */}
            <Card>
                <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Horómetro</p>
                    <div className="grid grid-cols-3 gap-4">
                        {inp('H. Inicial (h i) *', 'horometroInicio', 'number')}
                        {inp('H. Final (h f) *',   'horometroFin',    'number')}
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
