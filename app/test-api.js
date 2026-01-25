// Test API endpoint
async function testAPI() {
  try {
    // Test 1: Get static albums
    console.log('🧪 Test 1: GET /api/gallery/static')
    const response1 = await fetch('http://localhost:3001/api/gallery/static')
    const albums = await response1.json()
    console.log(`✅ Got ${albums.length} albums`)

    if (albums.length >= 2) {
      // Test 2: Try reorder endpoint
      const testData = albums.slice(0, 2).map((album, index) => ({
        id: album.id,
        order: 1 - index  // Swap the first two
      }))

      console.log('\n🧪 Test 2: PUT /api/gallery/admin/static/reorder-albums')
      console.log('Test data:', testData)

      // You'll need to get an admin token first
      // For now, just test if the endpoint exists
      const response2 = await fetch('http://localhost:3001/api/gallery/admin/static/reorder-albums', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake-token-for-testing'
        },
        body: JSON.stringify({ albums: testData })
      })

      console.log(`📥 Response status: ${response2.status}`)
      const result = await response2.json()
      console.log('Response:', result)
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testAPI()
