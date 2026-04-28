"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Wrench, ArrowLeft, Plus, Trash2,
    CheckCircle, XCircle, Gauge, Droplets,
    ChevronDown, ChevronUp, Calendar,
    Package, History, X, AlertCircle,
    ArrowRightLeft, MapPin, ClipboardList,
    AlertTriangle, BoxesIcon,
    CheckCheck, Settings2, Search, Pencil,
    ShoppingCart, Warehouse, ChevronRight,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useCompany } from '@/context/CompanyContext';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type Registro = {
    id: string; fecha: string; horasTrabajadas: number; barrenos: number;
    metrosLineales: number; litrosDiesel: number; precioDiesel: number;
    costoDiesel: number; operadores: number; peones: number;
    obraNombre: string | null; semanaNum: number | null; anoNum: number | null;
    kpi: { litrosPorHora: number | null; litrosPorMetro: number | null; metrosPorHora: number | null };
    usuario: { nombre: string };
};
type Equipo = {
    id: string; nombre: string; modelo: string | null; numeroSerie: string | null;
    numeroEconomico: string | null; hodometroInicial: number; activo: boolean;
    notas: string | null; apodo: string | null; seriePistolaActual: string | null;
    statusEquipo: string | null; _count: { registrosDiarios: number };
};
type MovimientoComponente = {
    id: string; tipo: string; fecha: string; notas: string;
    equipo: { id: string; nombre: string; numeroEconomico: string | null } | null;
};
type Componente = {
    id: string; nombre: string; serie: string | null; tipo: string | null;
    notas: string | null; equipoActualId: string | null; ubicacion: string;
    historial: MovimientoComponente[];
};
type MantenimientoInsumoItem = {
    id: string; origen: 'ALMACEN' | 'COMPRA_DIRECTA';
    producto: { id: string; nombre: string; sku: string; unidad: string } | null;
    almacen: { id: string; nombre: string } | null;
    descripcionLibre: string | null;
    cantidad: number; precioUnitario: number; moneda: 'MXN' | 'USD'; tipoCambio: number | null;
};
// Registro unificado — sirve para legacy Y nuevos
type RegistroMant = {
    id: string; fecha: string; tipo: string | null; descripcion: string;
    observaciones: string | null; horometro: number | null; hrsUso: number | null;
    costo: number | null; moneda: string | null; numeroParte: string | null;
    proveedorId: string | null;
    // Campos del nuevo modelo (presentes solo en registros nuevos)
    tipoBitacora?: 'EVENTO' | 'MANTENIMIENTO';
    insumos?: MantenimientoInsumoItem[];
    pendientesResueltos?: { id: string; descripcion: string; fecha: string }[];
    _esNuevo?: boolean;
};
type Pendiente = {
    id: string; descripcion: string; observacion: string | null;
    horometro: number | null; fecha: string; resuelto: boolean;
    fechaResuelto: string | null; mantenimientoId: string | null;
};
type InsumoConsumoItem = {
    id: string; mantenimientoId: string;
    mantenimiento: { id: string; fecha: string; descripcion: string; tipo: string };
    origen: 'ALMACEN' | 'COMPRA_DIRECTA';
    producto: { id: string; nombre: string; sku: string; unidad: string } | null;
    almacen: { id: string; nombre: string } | null;
    descripcionLibre: string | null;
    cantidad: number; precioUnitario: number; moneda: 'MXN' | 'USD';
    tipoCambio: number | null; tipoCambioUsado: number; totalMXN: number;
};
type InsumoConsumoResponse = {
    equipoId: string; tipoCambioGlobal: number; grandTotalMXN: number;
    items: InsumoConsumoItem[];
};
type ProductoBusqueda = {
    id: string; nombre: string; sku: string; unidad: string;
    stockActual: number; moneda: 'MXN' | 'USD'; precioCompra: number;
    ultimoPrecioCompra: number | null;
    ultimaEntrada: { costo: number; moneda: string; tipoCambio: number | null } | null;
};
type Almacen = { id: string; nombre: string };
type Tab = 'registros' | 'mantenimiento' | 'pendientes' | 'inventario' | 'componentes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_MOV: Record<string, { label: string; pill: string }> = {
    INSTALACION:        { label: 'Instalación',        pill: 'bg-green-100 text-green-700'  },
    RETIRO:             { label: 'Retiro',              pill: 'bg-amber-100 text-amber-700'  },
    ENVIO_REPARACION:   { label: 'Envío a reparación',  pill: 'bg-red-100 text-red-700'      },
    RETORNO_REPARACION: { label: 'Retorno reparación',  pill: 'bg-blue-100 text-blue-700'    },
};
const TIPO_LEGACY: Record<string, { label: string; pill: string }> = {
    PREVENTIVO: { label: 'Preventivo', pill: 'bg-blue-100 text-blue-700'     },
    CORRECTIVO: { label: 'Correctivo', pill: 'bg-red-100 text-red-700'       },
    INSPECCION: { label: 'Inspección', pill: 'bg-gray-100 text-gray-600'     },
    REPARACION: { label: 'Reparación', pill: 'bg-purple-100 text-purple-700' },
};
function fmtFecha(iso: string) {
    return new Date(iso.slice(0,10)+'T12:00:00')
        .toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
}
function fmtMXN(n: number) {
    return '$'+n.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
}
let _keyCounter = 0;
function newKey() { return ++_keyCounter; }

