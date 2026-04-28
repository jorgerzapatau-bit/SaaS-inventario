// src/app/api/equipos/[id]/mantenimientos/[regId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { Moneda, OrigenInsumo, TipoBitacora, TipoMovimiento } from "@prisma/client";

interface RouteContext {
  params: Promise<{ id: string; regId: string }>;
}

// ─── PUT /api/equipos/:id/mantenimientos/:regId ───────────────────────────────
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  const { id: equipoId, regId } = await params;

  const equipo = await prisma.equipo.findUnique({ where: { id: equipoId } });
  if (!equipo) return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });

  const registro = await prisma.mantenimientoEquipo.findFirst({
    where: { id: regId, equipoId, empresaId: user.empresaId },
    include: { insumos: true },
  });
  if (!registro) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const { fecha, tipo, descripcion, observaciones, horometro, insumos, pendientesIds, usuarioId } = body as {
    fecha?: string; tipo?: TipoBitacora; descripcion?: string;
    observaciones?: string | null; horometro?: number | null; usuarioId?: string;
    insumos?: { origen: OrigenInsumo; productoId?: string; almacenId?: string;
      descripcionLibre?: string; cantidad: number; precioUnitario: number;
      moneda?: Moneda; tipoCambio?: number; }[];
    pendientesIds?: string[];
  };

  if (!descripcion?.trim()) return NextResponse.json({ error: "descripcion es requerida" }, { status: 400 });

  const tipoFinal: TipoBitacora = tipo ?? registro.tipo;
  const insumosLista = tipoFinal === TipoBitacora.MANTENIMIENTO ? (insumos ?? []) : [];
  const pendientesLista = tipoFinal === TipoBitacora.MANTENIMIENTO ? (pendientesIds ?? []) : [];

  // Pre-validar stock (tomando en cuenta lo que ya estaba)
  for (const ins of insumosLista) {
    if (ins.origen === OrigenInsumo.ALMACEN) {
      if (!ins.productoId || !ins.almacenId)
        return NextResponse.json({ error: "productoId y almacenId requeridos" }, { status: 400 });
      const anterior = registro.insumos.find(i => i.productoId === ins.productoId && i.origen === OrigenInsumo.ALMACEN);
      const cantAnterior = anterior ? Number(anterior.cantidad) : 0;
      const prod = await prisma.producto.findUnique({ where: { id: ins.productoId }, select: { nombre: true, stockActual: true, unidad: true } });
      if (!prod) return NextResponse.json({ error: `Producto no encontrado` }, { status: 404 });
      if (Number(prod.stockActual) + cantAnterior < ins.cantidad)
        return NextResponse.json({ error: `Stock insuficiente para "${prod.nombre}"` }, { status: 422 });
    } else {
      if (!ins.descripcionLibre?.trim())
        return NextResponse.json({ error: "descripcionLibre requerida para COMPRA_DIRECTA" }, { status: 400 });
    }
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Revertir insumos anteriores
      for (const ins of registro.insumos) {
        if (ins.origen === OrigenInsumo.ALMACEN && ins.productoId) {
          await tx.producto.update({ where: { id: ins.productoId }, data: { stockActual: { increment: Number(ins.cantidad) } } });
          await tx.movimientoInventario.deleteMany({ where: { mantenimientoInsumoId: ins.id } });
        }
        await tx.mantenimientoInsumo.delete({ where: { id: ins.id } });
      }
      // 2. Desligar pendientes anteriores
      await tx.pendienteEquipo.updateMany({ where: { mantenimientoId: regId }, data: { resuelto: false, fechaResuelto: null, mantenimientoId: null } });

      // 3. Actualizar campos generales
      const reg = await tx.mantenimientoEquipo.update({
        where: { id: regId },
        data: {
          ...(fecha !== undefined && { fecha: new Date(fecha) }),
          tipo: tipoFinal,
          descripcion: descripcion.trim(),
          observaciones: observaciones?.trim() ?? null,
          ...(horometro !== undefined && { horometro }),
        },
      });

      // 4. Crear nuevos insumos
      for (const ins of insumosLista) {
        if (ins.origen === OrigenInsumo.ALMACEN) {
          const creado = await tx.mantenimientoInsumo.create({
            data: { mantenimientoId: regId, origen: OrigenInsumo.ALMACEN, productoId: ins.productoId!, almacenId: ins.almacenId!,
              cantidad: ins.cantidad, precioUnitario: ins.precioUnitario, moneda: ins.moneda ?? Moneda.MXN, tipoCambio: ins.tipoCambio ?? null },
          });
          await tx.producto.update({ where: { id: ins.productoId! }, data: { stockActual: { decrement: ins.cantidad } } });
          await tx.movimientoInventario.create({
            data: { empresaId: equipo.empresaId, productoId: ins.productoId!, almacenId: ins.almacenId!,
              tipoMovimiento: TipoMovimiento.SALIDA, cantidad: ins.cantidad, costoUnitario: ins.precioUnitario,
              moneda: ins.moneda ?? Moneda.MXN, tipoCambio: ins.tipoCambio ?? null, fecha: reg.fecha,
              referencia: `MANT-${regId}`, notas: `Mantenimiento (editado): ${descripcion.trim()}`,
              usuarioId: usuarioId ?? equipo.empresaId, mantenimientoInsumoId: creado.id },
          });
        } else {
          await tx.mantenimientoInsumo.create({
            data: { mantenimientoId: regId, origen: OrigenInsumo.COMPRA_DIRECTA, descripcionLibre: ins.descripcionLibre!.trim(),
              cantidad: ins.cantidad, precioUnitario: ins.precioUnitario, moneda: ins.moneda ?? Moneda.MXN, tipoCambio: ins.tipoCambio ?? null },
          });
        }
      }

      // 5. Marcar nuevos pendientes como resueltos
      if (pendientesLista.length > 0) {
        await tx.pendienteEquipo.updateMany({
          where: { id: { in: pendientesLista }, equipoId, resuelto: false },
          data: { resuelto: true, fechaResuelto: reg.fecha, mantenimientoId: regId },
        });
      }

      return tx.mantenimientoEquipo.findUniqueOrThrow({
        where: { id: regId },
        include: {
          insumos: { include: { producto: { select: { id: true, nombre: true, sku: true, unidad: true } }, almacen: { select: { id: true, nombre: true } } } },
          pendientesResueltos: { select: { id: true, descripcion: true, fecha: true } },
        },
      });
    });

    return NextResponse.json(resultado);
  } catch (err: unknown) {
    console.error("[PUT /mantenimientos/:regId]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}

// ─── DELETE /api/equipos/:id/mantenimientos/:regId ────────────────────────────
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  const { id: equipoId, regId } = await params;

  const registro = await prisma.mantenimientoEquipo.findFirst({
    where: { id: regId, equipoId, empresaId: user.empresaId },
    include: { insumos: true },
  });
  if (!registro) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    for (const ins of registro.insumos) {
      if (ins.origen === OrigenInsumo.ALMACEN && ins.productoId) {
        await tx.producto.update({ where: { id: ins.productoId }, data: { stockActual: { increment: Number(ins.cantidad) } } });
        await tx.movimientoInventario.deleteMany({ where: { mantenimientoInsumoId: ins.id } });
      }
    }
    await tx.pendienteEquipo.updateMany({ where: { mantenimientoId: regId }, data: { resuelto: false, fechaResuelto: null, mantenimientoId: null } });
    await tx.mantenimientoEquipo.delete({ where: { id: regId } });
  });

  return NextResponse.json({ message: "Registro eliminado" });
}
