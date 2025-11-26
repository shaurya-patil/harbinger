/**
 * Role-Based Access Control (RBAC) Middleware
 * Provides role-based authorization for API endpoints
 */

const { logger } = require('./logger');

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
    guest: 0,
    user: 1,
    admin: 2,
    superadmin: 3
};

/**
 * Middleware to require a specific role
 * @param {string} requiredRole - Minimum role required to access the endpoint
 * @returns {Function} Express middleware function
 */
function requireRole(requiredRole) {
    return (req, res, next) => {
        // Check if user is authenticated
        if (!req.user) {
            logger.warn('RBAC: Unauthenticated access attempt', {
                path: req.path,
                method: req.method,
                ip: req.ip
            });
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        // Get user's role (default to 'user' if not specified)
        const userRole = req.user.role || 'user';

        // Check if required role exists
        if (!(requiredRole in ROLE_HIERARCHY)) {
            logger.error('RBAC: Invalid role specified', { requiredRole });
            return res.status(500).json({
                error: 'Internal server error',
                code: 'INVALID_ROLE_CONFIG'
            });
        }

        // Check if user role exists
        if (!(userRole in ROLE_HIERARCHY)) {
            logger.error('RBAC: User has invalid role', {
                userId: req.user.id,
                userRole
            });
            return res.status(403).json({
                error: 'Invalid user role',
                code: 'INVALID_USER_ROLE'
            });
        }

        // Compare role hierarchy levels
        const userLevel = ROLE_HIERARCHY[userRole];
        const requiredLevel = ROLE_HIERARCHY[requiredRole];

        if (userLevel < requiredLevel) {
            logger.warn('RBAC: Insufficient permissions', {
                userId: req.user.id,
                username: req.user.username,
                userRole,
                requiredRole,
                path: req.path,
                method: req.method,
                ip: req.ip
            });
            return res.status(403).json({
                error: 'Insufficient permissions',
                code: 'FORBIDDEN',
                required: requiredRole,
                current: userRole
            });
        }

        // Log successful authorization
        logger.info('RBAC: Access granted', {
            userId: req.user.id,
            username: req.user.username,
            role: userRole,
            path: req.path,
            method: req.method
        });

        next();
    };
}

/**
 * Middleware to require any of multiple roles
 * @param {string[]} roles - Array of acceptable roles
 * @returns {Function} Express middleware function
 */
function requireAnyRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const userRole = req.user.role || 'user';

        if (roles.includes(userRole)) {
            logger.info('RBAC: Access granted (any role)', {
                userId: req.user.id,
                role: userRole,
                acceptedRoles: roles,
                path: req.path
            });
            return next();
        }

        logger.warn('RBAC: Insufficient permissions (any role)', {
            userId: req.user.id,
            userRole,
            acceptedRoles: roles,
            path: req.path
        });

        res.status(403).json({
            error: 'Insufficient permissions',
            code: 'FORBIDDEN',
            acceptedRoles: roles,
            current: userRole
        });
    };
}

/**
 * Middleware to check if user owns the resource
 * @param {Function} getResourceOwnerId - Function to extract owner ID from request
 * @returns {Function} Express middleware function
 */
function requireOwnership(getResourceOwnerId) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const ownerId = getResourceOwnerId(req);
        const userId = req.user.id;
        const userRole = req.user.role || 'user';

        // Admins can access any resource
        if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY.admin) {
            logger.info('RBAC: Admin override for ownership check', {
                userId,
                role: userRole,
                ownerId
            });
            return next();
        }

        // Check ownership
        if (userId !== ownerId) {
            logger.warn('RBAC: Ownership check failed', {
                userId,
                ownerId,
                path: req.path
            });
            return res.status(403).json({
                error: 'Access denied - not resource owner',
                code: 'NOT_OWNER'
            });
        }

        logger.info('RBAC: Ownership verified', { userId, ownerId });
        next();
    };
}

/**
 * Middleware to check specific permissions
 * @param {string[]} requiredPermissions - Array of required permissions
 * @returns {Function} Express middleware function
 */
function requirePermissions(requiredPermissions) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const userPermissions = req.user.permissions || [];

        // Check if user has all required permissions
        const hasAllPermissions = requiredPermissions.every(
            perm => userPermissions.includes(perm)
        );

        if (!hasAllPermissions) {
            const missingPermissions = requiredPermissions.filter(
                perm => !userPermissions.includes(perm)
            );

            logger.warn('RBAC: Missing permissions', {
                userId: req.user.id,
                required: requiredPermissions,
                missing: missingPermissions,
                path: req.path
            });

            return res.status(403).json({
                error: 'Insufficient permissions',
                code: 'MISSING_PERMISSIONS',
                missing: missingPermissions
            });
        }

        logger.info('RBAC: Permissions verified', {
            userId: req.user.id,
            permissions: requiredPermissions
        });

        next();
    };
}

module.exports = {
    requireRole,
    requireAnyRole,
    requireOwnership,
    requirePermissions,
    ROLE_HIERARCHY
};
