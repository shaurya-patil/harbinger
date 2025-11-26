const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const API_KEY_HEADER = 'x-api-key';

// In-memory user store (replace with database in production)
const users = new Map();
const apiKeys = new Map();

// Initialize with default admin user
const initializeAuth = async () => {
    const adminPassword = await bcrypt.hash('admin123', 10);
    users.set('admin', {
        username: 'admin',
        password: adminPassword,
        role: 'admin',
        createdAt: new Date()
    });

    // Create default API key for service-to-service communication
    apiKeys.set('default-service-key', {
        name: 'Default Service Key',
        permissions: ['read', 'write'],
        createdAt: new Date()
    });

    console.log('[Auth] Initialized with default admin user and service key');
};

initializeAuth();

/**
 * Generate JWT token
 */
function generateToken(user) {
    return jwt.sign(
        {
            username: user.username,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * JWT Authentication Middleware
 */
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
}

/**
 * API Key Authentication Middleware
 */
function authenticateAPIKey(req, res, next) {
    const apiKey = req.headers[API_KEY_HEADER];

    if (!apiKey) {
        return res.status(401).json({ error: 'Missing API key' });
    }

    const keyData = apiKeys.get(apiKey);

    if (!keyData) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    req.apiKey = keyData;
    next();
}

/**
 * Combined Authentication Middleware (JWT or API Key)
 */
function authenticate(req, res, next) {
    // Check for JWT first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authenticateJWT(req, res, next);
    }

    // Check for API key
    const apiKey = req.headers[API_KEY_HEADER];
    if (apiKey) {
        return authenticateAPIKey(req, res, next);
    }

    return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Role-Based Access Control Middleware
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

/**
 * Register new user
 */
async function registerUser(username, password, role = 'user') {
    if (users.has(username)) {
        throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
        username,
        password: hashedPassword,
        role,
        createdAt: new Date()
    };

    users.set(username, user);
    return { username, role, createdAt: user.createdAt };
}

/**
 * Login user
 */
async function loginUser(username, password) {
    const user = users.get(username);

    if (!user) {
        throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
        throw new Error('Invalid credentials');
    }

    const token = generateToken(user);
    return { token, user: { username: user.username, role: user.role } };
}

/**
 * Create API key
 */
function createAPIKey(name, permissions = ['read']) {
    const apiKey = `sk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    apiKeys.set(apiKey, {
        name,
        permissions,
        createdAt: new Date()
    });

    return apiKey;
}

/**
 * Revoke API key
 */
function revokeAPIKey(apiKey) {
    return apiKeys.delete(apiKey);
}

/**
 * List all API keys (without showing actual keys)
 */
function listAPIKeys() {
    const keys = [];
    apiKeys.forEach((data, key) => {
        keys.push({
            keyPreview: key.substring(0, 10) + '...',
            name: data.name,
            permissions: data.permissions,
            createdAt: data.createdAt
        });
    });
    return keys;
}

module.exports = {
    authenticate,
    authenticateJWT,
    authenticateAPIKey,
    requireRole,
    registerUser,
    loginUser,
    createAPIKey,
    revokeAPIKey,
    listAPIKeys,
    generateToken,
    verifyToken
};
