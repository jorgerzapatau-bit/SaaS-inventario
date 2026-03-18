import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';

export const register = async (req: Request, res: Response) => {
    try {
        const { nombreEmpresa, nombreUsuario, email, password } = req.body;

        // Check if user exists
        const existingUser = await prisma.usuario.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Create Tenant (Empresa) and Admin User
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await prisma.$transaction(async (tx) => {
            const empresaData: Prisma.EmpresaCreateInput = {
                nombre: nombreEmpresa,
                url: nombreEmpresa.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            };

            const empresa = await tx.empresa.create({
                data: empresaData
            });

            const usuario = await tx.usuario.create({
                data: {
                    empresaId: empresa.id,
                    nombre: nombreUsuario,
                    email,
                    password: hashedPassword,
                    role: 'ADMIN'
                }
            });

            return { empresa, usuario };
        });

        const token = jwt.sign(
            { id: result.usuario.id, empresaId: result.empresa.id, role: result.usuario.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.status(201).json({ token, user: { id: result.usuario.id, email, role: result.usuario.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during registration' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.usuario.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, empresaId: user.empresaId, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.json({ token, user: { id: user.id, email, role: user.role, empresaId: user.empresaId } });
    } catch (error) {
        res.status(500).json({ error: 'Server error during login' });
    }
};
