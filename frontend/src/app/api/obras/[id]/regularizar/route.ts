import { NextRequest } from 'next/server';
import prisma from '../../../lib/prisma';
import { getAuthUser, unauthorized } from '../../../lib/auth';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/obras/[id]/regularizar
 *
 * Asigna en masa todos los registros diarios sin plantilla (plantillaId === null)
 * de una obra a una plantilla existente o recién creada.
 *
 * Body:
 *   { plantillaId: string }                → asignar a plantilla existente
 *   { crearPlantilla: { ... campos } }     → crear plantilla y asignar a ella
 */
export async function POST(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    try {
        const { id: obraId } = await params;
        const body = await req.json();

        // ── Verificar que la obra existe y pertenece a la empresa ────────────
        const obra = await prisma.obra.findFirst({
            where: { id: obraId },
            include: {
                plantillas: {
                    select: {
                        id: true,
                        numero: true,
                        status: true,
                        metrosContratados: true,
                        precioUnitario: true,
                        moneda: true,
                        fechaInicio: true,
                        fechaFin: true,
                        notas: true,
                    },
                },
            },
        });
        if (!obra) return Response.json({ error: 'Obra no encontrada' }, { status: 404 });

        let plantillaId: string;

        // ── CASO 1: asignar a plantilla existente ─────────────────────────────
        if (body.plantillaId) {
            const plantilla = obra.plantillas.find(p => p.id === body.plantillaId);
            if (!plantilla)
                return Response.json({ error: 'Plantilla no encontrada en esta obra' }, { status: 404 });

            // Validar eligibilidad
            if (plantilla.status === 'TERMINADA')
                return Response.json({ error: 'No se puede asignar a una plantilla TERMINADA' }, { status: 400 });

            // Calcular metros ya perforados de esa plantilla
            const metrosAgg = await prisma.registroDiario.aggregate({
                where: { obraId, plantillaId: plantilla.id, empresaId: user.empresaId },
                _sum: { metrosLineales: true },
            });
            const metrosUsados = Number(metrosAgg._sum.metrosLineales ?? 0);
            const metrosContratados = Number(plantilla.metrosContratados);
            if (metrosContratados > 0 && metrosUsados >= metrosContratados)
                return Response.json(
                    { error: 'La plantilla ya alcanzó sus metros contratados' },
                    { status: 400 }
                );

            plantillaId = plantilla.id;
        }
        // ── CASO 2: crear nueva plantilla y asignar ───────────────────────────
        else if (body.crearPlantilla) {
            const {
                numero, metrosContratados, precioUnitario,
                moneda, fechaInicio, fechaFin, notas,
            } = body.crearPlantilla;

            if (!numero || !metrosContratados)
                return Response.json({ error: 'numero y metrosContratados son requeridos' }, { status: 400 });

            const nueva = await prisma.plantillaObra.create({
                data: {
                    obraId,
                    numero:            Number(numero),
                    metrosContratados: Number(metrosContratados),
                    precioUnitario:    precioUnitario ? Number(precioUnitario) : null,
                    moneda:            moneda ?? 'MXN',
                    fechaInicio:       fechaInicio ? new Date(fechaInicio) : null,
                    fechaFin:          fechaFin    ? new Date(fechaFin)    : null,
                    notas:             notas       || null,
                    status:            'ACTIVA',
                },
            });
            plantillaId = nueva.id;
        } else {
            return Response.json(
                { error: 'Debes proveer plantillaId o crearPlantilla' },
                { status: 400 }
            );
        }

        // ── Actualizar en masa todos los registros sin plantilla ──────────────
        const resultado = await prisma.registroDiario.updateMany({
            where: {
                obraId,
                empresaId: user.empresaId,
                plantillaId: null,
            },
            data: { plantillaId },
        });

        return Response.json({
            plantillaId,
            registrosActualizados: resultado.count,
        });
    } catch (error) {
        console.error('POST regularizar error:', error);
        return Response.json({ error: 'Error al regularizar registros' }, { status: 500 });
    }
}

/**
 * GET /api/obras/[id]/regularizar
 *
 * Devuelve las plantillas elegibles para asignación (no TERMINADAS y con capacidad disponible)
 * y el conteo de registros sin plantilla.
 */
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    try {
        const { id: obraId } = await params;

        const obra = await prisma.obra.findFirst({
            where: { id: obraId },
            include: {
                plantillas: {
                    where: { status: { not: 'TERMINADA' } },
                    orderBy: { numero: 'asc' },
                    select: {
                        id: true,
                        numero: true,
                        status: true,
                        metrosContratados: true,
                        precioUnitario: true,
                        moneda: true,
                        fechaInicio: true,
                        fechaFin: true,
                        notas: true,
                    },
                },
            },
        });
        if (!obra) return Response.json({ error: 'Obra no encontrada' }, { status: 404 });

        // Registros sin plantilla
        const sinPlantillaAgg = await prisma.registroDiario.aggregate({
            where: { obraId, empresaId: user.empresaId, plantillaId: null },
            _count: true,
            _sum: { metrosLineales: true },
        });

        // Para cada plantilla, calcular metros ya usados
        const plantillasConCapacidad = await Promise.all(
            obra.plantillas.map(async (p) => {
                const agg = await prisma.registroDiario.aggregate({
                    where: { obraId, plantillaId: p.id, empresaId: user.empresaId },
                    _sum: { metrosLineales: true },
                });
                const metrosUsados = Number(agg._sum.metrosLineales ?? 0);
                const metrosContratados = Number(p.metrosContratados);
                const capacidadDisponible = Math.max(0, metrosContratados - metrosUsados);
                const elegible = capacidadDisponible > 0;

                return {
                    ...p,
                    metrosContratados,
                    precioUnitario: p.precioUnitario ? Number(p.precioUnitario) : null,
                    metrosUsados,
                    capacidadDisponible,
                    elegible,
                };
            })
        );

        return Response.json({
            registrosSinPlantilla: sinPlantillaAgg._count,
            metrosSinPlantilla: Number(sinPlantillaAgg._sum.metrosLineales ?? 0),
            plantillasElegibles: plantillasConCapacidad,
        });
    } catch (error) {
        console.error('GET regularizar error:', error);
        return Response.json({ error: 'Error al obtener datos' }, { status: 500 });
    }
}
