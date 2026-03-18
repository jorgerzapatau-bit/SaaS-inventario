import { NextRequest } from 'next/server';
import prisma from '../../../lib/prisma';
import { getAuthUser, unauthorized } from '../../../lib/auth';

async function calculateStock(empresaId: string, productoId: string, almacenId?: string): Promise<number> {
    const where: Record<string, unknown> = { empresaId, productoId };
    if (almacenId) where.almacenId = almacenId;
    const pos = await prisma.movimientoInventario.aggregate({ _sum: { cantidad: true }, where: { ...where, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } } as Parameters<typeof prisma.movimientoInventario.aggregate>[0]['where'] });
    const neg = await prisma.movimientoInventario.aggregate({ _sum: { cantidad: true }, where: { ...where, tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] } } as Parameters<typeof prisma.movimientoInventario.aggregate>[0]['where'] });
    return (pos._sum.cantidad || 0) - (neg._sum.cantidad || 0);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ productoId: string }> }) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { productoId } = await params;
        const { searchParams } = new URL(req.url);
        const almacenId = searchParams.get('almacenId') || undefined;
        const stock = await calculateStock(user.empresaId, productoId, almacenId);
        return Response.json({ productoId, stock, almacenId: almacenId || 'ALL' });
    } catch { return Response.json({ error: 'Error calculating stock' }, { status: 500 }); }
}
