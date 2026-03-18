import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

export const getMyCompany = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
        if (!empresa) return res.status(404).json({ error: 'Company not found' });
        res.json(empresa);
    } catch (error) { console.error(error); res.status(500).json({ error: 'Error fetching company info' }); }
};

export const updateCompany = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const { nombre, url, telefono, whatsapp, email, direccion, rfc, razonSocial, codigoPostal, regimenFiscal, usoCFDI, logo, loginBg } = req.body;
        const empresa = await prisma.empresa.update({
            where: { id: empresaId },
            data: { nombre, url, telefono, whatsapp, email, direccion, rfc, razonSocial, codigoPostal, regimenFiscal, usoCFDI, logo, loginBg },
        });
        res.json(empresa);
    } catch (error) { console.error(error); res.status(500).json({ error: 'Error updating company info' }); }
};

export const getCompanyBySlug = async (req: Request<{ slug: string }>, res: Response) => {
    try {
        const slug = req.params.slug;
        const empresa = await prisma.empresa.findUnique({
            where: { url: slug },
            select: { id: true, nombre: true, url: true, logo: true, telefono: true, whatsapp: true, email: true, direccion: true, rfc: true, razonSocial: true, codigoPostal: true, regimenFiscal: true, usoCFDI: true, loginBg: true },
        });
        if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada' });
        res.json(empresa);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error interno del servidor' }); }
};
