"use client";
/**
 * FiscalFields — Sección de datos fiscales CFDI reutilizable.
 * Se usa en: Settings (Empresa), Proveedores (modal), Clientes (modal).
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface FiscalData {
    rfc:           string;
    razonSocial:   string;
    codigoPostal:  string;
    regimenFiscal: string;
    usoCFDI:       string;
}

export const EMPTY_FISCAL: FiscalData = {
    rfc: '', razonSocial: '', codigoPostal: '', regimenFiscal: '', usoCFDI: '',
};

// Catálogos SAT simplificados
export const REGIMENES_FISCALES = [
    { code: '601', label: '601 - General de Ley Personas Morales' },
    { code: '603', label: '603 - Personas Morales con Fines no Lucrativos' },
    { code: '605', label: '605 - Sueldos y Salarios e Ingresos Asimilados' },
    { code: '606', label: '606 - Arrendamiento' },
    { code: '607', label: '607 - Régimen de Enajenación o Adquisición de Bienes' },
    { code: '608', label: '608 - Demás Ingresos' },
    { code: '610', label: '610 - Residentes en el Extranjero sin Establecimiento' },
    { code: '611', label: '611 - Ingresos por Dividendos (socios y accionistas)' },
    { code: '612', label: '612 - Personas Físicas con Actividades Empresariales y Profesionales' },
    { code: '614', label: '614 - Ingresos por intereses' },
    { code: '615', label: '615 - Régimen de los ingresos por obtención de premios' },
    { code: '616', label: '616 - Sin obligaciones fiscales' },
    { code: '620', label: '620 - Sociedades Cooperativas de Producción' },
    { code: '621', label: '621 - Incorporación Fiscal' },
    { code: '622', label: '622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
    { code: '623', label: '623 - Opcional para Grupos de Sociedades' },
    { code: '624', label: '624 - Coordinados' },
    { code: '625', label: '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas' },
    { code: '626', label: '626 - Régimen Simplificado de Confianza (RESICO)' },
];

export const USOS_CFDI = [
    { code: 'G01', label: 'G01 - Adquisición de mercancias' },
    { code: 'G02', label: 'G02 - Devoluciones, descuentos o bonificaciones' },
    { code: 'G03', label: 'G03 - Gastos en general' },
    { code: 'I01', label: 'I01 - Construcciones' },
    { code: 'I02', label: 'I02 - Mobilario y equipo de oficina por inversiones' },
    { code: 'I03', label: 'I03 - Equipo de transporte' },
    { code: 'I04', label: 'I04 - Equipo de computo y accesorios' },
    { code: 'I05', label: 'I05 - Dados, troqueles, moldes, matrices y herramental' },
    { code: 'I06', label: 'I06 - Comunicaciones telefónicas' },
    { code: 'I07', label: 'I07 - Comunicaciones satelitales' },
    { code: 'I08', label: 'I08 - Otra maquinaria y equipo' },
    { code: 'D01', label: 'D01 - Honorarios médicos, dentales y gastos hospitalarios' },
    { code: 'D02', label: 'D02 - Gastos médicos por incapacidad o discapacidad' },
    { code: 'D03', label: 'D03 - Gastos funerales' },
    { code: 'D04', label: 'D04 - Donativos' },
    { code: 'D05', label: 'D05 - Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)' },
    { code: 'D06', label: 'D06 - Aportaciones voluntarias al SAR' },
    { code: 'D07', label: 'D07 - Primas por seguros de gastos médicos' },
    { code: 'D08', label: 'D08 - Gastos de transportación escolar obligatoria' },
    { code: 'D09', label: 'D09 - Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones' },
    { code: 'D10', label: 'D10 - Pagos por servicios educativos (colegiaturas)' },
    { code: 'S01', label: 'S01 - Sin efectos fiscales' },
    { code: 'CP01', label: 'CP01 - Pagos' },
    { code: 'CN01', label: 'CN01 - Nómina' },
];

// Validar RFC mexicano
export function validateRFC(rfc: string): { valid: boolean; msg: string } {
    if (!rfc) return { valid: true, msg: '' };
    const clean = rfc.trim().toUpperCase();
    if (clean.length < 12 || clean.length > 13)
        return { valid: false, msg: 'El RFC debe tener 12 (persona moral) o 13 (persona física) caracteres' };
    const regex = /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/;
    if (!regex.test(clean))
        return { valid: false, msg: 'Formato inválido. Ej: XAXX010101000 o AAA010101AA1' };
    return { valid: true, msg: '✓ RFC válido' };
}

interface Props {
    data: FiscalData;
    onChange: (field: keyof FiscalData, value: string) => void;
    collapsed?: boolean;   // si se muestra colapsado por defecto
    inputClass?: string;   // clase extra para inputs
}

export default function FiscalFields({ data, onChange, collapsed = true, inputClass = '' }: Props) {
    const [open, setOpen] = useState(!collapsed);
    const rfcResult = validateRFC(data.rfc);
    const base = `w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${inputClass}`;
    const hasDatos = data.rfc || data.razonSocial || data.codigoPostal || data.regimenFiscal || data.usoCFDI;

    return (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
            {/* Header colapsable */}
            <button type="button" onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                <div className="flex items-center gap-2">
                    <FileText size={15} className="text-blue-500" />
                    <span className="text-sm font-semibold text-gray-700">Datos fiscales CFDI</span>
                    {hasDatos && !open && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">Completado</span>
                    )}
                    {!hasDatos && !open && (
                        <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Opcional</span>
                    )}
                </div>
                {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
            </button>

            {open && (
                <div className="p-4 space-y-4 bg-white">
                    <p className="text-xs text-gray-400">
                        Estos datos se usarán para generar facturas CFDI. RFC en mayúsculas, sin guiones ni espacios.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* RFC */}
                        <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                                RFC <span className="text-gray-400 font-normal">(sin guiones)</span>
                            </label>
                            <input
                                type="text"
                                value={data.rfc}
                                onChange={e => onChange('rfc', e.target.value.toUpperCase())}
                                placeholder="XAXX010101000"
                                maxLength={13}
                                className={`${base} font-mono uppercase ${data.rfc && !rfcResult.valid ? 'border-red-300 focus:ring-red-200' : data.rfc && rfcResult.valid ? 'border-green-300' : ''}`}
                            />
                            {data.rfc && (
                                <div className={`flex items-center gap-1 mt-1 text-xs ${rfcResult.valid ? 'text-green-600' : 'text-red-500'}`}>
                                    {rfcResult.valid
                                        ? <CheckCircle2 size={11} />
                                        : <AlertCircle size={11} />}
                                    {rfcResult.msg}
                                </div>
                            )}
                        </div>

                        {/* Código Postal */}
                        <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                                Código Postal fiscal
                            </label>
                            <input
                                type="text"
                                value={data.codigoPostal}
                                onChange={e => onChange('codigoPostal', e.target.value)}
                                placeholder="06600"
                                maxLength={5}
                                className={base}
                            />
                        </div>

                        {/* Razón Social */}
                        <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                                Razón Social <span className="text-gray-400 font-normal">(como aparece en constancia fiscal)</span>
                            </label>
                            <input
                                type="text"
                                value={data.razonSocial}
                                onChange={e => onChange('razonSocial', e.target.value.toUpperCase())}
                                placeholder="EMPRESA EJEMPLO SA DE CV"
                                className={`${base} uppercase`}
                            />
                        </div>

                        {/* Régimen Fiscal */}
                        <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Régimen Fiscal</label>
                            <select
                                value={data.regimenFiscal}
                                onChange={e => onChange('regimenFiscal', e.target.value)}
                                className={base}>
                                <option value="">Seleccionar régimen...</option>
                                {REGIMENES_FISCALES.map(r => (
                                    <option key={r.code} value={r.code}>{r.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Uso CFDI */}
                        <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Uso del CFDI</label>
                            <select
                                value={data.usoCFDI}
                                onChange={e => onChange('usoCFDI', e.target.value)}
                                className={base}>
                                <option value="">Seleccionar uso...</option>
                                {USOS_CFDI.map(u => (
                                    <option key={u.code} value={u.code}>{u.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
