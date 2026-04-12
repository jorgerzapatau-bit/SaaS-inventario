"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Receipt, Plus, Trash2, X, Filter, Package, ShoppingCart, AlertTriangle } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type TipoGasto = 'INSUMO' | 'EXTERNO';

type Gasto = {
    id: string;
    equipoId: string;
    obraId: string | null;
    plantillaId: string | null;
    semanaNum: number;
    anoNum: number;
    fechaInicio: string | null;
    tipoGasto: TipoGasto;
    categoria: string;
    producto: string;
    productoId: string | null;
    unidad: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
    moneda: 'MXN' | 'USD';
    tipoCambio: number | null;
    notas: string | null;
    equipo:      { nombre: string; numeroEconomico: string | null };
    obra:        { nombre: string } | null;
    plantilla:   { numero: number; fechaInicio: string | null; fechaFin: string | null } | null;
    productoRef: { nombre: string; unidad: string; stockActual: number } | null;
};

type Equipo  = { id: string; nombre: string; numeroEconomico: string | null };
type Obra    = { id: string; nombre: string; status: string };
type Almacen = { id: string; nombre: string };

type ProductoCatalogo = {
    id: string;
    nombre: string;
    sku: string;
    unidad: string;
    precioCompra: number;
    stockActual: number;
    stockMinimo: number;
    stockBajo: boolean;
    moneda: string;
};

type PlantillaResumen = {
    id: string;
    numero: number;
    fechaInicio: string | null;
    fechaFin: string | null;
    status: string;
    plantillaEquipos: { equipoId: string; equipo: Equipo }[];
};

const CATEGORIAS: Record<string, { label: string; color: string }> = {
    LUBRICANTE:   { label: 'Lubricante',   color: 'bg-yellow-100 text-yellow-700' },
    FILTRO:       { label: 'Filtro',       color: 'bg-orange-100 text-orange-700' },
    HERRAMIENTA:  { label: 'Herramienta',  color: 'bg-blue-100 text-blue-700'    },
    COMBUSTIBLE:  { label: 'Combustible',  color: 'bg-red-100 text-red-700'      },
    PERSONAL:     { label: 'Personal',     color: 'bg-purple-100 text-purple-700' },
    VEHICULO:     { label: 'Vehículo',     color: 'bg-indigo-100 text-indigo-700' },
    RENTA_EQUIPO: { label: 'Renta equipo', color: 'bg-orange-100 text-orange-800' },
    OTRO:         { label: 'Otro',         color: 'bg-gray-100 text-gray-600'    },
};

