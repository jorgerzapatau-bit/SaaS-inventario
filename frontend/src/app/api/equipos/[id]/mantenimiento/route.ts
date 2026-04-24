// src/app/api/equipos/[id]/mantenimiento/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/lib/prisma';
import { TipoMantenimiento, Moneda } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/equipos/:id/mantenimiento
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: equipoId } = await params;

  const equipo = await prisma.equipo.findUnique({ where: { id: equipoId } });
  if (!equipo) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  const registros = await prisma.registroMantenimiento.findMany({
    where: { equipoId },
    orderBy: { fecha: "desc" },
  });

  return NextResponse.json(registros);
}

// POST /api/equipos/:id/mantenimiento
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
    costo,
    moneda,
    tipoCambio,
    horometro,
    hrsUso,
    numeroParte,
    proveedorId,
    obraId,
  } = body as {
    fecha?: string;
    tipo?: TipoMantenimiento;
    descripcion?: string;
    observaciones?: string;
    costo?: number;
    moneda?: Moneda;
    tipoCambio?: number;
    horometro?: number;
    hrsUso?: number;
    numeroParte?: string;
    proveedorId?: string;
    obraId?: string;
  };

  if (!fecha || !descripcion) {
    return NextResponse.json(
      { error: "Los campos fecha y descripcion son requeridos" },
      { status: 400 }
    );
  }

  const registro = await prisma.registroMantenimiento.create({
    data: {
      empresaId: equipo.empresaId,
      equipoId,
      fecha: new Date(fecha),
      tipo: tipo ?? undefined,
      descripcion,
      observaciones: observaciones ?? null,
      costo: costo ?? null,
      moneda: moneda ?? undefined,
      tipoCambio: tipoCambio ?? null,
      horometro: horometro ?? null,
      hrsUso: hrsUso ?? null,
      numeroParte: numeroParte ?? null,
      proveedorId: proveedorId ?? null,
      obraId: obraId ?? null,
    },
  });

  return NextResponse.json(registro, { status: 201 });
}
