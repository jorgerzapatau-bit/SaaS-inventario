import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/registros-diarios/[id] ─────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const registro = await prisma.registroDiario.findFirst({
            where: { id, empresaId: user.empresaId },
            include: {
                equipo:  { select: { id: true, nombre: true, numeroEconomico: true, hodometroInicial: true } },
                obra:    { select: { id: true, nombre: true } },
                usuario: { select: { nombre: true } },
                cliente: { select: { nombre: true, telefono: true } },
                movimientosInventario: {
                    include: {
                        producto: { select: { nombre: true, unidad: true } },
                        almacen:  { select: { nombre: true } },
                    },
                },
            },
        });

        if (!registro)
            return Response.json({ error: 'Registro no encontrado' }, { status: 404 });

        return Response.json(serializeRegistro(registro));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error fetching registro' }, { status: 500 });
    }
}

// ─── PUT /api/registros-diarios/[id] ─────────────────────────────────────────
// Permite corregir datos de un registro ya guardado.
// NO recalcula movimientos de inventario automáticamente —
// si cambió el consumo de diésel, el operador debe ajustar el kardex manualmente.
export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const {
            horometroInicio, horometroFin,
            barrenos, metrosLineales,
            litrosDiesel, precioDiesel,
            tanqueInicio, litrosTanqueInicio,
            tanqueFin, litrosTanqueFin,
            operadores, peones,
            clienteId, obraNombre, notas,
            // ── Campos de perforación (Track Drill) ──
            bordo, espaciamiento, volumenRoca, porcentajePerdida,
            profundidadPromedio, porcentajeAvance, rentaEquipoDiaria,
        } = await req.json();

        // Recalcular horas si cambiaron los horómetros
        let horasTrabajadas: number | undefined;
        if (horometroInicio !== undefined && horometroFin !== undefined) {
            if (Number(horometroFin) < Number(horometroInicio))
                return Response.json(
                    { error: 'El horómetro final no puede ser menor al inicial' },
                    { status: 400 }
                );
            horasTrabajadas = Number(horometroFin) - Number(horometroInicio);
        }

        const registro = await prisma.registroDiario.update({
            where: { id, empresaId: user.empresaId },
            data: {
                ...(horometroInicio     !== undefined && { horometroInicio:    Number(horometroInicio) }),
                ...(horometroFin        !== undefined && { horometroFin:       Number(horometroFin) }),
                ...(horasTrabajadas     !== undefined && { horasTrabajadas }),
                ...(barrenos            !== undefined && { barrenos:           Number(barrenos) }),
                ...(metrosLineales      !== undefined && { metrosLineales:     Number(metrosLineales) }),
                ...(litrosDiesel        !== undefined && { litrosDiesel:       Number(litrosDiesel) }),
                ...(precioDiesel        !== undefined && { precioDiesel:       Number(precioDiesel) }),
                ...(tanqueInicio        !== undefined && { tanqueInicio:       tanqueInicio       != null ? Number(tanqueInicio)       : null }),
                ...(litrosTanqueInicio  !== undefined && { litrosTanqueInicio: litrosTanqueInicio != null ? Number(litrosTanqueInicio) : null }),
                ...(tanqueFin           !== undefined && { tanqueFin:          tanqueFin          != null ? Number(tanqueFin)          : null }),
                ...(litrosTanqueFin     !== undefined && { litrosTanqueFin:    litrosTanqueFin    != null ? Number(litrosTanqueFin)    : null }),
                ...(operadores          !== undefined && { operadores:         Number(operadores) }),
                ...(peones              !== undefined && { peones:             Number(peones) }),
                ...(clienteId           !== undefined && { clienteId:          clienteId  || null }),
                ...(obraNombre          !== undefined && { obraNombre:         obraNombre || null }),
                ...(notas               !== undefined && { notas:              notas      || null }),
                // ── Campos de perforación ──
                ...(bordo               !== undefined && { bordo:              bordo              != null ? Number(bordo)              : null }),
                ...(espaciamiento       !== undefined && { espaciamiento:      espaciamiento      != null ? Number(espaciamiento)      : null }),
                ...(volumenRoca         !== undefined && { volumenRoca:        volumenRoca        != null ? Number(volumenRoca)        : null }),
                ...(porcentajePerdida   !== undefined && { porcentajePerdida:  porcentajePerdida  != null ? Number(porcentajePerdida)  : null }),
                ...(profundidadPromedio !== undefined && { profundidadPromedio: profundidadPromedio != null ? Number(profundidadPromedio) : null }),
                ...(porcentajeAvance    !== undefined && { porcentajeAvance:   porcentajeAvance   != null ? Number(porcentajeAvance)   : null }),
                ...(rentaEquipoDiaria   !== undefined && { rentaEquipoDiaria:  rentaEquipoDiaria  != null ? Number(rentaEquipoDiaria)  : null }),
            },
            include: {
                equipo:  { select: { nombre: true, numeroEconomico: true } },
                usuario: { select: { nombre: true } },
                cliente: { select: { nombre: true } },
            },
        });

        return Response.json(serializeRegistro(registro));
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Registro no encontrado' }, { status: 404 });
        if ((error as { code?: string }).code === 'P2002')
            return Response.json({ error: 'Ya existe un registro para este equipo en esa fecha' }, { status: 400 });
        return Response.json({ error: 'Error al actualizar el registro' }, { status: 500 });
    }
}

