import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string; plantillaId: string }> };

// ─── GET /api/obras/[id]/plantillas/[plantillaId]/equipos ─────────────────────
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId, plantillaId } = await params;

        // Verificar que la plantilla pertenece a la obra de esta empresa
        const plantilla = await prisma.plantillaObra.findFirst({
            where: { id: plantillaId, obraId, obra: { empresaId: user.empresaId } },
        });
        if (!plantilla)
            return Response.json({ error: 'Plantilla no encontrada' }, { status: 404 });

        const equipos = await prisma.plantillaEquipo.findMany({
            where: { plantillaId },
            orderBy: { fechaInicio: 'asc' },
            include: {
                equipo: {
                    select: {
                        id: true, nombre: true,
                        numeroEconomico: true, modelo: true,
                        hodometroInicial: true, activo: true,
                    },
                },
            },
        });

        return Response.json(equipos.map(pe => ({
            ...pe,
            equipo: { ...pe.equipo, hodometroInicial: Number(pe.equipo.hodometroInicial) },
        })));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener equipos de la plantilla' }, { status: 500 });
    }
}

// ─── POST /api/obras/[id]/plantillas/[plantillaId]/equipos ────────────────────
// Asigna un equipo a una plantilla. También lo agrega a ObraEquipo si no está ya.
export async function POST(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId, plantillaId } = await params;
        const { equipoId, fechaInicio, notas } = await req.json();

        if (!equipoId)
            return Response.json({ error: 'equipoId es requerido' }, { status: 400 });

        // Verificar equipo pertenece a esta empresa
        const equipo = await prisma.equipo.findFirst({
            where: { id: equipoId, empresaId: user.empresaId },
        });
        if (!equipo)
            return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });

        // Verificar plantilla pertenece a la obra
        const plantilla = await prisma.plantillaObra.findFirst({
            where: { id: plantillaId, obraId, obra: { empresaId: user.empresaId } },
        });
        if (!plantilla)
            return Response.json({ error: 'Plantilla no encontrada' }, { status: 404 });

        const fechaInicioDate = fechaInicio ? new Date(fechaInicio) : new Date();

        const result = await prisma.$transaction(async (tx) => {
            // 1. Asignar equipo a la plantilla (upsert por si ya existía)
            const pe = await tx.plantillaEquipo.upsert({
                where: { plantillaId_equipoId: { plantillaId, equipoId } },
                update: { fechaInicio: fechaInicioDate, fechaFin: null, notas: notas || null },
                create: { plantillaId, equipoId, fechaInicio: fechaInicioDate, notas: notas || null },
                include: {
                    equipo: { select: { nombre: true, numeroEconomico: true, hodometroInicial: true } },
                },
            });

            // 2. También asegurar que el equipo está en ObraEquipo (si no existe ya activo)
            const yaEnObra = await tx.obraEquipo.findFirst({
                where: { obraId, equipoId, fechaFin: null },
            });
            if (!yaEnObra) {
                // Cerrar asignación previa en otra obra si existe
                await tx.obraEquipo.updateMany({
                    where: { equipoId, fechaFin: null, obraId: { not: obraId } },
                    data: { fechaFin: fechaInicioDate },
                });
                await tx.obraEquipo.create({
                    data: { obraId, equipoId, fechaInicio: fechaInicioDate, notas: notas || null },
                });
            }

            return pe;
        });

        return Response.json({
            ...result,
            equipo: { ...result.equipo, hodometroInicial: Number(result.equipo.hodometroInicial) },
        }, { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al asignar equipo a la plantilla' }, { status: 500 });
    }
}

// ─── DELETE /api/obras/[id]/plantillas/[plantillaId]/equipos ──────────────────
// Body: { equipoId }
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId, plantillaId } = await params;
        const { equipoId } = await req.json();

        if (!equipoId)
            return Response.json({ error: 'equipoId es requerido' }, { status: 400 });

        // Verificar plantilla pertenece a la obra
        const plantilla = await prisma.plantillaObra.findFirst({
            where: { id: plantillaId, obraId, obra: { empresaId: user.empresaId } },
        });
        if (!plantilla)
            return Response.json({ error: 'Plantilla no encontrada' }, { status: 404 });

        await prisma.plantillaEquipo.delete({
            where: { plantillaId_equipoId: { plantillaId, equipoId } },
        });

        return Response.json({ message: 'Equipo desasignado de la plantilla' });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al desasignar equipo' }, { status: 500 });
    }
}

