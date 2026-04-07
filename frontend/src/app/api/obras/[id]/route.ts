import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/obras/[id] ──────────────────────────────────────────────────────
// Detalle completo: métricas, equipos, cortes, últimos registros
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;

        const obra = await prisma.obra.findFirst({
            where: { id, empresaId: user.empresaId },
            include: {
                cliente: { select: { nombre: true, telefono: true, email: true } },
                obraEquipos: {
                    orderBy: { fechaInicio: 'desc' },
                    include: {
                        equipo: {
                            select: {
                                id: true, nombre: true,
                                numeroEconomico: true, modelo: true,
                                hodometroInicial: true,
                            },
                        },
                    },
                },
                cortesFacturacion: {
                    orderBy: { numero: 'desc' },
                },
                _count: {
                    select: { registrosDiarios: true, cortesFacturacion: true },
                },
            },
        });

        if (!obra)
            return Response.json({ error: 'Obra no encontrada' }, { status: 404 });

        // Métricas acumuladas totales
        const agg = await prisma.registroDiario.aggregate({
            where: { obraId: id, empresaId: user.empresaId },
            _sum: {
                metrosLineales:  true,
                horasTrabajadas: true,
                litrosDiesel:    true,
                barrenos:        true,
            },
        });

        // Costo acumulado de insumos (movimientos SALIDA vinculados a la obra)
        const costoInsumos = await prisma.movimientoInventario.aggregate({
            where: {
                obraId:         id,
                empresaId:      user.empresaId,
                tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] },
            },
            _sum: { costoUnitario: true, cantidad: true },
        });

        // Monto total facturado
        const facturacion = await prisma.corteFacturacion.aggregate({
            where: { obraId: id },
            _sum: { montoFacturado: true },
        });

        const metrosPerforados = Number(agg._sum.metrosLineales ?? 0);
        const pctAvance = obra.metrosContratados && Number(obra.metrosContratados) > 0
            ? (metrosPerforados / Number(obra.metrosContratados)) * 100
            : null;

        return Response.json({
            ...obra,
            precioUnitario:    obra.precioUnitario    ? Number(obra.precioUnitario)    : null,
            metrosContratados: obra.metrosContratados ? Number(obra.metrosContratados) : null,
            bordo:             obra.bordo             ? Number(obra.bordo)             : null,
            espesor:           obra.espesor           ? Number(obra.espesor)           : null,
            tipoCambio:        obra.tipoCambio        ? Number(obra.tipoCambio)        : null,
            obraEquipos: obra.obraEquipos.map(oe => ({
                ...oe,
                equipo: {
                    ...oe.equipo,
                    hodometroInicial: Number(oe.equipo.hodometroInicial),
                },
            })),
            cortesFacturacion: obra.cortesFacturacion.map(c => ({
                ...c,
                metrosLineales:    Number(c.metrosLineales),
                bordo:             c.bordo             ? Number(c.bordo)             : null,
                espesor:           c.espesor           ? Number(c.espesor)           : null,
                volumenBruto:      c.volumenBruto      ? Number(c.volumenBruto)      : null,
                porcentajePerdida: c.porcentajePerdida ? Number(c.porcentajePerdida) : null,
                volumenNeto:       c.volumenNeto       ? Number(c.volumenNeto)       : null,
                precioUnitario:    c.precioUnitario    ? Number(c.precioUnitario)    : null,
                tipoCambio:        c.tipoCambio        ? Number(c.tipoCambio)        : null,
                montoFacturado:    c.montoFacturado    ? Number(c.montoFacturado)    : null,
            })),
            metricas: {
                metrosPerforados,
                horasTotales:   Number(agg._sum.horasTrabajadas ?? 0),
                litrosDiesel:   Number(agg._sum.litrosDiesel    ?? 0),
                barrenos:       Number(agg._sum.barrenos        ?? 0),
                pctAvance,
                montoFacturado: Number(facturacion._sum.montoFacturado ?? 0),
                costoInsumos:   Number(costoInsumos._sum.costoUnitario ?? 0),
            },
        });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener la obra' }, { status: 500 });
    }
}

// ─── PUT /api/obras/[id] ──────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const {
            nombre, clienteId, ubicacion,
            bordo, espesor, metrosContratados, precioUnitario,
            moneda, tipoCambio, fechaInicio, fechaFin,
            status, notas,
        } = await req.json();

        const monedaVal = moneda === 'USD' ? 'USD' : moneda === 'MXN' ? 'MXN' : undefined;

        const obra = await prisma.obra.update({
            where: { id, empresaId: user.empresaId },
            data: {
                ...(nombre            !== undefined && { nombre }),
                ...(clienteId         !== undefined && { clienteId:         clienteId || null }),
                ...(ubicacion         !== undefined && { ubicacion:         ubicacion || null }),
                ...(bordo             !== undefined && { bordo:             bordo != null ? Number(bordo) : null }),
                ...(espesor           !== undefined && { espesor:           espesor != null ? Number(espesor) : null }),
                ...(metrosContratados !== undefined && { metrosContratados: metrosContratados != null ? Number(metrosContratados) : null }),
                ...(precioUnitario    !== undefined && { precioUnitario:    precioUnitario != null ? Number(precioUnitario) : null }),
                ...(monedaVal         !== undefined && { moneda:            monedaVal }),
                ...(tipoCambio        !== undefined && { tipoCambio:        tipoCambio != null ? Number(tipoCambio) : null }),
                ...(fechaInicio       !== undefined && { fechaInicio:       fechaInicio ? new Date(fechaInicio) : null }),
                ...(fechaFin          !== undefined && { fechaFin:          fechaFin ? new Date(fechaFin) : null }),
                ...(status            !== undefined && { status }),
                ...(notas             !== undefined && { notas: notas || null }),
            },
        });

        return Response.json(obra);
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Obra no encontrada' }, { status: 404 });
        return Response.json({ error: 'Error al actualizar la obra' }, { status: 500 });
    }
}

// ─── DELETE /api/obras/[id] ───────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;

        const registros = await prisma.registroDiario.count({
            where: { obraId: id, empresaId: user.empresaId },
        });
        if (registros > 0)
            return Response.json(
                { error: `No se puede eliminar: la obra tiene ${registros} registros diarios asociados.` },
                { status: 400 }
            );

        await prisma.obra.delete({ where: { id, empresaId: user.empresaId } });
        return Response.json({ message: 'Obra eliminada correctamente' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Obra no encontrada' }, { status: 404 });
        return Response.json({ error: 'Error al eliminar la obra' }, { status: 500 });
    }
}