// ─── Modal nuevo gasto ────────────────────────────────────────────────────────
function GastoModal({
    equipos, obras, onClose, onSaved,
}: {
    equipos: Equipo[];
    obras: Obra[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const hoy = new Date().toISOString().slice(0, 10);

    // ── Paso 0: tipo de gasto ──────────────────────────────────────────────
    const [tipoGasto, setTipoGasto] = useState<TipoGasto | ''>('');

    // ── Contexto (compartido entre los dos flujos) ─────────────────────────
    const [obraId,      setObraId]      = useState('');
    const [plantillaId, setPlantillaId] = useState('');
    const [equipoId,    setEquipoId]    = useState('');
    const [fecha,       setFecha]       = useState(hoy);

    // ── Flujo INSUMO ───────────────────────────────────────────────────────
    const [busqueda,         setBusqueda]         = useState('');
    const [productoSel,      setProductoSel]      = useState<ProductoCatalogo | null>(null);
    const [cantidadInsumo,   setCantidadInsumo]   = useState('');
    const [almacenId,        setAlmacenId]        = useState('');
    const [almacenes,        setAlmacenes]        = useState<Almacen[]>([]);
    const [catalogoFiltrado, setCatalogoFiltrado] = useState<ProductoCatalogo[]>([]);
    const [catalogoTodos,    setCatalogoTodos]    = useState<ProductoCatalogo[]>([]);
    const [loadingCatalogo,  setLoadingCatalogo]  = useState(false);

    // ── Flujo EXTERNO ──────────────────────────────────────────────────────
    const [extForm, setExtForm] = useState({
        categoria:      'OTRO',
        producto:       '',
        unidad:         'pza',
        cantidad:       '',
        precioUnitario: '',
        moneda:         'MXN',
        tipoCambio:     '',
        notas:          '',
    });

    // ── Plantillas de la obra ──────────────────────────────────────────────
    const [plantillas,        setPlantillas]        = useState<PlantillaResumen[]>([]);
    const [loadingPlantillas, setLoadingPlantillas] = useState(false);

    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    // Cargar catálogo y almacenes al montar
    useEffect(() => {
        setLoadingCatalogo(true);
        Promise.all([
            fetchApi('/products'),
            fetchApi('/warehouse'),
        ]).then(([prods, alms]) => {
            setCatalogoTodos(prods);
            setCatalogoFiltrado(prods);
            setAlmacenes(alms);
            if (alms.length > 0) setAlmacenId(alms[0].id);
        }).catch(() => {}).finally(() => setLoadingCatalogo(false));
    }, []);

    // Filtrar catálogo por búsqueda
    useEffect(() => {
        const q = busqueda.toLowerCase().trim();
        if (!q) { setCatalogoFiltrado(catalogoTodos); return; }
        setCatalogoFiltrado(
            catalogoTodos.filter(p =>
                p.nombre.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q)
            )
        );
    }, [busqueda, catalogoTodos]);

    // Cargar plantillas cuando cambia la obra
    useEffect(() => {
        if (!obraId) { setPlantillas([]); setPlantillaId(''); setEquipoId(''); return; }
        setLoadingPlantillas(true);
        fetchApi(`/obras/${obraId}`)
            .then((o: any) => setPlantillas(o.plantillas ?? []))
            .catch(() => setPlantillas([]))
            .finally(() => setLoadingPlantillas(false));
        setPlantillaId(''); setEquipoId('');
    }, [obraId]);

    useEffect(() => { setEquipoId(''); }, [plantillaId]);

    // Equipos filtrados por plantilla/obra
    const equiposFiltrados: Equipo[] = (() => {
        if (plantillaId) {
            const p = plantillas.find(x => x.id === plantillaId);
            return p ? p.plantillaEquipos.map(pe => pe.equipo) : [];
        }
        if (obraId) {
            const ids = new Set<string>();
            const res: Equipo[] = [];
            plantillas.forEach(p => p.plantillaEquipos.forEach(pe => {
                if (!ids.has(pe.equipoId)) { ids.add(pe.equipoId); res.push(pe.equipo); }
            }));
            return res.length > 0 ? res : equipos;
        }
        return equipos;
    })();

    const fDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    const setExt = (k: keyof typeof extForm, v: string) => setExtForm(f => ({ ...f, [k]: v }));

    // Total preview para EXTERNO
    const totalExterno = extForm.cantidad && extForm.precioUnitario
        ? Number(extForm.cantidad) * Number(extForm.precioUnitario)
        : null;
    // Total preview para INSUMO
    const totalInsumo = productoSel && cantidadInsumo
        ? Number(cantidadInsumo) * productoSel.precioCompra
        : null;

    const handleSave = async () => {
        if (!tipoGasto) { setError('Selecciona el tipo de gasto'); return; }
        if (!equipoId)  { setError('Selecciona un equipo'); return; }

        setSaving(true); setError('');
        try {
            if (tipoGasto === 'INSUMO') {
                if (!productoSel) { setError('Selecciona un producto del catálogo'); setSaving(false); return; }
                if (!cantidadInsumo || Number(cantidadInsumo) <= 0) { setError('La cantidad debe ser mayor a 0'); setSaving(false); return; }
                if (Number(cantidadInsumo) > productoSel.stockActual) {
                    setError(`Stock insuficiente. Disponible: ${productoSel.stockActual} ${productoSel.unidad}`);
                    setSaving(false); return;
                }
                await fetchApi('/gastos-operativos', {
                    method: 'POST',
                    body: JSON.stringify({
                        tipoGasto: 'INSUMO',
                        equipoId,
                        obraId:     obraId     || null,
                        plantillaId: plantillaId || null,
                        fechaInicio: fecha,
                        productoId: productoSel.id,
                        almacenId:  almacenId  || null,
                        cantidad:   Number(cantidadInsumo),
                        moneda:     productoSel.moneda,
                    }),
                });
            } else {
                if (!extForm.producto.trim()) { setError('El concepto / producto es requerido'); setSaving(false); return; }
                if (!extForm.precioUnitario)  { setError('El precio unitario es requerido'); setSaving(false); return; }
                await fetchApi('/gastos-operativos', {
                    method: 'POST',
                    body: JSON.stringify({
                        tipoGasto: 'EXTERNO',
                        equipoId,
                        obraId:       obraId       || null,
                        plantillaId:  plantillaId  || null,
                        fechaInicio:  fecha,
                        categoria:    extForm.categoria,
                        producto:     extForm.producto,
                        unidad:       extForm.unidad,
                        cantidad:     Number(extForm.cantidad),
                        precioUnitario: Number(extForm.precioUnitario),
                        moneda:       extForm.moneda,
                        tipoCambio:   extForm.tipoCambio ? Number(extForm.tipoCambio) : null,
                        notas:        extForm.notas || null,
                    }),
                });
            }
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-2xl flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Nuevo Gasto Operativo</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Insumo del almacén o gasto externo</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={18}/></button>
                </div>

                <div className="px-6 py-5 space-y-5">

                    {/* ── PASO 1: Tipo de gasto (obligatorio) ── */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            1 · ¿Qué tipo de gasto es? <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => { setTipoGasto('INSUMO'); setProductoSel(null); setBusqueda(''); }}
                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-left ${
                                    tipoGasto === 'INSUMO'
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}>
                                <Package size={20} className={tipoGasto === 'INSUMO' ? 'text-purple-600' : 'text-gray-400'} />
                                <span className={`text-sm font-semibold ${tipoGasto === 'INSUMO' ? 'text-purple-700' : 'text-gray-600'}`}>
                                    Insumo del almacén
                                </span>
                                <span className="text-xs text-gray-400 text-center leading-tight">
                                    Descuenta stock del inventario
                                </span>
                            </button>
                            <button
                                onClick={() => { setTipoGasto('EXTERNO'); setProductoSel(null); }}
                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-left ${
                                    tipoGasto === 'EXTERNO'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}>
                                <ShoppingCart size={20} className={tipoGasto === 'EXTERNO' ? 'text-blue-600' : 'text-gray-400'} />
                                <span className={`text-sm font-semibold ${tipoGasto === 'EXTERNO' ? 'text-blue-700' : 'text-gray-600'}`}>
                                    Gasto externo
                                </span>
                                <span className="text-xs text-gray-400 text-center leading-tight">
                                    Servicio, compra directa o taller
                                </span>
                            </button>
                        </div>
                    </div>

                    {tipoGasto && (<>

                        <div className="border-t border-gray-100" />

                        {/* ── PASO 2: Contexto (Obra → Plantilla → Equipo) ── */}
                        <div className="space-y-3">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                2 · Contexto
                            </label>

                            {/* Obra (opcional) */}
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Obra (opcional)</label>
                                <select value={obraId} onChange={e => setObraId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                    <option value="">— Sin obra —</option>
                                    {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                                </select>
                            </div>

                            {/* Plantilla (solo si hay obra) */}
                            {obraId && (
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Plantilla (opcional)</label>
                                    {loadingPlantillas ? (
                                        <p className="text-xs text-gray-400 py-1">Cargando...</p>
                                    ) : plantillas.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic py-1">Esta obra no tiene plantillas.</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {plantillas.map(p => {
                                                const ini = p.fechaInicio ? fDate(String(p.fechaInicio).slice(0, 10)) : null;
                                                const fin = p.fechaFin    ? fDate(String(p.fechaFin).slice(0, 10))    : null;
                                                const checked = plantillaId === p.id;
                                                return (
                                                    <label key={p.id}
                                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                                            checked ? 'bg-purple-50 border-purple-300' : 'border-gray-100 hover:border-gray-200'
                                                        }`}>
                                                        <input type="radio" name="plt" checked={checked}
                                                            onChange={() => setPlantillaId(checked ? '' : p.id)}
                                                            className="accent-purple-600 flex-shrink-0" />
                                                        <span className="text-sm font-semibold text-gray-700 flex-1">Plantilla {p.numero}</span>
                                                        {ini && fin && <span className="text-xs text-gray-400">{ini} – {fin}</span>}
                                                    </label>
                                                );
                                            })}
                                            {plantillaId && (
                                                <button onClick={() => setPlantillaId('')}
                                                    className="text-xs text-gray-400 hover:text-gray-600 underline">
                                                    Deseleccionar plantilla
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Equipo (obligatorio) */}
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                    Equipo <span className="text-red-500">*</span>
                                </label>
                                <select value={equipoId} onChange={e => setEquipoId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                    <option value="">— Selecciona —</option>
                                    {equiposFiltrados.map(eq => (
                                        <option key={eq.id} value={eq.id}>
                                            {eq.nombre}{eq.numeroEconomico ? ` (${eq.numeroEconomico})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Fecha */}
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            </div>
                        </div>

                        <div className="border-t border-gray-100" />

                        {/* ── PASO 3A: INSUMO — buscador de catálogo ── */}
                        {tipoGasto === 'INSUMO' && (
                            <div className="space-y-3">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    3 · Selecciona el insumo
                                </label>

                                {/* Buscador */}
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o SKU..."
                                    value={busqueda}
                                    onChange={e => { setBusqueda(e.target.value); setProductoSel(null); }}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                />

                                {/* Producto seleccionado */}
                                {productoSel && (
                                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-semibold text-purple-800">{productoSel.nombre}</p>
                                            <p className="text-xs text-purple-600 mt-0.5">
                                                Stock: <strong>{productoSel.stockActual} {productoSel.unidad}</strong>
                                                {productoSel.stockBajo && (
                                                    <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                                                        <AlertTriangle size={11}/> Stock bajo
                                                    </span>
                                                )}
                                                &nbsp;· Precio: ${productoSel.precioCompra.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {productoSel.moneda}
                                            </p>
                                        </div>
                                        <button onClick={() => setProductoSel(null)} className="text-purple-400 hover:text-purple-700 flex-shrink-0">
                                            <X size={14}/>
                                        </button>
                                    </div>
                                )}

                                {/* Lista de resultados */}
                                {!productoSel && (
                                    loadingCatalogo ? (
                                        <p className="text-xs text-gray-400 py-2">Cargando catálogo...</p>
                                    ) : catalogoFiltrado.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic py-2">No se encontraron productos.</p>
                                    ) : (
                                        <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                                            {catalogoFiltrado.slice(0, 30).map(p => (
                                                <button key={p.id}
                                                    onClick={() => { setProductoSel(p); setBusqueda(p.nombre); }}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-purple-50 transition-colors text-left">
                                                    <div>
                                                        <p className="text-sm text-gray-800">{p.nombre}</p>
                                                        <p className="text-xs text-gray-400">{p.sku} · {p.unidad}</p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0 ml-2">
                                                        <p className={`text-xs font-medium ${p.stockBajo ? 'text-amber-600' : 'text-gray-600'}`}>
                                                            {p.stockActual} {p.unidad}
                                                        </p>
                                                        {p.stockBajo && <p className="text-xs text-amber-500">Stock bajo</p>}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )
                                )}

                                {/* Cantidad + almacén */}
                                {productoSel && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">
                                                Cantidad <span className="text-red-500">*</span>
                                                {productoSel && <span className="text-gray-400"> (máx. {productoSel.stockActual})</span>}
                                            </label>
                                            <input type="number" min="0.01" step="0.01"
                                                max={productoSel?.stockActual}
                                                value={cantidadInsumo}
                                                onChange={e => setCantidadInsumo(e.target.value)}
                                                placeholder="0"
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Almacén</label>
                                            <select value={almacenId} onChange={e => setAlmacenId(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20">
                                                {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* Total INSUMO */}
                                {totalInsumo !== null && (
                                    <div className="bg-purple-50 rounded-xl px-4 py-3 flex justify-between items-center">
                                        <span className="text-xs text-purple-600 font-medium">Total estimado</span>
                                        <span className="text-sm font-bold text-purple-700">
                                            ${totalInsumo.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {productoSel?.moneda}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── PASO 3B: EXTERNO — formulario libre ── */}
                        {tipoGasto === 'EXTERNO' && (
                            <div className="space-y-3">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    3 · Detalle del gasto
                                </label>

                                {/* Categoría */}
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                                    <select value={extForm.categoria} onChange={e => setExt('categoria', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                        {Object.entries(CATEGORIAS).map(([k, v]) => (
                                            <option key={k} value={k}>{v.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Concepto */}
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">
                                        Concepto / Producto <span className="text-red-500">*</span>
                                    </label>
                                    <input type="text" value={extForm.producto}
                                        onChange={e => setExt('producto', e.target.value)}
                                        placeholder="Ej: Aceite motor SAE 15W40"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>

                                {/* Cantidad, unidad, precio */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Cantidad <span className="text-red-500">*</span></label>
                                        <input type="number" min="0" step="0.01" value={extForm.cantidad}
                                            onChange={e => setExt('cantidad', e.target.value)}
                                            placeholder="1"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Unidad</label>
                                        <select value={extForm.unidad} onChange={e => setExt('unidad', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                            {['pza', 'lt', 'kg', 'caja', 'día', 'hr', 'servicio', 'mts'].map(u => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Precio unit. <span className="text-red-500">*</span></label>
                                        <input type="number" min="0" step="0.01" value={extForm.precioUnitario}
                                            onChange={e => setExt('precioUnitario', e.target.value)}
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                    </div>
                                </div>

                                {/* Moneda */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Moneda</label>
                                        <select value={extForm.moneda} onChange={e => setExt('moneda', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                            <option value="MXN">MXN</option>
                                            <option value="USD">USD</option>
                                        </select>
                                    </div>
                                    {extForm.moneda === 'USD' && (
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Tipo de cambio</label>
                                            <input type="number" min="0" step="0.01" value={extForm.tipoCambio}
                                                onChange={e => setExt('tipoCambio', e.target.value)}
                                                placeholder="17.50"
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                        </div>
                                    )}
                                </div>

                                {/* Total EXTERNO */}
                                {totalExterno !== null && (
                                    <div className="bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center">
                                        <span className="text-xs text-blue-600 font-medium">Total</span>
                                        <span className="text-sm font-bold text-blue-700">
                                            ${totalExterno.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {extForm.moneda}
                                        </span>
                                    </div>
                                )}

                                {/* Notas */}
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Notas</label>
                                    <input type="text" value={extForm.notas}
                                        onChange={e => setExt('notas', e.target.value)}
                                        placeholder="Opcional"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                            </div>
                        )}
                    </>)}
                </div>

                {error && <p className="text-xs text-red-500 px-6 pb-2">{error}</p>}

                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex gap-2">
                    <button onClick={onClose}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving || !tipoGasto}
                        className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-40">
                        {saving ? 'Guardando...' : 'Registrar gasto'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────
function GastosOperativosInner() {
    const searchParams  = useSearchParams();
    const equipoIdParam = searchParams.get('equipoId') || '';

    const [gastos,       setGastos]       = useState<Gasto[]>([]);
    const [equipos,      setEquipos]      = useState<Equipo[]>([]);
    const [obras,        setObras]        = useState<Obra[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState('');
    const [modal,        setModal]        = useState(false);
    const [filtroEquipo, setFiltroEquipo] = useState(equipoIdParam);
    const [filtroCateg,  setFiltroCateg]  = useState('');
    const [filtroTipo,   setFiltroTipo]   = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filtroEquipo) params.set('equipoId', filtroEquipo);
            if (filtroCateg)  params.set('categoria', filtroCateg);
            if (filtroTipo)   params.set('tipoGasto', filtroTipo);
            const [gs, eqs, obs] = await Promise.all([
                fetchApi(`/gastos-operativos${params.toString() ? '?' + params.toString() : ''}`),
                fetchApi('/equipos'),
                fetchApi('/obras'),
            ]);
            setGastos(gs); setEquipos(eqs); setObras(obs);
        } catch (e: any) {
            setError(e.message || 'Error al cargar gastos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [filtroEquipo, filtroCateg, filtroTipo]);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este gasto? Si era un insumo, el stock se restaurará automáticamente.')) return;
        try {
            await fetchApi(`/gastos-operativos/${id}`, { method: 'DELETE' });
            setGastos(g => g.filter(x => x.id !== id));
        } catch (e: any) {
            alert(e.message || 'Error al eliminar');
        }
    };

    const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const totalMXN = gastos.filter(g => g.moneda === 'MXN').reduce((a, g) => a + g.total, 0);
    const totalUSD = gastos.filter(g => g.moneda === 'USD').reduce((a, g) => a + g.total, 0);
    const totalInsumos  = gastos.filter(g => g.tipoGasto === 'INSUMO'  && g.moneda === 'MXN').reduce((a, g) => a + g.total, 0);
    const totalExternos = gastos.filter(g => g.tipoGasto === 'EXTERNO' && g.moneda === 'MXN').reduce((a, g) => a + g.total, 0);

    const porCategoria = Object.keys(CATEGORIAS).map(cat => ({
        cat,
        total: gastos.filter(g => g.categoria === cat && g.moneda === 'MXN').reduce((a, g) => a + g.total, 0),
    })).filter(x => x.total > 0);

    return (
        <div className="space-y-5 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Gastos Operativos</h1>
                    <p className="text-sm text-gray-500 mt-1">Insumos del almacén y gastos externos por equipo.</p>
                </div>
                <button onClick={() => setModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                    <Plus size={16} /> Nuevo gasto
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

            {/* KPIs */}
            {!loading && gastos.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-400 mb-1">Total MXN</p>
                        <p className="text-2xl font-bold text-gray-800">${fmt(totalMXN)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-400 mb-1">Insumos (almacén)</p>
                        <p className="text-xl font-bold text-purple-700">${fmt(totalInsumos)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-400 mb-1">Gastos externos</p>
                        <p className="text-xl font-bold text-blue-700">${fmt(totalExternos)}</p>
                    </div>
                    {totalUSD > 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <p className="text-xs text-gray-400 mb-1">Total USD</p>
                            <p className="text-xl font-bold text-green-700">${fmt(totalUSD)}</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 col-span-1">
                            <p className="text-xs text-gray-400 mb-2">Por categoría (MXN)</p>
                            <div className="flex flex-wrap gap-1.5">
                                {porCategoria.map(({ cat, total }) => (
                                    <span key={cat} className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORIAS[cat]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                                        {CATEGORIAS[cat]?.label}: ${total.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Filtros */}
            <div className="flex gap-3 flex-wrap items-center">
                <Filter size={14} className="text-gray-400 flex-shrink-0" />
                <select value={filtroEquipo} onChange={e => setFiltroEquipo(e.target.value)}
                    className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Todos los equipos</option>
                    {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
                </select>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                    className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Todos los tipos</option>
                    <option value="INSUMO">Insumo del almacén</option>
                    <option value="EXTERNO">Gasto externo</option>
                </select>
                <select value={filtroCateg} onChange={e => setFiltroCateg(e.target.value)}
                    className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">Todas las categorías</option>
                    {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {(filtroEquipo || filtroCateg || filtroTipo) && (
                    <button onClick={() => { setFiltroEquipo(''); setFiltroCateg(''); setFiltroTipo(''); }}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                        <X size={13} /> Limpiar
                    </button>
                )}
            </div>

            {/* Tabla */}
            <Card>
                {loading ? (
                    <div className="p-10 text-center text-gray-400 text-sm">Cargando gastos...</div>
                ) : gastos.length === 0 ? (
                    <div className="p-10 text-center">
                        <Receipt size={36} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-600">No hay gastos registrados</p>
                        <p className="text-xs text-gray-400 mt-1">Registra el primer gasto operativo con el botón de arriba.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipo</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipo</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Categoría</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Concepto</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Cant.</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">P. Unit.</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Total</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Obra / Plantilla</th>
                                    <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {gastos.map(g => (
                                    <tr key={g.id} className="hover:bg-blue-50/20 transition-colors group">
                                        <td className="p-3 text-xs text-gray-500">
                                            {g.fechaInicio
                                                ? new Date(g.fechaInicio + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                                                : `S${g.semanaNum}/${g.anoNum}`}
                                        </td>
                                        <td className="p-3">
                                            {g.tipoGasto === 'INSUMO' ? (
                                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                                                    <Package size={10}/> Insumo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                                    <ShoppingCart size={10}/> Externo
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <p className="text-sm font-medium text-gray-700">{g.equipo.nombre}</p>
                                            {g.equipo.numeroEconomico && <p className="text-xs text-gray-400">{g.equipo.numeroEconomico}</p>}
                                        </td>
                                        <td className="p-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORIAS[g.categoria]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                                                {CATEGORIAS[g.categoria]?.label ?? g.categoria}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <p className="text-sm text-gray-800">{g.producto}</p>
                                            {g.notas && <p className="text-xs text-gray-400 mt-0.5">{g.notas}</p>}
                                        </td>
                                        <td className="p-3 text-right text-sm text-gray-600">{g.cantidad} {g.unidad}</td>
                                        <td className="p-3 text-right text-sm text-gray-600">${fmt(g.precioUnitario)}</td>
                                        <td className="p-3 text-right">
                                            <span className="text-sm font-bold text-gray-800">${fmt(g.total)}</span>
                                            <p className="text-xs text-gray-400">{g.moneda}</p>
                                        </td>
                                        <td className="p-3">
                                            <p className="text-xs text-gray-600">{g.obra?.nombre ?? '—'}</p>
                                            {g.plantilla && (
                                                <p className="text-xs text-gray-400">Plt. {g.plantilla.numero}</p>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleDelete(g.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {modal && (
                <GastoModal
                    equipos={equipos}
                    obras={obras}
                    onClose={() => setModal(false)}
                    onSaved={() => { setModal(false); load(); }}
                />
            )}
        </div>
    );
}

export default function GastosOperativosPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>}>
            <GastosOperativosInner />
        </Suspense>
    );
}
