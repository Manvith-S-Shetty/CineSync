import express = require('express');
import { requireAdmin, type AdminRequest } from '../middleware/requireAdmin';

const router = express.Router();

router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

/** Confirms the verified admin identity. UID comes only from the verified token. */
router.get('/me', requireAdmin, (req, res) => {
    const admin = (req as AdminRequest).admin;
    if (!admin) {
        res.status(401).json({
            ok: false,
            error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
        });
        return;
    }

    res.status(200).json({
        ok: true,
        data: {
            uid: admin.uid,
            isAdmin: true,
        },
    });
});

export = router;
