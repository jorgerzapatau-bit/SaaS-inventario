import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        // 1. Compras formales (creadas desde MovimientoModal con proveedor, o desde /purchases/new)
        const compras = await prisma.compra.findMany({
            where: { empresaId: user.empresaId },
            orderBy: { fecha: 'desc' },
            include: {
                proveedor: true,
                detalles: {
                    include: { producto: { select: { nombre: true, sku: true, unidad: true } } }
                },
                movimientos: {
                    select: { id: true, cantidad: true, costoUnitario: true, fecha: true, almacen: { select: { nombre: true } } }
                }
            }
        });

        // 2. Entradas antiguas sin compraId (registradas antes de esta mejora)
        const entradasHuerfanas = await prisma.movimientoInventario.findMany({
            where: {
                empresaId:     user.empresaId,
                tipoMovimiento: 'ENTRADA',
                proveedorId:   { not: null },
                compraId:      null,
            },
            orderBy: { fecha: 'desc' },
            include: {
                proveedor: true,
                producto:  { select: { nombre: true, sku: true, unidad: true } },
                almacen:   { select: { nombre: true } },
                usuario:   { select: { nombre: true } },
            }
        });

        // Convertir entradas huérfanas al mismo shape que Compra para el frontend
        const huerfanasComoCompras = entradasHuerfanas.map(m => ({
            id:          m.id,
            empresaId:   m.empresaId,
            proveedorId: m.proveedorId,
            proveedor:   m.proveedor,
            referencia:  m.referencia || 'Entrada directa',
            fecha:       m.fecha,
            total:       Number(m.costoUnitario) * m.cantidad,
            status:      'COMPLETADA' as const,
            createdAt:   m.createdAt,
            updatedAt:   m.createdAt,
            esHuerfana:  true,   // flag para el frontend
            detalles: [{
                id:             m.id,
                compraId:       m.id,
                productoId:     m.productoId,
                producto:       m.producto,
                cantidad:       m.cantidad,
                precioUnitario: m.costoUnitario,
            }],
            movimientos: [{
                id:           m.id,
                cantidad:     m.cantidad,
                costoUnitario: m.costoUnitario,
                fecha:        m.fecha,
                almacen:      m.almacen,
            }]
        }));

        // Unir y ordenar por fecha descendente
        const todas = [...compras.map(c => ({ ...c, esHuerfana: false })), ...huerfanasComoCompras]
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return Response.json(todas);
    } catch (e) {
        console.error(e);
        return Response.json({ error: 'Error fetching purchases' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { proveedorId, detalles, total, almacenId, status } = await req.json();
        const empresaId = user.empresaId;
        const usuarioId = user.id;

        // Status válidos; si no se envía, queda PENDIENTE (default del schema)
        const statusFinal: 'PENDIENTE' | 'COMPLETADA' = status === 'COMPLETADA' ? 'COMPLETADA' : 'PENDIENTE';

        let targetAlmacenId = almacenId;
        if (!targetAlmacenId) {
            const first = await prisma.almacen.findFirst({ where: { empresaId } });
            if (!first) return Response.json({ error: 'No warehouse found for company' }, { status: 400 });
            targetAlmacenId = first.id;
        }

        const result = await prisma.$transaction(async (tx) => {
            // Generar referencia automática
            const year  = new Date().getFullYear();
            const count = await tx.compra.count({ where: { empresaId } });
            const referencia = 'OC-' + year + '-' + String(count + 1).padStart(4, '0');

            const compra = await tx.compra.create({
                data: {
                    empresaId, proveedorId, total, referencia, status: statusFinal,
                    detalles: {
                        create: detalles.map((d: { productoId: string; cantidad: number; precioUnitario: number }) => ({
                            productoId: d.productoId,
                            cantidad: d.cantidad,
                            precioUnitario: d.precioUnitario
                        }))
                    }
                }
            });

            // Solo crear movimientos de inventario si la compra se marca como COMPLETADA
            // (los productos ya llegaron físicamente al almacén)
            if (statusFinal === 'COMPLETADA') {
                await Promise.all(
                    detalles.map((d: { productoId: string; cantidad: number; precioUnitario: number }) =>
                        tx.movimientoInventario.create({
                            data: {
                                empresaId,
                                productoId:     d.productoId,
                                almacenId:      targetAlmacenId,
                                tipoMovimiento: 'ENTRADA',
                                cantidad:       d.cantidad,
                                costoUnitario:  d.precioUnitario,
                                proveedorId,
                                compraId:       compra.id,
                                referencia:     referencia,
                                usuarioId,
                            }
                        })
                    )
                );
            }

            return compra;
        });

        return Response.json(result, { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error registering purchase' }, { status: 500 });
    }
}
