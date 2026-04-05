import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Lee el stockActual directamente del campo almacenado (rápido, sin SUM)
async function getStockActual(empresaId: string, productoId: string): Promise<number> {
    const producto = await prisma.producto.findFirst({
        where: { id: productoId, empresaId },
        select: { stockActual: true },
    });
    return Number(producto?.stockActual ?? 0);
}

// Actualiza stockActual en el producto sumando o restando la cantidad del movimiento
async function actualizarStock(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    empresaId: string,
    productoId: string,
    tipoMovimiento: string,
    cantidad: number
) {
    const delta = ['ENTRADA', 'AJUSTE_POSITIVO'].includes(tipoMovimiento)
        ? cantidad
        : -cantidad;

    await tx.producto.update({
        where: { id: productoId, empresaId },
        data: { stockActual: { increment: delta } },
    });
}

// Genera referencia tipo OC-2026-0001 única por empresa
async function generateRef(tx: any, empresaId: string): Promise<string> {
    const year  = new Date().getFullYear();
    const count = await tx.compra.count({ where: { empresaId } });
    return 'OC-' + year + '-' + String(count + 1).padStart(4, '0');
}

// ─── GET /api/inventory/movements ────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { searchParams } = new URL(req.url);
        const limit      = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
        const productoId = searchParams.get('productoId') || undefined;
        const moneda     = searchParams.get('moneda') || undefined;

        const movements = await prisma.movimientoInventario.findMany({
            where: {
                empresaId: user.empresaId,
                ...(productoId && { productoId }),
                ...(moneda     && { moneda: moneda as 'MXN' | 'USD' }),
            },
            orderBy: { fecha: 'desc' },
            ...(limit ? { take: limit } : {}),
            include: {
                producto:  { select: { nombre: true, unidad: true, moneda: true } },
                almacen:   { select: { nombre: true } },
                usuario:   { select: { nombre: true } },
                proveedor: { select: { nombre: true } },
                compra:    { select: { id: true, referencia: true, status: true } },
            },
        });

        return Response.json(movements.map((m: any) => ({
            ...m,
            cantidad:      Number(m.cantidad),
            costoUnitario: Number(m.costoUnitario),
            precioVenta:   m.precioVenta   ? Number(m.precioVenta)   : null,
            tipoCambio:    m.tipoCambio    ? Number(m.tipoCambio)    : null,
            motivo:        m.referencia || (m.tipoMovimiento === 'ENTRADA' ? 'Compra' : 'Consumo'),
        })));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error fetching movements' }, { status: 500 });
    }
}

