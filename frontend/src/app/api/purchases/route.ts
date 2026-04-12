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
// Maneja dos flujos distintos según el campo `tipo`:
//
//   tipo = "COMPRA"          → requiere proveedorId, crea Compra + DetalleCompra + Movimientos
//   tipo = "AJUSTE_POSITIVO" → NO requiere proveedorId, crea solo Movimientos AJUSTE_POSITIVO
//
export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const {
            tipo = 'COMPRA',
            proveedorId,
            detalles,
            total,
            almacenId,
            status,
            moneda,
            tipoCambio,
            referencia: referenciaBody,
            notas,
            fecha: fechaBody,
        } = await req.json();

        // Validación común
        if (!detalles?.length)
            return Response.json({ error: 'Se requiere al menos un producto' }, { status: 400 });
        if (detalles.some((d: any) => !d.productoId || Number(d.cantidad) <= 0))
            return Response.json({ error: 'Todos los productos deben tener cantidad mayor a 0' }, { status: 400 });

        const empresaId     = user.empresaId;
        const usuarioId     = user.id;
        const monedaVal     = moneda === 'USD' ? 'USD' : 'MXN';
        const tipoCambioNum = tipoCambio != null ? Number(tipoCambio) : null;
        const fechaVal      = fechaBody ? new Date(fechaBody) : new Date();

        // Resolver almacén (usa el primero de la empresa si no se especifica)
        let targetAlmacenId = almacenId;
        if (!targetAlmacenId) {
            const first = await prisma.almacen.findFirst({ where: { empresaId } });
            if (!first)
                return Response.json({ error: 'No hay almacenes registrados. Crea uno primero.' }, { status: 400 });
            targetAlmacenId = first.id;
        }

        // ── FLUJO AJUSTE POSITIVO ─────────────────────────────────────────────
        // No necesita proveedor ni crear una Compra formal.
        // Crea movimientos AJUSTE_POSITIVO y actualiza stockActual directamente.
        if (tipo === 'AJUSTE_POSITIVO') {
            const referencia = referenciaBody?.trim() || `AJ-${new Date().getFullYear()}-${Date.now()}`;

            await prisma.$transaction(async (tx) => {
                // IMPORTANTE: usar for...of en lugar de Promise.all dentro de $transaction.
                // Prisma interactive transactions usan una sola conexión; Promise.all concurrente
                // puede causar deadlock o ejecutar operaciones fuera del contexto transaccional.
                for (const d of detalles as { productoId: string; cantidad: number; precioUnitario: number; moneda?: string }[]) {
                    const cantidadNum = Number(d.cantidad);
                    const costoNum    = Number(d.precioUnitario ?? 0);
                    const detMoneda   = d.moneda === 'USD' ? 'USD' : monedaVal;

                    await tx.movimientoInventario.create({
                        data: {
                            empresaId,
                            productoId:     d.productoId,
                            almacenId:      targetAlmacenId,
                            tipoMovimiento: 'AJUSTE_POSITIVO',
                            cantidad:       cantidadNum,
                            costoUnitario:  costoNum,
                            moneda:         detMoneda,
                            tipoCambio:     tipoCambioNum,
                            referencia,
                            notas:          notas || null,
                            usuarioId,
                            fecha:          fechaVal,
                        },
                    });

                    // Actualizar stockActual en el producto
                    await tx.producto.update({
                        where: { id: d.productoId },
                        data:  { stockActual: { increment: cantidadNum } },
                    });
                }
            });

            return Response.json({ ok: true, tipo: 'AJUSTE_POSITIVO', referencia }, { status: 201 });
        }

        // ── FLUJO COMPRA FORMAL ───────────────────────────────────────────────
        // Requiere proveedorId. Crea Compra + DetalleCompra.
        // Solo mueve inventario si status === 'COMPLETADA'.
        if (!proveedorId)
            return Response.json({ error: 'Debes seleccionar un proveedor para registrar una compra.' }, { status: 400 });

        const statusFinal: 'PENDIENTE' | 'COMPLETADA' = status === 'COMPLETADA' ? 'COMPLETADA' : 'PENDIENTE';

        const result = await prisma.$transaction(async (tx) => {
            // Generar referencia automática si no viene
            let referencia = referenciaBody?.trim();
            if (!referencia) {
                const year  = new Date().getFullYear();
                const count = await tx.compra.count({ where: { empresaId } });
                referencia  = 'OC-' + year + '-' + String(count + 1).padStart(4, '0');
            }

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
                    fecha:      fechaVal,
                    detalles: {
                        create: detalles.map((d: { productoId: string; cantidad: number; precioUnitario: number; moneda?: string }) => ({
                            productoId:     d.productoId,
                            cantidad:       Number(d.cantidad),
                            precioUnitario: Number(d.precioUnitario),
                            moneda:         d.moneda === 'USD' ? 'USD' : monedaVal,
                        })),
                    },
                },
            });

            // Solo mover inventario si la compra está COMPLETADA
            if (statusFinal === 'COMPLETADA') {
                for (const d of detalles as { productoId: string; cantidad: number; precioUnitario: number; moneda?: string }[]) {
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
                            referencia:     compra.referencia,
                            usuarioId,
                            fecha:          fechaVal,
                        },
                    });

                    await tx.producto.update({
                        where: { id: d.productoId },
                        data:  { stockActual: { increment: Number(d.cantidad) } },
                    });
                }
            }

            return compra;
        });

        return Response.json(result, { status: 201 });

    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al registrar la entrada' }, { status: 500 });
    }
}
