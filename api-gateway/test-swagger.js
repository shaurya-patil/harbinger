const swaggerSpec = require('./swagger');

console.log('Swagger Spec:');
console.log(JSON.stringify(swaggerSpec, null, 2));
console.log('\nPaths found:', Object.keys(swaggerSpec.paths || {}));
