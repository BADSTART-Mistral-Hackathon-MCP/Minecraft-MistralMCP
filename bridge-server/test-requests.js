// Simple test script to verify bridge server endpoints
// Run with: node test-requests.js

const http = require('http');

const BASE_URL = 'http://localhost:3001';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve({ status: res.statusCode, data: response });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Test functions
async function testHealth() {
    console.log('\n🩺 Testing /health endpoint...');
    try {
        const response = await makeRequest('GET', '/health');
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function testStatus() {
    console.log('\n📊 Testing /status endpoint...');
    try {
        const response = await makeRequest('GET', '/bot/status');
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function testSay() {
    console.log('\n💬 Testing /say endpoint...');
    try {
        const response = await makeRequest('POST', '/chat/say', {
            message: 'Hello from test script!'
        });
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function testMove() {
    console.log('\n🚶 Testing /move endpoint...');
    try {
        const response = await makeRequest('POST', '/movement/moveTo', {
            x: 10,
            y: 64,
            z: 10
        });
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function testInventory() {
    console.log('\n🎒 Testing /inventory endpoint...');
    try {
        const response = await makeRequest('GET', '/inventory');
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function testMine() {
    console.log('\n⛏️ Testing /mine endpoint...');
    try {
        const response = await makeRequest('POST', '/mining/block', {
            blockType: 'stone',
            maxDistance: 32
        });
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function testCraft() {
    console.log('\n🔨 Testing /craft endpoint...');
    try {
        const response = await makeRequest('POST', '/crafting/item', {
            item: 'stick',
            count: 4
        });
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function testGive() {
    console.log('\n🎁 Testing /crafting/give endpoint...');
    try {
        const response = await makeRequest('GET', '/crafting/give?player=Player&item=emerald&count=5');
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}
async function testQuest() {
    console.log('\n🧩 Testing /quest endpoint...');
    try {
        const start = await makeRequest('POST', '/quest', { target: 8, assistCrafting: true, playerName: 'Player' });
        console.log(`Start Status: ${start.status}`);
        console.log('Start Response:', JSON.stringify(start.data, null, 2));
        const status = await makeRequest('GET', '/quest/status');
        console.log(`Status: ${status.status}`);
        console.log('Quest Status:', JSON.stringify(status.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function testInvalidEndpoint() {
    console.log('\n❌ Testing invalid endpoint...');
    try {
        const response = await makeRequest('GET', '/nonexistent');
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run all tests
async function runTests() {
    console.log('🧪 Starting Bridge Server API Tests...');
    console.log('Make sure your bridge server is running on http://localhost:3001');

    // Basic tests (always work)
    await testHealth();
    await testInvalidEndpoint();

    // Bot-dependent tests (require bot to be connected)
    await testStatus();
    await testSay();
    await testInventory();

    // More complex tests (may fail if bot can't perform action)
    await testMove();
    await testMine();
    await testCraft();
    await testGive();
    await testQuest();

    console.log('\n✅ All tests completed!');
    console.log('\nNotes:');
    console.log('- If bot is not connected, some tests will return 503 errors (normal)');
    console.log('- Move/mine/craft tests may fail if bot cannot perform the action');
    console.log('- Check the bridge server logs for more details');
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node test-requests.js [options]');
    console.log('Options:');
    console.log('  --health    Test only health endpoint');
    console.log('  --status    Test only status endpoint');
    console.log('  --say       Test only say endpoint');
    console.log('  --move      Test only move endpoint');
    console.log('  --inventory Test only inventory endpoint');
    console.log('  --mine      Test only mine endpoint');
    console.log('  --craft     Test only craft endpoint');
    process.exit(0);
}

// Run specific test if requested
if (process.argv.includes('--health')) {
    testHealth();
} else if (process.argv.includes('--status')) {
    testStatus();
} else if (process.argv.includes('--say')) {
    testSay();
} else if (process.argv.includes('--move')) {
    testMove();
} else if (process.argv.includes('--inventory')) {
    testInventory();
} else if (process.argv.includes('--mine')) {
    testMine();
} else if (process.argv.includes('--craft')) {
    testCraft();
} else {
    // Run all tests
    runTests();
}
