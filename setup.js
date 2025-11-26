const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ANSI color codes for better UX
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(text) {
    console.log('\n' + '='.repeat(60));
    log(text, 'bright');
    console.log('='.repeat(60) + '\n');
}

async function confirmOrSkip(message) {
    const answer = await question(`${message} (y/n, default: n): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

async function setup() {
    console.clear();
    header('🚀 Harbinger Agent System - First Time Setup');

    log('Welcome! This wizard will help you configure all necessary credentials.', 'cyan');
    log('You can skip optional items by pressing Enter.\n', 'yellow');

    const config = {
        orchestrator: {},
        gmail: {},
        database: {},
        excel: {}
    };

    // ============================================
    // 1. GROQ API Key (CRITICAL)
    // ============================================
    header('1️⃣  GROQ API Key (REQUIRED)');
    log('The orchestrator needs a GROQ API key for LLM-based task planning.', 'cyan');
    log('Get your key from: https://console.groq.com/keys\n', 'blue');

    config.orchestrator.GROQ_API_KEY = await question('Enter your GROQ API key: ');

    if (!config.orchestrator.GROQ_API_KEY) {
        log('⚠️  WARNING: Without GROQ API key, the orchestrator will NOT work!', 'red');
        const proceed = await confirmOrSkip('Continue anyway?');
        if (!proceed) {
            log('\nSetup cancelled. Run this script again when you have the API key.', 'yellow');
            rl.close();
            return;
        }
    } else {
        log('✓ GROQ API key configured', 'green');
    }

    // ============================================
    // 2. Gmail SMTP Credentials (CRITICAL)
    // ============================================
    header('2️⃣  Gmail SMTP Credentials (REQUIRED for Email)');
    log('Required for the Gmail agent to send emails.', 'cyan');
    log('You need to generate an App Password (not your regular password).', 'yellow');
    log('Guide: https://support.google.com/accounts/answer/185833\n', 'blue');

    const configureGmail = await confirmOrSkip('Configure Gmail now?');

    if (configureGmail) {
        config.gmail.GMAIL_USER = await question('Enter your Gmail address: ');
        config.gmail.GMAIL_PASS = await question('Enter your Gmail App Password: ');

        if (config.gmail.GMAIL_USER && config.gmail.GMAIL_PASS) {
            log('✓ Gmail credentials configured', 'green');
        } else {
            log('⚠️  Incomplete Gmail configuration - email sending will fail', 'yellow');
        }
    } else {
        log('⚠️  Gmail not configured - email sending will fail', 'yellow');
    }

    // ============================================
    // 3. Google Calendar OAuth (CRITICAL)
    // ============================================
    header('3️⃣  Google Calendar OAuth (REQUIRED for Calendar)');
    log('Calendar agent requires OAuth 2.0 credentials.', 'cyan');
    log('Steps:', 'yellow');
    log('  1. Go to https://console.cloud.google.com/', 'blue');
    log('  2. Create OAuth 2.0 Client ID credentials', 'blue');
    log('  3. Download the JSON file', 'blue');
    log('  4. Save it as "credentials.json" in the project root\n', 'blue');

    const hasCredentials = await confirmOrSkip('Have you already created credentials.json?');

    if (!hasCredentials) {
        log('⚠️  Calendar operations will fail without credentials.json', 'yellow');
        log('   You can add it later and run the calendar agent to authenticate.', 'cyan');
    } else {
        log('✓ credentials.json should be in place', 'green');
        log('   Run the calendar agent once to complete OAuth flow.', 'cyan');
    }

    // ============================================
    // 4. PostgreSQL Database (OPTIONAL)
    // ============================================
    header('4️⃣  PostgreSQL Database (OPTIONAL - Recommended)');
    log('Database enables persistent task history and memory.', 'cyan');
    log('Without it, the system uses in-memory storage (data lost on restart).\n', 'yellow');

    const configureDB = await confirmOrSkip('Configure PostgreSQL database?');

    if (configureDB) {
        config.database.DB_HOST = await question('Database host (default: localhost): ') || 'localhost';
        config.database.DB_PORT = await question('Database port (default: 5432): ') || '5432';
        config.database.DB_NAME = await question('Database name (default: harbinger): ') || 'harbinger';
        config.database.DB_USER = await question('Database user (default: postgres): ') || 'postgres';
        config.database.DB_PASSWORD = await question('Database password: ');
        config.database.DB_POOL_MIN = '2';
        config.database.DB_POOL_MAX = '10';
        config.database.DB_IDLE_TIMEOUT = '30000';

        log('✓ Database configuration saved', 'green');
        log('   Remember to run: psql -U postgres -d harbinger -f database/schema.sql', 'cyan');
    } else {
        log('⚠️  Using in-memory storage - data will be lost on restart', 'yellow');
    }

    // ============================================
    // 5. Excel Azure AD (OPTIONAL)
    // ============================================
    header('5️⃣  Excel Azure AD Credentials (OPTIONAL)');
    log('Only needed for OneDrive/SharePoint Excel files.', 'cyan');
    log('Local Excel files work without this.\n', 'yellow');

    const configureExcel = await confirmOrSkip('Configure Azure AD for Excel?');

    if (configureExcel) {
        config.excel.AZURE_CLIENT_ID = await question('Azure Client ID: ');
        config.excel.AZURE_CLIENT_SECRET = await question('Azure Client Secret: ');
        config.excel.AZURE_TENANT_ID = await question('Azure Tenant ID: ');
        config.excel.ONEDRIVE_USER_EMAIL = await question('OneDrive user email (optional): ');

        log('✓ Azure AD credentials configured', 'green');
    } else {
        log('ℹ️  Excel agent will work with local files only', 'cyan');
    }

    // ============================================
    // 6. Write Configuration Files
    // ============================================
    header('6️⃣  Writing Configuration Files');

    try {
        // Orchestrator .env
        if (config.orchestrator.GROQ_API_KEY) {
            const orchestratorEnv = `GROQ_API_KEY=${config.orchestrator.GROQ_API_KEY}\n`;
            fs.writeFileSync(path.join(__dirname, 'orchestrator', '.env'), orchestratorEnv);
            log('✓ Created orchestrator/.env', 'green');
        }

        // Gmail .env
        if (config.gmail.GMAIL_USER && config.gmail.GMAIL_PASS) {
            const gmailEnv = `GMAIL_USER=${config.gmail.GMAIL_USER}\nGMAIL_PASS=${config.gmail.GMAIL_PASS}\n`;
            fs.writeFileSync(path.join(__dirname, 'agents', 'gmail-agent-node', '.env'), gmailEnv);
            log('✓ Created agents/gmail-agent-node/.env', 'green');
        }

        // Database .env
        if (configureDB && config.database.DB_PASSWORD) {
            const dbEnv = `DB_HOST=${config.database.DB_HOST}
DB_PORT=${config.database.DB_PORT}
DB_NAME=${config.database.DB_NAME}
DB_USER=${config.database.DB_USER}
DB_PASSWORD=${config.database.DB_PASSWORD}

DB_POOL_MIN=${config.database.DB_POOL_MIN}
DB_POOL_MAX=${config.database.DB_POOL_MAX}
DB_IDLE_TIMEOUT=${config.database.DB_IDLE_TIMEOUT}
`;
            fs.writeFileSync(path.join(__dirname, 'database', '.env'), dbEnv);
            log('✓ Created database/.env', 'green');
        }

        // Excel .env
        if (configureExcel && config.excel.AZURE_CLIENT_ID) {
            const excelEnv = `AZURE_CLIENT_ID=${config.excel.AZURE_CLIENT_ID}
AZURE_CLIENT_SECRET=${config.excel.AZURE_CLIENT_SECRET}
AZURE_TENANT_ID=${config.excel.AZURE_TENANT_ID}
${config.excel.ONEDRIVE_USER_EMAIL ? `ONEDRIVE_USER_EMAIL=${config.excel.ONEDRIVE_USER_EMAIL}` : ''}
`;
            fs.writeFileSync(path.join(__dirname, 'agents', 'excel-agent-node', '.env'), excelEnv);
            log('✓ Created agents/excel-agent-node/.env', 'green');
        }

        // Create a setup completion marker
        const setupInfo = {
            completed: true,
            timestamp: new Date().toISOString(),
            configured: {
                groq: !!config.orchestrator.GROQ_API_KEY,
                gmail: !!(config.gmail.GMAIL_USER && config.gmail.GMAIL_PASS),
                calendar: hasCredentials,
                database: configureDB,
                excel: configureExcel
            }
        };
        fs.writeFileSync(path.join(__dirname, '.setup-complete'), JSON.stringify(setupInfo, null, 2));

    } catch (error) {
        log(`\n❌ Error writing configuration files: ${error.message}`, 'red');
        rl.close();
        return;
    }

    // ============================================
    // 7. Next Steps
    // ============================================
    header('✅ Setup Complete!');

    log('Configuration files have been created.\n', 'green');

    log('Next Steps:', 'bright');
    console.log('');

    if (!config.orchestrator.GROQ_API_KEY) {
        log('  ⚠️  1. Add GROQ API key to orchestrator/.env', 'yellow');
    }

    if (!hasCredentials) {
        log('  ⚠️  2. Add credentials.json for Google Calendar', 'yellow');
    }

    if (configureDB) {
        log('  📊 3. Initialize database:', 'cyan');
        log('     psql -U postgres -d harbinger -f database/schema.sql', 'blue');
        log('     psql -U postgres -d harbinger -f database/init.sql', 'blue');
    }

    log('\n  🚀 4. Start the system:', 'cyan');
    log('     .\\start-agents.bat', 'blue');

    log('\n  🌐 5. Access Swagger UI:', 'cyan');
    log('     http://localhost:3000/api-docs', 'blue');

    console.log('\n' + '='.repeat(60));
    log('Happy coding! 🎉', 'green');
    console.log('='.repeat(60) + '\n');

    rl.close();
}

// Check if setup was already completed
const setupMarker = path.join(__dirname, '.setup-complete');
if (fs.existsSync(setupMarker)) {
    console.log('\n' + '='.repeat(60));
    log('⚠️  Setup Already Completed', 'yellow');
    console.log('='.repeat(60) + '\n');

    const setupInfo = JSON.parse(fs.readFileSync(setupMarker, 'utf8'));
    log(`Last setup: ${new Date(setupInfo.timestamp).toLocaleString()}`, 'cyan');

    console.log('\nConfigured components:');
    Object.entries(setupInfo.configured).forEach(([key, value]) => {
        const status = value ? '✓' : '✗';
        const color = value ? 'green' : 'red';
        log(`  ${status} ${key}`, color);
    });

    question('\nRun setup again? This will overwrite existing .env files (y/n): ').then(answer => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            setup();
        } else {
            log('\nSetup cancelled. Your existing configuration is unchanged.', 'cyan');
            rl.close();
        }
    });
} else {
    setup();
}
