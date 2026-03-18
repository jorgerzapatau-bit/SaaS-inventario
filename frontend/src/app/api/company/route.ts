import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const empresa = await prisma.empresa.findUnique({ where: { id: user.empresaId } });
        if (!empresa) return Response.json({ error: 'Company not found' }, { status: 404 });
        return Response.json(empresa);
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error fetching company info' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { nombre, url, telefono, whatsapp, email, direccion, rfc, razonSocial, codigoPostal, regimenFiscal, usoCFDI, logo, loginBg } = await req.json();
        const empresa = await prisma.empresa.update({
            where: { id: user.empresaId },
            data: { nombre, url, telefono, whatsapp, email, direccion, rfc, razonSocial, codigoPostal, regimenFiscal, usoCFDI, logo, loginBg },
        });
        return Response.json(empresa);
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error updating company info' }, { status: 500 });
    }
}
