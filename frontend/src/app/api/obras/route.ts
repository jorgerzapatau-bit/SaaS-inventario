import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

// ─── GET /api/obras ───────────────────────────────────────────────────────────
// Devuelve obras con métricas acumuladas: metros perforados, % avance, costos
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || undefined;

        const obras = await prisma.obra.findMany({
            where: {
                empresaId: user.empresaId,
                ...(status && { status: status as any }),
            },
            orderBy: [{ status: 'asc' }, { fechaInicio: 'desc' }],
            include: {
                cliente: { select: { nombre: true } },
                obraEquipos: {
                    where: { fechaFin: null },
                    include: { equipo: { select: { nombre: true, numeroEconomico: true } } },
                },
                _count: {
                    select: {
                        registrosDiarios: true,
                        cortesFacturacion: true,
                    },
                },
            },
        });

        // Para cada obra calcular métricas acumuladas desde registros diarios
        const obras_con_metricas = await Promise.all(obras.map(async (obra) => {
            const agg = await prisma.registroDiario.aggregate({
                where: { obraId: obra.id, empresaId: user.empresaId },
                _sum: {
                    metrosLineales: true,
                    horasTrabajadas: true,
                    litrosDiesel: true,
                    barrenos: true,
                },
            });

            const metrosPerforados = Number(agg._sum.metrosLineales ?? 0);
            const pctAvance = obra.metrosContratados && Number(obra.metrosContratados) > 0
                ? (metrosPerforados / Number(obra.metrosContratados)) * 100
                : null;

            // Monto total facturado en cortes
            const cortesAgg = await prisma.corteFacturacion.aggregate({
                where: { obraId: obra.id, status: { in: ['FACTURADO', 'COBRADO'] } },
                _sum: { montoFacturado: true },
            });

            return {
                ...obra,
                precioUnitario:    obra.precioUnitario    ? Number(obra.precioUnitario)    : null,
                metrosContratados: obra.metrosContratados ? Number(obra.metrosContratados) : null,
                bordo:             obra.bordo             ? Number(obra.bordo)             : null,
                espesor:           obra.espesor           ? Number(obra.espesor)           : null,
                tipoCambio:        obra.tipoCambio        ? Number(obra.tipoCambio)        : null,
                // Métricas acumuladas
                metricas: {
                    metrosPerforados,
                    horasTotales:    Number(agg._sum.horasTrabajadas ?? 0),
                    litrosDiesel:    Number(agg._sum.litrosDiesel    ?? 0),
                    barrenos:        Number(agg._sum.barrenos        ?? 0),
                    pctAvance,
                    montoFacturado:  Number(cortesAgg._sum.montoFacturado ?? 0),
                },
            };
        }));

        return Response.json(obras_con_metricas);
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener obras' }, { status: 500 });
    }
}

// ─── POST /api/obras ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const {
            nombre, clienteId, clienteNombre, ubicacion,
            bordo, espesor, metrosContratados, precioUnitario,
            moneda, tipoCambio, fechaInicio, fechaFin,
            status, notas,
            // Equipo inicial opcional
            equipoId, equipoFechaInicio,
        } = await req.json();

        if (!nombre?.trim())
            return Response.json({ error: 'El nombre de la obra es requerido' }, { status: 400 });

        const monedaVal = moneda === 'USD' ? 'USD' : 'MXN';

        const obra = await prisma.$transaction(async (tx) => {
            const nueva = await tx.obra.create({
                data: {
                    empresaId:         user.empresaId,
                    nombre:            nombre.trim(),
                    clienteId:         clienteId         || null,
                    clienteNombre:     clienteNombre     || null,
                    ubicacion:         ubicacion         || null,
                    bordo:             bordo             != null ? Number(bordo)             : null,
                    espesor:           espesor           != null ? Number(espesor)           : null,
                    metrosContratados: metrosContratados != null ? Number(metrosContratados) : null,
                    precioUnitario:    precioUnitario    != null ? Number(precioUnitario)    : null,
                    moneda:            monedaVal,
                    tipoCambio:        tipoCambio        != null ? Number(tipoCambio)        : null,
                    fechaInicio:       fechaInicio       ? new Date(fechaInicio)             : null,
                    fechaFin:          fechaFin          ? new Date(fechaFin)                : null,
                    status:            status            || 'ACTIVA',
                    notas:             notas             || null,
                },
            });

            // Si se especificó equipo inicial, crear el registro ObraEquipo
            if (equipoId) {
                await tx.obraEquipo.create({
                    data: {
                        obraId:     nueva.id,
                        equipoId,
                        fechaInicio: equipoFechaInicio
                            ? new Date(equipoFechaInicio)
                            : (fechaInicio ? new Date(fechaInicio) : new Date()),
                    },
                });
            }

            return nueva;
        });

        return Response.json(obra, { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al crear la obra' }, { status: 500 });
    }
}
