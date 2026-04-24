// src/app/api/equipos/[id]/inventario/[itemId]/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string; itemId: string }> };

// ─── PUT /api/equipos/[id]/inventario/[itemId] ────────────────────────────────
// Actualiza un ítem de inventario. Solo se actualizan los campos presentes en el body.
// Body puede contener cualquier combinación de:
//   { descripcion?, cantidad?, observacion?, fecha? }
export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id, itemId } = await params;

        const existente = await prisma.inventarioEquipo.findFirst({
            where: { id: itemId, equipoId: id, empresaId: user.empresaId },
        });
        if (!existente)
            return Response.json({ error: 'Ítem no encontrado' }, { status: 404 });

        const { descripcion, cantidad, observacion, fecha } = await req.json();

        const actualizado = await prisma.inventarioEquipo.update({
            where: { id: itemId },
            data: {
                ...(descripcion !== undefined && { descripcion: String(descripcion).trim() }),
                ...(cantidad    !== undefined && { cantidad: Number(cantidad) }),
                ...(observacion !== undefined && { observacion: observacion ? String(observacion).trim() : null }),
                ...(fecha       !== undefined && { fecha: new Date(fecha) }),
            },
        });

        return Response.json({ ...actualizado, cantidad: Number(actualizado.cantidad) });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Ítem no encontrado' }, { status: 404 });
        console.error(error);
        return Response.json({ error: 'Error al actualizar el ítem' }, { status: 500 });
    }
}

// ─── DELETE /api/equipos/[id]/inventario/[itemId] ────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id, itemId } = await params;

        const existente = await prisma.inventarioEquipo.findFirst({
            where: { id: itemId, equipoId: id, empresaId: user.empresaId },
        });
        if (!existente)
            return Response.json({ error: 'Ítem no encontrado' }, { status: 404 });

        await prisma.inventarioEquipo.delete({ where: { id: itemId } });
        return Response.json({ message: 'Ítem eliminado correctamente' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Ítem no encontrado' }, { status: 404 });
        console.error(error);
        return Response.json({ error: 'Error al eliminar el ítem' }, { status: 500 });
    }
}

