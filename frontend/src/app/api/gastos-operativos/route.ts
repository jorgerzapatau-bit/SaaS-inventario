import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

// ─── GET /api/gastos-operativos ───────────────────────────────────────────────
// Query params: equipoId, obraId, semanaNum, anoNum, categoria
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { searchParams } = new URL(req.url);
        const equipoId  = searchParams.get('equipoId')  || undefined;
        const obraId    = searchParams.get('obraId')    || undefined;
        const semanaNum = searchParams.get('semanaNum') ? parseInt(searchParams.get('semanaNum')!) : undefined;
        const anoNum    = searchParams.get('anoNum')    ? parseInt(searchParams.get('anoNum')!)    : undefined;
        const categoria = searchParams.get('categoria') || undefined;

        const gastos = await prisma.gastoOperativo.findMany({
            where: {
                empresaId: user.empresaId,
                ...(equipoId  && { equipoId }),
                ...(obraId    && { obraId }),
                ...(semanaNum && { semanaNum }),
                ...(anoNum    && { anoNum }),
                ...(categoria && { categoria: categoria as any }),
            },
            orderBy: [{ anoNum: 'desc' }, { semanaNum: 'desc' }, { createdAt: 'desc' }],
            include: {
                equipo: { select: { nombre: true, numeroEconomico: true } },
                obra:   { select: { nombre: true } },
            },
        });

        return Response.json(gastos.map(g => ({
            ...g,
            cantidad:       Number(g.cantidad),
            precioUnitario: Number(g.precioUnitario),
            total:          g.total ? Number(g.total) : Number(g.cantidad) * Number(g.precioUnitario),
            tipoCambio:     g.tipoCambio ? Number(g.tipoCambio) : null,
        })));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener gastos operativos' }, { status: 500 });
    }
}

// ─── POST /api/gastos-operativos ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const {
            equipoId, obraId, semanaNum, anoNum,
            fechaInicio, categoria, producto,
            unidad, cantidad, precioUnitario,
            moneda, tipoCambio, notas,
        } = await req.json();

        if (!equipoId)
            return Response.json({ error: 'equipoId es requerido' }, { status: 400 });
        if (!producto?.trim())
            return Response.json({ error: 'El nombre del producto/concepto es requerido' }, { status: 400 });
        if (cantidad == null || precioUnitario == null)
            return Response.json({ error: 'cantidad y precioUnitario son requeridos' }, { status: 400 });

        // Derivar semana/año si no vienen
        const fechaDate  = fechaInicio ? new Date(fechaInicio) : new Date();
        const semanaFinal = semanaNum ?? getISOWeek(fechaDate);
        const anoFinal    = anoNum    ?? fechaDate.getFullYear();

        const gasto = await prisma.gastoOperativo.create({
            data: {
                empresaId:      user.empresaId,
                equipoId,
                obraId:         obraId         || null,
                semanaNum:      semanaFinal,
                anoNum:         anoFinal,
                fechaInicio:    fechaDate,
                categoria:      categoria       || 'OTRO',
                producto:       producto.trim(),
                unidad:         unidad          || 'pza',
                cantidad:       Number(cantidad),
                precioUnitario: Number(precioUnitario),
                moneda:         moneda === 'USD' ? 'USD' : 'MXN',
                tipoCambio:     tipoCambio      != null ? Number(tipoCambio) : null,
                notas:          notas           || null,
            },
            include: {
                equipo: { select: { nombre: true, numeroEconomico: true } },
                obra:   { select: { nombre: true } },
            },
        });

        return Response.json({
            ...gasto,
            cantidad:       Number(gasto.cantidad),
            precioUnitario: Number(gasto.precioUnitario),
            total:          gasto.total ? Number(gasto.total) : Number(gasto.cantidad) * Number(gasto.precioUnitario),
            tipoCambio:     gasto.tipoCambio ? Number(gasto.tipoCambio) : null,
        }, { status: 201 });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002')
            return Response.json(
                { error: 'Ya existe un gasto con ese producto en esta semana/equipo.' },
                { status: 400 }
            );
        console.error(error);
        return Response.json({ error: 'Error al crear el gasto operativo' }, { status: 500 });
    }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
