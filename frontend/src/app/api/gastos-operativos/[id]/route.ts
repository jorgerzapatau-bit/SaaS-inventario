import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── PUT /api/gastos-operativos/[id] ──────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const {
            categoria, producto, unidad,
            cantidad, precioUnitario, moneda,
            tipoCambio, obraId, notas,
        } = await req.json();

        const gasto = await prisma.gastoOperativo.update({
            where: { id },
            data: {
                ...(categoria       !== undefined && { categoria }),
                ...(producto        !== undefined && { producto: producto?.trim() }),
                ...(unidad          !== undefined && { unidad }),
                ...(cantidad        !== undefined && { cantidad:       Number(cantidad) }),
                ...(precioUnitario  !== undefined && { precioUnitario: Number(precioUnitario) }),
                ...(moneda          !== undefined && { moneda: moneda === 'USD' ? 'USD' : 'MXN' }),
                ...(tipoCambio      !== undefined && { tipoCambio: tipoCambio != null ? Number(tipoCambio) : null }),
                ...(obraId          !== undefined && { obraId: obraId || null }),
                ...(notas           !== undefined && { notas: notas || null }),
            },
        });

        return Response.json({
            ...gasto,
            cantidad:       Number(gasto.cantidad),
            precioUnitario: Number(gasto.precioUnitario),
            total:          gasto.total ? Number(gasto.total) : Number(gasto.cantidad) * Number(gasto.precioUnitario),
        });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
        return Response.json({ error: 'Error al actualizar el gasto' }, { status: 500 });
    }
}

// ─── DELETE /api/gastos-operativos/[id] ───────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        await prisma.gastoOperativo.delete({ where: { id } });
        return Response.json({ message: 'Gasto eliminado correctamente' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
        return Response.json({ error: 'Error al eliminar el gasto' }, { status: 500 });
    }
}
