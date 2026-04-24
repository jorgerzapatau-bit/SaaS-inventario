// src/app/api/equipos/[id]/pendientes/route.ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/equipos/[id]/pendientes ────────────────────────────────────────
// Devuelve todos los pendientes del equipo.
// Query param: ?resuelto=false  (por defecto solo los abiertos)
//              ?resuelto=true   (solo los resueltos)
//              ?resuelto=all    (todos)
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;

        // Verificar que el equipo pertenece a esta empresa
        const equipo = await prisma.equipo.findFirst({
            where: { id, empresaId: user.empresaId },
            select: { id: true },
        });
        if (!equipo)
            return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });

        const resueltoParam = req.nextUrl.searchParams.get('resuelto');
        let whereResuelto: boolean | undefined = undefined;
        if (resueltoParam === 'true')  whereResuelto = true;
        if (resueltoParam === 'false') whereResuelto = false;
        // Si es 'all' o no viene, whereResuelto queda undefined → trae todos

        const pendientes = await prisma.pendienteEquipo.findMany({
            where: {
                equipoId:  id,
                empresaId: user.empresaId,
                ...(whereResuelto !== undefined && { resuelto: whereResuelto }),
            },
            orderBy: [
                { resuelto: 'asc' },   // primero los abiertos
                { fecha: 'desc' },
            ],
        });

        return Response.json(
            pendientes.map(p => ({
                ...p,
                horometro: p.horometro != null ? Number(p.horometro) : null,
            }))
        );
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener pendientes' }, { status: 500 });
    }
}

// ─── POST /api/equipos/[id]/pendientes ───────────────────────────────────────
// Crea un nuevo pendiente/falla abierta para el equipo.
// Body: { descripcion, observacion?, horometro?, fecha }
export async function POST(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const { descripcion, observacion, horometro, fecha } = await req.json();

        // ── Validaciones ──────────────────────────────────────────────────────
        if (!descripcion || String(descripcion).trim().length < 3)
            return Response.json(
                { error: 'descripcion es requerida (mínimo 3 caracteres)' },
                { status: 400 }
            );

        if (!fecha)
            return Response.json({ error: 'fecha es requerida' }, { status: 400 });

        // ── Verificar que el equipo pertenece a esta empresa ──────────────────
        const equipo = await prisma.equipo.findFirst({
            where: { id, empresaId: user.empresaId },
            select: { id: true },
        });
        if (!equipo)
            return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });

        // ── Crear pendiente ───────────────────────────────────────────────────
        const pendiente = await prisma.pendienteEquipo.create({
            data: {
                empresaId:   user.empresaId,
                equipoId:    id,
                descripcion: String(descripcion).trim(),
                observacion: observacion ? String(observacion).trim() : null,
                horometro:   horometro   != null ? Number(horometro) : null,
                fecha:       new Date(fecha),
                resuelto:    false,
            },
        });

        return Response.json(
            { ...pendiente, horometro: pendiente.horometro != null ? Number(pendiente.horometro) : null },
            { status: 201 }
        );
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al crear el pendiente' }, { status: 500 });
    }
}

