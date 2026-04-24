import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Mapea tipoMovimiento (de MovimientoInventario) al tipo visual que ve el usuario.
// Para movimientos legacy que no tienen prefijo en referencia, el tipo correcto
// ya está en tipoMovimiento — no hay que parsearlo.
function tipoDeMovimiento(tipoMovimiento: string, referencia: string | null): string {
    // Si el movimiento trae prefijo explícito en referencia (registros formales
    // creados por /sales/new en versiones anteriores), lo respetamos.
    const TIPOS = ['VENTA', 'CONSUMO_INTERNO', 'PERDIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'];
    if (referencia) {
        const pipeIdx = referencia.indexOf('|');
        if (pipeIdx !== -1) {
            const prefix = referencia.slice(0, pipeIdx);
            if (TIPOS.includes(prefix)) return prefix;
        }
    }
    // Para el resto, el tipo correcto es el tipoMovimiento guardado en la BD.
    // SALIDA del MovimientoModal → se muestra como VENTA (salida genérica)
    if (tipoMovimiento === 'SALIDA')          return 'VENTA';
    if (tipoMovimiento === 'AJUSTE_POSITIVO') return 'AJUSTE_POSITIVO';
    if (tipoMovimiento === 'AJUSTE_NEGATIVO') return 'AJUSTE_NEGATIVO';
    return tipoMovimiento;
}

// Limpia el prefijo del campo referencia para mostrar solo el folio al usuario.
function refLimpia(referencia: string | null): string | null {
    if (!referencia) return null;
    const pipeIdx = referencia.indexOf('|');
    if (pipeIdx !== -1) return referencia.slice(pipeIdx + 1) || null;
    return referencia;
}

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

        // 2. Movimientos manuales del MovimientoModal
        //    Solo SALIDA, AJUSTE_POSITIVO y AJUSTE_NEGATIVO (no ENTRADA).
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

        const movNormalizados = movSalidas.map(m => ({
            id:  m.id,
            // ← FIX PRINCIPAL: tipo derivado del tipoMovimiento real, no del prefijo
            tipo: tipoDeMovimiento(m.tipoMovimiento, m.referencia),
            referencia:    refLimpia(m.referencia),
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
        }));

        // Unir, deduplicar (un registro formal ya tiene su movimiento espejo),
        // y ordenar por fecha descendente.
        // Los registros formales (esFormal=true) ya tienen su movimientoInventario
        // creado por el POST, así que filtramos los movimientos que tengan referencia
        // con prefijo — esos son los espejo de salidas formales y no deben duplicarse.
        const movSinDuplicar = movNormalizados.filter(m => {
            // Si el movimiento original tenía prefijo TIPO| en referencia, ya está
            // representado por la salida formal correspondiente.
            if (!m.referencia) return true; // sin referencia → no es espejo
            const orig = movSalidas.find(x => x.id === m.id);
            if (!orig?.referencia) return true;
            return orig.referencia.indexOf('|') === -1; // sin prefijo → no es espejo
        });

        const todas = [...formalesNormalizadas, ...movSinDuplicar]
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
                { error: 'El campo clienteId es obligatorio para registrar una salida.' },
                { status: 400 }
            );
        }

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

        // Resolver nombre del cliente
        let clienteNombre: string | null = null;
        if (clienteId) {
            const cliente = await prisma.cliente.findUnique({
                where: { id: clienteId },
                select: { nombre: true },
            });
            clienteNombre = cliente?.nombre ?? null;
        }

        // Ajuste positivo → solo MovimientoInventario (es una entrada, no una salida formal)
        if (tipo === 'AJUSTE_POSITIVO') {
            await prisma.movimientoInventario.createMany({
                data: detalles.map((d: any) => ({
                    empresaId,
                    productoId:     d.productoId,
                    almacenId:      targetAlmacenId,
                    tipoMovimiento: 'AJUSTE_POSITIVO',
                    cantidad:       d.cantidad,
                    costoUnitario:  d.precioUnitario || 0,
                    // Sin prefijo en referencia para que el GET lo lea por tipoMovimiento
                    referencia:     referencia || null,
                    usuarioId,
                    clienteId:      clienteId || null,
                    clienteNombre,
                })),
            });
            return Response.json({ ok: true }, { status: 201 });
        }

        // VENTA, CONSUMO_INTERNO, PERDIDA, AJUSTE_NEGATIVO → Salida + MovimientoInventario
        const result = await prisma.$transaction(async (tx) => {
            const salida = await tx.salida.create({
                data: {
                    empresaId,
                    tipo:          tipo as any,
                    referencia,
                    usuarioId,
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

            // Movimiento espejo — SIN prefijo en referencia para evitar doble conteo en el GET
            await tx.movimientoInventario.createMany({
                data: detalles.map((d: any) => ({
                    empresaId,
                    productoId:     d.productoId,
                    almacenId:      targetAlmacenId,
                    tipoMovimiento: tipo === 'AJUSTE_NEGATIVO' ? 'AJUSTE_NEGATIVO' : 'SALIDA',
                    cantidad:       d.cantidad,
                    costoUnitario:  d.precioUnitario || 0,
                    precioVenta:    tipo === 'VENTA' ? (d.precioUnitario || 0) : null,
                    // Prefijo para identificar que este movimiento ya tiene su Salida formal
                    referencia:     `${tipo}|${referencia || ''}`,
                    usuarioId,
                    clienteId:      clienteId || null,
                    clienteNombre,
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

