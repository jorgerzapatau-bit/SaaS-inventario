import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const cliente = await prisma.cliente.findFirst({ where: { id, empresaId: user.empresaId } });
        if (!cliente) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 });
        const movimientos = await prisma.movimientoInventario.findMany({
            where: { empresaId: user.empresaId, clienteId: id, tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] } },
            orderBy: { fecha: 'desc' },
            include: { producto: { select: { nombre: true, sku: true, unidad: true } }, almacen: { select: { nombre: true } }, usuario: { select: { nombre: true } } },
        });
        const totalVentas  = movimientos.length;
        const montoTotal   = movimientos.reduce((acc, m) => acc + Number(m.cantidad) * Number(m.precioVenta || 0), 0);
        const ultimaVenta  = movimientos[0]?.fecha ?? null;
        const productosSet = new Set(movimientos.map(m => m.productoId));
        return Response.json({ cliente, stats: { totalVentas, montoTotal, ultimaVenta, totalProductos: productosSet.size }, movimientos });
    } catch (error) { console.error(error); return Response.json({ error: 'Error fetching client stats' }, { status: 500 }); }
}

