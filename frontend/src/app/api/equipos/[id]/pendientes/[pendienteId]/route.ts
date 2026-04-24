// src/app/api/equipos/[id]/pendientes/[pendienteId]/route.ts
import { NextRequest } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getAuthUser, unauthorized } from '../../../../lib/auth';

type Params = { params: Promise<{ id: string; pendienteId: string }> };

// ─── PUT /api/equipos/[id]/pendientes/[pendienteId] ──────────────────────────
// Actualiza un pendiente: editar datos O marcarlo como resuelto.
// Body puede contener cualquier combinación de:
//   { descripcion?, observacion?, horometro?, fecha?,
//     resuelto?, fechaResuelto? }
export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id, pendienteId } = await params;

        // Verificar que el pendiente pertenece a este equipo y empresa
        const existente = await prisma.pendienteEquipo.findFirst({
            where: { id: pendienteId, equipoId: id, empresaId: user.empresaId },
        });
        if (!existente)
            return Response.json({ error: 'Pendiente no encontrado' }, { status: 404 });

        const { descripcion, observacion, horometro, fecha, resuelto, fechaResuelto } =
            await req.json();

        // Si se marca como resuelto sin fecha, usar hoy
        let fechaResueltoFinal: Date | null | undefined = undefined;
        if (resuelto === true) {
            fechaResueltoFinal = fechaResuelto ? new Date(fechaResuelto) : new Date();
        } else if (resuelto === false) {
            // Al reabrir, limpiar la fecha de resolución
            fechaResueltoFinal = null;
        }

        const actualizado = await prisma.pendienteEquipo.update({
            where: { id: pendienteId },
            data: {
                ...(descripcion    !== undefined && { descripcion: String(descripcion).trim() }),
                ...(observacion    !== undefined && { observacion: observacion ? String(observacion).trim() : null }),
                ...(horometro      !== undefined && { horometro: horometro != null ? Number(horometro) : null }),
                ...(fecha          !== undefined && { fecha: new Date(fecha) }),
                ...(resuelto       !== undefined && { resuelto }),
                ...(fechaResueltoFinal !== undefined && { fechaResuelto: fechaResueltoFinal }),
            },
        });

        return Response.json({
            ...actualizado,
            horometro: actualizado.horometro != null ? Number(actualizado.horometro) : null,
        });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Pendiente no encontrado' }, { status: 404 });
        console.error(error);
        return Response.json({ error: 'Error al actualizar el pendiente' }, { status: 500 });
    }
}

// ─── DELETE /api/equipos/[id]/pendientes/[pendienteId] ───────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id, pendienteId } = await params;

        // Verificar pertenencia antes de borrar
        const existente = await prisma.pendienteEquipo.findFirst({
            where: { id: pendienteId, equipoId: id, empresaId: user.empresaId },
        });
        if (!existente)
            return Response.json({ error: 'Pendiente no encontrado' }, { status: 404 });

        await prisma.pendienteEquipo.delete({ where: { id: pendienteId } });
        return Response.json({ message: 'Pendiente eliminado correctamente' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Pendiente no encontrado' }, { status: 404 });
        console.error(error);
        return Response.json({ error: 'Error al eliminar el pendiente' }, { status: 500 });
    }
}
