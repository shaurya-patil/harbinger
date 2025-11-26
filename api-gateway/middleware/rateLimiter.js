const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true, // Don't count successful requests
});

// Orchestrator task submission rate limiter
const orchestratorLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 task submissions per minute
    message: 'Too many task submissions, please slow down.',
});

// Agent execution rate limiter
const agentLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 agent executions per minute
    message: 'Too many agent requests, please slow down.',
});

// Create custom rate limiter with user-based tracking
function createUserRateLimiter(options) {
    return rateLimit({
        ...options,
        keyGenerator: (req) => {
            // Use user ID if authenticated, otherwise fall back to IP
            return req.user?.username || req.ip;
        },
    });
}

// Per-user orchestrator limiter (more generous for authenticated users)
const userOrchestratorLimiter = createUserRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute for authenticated users
    message: 'Rate limit exceeded for your account.',
});

module.exports = {
    apiLimiter,
    authLimiter,
    orchestratorLimiter,
    agentLimiter,
    userOrchestratorLimiter,
    createUserRateLimiter
};
