import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

// PATCH /api/purchases/:id — Cambia el estado de una compra
// PENDIENTE → COMPLETADA: genera movimientos de ENTRADA en el kardex
// PENDIENTE → CANCELADA:  solo actualiza el estado, sin tocar el stock
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    const { id } = await params;
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

            // Si se completa, generar las entradas en el kardex y actualizar stockActual
            if (status === 'COMPLETADA' && targetAlmacenId) {
                await Promise.all(
                    compra.detalles.map(async (d) => {
                        await tx.movimientoInventario.create({
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
                                fecha:          compra.fecha,
                            },
                        });
                        await tx.producto.update({
                            where: { id: d.productoId, empresaId: user.empresaId },
                            data:  { stockActual: { increment: Number(d.cantidad) } },
                        });
                    })
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

// PUT /api/purchases/:id — Editar una compra PENDIENTE
// Solo se puede editar proveedor y líneas de detalle.
// El stock NO cambia hasta que la compra pase a COMPLETADA.
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    const { id } = await params;

    try {
        const { proveedorId, detalles } = await req.json();

        if (!proveedorId) {
            return Response.json({ error: 'El proveedor es obligatorio.' }, { status: 400 });
        }
        if (!detalles || detalles.length === 0) {
            return Response.json({ error: 'Debe haber al menos una línea de producto.' }, { status: 400 });
        }
        if (detalles.some((d: any) => !d.productoId || Number(d.cantidad) <= 0)) {
            return Response.json({ error: 'Todas las líneas deben tener producto y cantidad mayor a 0.' }, { status: 400 });
        }

        // Verificar que la compra existe, pertenece a la empresa y está PENDIENTE
        const compraExistente = await prisma.compra.findFirst({
            where: { id, empresaId: user.empresaId },
        });

        if (!compraExistente) {
            return Response.json({ error: 'Compra no encontrada.' }, { status: 404 });
        }
        if (compraExistente.status !== 'PENDIENTE') {
            return Response.json(
                { error: `Solo se pueden editar compras en estado PENDIENTE. Esta está ${compraExistente.status}.` },
                { status: 400 }
            );
        }

        const total = detalles.reduce(
            (acc: number, d: any) => acc + Number(d.precioUnitario) * Number(d.cantidad),
            0
        );

        const result = await prisma.$transaction(async (tx) => {
            // 1. Eliminar todos los detalles anteriores
            await tx.detalleCompra.deleteMany({ where: { compraId: id } });

            // 2. Actualizar cabecera de la compra
            const compraActualizada = await tx.compra.update({
                where: { id },
                data: { proveedorId, total },
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

            // 3. Crear nuevos detalles
            await tx.detalleCompra.createMany({
                data: detalles.map((d: any) => ({
                    compraId:       id,
                    productoId:     d.productoId,
                    cantidad:       Number(d.cantidad),
                    precioUnitario: Number(d.precioUnitario),
                })),
            });

            return compraActualizada;
        });

        return Response.json(result);
    } catch (e: any) {
        console.error(e);
        return Response.json({ error: e.message || 'Error al editar la compra.' }, { status: 500 });
    }
}
