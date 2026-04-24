// src/app/api/obras/[id]/cortes/route.ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/obras/[id]/cortes ───────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId } = await params;
        const { searchParams } = new URL(req.url);

        const obra = await prisma.obra.findFirst({
            where: { id: obraId, empresaId: user.empresaId },
        });
        if (!obra) return Response.json({ error: 'Obra no encontrada' }, { status: 404 });

        // ── Modo: registros disponibles para nuevo corte ──────────────────────
        if (searchParams.get('disponibles') === 'true') {
            const registros = await prisma.registroDiario.findMany({
                where: {
                    obraId,
                    corteRegistro: { is: null },
                },
                orderBy: { fecha: 'asc' },
                select: {
                    id: true,
                    fecha: true,
                    barrenos: true,
                    metrosLineales: true,
                    plantillaId: true,
                    equipo: { select: { nombre: true, numeroEconomico: true } },
                    plantilla: { select: { numero: true } },
                },
            });

            return Response.json(registros.map(r => ({
                id: r.id,
                fecha: r.fecha.toISOString().slice(0, 10),
                barrenos: r.barrenos,
                metrosLineales: Number(r.metrosLineales),
                equipo: r.equipo,
                plantillaId: r.plantillaId ?? null,
                plantillaNumero: r.plantilla?.numero ?? null,
            })));
        }

        // ── Modo normal: lista de cortes ──────────────────────────────────────
        const cortes = await prisma.corteFacturacion.findMany({
            where: { obraId },
            orderBy: { numero: 'asc' },
            include: {
                corteRegistros: {
                    include: {
                        registro: {
                            select: { id: true, fecha: true, barrenos: true, metrosLineales: true },
                        },
                    },
                },
            },
        });

        return Response.json(cortes.map(serializeCorte));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener cortes' }, { status: 500 });
    }
}

