import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/equipos/[id] ────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const equipo = await prisma.equipo.findFirst({
            where: { id, empresaId: user.empresaId },
            include: {
                _count: { select: { registrosDiarios: true } },
            },
        });

        if (!equipo)
            return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });

        return Response.json({
            ...equipo,
            hodometroInicial: Number(equipo.hodometroInicial),
        });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error fetching equipo' }, { status: 500 });
    }
}

// ─── PUT /api/equipos/[id] ────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const {
            nombre, modelo, numeroSerie,
            numeroEconomico, hodometroInicial,
            activo, notas,
        } = await req.json();

        const equipo = await prisma.equipo.update({
            where: { id, empresaId: user.empresaId },
            data: {
                ...(nombre            !== undefined && { nombre }),
                ...(modelo            !== undefined && { modelo }),
                ...(numeroSerie       !== undefined && { numeroSerie }),
                ...(numeroEconomico   !== undefined && { numeroEconomico }),
                ...(hodometroInicial  !== undefined && { hodometroInicial: Number(hodometroInicial) }),
                ...(activo            !== undefined && { activo }),
                ...(notas             !== undefined && { notas }),
            },
        });

        return Response.json({ ...equipo, hodometroInicial: Number(equipo.hodometroInicial) });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });
        return Response.json({ error: 'Error al actualizar el equipo' }, { status: 500 });
    }
}

// ─── DELETE /api/equipos/[id] ─────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;

        const registros = await prisma.registroDiario.count({
            where: { equipoId: id, empresaId: user.empresaId },
        });
        if (registros > 0)
            return Response.json(
                { error: 'No se puede eliminar: el equipo tiene registros diarios asociados.' },
                { status: 400 }
            );

        await prisma.equipo.delete({ where: { id, empresaId: user.empresaId } });
        return Response.json({ message: 'Equipo eliminado correctamente' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });
        return Response.json({ error: 'Error al eliminar el equipo' }, { status: 500 });
    }
}
