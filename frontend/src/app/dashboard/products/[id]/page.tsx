"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { useCompany } from '@/context/CompanyContext';
import React from "react";
import {
    ArrowLeft, Plus, Minus, Edit, AlertTriangle, X,
    TrendingUp, TrendingDown, DollarSign, FileDown,
    Building2, User, Save, Upload, ToggleLeft, ToggleRight, Check, SlidersHorizontal,
    Download, RefreshCw, Filter, StickyNote, ShoppingCart, ChevronLeft, ChevronRight
} from 'lucide-react';
import { MovimientoModal } from '@/components/ui/MovimientoModal';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import ProductChart from '@/components/dashboard/ProductChart';


interface Proveedor { nombre: string; telefono?: string; email?: string; }
interface Movimiento {
    id: string;
    tipoMovimiento: 'ENTRADA' | 'SALIDA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO';
    cantidad: number; costoUnitario: number; precioVenta?: number;
    proveedorId?: string; proveedor?: Proveedor; clienteNombre?: string;
    referencia?: string; fecha: string;
    moneda?: string; tipoCambio?: number | null;
    almacen: { nombre: string }; usuario: { nombre: string }; saldo?: number;
}
interface Producto {
    id: string; nombre: string; sku: string; unidad: string;
    stockMinimo: number; ultimoPrecioCompra?: number | null; ultimoPrecioVenta?: number | null;
    activo: boolean; stock: number; imagen?: string | null;
    descripcion?: string; categoriaId: string;
    moneda?: string;
    ultimaEntrada?: { tipoCambio?: number | null; moneda?: string } | null;
    categoria: { id: string; nombre: string };
}

const tipoColor = (t: string) => ({ENTRADA:'bg-green-100 text-green-700',SALIDA:'bg-orange-100 text-orange-700',CONSUMO_INTERNO:'bg-orange-100 text-orange-700',AJUSTE_POSITIVO:'bg-blue-100 text-blue-700',AJUSTE_NEGATIVO:'bg-purple-100 text-purple-700'}[t]||'bg-gray-100 text-gray-600');
const tipoLabel = (t: string) => ({ENTRADA:'Compra',SALIDA:'Consumo',CONSUMO_INTERNO:'Consumo',AJUSTE_POSITIVO:'Ajuste +',AJUSTE_NEGATIVO:'Ajuste -'}[t]||t);
function toInputDate(d: Date) { return d.toISOString().split('T')[0]; }

const MAX_SIZE_BYTES = 300*1024;
const MAX_DIM = 500;

async function compressImage(file: File): Promise<{base64:string;error?:string}> {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) { resolve({base64:'',error:'Debe ser imagen JPG, PNG o WebP'}); return; }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            let {width,height} = img;
            if (width>MAX_DIM||height>MAX_DIM) {
                if (width>height) { height=Math.round(height*MAX_DIM/width); width=MAX_DIM; }
                else { width=Math.round(width*MAX_DIM/height); height=MAX_DIM; }
            }
            canvas.width=width; canvas.height=height;
            canvas.getContext('2d')!.drawImage(img,0,0,width,height);
            let quality=0.85;
            let base64=canvas.toDataURL('image/jpeg',quality);
            while(base64.length*0.75>MAX_SIZE_BYTES&&quality>0.2){quality-=0.1;base64=canvas.toDataURL('image/jpeg',quality);}
            if(base64.length*0.75>MAX_SIZE_BYTES) resolve({base64:'',error:'Imagen demasiado grande. Usa una más pequeña.'});
            else resolve({base64});
        };
        img.onerror=()=>resolve({base64:'',error:'No se pudo leer la imagen'});
        img.src=url;
    });
}

// ── Helpers de doble moneda ───────────────────────────────────────────────────

/**
 * Convierte un valor de monedaDoc a monedaBase usando tipoCambio (USD/MXN).
 * Retorna null si no hay tipo de cambio o no aplica conversión.
 */
function convertirABase(
    valor: number,
    monedaDoc: string,
    monedaBase: string,
    tipoCambio: number | null | undefined
): number | null {
    if (!monedaDoc || monedaDoc === monedaBase) return valor;
    if (!tipoCambio) return null;
    if (monedaDoc === 'USD' && monedaBase === 'MXN') return valor * tipoCambio;
    if (monedaDoc === 'MXN' && monedaBase === 'USD') return tipoCambio > 0 ? valor / tipoCambio : null;
    return null;
}

/** Chip de moneda extranjera */
function MonedaBadge({ moneda, monedaBase }: { moneda?: string; monedaBase: string }) {
    if (!moneda || moneda === monedaBase) return null;
    return (
        <span className="inline-block ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 align-middle leading-none">
            {moneda}
        </span>
    );
}

/**
 * Muestra un importe con su equivalente en moneda base debajo (en gris pequeño).
 * Usado en KPIs y detalles del historial.
 */
function PrecioDoble({
    valor,
    monedaDoc,
    monedaBase,
    tipoCambio,
    className = 'text-2xl font-bold text-gray-800',
    subClassName = 'text-xs text-gray-400 mt-0.5',
    fallback = '—',
}: {
    valor: number | null | undefined;
    monedaDoc?: string;
    monedaBase: string;
    tipoCambio?: number | null;
    className?: string;
    subClassName?: string;
    fallback?: string;
}) {
    if (valor == null || isNaN(Number(valor))) return <span className="text-gray-400">{fallback}</span>;
    const v = Number(valor);
    const mDoc = monedaDoc || monedaBase;

    const fmt = (amount: number, currency: string) =>
        new Intl.NumberFormat('es-MX', {
            style: 'currency', currency, maximumFractionDigits: 2,
        }).format(amount);

    const fmtBase = (amount: number) =>
        new Intl.NumberFormat('es-MX', {
            style: 'currency', currency: monedaBase, maximumFractionDigits: 0,
        }).format(amount);

    const principal = fmt(v, mDoc);
    const valorBase = convertirABase(v, mDoc, monedaBase, tipoCambio);
    const mostrarEquiv = valorBase !== null && mDoc !== monedaBase;

    return (
        <span>
            <span className={className}>
                {principal}
                <MonedaBadge moneda={mDoc} monedaBase={monedaBase} />
            </span>
            {mostrarEquiv && (
                <span className={`block ${subClassName}`}>
                    ≈ {fmtBase(valorBase!)} {monedaBase}
                    {tipoCambio && (
                        <span className="ml-1 text-gray-300">· TC {tipoCambio.toFixed(2)}</span>
                    )}
                </span>
            )}
        </span>
    );
}

