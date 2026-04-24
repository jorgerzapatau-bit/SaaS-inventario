import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

// Helper: serializa Decimals y agrega conteos
function serializeEquipo(e: Record<string, unknown>) {
    return {
        ...e,
        hodometroInicial: Number(e.hodometroInicial),
    };
}

// ─── GET /api/equipos ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const equipos = await prisma.equipo.findMany({
            where: { empresaId: user.empresaId },
            orderBy: { nombre: 'asc' },
            include: {
                _count: { select: { registrosDiarios: true, componentesInstalados: true } },
            },
        });

        return Response.json(equipos.map(serializeEquipo));
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
            nombre, modelo, numeroSerie, numeroEconomico,
            hodometroInicial, notas, marca, anoFabricacion,
            fechaCompra, facturaCompra,
            // Campos técnicos nuevos
            apodo, acopladoCon, proveedorOrigen, seriePistolaActual,
            statusEquipo,
        } = await req.json();

        if (!nombre)
            return Response.json({ error: 'El nombre del equipo es requerido' }, { status: 400 });

        const equipo = await prisma.equipo.create({
            data: {
                empresaId:          user.empresaId,
                nombre,
                modelo:             modelo            || null,
                numeroSerie:        numeroSerie        || null,
                numeroEconomico:    numeroEconomico    || null,
                hodometroInicial:   hodometroInicial != null ? Number(hodometroInicial) : 0,
                notas:              notas              || null,
                activo:             true,
                marca:              marca              || null,
                anoFabricacion:     anoFabricacion     != null ? Number(anoFabricacion) : null,
                fechaCompra:        fechaCompra        ? new Date(fechaCompra) : null,
                facturaCompra:      facturaCompra      || null,
                // Campos técnicos
                apodo:              apodo              || null,
                acopladoCon:        acopladoCon        || null,
                proveedorOrigen:    proveedorOrigen    || null,
                seriePistolaActual: seriePistolaActual || null,
                statusEquipo:       statusEquipo       || 'ACTIVO',
            },
        });

        return Response.json(serializeEquipo(equipo as unknown as Record<string, unknown>), { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al crear el equipo' }, { status: 500 });
    }
}

