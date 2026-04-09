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
                plantillas: {
                    orderBy: { numero: 'asc' },   // Mejora 10
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
            // Mejora 10: serializar plantillas con Decimals como número
            plantillas: (obra.plantillas ?? []).map(p => ({
                ...p,
                metrosContratados: Number(p.metrosContratados),
                barrenos:          Number(p.barrenos ?? 0),
                bordo:             p.bordo         ? Number(p.bordo)         : null,
                espaciamiento:     p.espaciamiento ? Number(p.espaciamiento) : null,
                precioUnitario:    p.precioUnitario ? Number(p.precioUnitario) : null,
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
            plantillas,   // Mejora 2: [{ id?, numero, metrosContratados, barrenos, fechaInicio, fechaFin, notas }]
        } = await req.json();

        const monedaVal = moneda === 'USD' ? 'USD' : moneda === 'MXN' ? 'MXN' : undefined;

        const obra = await prisma.$transaction(async (tx) => {
            const updated = await tx.obra.update({
                where: { id, empresaId: user.empresaId },
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

            // Mejora 2: upsert de plantillas si vienen en el body
            if (Array.isArray(plantillas)) {
                for (const p of plantillas) {
                    if (!p.metrosContratados) continue;
                    if (p.id) {
                        // Actualizar plantilla existente
                        await tx.plantillaObra.update({
                            where: { id: p.id },
                            data: {
                                metrosContratados: Number(p.metrosContratados),
                                barrenos:          Number(p.barrenos ?? 0),
                                fechaInicio:       p.fechaInicio ? new Date(p.fechaInicio) : null,
                                fechaFin:          p.fechaFin   ? new Date(p.fechaFin)    : null,
                                notas:             p.notas      || null,
                            },
                        });
                    } else {
                        // Crear nueva plantilla
                        await tx.plantillaObra.create({
                            data: {
                                obraId:            id,
                                numero:            p.numero,
                                metrosContratados: Number(p.metrosContratados),
                                barrenos:          Number(p.barrenos ?? 0),
                                fechaInicio:       p.fechaInicio ? new Date(p.fechaInicio) : null,
                                fechaFin:          p.fechaFin   ? new Date(p.fechaFin)    : null,
                                notas:             p.notas      || null,
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

        // Verificar que la obra pertenece a esta empresa
        const obra = await prisma.obra.findFirst({
            where: { id, empresaId: user.empresaId },
        });
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

        // Eliminar en transacción: primero los hijos sin datos operativos, luego la obra
        await prisma.$transaction(async (tx) => {
            // 1. Cerrar asignaciones de equipo (ObraEquipo) — no son datos operativos, son configuración
            await tx.obraEquipo.deleteMany({ where: { obraId: id } });

            // 2. Desvincular gastos operativos (obraId nullable → poner null)
            await tx.gastoOperativo.updateMany({
                where: { obraId: id },
                data:  { obraId: null },
            });

            // 3. Desvincular compras vinculadas (obraId nullable)
            await tx.compra.updateMany({
                where: { obraId: id },
                data:  { obraId: null },
            });

            // 4. Desvincular salidas vinculadas (obraId nullable)
            await tx.salida.updateMany({
                where: { obraId: id },
                data:  { obraId: null },
            });

            // 5. Desvincular movimientos de inventario (obraId nullable)
            await tx.movimientoInventario.updateMany({
                where: { obraId: id },
                data:  { obraId: null },
            });

            // 6. Eliminar la obra
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
