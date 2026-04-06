import { NextRequest } from 'next/server';
import prisma from '../../../lib/prisma';
import { getAuthUser, unauthorized } from '../../../lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/obras/[id]/equipos ─────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const obraEquipos = await prisma.obraEquipo.findMany({
            where: { obraId: id },
            orderBy: { fechaInicio: 'desc' },
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
        return Response.json(obraEquipos.map(oe => ({
            ...oe,
            equipo: { ...oe.equipo, hodometroInicial: Number(oe.equipo.hodometroInicial) },
        })));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener equipos de la obra' }, { status: 500 });
    }
}

// ─── POST /api/obras/[id]/equipos ────────────────────────────────────────────
// Asigna un equipo a la obra. Si el equipo ya está asignado a otra obra activa,
// cierra esa asignación automáticamente.
export async function POST(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId } = await params;
        const { equipoId, fechaInicio, notas } = await req.json();

        if (!equipoId)
            return Response.json({ error: 'equipoId es requerido' }, { status: 400 });

        // Verificar que el equipo pertenece a la empresa
        const equipo = await prisma.equipo.findFirst({
            where: { id: equipoId, empresaId: user.empresaId },
        });
        if (!equipo)
            return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });

        const fechaInicioDate = fechaInicio ? new Date(fechaInicio) : new Date();

        const obraEquipo = await prisma.$transaction(async (tx) => {
            // Cerrar asignaciones abiertas del mismo equipo en otras obras
            await tx.obraEquipo.updateMany({
                where: {
                    equipoId,
                    fechaFin: null,
                    obraId: { not: obraId },
                },
                data: { fechaFin: fechaInicioDate },
            });

            return tx.obraEquipo.create({
                data: {
                    obraId,
                    equipoId,
                    fechaInicio: fechaInicioDate,
                    notas: notas || null,
                },
                include: {
                    equipo: { select: { nombre: true, numeroEconomico: true } },
                },
            });
        });

        return Response.json(obraEquipo, { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al asignar equipo' }, { status: 500 });
    }
}

// ─── PATCH /api/obras/[id]/equipos ───────────────────────────────────────────
// Cierra la asignación de un equipo (fechaFin = hoy)
export async function PATCH(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId } = await params;
        const { obraEquipoId, fechaFin } = await req.json();

        if (!obraEquipoId)
            return Response.json({ error: 'obraEquipoId es requerido' }, { status: 400 });

        const updated = await prisma.obraEquipo.update({
            where: { id: obraEquipoId },
            data: { fechaFin: fechaFin ? new Date(fechaFin) : new Date() },
        });

        return Response.json(updated);
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al cerrar asignación' }, { status: 500 });
    }
}
