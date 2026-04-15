"use client";
import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import { Building2, Warehouse, Tag, Plus, Pencil, Trash2, Check, X, Save, AlertTriangle, Upload, Image } from 'lucide-react';
import FiscalFields, { FiscalData, EMPTY_FISCAL } from '@/components/ui/FiscalFields';

// ── Logo compression (same as product images but wider: 400×160px) ────────────
const MAX_LOGO_BYTES = 200 * 1024; // 200KB
async function compressLogo(file: File): Promise<{ base64: string; error?: string }> {
    return new Promise(resolve => {
        if (!file.type.startsWith('image/')) { resolve({ base64: '', error: 'Debe ser imagen JPG, PNG o WebP' }); return; }
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            const MAX_W = 400, MAX_H = 160;
            let { width: w, height: h } = img;
            if (w > MAX_W || h > MAX_H) {
                const ratio = Math.min(MAX_W / w, MAX_H / h);
                w = Math.round(w * ratio); h = Math.round(h * ratio);
            }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
            let q = 0.9, b64 = canvas.toDataURL('image/png');
            // try jpeg if png too large
            if (b64.length * 0.75 > MAX_LOGO_BYTES) {
                q = 0.85; b64 = canvas.toDataURL('image/jpeg', q);
                while (b64.length * 0.75 > MAX_LOGO_BYTES && q > 0.3) { q -= 0.1; b64 = canvas.toDataURL('image/jpeg', q); }
            }
            if (b64.length * 0.75 > MAX_LOGO_BYTES) resolve({ base64: '', error: 'Imagen demasiado grande. Usa una más pequeña.' });
            else resolve({ base64: b64 });
        };
        img.onerror = () => resolve({ base64: '', error: 'No se pudo leer la imagen' });
        img.src = url;
    });
}

