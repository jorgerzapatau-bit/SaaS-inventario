"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RegistroFormInner } from '../RegistroForm';

function NuevoRegistroInner() {
    const searchParams  = useSearchParams();
    const equipoIdParam = searchParams.get('equipoId') ?? '';
    const obraIdParam   = searchParams.get('obraId')   ?? '';

    // Soporte para duplicar: los valores copiados vienen en base64
    let copiaValues = {};
    const copiaParam = searchParams.get('copia');
    if (copiaParam) {
        try {
            const decoded = JSON.parse(atob(copiaParam));
            copiaValues = {
                barrenos:            decoded.barrenos            != null ? String(decoded.barrenos)            : '',
                metrosLineales:      decoded.metrosLineales      != null ? String(decoded.metrosLineales)      : '',
                litrosDiesel:        decoded.litrosDiesel        != null ? String(decoded.litrosDiesel)        : '',
                precioDiesel:        decoded.precioDiesel        != null ? String(decoded.precioDiesel)        : '21.95',
                operadores:          decoded.operadores          != null ? String(decoded.operadores)          : '1',
                peones:              decoded.peones              != null ? String(decoded.peones)              : '0',
                horometroInicio:     decoded.horometroInicio     != null ? String(decoded.horometroInicio)     : '',
                bordo:               decoded.bordo               != null ? String(decoded.bordo)               : '',
                espaciamiento:       decoded.espaciamiento       != null ? String(decoded.espaciamiento)       : '',
                profundidadPromedio: decoded.profundidadPromedio != null ? String(decoded.profundidadPromedio) : '',
                rentaEquipoDiaria:   decoded.rentaEquipoDiaria   != null ? String(decoded.rentaEquipoDiaria)   : '',
            };
        } catch { /* ignorar si el base64 está corrupto */ }
    }

    return (
        <RegistroFormInner
            mode="new"
            equipoIdParam={equipoIdParam}
            obraIdParam={obraIdParam}
            initialValues={copiaValues}
        />
    );
}

export default function NuevoRegistroDiarioPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center text-gray-400">Cargando...</div>}>
            <NuevoRegistroInner/>
        </Suspense>
    );
}