// ─── DELETE /api/registros-diarios/[id] ──────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;

        // Verificar si tiene movimientos de inventario vinculados
        const movimientos = await prisma.movimientoInventario.count({
            where: { registroDiarioId: id, empresaId: user.empresaId },
        });

        if (movimientos > 0)
            return Response.json(
                { error: 'No se puede eliminar: tiene movimientos de inventario vinculados. Elimínalos primero desde el kardex.' },
                { status: 400 }
            );

        await prisma.registroDiario.delete({ where: { id, empresaId: user.empresaId } });
        return Response.json({ message: 'Registro eliminado correctamente' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2025')
            return Response.json({ error: 'Registro no encontrado' }, { status: 404 });
        return Response.json({ error: 'Error al eliminar el registro' }, { status: 500 });
    }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function serializeRegistro(r: any) {
    const horas    = Number(r.horasTrabajadas);
    const metros   = Number(r.metrosLineales);
    const litros   = Number(r.litrosDiesel);
    const barrenos = Number(r.barrenos);

    return {
        ...r,
        horometroInicio:     Number(r.horometroInicio),
        horometroFin:        Number(r.horometroFin),
        horasTrabajadas:     horas,
        barrenos,
        metrosLineales:      metros,
        litrosDiesel:        litros,
        precioDiesel:        Number(r.precioDiesel),
        costoDiesel:         litros * Number(r.precioDiesel),
        tanqueInicio:        r.tanqueInicio        != null ? Number(r.tanqueInicio)        : null,
        litrosTanqueInicio:  r.litrosTanqueInicio  != null ? Number(r.litrosTanqueInicio)  : null,
        tanqueFin:           r.tanqueFin           != null ? Number(r.tanqueFin)           : null,
        litrosTanqueFin:     r.litrosTanqueFin     != null ? Number(r.litrosTanqueFin)     : null,
        // ── Campos de perforación ──
        bordo:               r.bordo               != null ? Number(r.bordo)               : null,
        espaciamiento:       r.espaciamiento        != null ? Number(r.espaciamiento)       : null,
        volumenRoca:         r.volumenRoca          != null ? Number(r.volumenRoca)         : null,
        porcentajePerdida:   r.porcentajePerdida    != null ? Number(r.porcentajePerdida)   : null,
        profundidadPromedio: r.profundidadPromedio  != null ? Number(r.profundidadPromedio) : null,
        porcentajeAvance:    r.porcentajeAvance     != null ? Number(r.porcentajeAvance)    : null,
        rentaEquipoDiaria:   r.rentaEquipoDiaria    != null ? Number(r.rentaEquipoDiaria)   : null,
        kpi: {
            litrosPorHora:  horas    > 0 ? +(litros  / horas).toFixed(2)    : null,
            litrosPorMetro: metros   > 0 ? +(litros  / metros).toFixed(2)   : null,
            metrosPorHora:  horas    > 0 ? +(metros  / horas).toFixed(2)    : null,
            metrosPorDia:   barrenos > 0 ? +(metros  / barrenos).toFixed(2) : null,
        },
    };
}
