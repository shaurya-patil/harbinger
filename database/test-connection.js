/**
 * Database Connection Test
 * Tests PostgreSQL connection and verifies schema
 */

const memoryService = require('../libs/memory-service');

async function testDatabase() {
    console.log('=== Testing Database Connection ===\n');

    try {
        // Test connection
        console.log('1. Testing connection...');
        const connected = await memoryService.testConnection();

        if (!connected) {
            console.error('❌ Database connection failed!');
            console.log('\nMake sure:');
            console.log('1. PostgreSQL is installed and running');
            console.log('2. Database "harbinger" exists');
            console.log('3. .env file is configured correctly');
            console.log('4. Schema has been initialized (run schema.sql)');
            process.exit(1);
        }

        console.log('✅ Connection successful!\n');

        // Test tables exist
        console.log('2. Checking tables...');
        const tableCheck = await memoryService.pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('tasks', 'user_aliases', 'agent_memory')
        `);

        const tables = tableCheck.rows.map(r => r.table_name);
        console.log('Found tables:', tables);

        if (tables.length !== 3) {
            console.error('❌ Missing tables! Expected: tasks, user_aliases, agent_memory');
            console.log('Run: psql -U postgres -d harbinger -f database/schema.sql');
            process.exit(1);
        }

        console.log('✅ All tables exist!\n');

        // Test alias operations
        console.log('3. Testing alias operations...');

        // Add test alias
        const alias = await memoryService.addAlias(
            'test_user',
            'email',
            'test@example.com',
            'test email'
        );
        console.log('✅ Added alias:', alias.alias_value);

        // Resolve alias
        const resolved = await memoryService.resolveAlias('test@example.com');
        console.log('✅ Resolved alias:', resolved.user_id);

        // Get user aliases
        const aliases = await memoryService.getUserAliases('test_user');
        console.log('✅ Found', aliases.length, 'alias(es) for test_user\n');

        // Test memory operations
        console.log('4. Testing memory operations...');

        // Set memory
        await memoryService.setMemory(
            'test_user',
            'test_key',
            { data: 'test value' },
            'test context'
        );
        console.log('✅ Set memory');

        // Get memory
        const memory = await memoryService.getMemory('test_user', 'test_key');
        console.log('✅ Retrieved memory:', memory);

        // Search memory
        const searchResults = await memoryService.searchMemory('test_user', 'test');
        console.log('✅ Search found', searchResults.length, 'result(s)\n');

        // Cleanup test data
        console.log('5. Cleaning up test data...');
        await memoryService.pool.query(`DELETE FROM user_aliases WHERE user_id = 'test_user'`);
        await memoryService.pool.query(`DELETE FROM agent_memory WHERE user_id = 'test_user'`);
        console.log('✅ Cleanup complete\n');

        console.log('=== All Tests Passed! ===');
        console.log('Database is ready for use.\n');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await memoryService.close();
    }
}

testDatabase();
