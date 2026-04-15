"use client";

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Filter, Package, Plus, Receipt, ShoppingCart, Trash2, X } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

type TipoGasto = 'INSUMO' | 'EXTERNO';
type NivelGasto = 'GENERAL' | 'POR_EQUIPO' | 'POR_PLANTILLA' | 'DISTRIBUIBLE';

type Equipo = { id: string; nombre: string; numeroEconomico: string | null };
type Obra = { id: string; nombre: string; status?: string };
type Almacen = { id: string; nombre: string };
type Plantilla = { id: string; numero: number; fechaInicio: string | null; fechaFin: string | null; status?: string; plantillaEquipos?: { equipoId: string; equipo: Equipo }[] };

type ProductoCatalogo = {
  id: string;
  nombre: string;
  sku: string;
  unidad: string;
  precioCompra: number;
  stockActual: number;
  stockMinimo: number;
  stockBajo: boolean;
  moneda: 'MXN' | 'USD';
};

type Distribucion = {
  plantillaId: string;
  porcentaje: string;
  montoAsignado: string;
  metodoAsignacion: 'MANUAL' | 'POR_DIAS' | 'POR_HORAS';
};

type Gasto = {
  id: string;
  tipoGasto: TipoGasto;
  nivelGasto: NivelGasto;
  distribuible: boolean;
  obraId: string | null;
  equipoId: string | null;
  plantillaId: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  categoria: string;
  producto: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  moneda: 'MXN' | 'USD';
  notas: string | null;
  obra: { nombre: string } | null;
  equipo: { nombre: string; numeroEconomico: string | null } | null;
  plantilla: { id: string; numero: number } | null;
  distribuciones: { id: string; plantillaId: string; porcentaje: number; montoAsignado: number; metodoAsignacion: string; plantilla?: { id: string; numero: number } }[];
};

const CATEGORIAS: Record<string, { label: string; color: string }> = {
  LUBRICANTE: { label: 'Lubricante', color: 'bg-yellow-100 text-yellow-700' },
  FILTRO: { label: 'Filtro', color: 'bg-orange-100 text-orange-700' },
  HERRAMIENTA: { label: 'Herramienta', color: 'bg-blue-100 text-blue-700' },
  COMBUSTIBLE: { label: 'Combustible', color: 'bg-red-100 text-red-700' },
  PERSONAL: { label: 'Personal', color: 'bg-purple-100 text-purple-700' },
  VEHICULO: { label: 'Vehículo', color: 'bg-indigo-100 text-indigo-700' },
  RENTA_EQUIPO: { label: 'Renta equipo', color: 'bg-orange-100 text-orange-800' },
  OTRO: { label: 'Otro', color: 'bg-gray-100 text-gray-600' },
};

