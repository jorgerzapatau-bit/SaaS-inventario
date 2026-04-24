// src/app/api/equipos/[id]/mantenimiento/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/lib/prisma';

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

  const { fecha, tipo, descripcion, tecnico, costo, proximoMantenimiento } =
    body as {
      fecha?: string;
      tipo?: string;
      descripcion?: string;
      tecnico?: string;
      costo?: number;
      proximoMantenimiento?: string;
    };

  if (!fecha || !tipo || !descripcion) {
    return NextResponse.json(
      { error: "Los campos fecha, tipo y descripcion son requeridos" },
      { status: 400 }
    );
  }

  const registro = await prisma.registroMantenimiento.create({
    data: {
      equipoId,
      fecha: new Date(fecha),
      tipo,
      descripcion,
      tecnico: tecnico ?? null,
      costo: costo ?? null,
      proximoMantenimiento: proximoMantenimiento
        ? new Date(proximoMantenimiento)
        : null,
    },
  });

  return NextResponse.json(registro, { status: 201 });
}
