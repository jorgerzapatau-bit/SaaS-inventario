import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

// ─── GET /api/equipos ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const equipos = await prisma.equipo.findMany({
            where: { empresaId: user.empresaId },
            orderBy: { nombre: 'asc' },
            include: {
                _count: { select: { registrosDiarios: true } },
            },
        });

        return Response.json(equipos.map(e => ({
            ...e,
            hodometroInicial: Number(e.hodometroInicial),
        })));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error fetching equipos' }, { status: 500 });
    }
}

// ─── POST /api/equipos ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const {
            nombre, modelo, numeroSerie,
            numeroEconomico, hodometroInicial, notas,
        } = await req.json();

        if (!nombre)
            return Response.json({ error: 'El nombre del equipo es requerido' }, { status: 400 });

        const equipo = await prisma.equipo.create({
            data: {
                empresaId:        user.empresaId,
                nombre,
                modelo:           modelo           || null,
                numeroSerie:      numeroSerie      || null,
                numeroEconomico:  numeroEconomico  || null,
                hodometroInicial: hodometroInicial != null ? Number(hodometroInicial) : 0,
                notas:            notas            || null,
                activo:           true,
            },
        });

        return Response.json({ ...equipo, hodometroInicial: Number(equipo.hodometroInicial) }, { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al crear el equipo' }, { status: 500 });
    }
}
