// src/app/api/equipos/[id]/inventario/route.ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/equipos/[id]/inventario ────────────────────────────────────────
// Devuelve todos los ítems de inventario del equipo, ordenados por fecha desc.
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;

        const equipo = await prisma.equipo.findFirst({
            where: { id, empresaId: user.empresaId },
            select: { id: true },
        });
        if (!equipo)
            return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });

        const items = await prisma.inventarioEquipo.findMany({
            where: { equipoId: id, empresaId: user.empresaId },
            orderBy: { fecha: 'desc' },
        });

        return Response.json(
            items.map(i => ({
                ...i,
                cantidad: Number(i.cantidad),
            }))
        );
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener inventario' }, { status: 500 });
    }
}

// ─── POST /api/equipos/[id]/inventario ───────────────────────────────────────
// Crea un nuevo ítem de inventario para el equipo.
// Body: { descripcion, cantidad?, observacion?, fecha }
export async function POST(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const { descripcion, cantidad, observacion, fecha } = await req.json();

        if (!descripcion || String(descripcion).trim().length < 2)
            return Response.json(
                { error: 'descripcion es requerida (mínimo 2 caracteres)' },
                { status: 400 }
            );

        if (!fecha)
            return Response.json({ error: 'fecha es requerida' }, { status: 400 });

        const equipo = await prisma.equipo.findFirst({
            where: { id, empresaId: user.empresaId },
            select: { id: true },
        });
        if (!equipo)
            return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });

        const item = await prisma.inventarioEquipo.create({
            data: {
                empresaId:   user.empresaId,
                equipoId:    id,
                descripcion: String(descripcion).trim(),
                cantidad:    cantidad != null ? Number(cantidad) : 1,
                observacion: observacion ? String(observacion).trim() : null,
                fecha:       new Date(fecha),
            },
        });

        return Response.json(
            { ...item, cantidad: Number(item.cantidad) },
            { status: 201 }
        );
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al crear el ítem de inventario' }, { status: 500 });
    }
}

