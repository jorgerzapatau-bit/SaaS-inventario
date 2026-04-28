// src/app/api/equipos/[id]/mantenimientos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Moneda, OrigenInsumo, TipoBitacora, TipoMovimiento } from "@prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ─── GET /api/equipos/:id/mantenimientos ──────────────────────────────────────
// Devuelve registros nuevos (MantenimientoEquipo) ordenados por fecha desc.
// El frontend los mezcla con RegistroMantenimiento (legacy) para mostrar
// la bitácora unificada.
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id: equipoId } = await params;

  const equipo = await prisma.equipo.findUnique({ where: { id: equipoId } });
  if (!equipo) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  const registros = await prisma.mantenimientoEquipo.findMany({
    where: { equipoId },
    orderBy: { fecha: "desc" },
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

  return NextResponse.json(registros);
}

// ─── POST /api/equipos/:id/mantenimientos ─────────────────────────────────────
// Crea un registro de bitácora (EVENTO o MANTENIMIENTO).
// Si es MANTENIMIENTO:
//   - Por cada insumo de tipo ALMACEN: verifica stock, descuenta Producto.stockActual
//     y crea MovimientoInventario (Kardex).
//   - Por cada insumo de tipo COMPRA_DIRECTA: solo registra el costo, sin tocar almacén.
//   - Marca los pendientesIds como resueltos y los vincula a este mantenimiento.
// Todo ocurre en una única transacción de Prisma.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: equipoId } = await params;

  const equipo = await prisma.equipo.findUnique({ where: { id: equipoId } });
  if (!equipo) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    fecha,
    tipo,
    descripcion,
    observaciones,
    horometro,
    insumos,
    pendientesIds,
    usuarioId,
  } = body as {
    fecha?: string;
    tipo?: TipoBitacora;
    descripcion?: string;
    observaciones?: string;
    horometro?: number;
    usuarioId?: string;
    insumos?: {
      origen: OrigenInsumo;
      // ALMACEN
      productoId?: string;
      almacenId?: string;
      // COMPRA_DIRECTA
      descripcionLibre?: string;
      // comunes
      cantidad: number;
      precioUnitario: number;
      moneda?: Moneda;
      tipoCambio?: number;
    }[];
    pendientesIds?: string[];
  };

  // ── Validaciones básicas ──────────────────────────────────────────────────
  if (!fecha || !descripcion?.trim()) {
    return NextResponse.json(
      { error: "Los campos fecha y descripcion son requeridos" },
      { status: 400 }
    );
  }

  const tipoFinal: TipoBitacora = tipo ?? TipoBitacora.MANTENIMIENTO;

  // Solo MANTENIMIENTO puede tener insumos / pendientes
  const insumosLista = tipoFinal === TipoBitacora.MANTENIMIENTO ? (insumos ?? []) : [];
  const pendientesLista = tipoFinal === TipoBitacora.MANTENIMIENTO ? (pendientesIds ?? []) : [];

  // ── Pre-validar stock de insumos de ALMACEN ───────────────────────────────
  // Lo hacemos ANTES de abrir la transacción para devolver errores descriptivos.
  for (const ins of insumosLista) {
    if (ins.origen === OrigenInsumo.ALMACEN) {
      if (!ins.productoId || !ins.almacenId) {
        return NextResponse.json(
          { error: "Insumos de tipo ALMACEN requieren productoId y almacenId" },
          { status: 400 }
        );
      }
      const producto = await prisma.producto.findUnique({
        where: { id: ins.productoId },
        select: { nombre: true, stockActual: true, unidad: true },
      });
      if (!producto) {
        return NextResponse.json(
          { error: `Producto ${ins.productoId} no encontrado` },
          { status: 404 }
        );
      }
      if (Number(producto.stockActual) < ins.cantidad) {
        return NextResponse.json(
          {
            error: `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stockActual} ${producto.unidad}, solicitado: ${ins.cantidad}`,
          },
          { status: 422 }
        );
      }
    } else {
      // COMPRA_DIRECTA
      if (!ins.descripcionLibre?.trim()) {
        return NextResponse.json(
          { error: "Insumos de tipo COMPRA_DIRECTA requieren descripcionLibre" },
          { status: 400 }
        );
      }
    }
  }

  // ── Transacción ───────────────────────────────────────────────────────────
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear el registro de bitácora
      const registro = await tx.mantenimientoEquipo.create({
        data: {
          empresaId:    equipo.empresaId,
          equipoId,
          fecha:        new Date(fecha),
          tipo:         tipoFinal,
          descripcion:  descripcion.trim(),
          observaciones: observaciones?.trim() ?? null,
          horometro:    horometro ?? null,
        },
      });

      // 2. Procesar insumos
      for (const ins of insumosLista) {
        if (ins.origen === OrigenInsumo.ALMACEN) {
          // a) Crear línea de insumo
          const insumoCreado = await tx.mantenimientoInsumo.create({
            data: {
              mantenimientoId:  registro.id,
              origen:           OrigenInsumo.ALMACEN,
              productoId:       ins.productoId!,
              almacenId:        ins.almacenId!,
              cantidad:         ins.cantidad,
              precioUnitario:   ins.precioUnitario,
              moneda:           ins.moneda ?? Moneda.MXN,
              tipoCambio:       ins.tipoCambio ?? null,
            },
          });

          // b) Descontar stock del producto
          await tx.producto.update({
            where: { id: ins.productoId! },
            data:  { stockActual: { decrement: ins.cantidad } },
          });

          // c) Crear movimiento en Kardex
          await tx.movimientoInventario.create({
            data: {
              empresaId:            equipo.empresaId,
              productoId:           ins.productoId!,
              almacenId:            ins.almacenId!,
              tipoMovimiento:       TipoMovimiento.SALIDA,
              cantidad:             ins.cantidad,
              costoUnitario:        ins.precioUnitario,
              moneda:               ins.moneda ?? Moneda.MXN,
              tipoCambio:           ins.tipoCambio ?? null,
              fecha:                new Date(fecha),
              referencia:           `MANT-${registro.id}`,
              notas:                `Mantenimiento: ${descripcion.trim()}`,
              usuarioId:            usuarioId ?? equipo.empresaId, // fallback; el frontend debe enviar usuarioId
              mantenimientoInsumoId: insumoCreado.id,
            },
          });
        } else {
          // COMPRA_DIRECTA — solo registrar el costo, sin tocar almacén
          await tx.mantenimientoInsumo.create({
            data: {
              mantenimientoId:  registro.id,
              origen:           OrigenInsumo.COMPRA_DIRECTA,
              descripcionLibre: ins.descripcionLibre!.trim(),
              cantidad:         ins.cantidad,
              precioUnitario:   ins.precioUnitario,
              moneda:           ins.moneda ?? Moneda.MXN,
              tipoCambio:       ins.tipoCambio ?? null,
            },
          });
        }
      }

      // 3. Marcar pendientes como resueltos y vincularlos
      if (pendientesLista.length > 0) {
        await tx.pendienteEquipo.updateMany({
          where: {
            id:       { in: pendientesLista },
            equipoId,           // seguridad: solo pendientes de este equipo
            resuelto: false,
          },
          data: {
            resuelto:       true,
            fechaResuelto:  new Date(fecha),
            mantenimientoId: registro.id,
          },
        });
      }

      // 4. Devolver el registro completo con relaciones
      return tx.mantenimientoEquipo.findUniqueOrThrow({
        where: { id: registro.id },
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
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /mantenimientos]", err);
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
