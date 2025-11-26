const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT_DIR = __dirname;
const DOCKER_COMPOSE_PROD = path.join(ROOT_DIR, 'docker-compose.prod.yml');
const TEMPLATE_DOCKERFILE = path.join(ROOT_DIR, 'agents', 'Dockerfile.template');

async function verifyDeployment() {
    console.log('🔍 Starting Deployment Verification...');

    // 1. Check .env
    if (!fs.existsSync(path.join(ROOT_DIR, '.env'))) {
        console.warn('⚠️  .env file missing!');
        if (fs.existsSync(path.join(ROOT_DIR, '.env.example'))) {
            console.log('💡 Tip: Copy .env.example to .env and configure it.');
        }
    } else {
        console.log('✅ .env file found.');
    }

    // 2. Parse docker-compose.prod.yml
    if (!fs.existsSync(DOCKER_COMPOSE_PROD)) {
        console.error('❌ docker-compose.prod.yml not found!');
        return;
    }

    let composeConfig;
    try {
        const fileContents = fs.readFileSync(DOCKER_COMPOSE_PROD, 'utf8');
        composeConfig = yaml.load(fileContents);
    } catch (e) {
        console.error('❌ Failed to parse docker-compose.prod.yml:', e.message);
        return;
    }

    if (!composeConfig.services) {
        console.error('❌ No services defined in docker-compose.prod.yml');
        return;
    }

    console.log(`\nChecking ${Object.keys(composeConfig.services).length} services...`);

    const missingDockerfiles = [];

    for (const [serviceName, serviceConfig] of Object.entries(composeConfig.services)) {
        if (serviceConfig.build) {
            const context = serviceConfig.build.context || serviceConfig.build;
            const dockerfile = serviceConfig.build.dockerfile || 'Dockerfile';

            // Resolve path relative to docker-compose file
            const dockerfilePath = path.resolve(ROOT_DIR, context, dockerfile);

            if (!fs.existsSync(dockerfilePath)) {
                console.error(`❌ [${serviceName}] Missing Dockerfile: ${dockerfilePath}`);
                missingDockerfiles.push({
                    serviceName,
                    path: dockerfilePath,
                    context: path.resolve(ROOT_DIR, context)
                });
            } else {
                console.log(`✅ [${serviceName}] Dockerfile found.`);
            }
        } else {
            console.log(`ℹ️  [${serviceName}] Uses image: ${serviceConfig.image}`);
        }
    }

    // 3. Generate missing Dockerfiles
    if (missingDockerfiles.length > 0) {
        console.log(`\n🛠️  Found ${missingDockerfiles.length} missing Dockerfiles.`);
        console.log('Attempting to generate them from template...');

        if (!fs.existsSync(TEMPLATE_DOCKERFILE)) {
            console.error('❌ Template Dockerfile not found at:', TEMPLATE_DOCKERFILE);
            return;
        }

        const templateContent = fs.readFileSync(TEMPLATE_DOCKERFILE, 'utf8');

        for (const missing of missingDockerfiles) {
            try {
                // Ensure directory exists
                if (!fs.existsSync(missing.context)) {
                    console.log(`Creating directory: ${missing.context}`);
                    fs.mkdirSync(missing.context, { recursive: true });
                }

                fs.writeFileSync(missing.path, templateContent);
                console.log(`✅ Generated Dockerfile for ${missing.serviceName}`);
            } catch (err) {
                console.error(`❌ Failed to generate Dockerfile for ${missing.serviceName}:`, err.message);
            }
        }
    } else {
        console.log('\n✨ All Dockerfiles are present!');
    }

    console.log('\n🏁 Verification complete.');
}

verifyDeployment();
