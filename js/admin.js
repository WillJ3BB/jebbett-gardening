// ── Check admin is logged in ──
async function checkAdmin() {
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (!session) {
        window.location.href = 'login.html'
    }
}
checkAdmin()

// ── Load existing portfolio entries ──
async function loadEntries() {
    const { data, error } = await supabaseClient
        .from('portfolio')
        .select('*')
        .order('created_at', { ascending: false })

    const list = document.getElementById('entries-list')

    if (error || !data || data.length === 0) {
        list.innerHTML = '<p>No entries yet.</p>'
        return
    }

    list.innerHTML = data.map(entry => `
        <div class="entry-card">
            <h3>${entry.title}</h3>
            <p>${entry.description || ''}</p>
            <p><strong>Location:</strong> ${entry.location || 'Not specified'}</p>
            <button onclick="deleteEntry('${entry.id}', '${entry.before_image_url}', '${entry.after_image_url}')">Delete</button>
        </div>
    `).join('')
}
loadEntries()

// ── Upload portfolio entry ──
document.getElementById('upload-btn').addEventListener('click', async () => {
    const title = document.getElementById('title').value
    const description = document.getElementById('description').value
    const location = document.getElementById('location').value
    const beforeFile = document.getElementById('before-image').files[0]
    const afterFile = document.getElementById('after-image').files[0]
    const status = document.getElementById('upload-status')

    if (!title || !beforeFile || !afterFile) {
        status.textContent = 'Please fill in the title and both photos'
        status.style.color = 'red'
        return
    }

    status.textContent = 'Uploading...'
    status.style.color = '#2d5a27'

    // Upload before image
    const beforePath = `before/${Date.now()}-${beforeFile.name}`
    const { error: beforeError } = await supabaseClient.storage
        .from('portfolio')
        .upload(beforePath, beforeFile)

    if (beforeError) {
        status.textContent = 'Error uploading before image: ' + beforeError.message
        status.style.color = 'red'
        return
    }

    // Upload after image
    const afterPath = `after/${Date.now()}-${afterFile.name}`
    const { error: afterError } = await supabaseClient.storage
        .from('portfolio')
        .upload(afterPath, afterFile)

    if (afterError) {
        status.textContent = 'Error uploading after image: ' + afterError.message
        status.style.color = 'red'
        return
    }

    // Get public URLs
    const { data: beforeUrl } = supabaseClient.storage
        .from('portfolio')
        .getPublicUrl(beforePath)

    const { data: afterUrl } = supabaseClient.storage
        .from('portfolio')
        .getPublicUrl(afterPath)

    // Save to portfolio table
    const { error: insertError } = await supabaseClient
        .from('portfolio')
        .insert([{
            title,
            description,
            location,
            before_image_url: beforeUrl.publicUrl,
            after_image_url: afterUrl.publicUrl
        }])

    if (insertError) {
        status.textContent = 'Error saving entry: ' + insertError.message
        status.style.color = 'red'
        return
    }

    status.textContent = 'Entry uploaded successfully!'
    document.getElementById('title').value = ''
    document.getElementById('description').value = ''
    document.getElementById('location').value = ''
    document.getElementById('before-image').value = ''
    document.getElementById('after-image').value = ''
    loadEntries()
})

// ── Delete portfolio entry ──
async function deleteEntry(id, beforeUrl, afterUrl) {
    if (!confirm('Are you sure you want to delete this entry?')) return

    const beforePath = beforeUrl.split('/portfolio/')[1]
    const afterPath = afterUrl.split('/portfolio/')[1]

    await supabaseClient.storage.from('portfolio').remove([beforePath])
    await supabaseClient.storage.from('portfolio').remove([afterPath])

    await supabaseClient.from('portfolio').delete().eq('id', id)

    loadEntries()
}