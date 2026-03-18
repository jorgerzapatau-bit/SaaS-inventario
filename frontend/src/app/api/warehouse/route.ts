import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const almacenes = await prisma.almacen.findMany({ where: { empresaId: user.empresaId }, orderBy: { nombre: 'asc' } });
        return Response.json(almacenes);
    } catch { return Response.json({ error: 'Error al obtener almacenes' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { nombre } = await req.json();
        if (!nombre?.trim()) return Response.json({ error: 'El nombre es requerido' }, { status: 400 });
        const almacen = await prisma.almacen.create({ data: { empresaId: user.empresaId, nombre: nombre.trim() } });
        return Response.json(almacen, { status: 201 });
    } catch { return Response.json({ error: 'Error al crear almacén' }, { status: 500 }); }
}
