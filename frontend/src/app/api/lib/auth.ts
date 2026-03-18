import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

export interface AuthUser {
    id: string;
    empresaId: string;
    role: string;
}

export function getAuthUser(req: NextRequest): AuthUser | null {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthUser;
        return decoded;
    } catch {
        return null;
    }
}

export function unauthorized() {
    return Response.json({ error: 'No token provided or invalid format' }, { status: 401 });
}
