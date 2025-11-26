const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation error handler middleware
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
}

/**
 * Orchestrator task validation
 */
const validateOrchestratorTask = [
    body('input')
        .trim()
        .notEmpty().withMessage('Input is required')
        .isLength({ min: 3, max: 5000 }).withMessage('Input must be between 3 and 5000 characters'),
    body('userId')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('User ID must be between 1 and 100 characters'),
    handleValidationErrors
];

/**
 * Agent execution validation
 */
const validateAgentExecution = [
    param('agentName')
        .trim()
        .notEmpty().withMessage('Agent name is required')
        .matches(/^[a-z]+$/).withMessage('Agent name must contain only lowercase letters'),
    body('action')
        .trim()
        .notEmpty().withMessage('Action is required')
        .matches(/^[a-z_\.]+$/).withMessage('Action must contain only lowercase letters, underscores, and dots'),
    body('params')
        .optional()
        .isObject().withMessage('Params must be an object'),
    handleValidationErrors
];

/**
 * User registration validation
 */
const validateUserRegistration = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required')
        .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    handleValidationErrors
];

/**
 * User login validation
 */
const validateUserLogin = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required'),
    body('password')
        .notEmpty().withMessage('Password is required'),
    handleValidationErrors
];

/**
 * Memory alias validation
 */
const validateMemoryAlias = [
    body('userId')
        .trim()
        .notEmpty().withMessage('User ID is required'),
    body('type')
        .trim()
        .notEmpty().withMessage('Type is required')
        .isIn(['email', 'name', 'nickname', 'location', 'preference', 'contact', 'identifier', 'custom'])
        .withMessage('Invalid alias type'),
    body('value')
        .trim()
        .notEmpty().withMessage('Value is required'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    handleValidationErrors
];

/**
 * Memory set validation
 */
const validateMemorySet = [
    body('userId')
        .trim()
        .notEmpty().withMessage('User ID is required'),
    body('key')
        .trim()
        .notEmpty().withMessage('Key is required')
        .isLength({ min: 1, max: 100 }).withMessage('Key must be between 1 and 100 characters'),
    body('value')
        .notEmpty().withMessage('Value is required'),
    body('context')
        .optional()
        .trim()
        .isLength({ max: 1000 }).withMessage('Context must be less than 1000 characters'),
    handleValidationErrors
];

/**
 * API key creation validation
 */
const validateAPIKeyCreation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3 and 100 characters'),
    body('permissions')
        .optional()
        .isArray().withMessage('Permissions must be an array')
        .custom((permissions) => {
            const validPermissions = ['read', 'write', 'admin'];
            return permissions.every(p => validPermissions.includes(p));
        }).withMessage('Invalid permissions'),
    handleValidationErrors
];

/**
 * Sanitize input to prevent XSS
 */
function sanitizeInput(req, res, next) {
    // Basic XSS prevention - remove script tags and dangerous attributes
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
                .replace(/javascript:/gi, '');
        }
        if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(key => {
                obj[key] = sanitize(obj[key]);
            });
        }
        return obj;
    };

    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);

    next();
}

module.exports = {
    validateOrchestratorTask,
    validateAgentExecution,
    validateUserRegistration,
    validateUserLogin,
    validateMemoryAlias,
    validateMemorySet,
    validateAPIKeyCreation,
    sanitizeInput,
    handleValidationErrors
};
