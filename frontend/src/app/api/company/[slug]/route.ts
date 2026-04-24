import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const empresa = await prisma.empresa.findUnique({
            where: { url: slug },
            select: {
                id: true, nombre: true, url: true, logo: true,
                telefono: true, whatsapp: true, email: true,
                direccion: true, rfc: true, razonSocial: true,
                codigoPostal: true, regimenFiscal: true, usoCFDI: true, loginBg: true
            },
        });
        if (!empresa) return Response.json({ message: 'Empresa no encontrada' }, { status: 404 });
        return Response.json(empresa);
    } catch (error) {
        console.error(error);
        return Response.json({ message: 'Error interno del servidor' }, { status: 500 });
    }
}