const NIVELES: { value: NivelGasto; label: string; help: string }[] = [
  { value: 'GENERAL', label: 'General de obra', help: 'Afecta a la obra completa. No requiere equipo ni plantilla.' },
  { value: 'POR_EQUIPO', label: 'Por equipo', help: 'Afecta a una obra y a un equipo específico.' },
  { value: 'POR_PLANTILLA', label: 'Por plantilla', help: 'Afecta a una plantilla específica de la obra.' },
  { value: 'DISTRIBUIBLE', label: 'Distribuible', help: 'Se reparte entre varias plantillas.' },
];

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(String(value).slice(0, 10) + 'T12:00:00');
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Money({ value, moneda = 'MXN' }: { value: number; moneda?: 'MXN' | 'USD' }) {
  return <>{moneda === 'USD' ? 'US$' : '$'}{value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

function GastoModal({ obras, equipos, onClose, onSaved }: { obras: Obra[]; equipos: Equipo[]; onClose: () => void; onSaved: () => void }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [nivelGasto, setNivelGasto] = useState<NivelGasto>('GENERAL');
  const [tipoGasto, setTipoGasto] = useState<TipoGasto>('EXTERNO');
  const [obraId, setObraId] = useState('');
  const [equipoId, setEquipoId] = useState('');
  const [plantillaId, setPlantillaId] = useState('');
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState('');
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [catalogo, setCatalogo] = useState<ProductoCatalogo[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [productoSel, setProductoSel] = useState<ProductoCatalogo | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [almacenId, setAlmacenId] = useState('');
  const [cantidadInsumo, setCantidadInsumo] = useState('');
  const [extForm, setExtForm] = useState({
    categoria: 'OTRO',
    producto: '',
    unidad: 'pza',
    cantidad: '',
    precioUnitario: '',
    moneda: 'MXN',
    tipoCambio: '',
    notas: '',
  });
  const [distribuciones, setDistribuciones] = useState<Distribucion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoadingCatalogo(true);
    Promise.all([fetchApi('/products'), fetchApi('/warehouse')])
      .then(([prods, alms]) => {
        setCatalogo(Array.isArray(prods) ? prods : []);
        setAlmacenes(Array.isArray(alms) ? alms : []);
        if (Array.isArray(alms) && alms[0]) setAlmacenId(alms[0].id);
      })
      .finally(() => setLoadingCatalogo(false));
  }, []);

  useEffect(() => {
    if (!obraId) {
      setPlantillas([]);
      setPlantillaId('');
      setDistribuciones([]);
      return;
    }
    setLoadingPlantillas(true);
    fetchApi(`/obras/${obraId}`)
      .then((obra: any) => {
        const pls = Array.isArray(obra?.plantillas) ? obra.plantillas : [];
        setPlantillas(pls);
        setDistribuciones((prev) => prev.filter((d) => pls.some((p: Plantilla) => p.id === d.plantillaId)));
      })
      .catch(() => setPlantillas([]))
      .finally(() => setLoadingPlantillas(false));
  }, [obraId]);

  useEffect(() => {
    if (nivelGasto === 'GENERAL') {
      setEquipoId('');
      setPlantillaId('');
    }
    if (nivelGasto === 'POR_EQUIPO') {
      setPlantillaId('');
    }
    if (nivelGasto === 'POR_PLANTILLA') {
      setDistribuciones([]);
    }
    if (nivelGasto !== 'DISTRIBUIBLE') {
      setDistribuciones([]);
    }
  }, [nivelGasto]);

  const catalogoFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter((p) => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [busqueda, catalogo]);

  const equiposFiltrados = useMemo(() => {
    if (nivelGasto === 'POR_PLANTILLA' && plantillaId) {
      const p = plantillas.find((x) => x.id === plantillaId);
      return p?.plantillaEquipos?.map((pe) => pe.equipo) || equipos;
    }
    if (obraId) {
      const ids = new Set<string>();
      const list: Equipo[] = [];
      plantillas.forEach((p) => (p.plantillaEquipos || []).forEach((pe) => {
        if (!ids.has(pe.equipoId)) {
          ids.add(pe.equipoId);
          list.push(pe.equipo);
        }
      }));
      return list.length ? list : equipos;
    }
    return equipos;
  }, [nivelGasto, plantillaId, plantillas, obraId, equipos]);

  const totalExterno = extForm.cantidad && extForm.precioUnitario ? Number(extForm.cantidad) * Number(extForm.precioUnitario) : 0;
  const totalInsumo = productoSel && cantidadInsumo ? Number(cantidadInsumo) * Number(productoSel.precioCompra) : 0;
  const totalActual = tipoGasto === 'INSUMO' ? totalInsumo : totalExterno;
  const totalDistribuido = distribuciones.reduce((acc, d) => acc + Number(d.montoAsignado || 0), 0);
  const totalPorcentaje = distribuciones.reduce((acc, d) => acc + Number(d.porcentaje || 0), 0);

  const setExt = (key: keyof typeof extForm, value: string) => setExtForm((prev) => ({ ...prev, [key]: value }));
  const updateDistribucion = (index: number, patch: Partial<Distribucion>) => {
    setDistribuciones((prev) => prev.map((d, i) => i === index ? { ...d, ...patch } : d));
  };
  const addDistribucion = () => {
    const existing = new Set(distribuciones.map((d) => d.plantillaId));
    const next = plantillas.find((p) => !existing.has(p.id));
    if (!next) return;
    setDistribuciones((prev) => [...prev, { plantillaId: next.id, porcentaje: '', montoAsignado: '', metodoAsignacion: 'MANUAL' }]);
  };
  const removeDistribucion = (index: number) => setDistribuciones((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    try {
      setError('');
      if (!obraId) throw new Error('La obra es obligatoria.');
      if (nivelGasto === 'POR_EQUIPO' && !equipoId) throw new Error('Selecciona un equipo.');
      if (nivelGasto === 'POR_PLANTILLA' && !plantillaId) throw new Error('Selecciona una plantilla.');
      if (nivelGasto === 'DISTRIBUIBLE' && distribuciones.length === 0) throw new Error('Agrega al menos una distribución.');
      if (nivelGasto === 'DISTRIBUIBLE' && totalActual <= 0) throw new Error('Define el total del gasto antes de distribuirlo.');

      let body: any = {
        nivelGasto,
        distribuible: nivelGasto === 'DISTRIBUIBLE',
        obraId,
        equipoId: equipoId || null,
        plantillaId: nivelGasto === 'POR_PLANTILLA' ? plantillaId : null,
        fechaInicio,
        fechaFin: fechaFin || null,
      };

      if (nivelGasto === 'DISTRIBUIBLE') {
        body.distribuciones = distribuciones.map((d) => ({
          plantillaId: d.plantillaId,
          porcentaje: Number(d.porcentaje || 0),
          montoAsignado: Number(d.montoAsignado || 0),
          metodoAsignacion: d.metodoAsignacion,
        }));
      }

      if (tipoGasto === 'INSUMO') {
        if (!productoSel) throw new Error('Selecciona un insumo del catálogo.');
        if (!cantidadInsumo || Number(cantidadInsumo) <= 0) throw new Error('La cantidad debe ser mayor a 0.');
        if (Number(cantidadInsumo) > Number(productoSel.stockActual)) throw new Error(`Stock insuficiente. Disponible: ${productoSel.stockActual} ${productoSel.unidad}`);

        body = {
          ...body,
          tipoGasto: 'INSUMO',
          categoria: extForm.categoria,
          productoId: productoSel.id,
          almacenId: almacenId || null,
          cantidad: Number(cantidadInsumo),
          moneda: productoSel.moneda,
        };
      } else {
        if (!extForm.producto.trim()) throw new Error('El concepto es obligatorio.');
        if (!extForm.precioUnitario || Number(extForm.precioUnitario) <= 0) throw new Error('El precio unitario es obligatorio.');
        if (!extForm.cantidad || Number(extForm.cantidad) <= 0) throw new Error('La cantidad debe ser mayor a 0.');

        body = {
          ...body,
          tipoGasto: 'EXTERNO',
          categoria: extForm.categoria,
          producto: extForm.producto.trim(),
          unidad: extForm.unidad,
          cantidad: Number(extForm.cantidad),
          precioUnitario: Number(extForm.precioUnitario),
          moneda: extForm.moneda,
          tipoCambio: extForm.tipoCambio ? Number(extForm.tipoCambio) : null,
          notas: extForm.notas || null,
        };
      }

      setSaving(true);
      await fetchApi('/gastos-operativos', { method: 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error al guardar el gasto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 pt-6 pb-4 rounded-t-2xl flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Nuevo Gasto Operativo</h2>
            <p className="text-xs text-gray-400 mt-0.5">Define nivel del gasto y origen para mantener trazabilidad de obra.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">1 · ¿Cómo se asigna este gasto?</label>
            <div className="grid md:grid-cols-4 gap-2">
              {NIVELES.map((n) => (
                <button
                  key={n.value}
                  type="button"
                  onClick={() => setNivelGasto(n.value)}
                  className={`text-left rounded-xl border p-3 transition-all ${nivelGasto === n.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <p className={`text-sm font-semibold ${nivelGasto === n.value ? 'text-blue-700' : 'text-gray-700'}`}>{n.label}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-tight">{n.help}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">2 · Origen del gasto</label>
            <div className="grid md:grid-cols-2 gap-2">
              <button type="button" onClick={() => setTipoGasto('INSUMO')} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${tipoGasto === 'INSUMO' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <Package size={20} className={tipoGasto === 'INSUMO' ? 'text-purple-600' : 'text-gray-400'} />
                <span className={`text-sm font-semibold ${tipoGasto === 'INSUMO' ? 'text-purple-700' : 'text-gray-600'}`}>Insumo del almacén</span>
                <span className="text-xs text-gray-400 text-center leading-tight">Descuenta stock del inventario</span>
              </button>
              <button type="button" onClick={() => setTipoGasto('EXTERNO')} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${tipoGasto === 'EXTERNO' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <ShoppingCart size={20} className={tipoGasto === 'EXTERNO' ? 'text-blue-600' : 'text-gray-400'} />
                <span className={`text-sm font-semibold ${tipoGasto === 'EXTERNO' ? 'text-blue-700' : 'text-gray-600'}`}>Gasto externo</span>
                <span className="text-xs text-gray-400 text-center leading-tight">Servicio, compra directa o taller</span>
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Obra <span className="text-red-500">*</span></label>
              <select value={obraId} onChange={(e) => setObraId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">— Selecciona —</option>
                {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>

            {nivelGasto !== 'GENERAL' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Equipo {nivelGasto === 'POR_EQUIPO' ? <span className="text-red-500">*</span> : null}</label>
                <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">— Selecciona —</option>
                  {equiposFiltrados.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre}{eq.numeroEconomico ? ` (${eq.numeroEconomico})` : ''}</option>)}
                </select>
              </div>
            )}

            {nivelGasto === 'POR_PLANTILLA' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Plantilla <span className="text-red-500">*</span></label>
                <select value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">— Selecciona —</option>
                  {plantillas.map((p) => <option key={p.id} value={p.id}>Plantilla {p.numero} · {formatDate(p.fechaInicio)} - {formatDate(p.fechaFin)}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha fin (opcional)</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          {tipoGasto === 'INSUMO' ? (
            <div className="space-y-3">
              <div className="border-t border-gray-100" />
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">3 · Selecciona el insumo</label>
              <input type="text" placeholder="Buscar por nombre o SKU..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setProductoSel(null); }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              {productoSel ? (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-purple-800">{productoSel.nombre}</p>
                    <p className="text-xs text-purple-600 mt-0.5">Stock: <strong>{productoSel.stockActual} {productoSel.unidad}</strong> · Precio: <Money value={productoSel.precioCompra} moneda={productoSel.moneda} /></p>
                  </div>
                  <button onClick={() => setProductoSel(null)} className="text-purple-400 hover:text-purple-700"><X size={14} /></button>
                </div>
              ) : loadingCatalogo ? (
                <p className="text-xs text-gray-400 py-2">Cargando catálogo...</p>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                  {catalogoFiltrado.slice(0, 25).map((p) => (
                    <button key={p.id} type="button" onClick={() => { setProductoSel(p); setBusqueda(p.nombre); }} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-purple-50 text-left">
                      <div>
                        <p className="text-sm text-gray-800">{p.nombre}</p>
                        <p className="text-xs text-gray-400">{p.sku} · {p.unidad}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className={`text-xs font-medium ${p.stockBajo ? 'text-amber-600' : 'text-gray-600'}`}>{p.stockActual} {p.unidad}</p>
                        {p.stockBajo && <p className="text-xs text-amber-500">Stock bajo</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {productoSel && (
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cantidad <span className="text-red-500">*</span></label>
                    <input type="number" min="0.01" step="0.01" max={productoSel.stockActual} value={cantidadInsumo} onChange={(e) => setCantidadInsumo(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Almacén</label>
                    <select value={almacenId} onChange={(e) => setAlmacenId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {totalInsumo > 0 && <div className="bg-purple-50 rounded-xl px-4 py-3 flex justify-between items-center"><span className="text-xs text-purple-600 font-medium">Total estimado</span><span className="text-sm font-bold text-purple-700"><Money value={totalInsumo} moneda={productoSel?.moneda || 'MXN'} /></span></div>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border-t border-gray-100" />
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">3 · Detalle del gasto</label>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                  <select value={extForm.categoria} onChange={(e) => setExt('categoria', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    {Object.entries(CATEGORIAS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unidad</label>
                  <input value={extForm.unidad} onChange={(e) => setExt('unidad', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Concepto / producto <span className="text-red-500">*</span></label>
                  <input value={extForm.producto} onChange={(e) => setExt('producto', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                  <input type="number" min="0.01" step="0.01" value={extForm.cantidad} onChange={(e) => setExt('cantidad', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio unitario</label>
                  <input type="number" min="0.01" step="0.01" value={extForm.precioUnitario} onChange={(e) => setExt('precioUnitario', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Moneda</label>
                  <select value={extForm.moneda} onChange={(e) => setExt('moneda', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                {extForm.moneda === 'USD' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tipo de cambio</label>
                    <input type="number" min="0.01" step="0.01" value={extForm.tipoCambio} onChange={(e) => setExt('tipoCambio', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Notas</label>
                  <textarea value={extForm.notas} onChange={(e) => setExt('notas', e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              {totalExterno > 0 && <div className="bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center"><span className="text-xs text-blue-600 font-medium">Total estimado</span><span className="text-sm font-bold text-blue-700"><Money value={totalExterno} moneda={extForm.moneda as 'MXN' | 'USD'} /></span></div>}
            </div>
          )}

          {nivelGasto === 'DISTRIBUIBLE' && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">4 · Distribución manual por plantillas</label>
                <button type="button" onClick={addDistribucion} disabled={!obraId || plantillas.length === 0} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Agregar plantilla</button>
              </div>
              {loadingPlantillas ? <p className="text-xs text-gray-400">Cargando plantillas...</p> : null}
              {distribuciones.length === 0 ? <p className="text-sm text-gray-400">Agrega una o más plantillas para repartir el gasto.</p> : null}
              {distribuciones.map((d, index) => (
                <div key={`${d.plantillaId}-${index}`} className="grid md:grid-cols-12 gap-2 items-end border border-gray-100 rounded-xl p-3">
                  <div className="md:col-span-4">
                    <label className="block text-xs text-gray-500 mb-1">Plantilla</label>
                    <select value={d.plantillaId} onChange={(e) => updateDistribucion(index, { plantillaId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      {plantillas.map((p) => <option key={p.id} value={p.id}>Plantilla {p.numero}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">Porcentaje</label>
                    <input type="number" min="0" max="100" step="0.01" value={d.porcentaje} onChange={(e) => updateDistribucion(index, { porcentaje: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">Monto asignado</label>
                    <input type="number" min="0" step="0.01" value={d.montoAsignado} onChange={(e) => updateDistribucion(index, { montoAsignado: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button type="button" onClick={() => removeDistribucion(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 space-y-1">
                <p>Total gasto: <span className="font-semibold"><Money value={totalActual || 0} moneda={tipoGasto === 'INSUMO' ? (productoSel?.moneda || 'MXN') : (extForm.moneda as 'MXN' | 'USD')} /></span></p>
                <p>Distribuido: <span className="font-semibold">{totalPorcentaje.toFixed(2)}%</span> · <span className="font-semibold"><Money value={totalDistribuido || 0} moneda={tipoGasto === 'INSUMO' ? (productoSel?.moneda || 'MXN') : (extForm.moneda as 'MXN' | 'USD')} /></span></p>
                <p className="text-xs text-gray-400">La API valida que la distribución sume 100% o el total del gasto.</p>
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 text-sm">{error}</div>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-2 justify-end rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-40">{saving ? 'Guardando...' : 'Registrar gasto'}</button>
        </div>
      </div>
    </div>
  );
}

export default function GastosOperativosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [filtroEquipo, setFiltroEquipo] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroEquipo) params.set('equipoId', filtroEquipo);
      if (filtroTipo) params.set('tipoGasto', filtroTipo);
      if (filtroNivel) params.set('nivelGasto', filtroNivel);
      if (filtroCategoria) params.set('categoria', filtroCategoria);
      const [gs, eqs, obs] = await Promise.all([
        fetchApi(`/gastos-operativos${params.toString() ? `?${params.toString()}` : ''}`),
        fetchApi('/equipos'),
        fetchApi('/obras'),
      ]);
      setGastos(Array.isArray(gs) ? gs : []);
      setEquipos(Array.isArray(eqs) ? eqs : []);
      setObras(Array.isArray(obs) ? obs : []);
    } catch (e: any) {
      setError(e.message || 'Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filtroEquipo, filtroTipo, filtroNivel, filtroCategoria]);

  const totalMXN = gastos.filter((g) => g.moneda === 'MXN').reduce((a, g) => a + g.total, 0);
  const totalInsumos = gastos.filter((g) => g.tipoGasto === 'INSUMO' && g.moneda === 'MXN').reduce((a, g) => a + g.total, 0);
  const totalExternos = gastos.filter((g) => g.tipoGasto === 'EXTERNO' && g.moneda === 'MXN').reduce((a, g) => a + g.total, 0);
  const totalDistribuibles = gastos.filter((g) => g.nivelGasto === 'DISTRIBUIBLE').length;

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gasto? Si era un insumo, el stock se restaurará automáticamente.')) return;
    try {
      await fetchApi(`/gastos-operativos/${id}`, { method: 'DELETE' });
      setGastos((prev) => prev.filter((g) => g.id !== id));
    } catch (e: any) {
      alert(e.message || 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gastos Operativos</h1>
          <p className="text-sm text-gray-500 mt-1">Separa origen del gasto (almacén / externo) del nivel operativo (obra / equipo / plantilla / distribuible).</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
          <Plus size={16} /> Nuevo gasto
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

      {!loading && gastos.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Total MXN</p><p className="text-2xl font-bold text-gray-800"><Money value={totalMXN} /></p></div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Insumos desde almacén</p><p className="text-xl font-bold text-purple-700"><Money value={totalInsumos} /></p></div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Gastos externos</p><p className="text-xl font-bold text-blue-700"><Money value={totalExternos} /></p></div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Distribuibles</p><p className="text-2xl font-bold text-gray-800">{totalDistribuibles}</p></div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-center">
        <Filter size={14} className="text-gray-400 flex-shrink-0" />
        <select value={filtroEquipo} onChange={(e) => setFiltroEquipo(e.target.value)} className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
          <option value="">Todos los equipos</option>
          {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
        </select>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
          <option value="">Todos los orígenes</option>
          <option value="INSUMO">Insumo del almacén</option>
          <option value="EXTERNO">Gasto externo</option>
        </select>
        <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)} className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
          <option value="">Todos los niveles</option>
          {NIVELES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
        </select>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(filtroEquipo || filtroTipo || filtroNivel || filtroCategoria) && (
          <button onClick={() => { setFiltroEquipo(''); setFiltroTipo(''); setFiltroNivel(''); setFiltroCategoria(''); }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

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
                  <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Origen</th>
                  <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Nivel</th>
                  <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Obra / contexto</th>
                  <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Concepto</th>
                  <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                  <th className="p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((g) => (
                  <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="p-3 text-sm text-gray-700">
                      <div>{formatDate(g.fechaInicio)}</div>
                      <div className="text-xs text-gray-400">{g.fechaFin ? `→ ${formatDate(g.fechaFin)}` : 'Sin rango'}</div>
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${g.tipoGasto === 'INSUMO' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {g.tipoGasto === 'INSUMO' ? 'Almacén' : 'Externo'}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      <div className="font-medium">{NIVELES.find((n) => n.value === g.nivelGasto)?.label || g.nivelGasto}</div>
                      {g.distribuible && <div className="text-xs text-gray-400">{g.distribuciones.length} distribución(es)</div>}
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      <div className="font-medium">{g.obra?.nombre || '—'}</div>
                      <div className="text-xs text-gray-400">{g.equipo?.nombre || 'Sin equipo'}{g.plantilla ? ` · Plantilla ${g.plantilla.numero}` : ''}</div>
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      <div className="font-medium">{g.producto}</div>
                      <div className="text-xs text-gray-400">{g.cantidad} {g.unidad} × <Money value={g.precioUnitario} moneda={g.moneda} /></div>
                      {g.distribuciones.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {g.distribuciones.map((d) => (
                            <span key={d.id} className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">P{d.plantilla?.numero || '?'} · {d.porcentaje.toFixed(0)}%</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-sm font-semibold text-gray-800"><Money value={g.total} moneda={g.moneda} /></td>
                    <td className="p-3 text-right">
                      <button onClick={() => handleDelete(g.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && <GastoModal obras={obras} equipos={equipos} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
    </div>
  );
}
