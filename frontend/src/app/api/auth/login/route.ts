import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        const user = await prisma.usuario.findUnique({ where: { email } });
        if (!user) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

        const token = jwt.sign(
            { id: user.id, empresaId: user.empresaId, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '1d' }
        );

        return Response.json({ token, user: { id: user.id, email, role: user.role, empresaId: user.empresaId } });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Server error during login' }, { status: 500 });
    }
}

