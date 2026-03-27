"use client";

import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import { X, ArrowUpCircle, ArrowDownCircle, SlidersHorizontal, Package, AlertTriangle, Search, ChevronDown, User } from 'lucide-react';

type TipoModal = 'entrada' | 'salida' | 'ajuste';

interface Producto {
    id: string; nombre: string; sku: string; unidad: string;
    stock: number;
    ultimoPrecioCompra?: number | null;
    ultimoPrecioVenta?: number | null;
}
interface Props {
    producto: Producto;
    tipo: TipoModal;
    onClose: () => void;
    onDone: () => void;
}

// ── Autocompletado genérico (proveedor o cliente) ─────────────────────────────
function EntitySearch({
    endpoint, placeholder, value, onChange, displayFields,
}: {
    endpoint: string;
    placeholder: string;
    value: string;
    onChange: (id: string, nombre: string) => void;
    displayFields?: (item: any) => string;
}) {
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [filtered, setFiltered] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [selectedName, setSelectedName] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchApi(endpoint).then(setItems).catch(() => {});
    }, [endpoint]);

    useEffect(() => {
        if (!query) { setFiltered(items.slice(0, 8)); return; }
        setFiltered(items.filter((p: any) => p.nombre.toLowerCase().includes(query.toLowerCase())).slice(0, 8));
    }, [query, items]);

    useEffect(() => {
        const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const select = (p: any) => {
        setSelectedName(p.nombre); setQuery(p.nombre);
        onChange(p.id, p.nombre); setOpen(false);
    };
    const clear = () => { setSelectedName(''); setQuery(''); onChange('', ''); };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) clear(); }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className="w-full pl-8 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                {selectedName
                    ? <button onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14}/></button>
                    : <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
            </div>
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {filtered.map((p: any) => (
                        <button key={p.id} onMouseDown={() => select(p)}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <span className="text-gray-800 font-medium">{p.nombre}</span>
                                {(p.rfc || p.razonSocial) && (
                                    <span className="block text-xs text-gray-400 truncate">
                                        {p.rfc && <span className="font-mono mr-2">{p.rfc}</span>}
                                        {p.razonSocial}
                                    </span>
                                )}
                            </div>
                            {p.telefono && <span className="text-xs text-gray-400 flex-shrink-0">{p.telefono}</span>}
                        </button>
                    ))}
                </div>
            )}
            {open && filtered.length === 0 && query && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2.5 text-sm text-gray-400">
                    Sin resultados para "{query}"
                </div>
            )}
        </div>
    );
}

const CONFIG = {
    entrada: {
        titulo: 'Registrar entrada', subtituloColor: 'text-green-800', headerBg: 'bg-green-50',
        iconBg: 'bg-green-100', icon: <ArrowUpCircle size={20} className="text-green-600" />,
        btnColor: 'bg-green-600 hover:bg-green-700', btnLabel: '+ Registrar entrada', tipoMovimiento: 'ENTRADA',
    },
    salida: {
        titulo: 'Registrar salida', subtituloColor: 'text-red-700', headerBg: 'bg-red-50',
        iconBg: 'bg-red-100', icon: <ArrowDownCircle size={20} className="text-red-500" />,
        btnColor: 'bg-red-500 hover:bg-red-600', btnLabel: '− Registrar salida', tipoMovimiento: 'SALIDA',
    },
    ajuste: {
        titulo: 'Ajuste de inventario', subtituloColor: 'text-purple-800', headerBg: 'bg-purple-50',
        iconBg: 'bg-purple-100', icon: <SlidersHorizontal size={20} className="text-purple-600" />,
        btnColor: 'bg-purple-600 hover:bg-purple-700', btnLabel: '± Registrar ajuste', tipoMovimiento: 'AJUSTE_POSITIVO',
    },
};

const MOTIVOS_AJUSTE = [
    'Conteo físico — corrección', 'Merma / deterioro', 'Daño en almacén',
    'Error de captura', 'Muestra / regalo', 'Devolución de cliente', 'Otro',
];

