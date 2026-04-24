import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── DELETE /api/gastos-operativos/[id] ───────────────────────────────────────
// Si el gasto era de tipo INSUMO, revierte el stock del producto y elimina
// el MovimientoInventario asociado antes de borrar el gasto.
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;

        // Leer el gasto antes de eliminarlo para saber si hay que revertir stock
        const gasto = await prisma.gastoOperativo.findFirst({
            where: { id },
            select: {
                tipoGasto:      true,
                productoId:     true,
                cantidad:       true,
                equipoId:       true,
            },
        });

        if (!gasto)
            return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });

        if (gasto.tipoGasto === 'INSUMO' && gasto.productoId) {
            // Revertir en transacción: eliminar movimiento de salida + restaurar stock + borrar gasto
            await prisma.$transaction(async (tx) => {
                // 1. Eliminar el MovimientoInventario vinculado (referencia por equipoId)
                //    Buscamos el movimiento tipo SALIDA más reciente con la misma referencia
                const movimiento = await tx.movimientoInventario.findFirst({
                    where: {
                        empresaId:      user.empresaId,
                        productoId:     gasto.productoId!,
                        tipoMovimiento: 'SALIDA',
                        referencia:     `GASTO-EQUIPO:${gasto.equipoId}`,
                    },
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, cantidad: true },
                });

                if (movimiento) {
                    await tx.movimientoInventario.delete({ where: { id: movimiento.id } });
                    // 2. Restaurar el stock
                    await tx.producto.update({
                        where: { id: gasto.productoId! },
                        data:  { stockActual: { increment: Number(movimiento.cantidad) } },
                    });
                }

                // 3. Eliminar el gasto
                await tx.gastoOperativo.delete({ where: { id } });
            });
        } else {
            // Gasto EXTERNO: borrado simple sin impacto al inventario
            await prisma.gastoOperativo.delete({ where: { id } });
        }

        return Response.json({ message: 'Gasto eliminado correctamente' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
        console.error(error);
        return Response.json({ error: 'Error al eliminar el gasto' }, { status: 500 });
    }
}

// ─── PUT /api/gastos-operativos/[id] ──────────────────────────────────────────
// Solo permite editar campos de presentación (categoría, notas, moneda).
// No se permite cambiar tipoGasto ni productoId después de creado
// para preservar la integridad del Kardex.
export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const {
            categoria, unidad,
            cantidad, precioUnitario, moneda,
            tipoCambio, obraId, plantillaId, notas,
        } = await req.json();

        const gasto = await prisma.gastoOperativo.update({
            where: { id },
            data: {
                ...(categoria      !== undefined && { categoria }),
                ...(unidad         !== undefined && { unidad }),
                ...(cantidad       !== undefined && { cantidad:       Number(cantidad) }),
                ...(precioUnitario !== undefined && { precioUnitario: Number(precioUnitario) }),
                ...(moneda         !== undefined && { moneda: moneda === 'USD' ? 'USD' : 'MXN' }),
                ...(tipoCambio     !== undefined && { tipoCambio: tipoCambio != null ? Number(tipoCambio) : null }),
                ...(obraId         !== undefined && { obraId: obraId || null }),
                ...(plantillaId    !== undefined && { plantillaId: plantillaId || null }),
                ...(notas          !== undefined && { notas: notas || null }),
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

