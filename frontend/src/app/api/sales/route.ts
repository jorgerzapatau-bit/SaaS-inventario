import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseTipoYRef(referencia: string | null): { tipo: string; refLimpia: string | null } {
    if (!referencia) return { tipo: 'VENTA', refLimpia: null };
    const TIPOS = ['VENTA', 'CONSUMO_INTERNO', 'PERDIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'];
    const pipeIdx = referencia.indexOf('|');
    if (pipeIdx !== -1) {
        const prefix = referencia.slice(0, pipeIdx);
        if (TIPOS.includes(prefix)) {
            const refLimpia = referencia.slice(pipeIdx + 1) || null;
            return { tipo: prefix, refLimpia };
        }
    }
    // Datos legacy sin prefijo → VENTA por defecto
    return { tipo: 'VENTA', refLimpia: referencia };
}

// Tipos que descuentan stock (movimiento de salida real)
const TIPOS_DESCUENTO  = ['VENTA', 'CONSUMO_INTERNO', 'PERDIDA', 'AJUSTE_NEGATIVO'];
// Tipos que suman stock (ajuste positivo)
const TIPOS_INCREMENTO = ['AJUSTE_POSITIVO'];

// ── GET /api/sales ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    try {
        // 1. Salidas formales (modelo Salida, desde /sales/new)
        const salidasFormales = await prisma.salida.findMany({
            where: { empresaId: user.empresaId },
            include: {
                usuario:  { select: { nombre: true, email: true } },
                detalles: { include: { producto: { select: { nombre: true, sku: true, unidad: true } } } },
            },
            orderBy: { fecha: 'desc' },
        });

        const formalesNormalizadas = salidasFormales.map(s => ({
            id:            s.id,
            tipo:          s.tipo as string,
            referencia:    s.referencia,
            fecha:         s.fecha,
            // clienteNombre puede venir del campo directo (guardado en POST)
            clienteNombre: (s as any).clienteNombre ?? null,
            usuario:       s.usuario,
            esFormal:      true,
            detalles: s.detalles.map(d => ({
                id:             d.id,
                productoId:     d.productoId,
                producto:       d.producto,
                cantidad:       d.cantidad,
                precioUnitario: Number(d.precioUnitario),
            })),
        }));

        // 2. Movimientos manuales desde MovimientoModal (tipoMovimiento SALIDA o AJUSTE_*)
        const movSalidas = await prisma.movimientoInventario.findMany({
            where: {
                empresaId:      user.empresaId,
                tipoMovimiento: { in: ['SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] },
            },
            orderBy: { fecha: 'desc' },
            include: {
                producto: { select: { nombre: true, sku: true, unidad: true } },
                usuario:  { select: { nombre: true, email: true } },
                cliente:  { select: { nombre: true } },
            },
        });

        const movNormalizados = movSalidas.map(m => {
            const { tipo, refLimpia } = parseTipoYRef(m.referencia);
            return {
                id:            m.id,
                tipo,
                referencia:    refLimpia,
                fecha:         m.fecha,
                clienteNombre: m.clienteNombre || m.cliente?.nombre || null,
                usuario:       m.usuario,
                esFormal:      false,
                detalles: [{
                    id:             m.id,
                    productoId:     m.productoId,
                    producto:       m.producto,
                    cantidad:       m.cantidad,
                    precioUnitario: Number(m.precioVenta ?? m.costoUnitario),
                }],
            };
        });

        const todas = [...formalesNormalizadas, ...movNormalizados]
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return Response.json(todas);
    } catch (e) {
        console.error(e);
        return Response.json({ error: 'Error fetching sales' }, { status: 500 });
    }
}

// ── POST /api/sales ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    try {
        const { tipo, detalles, referencia, clienteId, almacenId } = await req.json();
        const empresaId = user.empresaId;
        const usuarioId = user.id;

        // Validación: cliente obligatorio para VENTA
        if (tipo === 'VENTA' && !clienteId) {
            return Response.json(
                { error: 'El campo clienteId es obligatorio para registrar una salida por venta.' },
                { status: 400 }
            );
        }

        // Validación: tipo debe ser uno de los permitidos
        const tiposValidos = ['VENTA', 'CONSUMO_INTERNO', 'PERDIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'];
        if (!tiposValidos.includes(tipo)) {
            return Response.json({ error: `Tipo de salida inválido: ${tipo}` }, { status: 400 });
        }

        // Resolver almacén
        let targetAlmacenId = almacenId;
        if (!targetAlmacenId) {
            const first = await prisma.almacen.findFirst({ where: { empresaId } });
            if (!first) return Response.json({ error: 'No warehouse found for company' }, { status: 400 });
            targetAlmacenId = first.id;
        }

        // Resolver nombre del cliente si se envió clienteId
        let clienteNombre: string | null = null;
        if (clienteId) {
            const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { nombre: true } });
            clienteNombre = cliente?.nombre ?? null;
        }

        // Los ajustes positivos no guardan en modelo Salida (son entradas), van directo a MovimientoInventario
        if (tipo === 'AJUSTE_POSITIVO') {
            await prisma.movimientoInventario.createMany({
                data: detalles.map((d: any) => ({
                    empresaId,
                    productoId:     d.productoId,
                    almacenId:      targetAlmacenId,
                    tipoMovimiento: 'AJUSTE_POSITIVO',
                    cantidad:       d.cantidad,
                    costoUnitario:  d.precioUnitario || 0,
                    referencia:     `AJUSTE_POSITIVO|${referencia || ''}`,
                    usuarioId,
                    clienteId:      clienteId || null,
                    clienteNombre:  clienteNombre,
                })),
            });
            return Response.json({ ok: true }, { status: 201 });
        }

        // Para el resto de tipos (VENTA, CONSUMO_INTERNO, PERDIDA, AJUSTE_NEGATIVO)
        // → crear registro en Salida + MovimientoInventario
        const result = await prisma.$transaction(async (tx) => {
            // Nota: si el modelo Salida aún no tiene columna clienteNombre en producción,
            // quitar esa línea del data y sólo guardarla en MovimientoInventario.
            const salida = await tx.salida.create({
                data: {
                    empresaId,
                    tipo:          tipo as any,
                    referencia,
                    usuarioId,
                    // clienteNombre guardado directo para mostrarlo en la lista sin JOIN
                    ...(clienteNombre ? { clienteNombre } : {}),
                    detalles: {
                        create: detalles.map((d: any) => ({
                            productoId:     d.productoId,
                            cantidad:       d.cantidad,
                            precioUnitario: d.precioUnitario || 0,
                        })),
                    },
                },
            });

            // Movimientos de inventario
            await tx.movimientoInventario.createMany({
                data: detalles.map((d: any) => ({
                    empresaId,
                    productoId:     d.productoId,
                    almacenId:      targetAlmacenId,
                    tipoMovimiento: tipo === 'AJUSTE_NEGATIVO' ? 'AJUSTE_NEGATIVO' : 'SALIDA',
                    cantidad:       d.cantidad,
                    costoUnitario:  d.precioUnitario || 0,
                    precioVenta:    tipo === 'VENTA' ? (d.precioUnitario || 0) : null,
                    referencia:     `${tipo}|${referencia || ''}`,
                    usuarioId,
                    clienteId:      clienteId || null,
                    clienteNombre:  clienteNombre,
                })),
            });

            return salida;
        });

        return Response.json(result, { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error registering sale/exit' }, { status: 500 });
    }
}
