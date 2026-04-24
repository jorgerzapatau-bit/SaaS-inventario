// src/app/api/equipos/[id]/mantenimiento/[regId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { TipoMantenimiento } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string; regId: string }>;
}

// PUT /api/equipos/:id/mantenimiento/:regId
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { id: equipoId, regId } = await params;

  const registro = await prisma.registroMantenimiento.findFirst({
    where: { id: regId, equipoId },
  });

  if (!registro) {
    return NextResponse.json(
      { error: "Registro no encontrado para este equipo" },
      { status: 404 }
    );
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
      tipo?: TipoMantenimiento;
      descripcion?: string;
      tecnico?: string;
      costo?: number | null;
      proximoMantenimiento?: string | null;
    };

  const actualizado = await prisma.registroMantenimiento.update({
    where: { id: regId },
    data: {
      ...(fecha !== undefined && { fecha: new Date(fecha) }),
      ...(tipo !== undefined && { tipo }),
      ...(descripcion !== undefined && { descripcion }),
      ...(tecnico !== undefined && { tecnico }),
      ...(costo !== undefined && { costo }),
      ...(proximoMantenimiento !== undefined && {
        proximoMantenimiento: proximoMantenimiento
          ? new Date(proximoMantenimiento)
          : null,
      }),
    },
  });

  return NextResponse.json(actualizado);
}

// DELETE /api/equipos/:id/mantenimiento/:regId
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id: equipoId, regId } = await params;

  const registro = await prisma.registroMantenimiento.findFirst({
    where: { id: regId, equipoId },
  });

  if (!registro) {
    return NextResponse.json(
      { error: "Registro no encontrado para este equipo" },
      { status: 404 }
    );
  }

  await prisma.registroMantenimiento.delete({ where: { id: regId } });

  return new NextResponse(null, { status: 204 });
}
