import http from 'http';

const testEndpoints = [
  { path: '/', name: 'Root endpoint' },
  { path: '/api/health', name: 'Health check' },
  { path: '/api/v1/applications', name: 'Applications endpoint' }
];

const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

console.log(`🧪 Testing backend deployment at: ${baseUrl}`);
console.log('=' .repeat(50));

testEndpoints.forEach(({ path, name }) => {
  const url = `${baseUrl}${path}`;
  
  const req = http.request(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log(`✅ ${name} (${res.statusCode}): ${response.message || 'OK'}`);
      } catch (error) {
        console.log(`❌ ${name} (${res.statusCode}): Invalid JSON response`);
      }
    });
  });
  
  req.on('error', (error) => {
    console.log(`❌ ${name}: ${error.message}`);
  });
  
  req.setTimeout(5000, () => {
    console.log(`⏰ ${name}: Request timeout`);
    req.destroy();
  });
  
  req.end();
});

console.log('\n📊 Test completed! Check the results above.');
