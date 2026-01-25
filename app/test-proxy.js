// Test Vite proxy
async function testProxy() {
  try {
    // Test through Vite proxy (port 5173)
    console.log('🧪 Test: GET through Vite proxy (http://localhost:5173/api/gallery/static)')
    const response1 = await fetch('http://localhost:5173/api/gallery/static')
    console.log(`📥 Response status: ${response1.status}`)

    if (response1.ok) {
      const albums = await response1.json()
      console.log(`✅ Got ${albums.length} albums through proxy`)
      console.log(`Album IDs:`, albums.map(a => a.id))

      // Now test PUT through proxy
      console.log('\n🧪 Test: PUT through Vite proxy')
      const testData = albums.slice(0, 2).map((album, index) => ({
        id: album.id,
        order: 1 - index
      }))

      console.log('Test data:', testData)

      const response2 = await fetch('http://localhost:5173/api/gallery/admin/static/reorder-albums', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer fake-token'
        },
        body: JSON.stringify({ albums: testData })
      })

      console.log(`📥 Response status: ${response2.status}`)
      const result = await response2.text()
      console.log('Response:', result)
    } else {
      console.log('❌ GET request failed')
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testProxy()