// ── Login background compression (máx 800px, 300KB) ──────────────────────────
const MAX_BG_BYTES = 300 * 1024;
async function compressBg(file: File): Promise<{ base64: string; error?: string }> {
    return new Promise(resolve => {
        if (!file.type.startsWith('image/')) { resolve({ base64: '', error: 'Debe ser imagen JPG, PNG o WebP' }); return; }
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const MAX = 800;
            let { width: w, height: h } = img;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else { w = Math.round(w * MAX / h); h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
            let q = 0.85, b64 = canvas.toDataURL('image/jpeg', q);
            while (b64.length * 0.75 > MAX_BG_BYTES && q > 0.3) { q -= 0.1; b64 = canvas.toDataURL('image/jpeg', q); }
            if (b64.length * 0.75 > MAX_BG_BYTES) resolve({ base64: '', error: 'Imagen demasiado grande. Usa una más pequeña.' });
            else resolve({ base64: b64 });
        };
        img.onerror = () => resolve({ base64: '', error: 'No se pudo leer la imagen' });
        img.src = url;
    });
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface CompanySettings {
    nombre: string; url: string; logo: string; loginBg: string;
    telefono: string; whatsapp: string; email: string;
    direccion: string; rfc: string;
    razonSocial: string; codigoPostal: string; regimenFiscal: string; usoCFDI: string;
    moneda: string;
}
interface Almacen { id: string; nombre: string; }
interface Categoria { id: string; nombre: string; descripcion?: string | null; }

// ── Lista editable con descripción opcional ───────────────────────────────────
function ListaEditable({
    titulo, descripcion: desc, items, onAdd, onEdit, onDelete,
    placeholder, color, hasDescription = false, descPlaceholder = ''
}: {
    titulo: string; descripcion: string;
    items: Categoria[];
    onAdd: (nombre: string, descripcion?: string) => Promise<void>;
    onEdit: (id: string, nombre: string, descripcion?: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    placeholder: string; color: string;
    hasDescription?: boolean; descPlaceholder?: string;
}) {
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState('');
    const [deleting, setDeleting] = useState('');
    const [error, setError] = useState('');

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setSaving('new'); setError('');
        try { await onAdd(newName.trim(), newDesc.trim() || undefined); setNewName(''); setNewDesc(''); setAdding(false); }
        catch (e: any) { setError(e.message || 'Error al agregar'); }
        finally { setSaving(''); }
    };

    const handleEdit = async (id: string) => {
        if (!editName.trim()) return;
        setSaving(id); setError('');
        try { await onEdit(id, editName.trim(), editDesc.trim() || undefined); setEditingId(null); }
        catch (e: any) { setError(e.message || 'Error al editar'); }
        finally { setSaving(''); }
    };

    const handleDelete = async (id: string) => {
        setDeleting(id); setError('');
        try { await onDelete(id); }
        catch (e: any) { setError(e.message || 'No se puede eliminar — tiene registros asociados'); }
        finally { setDeleting(''); }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
                <div>
                    <h3 className="text-base font-semibold text-gray-800">{titulo}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                </div>
                <button onClick={() => { setAdding(true); setNewName(''); setNewDesc(''); setError(''); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors ${color}`}>
                    <Plus size={14}/> Agregar
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                    <AlertTriangle size={14}/> {error}
                </div>
            )}

            {/* Fila de nuevo item */}
            {adding && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                        <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !hasDescription) handleAdd(); if (e.key === 'Escape') setAdding(false); }}
                            placeholder={placeholder}
                            className="flex-1 px-3 py-1.5 text-sm border border-blue-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                        <button onClick={handleAdd} disabled={saving === 'new'}
                            className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60">
                            <Check size={14}/>
                        </button>
                        <button onClick={() => setAdding(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md">
                            <X size={14}/>
                        </button>
                    </div>
                    {hasDescription && (
                        <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                            placeholder={descPlaceholder}
                            className="w-full px-3 py-1.5 text-xs border border-blue-200 rounded-md bg-white text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                    )}
                </div>
            )}

            {/* Lista */}
            {items.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg">
                    No hay {titulo.toLowerCase()} registrados. Agrega el primero.
                </div>
            ) : (
                <div className="divide-y divide-gray-50">
                    {items.map(item => (
                        <div key={item.id} className="py-3 group">
                            {editingId === item.id ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input autoFocus type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !hasDescription) handleEdit(item.id); if (e.key === 'Escape') setEditingId(null); }}
                                            className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                        <button onClick={() => handleEdit(item.id)} disabled={saving === item.id}
                                            className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60">
                                            <Check size={14}/>
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md">
                                            <X size={14}/>
                                        </button>
                                    </div>
                                    {hasDescription && (
                                        <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleEdit(item.id); }}
                                            placeholder={descPlaceholder}
                                            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800">{item.nombre}</p>
                                        {hasDescription && item.descripcion && (
                                            <p className="text-xs text-gray-400 mt-0.5 truncate">{item.descripcion}</p>
                                        )}
                                        {hasDescription && !item.descripcion && (
                                            <p className="text-xs text-gray-300 mt-0.5 italic">Sin descripción</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <button onClick={() => { setEditingId(item.id); setEditName(item.nombre); setEditDesc(item.descripcion || ''); setError(''); }}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                                            <Pencil size={13}/>
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40">
                                            <Trash2 size={13}/>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-50">
                {items.length} {titulo.toLowerCase()} registrado{items.length !== 1 ? 's' : ''}
            </p>
        </div>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
type Tab = 'empresa' | 'almacenes' | 'categorias';

export default function SettingsPage() {
    const [tab, setTab] = useState<Tab>('empresa');
    const [loading, setLoading] = useState(true);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const bgInputRef   = useRef<HTMLInputElement>(null);

    const [settings, setSettings] = useState<CompanySettings>({
        nombre: '', url: '', logo: '', loginBg: '', telefono: '', whatsapp: '', email: '', direccion: '', rfc: '',
        razonSocial: '', codigoPostal: '', regimenFiscal: '', usoCFDI: '', moneda: 'MXN'
    });
    const [saving, setSaving]           = useState(false);
    const [saveMsg, setSaveMsg]         = useState('');
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoError, setLogoError]     = useState('');
    const [bgUploading, setBgUploading] = useState(false);
    const [bgError, setBgError]         = useState('');

    const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);

    useEffect(() => {
        Promise.all([
            fetchApi('/company'),
            fetchApi('/warehouse'),
            fetchApi('/categories').catch(() => []),
        ]).then(([company, alms, cats]) => {
            setSettings({
                nombre: company.nombre||'', url: company.url||'', logo: company.logo||'', loginBg: company.loginBg||'',
                telefono: company.telefono||'', whatsapp: company.whatsapp||'', email: company.email||'',
                direccion: company.direccion||'', rfc: company.rfc||'',
                razonSocial: company.razonSocial||'', codigoPostal: company.codigoPostal||'',
                regimenFiscal: company.regimenFiscal||'', usoCFDI: company.usoCFDI||'',
                moneda: company.moneda||'MXN',
            });
            setAlmacenes(alms);
            setCategorias(cats);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const handleLogoFile = async (file: File) => {
        setLogoError(''); setLogoUploading(true);
        const { base64, error } = await compressLogo(file);
        setLogoUploading(false);
        if (error) { setLogoError(error); return; }
        setSettings(s => ({ ...s, logo: base64 }));
    };

    const handleBgFile = async (file: File) => {
        setBgError(''); setBgUploading(true);
        const { base64, error } = await compressBg(file);
        setBgUploading(false);
        if (error) { setBgError(error); return; }
        setSettings(s => ({ ...s, loginBg: base64 }));
    };

    const handleSaveCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true); setSaveMsg('');
        try {
            await fetchApi('/company', { method: 'PUT', body: JSON.stringify(settings) });
            setSaveMsg('✓ Guardado correctamente');
            setTimeout(() => setSaveMsg(''), 3000);
        } catch (err: any) {
            setSaveMsg('Error: ' + (err.message || 'No se pudo guardar'));
        } finally { setSaving(false); }
    };

    // Almacenes CRUD
    const addAlmacen = async (nombre: string) => {
        const nuevo = await fetchApi('/warehouse', { method: 'POST', body: JSON.stringify({ nombre }) });
        setAlmacenes(a => [...a, nuevo]);
    };
    const editAlmacen = async (id: string, nombre: string) => {
        const updated = await fetchApi(`/warehouse/${id}`, { method: 'PUT', body: JSON.stringify({ nombre }) });
        setAlmacenes(a => a.map(x => x.id === id ? updated : x));
    };
    const deleteAlmacen = async (id: string) => {
        await fetchApi(`/warehouse/${id}`, { method: 'DELETE' });
        setAlmacenes(a => a.filter(x => x.id !== id));
    };

    // Categorías CRUD
    const addCategoria = async (nombre: string, descripcion?: string) => {
        const nuevo = await fetchApi('/categories', { method: 'POST', body: JSON.stringify({ nombre, descripcion }) });
        setCategorias(c => [...c, nuevo]);
    };
    const editCategoria = async (id: string, nombre: string, descripcion?: string) => {
        const updated = await fetchApi(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ nombre, descripcion }) });
        setCategorias(c => c.map(x => x.id === id ? updated : x));
    };
    const deleteCategoria = async (id: string) => {
        await fetchApi(`/categories/${id}`, { method: 'DELETE' });
        setCategorias(c => c.filter(x => x.id !== id));
    };

    const TABS = [
        { key: 'empresa' as Tab,    label: 'Empresa',    icon: <Building2 size={15}/> },
        { key: 'almacenes' as Tab,  label: 'Almacenes',  icon: <Warehouse size={15}/>, badge: almacenes.length },
        { key: 'categorias' as Tab, label: 'Categorías', icon: <Tag size={15}/>,       badge: categorias.length },
    ];

    if (loading) return (
        <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3"/>
            <div className="h-64 bg-gray-100 rounded-xl"/>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Parámetros</h1>
                <p className="text-sm text-gray-500 mt-1">Configura tu empresa, almacenes y catálogos.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {t.icon} {t.label}
                        {t.badge !== undefined && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
                                {t.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Tab: Empresa ── */}
            {tab === 'empresa' && (
                <form onSubmit={handleSaveCompany} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">

                    {/* Logo upload */}
                    <div>
                        <label className="text-xs font-medium text-gray-700 block mb-2">Logo de la empresa</label>
                        <div className="flex items-start gap-4">
                            {/* Preview */}
                            <div
                                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLogoFile(f); }}
                                onDragOver={e => e.preventDefault()}
                                onClick={() => logoInputRef.current?.click()}
                                className="w-40 h-16 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all bg-gray-50">
                                {logoUploading ? (
                                    <span className="text-xs text-gray-400">Procesando...</span>
                                ) : settings.logo ? (
                                    <img src={settings.logo} alt="Logo" className="w-full h-full object-contain p-2"/>
                                ) : (
                                    <div className="text-center">
                                        <Image size={20} className="text-gray-300 mx-auto mb-1"/>
                                        <p className="text-xs text-gray-400">Clic o arrastra</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                    className="hidden" onChange={e => { if (e.target.files?.[0]) handleLogoFile(e.target.files[0]); }}/>
                                <button type="button" onClick={() => logoInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors mb-2">
                                    <Upload size={13}/> Subir imagen
                                </button>
                                {settings.logo && (
                                    <button type="button" onClick={() => setSettings(s => ({...s, logo: ''}))}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-100 rounded-lg hover:bg-red-50 text-red-500 transition-colors mb-2">
                                        <X size={13}/> Eliminar logo
                                    </button>
                                )}
                                <p className="text-xs text-gray-400">JPG · PNG · WebP · SVG · máx 200KB · 400×160px</p>
                                <p className="text-xs text-gray-400 mt-0.5">Se muestra en el sidebar y en la pantalla de login.</p>
                                {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Imagen de fondo del login */}
                    <div>
                        <label className="text-xs font-medium text-gray-700 block mb-2">Imagen de fondo del Login</label>
                        <div className="flex items-start gap-4">
                            <div
                                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleBgFile(f); }}
                                onDragOver={e => e.preventDefault()}
                                onClick={() => bgInputRef.current?.click()}
                                className="w-40 h-24 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all bg-gray-50 relative">
                                {bgUploading ? (
                                    <span className="text-xs text-gray-400">Procesando...</span>
                                ) : settings.loginBg ? (
                                    <img src={settings.loginBg} alt="Fondo login" className="w-full h-full object-cover"/>
                                ) : (
                                    <div className="text-center">
                                        <Image size={20} className="text-gray-300 mx-auto mb-1"/>
                                        <p className="text-xs text-gray-400">Clic o arrastra</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <input ref={bgInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                                    className="hidden" onChange={e => { if (e.target.files?.[0]) handleBgFile(e.target.files[0]); }}/>
                                <button type="button" onClick={() => bgInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors mb-2">
                                    <Upload size={13}/> Subir imagen
                                </button>
                                {settings.loginBg && (
                                    <button type="button" onClick={() => setSettings(s => ({...s, loginBg: ''}))}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-100 rounded-lg hover:bg-red-50 text-red-500 transition-colors mb-2">
                                        <X size={13}/> Eliminar imagen
                                    </button>
                                )}
                                <p className="text-xs text-gray-400">JPG · PNG · WebP · máx 300KB · 800px</p>
                                <p className="text-xs text-gray-400 mt-0.5">Aparece en la pantalla de inicio de sesión.</p>
                                {bgError && <p className="text-xs text-red-500 mt-1">{bgError}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Nombre de la empresa *</label>
                            <input required type="text" value={settings.nombre}
                                onChange={e => setSettings(s => ({...s, nombre: e.target.value}))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Email</label>
                            <input type="email" value={settings.email}
                                onChange={e => setSettings(s => ({...s, email: e.target.value}))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Teléfono</label>
                            <input type="text" value={settings.telefono}
                                onChange={e => setSettings(s => ({...s, telefono: e.target.value}))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">WhatsApp</label>
                            <input type="text" value={settings.whatsapp}
                                onChange={e => setSettings(s => ({...s, whatsapp: e.target.value}))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Moneda</label>
                            <select value={settings.moneda}
                                onChange={e => setSettings(s => ({...s, moneda: e.target.value}))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                                <option value="MXN">MXN — Peso mexicano ($)</option>
                                <option value="USD">USD — Dólar estadounidense ($)</option>
                                <option value="EUR">EUR — Euro (€)</option>
                                <option value="CAD">CAD — Dólar canadiense ($)</option>
                            </select>
                            <p className="text-xs text-gray-400 mt-1">Se usará en todos los valores monetarios de la aplicación.</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Slug URL</label>
                            <div className="flex border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20">
                                <span className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 whitespace-nowrap">?company=</span>
                                <input type="text" value={settings.url}
                                    onChange={e => setSettings(s => ({...s, url: e.target.value}))}
                                    className="flex-1 px-3 py-2 text-sm focus:outline-none"/>
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-medium text-gray-700 block mb-1.5">Dirección</label>
                            <textarea rows={2} value={settings.direccion}
                                onChange={e => setSettings(s => ({...s, direccion: e.target.value}))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"/>
                        </div>
                        <div className="col-span-2">
                            <FiscalFields
                                data={{ rfc: settings.rfc, razonSocial: settings.razonSocial, codigoPostal: settings.codigoPostal, regimenFiscal: settings.regimenFiscal, usoCFDI: settings.usoCFDI }}
                                onChange={(field, value) => setSettings(s => ({ ...s, [field]: value }))}
                                collapsed={false}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                        {saveMsg && <p className={`text-sm ${saveMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{saveMsg}</p>}
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors">
                            <Save size={15}/> {saving ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </div>
                </form>
            )}

            {/* ── Tab: Almacenes ── */}
            {tab === 'almacenes' && (
                <ListaEditable
                    titulo="Almacenes"
                    descripcion="Lugares físicos donde guardas tu inventario. Cada movimiento queda asociado a un almacén."
                    items={almacenes}
                    onAdd={addAlmacen}
                    onEdit={editAlmacen}
                    onDelete={deleteAlmacen}
                    placeholder="Ej: Almacén Principal, Bodega Norte..."
                    color="bg-blue-600 hover:bg-blue-700"
                />
            )}

            {/* ── Tab: Categorías ── */}
            {tab === 'categorias' && (
                <ListaEditable
                    titulo="Categorías de productos"
                    descripcion="Agrupa tus productos por tipo. La descripción ayuda a definir qué productos pertenecen a cada categoría."
                    items={categorias}
                    onAdd={addCategoria}
                    onEdit={editCategoria}
                    onDelete={deleteCategoria}
                    placeholder="Ej: Electrónicos, Consumibles..."
                    color="bg-purple-600 hover:bg-purple-700"
                    hasDescription
                    descPlaceholder="Ej: Equipos y dispositivos electrónicos como laptops, monitores y accesorios."
                />
            )}
        </div>
    );
}
