import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getAuthUser } from '@/lib/auth';

// POST /api/auth/refresh
// Verifica el token actual y emite uno nuevo con 1 día más de vigencia.
// Se llama silenciosamente desde el cliente cuando hay actividad.
export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) {
        return Response.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }

    const newToken = jwt.sign(
        { id: user.id, empresaId: user.empresaId, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1d' }
    );

    return Response.json({ token: newToken });
}