// ─── POST /api/inventory/movements ───────────────────────────────────────────
// Registra un movimiento y actualiza stockActual en el producto automáticamente.
// Acepta moneda (MXN | USD) y tipoCambio opcional.
export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const {
            productoId, almacenId, tipoMovimiento,
            cantidad, costoUnitario,
            moneda, tipoCambio,
            precioVenta, proveedorId,
            clienteId, clienteNombre,
            referencia, notas, fecha,
            registroDiarioId,
        } = await req.json();

        // ── Validaciones básicas ──
        if (!['ENTRADA', 'SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'].includes(tipoMovimiento))
            return Response.json({ error: 'Tipo de movimiento inválido' }, { status: 400 });
        if (!cantidad || Number(cantidad) <= 0)
            return Response.json({ error: 'La cantidad debe ser mayor a 0' }, { status: 400 });
        if (!productoId || !almacenId)
            return Response.json({ error: 'productoId y almacenId son requeridos' }, { status: 400 });

        const cantidadNum    = Number(cantidad);
        const costoNum       = Number(costoUnitario || 0);
        const precioVentaNum = precioVenta  != null ? Number(precioVenta)  : null;
        const tipoCambioNum  = tipoCambio   != null ? Number(tipoCambio)   : null;
        const monedaVal      = moneda === 'USD' ? 'USD' : 'MXN';
        const fechaVal       = fecha ? new Date(fecha) : new Date();

        // ── Verificar stock suficiente para salidas ──
        if (['SALIDA', 'AJUSTE_NEGATIVO'].includes(tipoMovimiento)) {
            const stockActual = await getStockActual(user.empresaId, productoId);
            if (stockActual < cantidadNum)
                return Response.json(
                    { error: `Stock insuficiente. Stock actual: ${stockActual}` },
                    { status: 400 }
                );
        }

        // ── ENTRADA con proveedor → crear Compra + Movimiento en transacción ──
        if (tipoMovimiento === 'ENTRADA' && proveedorId) {
            const result = await prisma.$transaction(async (tx) => {
                const refCompra = referencia || await generateRef(tx, user.empresaId);

                const compra = await tx.compra.create({
                    data: {
                        empresaId:   user.empresaId,
                        proveedorId,
                        referencia:  refCompra,
                        total:       cantidadNum * costoNum,
                        moneda:      monedaVal,
                        tipoCambio:  tipoCambioNum,
                        status:      'COMPLETADA',
                        fecha:       fechaVal,
                        notas:       notas || null,
                        detalles: {
                            create: [{
                                productoId,
                                cantidad:       cantidadNum,
                                precioUnitario: costoNum,
                                moneda:         monedaVal,
                            }],
                        },
                    },
                });

                const movement = await tx.movimientoInventario.create({
                    data: {
                        empresaId:        user.empresaId,
                        productoId,
                        almacenId,
                        tipoMovimiento:   'ENTRADA',
                        cantidad:         cantidadNum,
                        costoUnitario:    costoNum,
                        moneda:           monedaVal,
                        tipoCambio:       tipoCambioNum,
                        precioVenta:      precioVentaNum,
                        proveedorId,
                        clienteId:        clienteId        || null,
                        clienteNombre:    clienteNombre    || null,
                        compraId:         compra.id,
                        registroDiarioId: registroDiarioId || null,
                        referencia:       refCompra,
                        notas:            notas || null,
                        fecha:            fechaVal,
                        usuarioId:        user.id,
                    },
                    include: {
                        proveedor: { select: { nombre: true } },
                        almacen:   { select: { nombre: true } },
                        usuario:   { select: { nombre: true } },
                        compra:    { select: { id: true, referencia: true, status: true } },
                    },
                });

                // ── Actualizar stockActual en el producto ──
                await actualizarStock(tx, user.empresaId, productoId, 'ENTRADA', cantidadNum);

                return movement;
            });

            return Response.json({
                ...result,
                cantidad:      Number(result.cantidad),
                costoUnitario: Number(result.costoUnitario),
            }, { status: 201 });
        }

        // ── Cualquier otro movimiento (SALIDA, AJUSTE, ENTRADA sin proveedor) ──
        const result = await prisma.$transaction(async (tx) => {
            const movement = await tx.movimientoInventario.create({
                data: {
                    empresaId:        user.empresaId,
                    productoId,
                    almacenId,
                    tipoMovimiento,
                    cantidad:         cantidadNum,
                    costoUnitario:    costoNum,
                    moneda:           monedaVal,
                    tipoCambio:       tipoCambioNum,
                    precioVenta:      precioVentaNum,
                    proveedorId:      proveedorId      || null,
                    clienteId:        clienteId        || null,
                    clienteNombre:    clienteNombre    || null,
                    registroDiarioId: registroDiarioId || null,
                    referencia:       referencia       || null,
                    notas:            notas            || null,
                    fecha:            fechaVal,
                    usuarioId:        user.id,
                },
                include: {
                    proveedor: { select: { nombre: true } },
                    almacen:   { select: { nombre: true } },
                    usuario:   { select: { nombre: true } },
                },
            });

            await actualizarStock(tx, user.empresaId, productoId, tipoMovimiento, cantidadNum);

            return movement;
        });

        return Response.json({
            ...result,
            cantidad:      Number(result.cantidad),
            costoUnitario: Number(result.costoUnitario),
        }, { status: 201 });

    } catch (error: unknown) {
        console.error(error);
        return Response.json({ error: (error as Error)?.message || 'Error registrando movimiento' }, { status: 500 });
    }
}
