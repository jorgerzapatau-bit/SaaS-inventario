import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

export const getAlmacenes = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const almacenes = await prisma.almacen.findMany({
            where: { empresaId },
            orderBy: { nombre: 'asc' },
        });
        res.json(almacenes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener almacenes' });
    }
};

export const createAlmacen = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const { nombre } = req.body;
        if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
        const almacen = await prisma.almacen.create({
            data: { empresaId, nombre: nombre.trim() }
        });
        res.status(201).json(almacen);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear almacén' });
    }
};

export const updateAlmacen = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        const { nombre } = req.body;
        const almacen = await prisma.almacen.update({
            where: { id, empresaId },
            data: { nombre: nombre.trim() }
        });
        res.json(almacen);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar almacén' });
    }
};

export const deleteAlmacen = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        await prisma.almacen.delete({ where: { id, empresaId } });
        res.json({ message: 'Almacén eliminado' });
    } catch (error: any) {
        if (error.code === 'P2003') return res.status(400).json({ error: 'No se puede eliminar: tiene movimientos asociados.' });
        res.status(500).json({ error: 'Error al eliminar almacén' });
    }
};