// ─── POST /api/obras/[id]/cortes ──────────────────────────────────────────────
// Crea un nuevo corte a partir de registros diarios seleccionados.
//
// Body:
//   registroIds[]       — IDs de registros diarios (requerido, min 1)
//   bordo, espesor, profundidadCollar — dimensiones (fallback a obra)
//   perdidaM3           — solo si profundidadCollar es null (modo manual)
//   precioUnitario, moneda, tipoCambio, notas, status
//
// Calculado automáticamente:
//   barrenos       = suma de registros
//   metrosLineales = suma de registros
//   fechaInicio    = fecha del registro más antiguo
//   fechaFin       = fecha del registro más reciente
//   perdidaM3      = barrenos × collar × bordo × espesor (si hay collar)
export async function POST(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId } = await params;

        const obra = await prisma.obra.findFirst({
            where: { id: obraId, empresaId: user.empresaId },
        });
        if (!obra) return Response.json({ error: 'Obra no encontrada' }, { status: 404 });

        const {
            registroIds,
            bordo, espesor, profundidadCollar,
            perdidaM3,
            precioUnitario, moneda, tipoCambio,
            notas, status,
        } = await req.json();

        // ── Validar registros ─────────────────────────────────────────────────
        if (!registroIds || !Array.isArray(registroIds) || registroIds.length === 0)
            return Response.json(
                { error: 'Debes seleccionar al menos un registro diario' },
                { status: 400 }
            );

        const registros = await prisma.registroDiario.findMany({
            where: {
                id:            { in: registroIds },
                obraId,
                corteRegistro: { is: null },
            },
            orderBy: { fecha: 'asc' },
        });

        if (registros.length !== registroIds.length) {
            const encontrados = registros.map(r => r.id);
            const invalidos   = registroIds.filter((id: string) => !encontrados.includes(id));
            return Response.json(
                { error: `Registros no disponibles o ya facturados: ${invalidos.join(', ')}` },
                { status: 400 }
            );
        }

        // ── Totales de producción ─────────────────────────────────────────────
        const barrenosTotal = registros.reduce((s, r) => s + Number(r.barrenos), 0);
        const metrosTotal   = +registros.reduce((s, r) => s + Number(r.metrosLineales), 0).toFixed(4);
        const fechaInicio   = registros[0].fecha;
        const fechaFin      = registros[registros.length - 1].fecha;

        // ── Número de corte ───────────────────────────────────────────────────
        const ultimo = await prisma.corteFacturacion.findFirst({
            where: { obraId },
            orderBy: { numero: 'desc' },
            select: { numero: true },
        });
        const numero = (ultimo?.numero ?? 0) + 1;

        // ── Dimensiones ───────────────────────────────────────────────────────
        const bordoNum   = bordo             != null ? Number(bordo)
                         : (obra.bordo       ? Number(obra.bordo)             : null);
        const espesorNum = espesor           != null ? Number(espesor)
                         : (obra.espesor     ? Number(obra.espesor)           : null);
        const collarNum  = profundidadCollar != null ? Number(profundidadCollar)
                         : (obra.profundidadCollar ? Number(obra.profundidadCollar) : null);
        const puNum      = precioUnitario    != null ? Number(precioUnitario)
                         : (obra.precioUnitario ? Number(obra.precioUnitario) : null);

        // ── Pérdida ───────────────────────────────────────────────────────────
        const perdidaNum = (collarNum && bordoNum && espesorNum)
            ? +(barrenosTotal * collarNum * bordoNum * espesorNum).toFixed(4)
            : (perdidaM3 != null ? Number(perdidaM3) : 0);

        // ── Volúmenes ─────────────────────────────────────────────────────────
        const volumenBruto = bordoNum && espesorNum
            ? +(bordoNum * espesorNum * metrosTotal).toFixed(4)
            : null;

        const volumenNeto = volumenBruto != null
            ? +(volumenBruto - perdidaNum).toFixed(4)
            : null;

        const porcentajePerdida = volumenBruto != null && volumenBruto > 0
            ? +((perdidaNum / volumenBruto) * 100).toFixed(6)
            : 0;

        const montoFacturado = volumenNeto != null && puNum != null
            ? +(volumenNeto * puNum).toFixed(2)
            : null;

        // ── Transacción ───────────────────────────────────────────────────────
        const corteCreado = await prisma.$transaction(async (tx) => {
            const corte = await tx.corteFacturacion.create({
                data: {
                    obraId,
                    numero,
                    fechaInicio,
                    fechaFin,
                    barrenos:          barrenosTotal,
                    metrosLineales:    metrosTotal,
                    bordo:             bordoNum,
                    espesor:           espesorNum,
                    profundidadCollar: collarNum,
                    volumenBruto,
                    perdidaM3:         perdidaNum,
                    porcentajePerdida,
                    volumenNeto,
                    precioUnitario:    puNum,
                    moneda:            moneda === 'USD' ? 'USD' : 'MXN',
                    tipoCambio:        tipoCambio != null ? Number(tipoCambio) : null,
                    montoFacturado,
                    status:            status || 'BORRADOR',
                    notas:             notas || null,
                },
            });

            await tx.corteRegistro.createMany({
                data: registroIds.map((registroId: string) => ({
                    corteId:    corte.id,
                    registroId,
                })),
            });

            return corte;
        });

        return Response.json(serializeCorte(corteCreado), { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al crear el corte' }, { status: 500 });
    }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function serializeCorte(c: any) {
    return {
        ...c,
        metrosLineales:    Number(c.metrosLineales),
        bordo:             c.bordo              != null ? Number(c.bordo)              : null,
        espesor:           c.espesor            != null ? Number(c.espesor)            : null,
        profundidadCollar: c.profundidadCollar  != null ? Number(c.profundidadCollar)  : null,
        volumenBruto:      c.volumenBruto       != null ? Number(c.volumenBruto)       : null,
        perdidaM3:         c.perdidaM3          != null ? Number(c.perdidaM3)          : null,
        porcentajePerdida: c.porcentajePerdida  != null ? Number(c.porcentajePerdida)  : null,
        volumenNeto:       c.volumenNeto        != null ? Number(c.volumenNeto)        : null,
        precioUnitario:    c.precioUnitario     != null ? Number(c.precioUnitario)     : null,
        tipoCambio:        c.tipoCambio         != null ? Number(c.tipoCambio)         : null,
        montoFacturado:    c.montoFacturado     != null ? Number(c.montoFacturado)     : null,
        registros: c.corteRegistros?.map((cr: any) => ({
            id:             cr.registro.id,
            fecha:          cr.registro.fecha?.toISOString?.()?.slice(0, 10) ?? cr.registro.fecha,
            barrenos:       Number(cr.registro.barrenos),
            metrosLineales: Number(cr.registro.metrosLineales),
        })) ?? [],
    };
}

