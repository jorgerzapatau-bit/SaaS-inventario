import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const { nombreEmpresa, nombreUsuario, email, password } = await req.json();

        const existingUser = await prisma.usuario.findUnique({ where: { email } });
        if (existingUser) return Response.json({ error: 'User already exists' }, { status: 400 });

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await prisma.$transaction(async (tx) => {
            const empresaData: Prisma.EmpresaCreateInput = {
                nombre: nombreEmpresa,
                url: nombreEmpresa.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            };
            const empresa = await tx.empresa.create({ data: empresaData });
            const usuario = await tx.usuario.create({
                data: { empresaId: empresa.id, nombre: nombreUsuario, email, password: hashedPassword, role: 'ADMIN' }
            });
            return { empresa, usuario };
        });

        const token = jwt.sign(
            { id: result.usuario.id, empresaId: result.empresa.id, role: result.usuario.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        return Response.json(
            { token, user: { id: result.usuario.id, email, role: result.usuario.role } },
            { status: 201 }
        );
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Server error during registration' }, { status: 500 });
    }
}
