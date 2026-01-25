// Test swapping two albums back and forth
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BASE_URL = 'http://localhost:3001'

async function testSwap() {
  console.log('🧪 ===== TEST ALBUM SWAP =====\n')

  try {
    // Login
    console.log('📝 Login...')
    const loginResponse = await fetch(`${BASE_URL}/api/gallery/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    })
    const { token } = await loginResponse.json()
    console.log('✅ Logged in\n')

    // Get albums
    const getResponse = await fetch(`${BASE_URL}/api/gallery/static`)
    const albums = await getResponse.json()

    const album1 = albums[0]
    const album2 = albums[1]

    console.log('📥 Current state:')
    console.log(`   "${album1.title}": order=${album1.order}`)
    console.log(`   "${album2.title}": order=${album2.order}\n`)

    // Swap them
    console.log('🔄 Swapping albums...')
    const swapData = [
      { id: album1.id, order: 1 },
      { id: album2.id, order: 0 }
    ]

    const swapResponse = await fetch(`${BASE_URL}/api/gallery/admin/static/reorder-albums`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ albums: swapData })
    })

    const result = await swapResponse.json()
    console.log(`   Status: ${swapResponse.status}`)
    console.log(`   Result:`, result)

    // Verify
    const verifyResponse = await fetch(`${BASE_URL}/api/gallery/static`)
    const updatedAlbums = await verifyResponse.json()

    const newAlbum1 = updatedAlbums.find(a => a.id === album1.id)
    const newAlbum2 = updatedAlbums.find(a => a.id === album2.id)

    console.log('\n📥 After swap:')
    console.log(`   "${newAlbum1.title}": order=${newAlbum1.order} (expected: 1)`)
    console.log(`   "${newAlbum2.title}": order=${newAlbum2.order} (expected: 0)\n`)

    // Verify file system
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'))
    const galleryPath = path.isAbsolute(config.galleryFolder.path)
      ? config.galleryFolder.path
      : path.join(__dirname, config.galleryFolder.path)

    const meta1 = JSON.parse(fs.readFileSync(path.join(galleryPath, 'static', album1.id, 'meta.json'), 'utf-8'))
    const meta2 = JSON.parse(fs.readFileSync(path.join(galleryPath, 'static', album2.id, 'meta.json'), 'utf-8'))

    console.log('📖 Filesystem verification:')
    console.log(`   ${album1.id}/meta.json: order=${meta1.order}`)
    console.log(`   ${album2.id}/meta.json: order=${meta2.order}\n`)

    if (newAlbum1.order === 1 && newAlbum2.order === 0 && meta1.order === 1 && meta2.order === 0) {
      console.log('🎉 ===== SWAP TEST PASSED =====')
      console.log('✅ Albums successfully swapped!')
      console.log('✅ API works correctly')
      console.log('✅ Changes persisted to filesystem\n')
    } else {
      console.log('❌ Swap verification failed\n')
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testSwap()
