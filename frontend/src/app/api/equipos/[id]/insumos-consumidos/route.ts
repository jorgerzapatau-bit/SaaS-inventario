// src/app/api/equipos/[id]/insumos-consumidos/route.ts
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/equipos/:id/insumos-consumidos ──────────────────────────────────
// Devuelve todos los MantenimientoInsumo del equipo, enriquecidos con datos del
// mantenimiento padre, del producto y del almacén.
// Se usa para renderizar el tab "Inventario" rediseñado, que muestra el historial
// real de insumos consumidos en mantenimientos.
//
// Query params opcionales:
//   desde  → fecha ISO (ej. 2025-01-01)  filtra mantenimiento.fecha >= desde
//   hasta  → fecha ISO                   filtra mantenimiento.fecha <= hasta
//
// Cada ítem devuelto incluye:
//   totalMXN = cantidad × precioUnitario × tipoCambioEfectivo
//   donde tipoCambioEfectivo = tipoCambio del insumo ?? tipoCambio global de la empresa
export async function GET(req: NextRequest, { params }: Params) {
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  const { id: equipoId } = await params;

  // Verificar que el equipo pertenece a la empresa
  const equipo = await prisma.equipo.findFirst({
    where: { id: equipoId, empresaId: user.empresaId },
    select: { id: true },
  });
  if (!equipo) {
    return Response.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  // Tipo de cambio global de la empresa (guardado en config JSON o campo directo)
  const empresa = await prisma.empresa.findUnique({
    where: { id: user.empresaId },
    select: { config: true },
  });
  const configRaw = empresa?.config as Record<string, unknown> | null;
  const tipoCambioGlobal: number = typeof configRaw?.tipoCambio === "number"
    ? configRaw.tipoCambio
    : 1;

  // Filtros de fecha opcionales
  const url = new URL(req.url);
  const desdeStr = url.searchParams.get("desde");
  const hastaStr = url.searchParams.get("hasta");

  const fechaFilter: Record<string, Date> = {};
  if (desdeStr) fechaFilter.gte = new Date(desdeStr);
  if (hastaStr) fechaFilter.lte = new Date(hastaStr);

  const insumos = await prisma.mantenimientoInsumo.findMany({
    where: {
      mantenimiento: {
        equipoId,
        empresaId: user.empresaId,
        ...(Object.keys(fechaFilter).length > 0 ? { fecha: fechaFilter } : {}),
      },
    },
    orderBy: {
      mantenimiento: { fecha: "desc" },
    },
    include: {
      mantenimiento: {
        select: {
          id:          true,
          fecha:       true,
          descripcion: true,
          tipo:        true,
        },
      },
      producto: {
        select: {
          id:      true,
          nombre:  true,
          sku:     true,
          unidad:  true,
        },
      },
      almacen: {
        select: {
          id:     true,
          nombre: true,
        },
      },
    },
  });

  // Calcular totalMXN por línea
  const resultado = insumos.map((ins) => {
    const cantidad       = Number(ins.cantidad);
    const precio         = Number(ins.precioUnitario);
    const tc             = ins.tipoCambio != null
      ? Number(ins.tipoCambio)
      : ins.moneda === "USD"
        ? tipoCambioGlobal
        : 1;
    const totalMXN = ins.moneda === "USD"
      ? cantidad * precio * tc
      : cantidad * precio;

    return {
      id:               ins.id,
      mantenimientoId:  ins.mantenimientoId,
      mantenimiento:    {
        id:          ins.mantenimiento.id,
        fecha:       ins.mantenimiento.fecha,
        descripcion: ins.mantenimiento.descripcion,
        tipo:        ins.mantenimiento.tipo,
      },
      origen:           ins.origen,
      // Insumo del almacén
      productoId:       ins.productoId ?? null,
      producto:         ins.producto ?? null,
      almacenId:        ins.almacenId ?? null,
      almacen:          ins.almacen ?? null,
      // Compra directa
      descripcionLibre: ins.descripcionLibre ?? null,
      // Valores económicos
      cantidad,
      precioUnitario:   precio,
      moneda:           ins.moneda,
      tipoCambio:       ins.tipoCambio != null ? Number(ins.tipoCambio) : null,
      tipoCambioUsado:  tc,
      totalMXN:         Math.round(totalMXN * 100) / 100,
    };
  });

  // Totalizador general
  const grandTotalMXN = resultado.reduce((acc, r) => acc + r.totalMXN, 0);

  return Response.json({
    equipoId,
    tipoCambioGlobal,
    grandTotalMXN: Math.round(grandTotalMXN * 100) / 100,
    items: resultado,
  });
}
