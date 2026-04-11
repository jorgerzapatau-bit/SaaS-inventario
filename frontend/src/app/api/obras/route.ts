import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

// ─── GET /api/obras ───────────────────────────────────────────────────────────
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
                plantillas: { orderBy: { numero: 'asc' } },       // C1-B
                _count: {
                    select: {
                        registrosDiarios:  true,
                        cortesFacturacion: true,
                    },
                },
            },
        });

        const obras_con_metricas = await Promise.all(obras.map(async (obra) => {
            const agg = await prisma.registroDiario.aggregate({
                where: { obraId: obra.id, empresaId: user.empresaId },
                _sum: {
                    metrosLineales:  true,
                    horasTrabajadas: true,
                    litrosDiesel:    true,
                    barrenos:        true,
                },
            });

            const metrosPerforados = Number(agg._sum.metrosLineales ?? 0);

            // Denominador: metros del campo raíz de la obra, o bien la suma
            // de los metros de sus plantillas (cuando los metros se definen
            // por plantilla y el campo raíz queda en null).
            const metrosRaiz = obra.metrosContratados ? Number(obra.metrosContratados) : 0;
            const metrosPlantillas = obra.plantillas.reduce(
                (sum, p) => sum + (p.metrosContratados ? Number(p.metrosContratados) : 0), 0
            );
            const metrosDenominador = metrosRaiz > 0 ? metrosRaiz : metrosPlantillas;

            const pctAvance = metrosDenominador > 0
                ? (metrosPerforados / metrosDenominador) * 100
                : null;

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
                espaciamiento:     obra.espaciamiento     ? Number(obra.espaciamiento)     : null,  // C1-A
                tipoCambio:        obra.tipoCambio        ? Number(obra.tipoCambio)        : null,
                // Serializar plantillas (C1-B)
                plantillas: obra.plantillas.map(p => ({
                    ...p,
                    metrosContratados: Number(p.metrosContratados),
                    bordo:             p.bordo          ? Number(p.bordo)          : null,
                    espaciamiento:     p.espaciamiento  ? Number(p.espaciamiento)  : null,
                    precioUnitario:    p.precioUnitario ? Number(p.precioUnitario) : null,
                })),
                metricas: {
                    metrosPerforados,
                    metrosContratadosEfectivos: metrosDenominador,
                    horasTotales:   Number(agg._sum.horasTrabajadas ?? 0),
                    litrosDiesel:   Number(agg._sum.litrosDiesel    ?? 0),
                    barrenos:       Number(agg._sum.barrenos        ?? 0),
                    pctAvance,
                    montoFacturado: Number(cortesAgg._sum.montoFacturado ?? 0),
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
            nombre, clienteId, ubicacion,
            bordo, espesor, espaciamiento,      // C1-A
            metrosContratados, precioUnitario,
            moneda, tipoCambio, fechaInicio, fechaFin,
            status, notas,
            equipos,                             // [{ equipoId, fechaInicio?, horometroInicial? }]
            plantillas,                          // C1-B: [{ numero, metrosContratados, barrenos, bordo, espaciamiento, precioUnitario, moneda, fechaInicio, fechaFin, notas }]
        } = await req.json();

        if (!nombre?.trim())
            return Response.json({ error: 'El nombre de la obra es requerido' }, { status: 400 });
        if (!clienteId)
            return Response.json({ error: 'El cliente es requerido' }, { status: 400 });

        const monedaVal = moneda === 'USD' ? 'USD' : 'MXN';

        const obra = await prisma.$transaction(async (tx) => {
            const nueva = await tx.obra.create({
                data: {
                    empresaId:         user.empresaId,
                    nombre:            nombre.trim(),
                    clienteId:         clienteId         || null,
                    ubicacion:         ubicacion         || null,
                    bordo:             bordo             != null ? Number(bordo)             : null,
                    espesor:           espesor           != null ? Number(espesor)           : null,
                    espaciamiento:     espaciamiento     != null ? Number(espaciamiento)     : null,  // C1-A
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

            // Crear ObraEquipo con horometroInicial (C3-A)
            if (Array.isArray(equipos) && equipos.length > 0) {
                for (const eq of equipos) {
                    if (!eq.equipoId) continue;
                    const fechaInicioDate = eq.fechaInicio
                        ? new Date(eq.fechaInicio)
                        : (fechaInicio ? new Date(fechaInicio) : new Date());
                    await tx.obraEquipo.updateMany({
                        where: { equipoId: eq.equipoId, fechaFin: null, obraId: { not: nueva.id } },
                        data:  { fechaFin: fechaInicioDate },
                    });
                    await tx.obraEquipo.create({
                        data: {
                            obraId:           nueva.id,
                            equipoId:         eq.equipoId,
                            fechaInicio:      fechaInicioDate,
                            horometroInicial: eq.horometroInicial != null ? Number(eq.horometroInicial) : null,  // C3-A
                        },
                    });
                }
            }

            // Crear PlantillaObra (C1-B)
            if (Array.isArray(plantillas) && plantillas.length > 0) {
                for (const plt of plantillas) {
                    if (!plt.metrosContratados) continue;
                    await tx.plantillaObra.create({
                        data: {
                            obraId:            nueva.id,
                            numero:            plt.numero,
                            metrosContratados: Number(plt.metrosContratados),
                            barrenos:          Number(plt.barrenos   || 0),
                            bordo:             plt.bordo          ? Number(plt.bordo)          : null,
                            espaciamiento:     plt.espaciamiento  ? Number(plt.espaciamiento)  : null,
                            precioUnitario:    plt.precioUnitario ? Number(plt.precioUnitario) : null,
                            moneda:            plt.moneda         || 'MXN',
                            fechaInicio:       plt.fechaInicio    ? new Date(plt.fechaInicio)  : null,
                            fechaFin:          plt.fechaFin       ? new Date(plt.fechaFin)     : null,
                            notas:             plt.notas          || null,
                        },
                    });
                }
            }

            return nueva;
        });

        return Response.json(obra, { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al crear la obra' }, { status: 500 });
    }
}