const TIPOS_SALIDA = [
    { value: 'VENTA',           label: 'Venta',           desc: 'Venta a cliente' },
    { value: 'CONSUMO_INTERNO', label: 'Consumo interno', desc: 'Uso propio de la empresa' },
    { value: 'PERDIDA',         label: 'Pérdida / Merma', desc: 'Deterioro, robo o baja' },
];

export function MovimientoModal({ producto, tipo, onClose, onDone }: Props) {
    const cfg = CONFIG[tipo];
    const isEntrada = tipo === 'entrada';
    const isSalida  = tipo === 'salida';
    const isAjuste  = tipo === 'ajuste';

    const [almacenes, setAlmacenes] = useState<any[]>([]);
    const [saving, setSaving]       = useState(false);
    const [error, setError]         = useState('');
    const [submitted, setSubmitted] = useState(false);

    const [form, setForm] = useState({
        cantidad: '',
        costoUnitario:  String(producto.ultimoPrecioCompra ?? ''),
        precioVenta:    String(producto.ultimoPrecioVenta ?? ''),
        almacenId:      '',
        proveedorId:    '',
        clienteId:      '',
        clienteNombre:  '',
        referencia:     '',
        motivo:         MOTIVOS_AJUSTE[0],
        tipoAjuste:     'positivo' as 'positivo' | 'negativo',
        tipoSalida:     'VENTA' as 'VENTA' | 'CONSUMO_INTERNO' | 'PERDIDA',
        fecha:          new Date().toISOString().slice(0, 16),
    });

    useEffect(() => {
        fetchApi('/warehouse').catch(() => []).then((alms: any[]) => {
            setAlmacenes(alms);
            if (alms.length > 0) setForm(f => ({ ...f, almacenId: alms[0].id }));
        });
    }, []);

    const set = (name: string, value: string) => setForm(f => ({ ...f, [name]: value }));
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        set(e.target.name, e.target.value);

    const qty    = Number(form.cantidad) || 0;
    const costo  = Number(form.costoUnitario) || 0;
    const pventa = Number(form.precioVenta) || 0;
    const margen = pventa > 0 && costo > 0 ? ((pventa - costo) / pventa * 100) : null;
    const margenColor = margen ? (margen >= 30 ? 'text-green-600' : margen >= 15 ? 'text-amber-500' : 'text-red-500') : 'text-gray-400';
    const stockDespues = isEntrada || (isAjuste && form.tipoAjuste === 'positivo')
        ? producto.stock + qty : producto.stock - qty;
    const stockInsuf = (isSalida || (isAjuste && form.tipoAjuste === 'negativo')) && qty > producto.stock;
    const tipoMovimientoFinal = isAjuste
        ? (form.tipoAjuste === 'positivo' ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO')
        : cfg.tipoMovimiento;

    const handleSubmit = async () => {
        setSubmitted(true);
        if (!form.cantidad || qty <= 0) { setError('Ingresa una cantidad válida'); return; }
        if (!form.almacenId)            { setError('Selecciona un almacén'); return; }
        if (isEntrada && !form.costoUnitario) { setError('Ingresa el costo unitario'); return; }
        if (stockInsuf) { setError(`Stock insuficiente. Disponible: ${producto.stock} ${producto.unidad}`); return; }

        setSaving(true); setError('');
        try {
            // Encode tipoSalida as prefix in referencia: "VENTA|FAC-001", "CONSUMO_INTERNO|", "PERDIDA|nota"
            const referenciaFinal = isSalida
                ? `${form.tipoSalida}|${form.referencia || ''}`
                : isAjuste
                    ? (form.motivo === 'Otro' ? form.referencia : form.motivo)
                    : (form.referencia || null);

            await fetchApi('/inventory/movements', {
                method: 'POST',
                body: JSON.stringify({
                    productoId:      producto.id,
                    almacenId:       form.almacenId,
                    tipoMovimiento:  tipoMovimientoFinal,
                    cantidad:        qty,
                    costoUnitario:   isEntrada || isAjuste
                        ? (costo || Number(producto.ultimoPrecioCompra ?? 0))
                        : Number(producto.ultimoPrecioCompra ?? 0),
                    precioVenta:     isSalida ? (pventa || null) : null,
                    proveedorId:     isEntrada && form.proveedorId ? form.proveedorId : null,
                    clienteId:       isSalida && form.clienteId ? form.clienteId : null,
                    clienteNombre:   isSalida ? (form.clienteNombre || null) : null,
                    referencia:      referenciaFinal,
                    fecha: form.fecha ? new Date(form.fecha).toISOString() : undefined,
                }),
            });
            onDone();
        } catch (err: any) {
            setError(err.message || 'Error al registrar');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className={`px-6 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl ${cfg.headerBg} sticky top-0 z-10`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${cfg.iconBg}`}>{cfg.icon}</div>
                        <div>
                            <p className={`font-semibold text-sm ${cfg.subtituloColor}`}>{cfg.titulo}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[280px]">{producto.nombre} · {producto.sku}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-white/60 rounded-lg"><X size={18}/></button>
                </div>

                <div className="px-6 py-5 space-y-4">

                    {/* Stock actual */}
                    <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm ${stockInsuf ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                        <span className="text-gray-500 flex items-center gap-1.5"><Package size={14}/> Stock actual</span>
                        <span className={`font-bold ${stockInsuf ? 'text-red-600' : 'text-gray-800'}`}>
                            {producto.stock} {producto.unidad}
                            {qty > 0 && (
                                <span className={`ml-2 font-normal text-xs ${stockDespues < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                    → {stockDespues} después
                                </span>
                            )}
                        </span>
                    </div>

                    {error && submitted && (
                        <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2.5 rounded-lg border border-red-100 text-sm">
                            <AlertTriangle size={14}/> {error}
                        </div>
                    )}

                    {/* Ajuste tipo */}
                    {isAjuste && (
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Tipo de ajuste *</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => set('tipoAjuste', 'positivo')}
                                    className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${form.tipoAjuste === 'positivo' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                    + Positivo (sumar stock)
                                </button>
                                <button type="button" onClick={() => set('tipoAjuste', 'negativo')}
                                    className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${form.tipoAjuste === 'negativo' ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                    − Negativo (restar stock)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Cantidad + Almacén */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Cantidad ({producto.unidad}) *</label>
                            <input type="number" name="cantidad" min="1" value={form.cantidad} onChange={handleChange}
                                autoFocus placeholder="0"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Almacén *</label>
                            <select name="almacenId" value={form.almacenId} onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="">Seleccionar...</option>
                                {almacenes.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Entrada: costo + margen */}
                    {isEntrada && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-gray-700 block mb-1.5">Costo unitario *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                    <input type="number" step="0.01" min="0" name="costoUnitario" value={form.costoUnitario}
                                        onChange={handleChange} placeholder="0.00"
                                        className="w-full pl-6 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                </div>
                                {producto.ultimoPrecioCompra && (
                                    <p className="text-xs text-gray-400 mt-1">Último: ${Number(producto.ultimoPrecioCompra).toLocaleString()}</p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-700 block mb-1.5">
                                    Margen estimado <span className="text-gray-400 font-normal">(vs. último p. venta)</span>
                                </label>
                                <div className="px-3 py-2 border border-dashed border-gray-200 rounded-lg bg-gray-50 text-sm min-h-[38px] flex items-center">
                                    {margen !== null ? (
                                        <span className={`font-bold ${margenColor}`}>
                                            {margen.toFixed(1)}%
                                            {costo > 0 && pventa > 0 && <span className="text-xs text-gray-400 font-normal ml-2">${(pventa - costo).toLocaleString()}/{producto.unidad}</span>}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 text-xs italic">
                                            {!producto.ultimoPrecioVenta ? 'Sin ventas previas' : 'Ingresa el costo'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Salida: tipo de salida + precio venta + cliente del catálogo */}
                    {isSalida && (
                        <>
                            {/* Tipo de salida */}
                            <div>
                                <label className="text-xs font-medium text-gray-700 block mb-1.5">Tipo de salida *</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {TIPOS_SALIDA.map(ts => (
                                        <button key={ts.value} type="button"
                                            onClick={() => set('tipoSalida', ts.value)}
                                            className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all text-center ${
                                                form.tipoSalida === ts.value
                                                    ? ts.value === 'VENTA'
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : ts.value === 'CONSUMO_INTERNO'
                                                            ? 'bg-amber-500 text-white border-amber-500'
                                                            : 'bg-red-500 text-white border-red-500'
                                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}>
                                            <div>{ts.label}</div>
                                            <div className={`text-[10px] mt-0.5 ${form.tipoSalida === ts.value ? 'opacity-80' : 'text-gray-400'}`}>{ts.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Precio venta + Cliente — solo para VENTA */}
                            {form.tipoSalida === 'VENTA' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1.5">Precio de venta al cliente</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                        <input type="number" step="0.01" min="0" name="precioVenta" value={form.precioVenta}
                                            onChange={handleChange} placeholder="0.00"
                                            className="w-full pl-6 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                    </div>
                                    {producto.ultimoPrecioVenta && (
                                        <p className="text-xs text-gray-400 mt-1">Último: ${Number(producto.ultimoPrecioVenta).toLocaleString()}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1.5">
                                        Cliente <span className="text-gray-400 font-normal">(catálogo)</span>
                                    </label>
                                    <EntitySearch
                                        endpoint="/clients"
                                        placeholder="Buscar cliente..."
                                        value={form.clienteId}
                                        onChange={(id, nombre) => setForm(f => ({ ...f, clienteId: id, clienteNombre: nombre }))}
                                    />
                                </div>
                            </div>
                            )}
                            {/* Si no está en catálogo, permite texto libre — solo VENTA */}
                            {form.tipoSalida === 'VENTA' && !form.clienteId && (
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1.5">
                                        <User size={11} className="inline mr-1 text-gray-400"/>
                                        O escribe el nombre del cliente
                                        <span className="text-gray-400 font-normal ml-1">(si no está en el catálogo)</span>
                                    </label>
                                    <input type="text" name="clienteNombre" value={form.clienteNombre} onChange={handleChange}
                                        placeholder="Nombre del cliente"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                </div>
                            )}
                            {/* Datos fiscales del cliente seleccionado — solo VENTA */}
                            {form.tipoSalida === 'VENTA' && form.clienteId && (() => {
                                const clientes = (window as any).__cachedClientes as any[];
                                const cli = clientes?.find((c: any) => c.id === form.clienteId);
                                if (!cli?.rfc && !cli?.regimenFiscal) return null;
                                return (
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs space-y-1">
                                        <p className="font-semibold text-blue-700 mb-1">Datos fiscales del cliente</p>
                                        {cli.razonSocial && <p className="text-blue-800 font-medium">{cli.razonSocial}</p>}
                                        {cli.rfc && <p className="font-mono text-blue-600">RFC: {cli.rfc}</p>}
                                        {cli.regimenFiscal && <p className="text-blue-600">{cli.regimenFiscal}</p>}
                                        {cli.usoCFDI && <p className="text-blue-600">CFDI: {cli.usoCFDI}</p>}
                                    </div>
                                );
                            })()}
                        </>
                    )}

                    {/* Ajuste: motivo + costo */}
                    {isAjuste && (
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Motivo del ajuste *</label>
                            <select name="motivo" value={form.motivo} onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                {MOTIVOS_AJUSTE.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            {form.motivo === 'Otro' && (
                                <input type="text" name="referencia" value={form.referencia} onChange={handleChange}
                                    placeholder="Describe el motivo..."
                                    className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"/>
                            )}
                            <div className="mt-3">
                                <label className="text-xs font-medium text-gray-700 block mb-1.5">Costo unitario (para valorización)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                    <input type="number" step="0.01" min="0" name="costoUnitario" value={form.costoUnitario}
                                        onChange={handleChange} placeholder={String(producto.ultimoPrecioCompra ?? '0')}
                                        className="w-full pl-6 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"/>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Se usa para actualizar el valor del inventario.</p>
                            </div>
                        </div>
                    )}

                    {/* Entrada: proveedor */}
                    {isEntrada && (
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Proveedor</label>
                            <EntitySearch
                                endpoint="/suppliers"
                                placeholder="Buscar proveedor..."
                                value={form.proveedorId}
                                onChange={(id) => setForm(f => ({ ...f, proveedorId: id }))}
                            />
                        </div>
                    )}

                    {/* Referencia + Fecha */}
                    {!isAjuste && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-gray-700 block mb-1.5">Referencia</label>
                                <input type="text" name="referencia" value={form.referencia} onChange={handleChange}
                                    placeholder={isEntrada ? 'Ej: OC-2026-001' : 'Ej: FAC-2026-001'}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-700 block mb-1.5">Fecha y hora</label>
                                <input type="datetime-local" name="fecha" value={form.fecha} onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                            </div>
                        </div>
                    )}
                    {isAjuste && (
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Fecha y hora</label>
                            <input type="datetime-local" name="fecha" value={form.fecha} onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"/>
                        </div>
                    )}

                    {/* Resumen */}
                    {qty > 0 && (
                        <div className={`px-4 py-3 rounded-xl border text-sm ${isEntrada ? 'bg-green-50 border-green-200' : isSalida ? 'bg-red-50 border-red-200' : form.tipoAjuste === 'positivo' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex justify-between items-center">
                                <span className={isEntrada || (isAjuste && form.tipoAjuste === 'positivo') ? 'text-green-700' : 'text-red-600'}>
                                    {isEntrada ? 'Inversión total'
                                        : isSalida && form.tipoSalida === 'VENTA' ? 'Ingresos estimados'
                                        : isSalida && form.tipoSalida === 'CONSUMO_INTERNO' ? 'Unidades a consumir'
                                        : isSalida && form.tipoSalida === 'PERDIDA' ? 'Unidades a dar de baja'
                                        : `Ajuste ${form.tipoAjuste === 'positivo' ? '+' : '-'}${qty} ${producto.unidad}`}
                                </span>
                                <span className={`font-bold text-base ${isEntrada || (isAjuste && form.tipoAjuste === 'positivo') ? 'text-green-700' : 'text-red-600'}`}>
                                    {isEntrada && costo > 0 ? `$${(qty * costo).toLocaleString('es-MX', {maximumFractionDigits:0})}`
                                        : isSalida && form.tipoSalida === 'VENTA' && pventa > 0 ? `$${(qty * pventa).toLocaleString('es-MX', {maximumFractionDigits:0})}`
                                        : isSalida ? `${qty} ${producto.unidad}`
                                        : isAjuste ? `${form.tipoAjuste === 'positivo' ? '+' : '-'}${qty}` : '—'}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {isEntrada && costo > 0 ? `${qty} ${producto.unidad} × $${costo.toLocaleString()} c/u`
                                    : isSalida && form.tipoSalida === 'VENTA' && pventa > 0 ? `${qty} ${producto.unidad} × $${pventa.toLocaleString()} c/u`
                                    : isSalida ? `Stock: ${producto.stock} → ${stockDespues} ${producto.unidad}`
                                    : isAjuste ? `Stock: ${producto.stock} → ${stockDespues} ${producto.unidad}` : ''}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium">
                        Cancelar
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className={`flex-1 py-2.5 text-sm text-white font-semibold rounded-xl transition-colors disabled:opacity-60 shadow-sm ${cfg.btnColor}`}>
                        {saving ? 'Guardando...' : cfg.btnLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
