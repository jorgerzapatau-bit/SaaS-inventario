import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

async function calculateStock(empresaId: string, productoId: string, almacenId?: string): Promise<number> {
    const where: Record<string, unknown> = { empresaId, productoId };
    if (almacenId) where.almacenId = almacenId;
    const pos = await prisma.movimientoInventario.aggregate({ _sum: { cantidad: true }, where: { ...where, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } } as Parameters<typeof prisma.movimientoInventario.aggregate>[0]['where'] });
    const neg = await prisma.movimientoInventario.aggregate({ _sum: { cantidad: true }, where: { ...where, tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] } } as Parameters<typeof prisma.movimientoInventario.aggregate>[0]['where'] });
    return (pos._sum.cantidad || 0) - (neg._sum.cantidad || 0);
}

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { searchParams } = new URL(req.url);
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
        const movements = await prisma.movimientoInventario.findMany({
            where: { empresaId: user.empresaId },
            orderBy: { fecha: 'desc' },
            ...(limit ? { take: limit } : {}),
            include: {
                producto:  { select: { nombre: true } },
                almacen:   { select: { nombre: true } },
                usuario:   { select: { nombre: true } },
                proveedor: { select: { nombre: true } },
                compra:    { select: { id: true, referencia: true, status: true } },
            }
        });
        return Response.json(movements.map((m: any) => ({
            ...m,
            motivo: m.referencia || (m.tipoMovimiento === 'ENTRADA' ? 'Compra' : 'Salida')
        })));
    } catch { return Response.json({ error: 'Error fetching movements' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const {
            productoId, almacenId, tipoMovimiento, cantidad,
            costoUnitario, precioVenta, proveedorId, clienteId,
            clienteNombre, referencia, fecha
        } = await req.json();

        if (!['ENTRADA', 'SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'].includes(tipoMovimiento))
            return Response.json({ error: 'Invalid movement type' }, { status: 400 });
        if (cantidad <= 0)
            return Response.json({ error: 'Quantity must be positive' }, { status: 400 });

        if (['SALIDA', 'AJUSTE_NEGATIVO'].includes(tipoMovimiento)) {
            const stock = await calculateStock(user.empresaId, productoId, almacenId);
            if (stock < cantidad)
                return Response.json({ error: `Stock insuficiente. Stock actual: ${stock}` }, { status: 400 });
        }

        const cantidadInt    = parseInt(String(cantidad));
        const costoFloat     = parseFloat(String(costoUnitario || 0));
        const precioVentaVal = precioVenta != null ? parseFloat(String(precioVenta)) : null;
        const fechaVal       = fecha ? new Date(fecha) : new Date();

        // Si es ENTRADA con proveedor -> crear Compra + Movimiento juntos
        if (tipoMovimiento === 'ENTRADA' && proveedorId) {
            const result = await prisma.$transaction(async (tx) => {
                const refCompra = referencia || await generateRef(tx, user.empresaId);
                const compra = await tx.compra.create({
                    data: {
                        empresaId:  user.empresaId,
                        proveedorId,
                        referencia: refCompra,
                        total:      cantidadInt * costoFloat,
                        status:     'COMPLETADA',
                        fecha:      fechaVal,
                        detalles: {
                            create: [{
                                productoId,
                                cantidad:       cantidadInt,
                                precioUnitario: costoFloat,
                            }]
                        }
                    }
                });
                const movement = await tx.movimientoInventario.create({
                    data: {
                        empresaId:     user.empresaId,
                        productoId,
                        almacenId,
                        tipoMovimiento: 'ENTRADA',
                        cantidad:       cantidadInt,
                        costoUnitario:  costoFloat,
                        precioVenta:    precioVentaVal,
                        proveedorId,
                        clienteId:      clienteId || null,
                        clienteNombre:  clienteNombre || null,
                        compraId:       compra.id,
                        referencia:     refCompra,
                        fecha:          fechaVal,
                        usuarioId:      user.id,
                    },
                    include: {
                        proveedor: { select: { nombre: true } },
                        almacen:   { select: { nombre: true } },
                        usuario:   { select: { nombre: true } },
                        compra:    { select: { id: true, referencia: true, status: true } },
                    }
                });
                return movement;
            });
            return Response.json(result, { status: 201 });
        }

        // Cualquier otro movimiento (SALIDA, AJUSTE, ENTRADA sin proveedor)
        const movement = await prisma.movimientoInventario.create({
            data: {
                empresaId:     user.empresaId,
                productoId,
                almacenId,
                tipoMovimiento,
                cantidad:      cantidadInt,
                costoUnitario: costoFloat,
                precioVenta:   precioVentaVal,
                proveedorId:   proveedorId || null,
                clienteId:     clienteId   || null,
                clienteNombre: clienteNombre || null,
                referencia:    referencia || null,
                fecha:         fechaVal,
                usuarioId:     user.id,
            },
            include: {
                proveedor: { select: { nombre: true } },
                almacen:   { select: { nombre: true } },
                usuario:   { select: { nombre: true } },
            }
        });
        return Response.json(movement, { status: 201 });

    } catch (error: unknown) {
        console.error(error);
        return Response.json({ error: (error as Error)?.message || 'Error registering movement' }, { status: 500 });
    }
}

// Genera referencia tipo OC-2026-0001 unica por empresa
async function generateRef(tx: any, empresaId: string): Promise<string> {
    const year  = new Date().getFullYear();
    const count = await tx.compra.count({ where: { empresaId } });
    return 'OC-' + year + '-' + String(count + 1).padStart(4, '0');
}
