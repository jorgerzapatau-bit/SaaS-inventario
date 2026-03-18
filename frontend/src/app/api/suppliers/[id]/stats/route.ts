import { NextRequest } from 'next/server';
import prisma from '../../../lib/prisma';
import { getAuthUser, unauthorized } from '../../../lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const proveedor = await prisma.proveedor.findFirst({ where: { id, empresaId: user.empresaId } });
        if (!proveedor) return Response.json({ error: 'Proveedor no encontrado' }, { status: 404 });
        const movimientos = await prisma.movimientoInventario.findMany({
            where: { empresaId: user.empresaId, proveedorId: id, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } },
            orderBy: { fecha: 'desc' },
            include: { producto: { select: { nombre: true, sku: true, unidad: true } }, almacen: { select: { nombre: true } }, usuario: { select: { nombre: true } } },
        });
        const totalCompras = movimientos.length;
        const montoTotal   = movimientos.reduce((acc, m) => acc + Number(m.cantidad) * Number(m.costoUnitario), 0);
        const ultimaCompra = movimientos[0]?.fecha ?? null;
        const productosSet = new Set(movimientos.map(m => m.productoId));
        return Response.json({ proveedor, stats: { totalCompras, montoTotal, ultimaCompra, totalProductos: productosSet.size }, movimientos });
    } catch (error) { console.error(error); return Response.json({ error: 'Error fetching supplier stats' }, { status: 500 }); }
}
