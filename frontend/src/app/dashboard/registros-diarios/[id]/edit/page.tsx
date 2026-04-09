"use client";

import { useEffect, useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { RegistroFormInner } from '../../RegistroForm';

function EditRegistroInner() {
    const params = useParams<{ id: string }>();
    const id     = params.id;

    const [initialValues, setInitialValues] = useState<Record<string, string | boolean> | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchApi(`/registros-diarios/${id}`)
            .then((r: any) => {
                setInitialValues({
                    equipoId:            r.equipo?.id             ?? '',
                    obraId:              r.obra?.id               ?? '',
                    fecha:               r.fecha?.slice(0, 10)    ?? '',
                    horometroInicio:     String(r.horometroInicio  ?? ''),
                    horometroFin:        String(r.horometroFin     ?? ''),
                    barrenos:            String(r.barrenos         ?? ''),
                    metrosLineales:      String(r.metrosLineales   ?? ''),
                    litrosDiesel:        String(r.litrosDiesel     ?? ''),
                    precioDiesel:        String(r.precioDiesel     ?? '21.95'),
                    tanqueInicio:        r.tanqueInicio        != null ? String(r.tanqueInicio)        : '',
                    litrosTanqueInicio:  r.litrosTanqueInicio  != null ? String(r.litrosTanqueInicio)  : '',
                    tanqueFin:           r.tanqueFin           != null ? String(r.tanqueFin)           : '',
                    litrosTanqueFin:     r.litrosTanqueFin     != null ? String(r.litrosTanqueFin)     : '',
                    operadores:          String(r.operadores        ?? 1),
                    peones:              String(r.peones            ?? 0),
                    obraNombre:          r.obraNombre              ?? '',
                    notas:               r.notas                   ?? '',
                    registrarDieselEnKardex: false, // en edición no se retoca el kardex automáticamente
                    bordo:               r.bordo               != null ? String(r.bordo)               : '',
                    espaciamiento:       r.espaciamiento        != null ? String(r.espaciamiento)       : '',
                    volumenRoca:         r.volumenRoca          != null ? String(r.volumenRoca)         : '',
                    porcentajePerdida:   r.porcentajePerdida    != null ? String(r.porcentajePerdida)   : '',
                    profundidadPromedio: r.profundidadPromedio  != null ? String(r.profundidadPromedio) : '',
                    porcentajeAvance:    r.porcentajeAvance     != null ? String(r.porcentajeAvance)    : '',
                    rentaEquipoDiaria:   r.rentaEquipoDiaria    != null ? String(r.rentaEquipoDiaria)   : '',
                });
            })
            .catch(() => setError('No se pudo cargar el registro'));
    }, [id]);

    if (error) {
        return (
            <div className="max-w-3xl mx-auto p-8 text-center">
                <p className="text-red-600 font-medium">{error}</p>
            </div>
        );
    }

    if (!initialValues) {
        return <div className="p-10 text-center text-gray-400 text-sm">Cargando registro...</div>;
    }

    return (
        <RegistroFormInner
            mode="edit"
            registroId={id}
            initialValues={initialValues as any}
        />
    );
}

export default function EditRegistroDiarioPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center text-gray-400">Cargando...</div>}>
            <EditRegistroInner/>
        </Suspense>
    );
}
