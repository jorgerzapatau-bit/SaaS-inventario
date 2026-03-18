import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const compras = await prisma.compra.findMany({ where: { empresaId: user.empresaId }, include: { proveedor: true, detalles: true } });
        return Response.json(compras);
    } catch { return Response.json({ error: 'Error fetching purchases' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { proveedorId, detalles, total, almacenId } = await req.json();
        const empresaId = user.empresaId;
        const usuarioId = user.id;

        let targetAlmacenId = almacenId;
        if (!targetAlmacenId) {
            const first = await prisma.almacen.findFirst({ where: { empresaId } });
            if (!first) return Response.json({ error: 'No warehouse found for company' }, { status: 400 });
            targetAlmacenId = first.id;
        }

        const result = await prisma.$transaction(async (tx) => {
            const compra = await tx.compra.create({
                data: {
                    empresaId, proveedorId, total, status: 'COMPLETADA',
                    detalles: { create: detalles.map((d: { productoId: string; cantidad: number; precioUnitario: number }) => ({ productoId: d.productoId, cantidad: d.cantidad, precioUnitario: d.precioUnitario })) }
                }
            });
            await tx.movimientoInventario.createMany({
                data: detalles.map((d: { productoId: string; cantidad: number; precioUnitario: number }) => ({
                    empresaId, productoId: d.productoId, almacenId: targetAlmacenId,
                    tipoMovimiento: 'ENTRADA', cantidad: d.cantidad, costoUnitario: d.precioUnitario,
                    referencia: `Compra #${compra.id}`, usuarioId
                }))
            });
            return compra;
        });

        return Response.json(result, { status: 201 });
    } catch (error) { console.error(error); return Response.json({ error: 'Error registering purchase' }, { status: 500 }); }
}
