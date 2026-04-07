// src/app/api/componentes/route.ts
import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

// ─── GET /api/componentes ─────────────────────────────────────────────────────
// Query params:
//   equipoId  — filtra componentes instalados en ese equipo
//   sinEquipo — "true" → solo componentes en taller/almacén (equipoActualId IS NULL)
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { searchParams } = new URL(req.url);
        const equipoId   = searchParams.get('equipoId')   || undefined;
        const sinEquipo  = searchParams.get('sinEquipo')  === 'true';

        const componentes = await prisma.componente.findMany({
            where: {
                empresaId: user.empresaId,
                ...(equipoId  && { equipoActualId: equipoId }),
                ...(sinEquipo && { equipoActualId: null }),
            },
            orderBy: { nombre: 'asc' },
            include: {
                equipoActual: { select: { id: true, nombre: true, numeroEconomico: true } },
                historial: {
                    orderBy: { fecha: 'desc' },
                    take: 1, // último movimiento para mostrar en lista
                    include: {
                        equipo: { select: { nombre: true, numeroEconomico: true } },
                    },
                },
            },
        });

        return Response.json(componentes.map(serializeComponente));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener componentes' }, { status: 500 });
    }
}

// ─── POST /api/componentes ────────────────────────────────────────────────────
// Crea un componente nuevo. Si se indica equipoActualId, lo registra como
// instalado y crea el primer MovimientoComponente de tipo INSTALACION.
export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const {
            nombre,
            serie,
            tipo,
            notas,
            equipoActualId,      // opcional — si viene, se instala directamente
            fechaMovimiento,     // requerido cuando equipoActualId viene
            notasMovimiento,     // requerido cuando equipoActualId viene
        } = await req.json();

        if (!nombre)
            return Response.json({ error: 'El nombre del componente es requerido' }, { status: 400 });

        if (equipoActualId && !notasMovimiento)
            return Response.json(
                { error: 'notasMovimiento es requerido cuando se especifica equipoActualId' },
                { status: 400 }
            );

        // Verificar equipo si viene
        if (equipoActualId) {
            const equipo = await prisma.equipo.findFirst({
                where: { id: equipoActualId, empresaId: user.empresaId },
            });
            if (!equipo)
                return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });
        }

        const componente = await prisma.$transaction(async (tx) => {
            const nuevo = await tx.componente.create({
                data: {
                    empresaId:      user.empresaId,
                    nombre,
                    serie:          serie          || null,
                    tipo:           tipo           || null,
                    notas:          notas          || null,
                    equipoActualId: equipoActualId || null,
                },
                include: {
                    equipoActual: { select: { id: true, nombre: true, numeroEconomico: true } },
                    historial:    { orderBy: { fecha: 'desc' }, take: 1 },
                },
            });

            // Crear movimiento inicial si se indica equipo
            if (equipoActualId) {
                await tx.movimientoComponente.create({
                    data: {
                        componenteId: nuevo.id,
                        equipoId:     equipoActualId,
                        fecha:        fechaMovimiento ? new Date(fechaMovimiento) : new Date(),
                        tipo:         'INSTALACION',
                        notas:        notasMovimiento,
                    },
                });
            }

            return nuevo;
        });

        return Response.json(serializeComponente(componente), { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al crear el componente' }, { status: 500 });
    }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function serializeComponente(c: any) {
    return {
        ...c,
        ubicacion: c.equipoActual
            ? `${c.equipoActual.nombre}${c.equipoActual.numeroEconomico ? ` (${c.equipoActual.numeroEconomico})` : ''}`
            : 'Taller / Almacén',
    };
}
