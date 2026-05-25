const fetch = require('node-fetch');

// Adjust this URL to point to your local or deployed app
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runConcurrencyTest() {
  console.log('Fetching products to find an item to test...');
  
  const productsRes = await fetch(`${BASE_URL}/api/products`);
  const products = await productsRes.json();
  
  if (!products || products.length === 0) {
    console.error('No products found. Did you seed the database? (POST /api/seed)');
    return;
  }

  // Find a product with inventory
  const product = products.find(p => p.inventory.length > 0 && p.inventory[0].availableStock > 0);
  
  if (!product) {
    console.error('No products with available stock found.');
    return;
  }

  const warehouse = product.inventory[0].warehouse;
  const productId = product._id;
  const warehouseId = warehouse._id;

  console.log(`Testing concurrency on Product: ${product.name} at Warehouse: ${warehouse.name}`);
  console.log(`Current Available Stock: ${product.inventory[0].availableStock}`);
  
  // Create 10 simultaneous requests
  const numRequests = 10;
  console.log(`Sending ${numRequests} simultaneous reservation requests...`);

  const requests = Array.from({ length: numRequests }).map((_, index) => {
    return fetch(`${BASE_URL}/api/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        warehouseId,
        quantity: 1
      })
    })
    .then(res => res.json().then(data => ({ status: res.status, data, index })))
    .catch(err => ({ status: 500, error: err.message, index }));
  });

  const results = await Promise.all(requests);
  
  const success = results.filter(r => r.status === 201);
  const conflict = results.filter(r => r.status === 409);
  
  console.log('\n--- RESULTS ---');
  console.log(`Successful Reservations (201): ${success.length}`);
  console.log(`Conflicts / Lock Busy (409): ${conflict.length}`);
  
  if (success.length <= product.inventory[0].availableStock) {
    console.log('✅ TEST PASSED: No overselling occurred. Concurrency control worked!');
  } else {
    console.log('❌ TEST FAILED: Oversold inventory!');
  }
}

runConcurrencyTest();
