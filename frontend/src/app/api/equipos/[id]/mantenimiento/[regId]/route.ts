// src/app/api/equipos/[id]/mantenimiento/[regId]/route.ts
// Gestiona registros LEGACY (RegistroMantenimiento)
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string; regId: string }> };

// ─── PUT /api/equipos/:id/mantenimiento/:regId ────────────────────────────────
// Edita campos generales de un registro legacy (RegistroMantenimiento).
export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    const { id: equipoId, regId } = await params;

    const registro = await prisma.registroMantenimiento.findFirst({
        where: { id: regId, equipoId, empresaId: user.empresaId },
    });
    if (!registro) {
        return Response.json({ error: 'Registro no encontrado para este equipo' }, { status: 404 });
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

    const { fecha, descripcion, observaciones, horometro } = body as {
        fecha?: string; descripcion?: string;
        observaciones?: string | null; horometro?: number | null;
    };

    if (descripcion !== undefined && String(descripcion).trim().length < 2) {
        return Response.json({ error: 'descripcion debe tener al menos 2 caracteres' }, { status: 400 });
    }

    const actualizado = await prisma.registroMantenimiento.update({
        where: { id: regId },
        data: {
            ...(fecha         !== undefined && { fecha:         new Date(fecha) }),
            ...(descripcion   !== undefined && { descripcion:   String(descripcion).trim() }),
            ...(observaciones !== undefined && { observaciones: observaciones?.trim() ?? null }),
            ...(horometro     !== undefined && { horometro }),
        },
    });

    return Response.json(actualizado);
}

// ─── DELETE /api/equipos/:id/mantenimiento/:regId ─────────────────────────────
// Elimina un registro legacy (RegistroMantenimiento). Sin efectos en kardex
// porque los registros legacy no tienen insumos vinculados al nuevo sistema.
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    const { id: equipoId, regId } = await params;

    const registro = await prisma.registroMantenimiento.findFirst({
        where: { id: regId, equipoId, empresaId: user.empresaId },
    });
    if (!registro) {
        return Response.json({ error: 'Registro no encontrado para este equipo' }, { status: 404 });
    }

    await prisma.registroMantenimiento.delete({ where: { id: regId } });

    return Response.json({ message: 'Registro eliminado correctamente' });
}
