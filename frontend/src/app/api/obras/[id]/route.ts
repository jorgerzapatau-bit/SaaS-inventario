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
            where: { id },
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
                plantillas: {
                    orderBy: { numero: 'asc' },
                    include: {
                        plantillaEquipos: {
                            where: { fechaFin: null },
                            include: {
                                equipo: {
                                    select: {
                                        id: true, nombre: true,
                                        numeroEconomico: true, modelo: true,
                                    },
                                },
                            },
                        },
                    },
                },
                cortesFacturacion: {
                    orderBy: { numero: 'desc' },
                    include: {
                        corteRegistros: {
                            include: {
                                registro: {
                                    select: { id: true, fecha: true, barrenos: true, metrosLineales: true },
                                },
                            },
                        },
                    },
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
            plantillas: (obra.plantillas ?? []).map(p => ({
                ...p,
                metrosContratados: Number(p.metrosContratados),
                barrenos:          Number(p.barrenos ?? 0),
                bordo:             p.bordo         ? Number(p.bordo)         : null,
                espaciamiento:     p.espaciamiento ? Number(p.espaciamiento) : null,
                precioUnitario:    p.precioUnitario ? Number(p.precioUnitario) : null,
                status:            p.status,
                plantillaEquipos:  (p.plantillaEquipos ?? []),
            })),
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
                registros: (c.corteRegistros ?? []).map((cr: any) => ({
                    id:             cr.registro.id,
                    fecha:          cr.registro.fecha?.toISOString?.()?.slice(0, 10) ?? cr.registro.fecha,
                    barrenos:       Number(cr.registro.barrenos),
                    metrosLineales: Number(cr.registro.metrosLineales),
                })),
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
            bordo, espesor, espaciamiento, metrosContratados, precioUnitario,
            moneda, tipoCambio, fechaInicio, fechaFin,
            status, notas,
            plantillas,
        } = await req.json();

        const monedaVal = moneda === 'USD' ? 'USD' : moneda === 'MXN' ? 'MXN' : undefined;

        const obra = await prisma.$transaction(async (tx) => {
            const updated = await tx.obra.update({
                where: { id },
                data: {
                    ...(nombre            !== undefined && { nombre }),
                    ...(clienteId         !== undefined && { clienteId:         clienteId || null }),
                    ...(ubicacion         !== undefined && { ubicacion:         ubicacion || null }),
                    ...(bordo             !== undefined && { bordo:             bordo != null ? Number(bordo) : null }),
                    ...(espesor           !== undefined && { espesor:           espesor != null ? Number(espesor) : null }),
                    ...(espaciamiento     !== undefined && { espaciamiento:     espaciamiento != null ? Number(espaciamiento) : null }),
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

            if (Array.isArray(plantillas)) {
                for (const p of plantillas) {
                    if (!p.metrosContratados) continue;
                    if (p.id) {
                        await tx.plantillaObra.update({
                            where: { id: p.id },
                            data: {
                                metrosContratados: Number(p.metrosContratados),
                                barrenos:          Number(p.barrenos ?? 0),
                                fechaInicio:       p.fechaInicio ? new Date(p.fechaInicio) : null,
                                fechaFin:          p.fechaFin   ? new Date(p.fechaFin)    : null,
                                notas:             p.notas      || null,
                                ...(p.status !== undefined && { status: p.status }),
                            },
                        });
                    } else {
                        await tx.plantillaObra.create({
                            data: {
                                obraId:            id,
                                numero:            p.numero,
                                metrosContratados: Number(p.metrosContratados),
                                barrenos:          Number(p.barrenos ?? 0),
                                fechaInicio:       p.fechaInicio ? new Date(p.fechaInicio) : null,
                                fechaFin:          p.fechaFin   ? new Date(p.fechaFin)    : null,
                                notas:             p.notas      || null,
                                ...(p.status !== undefined && { status: p.status }),
                            },
                        });
                    }
                }
            }

            return updated;
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

        const obra = await prisma.obra.findFirst({ where: { id } });
        if (!obra)
            return Response.json({ error: 'Obra no encontrada' }, { status: 404 });

        // Bloquear si tiene registros diarios (dato operativo real)
        const registros = await prisma.registroDiario.count({
            where: { obraId: id, empresaId: user.empresaId },
        });
        if (registros > 0)
            return Response.json(
                { error: `No se puede eliminar: la obra tiene ${registros} registros diarios. Cambia el status a TERMINADA en su lugar.` },
                { status: 400 }
            );

        // Bloquear si tiene cortes de facturación
        const cortes = await prisma.corteFacturacion.count({ where: { obraId: id } });
        if (cortes > 0)
            return Response.json(
                { error: `No se puede eliminar: la obra tiene ${cortes} cortes de facturación asociados.` },
                { status: 400 }
            );

        await prisma.$transaction(async (tx) => {
            // 1. Eliminar distribuciones de gastos operativos de esta obra
            //    (CASCADE desde GastoOperativo, pero lo hacemos explícito por claridad)
            await tx.gastoOperativoDistribucion.deleteMany({
                where: { gastoOperativo: { obraId: id } },
            });

            // 2. Eliminar gastos operativos de la obra
            //    obraId es ahora OBLIGATORIO → no se puede desvincular, se elimina
            await tx.gastoOperativo.deleteMany({ where: { obraId: id } });

            // 3. Cerrar asignaciones de equipo (ObraEquipo)
            await tx.obraEquipo.deleteMany({ where: { obraId: id } });

            // 4. Desvincular compras vinculadas (obraId sigue nullable en Compra)
            await tx.compra.updateMany({
                where: { obraId: id },
                data:  { obraId: null },
            });

            // 5. Desvincular salidas vinculadas (obraId nullable en Salida)
            await tx.salida.updateMany({
                where: { obraId: id },
                data:  { obraId: null },
            });

            // 6. Desvincular movimientos de inventario (obraId nullable)
            await tx.movimientoInventario.updateMany({
                where: { obraId: id },
                data:  { obraId: null },
            });

            // 7. Eliminar la obra
            await tx.obra.delete({ where: { id } });
        });

        return Response.json({ message: 'Obra eliminada correctamente' });
    } catch (error: unknown) {
        console.error('DELETE obra error:', error);
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Obra no encontrada' }, { status: 404 });
        if ((error as { code?: string }).code === 'P2003')
            return Response.json({ error: 'No se puede eliminar: existen registros vinculados a esta obra.' }, { status: 400 });
        return Response.json({ error: 'Error al eliminar la obra' }, { status: 500 });
    }
}
