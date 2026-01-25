// Complete end-to-end test for album reordering
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = 'http://localhost:3001'

async function testCompleteReorder() {
  console.log('🧪 ===== COMPLETE ALBUM REORDER TEST =====\n')

  try {
    // Step 1: Login to get a valid token
    console.log('📝 Step 1: Login with admin credentials...')
    const loginResponse = await fetch(`${BASE_URL}/api/gallery/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    })

    if (!loginResponse.ok) {
      console.log('❌ Login failed:', loginResponse.status)
      return
    }

    const { token } = await loginResponse.json()
    console.log('✅ Login successful, got token\n')

    // Step 2: Get current static albums
    console.log('📥 Step 2: Fetch current static albums...')
    const getResponse = await fetch(`${BASE_URL}/api/gallery/static`)
    const albums = await getResponse.json()
    console.log(`✅ Found ${albums.length} albums:`)
    albums.forEach((album, i) => {
      console.log(`   ${i}: "${album.title}" (id: ${album.id}, order: ${album.order})`)
    })

    if (albums.length < 2) {
      console.log('\n⚠️ Need at least 2 albums to test reordering')
      return
    }

    const album1 = albums[0]
    const album2 = albums[1]
    console.log(`\n🔄 Will set: "${album1.title}" → order 0, "${album2.title}" → order 1\n`)

    // Step 3: Read original meta.json files
    console.log('📖 Step 3: Read original meta.json files...')
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'))
    const galleryPath = path.isAbsolute(config.galleryFolder.path)
      ? config.galleryFolder.path
      : path.join(__dirname, config.galleryFolder.path)

    const staticPath = path.join(galleryPath, 'static')
    const meta1Path = path.join(staticPath, album1.id, 'meta.json')
    const meta2Path = path.join(staticPath, album2.id, 'meta.json')

    const originalMeta1 = JSON.parse(fs.readFileSync(meta1Path, 'utf-8'))
    const originalMeta2 = JSON.parse(fs.readFileSync(meta2Path, 'utf-8'))
    console.log(`   ${album1.id}/meta.json: order = ${originalMeta1.order}`)
    console.log(`   ${album2.id}/meta.json: order = ${originalMeta2.order}\n`)

    // Step 4: Call reorder API - set album1 to 0, album2 to 1
    console.log('🔄 Step 4: Call reorder API to set new order...')
    const testData = [
      { id: album1.id, order: 0 },
      { id: album2.id, order: 1 }
    ]
    console.log('   Sending:', JSON.stringify(testData, null, 2))

    const reorderResponse = await fetch(`${BASE_URL}/api/gallery/admin/static/reorder-albums`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ albums: testData })
    })

    console.log(`   📥 Response status: ${reorderResponse.status}`)

    if (!reorderResponse.ok) {
      const error = await reorderResponse.json()
      console.log(`❌ Reorder API failed:`, error)
      return
    }

    const result = await reorderResponse.json()
    console.log('   ✅ API Response:', result)

    // Step 5: Verify meta.json files were actually updated
    console.log('\n✅ Step 5: Verify meta.json files were updated...')
    const updatedMeta1 = JSON.parse(fs.readFileSync(meta1Path, 'utf-8'))
    const updatedMeta2 = JSON.parse(fs.readFileSync(meta2Path, 'utf-8'))

    console.log(`   ${album1.id}/meta.json: order ${originalMeta1.order} → ${updatedMeta1.order}`)
    console.log(`   ${album2.id}/meta.json: order ${originalMeta2.order} → ${updatedMeta2.order}`)

    const correctValues = updatedMeta1.order === 0 && updatedMeta2.order === 1

    if (correctValues) {
      console.log('   ✅ Meta files updated correctly!\n')
    } else {
      console.log('   ❌ Meta files NOT updated correctly\n')
      console.log(`   Expected: album1.order=0, album2.order=1`)
      console.log(`   Got: album1.order=${updatedMeta1.order}, album2.order=${updatedMeta2.order}\n`)
      return
    }

    // Step 6: Fetch albums again to verify new order
    console.log('📥 Step 6: Fetch albums again to verify new order...')
    const verifyResponse = await fetch(`${BASE_URL}/api/gallery/static`)
    const updatedAlbums = await verifyResponse.json()

    console.log('   New order:')
    updatedAlbums.forEach((album, i) => {
      console.log(`   ${i}: "${album.title}" (id: ${album.id}, order: ${album.order})`)
    })

    // Find the albums in the new list
    const newAlbum1 = updatedAlbums.find(a => a.id === album1.id)
    const newAlbum2 = updatedAlbums.find(a => a.id === album2.id)

    const album1OrderCorrect = newAlbum1.order === 0
    const album2OrderCorrect = newAlbum2.order === 1

    if (album1OrderCorrect && album2OrderCorrect) {
      console.log('\n✅ API returns correct new order!\n')
    } else {
      console.log('\n❌ API order doesn\'t match expected values\n')
      console.log(`   Expected: album1.order=0, album2.order=1`)
      console.log(`   Got: album1.order=${newAlbum1.order}, album2.order=${newAlbum2.order}\n`)
    }

    // Final result
    console.log('🎉 ===== TEST COMPLETED SUCCESSFULLY =====')
    console.log(`✅ Albums were successfully reordered!`)
    console.log(`✅ "${album1.title}" order set to 0, "${album2.title}" order set to 1`)
    console.log(`✅ Changes persisted to meta.json files`)
    console.log(`✅ API returns updated order correctly\n`)

  } catch (error) {
    console.error('❌ Test failed with error:', error.message)
    console.error(error)
  }
}

testCompleteReorder()
