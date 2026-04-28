// src/app/api/equipos/[id]/mantenimientos/[regId]/route.ts
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { Moneda, OrigenInsumo, TipoMovimiento } from "@prisma/client";

type Params = { params: Promise<{ id: string; regId: string }> };

// ─── PUT /api/equipos/:id/mantenimientos/:regId ───────────────────────────────
// Edita los campos generales del registro (descripcion, observaciones, fecha,
// horometro). No permite modificar insumos ya procesados (kardex ya fue movido).
export async function PUT(req: NextRequest, { params }: Params) {
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  const { id: equipoId, regId } = await params;

  const registro = await prisma.mantenimientoEquipo.findFirst({
    where: { id: regId, equipoId, empresaId: user.empresaId },
  });
  if (!registro) {
    return Response.json(
      { error: "Registro no encontrado para este equipo" },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { fecha, descripcion, observaciones, horometro } = body as {
    fecha?: string;
    descripcion?: string;
    observaciones?: string | null;
    horometro?: number | null;
  };

  if (descripcion !== undefined && String(descripcion).trim().length < 2) {
    return Response.json(
      { error: "descripcion debe tener al menos 2 caracteres" },
      { status: 400 }
    );
  }

  const actualizado = await prisma.mantenimientoEquipo.update({
    where: { id: regId },
    data: {
      ...(fecha        !== undefined && { fecha:        new Date(fecha) }),
      ...(descripcion  !== undefined && { descripcion:  String(descripcion).trim() }),
      ...(observaciones !== undefined && { observaciones: observaciones?.trim() ?? null }),
      ...(horometro    !== undefined && { horometro }),
    },
    include: {
      insumos: {
        include: {
          producto: { select: { id: true, nombre: true, sku: true, unidad: true } },
          almacen:  { select: { id: true, nombre: true } },
        },
      },
      pendientesResueltos: {
        select: { id: true, descripcion: true, fecha: true },
      },
    },
  });

  return Response.json(actualizado);
}

// ─── DELETE /api/equipos/:id/mantenimientos/:regId ────────────────────────────
// Elimina el registro y revierte todos sus efectos:
//   1. Por cada insumo de tipo ALMACEN:
//      - Crea un MovimientoInventario de ENTRADA compensatorio en el Kardex.
//      - Restaura el stock en Producto.
//   2. Libera los PendienteEquipo vinculados (los vuelve a "abierto").
//   3. Elimina los MantenimientoInsumo y el MantenimientoEquipo.
// Todo en una única transacción.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  const { id: equipoId, regId } = await params;

  const registro = await prisma.mantenimientoEquipo.findFirst({
    where: { id: regId, equipoId, empresaId: user.empresaId },
    include: {
      insumos: true,
      pendientesResueltos: { select: { id: true } },
    },
  });

  if (!registro) {
    return Response.json(
      { error: "Registro no encontrado para este equipo" },
      { status: 404 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Revertir insumos de ALMACEN
      for (const ins of registro.insumos) {
        if (ins.origen === OrigenInsumo.ALMACEN && ins.productoId && ins.almacenId) {
          // a) Movimiento compensatorio en Kardex
          await tx.movimientoInventario.create({
            data: {
              empresaId:      user.empresaId,
              productoId:     ins.productoId,
              almacenId:      ins.almacenId,
              tipoMovimiento: TipoMovimiento.ENTRADA,
              cantidad:       ins.cantidad,
              costoUnitario:  ins.precioUnitario,
              moneda:         ins.moneda as Moneda,
              tipoCambio:     ins.tipoCambio ?? null,
              fecha:          new Date(),
              referencia:     `REVERSA-MANT-${regId}`,
              notas:          `Reversa por eliminación de mantenimiento: ${registro.descripcion}`,
              // usuarioId es requerido por el schema; usamos empresaId como sistema
              // (el frontend no envía body en DELETE, así que tomamos el del token)
              usuarioId:      user.id,
            },
          });

          // b) Restaurar stock
          await tx.producto.update({
            where: { id: ins.productoId },
            data:  { stockActual: { increment: ins.cantidad } },
          });
        }
      }

      // 2. Liberar pendientes vinculados (volver a "abierto")
      if (registro.pendientesResueltos.length > 0) {
        await tx.pendienteEquipo.updateMany({
          where: {
            id:              { in: registro.pendientesResueltos.map((p) => p.id) },
            mantenimientoId: regId,
          },
          data: {
            resuelto:        false,
            fechaResuelto:   null,
            mantenimientoId: null,
          },
        });
      }

      // 3. Eliminar insumos (cascade por schema, pero explícito por claridad)
      await tx.mantenimientoInsumo.deleteMany({
        where: { mantenimientoId: regId },
      });

      // 4. Eliminar el registro principal
      await tx.mantenimientoEquipo.delete({
        where: { id: regId },
      });
    });

    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    console.error("[DELETE /mantenimientos/:regId]", err);
    const message = err instanceof Error ? err.message : "Error interno";
    return Response.json({ error: message }, { status: 500 });
  }
}
