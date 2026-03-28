import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

// PATCH /api/purchases/:id — Cambia el estado de una compra
// PENDIENTE → COMPLETADA: genera movimientos de ENTRADA en el kardex
// PENDIENTE → CANCELADA:  solo actualiza el estado, sin tocar el stock
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    const { id } = params;
    const { status } = await req.json();

    if (!['COMPLETADA', 'CANCELADA'].includes(status)) {
        return Response.json({ error: 'Estado inválido. Solo se acepta COMPLETADA o CANCELADA.' }, { status: 400 });
    }

    try {
        // Verificar que la compra exista y pertenezca a la empresa
        const compra = await prisma.compra.findFirst({
            where: { id, empresaId: user.empresaId },
            include: {
                detalles: true,
            },
        });

        if (!compra) {
            return Response.json({ error: 'Compra no encontrada.' }, { status: 404 });
        }

        // Solo se pueden cambiar compras PENDIENTES
        if (compra.status !== 'PENDIENTE') {
            return Response.json(
                { error: `No se puede modificar una compra en estado ${compra.status}.` },
                { status: 400 }
            );
        }

        let targetAlmacenId: string | null = null;
        if (status === 'COMPLETADA') {
            const almacen = await prisma.almacen.findFirst({ where: { empresaId: user.empresaId } });
            if (!almacen) {
                return Response.json({ error: 'No se encontró un almacén para la empresa.' }, { status: 400 });
            }
            targetAlmacenId = almacen.id;
        }

        const result = await prisma.$transaction(async (tx) => {
            // Actualizar el estado de la compra
            const compraActualizada = await tx.compra.update({
                where: { id },
                data: { status },
                include: {
                    proveedor: true,
                    detalles: {
                        include: { producto: { select: { nombre: true, sku: true, unidad: true } } },
                    },
                    movimientos: {
                        select: { id: true, cantidad: true, costoUnitario: true, fecha: true, almacen: { select: { nombre: true } } },
                    },
                },
            });

            // Si se completa, generar las entradas en el kardex por cada producto
            if (status === 'COMPLETADA' && targetAlmacenId) {
                await Promise.all(
                    compra.detalles.map((d) =>
                        tx.movimientoInventario.create({
                            data: {
                                empresaId:      user.empresaId,
                                productoId:     d.productoId,
                                almacenId:      targetAlmacenId!,
                                tipoMovimiento: 'ENTRADA',
                                cantidad:       d.cantidad,
                                costoUnitario:  d.precioUnitario,
                                proveedorId:    compra.proveedorId,
                                compraId:       compra.id,
                                referencia:     compra.referencia ?? undefined,
                                usuarioId:      user.id,
                            },
                        })
                    )
                );
            }

            return compraActualizada;
        });

        return Response.json(result);
    } catch (e) {
        console.error(e);
        return Response.json({ error: 'Error al actualizar la compra.' }, { status: 500 });
    }
}
