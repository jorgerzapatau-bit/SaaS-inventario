import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

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
            horometroInicial: oe.horometroInicial ? Number(oe.horometroInicial) : null,  // C3-A
            horometroFinal:   oe.horometroFinal   ? Number(oe.horometroFinal)   : null,  // C3-A
            equipo: { ...oe.equipo, hodometroInicial: Number(oe.equipo.hodometroInicial) },
        })));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener equipos de la obra' }, { status: 500 });
    }
}

// ─── POST /api/obras/[id]/equipos ────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId } = await params;
        const { equipoId, fechaInicio, notas, horometroInicial } = await req.json();  // C3-A

        if (!equipoId)
            return Response.json({ error: 'equipoId es requerido' }, { status: 400 });

        const equipo = await prisma.equipo.findFirst({
            where: { id: equipoId, empresaId: user.empresaId },
        });
        if (!equipo)
            return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });

        const fechaInicioDate = fechaInicio ? new Date(fechaInicio) : new Date();

        const obraEquipo = await prisma.$transaction(async (tx) => {
            await tx.obraEquipo.updateMany({
                where: { equipoId, fechaFin: null, obraId: { not: obraId } },
                data:  { fechaFin: fechaInicioDate },
            });

            return tx.obraEquipo.create({
                data: {
                    obraId,
                    equipoId,
                    fechaInicio:      fechaInicioDate,
                    notas:            notas || null,
                    horometroInicial: horometroInicial != null ? Number(horometroInicial) : null,  // C3-A
                },
                include: {
                    equipo: { select: { nombre: true, numeroEconomico: true } },
                },
            });
        });

        return Response.json({
            ...obraEquipo,
            horometroInicial: obraEquipo.horometroInicial ? Number(obraEquipo.horometroInicial) : null,
            horometroFinal:   null,
        }, { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al asignar equipo' }, { status: 500 });
    }
}

// ─── PATCH /api/obras/[id]/equipos ───────────────────────────────────────────
// Cierra la asignación de un equipo (fechaFin) y opcionalmente guarda horometroFinal
export async function PATCH(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId } = await params;
        const { obraEquipoId, fechaFin, horometroFinal } = await req.json();  // C3-A

        if (!obraEquipoId)
            return Response.json({ error: 'obraEquipoId es requerido' }, { status: 400 });

        const updated = await prisma.obraEquipo.update({
            where: { id: obraEquipoId },
            data: {
                fechaFin:        fechaFin      ? new Date(fechaFin)    : new Date(),
                ...(horometroFinal != null && { horometroFinal: Number(horometroFinal) }),  // C3-A
            },
        });

        return Response.json({
            ...updated,
            horometroInicial: updated.horometroInicial ? Number(updated.horometroInicial) : null,
            horometroFinal:   updated.horometroFinal   ? Number(updated.horometroFinal)   : null,
        });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al cerrar asignación' }, { status: 500 });
    }
}

