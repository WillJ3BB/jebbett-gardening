// ── Check admin is logged in ──
async function checkAdmin() {
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (!session) {
        window.location.href = 'login.html'
    }
}
checkAdmin()

// ── Load bookings ──
let currentFilter = 'all'

async function loadBookings() {
    let query = supabaseClient
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })

    if (currentFilter !== 'all') {
        query = query.eq('status', currentFilter)
    }

    const { data, error } = await query
    const list = document.getElementById('bookings-list')

    if (error || !data || data.length === 0) {
        list.innerHTML = '<p>No bookings found.</p>'
        return
    }

    list.innerHTML = data.map(booking => `
        <div class="admin-booking-card ${booking.status}">
            <div class="admin-booking-header">
                <h3>${booking.service_type.replace(/-/g, ' ')}</h3>
                <span class="booking-status ${booking.status}">${booking.status}</span>
            </div>
            <div class="admin-booking-details">
                <p><strong>Name:</strong> ${booking.full_name}</p>
                <p><strong>Email:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
                <p><strong>Phone:</strong> ${booking.phone || 'Not provided'}</p>
                <p><strong>Date:</strong> ${new Date(booking.preferred_date).toLocaleDateString('en-GB')}</p>
                <p><strong>Time:</strong> ${booking.preferred_time || 'Flexible'}</p>
                <p><strong>Address:</strong> ${booking.address || 'Not provided'}</p>
                ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
                <p><strong>Submitted:</strong> ${new Date(booking.created_at).toLocaleDateString('en-GB')}</p>
            </div>
            <div class="admin-booking-actions">
                <button onclick="updateBookingStatus('${booking.id}', 'confirmed')" class="status-btn confirm-btn" ${booking.status === 'confirmed' ? 'disabled' : ''}>Confirm</button>
                <button onclick="updateBookingStatus('${booking.id}', 'completed')" class="status-btn complete-btn" ${booking.status === 'completed' ? 'disabled' : ''}>Complete</button>
                <button onclick="updateBookingStatus('${booking.id}', 'cancelled')" class="status-btn cancel-btn" ${booking.status === 'cancelled' ? 'disabled' : ''}>Cancel</button>
            </div>
        </div>
    `).join('')
}
loadBookings()

// ── Filter bookings ──
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        currentFilter = btn.dataset.filter
        loadBookings()
    })
})

// ── Update booking status ──
async function updateBookingStatus(id, status) {
    const { error } = await supabaseClient
        .from('bookings')
        .update({ status })
        .eq('id', id)

    if (error) {
        alert('Error updating booking: ' + error.message)
        return
    }

    loadBookings()
}

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

    const beforePath = `before/${Date.now()}-${beforeFile.name}`
    const { error: beforeError } = await supabaseClient.storage
        .from('Portfolio')
        .upload(beforePath, beforeFile)

    if (beforeError) {
        status.textContent = 'Error uploading before image: ' + beforeError.message
        status.style.color = 'red'
        return
    }

    const afterPath = `after/${Date.now()}-${afterFile.name}`
    const { error: afterError } = await supabaseClient.storage
        .from('Portfolio')
        .upload(afterPath, afterFile)

    if (afterError) {
        status.textContent = 'Error uploading after image: ' + afterError.message
        status.style.color = 'red'
        return
    }

    const { data: beforeUrl } = supabaseClient.storage
        .from('Portfolio')
        .getPublicUrl(beforePath)

    const { data: afterUrl } = supabaseClient.storage
        .from('Portfolio')
        .getPublicUrl(afterPath)

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

    const beforePath = beforeUrl.split('/Portfolio/')[1]
    const afterPath = afterUrl.split('/Portfolio/')[1]

    await supabaseClient.storage.from('Portfolio').remove([beforePath])
    await supabaseClient.storage.from('Portfolio').remove([afterPath])

    await supabaseClient.from('portfolio').delete().eq('id', id)

    loadEntries()
}