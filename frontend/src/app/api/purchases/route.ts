import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

// ─── GET /api/purchases ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const compras = await prisma.compra.findMany({
            where: { empresaId: user.empresaId },
            orderBy: { fecha: 'desc' },
            include: {
                proveedor: true,
                detalles: {
                    include: {
                        producto: { select: { nombre: true, sku: true, unidad: true, moneda: true } },
                    },
                },
                movimientos: {
                    select: {
                        id: true, cantidad: true, costoUnitario: true,
                        moneda: true, tipoCambio: true,
                        fecha: true, almacen: { select: { nombre: true } },
                    },
                },
            },
        });

        // Entradas registradas directamente (sin orden de compra formal)
        const entradasHuerfanas = await prisma.movimientoInventario.findMany({
            where: {
                empresaId:      user.empresaId,
                tipoMovimiento: 'ENTRADA',
                proveedorId:    { not: null },
                compraId:       null,
            },
            orderBy: { fecha: 'desc' },
            include: {
                proveedor: true,
                producto:  { select: { nombre: true, sku: true, unidad: true, moneda: true } },
                almacen:   { select: { nombre: true } },
                usuario:   { select: { nombre: true } },
            },
        });

        const huerfanasComoCompras = entradasHuerfanas.map(m => ({
            id:          m.id,
            empresaId:   m.empresaId,
            proveedorId: m.proveedorId,
            proveedor:   m.proveedor,
            referencia:  m.referencia || 'Entrada directa',
            fecha:       m.fecha,
            total:       Number(m.costoUnitario) * Number(m.cantidad),
            moneda:      m.moneda,
            tipoCambio:  m.tipoCambio ? Number(m.tipoCambio) : null,
            status:      'COMPLETADA' as const,
            createdAt:   m.createdAt,
            updatedAt:   m.createdAt,
            esHuerfana:  true,
            detalles: [{
                id:             m.id,
                compraId:       m.id,
                productoId:     m.productoId,
                producto:       m.producto,
                cantidad:       Number(m.cantidad),
                precioUnitario: Number(m.costoUnitario),
                moneda:         m.moneda,
            }],
            movimientos: [{
                id:            m.id,
                cantidad:      Number(m.cantidad),
                costoUnitario: Number(m.costoUnitario),
                moneda:        m.moneda,
                tipoCambio:    m.tipoCambio ? Number(m.tipoCambio) : null,
                fecha:         m.fecha,
                almacen:       m.almacen,
            }],
        }));

        const todas = [
            ...compras.map(c => ({
                ...c,
                total:      Number(c.total),
                tipoCambio: c.tipoCambio ? Number(c.tipoCambio) : null,
                esHuerfana: false,
                detalles: c.detalles.map(d => ({
                    ...d,
                    cantidad:       Number(d.cantidad),
                    precioUnitario: Number(d.precioUnitario),
                })),
                movimientos: c.movimientos.map(m => ({
                    ...m,
                    cantidad:      Number(m.cantidad),
                    costoUnitario: Number(m.costoUnitario),
                    tipoCambio:    m.tipoCambio ? Number(m.tipoCambio) : null,
                })),
            })),
            ...huerfanasComoCompras,
        ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return Response.json(todas);
    } catch (e) {
        console.error(e);
        return Response.json({ error: 'Error fetching purchases' }, { status: 500 });
    }
}

// ─── POST /api/purchases ──────────────────────────────────────────────────────
// Crea una orden de compra y actualiza stockActual si status = COMPLETADA.
// Acepta moneda (MXN | USD) y tipoCambio por detalle y a nivel de compra.
export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const {
            proveedorId, detalles, total,
            almacenId, status,
            moneda, tipoCambio,
            notas,
        } = await req.json();

        if (!proveedorId || !detalles?.length)
            return Response.json({ error: 'proveedorId y detalles son requeridos' }, { status: 400 });

        const empresaId    = user.empresaId;
        const usuarioId    = user.id;
        const monedaVal    = moneda === 'USD' ? 'USD' : 'MXN';
        const tipoCambioNum = tipoCambio != null ? Number(tipoCambio) : null;
        const statusFinal: 'PENDIENTE' | 'COMPLETADA' = status === 'COMPLETADA' ? 'COMPLETADA' : 'PENDIENTE';

        // Resolver almacén
        let targetAlmacenId = almacenId;
        if (!targetAlmacenId) {
            const first = await prisma.almacen.findFirst({ where: { empresaId } });
            if (!first) return Response.json({ error: 'No hay almacenes registrados' }, { status: 400 });
            targetAlmacenId = first.id;
        }

        const result = await prisma.$transaction(async (tx) => {
            // Generar referencia automática
            const year      = new Date().getFullYear();
            const count     = await tx.compra.count({ where: { empresaId } });
            const referencia = 'OC-' + year + '-' + String(count + 1).padStart(4, '0');

            const compra = await tx.compra.create({
                data: {
                    empresaId,
                    proveedorId,
                    total:      total ?? 0,
                    moneda:     monedaVal,
                    tipoCambio: tipoCambioNum,
                    referencia,
                    status:     statusFinal,
                    notas:      notas || null,
                    detalles: {
                        create: detalles.map((d: {
                            productoId: string;
                            cantidad: number;
                            precioUnitario: number;
                            moneda?: string;
                        }) => ({
                            productoId:     d.productoId,
                            cantidad:       Number(d.cantidad),
                            precioUnitario: Number(d.precioUnitario),
                            moneda:         d.moneda === 'USD' ? 'USD' : monedaVal,
                        })),
                    },
                },
            });

            // Solo mover inventario si la compra está COMPLETADA (productos físicamente recibidos)
            if (statusFinal === 'COMPLETADA') {
                await Promise.all(
                    detalles.map(async (d: {
                        productoId: string;
                        cantidad: number;
                        precioUnitario: number;
                        moneda?: string;
                    }) => {
                        const detalleMoneda = d.moneda === 'USD' ? 'USD' : monedaVal;

                        await tx.movimientoInventario.create({
                            data: {
                                empresaId,
                                productoId:     d.productoId,
                                almacenId:      targetAlmacenId,
                                tipoMovimiento: 'ENTRADA',
                                cantidad:       Number(d.cantidad),
                                costoUnitario:  Number(d.precioUnitario),
                                moneda:         detalleMoneda,
                                tipoCambio:     tipoCambioNum,
                                proveedorId,
                                compraId:       compra.id,
                                referencia,
                                usuarioId,
                            },
                        });

                        // ── Actualizar stockActual ──
                        await tx.producto.update({
                            where: { id: d.productoId, empresaId },
                            data:  { stockActual: { increment: Number(d.cantidad) } },
                        });
                    })
                );
            }

            return compra;
        });

        return Response.json(result, { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al registrar la compra' }, { status: 500 });
    }
}
