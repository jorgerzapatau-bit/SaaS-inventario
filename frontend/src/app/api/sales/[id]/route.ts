import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

// ── GET /api/sales/:id — Cargar una salida formal para editar ─────────────────
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    const { id } = await params;

    try {
        const salida = await prisma.salida.findFirst({
            where: { id },
            include: {
                usuario:  { select: { nombre: true, email: true } },
                detalles: {
                    include: {
                        producto: { select: { nombre: true, sku: true, unidad: true } },
                    },
                },
            },
        });

        if (!salida) {
            return Response.json({ error: 'Salida no encontrada' }, { status: 404 });
        }

        // Buscar clienteId desde el movimiento espejo si existe
        const movEspejo = await prisma.movimientoInventario.findFirst({
            where: {
                empresaId: user.empresaId,
                referencia: { startsWith: `${salida.tipo}|` },
            },
            select: { clienteId: true },
        });

        return Response.json({
            id:            salida.id,
            tipo:          salida.tipo,
            referencia:    salida.referencia,
            clienteNombre: salida.clienteNombre,
            clienteId:     movEspejo?.clienteId ?? null,
            fecha:         salida.fecha,
            detalles: salida.detalles.map(d => ({
                id:             d.id,
                productoId:     d.productoId,
                producto:       d.producto,
                cantidad:       d.cantidad,
                precioUnitario: Number(d.precioUnitario),
            })),
        });
    } catch (e) {
        console.error(e);
        return Response.json({ error: 'Error al cargar la salida' }, { status: 500 });
    }
}

// ── PUT /api/sales/:id — Editar una salida formal ────────────────────────────
// Estrategia: eliminar movimientos espejo originales → crear los nuevos
// El stock NO se guarda en Producto.stock — se deriva de MovimientoInventario.
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    const { id } = await params;

    try {
        const { tipo, referencia, clienteId, detalles } = await req.json();

        // Validación básica
        if (tipo === 'VENTA' && !clienteId) {
            return Response.json(
                { error: 'El campo clienteId es obligatorio para una salida de tipo Venta.' },
                { status: 400 }
            );
        }

        const tiposValidos = ['VENTA', 'AJUSTE_NEGATIVO'];
        if (!tiposValidos.includes(tipo)) {
            return Response.json({ error: `Tipo inválido: ${tipo}` }, { status: 400 });
        }

        // Verificar que la salida existe y pertenece a la empresa
        const salidaExistente = await prisma.salida.findFirst({
            where: { id },
            include: { detalles: true },
        });

        if (!salidaExistente) {
            return Response.json({ error: 'Salida no encontrada' }, { status: 404 });
        }

        // Resolver almacén principal
        const almacen = await prisma.almacen.findFirst({
            where: { empresaId: user.empresaId },
        });
        if (!almacen) {
            return Response.json({ error: 'No se encontró almacén para la empresa' }, { status: 400 });
        }

        // Resolver nombre del cliente
        let clienteNombre: string | null = null;
        if (clienteId) {
            const cliente = await prisma.cliente.findUnique({
                where: { id: clienteId },
                select: { nombre: true },
            });
            clienteNombre = cliente?.nombre ?? null;
        }

        const total = detalles.reduce(
            (acc: number, d: any) => acc + Number(d.precioUnitario) * Number(d.cantidad),
            0
        );

        await prisma.$transaction(async (tx) => {
            // ── 1. Eliminar movimientos espejo originales ─────────────────────
            // Los movimientos de inventario son la fuente de verdad del stock;
            // eliminarlos es equivalente a "revertir" el efecto de la salida original.
            await tx.movimientoInventario.deleteMany({
                where: {
                    empresaId:  user.empresaId,
                    referencia: `${salidaExistente.tipo}|${salidaExistente.referencia ?? ''}`,
                },
            });

            // ── 2. Eliminar detalles originales ───────────────────────────────
            await tx.detalleSalida.deleteMany({
                where: { salidaId: id },
            });

            // ── 3. Actualizar cabecera de la Salida ───────────────────────────
            await tx.salida.update({
                where: { id },
                data: {
                    tipo:          tipo as any,
                    referencia,
                    clienteNombre: clienteNombre ?? null,
                },
            });

            // ── 4. Crear nuevos detalles ──────────────────────────────────────
            await tx.detalleSalida.createMany({
                data: detalles.map((d: any) => ({
                    salidaId:       id,
                    productoId:     d.productoId,
                    cantidad:       Number(d.cantidad),
                    precioUnitario: Number(d.precioUnitario),
                })),
            });

            // ── 5. Crear nuevos movimientos espejo ────────────────────────────
            // Estos son los que reducen el stock (cantidad negativa en el cálculo
            // de stock disponible en las consultas del dashboard).
            await tx.movimientoInventario.createMany({
                data: detalles.map((d: any) => ({
                    empresaId:      user.empresaId,
                    productoId:     d.productoId,
                    almacenId:      almacen.id,
                    tipoMovimiento: tipo === 'AJUSTE_NEGATIVO' ? 'AJUSTE_NEGATIVO' : 'SALIDA',
                    cantidad:       Number(d.cantidad),
                    costoUnitario:  Number(d.precioUnitario),
                    precioVenta:    tipo === 'VENTA' ? Number(d.precioUnitario) : null,
                    referencia:     `${tipo}|${referencia || ''}`,
                    usuarioId:      user.id,
                    clienteId:      clienteId || null,
                    clienteNombre:  clienteNombre ?? null,
                })),
            });
        });

        return Response.json({ ok: true, id, total });
    } catch (e: any) {
        console.error(e);
        return Response.json({ error: e.message || 'Error al editar la salida' }, { status: 500 });
    }
}
