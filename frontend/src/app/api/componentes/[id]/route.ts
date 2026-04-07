// src/app/api/componentes/[id]/route.ts
import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/componentes/[id] ────────────────────────────────────────────────
// Devuelve el componente con su historial completo de movimientos.
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const componente = await prisma.componente.findFirst({
            where: { id, empresaId: user.empresaId },
            include: {
                equipoActual: { select: { id: true, nombre: true, numeroEconomico: true } },
                historial: {
                    orderBy: { fecha: 'desc' },
                    include: {
                        equipo: { select: { id: true, nombre: true, numeroEconomico: true } },
                    },
                },
            },
        });

        if (!componente)
            return Response.json({ error: 'Componente no encontrado' }, { status: 404 });

        return Response.json(serializeComponente(componente));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener el componente' }, { status: 500 });
    }
}

// ─── PUT /api/componentes/[id] ────────────────────────────────────────────────
// Edita datos del componente (nombre, serie, tipo, notas).
// Para cambiar de equipo usar POST /api/componentes/[id]/movimientos.
export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const { nombre, serie, tipo, notas } = await req.json();

        const componente = await prisma.componente.update({
            where: { id, empresaId: user.empresaId },
            data: {
                ...(nombre !== undefined && { nombre }),
                ...(serie  !== undefined && { serie:  serie  || null }),
                ...(tipo   !== undefined && { tipo:   tipo   || null }),
                ...(notas  !== undefined && { notas:  notas  || null }),
            },
            include: {
                equipoActual: { select: { id: true, nombre: true, numeroEconomico: true } },
                historial:    { orderBy: { fecha: 'desc' }, take: 1 },
            },
        });

        return Response.json(serializeComponente(componente));
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Componente no encontrado' }, { status: 404 });
        return Response.json({ error: 'Error al actualizar el componente' }, { status: 500 });
    }
}

// ─── DELETE /api/componentes/[id] ────────────────────────────────────────────
// Solo se puede eliminar si no tiene historial de movimientos.
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;

        const movimientos = await prisma.movimientoComponente.count({
            where: { componenteId: id },
        });
        if (movimientos > 0)
            return Response.json(
                { error: 'No se puede eliminar: el componente tiene historial de movimientos.' },
                { status: 400 }
            );

        await prisma.componente.delete({ where: { id, empresaId: user.empresaId } });
        return Response.json({ message: 'Componente eliminado correctamente' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Componente no encontrado' }, { status: 404 });
        return Response.json({ error: 'Error al eliminar el componente' }, { status: 500 });
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