// ─── Modal: Confirmación ──────────────────────────────────────────────────────
function ConfirmModal({ mensaje, titulo, confirmLabel, confirmClass, onConfirm, onCancel }:{
    mensaje:string; titulo?:string; confirmLabel?:string; confirmClass?:string;
    onConfirm:()=>void; onCancel:()=>void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="px-6 py-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                        <Trash2 size={18} className="text-red-500"/>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">{titulo ?? '¿Eliminar registro?'}</h3>
                        <p className="text-xs text-gray-500 mt-1">{mensaje}</p>
                        <p className="text-xs text-red-500 mt-2 font-medium">Esta acción no se puede deshacer.</p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button onClick={onConfirm} className={`flex-1 py-2 rounded-lg text-white text-sm font-semibold ${confirmClass??'bg-red-600 hover:bg-red-700'}`}>
                        {confirmLabel ?? 'Sí, eliminar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
// ─── Línea de insumo (tipo local para el modal) ───────────────────────────────
type LineaInsumo = {
    _key: number; origen: 'ALMACEN'|'COMPRA_DIRECTA';
    productoId:string; productoNombre:string; almacenId:string; almacenNombre:string;
    stockDisponible:number; unidad:string; descripcionLibre:string;
    cantidad:string; precioUnitario:string; moneda:'MXN'|'USD'; tipoCambio:string;
};

// ─── Panel de insumos (reutilizable en ambos modales) ─────────────────────────
function InsumosPanel({ lineas, setLineas, tipoCambioGlobal, almacenes }:{
    lineas:LineaInsumo[]; setLineas:React.Dispatch<React.SetStateAction<LineaInsumo[]>>;
    tipoCambioGlobal:string; almacenes:Almacen[];
}) {
    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState<ProductoBusqueda[]>([]);
    const [buscando, setBuscando] = useState(false);

    useEffect(()=>{
        if(busqueda.trim().length < 2){ setResultados([]); return; }
        const t = setTimeout(async()=>{
            setBuscando(true);
            try {
                const r = await fetchApi(`/products?q=${encodeURIComponent(busqueda)}&limit=8`);
                setResultados(Array.isArray(r) ? r : r.productos ?? []);
            } catch { setResultados([]); } finally { setBuscando(false); }
        },300);
        return ()=>clearTimeout(t);
    },[busqueda]);

    const agregarProducto = (p:ProductoBusqueda) => {
        const primer = almacenes[0];
        setLineas(prev=>[...prev,{
            _key:newKey(), origen:'ALMACEN',
            productoId:p.id, productoNombre:p.nombre,
            almacenId:primer?.id??'', almacenNombre:primer?.nombre??'',
            stockDisponible:p.stockActual, unidad:p.unidad,
            descripcionLibre:'', cantidad:'1',
            precioUnitario:String(p.ultimoPrecioCompra ?? p.precioCompra),
            moneda:(p.ultimaEntrada?.moneda ?? p.moneda) as 'MXN'|'USD', tipoCambio:'',
        }]);
        setBusqueda(''); setResultados([]);
    };
    const agregarDirecta = ()=>setLineas(prev=>[...prev,{
        _key:newKey(), origen:'COMPRA_DIRECTA',
        productoId:'', productoNombre:'', almacenId:'', almacenNombre:'',
        stockDisponible:0, unidad:'', descripcionLibre:'',
        cantidad:'1', precioUnitario:'', moneda:'MXN', tipoCambio:'',
    }]);
    const update = (key:number, d:Partial<LineaInsumo>)=>
        setLineas(prev=>prev.map(l=>l._key===key?{...l,...d}:l));
    const quitar = (key:number)=>setLineas(prev=>prev.filter(l=>l._key!==key));

    const totalMXN = lineas.reduce((acc,l)=>{
        const tc = Number(l.tipoCambio)||Number(tipoCambioGlobal)||1;
        return acc+(l.moneda==='USD'
            ? (Number(l.cantidad)||0)*(Number(l.precioUnitario)||0)*tc
            : (Number(l.cantidad)||0)*(Number(l.precioUnitario)||0));
    },0);

    return (
        <div className="space-y-3">
            {/* Buscador */}
            <div className="relative">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                    <Warehouse size={12}/> Buscar insumo del almacén
                </label>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
                        placeholder="Nombre o SKU del producto..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
                </div>
                {(resultados.length>0||buscando) && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {buscando && <p className="px-3 py-2 text-xs text-gray-400">Buscando...</p>}
                        {resultados.map(p=>(
                            <button key={p.id} onClick={()=>{ if(p.stockActual<=0) return; agregarProducto(p); }}
                                disabled={p.stockActual<=0}
                                className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors text-left ${p.stockActual>0?'hover:bg-blue-50 cursor-pointer':'opacity-50 cursor-not-allowed bg-gray-50'}`}>
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                                    <p className="text-xs text-gray-400">{p.sku} · {p.unidad}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xs font-semibold ${p.stockActual>0?'text-blue-600':'text-red-400'}`}>
                                        {p.stockActual>0?`Stock: ${p.stockActual}`:'Sin stock'}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {((p.ultimaEntrada?.moneda ?? p.moneda)==='USD'?'US$':'$')}
                                        {(p.ultimoPrecioCompra ?? p.precioCompra).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}
                                        {(p.ultimaEntrada?.moneda ?? p.moneda)==='USD' && <span className="ml-1 text-orange-500 font-semibold">USD</span>}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                <hr className="flex-1 border-gray-100"/>
                <span className="text-xs text-gray-400">ó</span>
                <button onClick={agregarDirecta}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50">
                    <ShoppingCart size={12}/> Compra directa
                </button>
            </div>
            {/* Líneas */}
            {lineas.length===0 ? (
                <div className="text-center py-4 border border-dashed border-gray-200 rounded-xl">
                    <p className="text-xs text-gray-400">Sin insumos — puedes guardar sin materiales</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {lineas.map(l=>(
                        <div key={l._key} className={`border rounded-xl p-3 space-y-2 ${l.origen==='ALMACEN'?'border-blue-100 bg-blue-50/30':'border-orange-100 bg-orange-50/30'}`}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {l.origen==='ALMACEN'
                                        ? <Warehouse size={13} className="text-blue-500 flex-shrink-0"/>
                                        : <ShoppingCart size={13} className="text-orange-500 flex-shrink-0"/>}
                                    {l.origen==='ALMACEN' ? (
                                        <div>
                                            <p className="text-xs font-semibold text-gray-800">{l.productoNombre}</p>
                                            <p className="text-xs text-gray-400">
                                                Stock disponible: <span className={Number(l.cantidad)>l.stockDisponible?'text-red-500 font-semibold':`text-gray-400`}>{l.stockDisponible} {l.unidad}</span>
                                            </p>
                                        </div>
                                    ) : (
                                        <input value={l.descripcionLibre} onChange={e=>update(l._key,{descripcionLibre:e.target.value})}
                                            placeholder="Descripción de la compra *"
                                            className="text-xs border border-orange-200 rounded-lg px-2 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-orange-400"/>
                                    )}
                                </div>
                                <button onClick={()=>quitar(l._key)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md">
                                    <X size={13}/>
                                </button>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-0.5">Cantidad</label>
                                    <input type="number" min="0.001" step="0.001" value={l.cantidad}
                                        onChange={e=>update(l._key,{cantidad:e.target.value})}
                                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-0.5">Precio unit.</label>
                                    <input type="number" min="0" step="0.01" value={l.precioUnitario}
                                        onChange={e=>update(l._key,{precioUnitario:e.target.value})}
                                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-0.5">Moneda</label>
                                    <select value={l.moneda} onChange={e=>update(l._key,{moneda:e.target.value as 'MXN'|'USD'})}
                                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                                        <option value="MXN">MXN</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-0.5">T.C. {!l.tipoCambio&&<span className="text-gray-300">(global)</span>}</label>
                                    <input type="number" min="0" step="0.01" value={l.tipoCambio}
                                        onChange={e=>update(l._key,{tipoCambio:e.target.value})}
                                        placeholder={tipoCambioGlobal||'—'}
                                        disabled={l.moneda==='MXN'}
                                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-300"/>
                                </div>
                            </div>
                            {l.origen==='ALMACEN' && (
                                <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 ${Number(l.cantidad)>l.stockDisponible?'bg-red-50 text-red-600 border border-red-100':'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                    {Number(l.cantidad)>l.stockDisponible
                                        ? <><AlertTriangle size={11} className="flex-shrink-0"/><span>Cantidad supera el stock disponible ({l.stockDisponible} {l.unidad})</span></>
                                        : <><AlertCircle size={11} className="flex-shrink-0 text-amber-500"/><span>Se descontarán <strong>{l.cantidad} {l.unidad}</strong> del stock al guardar</span></>
                                    }
                                </div>
                            )}
                            {l.origen==='ALMACEN' && almacenes.length>1 && (
                                <div>
                                    <label className="block text-xs text-gray-400 mb-0.5">Almacén</label>
                                    <select value={l.almacenId} onChange={e=>update(l._key,{almacenId:e.target.value})}
                                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                                        {almacenes.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-xs font-semibold text-gray-500">Total estimado</span>
                        <span className="text-sm font-bold text-gray-800">{fmtMXN(totalMXN)} <span className="text-xs font-normal text-gray-400">MXN</span></span>
                    </div>
                </div>
            )}
        </div>
    );
}
// ─── Modal: Nuevo/Editar registro de Bitácora (nuevo modelo, 3 pasos) ─────────
function NuevoBitacoraModal({ equipoId, pendientesAbiertos, onClose, onSuccess, usuarioId, registroEditar }:{
    equipoId:string; pendientesAbiertos:Pendiente[]; onClose:()=>void;
    onSuccess:()=>void; usuarioId:string; registroEditar?:RegistroMant;
}) {
    const editando = !!registroEditar;
    const [paso, setPaso] = useState<1|2|3>(1);
    const [tipo, setTipo] = useState<'EVENTO'|'MANTENIMIENTO'>(
        registroEditar?.tipoBitacora ?? 'MANTENIMIENTO');
    const [fecha, setFecha] = useState(registroEditar?.fecha?.slice(0,10) ?? new Date().toISOString().slice(0,10));
    const [descripcion, setDescripcion] = useState(registroEditar?.descripcion ?? '');
    const [observaciones, setObservaciones] = useState(registroEditar?.observaciones ?? '');
    const [horometro, setHorometro] = useState(registroEditar?.horometro!=null ? String(registroEditar.horometro) : '');
    const [lineas, setLineas] = useState<LineaInsumo[]>(()=>{
        if(!registroEditar?.insumos?.length) return [];
        return registroEditar.insumos.map(ins=>({
            _key: Date.now()+Math.random(),
            origen: ins.origen,
            productoId: ins.producto?.id ?? '',
            productoNombre: ins.producto?.nombre ?? '',
            almacenId: ins.almacen?.id ?? '',
            almacenNombre: ins.almacen?.nombre ?? '',
            stockDisponible: 0,
            unidad: ins.producto?.unidad ?? '',
            descripcionLibre: ins.descripcionLibre ?? '',
            cantidad: String(ins.cantidad),
            precioUnitario: String(ins.precioUnitario),
            moneda: ins.moneda,
            tipoCambio: ins.tipoCambio!=null ? String(ins.tipoCambio) : '',
        }));
    });
    const [pendSel, setPendSel] = useState<string[]>(
        ()=>registroEditar?.pendientesResueltos?.map(p=>p.id)??[]
    );
    const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
    const { tipoCambio: tcGlobalNum } = useCompany();
    const tcGlobal = String(tcGlobalNum ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(()=>{
        fetchApi('/warehouse').then(setAlmacenes).catch(()=>{});
    },[]);

    const togglePend = (id:string)=>setPendSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

    const validar1 = ()=>{ if(!descripcion.trim()){ setError('La descripción es requerida.'); return false; } setError(''); return true; };
    const validar2 = ()=>{
        for(const l of lineas){
            if(l.origen==='ALMACEN'&&Number(l.cantidad)>l.stockDisponible){ setError(`Stock insuficiente para "${l.productoNombre}": disponible ${l.stockDisponible} ${l.unidad}, pedido ${l.cantidad}.`); return false; }
            if(l.origen==='ALMACEN'&&!l.almacenId&&almacenes.length>1){ setError('Selecciona almacén para cada insumo.'); return false; }
            if(l.origen==='COMPRA_DIRECTA'&&!l.descripcionLibre.trim()){ setError('Escribe la descripción de la compra directa.'); return false; }
            if(!l.cantidad||Number(l.cantidad)<=0){ setError('La cantidad debe ser mayor a 0.'); return false; }
            if(l.precioUnitario===''||Number(l.precioUnitario)<0){ setError('El precio unitario es requerido.'); return false; }
        }
        setError(''); return true;
    };

    const handleGuardar = async()=>{
        setSaving(true); setError('');
        try {
            const payload = {
                fecha, tipo, descripcion:descripcion.trim(),
                observaciones:observaciones.trim()||null,
                horometro:horometro?Number(horometro):null,
                usuarioId,
                insumos:lineas.map(l=>({
                    origen:l.origen,
                    productoId:     l.origen==='ALMACEN'?l.productoId:undefined,
                    almacenId:      l.origen==='ALMACEN'?l.almacenId:undefined,
                    descripcionLibre:l.origen==='COMPRA_DIRECTA'?l.descripcionLibre.trim():undefined,
                    cantidad:Number(l.cantidad), precioUnitario:Number(l.precioUnitario),
                    moneda:l.moneda, tipoCambio:l.tipoCambio?Number(l.tipoCambio):undefined,
                })),
                pendientesIds:pendSel,
            };
            if(editando && registroEditar?._esNuevo){
                await fetchApi(`/equipos/${equipoId}/mantenimientos/${registroEditar.id}`,{method:'PUT',body:JSON.stringify(payload)});
            } else {
                await fetchApi(`/equipos/${equipoId}/mantenimientos`,{method:'POST',body:JSON.stringify(payload)});
            }
            onSuccess(); onClose();
        } catch(e:any){ setError(e.message||'Error al guardar'); setSaving(false); }
    };

    const pasos = tipo==='MANTENIMIENTO' ? (
        <div className="flex items-center gap-1 text-xs text-gray-400 px-6 py-2 bg-gray-50 border-b border-gray-100">
            {[1,2,3].map(n=>(
                <span key={n} className="flex items-center gap-1">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${paso===n?'bg-blue-600 text-white':paso>n?'bg-green-500 text-white':'bg-gray-200 text-gray-500'}`}>{n}</span>
                    <span className={paso===n?'text-blue-600 font-semibold':'text-gray-400'}>{n===1?'General':n===2?'Insumos':'Pendientes'}</span>
                    {n<3&&<ChevronRight size={12} className="text-gray-300"/>}
                </span>
            ))}
        </div>
    ) : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">{editando?'Editar registro':'Nuevo registro de bitácora'}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Registra un evento o mantenimiento del equipo</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
                </div>
                {pasos}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {/* PASO 1 */}
                    {paso===1&&(<>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-2">Tipo de registro</label>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    {key:'MANTENIMIENTO',label:'Mantenimiento',desc:'Incluye insumos y costos',icon:<Wrench size={14}/>},
                                    {key:'EVENTO',label:'Evento',desc:'Traslado, nota, observación',icon:<ClipboardList size={14}/>},
                                ] as const).map(({key,label,desc,icon})=>(
                                    <button key={key} onClick={()=>setTipo(key)}
                                        className={`py-3 px-4 rounded-xl text-left border-2 transition-all ${tipo===key?'border-blue-500 bg-blue-50':'border-gray-200 hover:border-gray-300'}`}>
                                        <div className={`flex items-center gap-2 font-semibold text-sm mb-0.5 ${tipo===key?'text-blue-700':'text-gray-700'}`}>{icon}{label}</div>
                                        <p className="text-xs text-gray-400">{desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha *</label>
                                <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Horómetro (hrs)</label>
                                <input type="number" value={horometro} onChange={e=>setHorometro(e.target.value)} placeholder="Ej: 1450"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción *</label>
                            <textarea value={descripcion} onChange={e=>setDescripcion(e.target.value)} rows={2}
                                placeholder={tipo==='MANTENIMIENTO'?'Ej: Cambio de aceite de motor y filtros':'Ej: Traslado de obra MARVAZ a Taller Delgado'}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"/>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Observaciones</label>
                            <textarea value={observaciones} onChange={e=>setObservaciones(e.target.value)} rows={2}
                                placeholder="Notas adicionales..."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"/>
                        </div>
                    </>)}
                    {/* PASO 2 */}
                    {paso===2&&(
                        <InsumosPanel lineas={lineas} setLineas={setLineas} tipoCambioGlobal={tcGlobal} almacenes={almacenes}/>
                    )}
                    {/* PASO 3 */}
                    {paso===3&&(<>
                        <p className="text-xs font-semibold text-gray-600">Pendientes abiertos a resolver <span className="text-gray-400 font-normal">(opcional)</span></p>
                        {pendientesAbiertos.length===0 ? (
                            <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl">
                                <CheckCheck size={28} className="text-gray-200 mx-auto mb-2"/>
                                <p className="text-sm text-gray-400">No hay pendientes abiertos</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {pendientesAbiertos.map(p=>(
                                    <label key={p.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${pendSel.includes(p.id)?'border-green-400 bg-green-50':'border-gray-200 hover:border-gray-300'}`}>
                                        <input type="checkbox" checked={pendSel.includes(p.id)} onChange={()=>togglePend(p.id)} className="mt-0.5 accent-green-500"/>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{p.descripcion}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{fmtFecha(p.fecha)}{p.horometro!=null&&` · ${p.horometro} hrs`}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                        {pendSel.length>0&&(
                            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200 text-xs text-green-700">
                                <CheckCheck size={13}/>{pendSel.length} pendiente{pendSel.length!==1?'s':''} se marcarán como resueltos
                            </div>
                        )}
                    </>)}
                    {error&&<p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>
                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    {paso>1&&tipo==='MANTENIMIENTO'&&(
                        <button onClick={()=>{setError('');setPaso(p=>(p-1) as 1|2|3);}}
                            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Atrás</button>
                    )}
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                    {tipo==='EVENTO' ? (
                        <button onClick={()=>{if(validar1()) handleGuardar();}} disabled={saving}
                            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold">
                            {saving?'Guardando...':'Guardar evento'}
                        </button>
                    ) : paso===1 ? (
                        <button onClick={()=>{if(validar1()){setError('');setPaso(2);}}}
                            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Siguiente → Insumos</button>
                    ) : paso===2 ? (
                        <button onClick={()=>{if(validar2()){setError('');setPaso(3);}}}
                            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Siguiente → Pendientes</button>
                    ) : (
                        <button onClick={handleGuardar} disabled={saving}
                            className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold">
                            {saving?'Guardando...':'✓ Guardar mantenimiento'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
// ─── Modal: Editar registro LEGACY con insumos ────────────────────────────────
function EditLegacyModal({ registro, equipoId, pendientesAbiertos, onClose, onSuccess, usuarioId }:{
    registro:RegistroMant; equipoId:string; pendientesAbiertos:Pendiente[];
    onClose:()=>void; onSuccess:()=>void; usuarioId:string;
}) {
    const [paso, setPaso] = useState<1|2|3>(1);
    const [fecha, setFecha] = useState(registro.fecha.slice(0,10));
    const [descripcion, setDescripcion] = useState(registro.descripcion);
    const [observaciones, setObservaciones] = useState(registro.observaciones??'');
    const [horometro, setHorometro] = useState(registro.horometro!=null?String(registro.horometro):'');
    const [lineas, setLineas] = useState<LineaInsumo[]>([]);
    const [pendSel, setPendSel] = useState<string[]>([]);
    const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
    const { tipoCambio: tcGlobalNum } = useCompany();
    const tcGlobal = String(tcGlobalNum ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(()=>{
        fetchApi('/warehouse').then(setAlmacenes).catch(()=>{});
    },[]);

    const togglePend = (id:string)=>setPendSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
    const validar2 = ()=>{
        for(const l of lineas){
            if(l.origen==='ALMACEN'&&!l.almacenId){ setError('Selecciona almacén.'); return false; }
            if(l.origen==='COMPRA_DIRECTA'&&!l.descripcionLibre.trim()){ setError('Escribe descripción de la compra.'); return false; }
            if(!l.cantidad||Number(l.cantidad)<=0){ setError('Cantidad debe ser mayor a 0.'); return false; }
            if(l.precioUnitario===''||Number(l.precioUnitario)<0){ setError('Precio requerido.'); return false; }
        }
        setError(''); return true;
    };

    const handleGuardar = async()=>{
        if(!descripcion.trim()){ setError('La descripción es requerida.'); return; }
        if(!validar2()) return;
        setSaving(true); setError('');
        try {
            // Edita el registro legacy existente (solo campos generales)
            await fetchApi(`/equipos/${equipoId}/mantenimiento/${registro.id}`,{
                method:'PUT',
                body:JSON.stringify({
                    fecha,
                    descripcion:descripcion.trim(),
                    observaciones:observaciones.trim()||null,
                    horometro:horometro?Number(horometro):null,
                }),
            });
            // Si hay insumos nuevos, los agrega via POST al nuevo modelo
            if(lineas.length>0){
                await fetchApi(`/equipos/${equipoId}/mantenimientos`,{
                    method:'POST',
                    body:JSON.stringify({
                        fecha, tipo:'MANTENIMIENTO',
                        descripcion:descripcion.trim(),
                        observaciones:observaciones.trim()||null,
                        horometro:horometro?Number(horometro):null,
                        usuarioId,
                        insumos:lineas.map(l=>({
                            origen:l.origen,
                            productoId:     l.origen==='ALMACEN'?l.productoId:undefined,
                            almacenId:      l.origen==='ALMACEN'?l.almacenId:undefined,
                            descripcionLibre:l.origen==='COMPRA_DIRECTA'?l.descripcionLibre.trim():undefined,
                            cantidad:Number(l.cantidad), precioUnitario:Number(l.precioUnitario),
                            moneda:l.moneda, tipoCambio:l.tipoCambio?Number(l.tipoCambio):undefined,
                        })),
                        pendientesIds:pendSel,
                    }),
                });
            }
            onSuccess(); onClose();
        } catch(e:any){ setError(e.message||'Error al guardar'); setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Agregar insumos a registro histórico</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Se creará un nuevo registro vinculado con los insumos seleccionados</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
                </div>
                {/* Steps */}
                <div className="flex items-center gap-1 text-xs text-gray-400 px-6 py-2 bg-gray-50 border-b border-gray-100">
                    {[1,2,3].map(n=>(
                        <span key={n} className="flex items-center gap-1">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${paso===n?'bg-blue-600 text-white':paso>n?'bg-green-500 text-white':'bg-gray-200 text-gray-500'}`}>{n}</span>
                            <span className={paso===n?'text-blue-600 font-semibold':'text-gray-400'}>{n===1?'General':n===2?'Insumos':'Pendientes'}</span>
                            {n<3&&<ChevronRight size={12} className="text-gray-300"/>}
                        </span>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {paso===1&&(<>
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                            Datos del registro histórico. Puedes ajustar la descripción y fecha.
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha *</label>
                                <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Horómetro (hrs)</label>
                                <input type="number" value={horometro} onChange={e=>setHorometro(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción *</label>
                            <textarea value={descripcion} onChange={e=>setDescripcion(e.target.value)} rows={2}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"/>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Observaciones</label>
                            <textarea value={observaciones} onChange={e=>setObservaciones(e.target.value)} rows={2}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"/>
                        </div>
                    </>)}
                    {paso===2&&<InsumosPanel lineas={lineas} setLineas={setLineas} tipoCambioGlobal={tcGlobal} almacenes={almacenes}/>}
                    {paso===3&&(<>
                        <p className="text-xs font-semibold text-gray-600">Pendientes a resolver con este mantenimiento <span className="text-gray-400 font-normal">(opcional)</span></p>
                        {pendientesAbiertos.length===0 ? (
                            <div className="text-center py-4 border border-dashed border-gray-200 rounded-xl">
                                <p className="text-xs text-gray-400">No hay pendientes abiertos</p>
                            </div>
                        ) : pendientesAbiertos.map(p=>(
                            <label key={p.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${pendSel.includes(p.id)?'border-green-400 bg-green-50':'border-gray-200 hover:border-gray-300'}`}>
                                <input type="checkbox" checked={pendSel.includes(p.id)} onChange={()=>togglePend(p.id)} className="mt-0.5 accent-green-500"/>
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{p.descripcion}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{fmtFecha(p.fecha)}</p>
                                </div>
                            </label>
                        ))}
                    </>)}
                    {error&&<p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    {paso>1&&<button onClick={()=>{setError('');setPaso(p=>(p-1) as 1|2|3);}} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Atrás</button>}
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                    {paso===1&&<button onClick={()=>{if(!descripcion.trim()){setError('La descripción es requerida.');return;}setError('');setPaso(2);}} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Siguiente → Insumos</button>}
                    {paso===2&&<button onClick={()=>{if(validar2()){setError('');setPaso(3);}}} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Siguiente → Pendientes</button>}
                    {paso===3&&<button onClick={handleGuardar} disabled={saving} className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold">{saving?'Guardando...':'✓ Guardar con insumos'}</button>}
                </div>
            </div>
        </div>
    );
}
// ─── Modal: Nuevo pendiente ───────────────────────────────────────────────────
function NuevoPendienteModal({equipoId,onClose,onSuccess}:{equipoId:string;onClose:()=>void;onSuccess:()=>void}) {
    const [descripcion,setDescripcion]=useState('');
    const [observacion,setObservacion]=useState('');
    const [horometro,setHorometro]=useState('');
    const [fecha,setFecha]=useState(new Date().toISOString().slice(0,10));
    const [saving,setSaving]=useState(false);
    const [error,setError]=useState('');
    const handleGuardar=async()=>{
        if(descripcion.trim().length<3){setError('La descripción debe tener al menos 3 caracteres.');return;}
        setSaving(true);setError('');
        try{
            await fetchApi(`/equipos/${equipoId}/pendientes`,{method:'POST',body:JSON.stringify({
                descripcion:descripcion.trim(),observacion:observacion.trim()||null,
                horometro:horometro?Number(horometro):null,fecha,
            })});
            onSuccess();onClose();
        }catch(e:any){setError(e.message||'Error');}finally{setSaving(false);}
    };
    return(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">Nueva falla / pendiente</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción *</label>
                        <input value={descripcion} onChange={e=>setDescripcion(e.target.value)} placeholder="Ej: Fuga de aceite en compresor"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Observaciones</label>
                        <textarea value={observacion} onChange={e=>setObservacion(e.target.value)} rows={2}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"/></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha *</label>
                            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Horómetro (hrs)</label>
                            <input type="number" value={horometro} onChange={e=>setHorometro(e.target.value)} placeholder="Ej: 1200"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                    </div>
                    {error&&<p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleGuardar} disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold">
                        {saving?'Guardando...':'Registrar pendiente'}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Editar pendiente ──────────────────────────────────────────────────
function EditPendienteModal({pendiente,equipoId,onClose,onSuccess}:{pendiente:Pendiente;equipoId:string;onClose:()=>void;onSuccess:()=>void}) {
    const [descripcion,setDescripcion]=useState(pendiente.descripcion);
    const [observacion,setObservacion]=useState(pendiente.observacion??'');
    const [horometro,setHorometro]=useState(pendiente.horometro!=null?String(pendiente.horometro):'');
    const [fecha,setFecha]=useState(pendiente.fecha.slice(0,10));
    const [saving,setSaving]=useState(false);
    const [error,setError]=useState('');
    const handleGuardar=async()=>{
        if(descripcion.trim().length<3){setError('Mínimo 3 caracteres.');return;}
        setSaving(true);setError('');
        try{
            await fetchApi(`/equipos/${equipoId}/pendientes/${pendiente.id}`,{method:'PUT',body:JSON.stringify({
                descripcion:descripcion.trim(),observacion:observacion.trim()||null,
                horometro:horometro?Number(horometro):null,fecha,
            })});
            onSuccess();onClose();
        }catch(e:any){setError(e.message||'Error');}finally{setSaving(false);}
    };
    return(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">Editar pendiente</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción *</label>
                        <input value={descripcion} onChange={e=>setDescripcion(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Observaciones</label>
                        <textarea value={observacion} onChange={e=>setObservacion(e.target.value)} rows={2}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"/></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha</label>
                            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Horómetro</label>
                            <input type="number" value={horometro} onChange={e=>setHorometro(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                    </div>
                    {error&&<p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleGuardar} disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold">
                        {saving?'Guardando...':'Guardar cambios'}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Nuevo componente ──────────────────────────────────────────────────
function NuevoComponenteModal({equipoId,onClose,onSuccess}:{equipoId:string;onClose:()=>void;onSuccess:()=>void}) {
    const [nombre,setNombre]=useState('');const [serie,setSerie]=useState('');
    const [tipo,setTipo]=useState('');const [notas,setNotas]=useState('');
    const [instalar,setInstalar]=useState(true);
    const [fecha,setFecha]=useState(new Date().toISOString().slice(0,10));
    const [notasMov,setNotasMov]=useState('');
    const [saving,setSaving]=useState(false);const [error,setError]=useState('');
    const handleGuardar=async()=>{
        if(!nombre.trim()){setError('El nombre es requerido.');return;}
        if(instalar&&notasMov.trim().length<5){setError('Las notas de instalación deben tener al menos 5 caracteres.');return;}
        setSaving(true);setError('');
        try{
            await fetchApi('/componentes',{method:'POST',body:JSON.stringify({
                nombre:nombre.trim(),serie:serie.trim()||null,tipo:tipo.trim()||null,notas:notas.trim()||null,
                equipoActualId:instalar?equipoId:null,
                fechaMovimiento:instalar?fecha:undefined,notasMovimiento:instalar?notasMov.trim():undefined,
            })});
            onSuccess();onClose();
        }catch(e:any){setError(e.message||'Error');}finally{setSaving(false);}
    };
    return(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">Nuevo componente</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre *</label>
                            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej: Pistola VL140"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">N° de serie</label>
                            <input value={serie} onChange={e=>setSerie(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo</label>
                            <input value={tipo} onChange={e=>setTipo(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                    </div>
                    <hr className="border-gray-100"/>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <div onClick={()=>setInstalar(v=>!v)} className={`relative w-10 h-5 rounded-full cursor-pointer transition-colors ${instalar?'bg-blue-600':'bg-gray-200'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${instalar?'left-5':'left-0.5'}`}/>
                        </div>
                        <span className="text-sm font-medium text-gray-700">Instalar en este equipo ahora</span>
                    </label>
                    {instalar&&(
                        <div className="space-y-3 pl-3 border-l-2 border-blue-200">
                            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha de instalación</label>
                                <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                            <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Notas de instalación *</label>
                                <textarea value={notasMov} onChange={e=>setNotasMov(e.target.value)} rows={2}
                                    placeholder="Ej: Se instaló Pistola VL140 para reemplazar la anterior"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"/></div>
                        </div>
                    )}
                    {error&&<p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleGuardar} disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold">
                        {saving?'Guardando...':'Crear componente'}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Editar componente ─────────────────────────────────────────────────
function EditComponenteModal({componente,onClose,onSuccess}:{componente:Componente;onClose:()=>void;onSuccess:()=>void}) {
    const [nombre,setNombre]=useState(componente.nombre);
    const [serie,setSerie]=useState(componente.serie??'');
    const [tipo,setTipo]=useState(componente.tipo??'');
    const [notas,setNotas]=useState(componente.notas??'');
    const [saving,setSaving]=useState(false);const [error,setError]=useState('');
    const handleGuardar=async()=>{
        if(!nombre.trim()){setError('El nombre es requerido.');return;}
        setSaving(true);setError('');
        try{
            await fetchApi(`/componentes/${componente.id}`,{method:'PUT',body:JSON.stringify({nombre:nombre.trim(),serie:serie.trim()||null,tipo:tipo.trim()||null,notas:notas.trim()||null})});
            onSuccess();onClose();
        }catch(e:any){setError(e.message||'Error');}finally{setSaving(false);}
    };
    return(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">Editar componente</h2>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre *</label>
                            <input value={nombre} onChange={e=>setNombre(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">N° de serie</label>
                            <input value={serie} onChange={e=>setSerie(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo</label>
                            <input value={tipo} onChange={e=>setTipo(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                        <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1.5">Notas</label>
                            <input value={notas} onChange={e=>setNotas(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                    </div>
                    {error&&<p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleGuardar} disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold">
                        {saving?'Guardando...':'Guardar cambios'}</button>
                </div>
            </div>
        </div>
    );
}
// ─── Modal: Movimiento de componente ─────────────────────────────────────────
function MovimientoModal({componente,equipoActualId,onClose,onSuccess}:{
    componente:Componente;equipoActualId:string;onClose:()=>void;onSuccess:()=>void;
}) {
    const estaAqui=componente.equipoActualId===equipoActualId;
    const [tipo,setTipo]=useState(estaAqui?'RETIRO':'INSTALACION');
    const [fecha,setFecha]=useState(new Date().toISOString().slice(0,10));
    const [notas,setNotas]=useState('');
    const [saving,setSaving]=useState(false);const [error,setError]=useState('');
    const handleGuardar=async()=>{
        if(notas.trim().length<5){setError('Las notas deben tener al menos 5 caracteres.');return;}
        setSaving(true);setError('');
        try{
            const body:Record<string,unknown>={tipo,fecha,notas:notas.trim()};
            if(tipo==='INSTALACION'||tipo==='RETORNO_REPARACION') body.equipoId=equipoActualId;
            await fetchApi(`/componentes/${componente.id}/movimientos`,{method:'POST',body:JSON.stringify(body)});
            onSuccess();onClose();
        }catch(e:any){setError(e.message||'Error');}finally{setSaving(false);}
    };
    return(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Registrar movimiento</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{componente.nombre}{componente.serie?` · S/N ${componente.serie}`:''}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Tipo de movimiento</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(TIPO_MOV).map(([key,{label}])=>(
                                <button key={key} onClick={()=>setTipo(key)}
                                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-left ${tipo===key?'border-blue-500 bg-blue-50 text-blue-700':'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha</label>
                        <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Notas <span className="text-gray-400 font-normal">(obligatorio)</span></label>
                        <textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={3}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"/></div>
                    {(tipo==='INSTALACION'||tipo==='RETORNO_REPARACION')&&(
                        <div className="flex items-start gap-2 bg-blue-50 text-blue-700 rounded-lg px-3 py-2 text-xs">
                            <MapPin size={12} className="mt-0.5 flex-shrink-0"/>
                            <span>El componente quedará registrado en <strong>este equipo</strong>.</span>
                        </div>
                    )}
                    {(tipo==='RETIRO'||tipo==='ENVIO_REPARACION')&&(
                        <div className="flex items-start gap-2 bg-amber-50 text-amber-700 rounded-lg px-3 py-2 text-xs">
                            <AlertCircle size={12} className="mt-0.5 flex-shrink-0"/>
                            <span>El componente quedará en <strong>Taller / Almacén</strong>.</span>
                        </div>
                    )}
                    {error&&<p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleGuardar} disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold">
                        {saving?'Guardando...':'Guardar movimiento'}</button>
                </div>
            </div>
        </div>
    );
}

// ─── ComponenteCard ───────────────────────────────────────────────────────────
function ComponenteCard({comp,equipoId,onMovimiento,onEditar,onEliminar}:{
    comp:Componente;equipoId:string;
    onMovimiento:(c:Componente)=>void;onEditar:(c:Componente)=>void;onEliminar:(c:Componente)=>void;
}) {
    const [verH,setVerH]=useState(false);
    const estaAqui=comp.equipoActualId===equipoId;
    return(
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow transition-shadow flex flex-col">
            <div className="flex items-start justify-between p-4 pb-3">
                <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${estaAqui?'bg-green-50':'bg-amber-50'}`}>
                        <Package size={16} className={estaAqui?'text-green-600':'text-amber-500'}/>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-800 leading-tight">{comp.nombre}</p>
                        {comp.tipo&&<p className="text-xs text-gray-400 mt-0.5">{comp.tipo}</p>}
                        {comp.serie&&<p className="text-xs text-gray-500 mt-1 font-mono bg-gray-50 rounded px-1.5 py-0.5 inline-block">S/N {comp.serie}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${estaAqui?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                        {estaAqui?'Instalado':'En taller'}
                    </span>
                    <button onClick={()=>onEditar(comp)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Pencil size={13}/></button>
                    <button onClick={()=>onEliminar(comp)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={13}/></button>
                </div>
            </div>
            {comp.notas&&<div className="px-4 pb-3"><p className="text-xs text-gray-500 italic">{comp.notas}</p></div>}
            {comp.historial.length>0&&(
                <div className="px-4 pb-3">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-400 mb-1">Último movimiento</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${TIPO_MOV[comp.historial[0].tipo]?.pill??'bg-gray-100 text-gray-600'}`}>
                                {TIPO_MOV[comp.historial[0].tipo]?.label??comp.historial[0].tipo}
                            </span>
                            <span className="text-xs text-gray-500">{fmtFecha(comp.historial[0].fecha)}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-1">{comp.historial[0].notas}</p>
                    </div>
                </div>
            )}
            {comp.historial.length>1&&(
                <div className="px-4 pb-3">
                    <button onClick={()=>setVerH(v=>!v)} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium">
                        <History size={11}/>{verH?'Ocultar historial':`Ver historial (${comp.historial.length} mov.)`}
                        {verH?<ChevronUp size={11}/>:<ChevronDown size={11}/>}
                    </button>
                    {verH&&(
                        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                            {comp.historial.slice(1).map(mov=>(
                                <div key={mov.id} className="flex items-start gap-2 border-l-2 border-gray-100 pl-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${TIPO_MOV[mov.tipo]?.pill??'bg-gray-100 text-gray-600'}`}>
                                                {TIPO_MOV[mov.tipo]?.label??mov.tipo}
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
                <button onClick={()=>onMovimiento(comp)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-100 hover:border-blue-200 transition-colors">
                    <ArrowRightLeft size={12}/> Registrar movimiento
                </button>
            </div>
        </div>
    );
}

// ─── BitacoraCard (componente separado para evitar Hook ilegal en .map()) ─────
function BitacoraCard({ entry, onEditNuevo, onEditLegacy, onDeleteNuevo, onDeleteLegacy }: {
    entry: RegistroMant;
    onEditNuevo: (e: RegistroMant) => void;
    onEditLegacy: (e: RegistroMant) => void;
    onDeleteNuevo: (e: RegistroMant) => void;
    onDeleteLegacy: (e: RegistroMant) => void;
}) {
    const [expandido, setExpandido] = useState(false);
    const esNuevo = !!entry._esNuevo;
    const chipClass = esNuevo
        ? (entry.tipoBitacora === 'MANTENIMIENTO' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')
        : (TIPO_LEGACY[entry.tipo ?? '']?.pill ?? 'bg-gray-100 text-gray-600');
    const chipLabel = esNuevo
        ? (entry.tipoBitacora === 'MANTENIMIENTO' ? 'Mantenimiento' : 'Evento')
        : (TIPO_LEGACY[entry.tipo ?? '']?.label ?? entry.tipo ?? '—');
    const costoInsumos = esNuevo && entry.insumos
        ? entry.insumos.reduce((acc, ins) => {
            const tc = ins.tipoCambio ?? 1;
            return acc + (ins.moneda === 'USD' ? ins.cantidad * ins.precioUnitario * tc : ins.cantidad * ins.precioUnitario);
        }, 0) : null;

    return (
        <div key={entry.id} className={`bg-white border rounded-xl overflow-hidden ${esNuevo ? 'border-blue-100' : 'border-gray-100'}`}>
            <div className="flex items-start gap-3 p-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${esNuevo && entry.tipoBitacora === 'MANTENIMIENTO' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    {esNuevo && entry.tipoBitacora === 'MANTENIMIENTO' ? <Wrench size={15} className="text-blue-500" /> : <ClipboardList size={15} className="text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${chipClass}`}>{chipLabel}</span>
                        {!esNuevo && <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">Histórico</span>}
                        <span className="text-xs text-gray-400">{fmtFecha(entry.fecha)}</span>
                        {entry.horometro != null && <span className="text-xs text-gray-400 flex items-center gap-1"><Gauge size={10} />{entry.horometro} hrs</span>}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-1">{entry.descripcion}</p>
                    {entry.observaciones && <p className="text-xs text-gray-500 mt-0.5">{entry.observaciones}</p>}
                    {!esNuevo && entry.numeroParte && <p className="text-xs text-gray-400 font-mono mt-0.5">P/N: {entry.numeroParte}</p>}
                    {!esNuevo && entry.costo != null && entry.costo > 0 && (
                        <p className="text-xs font-semibold text-gray-700 mt-1">{entry.moneda === 'USD' ? 'US$' : '$'}{Number(entry.costo).toLocaleString('es-MX', { maximumFractionDigits: 2 })}</p>
                    )}
                    {esNuevo && entry.insumos && ((entry.insumos.length > 0) || (entry.pendientesResueltos?.length ?? 0) > 0) && (
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {(entry.insumos?.length ?? 0) > 0 && (
                                <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                    <Package size={10} />{entry.insumos!.length} insumo{entry.insumos!.length !== 1 ? 's' : ''}
                                    {costoInsumos != null && costoInsumos > 0 && ` · ${fmtMXN(costoInsumos)}`}
                                </span>
                            )}
                            {(entry.pendientesResueltos?.length ?? 0) > 0 && (
                                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                    <CheckCheck size={10} />{entry.pendientesResueltos!.length} pendiente{entry.pendientesResueltos!.length !== 1 ? 's' : ''} resuelto{entry.pendientesResueltos!.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {esNuevo && ((entry.insumos?.length ?? 0) > 0 || (entry.pendientesResueltos?.length ?? 0) > 0) && (
                        <button onClick={() => setExpandido(v => !v)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md">
                            {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                    <button onClick={() => esNuevo ? onEditNuevo(entry) : onEditLegacy(entry)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"><Pencil size={13} /></button>
                    <button onClick={() => esNuevo ? onDeleteNuevo(entry) : onDeleteLegacy(entry)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"><Trash2 size={13} /></button>
                </div>
            </div>
            {esNuevo && expandido && (
                <div className="border-t border-blue-50 bg-blue-50/30 px-4 py-3 space-y-3">
                    {(entry.insumos?.length ?? 0) > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">Insumos utilizados</p>
                            <div className="space-y-1">
                                {entry.insumos!.map(ins => (
                                    <div key={ins.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-blue-100">
                                        <div className="flex items-center gap-2">
                                            {ins.origen === 'ALMACEN' ? <Warehouse size={11} className="text-blue-400" /> : <ShoppingCart size={11} className="text-orange-400" />}
                                            <span className="font-medium text-gray-700">{ins.origen === 'ALMACEN' ? ins.producto?.nombre : ins.descripcionLibre}</span>
                                            {ins.origen === 'ALMACEN' && ins.almacen && <span className="text-gray-400">· {ins.almacen.nombre}</span>}
                                        </div>
                                        <span className="font-semibold text-gray-700">{ins.cantidad} {ins.producto?.unidad ?? ''} × {ins.moneda === 'USD' ? 'US$' : '$'}{ins.precioUnitario}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {(entry.pendientesResueltos?.length ?? 0) > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">Pendientes resueltos</p>
                            <div className="space-y-1">
                                {entry.pendientesResueltos!.map(p => (
                                    <div key={p.id} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-2 border border-green-100">
                                        <CheckCheck size={11} className="text-green-500 flex-shrink-0" />
                                        <span className="text-gray-700">{p.descripcion}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── RegistroRow ──────────────────────────────────────────────────────────────
function RegistroRow({r,onDelete}:{r:Registro;onDelete:(id:string)=>void}) {
    const [exp,setExp]=useState(false);
    const fecha=new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
    return(<>
        <tr className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={()=>setExp(v=>!v)}>
            <td className="p-3"><div><p className="text-sm font-semibold text-gray-700">{fecha}</p>{r.semanaNum&&<p className="text-xs text-gray-400">Sem. {r.semanaNum} / {r.anoNum}</p>}</div></td>
            <td className="p-3 text-sm text-gray-500">{r.obraNombre||'—'}</td>
            <td className="p-3 text-right font-bold text-gray-700">{r.horasTrabajadas} <span className="text-xs font-normal text-gray-400">hrs</span></td>
            <td className="p-3 text-right text-gray-700">{r.barrenos}</td>
            <td className="p-3 text-right text-gray-700">{Number(r.metrosLineales).toFixed(1)} <span className="text-xs text-gray-400">m</span></td>
            <td className="p-3 text-right text-blue-600 font-semibold">{r.litrosDiesel} <span className="text-xs font-normal text-gray-400">lt</span></td>
            <td className="p-3 text-right text-gray-700">${Number(r.costoDiesel).toLocaleString('es-MX',{maximumFractionDigits:0})}</td>
            <td className="p-3 text-right">
                <div className="flex justify-end items-center gap-1">
                    <button onClick={e=>{e.stopPropagation();onDelete(r.id);}}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={13}/></button>
                    {exp?<ChevronUp size={14} className="text-gray-400"/>:<ChevronDown size={14} className="text-gray-400"/>}
                </div>
            </td>
        </tr>
        {exp&&(
            <tr className="bg-blue-50/20"><td colSpan={8} className="px-6 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div><p className="text-xs text-gray-400 mb-1">Personal</p><p className="font-semibold text-gray-700">{r.operadores} op. / {r.peones} peón{r.peones!==1?'es':''}</p></div>
                    <div><p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Gauge size={11}/>KPIs</p>
                        <p className="text-xs text-gray-600">Lt/hr: <span className="font-bold">{r.kpi.litrosPorHora??'N/A'}</span></p>
                        <p className="text-xs text-gray-600">Lt/mt: <span className="font-bold">{r.kpi.litrosPorMetro??'N/A'}</span></p>
                        <p className="text-xs text-gray-600">Mt/hr: <span className="font-bold">{r.kpi.metrosPorHora??'N/A'}</span></p>
                    </div>
                    <div><p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Droplets size={11}/>Diésel</p>
                        <p className="text-xs text-gray-600">{r.litrosDiesel} lt × ${r.precioDiesel}/lt</p>
                        <p className="text-xs font-bold text-gray-700">= ${Number(r.costoDiesel).toLocaleString('es-MX',{maximumFractionDigits:0})}</p>
                    </div>
                    <div><p className="text-xs text-gray-400 mb-1">Registrado por</p><p className="font-semibold text-gray-700">{r.usuario?.nombre}</p></div>
                </div>
            </td></tr>
        )}
    </>);
}
// ─── Página principal ─────────────────────────────────────────────────────────
export default function EquipoDetallePage() {
    const params=useParams();
    const router=useRouter();
    const rawId=params?.id;
    const id:string|undefined=typeof rawId==='string'&&rawId.trim()!==''?rawId:undefined;

    const [equipo,       setEquipo]       = useState<Equipo|null>(null);
    const [registros,    setRegistros]    = useState<Registro[]>([]);
    const [componentes,  setComponentes]  = useState<Componente[]>([]);
    const [mantLegacy,   setMantLegacy]   = useState<RegistroMant[]>([]);
    const [mantNuevos,   setMantNuevos]   = useState<RegistroMant[]>([]);
    const [pendientes,   setPendientes]   = useState<Pendiente[]>([]);
    const [insumosData,  setInsumosData]  = useState<InsumoConsumoResponse|null>(null);
    const [loadingInsumos,setLoadingInsumos]=useState(false);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState('');
    const [usuarioId,    setUsuarioId]    = useState('');
    const [tab,          setTab]          = useState<Tab>('registros');

    // Modales
    const [modalMov,           setModalMov]           = useState<Componente|null>(null);
    const [modalNuevoComp,     setModalNuevoComp]     = useState(false);
    const [modalNuevaBitacora, setModalNuevaBitacora] = useState(false);
    const [modalEditNuevo,     setModalEditNuevo]     = useState<RegistroMant|null>(null);
    const [modalEditLegacy,    setModalEditLegacy]    = useState<RegistroMant|null>(null);
    const [modalNuevoPend,     setModalNuevoPend]     = useState(false);
    const [modalEditPend,      setModalEditPend]      = useState<Pendiente|null>(null);
    const [modalEditComp,      setModalEditComp]      = useState<Componente|null>(null);
    const [confirmDelete,      setConfirmDelete]      = useState<{
        mensaje:string;titulo?:string;confirmLabel?:string;confirmClass?:string;onConfirm:()=>void;
    }|null>(null);

    // Filtros
    const [filtroSemana,    setFiltroSemana]    = useState('todas');
    const [filtroDesde,     setFiltroDesde]     = useState('');
    const [filtroHasta,     setFiltroHasta]     = useState('');
    const [filtroPend,      setFiltroPend]      = useState<'abiertos'|'resueltos'|'todos'>('abiertos');
    const [mantSearch,      setMantSearch]      = useState('');
    const [mantFiltroFecha, setMantFiltroFecha] = useState('todos');
    const [mantDesde,       setMantDesde]       = useState('');
    const [mantHasta,       setMantHasta]       = useState('');

    useEffect(()=>{
        try{
            const token=localStorage.getItem('token')??'';
            if(token){ const p=JSON.parse(atob(token.split('.')[1])); setUsuarioId(p.id??''); }
        }catch{}
    },[]);

    const loadComponentes=useCallback(async()=>{
        if(!id) return;
        try{ setComponentes(await fetchApi(`/componentes?equipoId=${id}`)); }catch{}
    },[id]);

    const loadMantNuevos=useCallback(async()=>{
        if(!id) return;
        try{
            const data=await fetchApi(`/equipos/${id}/mantenimientos`);
            setMantNuevos(data.map((m:any)=>({...m,_esNuevo:true,tipoBitacora:m.tipo})));
        }catch{}
    },[id]);

    const loadPendientes=useCallback(async()=>{
        if(!id) return;
        try{ setPendientes(await fetchApi(`/equipos/${id}/pendientes?resuelto=all`)); }catch{}
    },[id]);

    const loadInsumosConsumos=useCallback(async()=>{
        if(!id) return;
        setLoadingInsumos(true);
        try{ setInsumosData(await fetchApi(`/equipos/${id}/insumos-consumidos`)); }catch{}
        finally{ setLoadingInsumos(false); }
    },[id]);

    const load=useCallback(async()=>{
        if(!id) return;
        setLoading(true);setError('');
        try{
            const [eq,regs,comps,legacy,nuevos,pend]=await Promise.all([
                fetchApi(`/equipos/${id}`),
                fetchApi(`/registros-diarios?equipoId=${id}`),
                fetchApi(`/componentes?equipoId=${id}`),
                fetchApi(`/equipos/${id}/mantenimiento`),
                fetchApi(`/equipos/${id}/mantenimientos`).catch(()=>[]),
                fetchApi(`/equipos/${id}/pendientes?resuelto=all`),
            ]);
            if(eq.error) throw new Error(eq.error);
            setEquipo(eq);setRegistros(regs);setComponentes(comps);
            setMantLegacy(legacy);
            setMantNuevos((nuevos as any[]).map(m=>({...m,_esNuevo:true,tipoBitacora:m.tipo})));
            setPendientes(pend);
        }catch(e:any){ setError(e.message||'Error al cargar'); }
        finally{ setLoading(false); }
    },[id]);

    useEffect(()=>{ if(!id) return; load(); },[load,id]);
    useEffect(()=>{
        if(tab==='inventario'&&!insumosData&&!loadingInsumos) loadInsumosConsumos();
    },[tab,insumosData,loadingInsumos,loadInsumosConsumos]);

    const handleDeleteRegistro=async(regId:string)=>{
        if(!confirm('¿Eliminar este registro?')) return;
        try{ await fetchApi(`/registros-diarios/${regId}`,{method:'DELETE'}); setRegistros(r=>r.filter(x=>x.id!==regId)); }
        catch(e:any){ alert(e.message||'Error'); }
    };

    const handleDeleteMantLegacy=(reg:RegistroMant)=>{
        setConfirmDelete({
            mensaje:`Se eliminará: "${reg.descripcion.slice(0,80)}"`,
            onConfirm:async()=>{
                setConfirmDelete(null);
                try{ await fetchApi(`/equipos/${id}/mantenimiento/${reg.id}`,{method:'DELETE'}); setMantLegacy(m=>m.filter(x=>x.id!==reg.id)); }
                catch(e:any){ alert(e.message||'Error'); }
            },
        });
    };

    const handleDeleteMantNuevo=(reg:RegistroMant)=>{
        setConfirmDelete({
            mensaje:`Se eliminará y se revertirá el kardex: "${reg.descripcion.slice(0,80)}"`,
            titulo:'¿Eliminar mantenimiento?',
            onConfirm:async()=>{
                setConfirmDelete(null);
                try{
                    await fetchApi(`/equipos/${id}/mantenimientos/${reg.id}`,{method:'DELETE'});
                    setMantNuevos(m=>m.filter(x=>x.id!==reg.id));
                    loadPendientes(); setInsumosData(null);
                }catch(e:any){ alert(e.message||'Error'); }
            },
        });
    };

    const handleResolverPendiente=(pend:Pendiente)=>{
        setConfirmDelete({
            mensaje:`"${pend.descripcion.slice(0,80)}"`,
            titulo:'¿Marcar como resuelto?',
            confirmLabel:'Sí, marcar resuelto',
            confirmClass:'bg-green-600 hover:bg-green-700',
            onConfirm:async()=>{
                setConfirmDelete(null);
                try{
                    await fetchApi(`/equipos/${id}/pendientes/${pend.id}`,{method:'PUT',body:JSON.stringify({resuelto:true,fechaResuelto:new Date().toISOString().slice(0,10)})});
                    loadPendientes();
                }catch(e:any){ alert(e.message||'Error'); }
            },
        });
    };

    const handleDeletePendiente=(pendId:string,desc:string)=>{
        setConfirmDelete({
            mensaje:`"${desc.slice(0,80)}"`,
            onConfirm:async()=>{
                setConfirmDelete(null);
                try{ await fetchApi(`/equipos/${id}/pendientes/${pendId}`,{method:'DELETE'}); setPendientes(p=>p.filter(x=>x.id!==pendId)); }
                catch(e:any){ alert(e.message||'Error'); }
            },
        });
    };

    const handleDeleteComponente=(comp:Componente)=>{
        setConfirmDelete({
            mensaje:`"${comp.nombre}"${comp.serie?` (S/N ${comp.serie})`:''}`,
            onConfirm:async()=>{
                setConfirmDelete(null);
                try{ await fetchApi(`/componentes/${comp.id}`,{method:'DELETE'}); loadComponentes(); }
                catch(e:any){ alert(e.message||'Error'); }
            },
        });
    };

    // Bitácora unificada ordenada por fecha desc
    const bitacoraUnificada=[...mantLegacy,...mantNuevos]
        .sort((a,b)=>b.fecha>a.fecha?1:b.fecha<a.fecha?-1:0);

    const bitacoraFiltrada=bitacoraUnificada.filter(m=>{
        if(mantSearch.trim()){
            const q=mantSearch.toLowerCase();
            if(!m.descripcion.toLowerCase().includes(q)&&!(m.observaciones??'').toLowerCase().includes(q)&&!(m.numeroParte??'').toLowerCase().includes(q)) return false;
        }
        const hoy=new Date();
        const fm=new Date(m.fecha.slice(0,10)+'T12:00:00');
        if(mantFiltroFecha==='3m'){const d=new Date(hoy);d.setMonth(d.getMonth()-3);if(fm<d)return false;}
        else if(mantFiltroFecha==='6m'){const d=new Date(hoy);d.setMonth(d.getMonth()-6);if(fm<d)return false;}
        else if(mantFiltroFecha==='1a'){const d=new Date(hoy);d.setFullYear(d.getFullYear()-1);if(fm<d)return false;}
        else if(mantFiltroFecha==='2a'){const d=new Date(hoy);d.setFullYear(d.getFullYear()-2);if(fm<d)return false;}
        else if(mantFiltroFecha==='personalizado'){
            if(mantDesde&&m.fecha.slice(0,10)<mantDesde)return false;
            if(mantHasta&&m.fecha.slice(0,10)>mantHasta)return false;
        }
        return true;
    });

    const semanas=Array.from(new Set(registros.filter(r=>r.semanaNum).map(r=>`${r.anoNum}-${String(r.semanaNum).padStart(2,'0')}`))).sort().reverse();
    const filtrados=registros.filter(r=>{
        if(filtroSemana!=='todas'&&`${r.anoNum}-${String(r.semanaNum).padStart(2,'0')}`!==filtroSemana)return false;
        if(filtroDesde&&r.fecha.slice(0,10)<filtroDesde)return false;
        if(filtroHasta&&r.fecha.slice(0,10)>filtroHasta)return false;
        return true;
    });
    const totalHoras=filtrados.reduce((a,r)=>a+Number(r.horasTrabajadas),0);
    const totalMetros=filtrados.reduce((a,r)=>a+Number(r.metrosLineales),0);
    const totalLitros=filtrados.reduce((a,r)=>a+Number(r.litrosDiesel),0);
    const totalCosto=filtrados.reduce((a,r)=>a+Number(r.costoDiesel),0);
    const pendientesFiltrados=pendientes.filter(p=>filtroPend==='abiertos'?!p.resuelto:filtroPend==='resueltos'?p.resuelto:true);
    const pendientesAbiertos=pendientes.filter(p=>!p.resuelto);

    if(!id||loading) return <div className="p-10 text-center text-gray-400">Cargando...</div>;
    if(error)        return <div className="p-10 text-center text-red-500">{error}</div>;
    if(!equipo)      return <div className="p-10 text-center text-gray-400">Equipo no encontrado</div>;

    const tabs:[Tab,string,React.ReactNode,number|undefined][]=[
        ['registros',     'Registros diarios', <ClipboardList size={14}/>, undefined],
        ['mantenimiento', 'Bitácora',           <Settings2 size={14}/>,    bitacoraUnificada.length||undefined],
        ['pendientes',    'Pendientes',          <AlertTriangle size={14}/>,pendientesAbiertos.length||undefined],
        ['inventario',    'Inventario',          <BoxesIcon size={14}/>,    insumosData?.items.length],
        ['componentes',   'Componentes',         <Package size={14}/>,      componentes.length||undefined],
    ];

    return(
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={()=>router.back()} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft size={20}/></button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Wrench size={20} className="text-blue-600"/></div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{equipo.nombre}</h1>
                            <p className="text-sm text-gray-400">
                                {equipo.numeroEconomico&&<span className="mr-2">N° {equipo.numeroEconomico}</span>}
                                {equipo.modelo&&<span className="mr-2">· {equipo.modelo}</span>}
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${equipo.activo?'text-green-600':'text-gray-400'}`}>
                                    {equipo.activo?<CheckCircle size={11}/>:<XCircle size={11}/>}{equipo.activo?'Activo':'Inactivo'}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
                <Link href={`/dashboard/registros-diarios/new?equipoId=${id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm">
                    <Plus size={16}/> Nuevo Registro
                </Link>
            </div>

            {/* Fichas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Horómetro actual</p><p className="text-xl font-bold text-gray-800">{equipo.hodometroInicial.toLocaleString('es-MX')} <span className="text-sm font-normal text-gray-400">hrs</span></p></div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Total registros</p><p className="text-xl font-bold text-gray-800">{equipo._count.registrosDiarios}</p></div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Número de serie</p><p className="text-sm font-semibold text-gray-700">{equipo.numeroSerie||'—'}</p></div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">{equipo.apodo?'Apodo':'Notas'}</p><p className="text-xs text-gray-600 line-clamp-2">{equipo.apodo||equipo.notas||'—'}</p></div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
                {tabs.map(([key,label,icon,badge])=>(
                    <button key={key} onClick={()=>setTab(key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab===key?'bg-white text-blue-700 shadow-sm':'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}>
                        {icon}{label}
                        {badge!==undefined&&badge>0&&(
                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${key==='pendientes'?'bg-orange-100 text-orange-600':'bg-blue-100 text-blue-600'}`}>{badge}</span>
                        )}
                    </button>
                ))}
            </div>
            {/* ══ TAB: REGISTROS ══ */}
            {tab==='registros'&&(
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <Calendar size={15} className="text-blue-500 flex-shrink-0"/>
                        <span className="text-sm font-semibold text-gray-600">Filtrar:</span>
                        <select value={filtroSemana} onChange={e=>{setFiltroSemana(e.target.value);setFiltroDesde('');setFiltroHasta('');}}
                            className="py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none">
                            <option value="todas">Todas las semanas</option>
                            {semanas.map(s=>{const[ano,sem]=s.split('-');return<option key={s} value={s}>Semana {parseInt(sem)} / {ano}</option>;})}
                        </select>
                        <span className="text-xs text-gray-400">ó rango:</span>
                        <div className="flex items-center gap-2">
                            <input type="date" value={filtroDesde} onChange={e=>{setFiltroDesde(e.target.value);setFiltroSemana('todas');}}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white"/>
                            <span className="text-xs text-gray-400">→</span>
                            <input type="date" value={filtroHasta} onChange={e=>{setFiltroHasta(e.target.value);setFiltroSemana('todas');}}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white"/>
                        </div>
                        {(filtroSemana!=='todas'||filtroDesde||filtroHasta)&&(
                            <button onClick={()=>{setFiltroSemana('todas');setFiltroDesde('');setFiltroHasta('');}} className="text-xs text-red-400 hover:text-red-600 hover:underline">Limpiar</button>
                        )}
                    </div>
                    {filtrados.length>0&&(
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                            {[
                                {label:'Registros',val:filtrados.length,unit:''},
                                {label:'Horas',val:totalHoras.toFixed(1),unit:'hrs'},
                                {label:'Metros',val:totalMetros.toFixed(1),unit:'m'},
                                {label:'Diésel',val:totalLitros.toLocaleString(),unit:'lt'},
                                {label:'Lt/hr prom.',val:totalHoras>0?(totalLitros/totalHoras).toFixed(2):'—',unit:''},
                                {label:'Costo diésel',val:`$${totalCosto.toLocaleString('es-MX',{maximumFractionDigits:0})}`,unit:''},
                            ].map(k=>(
                                <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                                    <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                                    <p className="text-lg font-bold text-gray-800">{k.val} <span className="text-xs font-normal text-gray-400">{k.unit}</span></p>
                                </div>
                            ))}
                        </div>
                    )}
                    <Card>
                        {filtrados.length===0?(
                            <div className="p-10 text-center"><p className="text-sm text-gray-500">Sin registros para el filtro seleccionado</p></div>
                        ):(
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead><tr className="bg-gray-50/50 border-b border-gray-100">
                                        {['Fecha','Obra','Horas','Barrenos','Metros','Diésel','Costo',''].map((h,i)=>(
                                            <th key={i} className={`p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider${i>=2&&i<=6?' text-right':''}`}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filtrados.map(r=><RegistroRow key={r.id} r={r} onDelete={handleDeleteRegistro}/>)}
                                    </tbody>
                                </table>
                                <div className="p-4 border-t border-gray-100 text-xs text-gray-400">
                                    {filtrados.length} registro{filtrados.length!==1?'s':''}
                                    {filtrados.length!==registros.length&&` (de ${registros.length} totales)`}
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* ══ TAB: BITÁCORA ══ */}
            {tab==='mantenimiento'&&(
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2"><Settings2 size={16} className="text-blue-500"/>Bitácora del equipo</h2>
                            <p className="text-xs text-gray-400 mt-0.5">Eventos, mantenimientos e historial completo</p>
                        </div>
                        <button onClick={()=>setModalNuevaBitacora(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm">
                            <Plus size={13}/> Nuevo registro
                        </button>
                    </div>
                    {/* Filtros */}
                    {bitacoraUnificada.length>0&&(
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                <input value={mantSearch} onChange={e=>setMantSearch(e.target.value)} placeholder="Buscar en la bitácora..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"/>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-gray-400 font-medium">Período:</span>
                                {[{k:'todos',l:'Todo el historial'},{k:'3m',l:'Últimos 3 meses'},{k:'6m',l:'Últimos 6 meses'},{k:'1a',l:'Último año'},{k:'2a',l:'Últimos 2 años'},{k:'personalizado',l:'Personalizado'}].map(({k,l})=>(
                                    <button key={k} onClick={()=>setMantFiltroFecha(k)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${mantFiltroFecha===k?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>{l}</button>
                                ))}
                            </div>
                            {mantFiltroFecha==='personalizado'&&(
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-gray-400">Desde:</span>
                                    <input type="date" value={mantDesde} onChange={e=>setMantDesde(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"/>
                                    <span className="text-xs text-gray-400">→ Hasta:</span>
                                    <input type="date" value={mantHasta} onChange={e=>setMantHasta(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"/>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Lista */}
                    {bitacoraUnificada.length===0?(
                        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                            <Settings2 size={32} className="text-gray-200 mx-auto mb-3"/>
                            <p className="text-sm font-medium text-gray-500">Sin registros en la bitácora</p>
                            <button onClick={()=>setModalNuevaBitacora(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">
                                <Plus size={13}/> Agregar primer registro
                            </button>
                        </div>
                    ):(
                        <div className="space-y-2">
                            {bitacoraFiltrada.map(entry => (
                                <BitacoraCard
                                    key={entry.id}
                                    entry={entry}
                                    onEditNuevo={setModalEditNuevo}
                                    onEditLegacy={setModalEditLegacy}
                                    onDeleteNuevo={handleDeleteMantNuevo}
                                    onDeleteLegacy={handleDeleteMantLegacy}
                                />
                            ))}
                            <p className="text-xs text-gray-400 text-center pt-1">
                                {bitacoraFiltrada.length} registro{bitacoraFiltrada.length!==1?'s':''}
                                {bitacoraFiltrada.length!==bitacoraUnificada.length&&` (de ${bitacoraUnificada.length} totales)`}
                            </p>
                        </div>
                    )}
                </div>
            )}
            {/* ══ TAB: PENDIENTES ══ */}
            {tab==='pendientes'&&(
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-orange-500"/>Pendientes y fallas
                                {pendientesAbiertos.length>0&&<span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">{pendientesAbiertos.length} abierto{pendientesAbiertos.length!==1?'s':''}</span>}
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">Fallas y tareas pendientes de atender</p>
                        </div>
                        <button onClick={()=>setModalNuevoPend(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg shadow-sm">
                            <Plus size={13}/> Nueva falla
                        </button>
                    </div>
                    <div className="flex gap-2">
                        {(['abiertos','resueltos','todos'] as const).map(f=>(
                            <button key={f} onClick={()=>setFiltroPend(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filtroPend===f?'bg-gray-800 text-white border-gray-800':'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                                {f==='abiertos'?'Abiertos':f==='resueltos'?'Resueltos':'Todos'}
                            </button>
                        ))}
                    </div>
                    {pendientesFiltrados.length===0?(
                        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                            <CheckCheck size={32} className="text-gray-200 mx-auto mb-3"/>
                            <p className="text-sm font-medium text-gray-500">{filtroPend==='abiertos'?'¡Sin pendientes abiertos! Todo en orden.':'Sin registros para mostrar'}</p>
                        </div>
                    ):(
                        <div className="space-y-2">
                            {pendientesFiltrados.map(p=>(
                                <div key={p.id} className={`bg-white border rounded-xl p-4 flex items-start gap-4 ${p.resuelto?'border-gray-100 opacity-75':'border-orange-100'}`}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${p.resuelto?'bg-green-50':'bg-orange-50'}`}>
                                        {p.resuelto?<CheckCircle size={16} className="text-green-500"/>:<AlertTriangle size={16} className="text-orange-500"/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-sm font-semibold ${p.resuelto?'line-through text-gray-400':'text-gray-800'}`}>{p.descripcion}</p>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${p.resuelto?'bg-green-100 text-green-600':'bg-orange-100 text-orange-600'}`}>
                                                {p.resuelto?'Resuelto':'Abierto'}
                                            </span>
                                        </div>
                                        {p.observacion&&<p className="text-xs text-gray-500 mt-1">{p.observacion}</p>}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                                            <span className="flex items-center gap-1"><Calendar size={10}/>{fmtFecha(p.fecha)}</span>
                                            {p.horometro!=null&&<span className="flex items-center gap-1"><Gauge size={10}/>{p.horometro} hrs</span>}
                                            {p.resuelto&&p.fechaResuelto&&<span className="flex items-center gap-1 text-green-500"><CheckCircle size={10}/>Resuelto: {fmtFecha(p.fechaResuelto)}</span>}
                                            {p.mantenimientoId&&<span className="flex items-center gap-1 text-blue-400"><Wrench size={10}/>Vinculado a mantenimiento</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {!p.resuelto&&(
                                            <button onClick={()=>handleResolverPendiente(p)} title="Marcar resuelto"
                                                className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-md"><CheckCheck size={15}/></button>
                                        )}
                                        <button onClick={()=>setModalEditPend(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"><Pencil size={13}/></button>
                                        <button onClick={()=>handleDeletePendiente(p.id,p.descripcion)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"><Trash2 size={13}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══ TAB: INVENTARIO ══ */}
            {tab==='inventario'&&(
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2"><BoxesIcon size={16} className="text-blue-500"/>Insumos consumidos</h2>
                            <p className="text-xs text-gray-400 mt-0.5">Historial de materiales utilizados en mantenimientos</p>
                        </div>
                        <button onClick={loadInsumosConsumos} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">↻ Actualizar</button>
                    </div>
                    {loadingInsumos?(
                        <div className="p-10 text-center text-gray-400 text-sm">Cargando insumos...</div>
                    ):!insumosData||insumosData.items.length===0?(
                        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                            <BoxesIcon size={32} className="text-gray-200 mx-auto mb-3"/>
                            <p className="text-sm font-medium text-gray-500">Sin insumos registrados</p>
                            <p className="text-xs text-gray-400 mt-1">Los insumos aparecen aquí cuando creas un mantenimiento con materiales.</p>
                        </div>
                    ):(
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Total líneas</p><p className="text-xl font-bold text-gray-800">{insumosData.items.length}</p></div>
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">Costo total MXN</p><p className="text-xl font-bold text-gray-800">{fmtMXN(insumosData.grandTotalMXN)}</p></div>
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-400 mb-1">T.C. global</p><p className="text-xl font-bold text-gray-800">${insumosData.tipoCambioGlobal}</p></div>
                            </div>
                            <Card>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead><tr className="bg-gray-50/50 border-b border-gray-100">
                                            {['Fecha','Mantenimiento','Insumo','Cant.','Precio','Total MXN'].map((h,i)=>(
                                                <th key={i} className={`p-3 text-xs font-semibold text-gray-400 uppercase tracking-wider${i>=3?' text-right':''}`}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {insumosData.items.map(ins=>(
                                                <tr key={ins.id} className="hover:bg-gray-50/50">
                                                    <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{fmtFecha(ins.mantenimiento.fecha)}</td>
                                                    <td className="p-3"><p className="text-xs text-gray-700 line-clamp-1">{ins.mantenimiento.descripcion}</p></td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-1.5">
                                                            {ins.origen==='ALMACEN'?<Warehouse size={11} className="text-blue-400 flex-shrink-0"/>:<ShoppingCart size={11} className="text-orange-400 flex-shrink-0"/>}
                                                            <div>
                                                                <p className="text-xs font-medium text-gray-800">{ins.origen==='ALMACEN'?ins.producto?.nombre:ins.descripcionLibre}</p>
                                                                {ins.origen==='ALMACEN'&&ins.almacen&&<p className="text-xs text-gray-400">{ins.almacen.nombre}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right text-xs text-gray-700">{ins.cantidad} {ins.producto?.unidad??''}</td>
                                                    <td className="p-3 text-right text-xs text-gray-700">
                                                        {ins.moneda==='USD'?'US$':'$'}{ins.precioUnitario.toLocaleString('es-MX',{maximumFractionDigits:2})}
                                                        {ins.moneda==='USD'&&<p className="text-xs text-gray-400">TC: {ins.tipoCambioUsado}</p>}
                                                    </td>
                                                    <td className="p-3 text-right text-sm font-semibold text-gray-800">{fmtMXN(ins.totalMXN)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot><tr className="border-t-2 border-gray-200 bg-gray-50/50">
                                            <td colSpan={5} className="p-3 text-xs font-semibold text-gray-500 text-right">Total</td>
                                            <td className="p-3 text-right text-base font-bold text-gray-900">{fmtMXN(insumosData.grandTotalMXN)}</td>
                                        </tr></tfoot>
                                    </table>
                                </div>
                            </Card>
                        </>
                    )}
                </div>
            )}

            {/* ══ TAB: COMPONENTES ══ */}
            {tab==='componentes'&&(
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2"><Package size={16} className="text-blue-500"/>Componentes instalados</h2>
                            <p className="text-xs text-gray-400 mt-0.5">Pistolas, cabezales y otros componentes trazables</p>
                        </div>
                        <button onClick={()=>setModalNuevoComp(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm">
                            <Plus size={13}/> Agregar componente
                        </button>
                    </div>
                    {componentes.length===0?(
                        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                            <Package size={32} className="text-gray-200 mx-auto mb-3"/>
                            <p className="text-sm font-medium text-gray-500">Sin componentes instalados</p>
                            <button onClick={()=>setModalNuevoComp(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">
                                <Plus size={13}/> Agregar primer componente
                            </button>
                        </div>
                    ):(
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {componentes.map(comp=>(
                                <ComponenteCard key={comp.id} comp={comp} equipoId={id}
                                    onMovimiento={setModalMov} onEditar={setModalEditComp} onEliminar={handleDeleteComponente}/>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══ Modales ══ */}
            {modalMov&&<MovimientoModal componente={modalMov} equipoActualId={id} onClose={()=>setModalMov(null)} onSuccess={loadComponentes}/>}
            {modalNuevoComp&&<NuevoComponenteModal equipoId={id} onClose={()=>setModalNuevoComp(false)} onSuccess={loadComponentes}/>}
            {modalNuevaBitacora&&(
                <NuevoBitacoraModal equipoId={id} pendientesAbiertos={pendientesAbiertos} usuarioId={usuarioId}
                    onClose={()=>setModalNuevaBitacora(false)}
                    onSuccess={()=>{loadMantNuevos();loadPendientes();setInsumosData(null);}}/>
            )}
            {modalEditNuevo&&(
                <NuevoBitacoraModal equipoId={id} pendientesAbiertos={pendientesAbiertos} usuarioId={usuarioId}
                    registroEditar={modalEditNuevo}
                    onClose={()=>setModalEditNuevo(null)}
                    onSuccess={()=>{loadMantNuevos();loadPendientes();setInsumosData(null);}}/>
            )}
            {modalEditLegacy&&(
                <EditLegacyModal registro={modalEditLegacy} equipoId={id} pendientesAbiertos={pendientesAbiertos} usuarioId={usuarioId}
                    onClose={()=>setModalEditLegacy(null)}
                    onSuccess={()=>{loadMantNuevos();loadPendientes();setInsumosData(null);}}/>
            )}
            {modalNuevoPend&&<NuevoPendienteModal equipoId={id} onClose={()=>setModalNuevoPend(false)} onSuccess={loadPendientes}/>}
            {modalEditPend&&<EditPendienteModal pendiente={modalEditPend} equipoId={id} onClose={()=>setModalEditPend(null)} onSuccess={loadPendientes}/>}
            {modalEditComp&&<EditComponenteModal componente={modalEditComp} onClose={()=>setModalEditComp(null)} onSuccess={loadComponentes}/>}
            {confirmDelete&&(
                <ConfirmModal mensaje={confirmDelete.mensaje} titulo={confirmDelete.titulo}
                    confirmLabel={confirmDelete.confirmLabel} confirmClass={confirmDelete.confirmClass}
                    onConfirm={confirmDelete.onConfirm} onCancel={()=>setConfirmDelete(null)}/>
            )}
        </div>
    );
}
