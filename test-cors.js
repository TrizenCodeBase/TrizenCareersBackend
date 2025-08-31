import http from 'http';

const testCors = async () => {
  const testUrls = [
    'http://localhost:5000',
    'https://trizencareersbackend.llp.trizenventures.com'
  ];

  const testOrigins = [
    'https://careers.trizenventures.com',
    'http://localhost:8080',
    'http://localhost:3000',
    'https://malicious-site.com' // This should be blocked
  ];

  console.log('🧪 Testing CORS Configuration');
  console.log('=' .repeat(50));

  for (const baseUrl of testUrls) {
    console.log(`\n📍 Testing backend: ${baseUrl}`);
    
    for (const origin of testOrigins) {
      const options = {
        hostname: new URL(baseUrl).hostname,
        port: new URL(baseUrl).port || (new URL(baseUrl).protocol === 'https:' ? 443 : 80),
        path: '/api/health',
        method: 'GET',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      };

      try {
        const response = await new Promise((resolve, reject) => {
          const req = http.request(options, (res) => {
            const corsHeaders = {
              'Access-Control-Allow-Origin': res.headers['access-control-allow-origin'],
              'Access-Control-Allow-Methods': res.headers['access-control-allow-methods'],
              'Access-Control-Allow-Headers': res.headers['access-control-allow-headers']
            };
            
            resolve({
              statusCode: res.statusCode,
              corsHeaders,
              origin,
              allowed: res.headers['access-control-allow-origin'] === origin || res.headers['access-control-allow-origin'] === '*'
            });
          });

          req.on('error', reject);
          req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });

          req.end();
        });

        const status = response.allowed ? '✅ ALLOWED' : '❌ BLOCKED';
        console.log(`${status} Origin: ${origin}`);
        
        if (response.allowed) {
          console.log(`   CORS Headers: ${JSON.stringify(response.corsHeaders)}`);
        }
      } catch (error) {
        console.log(`❌ ERROR Origin: ${origin} - ${error.message}`);
      }
    }
  }

  console.log('\n📊 CORS Test Completed!');
  console.log('\n💡 Expected Results:');
  console.log('✅ https://careers.trizenventures.com - Should be ALLOWED');
  console.log('✅ http://localhost:8080 - Should be ALLOWED');
  console.log('✅ http://localhost:3000 - Should be ALLOWED');
  console.log('❌ https://malicious-site.com - Should be BLOCKED');
};

testCors().catch(console.error);
