import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const requireTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.empresaId) {
        return res.status(400).json({ error: 'Tenant context is missing. Cannot perform operation.' });
    }

    // Inject empresaId into req.body if it's a POST/PUT request and user tries to omit it (or prevent override)
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        req.body.empresaId = req.user.empresaId;
    }

    next();
};
