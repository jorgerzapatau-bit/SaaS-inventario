import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

export const getCategorias = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const categorias = await prisma.categoria.findMany({
            where: { empresaId },
            orderBy: { nombre: 'asc' },
        });
        res.json(categorias);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};

export const createCategoria = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const { nombre, descripcion } = req.body;
        if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
        const categoria = await prisma.categoria.create({
            data: { empresaId, nombre: nombre.trim(), descripcion: descripcion?.trim() || null }
        });
        res.status(201).json(categoria);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear categoría' });
    }
};

export const updateCategoria = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        const { nombre, descripcion } = req.body;
        const categoria = await prisma.categoria.update({
            where: { id, empresaId },
            data: {
                nombre: nombre.trim(),
                descripcion: descripcion !== undefined ? (descripcion?.trim() || null) : undefined
            }
        });
        res.json(categoria);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar categoría' });
    }
};

export const deleteCategoria = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        await prisma.categoria.delete({ where: { id, empresaId } });
        res.json({ message: 'Categoría eliminada' });
    } catch (error: any) {
        if (error.code === 'P2003') return res.status(400).json({ error: 'No se puede eliminar: tiene productos asociados.' });
        res.status(500).json({ error: 'Error al eliminar categoría' });
    }
};
