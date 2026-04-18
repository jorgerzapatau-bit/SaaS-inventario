import { NextRequest } from 'next/server';
import prisma from '../../../lib/prisma';
import { getAuthUser, unauthorized } from '../../../lib/auth';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/obras/[id]/regularizar
 *
 * Asigna o reasigna registros diarios a una plantilla existente o recién creada.
 *
 * Body:
 *   {
 *     plantillaId?: string          → asignar a plantilla existente
 *     crearPlantilla?: { ... }      → crear plantilla nueva y asignar a ella
 *     registroIds?: string[]        → opcional: solo esos registros (si omite → todos sin plantilla)
 *     allowReasignacion?: boolean   → si true, permite mover registros que ya tienen plantilla
 *   }
 */
export async function POST(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();

    try {
        const { id: obraId } = await params;
        const body = await req.json();

        const allowReasignacion: boolean = body.allowReasignacion === true;

        // registroIds opcional — si viene, validar que pertenezcan a la obra
        const registroIds: string[] | undefined =
            Array.isArray(body.registroIds) && body.registroIds.length > 0
                ? body.registroIds
                : undefined;

        if (registroIds) {
            // Verificar que todos los IDs son registros válidos de esta obra
            // Si allowReasignacion=false (comportamiento original), también exige plantillaId null
            const whereValidacion = allowReasignacion
                ? { id: { in: registroIds }, obraId, empresaId: user.empresaId }
                : { id: { in: registroIds }, obraId, empresaId: user.empresaId, plantillaId: null };

            const count = await prisma.registroDiario.count({ where: whereValidacion });
            if (count !== registroIds.length)
                return Response.json(
                    {
                        error: allowReasignacion
                            ? 'Algunos registroIds no son válidos o no pertenecen a esta obra'
                            : 'Algunos registroIds no son válidos, no pertenecen a esta obra o ya tienen plantilla asignada',
                    },
                    { status: 400 }
                );
        }

        // ── Verificar que la obra existe ──────────────────────────────────────
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

            if (plantilla.status === 'TERMINADA')
                return Response.json({ error: 'No se puede asignar a una plantilla TERMINADA' }, { status: 400 });

            // Solo validar capacidad si NO es reasignación correctiva
            if (!allowReasignacion) {
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
            }

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

        // ── Actualizar registros ──────────────────────────────────────────────
        let whereClause: object;
        if (registroIds) {
            // Actualizar solo los IDs seleccionados (con o sin plantilla actual)
            whereClause = { id: { in: registroIds }, obraId, empresaId: user.empresaId };
        } else {
            // Sin registroIds: solo actualizar los que no tienen plantilla (comportamiento original)
            whereClause = { obraId, empresaId: user.empresaId, plantillaId: null };
        }

        const resultado = await prisma.registroDiario.updateMany({
            where: whereClause,
            data:  { plantillaId },
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
 * Devuelve:
 *  - plantillasElegibles: plantillas no TERMINADAS con capacidad disponible
 *  - registrosSinPlantilla: conteo total
 *  - metrosSinPlantilla: suma de metros
 *  - registros: lista detallada de cada registro sin plantilla (para selección granular)
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

        // ── Lista detallada de registros sin plantilla ────────────────────────
        const registrosSinPlantilla = await prisma.registroDiario.findMany({
            where: { obraId, empresaId: user.empresaId, plantillaId: null },
            orderBy: { fecha: 'asc' },
            select: {
                id:             true,
                fecha:          true,
                barrenos:       true,
                metrosLineales: true,
                equipo: {
                    select: { nombre: true, numeroEconomico: true },
                },
            },
        });

        const totalMetros = registrosSinPlantilla.reduce(
            (s, r) => s + Number(r.metrosLineales), 0
        );

        // ── Plantillas elegibles con capacidad ────────────────────────────────
        const plantillasConCapacidad = await Promise.all(
            obra.plantillas.map(async (p) => {
                const agg = await prisma.registroDiario.aggregate({
                    where: { obraId, plantillaId: p.id, empresaId: user.empresaId },
                    _sum: { metrosLineales: true },
                });
                const metrosUsados      = Number(agg._sum.metrosLineales ?? 0);
                const metrosContratados = Number(p.metrosContratados);
                const capacidadDisponible = Math.max(0, metrosContratados - metrosUsados);
                return {
                    ...p,
                    metrosContratados,
                    precioUnitario:    p.precioUnitario ? Number(p.precioUnitario) : null,
                    metrosUsados,
                    capacidadDisponible,
                    elegible: capacidadDisponible > 0,
                };
            })
        );

        return Response.json({
            registrosSinPlantilla: registrosSinPlantilla.length,
            metrosSinPlantilla:    totalMetros,
            registros:             registrosSinPlantilla.map(r => ({
                id:             r.id,
                fecha:          r.fecha,
                barrenos:       r.barrenos,
                metrosLineales: Number(r.metrosLineales),
                equipo:         r.equipo,
            })),
            plantillasElegibles: plantillasConCapacidad,
        });
    } catch (error) {
        console.error('GET regularizar error:', error);
        return Response.json({ error: 'Error al obtener datos' }, { status: 500 });
    }
}
