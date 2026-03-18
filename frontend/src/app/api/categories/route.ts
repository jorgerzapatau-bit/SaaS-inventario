import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const categorias = await prisma.categoria.findMany({ where: { empresaId: user.empresaId }, orderBy: { nombre: 'asc' } });
        return Response.json(categorias);
    } catch { return Response.json({ error: 'Error al obtener categorías' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { nombre, descripcion } = await req.json();
        if (!nombre?.trim()) return Response.json({ error: 'El nombre es requerido' }, { status: 400 });
        const categoria = await prisma.categoria.create({
            data: { empresaId: user.empresaId, nombre: nombre.trim(), descripcion: descripcion?.trim() || null }
        });
        return Response.json(categoria, { status: 201 });
    } catch { return Response.json({ error: 'Error al crear categoría' }, { status: 500 }); }
}
