import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const salidas = await prisma.salida.findMany({
            where: { empresaId: user.empresaId },
            include: {
                usuario: true,
                detalles: { include: { producto: { select: { nombre: true, sku: true, unidad: true } } } }
            },
            orderBy: { fecha: 'desc' }
        });
        return Response.json(salidas);
    } catch { return Response.json({ error: 'Error fetching sales' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { tipo, detalles, referencia, almacenId } = await req.json();
        const empresaId = user.empresaId;
        const usuarioId = user.id;

        let targetAlmacenId = almacenId;
        if (!targetAlmacenId) {
            const first = await prisma.almacen.findFirst({ where: { empresaId } });
            if (!first) return Response.json({ error: 'No warehouse found for company' }, { status: 400 });
            targetAlmacenId = first.id;
        }

        const result = await prisma.$transaction(async (tx) => {
            const salida = await tx.salida.create({
                data: {
                    empresaId, tipo, referencia, usuarioId,
                    detalles: { create: detalles.map((d: { productoId: string; cantidad: number; precioUnitario?: number }) => ({ productoId: d.productoId, cantidad: d.cantidad, precioUnitario: d.precioUnitario || 0 })) }
                }
            });
            await tx.movimientoInventario.createMany({
                data: detalles.map((d: { productoId: string; cantidad: number; precioUnitario?: number }) => ({
                    empresaId, productoId: d.productoId, almacenId: targetAlmacenId,
                    tipoMovimiento: 'SALIDA', cantidad: d.cantidad, costoUnitario: d.precioUnitario || 0,
                    referencia: `Salida #${salida.id} - ${referencia || ''}`, usuarioId
                }))
            });
            return salida;
        });

        return Response.json(result, { status: 201 });
    } catch (error) { console.error(error); return Response.json({ error: 'Error registering sale/exit' }, { status: 500 }); }
}
