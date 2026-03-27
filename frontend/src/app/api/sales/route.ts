import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

// Helper: parse "TIPO|referencia_real" stored in the referencia field of MovimientoInventario
function parseTipoYRef(referencia: string | null): { tipo: string; refLimpia: string | null } {
    if (!referencia) return { tipo: 'VENTA', refLimpia: null };
    const TIPOS = ['VENTA', 'CONSUMO_INTERNO', 'PERDIDA'];
    const pipeIdx = referencia.indexOf('|');
    if (pipeIdx !== -1) {
        const prefix = referencia.slice(0, pipeIdx);
        if (TIPOS.includes(prefix)) {
            const refLimpia = referencia.slice(pipeIdx + 1) || null;
            return { tipo: prefix, refLimpia };
        }
    }
    // Legacy data without prefix — keep as-is and default to VENTA
    return { tipo: 'VENTA', refLimpia: referencia };
}

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        // 1. Salidas formales (modelo Salida, creadas desde /sales/new)
        const salidasFormales = await prisma.salida.findMany({
            where: { empresaId: user.empresaId },
            include: {
                usuario: { select: { nombre: true, email: true } },
                detalles: { include: { producto: { select: { nombre: true, sku: true, unidad: true } } } }
            },
            orderBy: { fecha: 'desc' }
        });

        const formalesNormalizadas = salidasFormales.map(s => ({
            id:            s.id,
            tipo:          s.tipo as string,
            referencia:    s.referencia,
            fecha:         s.fecha,
            clienteNombre: null as string | null,
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

        // 2. Salidas desde MovimientoModal (modelo MovimientoInventario con tipoMovimiento = 'SALIDA')
        const movSalidas = await prisma.movimientoInventario.findMany({
            where: {
                empresaId:      user.empresaId,
                tipoMovimiento: 'SALIDA',
            },
            orderBy: { fecha: 'desc' },
            include: {
                producto:  { select: { nombre: true, sku: true, unidad: true } },
                usuario:   { select: { nombre: true, email: true } },
                cliente:   { select: { nombre: true } },
            }
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

        // Unir y ordenar por fecha descendente
        const todas = [...formalesNormalizadas, ...movNormalizados]
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return Response.json(todas);
    } catch (e) {
        console.error(e);
        return Response.json({ error: 'Error fetching sales' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { tipo, detalles, referencia, almacenId } = await req.json();
        const empresaId = user.empresaId;
        const usuarioId = user.id;

        let targetAlmacenId = almacenId;
        if (!targetAlmacenId) {
            const first = await prisma.almacen.findFirst({ where: { empresaId } });
            if (!first) return Response.json({ error: 'No warehouse found for company' }, { status: 400 });
            targetAlmacenId = first.id;
        }

        const result = await prisma.$transaction(async (tx) => {
            const salida = await tx.salida.create({
                data: {
                    empresaId, tipo, referencia, usuarioId,
                    detalles: { create: detalles.map((d: { productoId: string; cantidad: number; precioUnitario?: number }) => ({ productoId: d.productoId, cantidad: d.cantidad, precioUnitario: d.precioUnitario || 0 })) }
                }
            });
            await tx.movimientoInventario.createMany({
                data: detalles.map((d: { productoId: string; cantidad: number; precioUnitario?: number }) => ({
                    empresaId, productoId: d.productoId, almacenId: targetAlmacenId,
                    tipoMovimiento: 'SALIDA', cantidad: d.cantidad, costoUnitario: d.precioUnitario || 0,
                    referencia: `${tipo}|${referencia || ''}`, usuarioId
                }))
            });
            return salida;
        });

        return Response.json(result, { status: 201 });
    } catch (error) { console.error(error); return Response.json({ error: 'Error registering sale/exit' }, { status: 500 }); }
}
