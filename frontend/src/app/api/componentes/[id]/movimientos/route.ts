// src/app/api/componentes/[id]/movimientos/route.ts
import { NextRequest } from 'next/server';
import prisma from '../../../lib/prisma';
import { getAuthUser, unauthorized } from '../../../lib/auth';

type Params = { params: Promise<{ id: string }> };

const TIPOS_VALIDOS = ['INSTALACION', 'RETIRO', 'ENVIO_REPARACION', 'RETORNO_REPARACION'] as const;
type TipoMovimiento = typeof TIPOS_VALIDOS[number];

// ─── GET /api/componentes/[id]/movimientos ────────────────────────────────────
// Historial completo del componente.
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;

        // Verificar que el componente pertenece a esta empresa
        const componente = await prisma.componente.findFirst({
            where: { id, empresaId: user.empresaId },
            select: { id: true },
        });
        if (!componente)
            return Response.json({ error: 'Componente no encontrado' }, { status: 404 });

        const movimientos = await prisma.movimientoComponente.findMany({
            where:   { componenteId: id },
            orderBy: { fecha: 'desc' },
            include: {
                equipo: { select: { id: true, nombre: true, numeroEconomico: true } },
            },
        });

        return Response.json(movimientos);
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener movimientos' }, { status: 500 });
    }
}

// ─── POST /api/componentes/[id]/movimientos ───────────────────────────────────
// Registra un movimiento y actualiza equipoActualId en el componente.
//
// Tipos y sus efectos sobre equipoActualId:
//   INSTALACION         → equipoId (requerido)  → componente queda en ese equipo
//   RETIRO              → equipoId (opcional)    → componente queda en null (taller)
//   ENVIO_REPARACION    → equipoId (opcional)    → componente queda en null (taller/reparación)
//   RETORNO_REPARACION  → equipoId (opcional)    → si viene equipoId, se re-instala; si no, queda en taller
//
// Body: { tipo, fecha, notas, equipoId? }
export async function POST(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const { tipo, fecha, notas, equipoId } = await req.json();

        // ── Validaciones básicas ──────────────────────────────────────────────
        if (!tipo || !TIPOS_VALIDOS.includes(tipo as TipoMovimiento))
            return Response.json(
                { error: `tipo inválido. Valores aceptados: ${TIPOS_VALIDOS.join(', ')}` },
                { status: 400 }
            );

        if (!notas || String(notas).trim().length < 5)
            return Response.json(
                { error: 'notas es requerido (mínimo 5 caracteres)' },
                { status: 400 }
            );

        if (tipo === 'INSTALACION' && !equipoId)
            return Response.json(
                { error: 'equipoId es requerido para el tipo INSTALACION' },
                { status: 400 }
            );

        // ── Verificar que el componente pertenece a esta empresa ──────────────
        const componente = await prisma.componente.findFirst({
            where: { id, empresaId: user.empresaId },
        });
        if (!componente)
            return Response.json({ error: 'Componente no encontrado' }, { status: 404 });

        // ── Verificar equipo destino si aplica ────────────────────────────────
        if (equipoId) {
            const equipo = await prisma.equipo.findFirst({
                where: { id: equipoId, empresaId: user.empresaId },
            });
            if (!equipo)
                return Response.json({ error: 'Equipo destino no encontrado' }, { status: 404 });
        }

        // ── Calcular nuevo equipoActualId según tipo ──────────────────────────
        let nuevoEquipoActualId: string | null;
        switch (tipo as TipoMovimiento) {
            case 'INSTALACION':
                nuevoEquipoActualId = equipoId;
                break;
            case 'RETIRO':
            case 'ENVIO_REPARACION':
                nuevoEquipoActualId = null;
                break;
            case 'RETORNO_REPARACION':
                // Si regresa con equipoId se re-instala; sin él va a taller
                nuevoEquipoActualId = equipoId || null;
                break;
        }

        // ── Transacción: crear movimiento + actualizar componente ─────────────
        const [movimiento] = await prisma.$transaction([
            prisma.movimientoComponente.create({
                data: {
                    componenteId: id,
                    equipoId:     equipoId || null,
                    fecha:        fecha ? new Date(fecha) : new Date(),
                    tipo,
                    notas:        String(notas).trim(),
                },
                include: {
                    equipo: { select: { id: true, nombre: true, numeroEconomico: true } },
                },
            }),
            prisma.componente.update({
                where: { id },
                data:  { equipoActualId: nuevoEquipoActualId },
            }),
        ]);

        return Response.json(movimiento, { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al registrar el movimiento' }, { status: 500 });
    }
}