export default function ProductDetailPage({ isNew = false }: { isNew?: boolean } = {}) {
    const rawParams = useParams();
    const rawId = rawParams?.id;
    const id: string | undefined =
        typeof rawId === 'string' && rawId.trim() !== '' ? rawId : undefined;

    console.log('[ProductDetail] raw params:', rawParams);
    console.log('[ProductDetail] id:', id);
    const router=useRouter();
    const fileInputRef=useRef<HTMLInputElement>(null);
    const { moneda: monedaBase } = useCompany();

    // Formatear en moneda base
    const fmtBase = (v: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: monedaBase, maximumFractionDigits: 0 }).format(v);
    // Formatear en moneda específica
    const fmt = (v: number, currency: string) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);

    // Mantener currencyFmt para compatibilidad con código existente
    const currencyFmt = (v: number) => fmtBase(v);

    const [product,setProduct]=useState<Producto|null>(null);
    const [movements,setMovements]=useState<Movimiento[]>([]);
    const [loading,setLoading]=useState(!isNew);
    const [selectedMov,setSelectedMov]=useState<Movimiento|null>(null);
    const [editing,setEditing]=useState(isNew);
    const [saving,setSaving]=useState(false);
    const [saveError,setSaveError]=useState('');
    const [imgError,setImgError]=useState('');
    const [imgUploading,setImgUploading]=useState(false);
    const [categorias,setCategorias]=useState<any[]>([]);
    const [saved,setSaved]=useState(false);
    const [movModal,setMovModal]=useState<'entrada'|'salida'|'ajuste'|null>(null);
    const [totalInventarioValor,setTotalInventarioValor]=useState<number>(0);

    // ── Notas internas ─────────────────────────────────────────────────────────
    const [notas,setNotas]=useState('');
    const [notasEditando,setNotasEditando]=useState(false);
    const [notasGuardando,setNotasGuardando]=useState(false);
    const [notasTemp,setNotasTemp]=useState('');

    // ── Filtros historial ──────────────────────────────────────────────────────
    const [filtroTipo,setFiltroTipo]=useState<string>('todos');
    const [filtroDesde,setFiltroDesde]=useState('');
    const [filtroHasta,setFiltroHasta]=useState('');
    const [filtroBusqueda,setFiltroBusqueda]=useState('');
    const [mostrarFiltros,setMostrarFiltros]=useState(false);

    // ── Paginación historial ───────────────────────────────────────────────────
    const [pagina,setPagina]=useState(1);
    const POR_PAGINA=25;

    const [editData,setEditData]=useState({
        sku:'',nombre:'',descripcion:'',categoriaId:'',stockMinimo:'5',
        unidad:'litro',imagen:null as string|null,activo:true,precioReferencia:'',
        moneda:'MXN' as 'MXN'|'USD',
    });

    useEffect(()=>{ const load=async()=>{
        if(!isNew && !id){
            console.log('[ProductDetail] id no válido todavía, abortando fetch');
            return;
        }
        try{
            const cats = await fetchApi('/categories');
            setCategorias(cats);
            if(isNew){ return; }
            const [prod,movs,products,totalMovs]=await Promise.all([
                fetchApi(`/products/${id}`),
                fetchApi(`/inventory/kardex/${id}`),
                fetchApi('/products'),
                fetchApi('/inventory/movements').catch(()=>[]),
            ]);
            let saldo=0;
            const movsWithBalance=[...movs].sort((a:Movimiento,b:Movimiento)=>new Date(a.fecha).getTime()-new Date(b.fecha).getTime()).map((m:Movimiento)=>{saldo+=(['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)?Number(m.cantidad):-Number(m.cantidad));return{...m,saldo};});
            const fp=products.find((p:any)=>p.id===id);
            setProduct({...prod,stock:fp?.stock??0,ultimoPrecioCompra:fp?.ultimoPrecioCompra,ultimoPrecioVenta:fp?.ultimoPrecioVenta,moneda:fp?.moneda||prod.moneda,ultimaEntrada:fp?.ultimaEntrada||prod.ultimaEntrada});
            setMovements([...movsWithBalance].reverse());
            const notasGuardadas = prod.notas || '';
            setNotas(notasGuardadas);
            setNotasTemp(notasGuardadas);
            if(Array.isArray(totalMovs)){
                const totalVal=totalMovs.reduce((a:number,m:any)=>{
                    const q=Number(m.cantidad||0),c=Number(m.costoUnitario||0);
                    const tc=m.tipoCambio??1;
                    const mDoc=m.moneda||monedaBase;
                    let cBase=c;
                    if(mDoc==='USD'&&monedaBase==='MXN')cBase=c*tc;
                    else if(mDoc==='MXN'&&monedaBase==='USD')cBase=tc>0?c/tc:c;
                    if(['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento))return a+q*cBase;
                    if(['SALIDA','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento))return a-q*cBase;
                    return a;
                },0);
                setTotalInventarioValor(totalVal);
            }
        }catch(err){console.error(err);}
        finally{setLoading(false);}
    }; load(); },[id,isNew]);

    const startEdit=()=>{
        if(!product)return;
        setEditData({
            sku:product?.sku??'',nombre:product?.nombre??'',
            descripcion:(product as any)?.descripcion||'',
            categoriaId:product?.categoria?.id||'',
            stockMinimo:String(product?.stockMinimo??5),
            unidad:product?.unidad??'litro',
            imagen:product?.imagen??null,
            activo:product?.activo??true,
            precioReferencia:product?.ultimoPrecioCompra!=null?String(product.ultimoPrecioCompra):'',
            moneda:(product?.moneda||'MXN') as 'MXN'|'USD',
        });
        setEditing(true);setSaveError('');setImgError('');
    };

    const handleEditChange=(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>{
        const{name,value}=e.target;
        setEditData(p=>({...p,[name]:value}));
    };

    const handleImageFile=async(file:File)=>{
        setImgError('');setImgUploading(true);
        const{base64,error}=await compressImage(file);
        setImgUploading(false);
        if(error){setImgError(error);return;}
        setEditData(p=>({...p,imagen:base64}));
    };

    const handleSave=async()=>{
        if(isNew&&(!editData.nombre||!editData.sku)){setSaveError('SKU y nombre son obligatorios');return;}
        if(isNew&&!editData.categoriaId){setSaveError('Debes seleccionar una categoría');return;}
        setSaving(true);setSaveError('');
        try{
            if(isNew){
                const created=await fetchApi('/products',{method:'POST',body:JSON.stringify({
                    sku:editData.sku,nombre:editData.nombre,descripcion:editData.descripcion,
                    categoriaId:editData.categoriaId,unidad:editData.unidad,
                    stockMinimo:Number(editData.stockMinimo)||5,
                    imagen:editData.imagen,activo:editData.activo,
                    precioCompra:editData.precioReferencia?Number(editData.precioReferencia):undefined,
                    moneda:editData.moneda,
                })});
                router.replace(`/dashboard/products/${created.id}`);
                return;
            }
            if(!product)return;
            const updated=await fetchApi(`/products/${id}`,{method:'PUT',body:JSON.stringify({
                nombre:editData.nombre,categoriaId:editData.categoriaId,
                unidad:editData.unidad,stockMinimo:Number(editData.stockMinimo),
                imagen:editData.imagen,activo:editData.activo,
                moneda:editData.moneda,
            })});
            const cat=categorias.find((c:any)=>c.id===editData.categoriaId);
            setProduct(p=>p?{...p,...updated,stock:p.stock,categoria:cat||p.categoria,moneda:editData.moneda}:p);
            setEditing(false);setSaved(true);setTimeout(()=>setSaved(false),2500);
        }catch(err:any){setSaveError(err.message||'Error al guardar');}
        finally{setSaving(false);}
    };

    const cargarScriptKardex=(src:string):Promise<void>=>new Promise((resolve,reject)=>{
        if(document.querySelector(`script[src="${src}"]`)){resolve();return;}
        const s=document.createElement('script');s.src=src;
        s.onload=()=>resolve();s.onerror=()=>reject(new Error(`No se pudo cargar: ${src}`));
        document.head.appendChild(s);
    });

    const exportPDF=async()=>{
        if(!product)return;
        try{
            await cargarScriptKardex('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            await cargarScriptKardex('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
            const {jsPDF}=(window as any).jspdf;
            const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
            const empresa=localStorage.getItem('companySlug')||'Empresa';
            const ultimaEntradaLocal=movements.find(m=>m.tipoMovimiento==='ENTRADA');
            const costoRef=Number(ultimaEntradaLocal?.costoUnitario??product?.ultimoPrecioCompra??0);
            const monedaDoc=product?.moneda||monedaBase;
            const tc=product?.ultimaEntrada?.tipoCambio??null;
            const pageW=doc.internal.pageSize.getWidth();
            doc.setFillColor(15,23,42);doc.rect(0,0,pageW,22,'F');
            doc.setTextColor(255,255,255);doc.setFontSize(14);doc.setFont('helvetica','bold');
            doc.text('Kardex de Producto',14,10);
            doc.setFontSize(8);doc.setFont('helvetica','normal');
            doc.text(`Empresa: ${empresa.toUpperCase()}`,14,16);
            doc.text(`Generado: ${new Date().toLocaleDateString('es-MX',{dateStyle:'long'})}`,pageW-14,16,{align:'right'});
            doc.setTextColor(30,41,59);
            doc.setFillColor(245,247,250);doc.roundedRect(14,26,pageW-28,22,2,2,'F');
            doc.setFontSize(12);doc.setFont('helvetica','bold');doc.text(product?.nombre??'',18,34);
            doc.setFontSize(8);doc.setFont('helvetica','normal');
            doc.text(`SKU: ${product?.sku}  ·  Categoría: ${product?.categoria?.nombre}  ·  Moneda: ${monedaDoc}`,18,40);
            // Valor en moneda doc y en base
            const valorStock = (product?.stock??0)*costoRef;
            const valorStockBase = tc && monedaDoc !== monedaBase
                ? (monedaDoc==='USD'&&monedaBase==='MXN' ? valorStock*tc : tc>0?valorStock/tc:null)
                : valorStock;
            const valorStockStr = `${fmt(valorStock, monedaDoc)}${valorStockBase!==null&&monedaDoc!==monedaBase?` ≈ ${fmtBase(valorStockBase!)}`:''}`; 
            doc.text(`Stock actual: ${product?.stock} ${product?.unidad}  ·  Valor almacén: ${valorStockStr}`,pageW/2,40);
            const tableData=[...movements].reverse().map(m=>{
                const mDoc=m.moneda||monedaDoc;
                const mTc=m.tipoCambio??null;
                const costoUsd=Number(m.costoUnitario);
                const costoBaseStr = mTc && mDoc!==monedaBase
                    ? ` ≈${fmtBase(convertirABase(costoUsd,mDoc,monedaBase,mTc)??costoUsd)}`
                    : '';
                return [
                    new Date(m.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}),
                    tipoLabel(m.tipoMovimiento),
                    m.referencia||'—',
                    m.proveedor?.nombre||m.clienteNombre||'—',
                    m.almacen?.nombre||'—',
                    (['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)?'+':'-')+m.cantidad,
                    `${fmt(costoUsd, mDoc)}${costoBaseStr}`,
                    String(m.saldo??''),
                    m.usuario?.nombre||'',
                ];
            });
            (doc as any).autoTable({
                startY:52,
                head:[['Fecha','Tipo','Referencia','Prov/Obra','Almacén','Cant.','Costo','Saldo','Usuario']],
                body:tableData,
                styles:{fontSize:7,cellPadding:2},
                headStyles:{fillColor:[15,23,42],textColor:255,fontStyle:'bold'},
                alternateRowStyles:{fillColor:[248,250,252]},
                columnStyles:{0:{cellWidth:22},1:{cellWidth:18},5:{cellWidth:12,halign:'right'},8:{cellWidth:12,halign:'right'}},
            });
            doc.save(`kardex-${product?.sku}-${new Date().toISOString().split('T')[0]}.pdf`);
        }catch(err:any){
            console.error('Error generando PDF:',err);
            alert(`Error al generar el PDF: ${err?.message||'Error desconocido'}`);
        }
    };

    const exportCSV=()=>{
        if(!product||movements.length===0)return;
        const monedaDoc=product?.moneda||monedaBase;
        const headers=['Fecha','Tipo','Referencia','Proveedor/Obra','Almacén','Cantidad',`Costo Unitario (${monedaDoc})`,`Costo Unitario (${monedaBase})`,`Tipo Cambio`,'Saldo','Usuario'];
        const rows=[...movements].reverse().map(m=>{
            const mDoc=m.moneda||monedaDoc;
            const mTc=m.tipoCambio??null;
            const costoUsd=Number(m.costoUnitario);
            const costoBase=convertirABase(costoUsd,mDoc,monedaBase,mTc);
            return[
                new Date(m.fecha).toLocaleDateString('es-MX'),
                tipoLabel(m.tipoMovimiento),
                m.referencia||'',
                m.proveedor?.nombre||m.clienteNombre||'',
                m.almacen?.nombre||'',
                (['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)?'+':'-')+m.cantidad,
                costoUsd.toFixed(2),
                costoBase!==null?costoBase.toFixed(2):'',
                mTc!=null?mTc.toFixed(4):'',
                String(m.saldo??''),
                m.usuario?.nombre||''
            ];
        });
        const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download=`kardex-${product.sku}-${new Date().toISOString().split('T')[0]}.csv`;a.click();
        URL.revokeObjectURL(url);
    };

    const guardarNotas=async()=>{
        setNotasGuardando(true);
        try {
            await fetchApi(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ notas: notasTemp }) });
            setNotas(notasTemp);
            setNotasEditando(false);
        } catch {
            alert('Error al guardar las notas. Intenta de nuevo.');
        } finally {
            setNotasGuardando(false);
        }
    };

    if(!isNew && (!id || loading))return<div className="flex items-center justify-center h-64"><p className="text-gray-500">Cargando producto...</p></div>;
    if(loading)return<div className="flex items-center justify-center h-64"><p className="text-gray-500">Cargando producto...</p></div>;
    if(!isNew&&!product)return<div className="flex items-center justify-center h-64"><p className="text-gray-500">Producto no encontrado.</p></div>;

    const totalEntradas=!isNew?movements.filter(m=>['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento)).reduce((a,m)=>a+Number(m.cantidad),0):0;
    const totalSalidas=!isNew?movements.filter(m=>['SALIDA','CONSUMO_INTERNO','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)).reduce((a,m)=>a+Number(m.cantidad),0):0;
    const lowStock=!isNew&&product?product.stock<=product.stockMinimo:false;
    const ultimaEntrada=!isNew?movements.find(m=>m.tipoMovimiento==='ENTRADA'):undefined;
    const ultimaSalida=!isNew?movements.find(m=>["SALIDA","CONSUMO_INTERNO"].includes(m.tipoMovimiento)):undefined;
    const pC=Number(product?.ultimoPrecioCompra??0);
    const CATEGORY_COLORS: Record<string,string>={'Electrónicos':'#3b82f6','Periféricos':'#8b5cf6','Consumibles':'#f59e0b','Accesorios':'#10b981','default':'#6b7280'};

    // ── Moneda del producto ───────────────────────────────────────────────────
    const monedaDoc = product?.moneda || monedaBase;
    const tipoCambioProducto = product?.ultimaEntrada?.tipoCambio ?? ultimaEntrada?.tipoCambio ?? null;

    // ── Métricas de contexto ──────────────────────────────────────────────────
    // Usar costo de la última entrada, o bien el precioCompra del producto como fallback
    const ultimoCosto = Number(ultimaEntrada?.costoUnitario ?? product?.ultimoPrecioCompra ?? 0);
    const valorEsteProducto = (product?.stock ?? 0) * ultimoCosto;
    // Valor en moneda base para % del inventario
    const valorEsteProductoBase = convertirABase(valorEsteProducto, monedaDoc, monedaBase, tipoCambioProducto) ?? valorEsteProducto;

    const hace30d = new Date(Date.now() - 30 * 86400000);
    const salidasUltimos30d = !isNew ? movements
        .filter(m => ['SALIDA','CONSUMO_INTERNO','AJUSTE_NEGATIVO'].includes(m.tipoMovimiento) && new Date(m.fecha) >= hace30d)
        .reduce((a, m) => a + Number(m.cantidad), 0) : 0;
    const rotacionProducto = product?.stock && product.stock > 0
        ? (salidasUltimos30d / product.stock * 100).toFixed(1)
        : null;

    const promedioSalidasDiarias = salidasUltimos30d / 30;
    const diasStock = promedioSalidasDiarias > 0 && product?.stock
        ? Math.round(product.stock / promedioSalidasDiarias)
        : null;
    const diasStockAlerta = diasStock !== null && diasStock <= (product?.stockMinimo ?? 5) * 2;
    const catColor=CATEGORY_COLORS[product?.categoria?.nombre||'']||CATEGORY_COLORS['default'];

    // ── Valor almacén en moneda base ──────────────────────────────────────────
    const costoUltimaEntrada = Number(ultimaEntrada?.costoUnitario ?? product?.ultimoPrecioCompra ?? 0);
    const valorAlmacenDoc = (product?.stock ?? 0) * costoUltimaEntrada;
    const valorAlmacenBase = convertirABase(valorAlmacenDoc, monedaDoc, monedaBase, tipoCambioProducto) ?? valorAlmacenDoc;

    // ── Valor histórico acumulado (normalizado a base) ────────────────────────
    const valorHistoricoBase = movements.reduce((a, m) => {
        const q = Number(m.cantidad || 0);
        const c = Number(m.costoUnitario || 0);
        const mDoc = m.moneda || monedaDoc;
        const mTc = m.tipoCambio ?? tipoCambioProducto;
        const cBase = convertirABase(c, mDoc, monedaBase, mTc) ?? c;
        if (['ENTRADA', 'AJUSTE_POSITIVO'].includes(m.tipoMovimiento)) return a + q * cBase;
        if (['SALIDA', 'AJUSTE_NEGATIVO'].includes(m.tipoMovimiento)) return a - q * cBase;
        return a;
    }, 0);

    // Valor total compras en base
    const valorTotalComprasBase = movements.filter(m => m.tipoMovimiento === 'ENTRADA').reduce((a, m) => {
        const q = Number(m.cantidad || 0);
        const c = Number(m.costoUnitario || 0);
        const mDoc = m.moneda || monedaDoc;
        const mTc = m.tipoCambio ?? tipoCambioProducto;
        const cBase = convertirABase(c, mDoc, monedaBase, mTc) ?? c;
        return a + q * cBase;
    }, 0);

    // ── Filtros y paginación del historial ────────────────────────────────────
    const movimientosFiltrados=movements.filter(m=>{
        if(filtroTipo!=='todos'&&m.tipoMovimiento!==filtroTipo)return false;
        const fecha=new Date(m.fecha);
        if(filtroDesde&&fecha<new Date(filtroDesde+'T00:00:00'))return false;
        if(filtroHasta&&fecha>new Date(filtroHasta+'T23:59:59'))return false;
        if(filtroBusqueda){
            const q=filtroBusqueda.toLowerCase();
            const contacto=(m.proveedor?.nombre||m.clienteNombre||'').toLowerCase();
            if(!(m.referencia||'').toLowerCase().includes(q)&&!contacto.includes(q))return false;
        }
        return true;
    });
    const totalPaginas=Math.max(1,Math.ceil(movimientosFiltrados.length/POR_PAGINA));
    const paginaActual=Math.min(pagina,totalPaginas);
    const movPagina=movimientosFiltrados.slice((paginaActual-1)*POR_PAGINA,paginaActual*POR_PAGINA);
    const hayFiltrosActivos=filtroTipo!=='todos'||filtroDesde||filtroHasta||filtroBusqueda;

    const ultimaEntradaConProveedor=movements.find(m=>m.tipoMovimiento==='ENTRADA'&&m.proveedorId);
    const cantidadReordenSugerida=product?(product.stockMinimo*3-product.stock>0?product.stockMinimo*3-product.stock:product.stockMinimo*2):0;

    return(
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-start gap-4">
                    <button onClick={()=>router.back()} className="mt-1 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft size={20}/></button>
                    <div>
                        <p className="text-sm text-gray-500">
                            {isNew ? 'Nuevo insumo' : `${product?.sku} · ${product?.categoria?.nombre}`}
                            {!isNew && monedaDoc !== monedaBase && (
                                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">
                                    {monedaDoc}
                                </span>
                            )}
                        </p>
                        <h1 className="text-3xl font-bold text-gray-900">{isNew ? (editData.nombre || 'Nuevo Insumo') : product?.nombre}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            {!product?.activo&&<span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>}
                            {saved&&<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1"><Check size={11}/> Guardado</span>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {!isNew && <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"><FileDown size={16}/> Kardex PDF</button>}
                    {!isNew && movements.length>0 && <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"><Download size={16}/> Exportar CSV</button>}
                    {!editing
                        ?<button onClick={startEdit} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"><Edit size={16}/> Editar</button>
                        :<><button onClick={()=>{setEditing(false);setSaveError('');}} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"><X size={16}/> Cancelar</button>
                        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-70"><Save size={16}/>{saving?'Guardando...':(isNew?'Crear insumo':'Guardar cambios')}</button></>
                    }
                    {!isNew && <button onClick={()=>router.push(`/dashboard/purchases/new?productoId=${product?.id}`)} className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors cursor-pointer"><Plus size={16}/> Entrada</button>}
                    {!isNew && <button onClick={()=>router.push(`/dashboard/sales/new?productoId=${product?.id}`)} className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors cursor-pointer"><Minus size={16}/> Consumo</button>}
                </div>
            </div>

            {/* ── BANNER ALERTA STOCK BAJO ─────────────────────────────────── */}
            {!isNew && !editing && lowStock && (
                <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-xl px-5 py-3.5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                            <AlertTriangle size={18} className="text-red-600"/>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-red-700">Insumo bajo — requiere reabastecimiento</p>
                            <p className="text-xs text-red-500 mt-0.5">
                                Stock actual <strong>{product?.stock} {product?.unidad}</strong> ≤ mínimo <strong>{product?.stockMinimo} {product?.unidad}</strong>
                                {diasStock!==null&&` · ~${diasStock} días de inventario restantes`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={()=>router.push(`/dashboard/purchases/new?productoId=${product?.id}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer flex-shrink-0"
                    >
                        <ShoppingCart size={15}/>
                        Registrar entrada
                    </button>
                </div>
            )}

            {/* ── BLOQUE SUPERIOR: imagen + datos ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">

                {/* Imagen del producto */}
                <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${editing?'border-blue-200':'border-gray-100'}`}>
                    {editing?(
                        <div className="p-3 space-y-2">
                            <div onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleImageFile(f);}} onDragOver={e=>e.preventDefault()} onClick={()=>fileInputRef.current?.click()}
                                className="w-full aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all overflow-hidden">
                                {imgUploading?<p className="text-xs text-gray-400">Procesando...</p>
                                    :editData.imagen?<img src={editData.imagen} alt="Preview" className="w-full h-full object-cover"/>
                                    :<><Upload size={20} className="text-gray-400"/><p className="text-xs text-gray-500 text-center">Clic o arrastra<br/><span className="text-gray-400 text-xs">JPG·PNG·WebP</span></p></>}
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{if(e.target.files?.[0])handleImageFile(e.target.files[0]);}}/>
                            {imgError&&<p className="text-xs text-red-500">{imgError}</p>}
                            <p className="text-xs text-gray-400 text-center">máx 300KB · 500×500px<br/>Compresión automática</p>
                            {editData.imagen&&<button type="button" onClick={()=>setEditData(p=>({...p,imagen:null}))} className="w-full text-xs text-red-500 hover:bg-red-50 border border-red-100 rounded-lg py-1.5 flex items-center justify-center gap-1 cursor-pointer"><X size={11}/> Eliminar</button>}
                        </div>
                    ):(
                        <div className="w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                            {product?.imagen
                                ?<img src={product.imagen} alt={product?.nombre} className="w-full h-full object-cover"/>
                                :<div className="flex flex-col items-center gap-2">
                                    <div style={{width:72,height:72,borderRadius:12,background:catColor+'20',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                        <span style={{fontSize:32,fontWeight:700,color:catColor}}>{product?.nombre?.[0].toUpperCase()}</span>
                                    </div>
                                    <p className="text-xs text-gray-400">Sin imagen</p>
                                </div>
                            }
                        </div>
                    )}
                </div>

                {/* Datos del producto */}
                <div className={`bg-white rounded-xl border shadow-sm p-5 ${editing?'border-blue-200':'border-gray-100'}`}>
                    {editing?(
                        <div className="space-y-4">
                            {saveError&&<div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs border border-red-100">{saveError}</div>}
                            <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
                                <Edit size={14} className="text-blue-500"/>
                                <p className="text-xs font-semibold text-blue-600">Editando — los campos calculados se actualizarán automáticamente</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">{isNew ? "SKU *" : <span>SKU <span className="text-gray-400 font-normal">(no editable)</span></span>}</label>
                                    {isNew
                                        ? <input required type="text" name="sku" value={editData.sku} onChange={handleEditChange}
                                            placeholder="Ej: LAP-001"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
                                        : <input value={product?.sku??''} readOnly className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-400 font-mono cursor-not-allowed"/>
                                    }
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">Nombre *</label>
                                    <input required type="text" name="nombre" value={editData.nombre} onChange={handleEditChange} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-700 block mb-1">Descripción</label>
                                <textarea name="descripcion" value={editData.descripcion} onChange={handleEditChange} rows={2} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" placeholder="Características del producto..."/>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">Categoría *</label>
                                    <select
                                        name="categoriaId"
                                        value={editData.categoriaId}
                                        onChange={handleEditChange}
                                        className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${!editData.categoriaId ? 'border-red-300' : 'border-gray-200'}`}
                                    >
                                        <option value="">Seleccionar</option>
                                        {categorias.map((c:any)=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                                    </select>
                                    {!editData.categoriaId && (
                                        <p className="text-xs text-red-500 mt-1">Requerida para guardar</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">Unidad *</label>
                                    <select name="unidad" value={editData.unidad} onChange={handleEditChange} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                        {['litro','pieza','jornal','kg','metro','caja','unidad','rollo'].map(u=><option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                {/* ── Moneda del producto ── */}
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">Moneda del insumo</label>
                                    <select
                                        name="moneda"
                                        value={editData.moneda}
                                        onChange={handleEditChange}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="MXN">MXN — Peso mexicano</option>
                                        <option value="USD">USD — Dólar americano</option>
                                    </select>
                                    {editData.moneda !== monedaBase && (
                                        <p className="text-xs text-blue-500 mt-1">
                                            El precio se guardará en {editData.moneda}. El tipo de cambio se toma de cada movimiento.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className={isNew ? '' : 'bg-gray-50 rounded-lg p-3 border border-dashed border-gray-200'}>
                                    {isNew ? (
                                        <>
                                            <label className="text-xs font-medium text-gray-700 block mb-1">Costo unitario <span className="text-gray-400 font-normal">(referencia, en {editData.moneda})</span></label>
                                            <input
                                                type="number" step="0.01" min="0"
                                                value={editData.precioReferencia}
                                                onChange={e => setEditData(p => ({ ...p, precioReferencia: e.target.value }))}
                                                placeholder="Ej: 77.92"
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                            <p className="text-xs text-gray-400 mt-1">Se actualizará automáticamente al registrar una compra.</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-xs text-gray-400 mb-1">Costo unitario <span className="text-gray-300 text-xs">(última compra)</span></p>
                                            {ultimaEntrada ? (
                                                <PrecioDoble
                                                    valor={Number(ultimaEntrada.costoUnitario)}
                                                    monedaDoc={ultimaEntrada.moneda || monedaDoc}
                                                    monedaBase={monedaBase}
                                                    tipoCambio={ultimaEntrada.tipoCambio}
                                                    className="text-sm font-bold text-gray-700"
                                                    subClassName="text-xs text-gray-400 mt-0.5"
                                                />
                                            ) : <span className="text-gray-400 italic text-xs">Sin entradas aún</span>}
                                        </>
                                    )}
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 border border-dashed border-gray-200">
                                    <p className="text-xs text-gray-400 mb-1">Consumo últimos 30 días</p>
                                    <p className="text-sm font-bold text-gray-700">{salidasUltimos30d > 0 ? `${salidasUltimos30d} ${editData.unidad}` : <span className="text-gray-400 italic text-xs">Sin consumos</span>}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">Stock mínimo *</label>
                                    <input required type="number" min="0" name="stockMinimo" value={editData.stockMinimo} onChange={handleEditChange} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                </div>
                            </div>
                            {/* Campos calculados */}
                            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                                <div className="bg-gray-50 rounded-lg px-3 py-2">
                                    <p className="text-xs text-gray-400 mb-0.5">Stock actual <span className="text-gray-300">(calculado)</span></p>
                                    <p className="text-sm font-bold text-gray-700">{isNew ? `0 ${editData.unidad}` : `${product?.stock ?? 0} ${editData.unidad}`}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg px-3 py-2">
                                    <p className="text-xs text-gray-400 mb-0.5">Valor almacén ({monedaBase})</p>
                                    <p className="text-sm font-bold text-gray-700">{fmtBase(valorAlmacenBase)}</p>
                                    {monedaDoc !== monedaBase && (
                                        <p className="text-xs text-gray-400">{fmt(valorAlmacenDoc, monedaDoc)} {monedaDoc}</p>
                                    )}
                                </div>
                                <div className={`rounded-lg px-3 py-2 ${diasStockAlerta?'bg-orange-50':'bg-gray-50'}`}>
                                    <p className="text-xs text-gray-400 mb-0.5">Días de stock</p>
                                    <p className={`text-sm font-bold ${diasStockAlerta?'text-orange-600':'text-gray-700'}`}>{diasStock!==null?`~${diasStock} días`:'—'}</p>
                                </div>
                            </div>
                            {/* Toggle activo */}
                            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                <div><p className="text-sm font-medium text-gray-700">Insumo activo</p><p className="text-xs text-gray-400">Visible en compras/consumos</p></div>
                                <button type="button" onClick={()=>setEditData(p=>({...p,activo:!p.activo}))} className="cursor-pointer">
                                    {editData.activo?<ToggleRight size={32} className="text-green-500"/>:<ToggleLeft size={32} className="text-gray-300"/>}
                                </button>
                            </div>
                            {/* Notas internas en modo edición */}
                            {!isNew && (
                                <div className="pt-1">
                                    <label className="text-xs font-medium text-gray-700 block mb-1 flex items-center gap-1.5">
                                        <StickyNote size={13} className="text-amber-400"/> Notas internas
                                        <span className="text-gray-400 font-normal">(solo visible en esta pantalla)</span>
                                    </label>
                                    <textarea
                                        value={notasTemp||notas}
                                        onChange={e=>setNotasTemp(e.target.value)}
                                        rows={3}
                                        placeholder="Ej: Pedir solo al proveedor X · Frágil · Requiere revisión técnica antes de despachar..."
                                        className="w-full px-3 py-2 bg-amber-50/50 border border-amber-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 resize-none placeholder:text-gray-400"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Se guarda automáticamente al salir del campo.</p>
                                </div>
                            )}
                        </div>
                    ):(
                        // ── Modo vista ──
                        <div>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
                                {/* Stock actual */}
                                <div className={`rounded-xl border p-4 ${lowStock?'bg-red-50 border-red-200':'bg-gray-50 border-gray-100'}`}>
                                    <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-1"><p className="text-xs text-gray-500">Stock actual</p><InfoTooltip text="Suma de todas las entradas y ajustes positivos menos todas las salidas y ajustes negativos registrados en el kardex." position="bottom" /></div>{lowStock&&<AlertTriangle size={14} className="text-red-500"/>}</div>
                                    <p className={`text-2xl font-bold ${lowStock?'text-red-600':'text-gray-800'}`}>{product?.stock}</p>
                                    <p className="text-xs text-gray-400">{product?.unidad} · mín {product?.stockMinimo}</p>
                                </div>

                                {/* Último precio compra con doble moneda */}
                                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs text-gray-500">Último precio compra</p>
                                            <InfoTooltip text="CostoUnitario del último movimiento de ENTRADA. Si el insumo es en USD, se muestra el precio en USD y su equivalente en MXN usando el tipo de cambio del movimiento." position="bottom" />
                                        </div>
                                        <TrendingDown size={14} className="text-blue-400"/>
                                    </div>
                                    {ultimaEntrada ? (
                                        <PrecioDoble
                                            valor={Number(ultimaEntrada.costoUnitario)}
                                            monedaDoc={ultimaEntrada.moneda || monedaDoc}
                                            monedaBase={monedaBase}
                                            tipoCambio={ultimaEntrada.tipoCambio}
                                        />
                                    ) : (
                                        <>
                                            <p className="text-2xl font-bold text-gray-400">—</p>
                                        </>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">
                                        {ultimaEntrada
                                            ? `${new Date(ultimaEntrada.fecha).toLocaleDateString('es-MX')}${ultimaEntrada.proveedor?` · ${ultimaEntrada.proveedor.nombre}`:''}`
                                            : 'Sin entradas'}
                                    </p>
                                </div>

                                {/* Consumo últimos 30d */}
                                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                                    <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-1"><p className="text-xs text-gray-500">Consumo últimos 30 días</p><InfoTooltip text="Total de unidades consumidas en obra en los últimos 30 días." position="bottom" /></div><TrendingDown size={14} className="text-orange-400"/></div>
                                    <p className="text-2xl font-bold text-gray-800">{salidasUltimos30d}</p>
                                    <p className="text-xs text-gray-400">{product?.unidad} · {salidasUltimos30d===0?'sin consumo reciente':'en los últimos 30 días'}</p>
                                </div>

                                {/* Valor actual en stock — doble moneda */}
                                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs text-gray-500">Valor actual en stock</p>
                                            <InfoTooltip text="Stock actual × costo unitario de la última entrada. Si el insumo está en USD, se muestra el valor en USD y su equivalente en MXN." position="bottom" />
                                        </div>
                                        <DollarSign size={14} className="text-gray-400"/>
                                    </div>
                                    <PrecioDoble
                                        valor={valorAlmacenDoc}
                                        monedaDoc={monedaDoc}
                                        monedaBase={monedaBase}
                                        tipoCambio={tipoCambioProducto}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        {product?.stock} × {fmt(costoUltimaEntrada, monedaDoc)}
                                    </p>
                                </div>

                                {/* Valor histórico — en moneda base */}
                                <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs text-gray-500">Valor histórico acumulado</p>
                                            <InfoTooltip text="Σ(entradas×costo) − Σ(salidas×costo) sobre todos los movimientos. Todos los importes se convierten a la moneda base de la empresa usando el tipo de cambio de cada movimiento." position="bottom" />
                                        </div>
                                        <DollarSign size={14} className="text-amber-400"/>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-800">{fmtBase(valorHistoricoBase)}</p>
                                    <p className="text-xs text-gray-400 mt-1">Desde todos los movimientos · {monedaBase}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Información general</p>
                                    <table className="w-full text-sm"><tbody className="divide-y divide-gray-50">
                                        {[
                                            ['Nombre', product?.nombre??''],
                                            ['Categoría', product?.categoria?.nombre??''],
                                            ['Unidad', product?.unidad??''],
                                            ['Moneda', monedaDoc],
                                            ['Stock mínimo', `${product?.stockMinimo} ${product?.unidad}`],
                                            ['Estado', product?.activo?'Activo':'Inactivo'],
                                        ].map(([l,v])=>(
                                            <tr key={l}>
                                                <td className="py-1.5 text-gray-500 text-xs">{l}</td>
                                                <td className="py-1.5 text-right font-medium text-gray-800 text-xs">
                                                    {l === 'Moneda' && v !== monedaBase
                                                        ? <span className="font-bold text-blue-600">{v} <span className="text-gray-400 font-normal">(base: {monedaBase})</span></span>
                                                        : v
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Tipo de cambio si aplica */}
                                        {tipoCambioProducto && monedaDoc !== monedaBase && (
                                            <tr>
                                                <td className="py-1.5 text-gray-500 text-xs">Tipo de cambio (último mov.)</td>
                                                <td className="py-1.5 text-right font-medium text-gray-800 text-xs">
                                                    1 {monedaDoc} = {tipoCambioProducto.toFixed(4)} {monedaBase}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody></table>
                                    {/* Notas internas */}
                                    <div className="mt-4 pt-3 border-t border-gray-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5">
                                                <StickyNote size={13} className="text-amber-400"/>
                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notas internas</p>
                                            </div>
                                            {!notasEditando
                                                ? <button onClick={()=>{setNotasTemp(notas);setNotasEditando(true);}} className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors cursor-pointer"><Edit size={11}/> Editar</button>
                                                : <div className="flex gap-1.5">
                                                    <button onClick={()=>setNotasEditando(false)} className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-400 transition-colors cursor-pointer"><X size={11}/> Cancelar</button>
                                                    <button onClick={guardarNotas} disabled={notasGuardando} className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-70"><Save size={11}/>{notasGuardando?'...':'Guardar'}</button>
                                                </div>
                                            }
                                        </div>
                                        {notasEditando ? (
                                            <textarea value={notasTemp} onChange={e=>setNotasTemp(e.target.value)} rows={3}
                                                placeholder="Ej: Pedir solo al proveedor X · Frágil · Requiere revisión técnica..."
                                                className="w-full px-2.5 py-2 bg-amber-50/50 border border-amber-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400/20 resize-none placeholder:text-gray-400"
                                            />
                                        ) : notas ? (
                                            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{notas}</p>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">Sin notas internas.</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resumen de movimientos</p>
                                    <table className="w-full text-sm"><tbody className="divide-y divide-gray-50">
                                        <tr><td className="py-1.5 text-gray-500 text-xs">Total entradas</td><td className="py-1.5 text-right font-medium text-green-600 text-xs">+{totalEntradas} {product?.unidad}</td></tr>
                                        <tr><td className="py-1.5 text-gray-500 text-xs">Total consumos</td><td className="py-1.5 text-right font-medium text-orange-500 text-xs">-{totalSalidas} {product?.unidad}</td></tr>
                                        <tr className="border-t-2 border-gray-200"><td className="py-1.5 font-semibold text-gray-800 text-xs">Stock actual</td><td className="py-1.5 text-right font-bold text-gray-800 text-xs">= {product?.stock} {product?.unidad}</td></tr>
                                        <tr><td className="py-1.5 text-gray-500 text-xs">Total movimientos</td><td className="py-1.5 text-right font-medium text-gray-700 text-xs">{movements.length}</td></tr>
                                        <tr>
                                            <td className="py-1.5 text-gray-500 text-xs">Valor total compras ({monedaBase})</td>
                                            <td className="py-1.5 text-right font-medium text-gray-700 text-xs">{fmtBase(valorTotalComprasBase)}</td>
                                        </tr>
                                    </tbody></table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Métricas de contexto ─────────────────────────────────────── */}
            {!isNew && !editing && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                            <p className="text-xs text-gray-500">% del inventario total</p>
                            <InfoTooltip text="Qué porcentaje del valor total del inventario (en moneda base) representa este producto." position="bottom" />
                        </div>
                        {valorEsteProductoBase > 0 && ultimoCosto > 0 && totalInventarioValor > 0 ? (
                            <>
                                <p className="text-2xl font-bold text-gray-800">
                                    {((valorEsteProductoBase / totalInventarioValor) * 100).toFixed(1)}%
                                </p>
                                <p className="text-xs text-gray-400 mt-1">{fmtBase(valorEsteProductoBase)} de {fmtBase(totalInventarioValor)}</p>
                            </>
                        ) : (
                            <>
                                <p className="text-2xl font-bold text-gray-400">0.0%</p>
                                <p className="text-xs text-gray-400 italic mt-1">Sin entradas registradas</p>
                            </>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                            <p className="text-xs text-gray-500">Rotación últimos 30 días</p>
                            <InfoTooltip text="(Salidas de los últimos 30 días ÷ stock actual) × 100." position="bottom" />
                        </div>
                        {rotacionProducto !== null ? (
                            <>
                                <p className={`text-2xl font-bold ${Number(rotacionProducto) >= 50 ? 'text-green-600' : Number(rotacionProducto) >= 20 ? 'text-amber-500' : 'text-gray-800'}`}>
                                    {rotacionProducto}%
                                </p>
                                <p className="text-xs text-gray-400 mt-1">{salidasUltimos30d} {product?.unidad} consumidas · {salidasUltimos30d === 0 ? 'sin movimiento' : 'en 30 días'}</p>
                            </>
                        ) : (
                            <p className="text-sm text-gray-400 italic mt-1">Sin stock para calcular</p>
                        )}
                    </div>

                    <div className={`bg-white rounded-xl border shadow-sm p-4 ${diasStockAlerta ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100'}`}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <p className={`text-xs ${diasStockAlerta ? 'text-orange-600' : 'text-gray-500'}`}>Días de stock restante</p>
                            <InfoTooltip text="Stock actual ÷ promedio de salidas diarias de los últimos 30 días." position="bottom" />
                        </div>
                        {diasStock !== null ? (
                            <>
                                <p className={`text-2xl font-bold ${diasStockAlerta ? 'text-orange-600' : 'text-gray-800'}`}>
                                    ~{diasStock} días
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {diasStockAlerta ? '⚠ Considerar reabastecimiento pronto' : `Al ritmo de ${promedioSalidasDiarias.toFixed(1)} ${product?.unidad}/día consumidos`}
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-gray-400 italic mt-1">{salidasUltimos30d === 0 ? 'Sin consumos en 30 días' : 'Sin stock disponible'}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Gráfica */}
            {!isNew && (
                <ProductChart
                    movements={[...movements].reverse()}
                    unidad={product?.unidad ?? ''}
                    moneda={monedaDoc}
                    monedaBase={monedaBase}
                    stockActual={product?.stock ?? 0}
                    costoUnitario={costoUltimaEntrada}
                />
            )}

            {/* Historial */}
            {!isNew && <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex justify-between items-center flex-wrap gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-gray-800">Historial de movimientos</h2>
                            <p className="text-sm text-gray-400 mt-0.5">
                                {hayFiltrosActivos
                                    ? `${movimientosFiltrados.length} de ${movements.length} registros`
                                    : `${movements.length} registros · haz clic para ver detalle`}
                            </p>
                        </div>
                        <button
                            onClick={()=>{setMostrarFiltros(v=>!v);}}
                            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors cursor-pointer ${hayFiltrosActivos?'border-blue-300 bg-blue-50 text-blue-600':'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
                        >
                            <Filter size={14}/>
                            Filtros
                            {hayFiltrosActivos&&<span className="w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">!</span>}
                        </button>
                    </div>

                    {mostrarFiltros&&(
                        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Tipo</label>
                                <select value={filtroTipo} onChange={e=>{setFiltroTipo(e.target.value);setPagina(1);}} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                    <option value="todos">Todos</option>
                                    <option value="ENTRADA">Entrada</option>
                                    <option value="SALIDA">Consumo / Salida</option>
                                    <option value="AJUSTE_POSITIVO">Ajuste +</option>
                                    <option value="AJUSTE_NEGATIVO">Ajuste −</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Desde</label>
                                <input type="date" value={filtroDesde} onChange={e=>{setFiltroDesde(e.target.value);setPagina(1);}} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Hasta</label>
                                <input type="date" value={filtroHasta} onChange={e=>{setFiltroHasta(e.target.value);setPagina(1);}} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Referencia / Proveedor</label>
                                <input type="text" value={filtroBusqueda} onChange={e=>{setFiltroBusqueda(e.target.value);setPagina(1);}} placeholder="Buscar..." className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                            </div>
                            {hayFiltrosActivos&&(
                                <div className="col-span-full flex justify-end">
                                    <button onClick={()=>{setFiltroTipo('todos');setFiltroDesde('');setFiltroHasta('');setFiltroBusqueda('');setPagina(1);}} className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 cursor-pointer"><X size={12}/> Limpiar filtros</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead><tr className="bg-gray-50/50 border-b border-gray-100">
                            {['Fecha','Tipo','Referencia','Proveedor / Obra','Almacén','Cant.',`Costo (${monedaDoc})`,monedaDoc !== monedaBase ? `≈ ${monedaBase}` : null,'Saldo','Usuario',''].filter(Boolean).map(h=>(
                                <th key={h!} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr></thead>
                        <tbody className="divide-y divide-gray-50">
                            {movPagina.length===0
                                ? <tr><td colSpan={11} className="px-6 py-10 text-center text-gray-400">{hayFiltrosActivos?'Sin resultados con estos filtros.':'No hay movimientos.'}</td></tr>
                                : movPagina.map(mov=>{
                                    const isPos=['ENTRADA','AJUSTE_POSITIVO'].includes(mov.tipoMovimiento);
                                    const contacto=mov.proveedor?.nombre||mov.clienteNombre;
                                    const mDoc = mov.moneda || monedaDoc;
                                    const mTc = mov.tipoCambio ?? tipoCambioProducto;
                                    const costoVal = Number(mov.costoUnitario);
                                    const costoBase = convertirABase(costoVal, mDoc, monedaBase, mTc);
                                    return(<tr key={mov.id} className="hover:bg-blue-50/40 transition-colors group">
                                        <td onClick={()=>setSelectedMov(mov)} className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap cursor-pointer">{new Date(mov.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}</td>
                                        <td onClick={()=>setSelectedMov(mov)} className="px-4 py-3 cursor-pointer">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${tipoColor(mov.tipoMovimiento)}`}>{tipoLabel(mov.tipoMovimiento)}</span>
                                            {/* Badge si la moneda del movimiento difiere del producto */}
                                            {mDoc !== monedaDoc && (
                                                <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-600">{mDoc}</span>
                                            )}
                                        </td>
                                        <td onClick={()=>setSelectedMov(mov)} className="px-4 py-3 text-sm text-gray-700 max-w-[140px] truncate cursor-pointer" title={mov.referencia||''}>{mov.referencia||'—'}</td>
                                        <td onClick={()=>setSelectedMov(mov)} className="px-4 py-3 text-sm cursor-pointer">{contacto?<span className="flex items-center gap-1.5 text-gray-700">{mov.proveedor?<Building2 size={13} className="text-blue-400 flex-shrink-0"/>:<User size={13} className="text-green-400 flex-shrink-0"/>}{contacto}</span>:<span className="text-gray-300">—</span>}</td>
                                        <td onClick={()=>setSelectedMov(mov)} className="px-4 py-3 text-sm text-gray-500 cursor-pointer">{mov.almacen?.nombre}</td>
                                        <td onClick={()=>setSelectedMov(mov)} className={`px-4 py-3 text-sm font-bold text-right cursor-pointer ${isPos?'text-green-600':'text-red-500'}`}>{isPos?'+':'-'}{mov.cantidad}</td>
                                        {/* Costo en moneda doc */}
                                        <td onClick={()=>setSelectedMov(mov)} className="px-4 py-3 text-sm text-gray-700 text-right cursor-pointer whitespace-nowrap">
                                            {fmt(costoVal, mDoc)}
                                        </td>
                                        {/* Equivalente en moneda base (columna condicional) */}
                                        {monedaDoc !== monedaBase && (
                                            <td onClick={()=>setSelectedMov(mov)} className="px-4 py-3 text-xs text-gray-400 text-right cursor-pointer whitespace-nowrap">
                                                {costoBase !== null ? fmtBase(costoBase) : <span className="text-gray-200">—</span>}
                                                {mTc && <span className="block text-[10px] text-gray-300">TC {mTc.toFixed(2)}</span>}
                                            </td>
                                        )}
                                        <td onClick={()=>setSelectedMov(mov)} className="px-4 py-3 text-sm font-semibold text-gray-800 text-right cursor-pointer">{mov.saldo} <span className="text-xs font-normal text-gray-400">{product?.unidad}</span></td>
                                        <td onClick={()=>setSelectedMov(mov)} className="px-4 py-3 text-sm text-gray-500 cursor-pointer">{mov.usuario?.nombre}</td>
                                        <td className="px-3 py-3 text-right">
                                            {mov.tipoMovimiento==='ENTRADA'&&(
                                                <button
                                                    title="Repetir esta entrada"
                                                    onClick={e=>{e.stopPropagation();router.push(`/dashboard/purchases/new?productoId=${product?.id}`);}}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg cursor-pointer"
                                                >
                                                    <RefreshCw size={13}/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>);
                                })
                            }
                        </tbody>
                    </table>
                </div>

                {movimientosFiltrados.length > POR_PAGINA && (
                    <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                            Mostrando {(paginaActual-1)*POR_PAGINA+1}–{Math.min(paginaActual*POR_PAGINA,movimientosFiltrados.length)} de {movimientosFiltrados.length}
                        </p>
                        <div className="flex items-center gap-1">
                            <button onClick={()=>setPagina(p=>Math.max(1,p-1))} disabled={paginaActual===1} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronLeft size={16}/></button>
                            {Array.from({length:totalPaginas},(_,i)=>i+1).filter(n=>n===1||n===totalPaginas||Math.abs(n-paginaActual)<=1).reduce((acc:number[],n,i,arr)=>{if(i>0&&n-arr[i-1]>1)acc.push(-1);acc.push(n);return acc;},[]).map((n,i)=>
                                n===-1
                                    ? <span key={`ellipsis-${i}`} className="px-1 text-gray-300 text-sm">…</span>
                                    : <button key={n} onClick={()=>setPagina(n)} className={`w-7 h-7 text-xs rounded-lg cursor-pointer transition-colors ${n===paginaActual?'bg-blue-600 text-white font-semibold':'text-gray-600 hover:bg-gray-100'}`}>{n}</button>
                            )}
                            <button onClick={()=>setPagina(p=>Math.min(totalPaginas,p+1))} disabled={paginaActual===totalPaginas} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronRight size={16}/></button>
                        </div>
                    </div>
                )}
            </div>}

            {/* Modal detalle movimiento */}
            {!isNew && selectedMov&&(
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setSelectedMov(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e=>e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${tipoColor(selectedMov.tipoMovimiento)}`}>{tipoLabel(selectedMov.tipoMovimiento)}</span>
                                <h3 className="text-lg font-bold text-gray-900 mt-2">{selectedMov.referencia||'Sin referencia'}</h3>
                            </div>
                            <button onClick={()=>setSelectedMov(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={20}/></button>
                        </div>
                        <div className="space-y-0">
                            {(() => {
                                const mDocMov = selectedMov.moneda || monedaDoc;
                                const mTcMov = selectedMov.tipoCambio ?? tipoCambioProducto;
                                const costoUnitMov = Number(selectedMov.costoUnitario);
                                const costoTotalMov = Number(selectedMov.cantidad) * costoUnitMov;
                                const costoUnitBase = convertirABase(costoUnitMov, mDocMov, monedaBase, mTcMov);
                                const costoTotalBase = convertirABase(costoTotalMov, mDocMov, monedaBase, mTcMov);
                                const rows: [string, string | React.ReactElement][] = [
                                    ['Producto', product?.nombre ?? ''],
                                    ['Fecha', new Date(selectedMov.fecha).toLocaleString('es-MX',{dateStyle:'long',timeStyle:'short'})],
                                    ['Almacén', selectedMov.almacen?.nombre],
                                    ['Cantidad', `${['ENTRADA','AJUSTE_POSITIVO'].includes(selectedMov.tipoMovimiento)?'+':'-'}${selectedMov.cantidad} ${product?.unidad}`],
                                    ['Moneda movimiento', mDocMov],
                                    ['Costo unitario', (
                                        <span>
                                            {fmt(costoUnitMov, mDocMov)}
                                            {costoUnitBase !== null && mDocMov !== monedaBase && (
                                                <span className="block text-xs text-gray-400">≈ {fmtBase(costoUnitBase)} {monedaBase}</span>
                                            )}
                                        </span>
                                    )],
                                    ['Costo total', (
                                        <span>
                                            {fmt(costoTotalMov, mDocMov)}
                                            {costoTotalBase !== null && mDocMov !== monedaBase && (
                                                <span className="block text-xs text-gray-400">≈ {fmtBase(costoTotalBase)} {monedaBase}</span>
                                            )}
                                        </span>
                                    )],
                                    ...(mTcMov && mDocMov !== monedaBase ? [['Tipo de cambio', `1 ${mDocMov} = ${mTcMov.toFixed(4)} ${monedaBase}`] as [string, string]] : []),
                                    ['Saldo después', `${selectedMov.saldo} ${product?.unidad}`],
                                    ...(selectedMov.proveedor ? [
                                        ['Proveedor', selectedMov.proveedor.nombre],
                                        ...(selectedMov.proveedor.telefono ? [['Tel.', selectedMov.proveedor.telefono] as [string,string]] : []),
                                        ...(selectedMov.proveedor.email ? [['Email', selectedMov.proveedor.email] as [string,string]] : []),
                                    ] as [string, string][] : []),
                                    ...(selectedMov.clienteNombre ? [['Cliente', selectedMov.clienteNombre] as [string, string]] : []),
                                    ['Registrado por', selectedMov.usuario?.nombre],
                                ];
                                return rows.map(([l, v]) => (
                                    <div key={l} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                                        <span className="text-sm text-gray-500">{l}</span>
                                        <span className="text-sm font-medium text-gray-800 text-right max-w-[220px]">{v}</span>
                                    </div>
                                ));
                            })()}
                        </div>
                        <button onClick={()=>setSelectedMov(null)} className="mt-5 w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cerrar</button>
                    </div>
                </div>
            )}

            {/* Modal Entrada / Salida / Ajuste */}
            {movModal && product && (
                <MovimientoModal
                    producto={{
                        id: product.id,
                        nombre: product.nombre,
                        sku: product.sku,
                        unidad: product.unidad,
                        stock: product.stock,
                        ultimoPrecioCompra: product.ultimoPrecioCompra,
                        ultimoPrecioVenta: product.ultimoPrecioVenta,
                    }}
                    tipo={movModal}
                    onClose={() => setMovModal(null)}
                    onDone={async () => {
                        setMovModal(null);
                        try {
                            const [prod, movs, products] = await Promise.all([
                                fetchApi(`/products/${id}`),
                                fetchApi(`/inventory/kardex/${id}`),
                                fetchApi('/products'),
                            ]);
                            let saldo = 0;
                            const movsWithBalance = [...movs]
                                .sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
                                .map((m: any) => { saldo += ['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipoMovimiento) ? Number(m.cantidad) : -Number(m.cantidad); return { ...m, saldo }; });
                            const fp = products.find((p: any) => p.id === id);
                            setProduct({ ...prod, stock: fp?.stock ?? 0, ultimoPrecioCompra: fp?.ultimoPrecioCompra, ultimoPrecioVenta: fp?.ultimoPrecioVenta, moneda: fp?.moneda || prod.moneda, ultimaEntrada: fp?.ultimaEntrada || prod.ultimaEntrada });
                            setMovements([...movsWithBalance].reverse());
                        } catch (e) { console.error(e); }
                    }}
                />
            )}
        </div>
    );
}
