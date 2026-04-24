    // src/app/api/equipos/[id]/mantenimiento/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: { id: string };
}

// GET /api/equipos/:id/mantenimiento
// Devuelve todos los registros de mantenimiento del equipo, ordenados por fecha desc.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const equipoId = params.id;

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
// Crea un nuevo registro de mantenimiento para el equipo.
//
// Body esperado (JSON):
// {
//   fecha: string (ISO 8601),        // requerido
//   tipo: string,                    // requerido  — ej. "Preventivo" | "Correctivo"
//   descripcion: string,             // requerido
//   tecnico?: string,
//   costo?: number,
//   proximoMantenimiento?: string    // ISO 8601
// }
export async function POST(req: NextRequest, { params }: RouteContext) {
  const equipoId = params.id;

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
