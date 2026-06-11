// ── Check admin is logged in ──
async function checkAdmin() {
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (!session) {
        window.location.href = 'login.html'
    }
}
checkAdmin()

// ── Weekly Calendar ──
let calendarWeekStart = getMonday(new Date())

function getMonday(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
}

async function loadWeekCalendar() {
    const weekStart = new Date(calendarWeekStart)
    const weekEnd = new Date(calendarWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const startStr = weekStart.toISOString().split('T')[0]
    const endStr = weekEnd.toISOString().split('T')[0]

    const { data, error } = await supabaseClient
        .from('bookings')
        .select('*')
        .gte('preferred_date', startStr)
        .lte('preferred_date', endStr)
        .neq('status', 'cancelled')
        .order('preferred_date', { ascending: true })

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const label = document.getElementById('week-label')
    const grid = document.getElementById('week-calendar')

    label.textContent = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

    grid.innerHTML = days.map((day, i) => {
        const date = new Date(weekStart)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        const dayBookings = data ? data.filter(b => b.preferred_date === dateStr) : []

        return `
            <div class="week-day-column">
                <div class="week-day-header">
                    <span class="week-day-name">${day}</span>
                    <span class="week-day-date">${date.getDate()}</span>
                </div>
                <div class="week-day-bookings">
                    ${dayBookings.length === 0 ? '<p class="no-bookings-day">—</p>' : dayBookings.map(b => `
                        <div class="week-booking-item ${b.status}">
                            <span class="week-booking-name">${b.full_name}</span>
                            <span class="week-booking-service">${b.service_type.replace(/-/g, ' ')}</span>
                            <span class="week-booking-time">${b.preferred_time || 'Flexible'}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `
    }).join('')
}

document.getElementById('prev-week').addEventListener('click', () => {
    calendarWeekStart.setDate(calendarWeekStart.getDate() - 7)
    loadWeekCalendar()
})

document.getElementById('next-week').addEventListener('click', () => {
    calendarWeekStart.setDate(calendarWeekStart.getDate() + 7)
    loadWeekCalendar()
})

loadWeekCalendar()

// ── Load bookings ──
let currentFilter = 'pending'

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
                ${booking.notes ? `<p><strong>Customer Notes:</strong> ${booking.notes}</p>` : ''}
                <p><strong>Submitted:</strong> ${new Date(booking.created_at).toLocaleDateString('en-GB')}</p>
            </div>
            <div class="admin-notes-section">
                <label><strong>Internal Notes</strong></label>
                <textarea class="admin-notes-input" id="notes-${booking.id}" rows="2" placeholder="Private notes about this job...">${booking.admin_notes || ''}</textarea>
                <button class="save-notes-btn" onclick="saveNotes('${booking.id}')">Save Note</button>
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

// ── Save internal notes ──
async function saveNotes(id) {
    const notes = document.getElementById(`notes-${id}`).value

    const { error } = await supabaseClient
        .from('bookings')
        .update({ admin_notes: notes })
        .eq('id', id)

    if (error) {
        alert('Error saving notes: ' + error.message)
        return
    }

    const saveBtn = document.querySelector(`[onclick="saveNotes('${id}')"]`)
    if (saveBtn) {
        saveBtn.textContent = 'Saved!'
        setTimeout(() => saveBtn.textContent = 'Save Note', 2000)
    }
}

// ── Load customer list ──
async function loadCustomers() {
    const { data, error } = await supabaseClient
        .from('customer_summary')
        .select('*')
        .order('created_at', { ascending: false })

    const list = document.getElementById('customers-list')

    if (error || !data || data.length === 0) {
        list.innerHTML = '<p>No customers yet.</p>'
        return
    }

    list.innerHTML = `
        <table class="customers-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Bookings</th>
                    <th>Joined</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(customer => `
                    <tr>
                        <td>${customer.full_name || 'Not provided'}</td>
                        <td><a href="mailto:${customer.email}">${customer.email}</a></td>
                        <td>${customer.booking_count}</td>
                        <td>${new Date(customer.created_at).toLocaleDateString('en-GB')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `
}
loadCustomers()

// ── Track removed photos per entry ──
const removedPhotos = {}

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

    list.innerHTML = data.map(entry => {
        const images = entry.image_urls && entry.image_urls.length > 0
            ? entry.image_urls
            : [entry.before_image_url, entry.after_image_url].filter(Boolean)

        return `
            <div class="entry-card" id="entry-${entry.id}">
                <div class="entry-view">
                    <h3>${entry.title}</h3>
                    <p>${entry.description || ''}</p>
                    <p><strong>Location:</strong> ${entry.location || 'Not specified'}</p>
                    <p><strong>Photos:</strong> ${images.length}</p>
                    <div class="entry-actions">
                        <button class="edit-entry-btn" onclick="toggleEdit('${entry.id}', ${JSON.stringify(images).replace(/"/g, '&quot;')})">Edit</button>
                        <button onclick="deleteEntry('${entry.id}', ${JSON.stringify(images).replace(/"/g, '&quot;')})">Delete</button>
                    </div>
                </div>
                <div class="entry-edit" id="edit-${entry.id}" style="display:none;">
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" id="edit-title-${entry.id}" value="${entry.title}">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="edit-desc-${entry.id}" rows="3">${entry.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Location</label>
                        <input type="text" id="edit-loc-${entry.id}" value="${entry.location || ''}">
                    </div>
                    <div class="form-group">
                        <label>Current Photos <small>(click ✕ to remove)</small></label>
                        <div class="edit-photos-grid" id="edit-photos-${entry.id}"></div>
                    </div>
                    <div class="form-group">
                        <label>Add New Photos</label>
                        <input type="file" id="edit-new-images-${entry.id}" accept="image/*" multiple>
                    </div>
                    <div class="entry-actions">
                        <button class="save-entry-btn" onclick="saveEntry('${entry.id}')">Save</button>
                        <button class="cancel-edit-btn" onclick="toggleEdit('${entry.id}', [])">Cancel</button>
                    </div>
                    <p id="edit-status-${entry.id}" style="font-size:13px;margin-top:8px;"></p>
                </div>
            </div>
        `
    }).join('')
}
loadEntries()

// ── Toggle edit mode ──
function toggleEdit(id, images) {
    const view = document.querySelector(`#entry-${id} .entry-view`)
    const edit = document.getElementById(`edit-${id}`)
    const isEditing = edit.style.display === 'block'

    view.style.display = isEditing ? 'block' : 'none'
    edit.style.display = isEditing ? 'none' : 'block'

    if (!isEditing) {
        removedPhotos[id] = []
        const grid = document.getElementById(`edit-photos-${id}`)
        grid.innerHTML = images.map((url, i) => `
            <div class="edit-photo-item" id="edit-photo-${id}-${i}">
                <img src="${url}" alt="Photo ${i + 1}">
                <button class="remove-photo-btn" onclick="removePhoto('${id}', ${i}, '${url}')">✕</button>
            </div>
        `).join('')
    }
}

// ── Remove a photo from edit view ──
function removePhoto(entryId, index, url) {
    if (!removedPhotos[entryId]) removedPhotos[entryId] = []
    removedPhotos[entryId].push(url)
    const item = document.getElementById(`edit-photo-${entryId}-${index}`)
    if (item) item.style.opacity = '0.3'
    const btn = item.querySelector('.remove-photo-btn')
    if (btn) btn.textContent = '↩'
    btn.onclick = () => restorePhoto(entryId, index, url)
}

// ── Restore a removed photo ──
function restorePhoto(entryId, index, url) {
    removedPhotos[entryId] = removedPhotos[entryId].filter(u => u !== url)
    const item = document.getElementById(`edit-photo-${entryId}-${index}`)
    if (item) item.style.opacity = '1'
    const btn = item.querySelector('.remove-photo-btn')
    if (btn) btn.textContent = '✕'
    btn.onclick = () => removePhoto(entryId, index, url)
}

// ── Save portfolio entry edits ──
async function saveEntry(id) {
    const title = document.getElementById(`edit-title-${id}`).value
    const description = document.getElementById(`edit-desc-${id}`).value
    const location = document.getElementById(`edit-loc-${id}`).value
    const newFiles = document.getElementById(`edit-new-images-${id}`).files
    const statusEl = document.getElementById(`edit-status-${id}`)

    if (!title) {
        statusEl.textContent = 'Title is required'
        statusEl.style.color = 'red'
        return
    }

    statusEl.textContent = 'Saving...'
    statusEl.style.color = '#2d5a27'

    // Get current entry images
    const { data: entry } = await supabaseClient
        .from('portfolio')
        .select('image_urls, before_image_url, after_image_url')
        .eq('id', id)
        .single()

    let currentImages = entry.image_urls && entry.image_urls.length > 0
        ? entry.image_urls
        : [entry.before_image_url, entry.after_image_url].filter(Boolean)

    // Remove marked photos from storage and array
    const toRemove = removedPhotos[id] || []
    for (const url of toRemove) {
        const path = url.split('/Portfolio/')[1]
        if (path) await supabaseClient.storage.from('Portfolio').remove([path])
    }
    currentImages = currentImages.filter(url => !toRemove.includes(url))

    // Upload new photos
    for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i]
        const path = `progress/${Date.now()}-${i}-${file.name}`

        const { error: uploadError } = await supabaseClient.storage
            .from('Portfolio')
            .upload(path, file)

        if (uploadError) {
            statusEl.textContent = `Error uploading photo: ${uploadError.message}`
            statusEl.style.color = 'red'
            return
        }

        const { data: urlData } = supabaseClient.storage
            .from('Portfolio')
            .getPublicUrl(path)

        currentImages.push(urlData.publicUrl)
    }

    if (currentImages.length < 2) {
        statusEl.textContent = 'At least 2 photos required'
        statusEl.style.color = 'red'
        return
    }

    const { error } = await supabaseClient
        .from('portfolio')
        .update({
            title,
            description,
            location,
            image_urls: currentImages,
            image_count: currentImages.length,
            before_image_url: currentImages[0],
            after_image_url: currentImages[currentImages.length - 1]
        })
        .eq('id', id)

    if (error) {
        statusEl.textContent = 'Error saving: ' + error.message
        statusEl.style.color = 'red'
        return
    }

    loadEntries()
}

// ── Upload portfolio entry ──
document.getElementById('upload-btn').addEventListener('click', async () => {
    const title = document.getElementById('title').value
    const description = document.getElementById('description').value
    const location = document.getElementById('location').value
    const files = document.getElementById('portfolio-images').files
    const status = document.getElementById('upload-status')

    if (!title || files.length < 2) {
        status.textContent = 'Please add a title and at least 2 photos'
        status.style.color = 'red'
        return
    }

    if (files.length > 5) {
        status.textContent = 'Maximum 5 photos allowed'
        status.style.color = 'red'
        return
    }

    status.textContent = 'Uploading...'
    status.style.color = '#2d5a27'

    const imageUrls = []

    for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const path = `progress/${Date.now()}-${i}-${file.name}`

        const { error: uploadError } = await supabaseClient.storage
            .from('Portfolio')
            .upload(path, file)

        if (uploadError) {
            status.textContent = `Error uploading photo ${i + 1}: ${uploadError.message}`
            status.style.color = 'red'
            return
        }

        const { data: urlData } = supabaseClient.storage
            .from('Portfolio')
            .getPublicUrl(path)

        imageUrls.push(urlData.publicUrl)
        status.textContent = `Uploading ${i + 1} of ${files.length}...`
    }

    const { error: insertError } = await supabaseClient
        .from('portfolio')
        .insert([{
            title,
            description,
            location,
            image_urls: imageUrls,
            image_count: imageUrls.length,
            before_image_url: imageUrls[0],
            after_image_url: imageUrls[imageUrls.length - 1]
        }])

    if (insertError) {
        status.textContent = 'Error saving entry: ' + insertError.message
        status.style.color = 'red'
        return
    }

    status.textContent = `Entry uploaded successfully with ${imageUrls.length} photos!`
    document.getElementById('title').value = ''
    document.getElementById('description').value = ''
    document.getElementById('location').value = ''
    document.getElementById('portfolio-images').value = ''
    document.getElementById('image-preview').innerHTML = ''
    loadEntries()
})

// ── Image preview ──
document.getElementById('portfolio-images').addEventListener('change', (e) => {
    const preview = document.getElementById('image-preview')
    const files = e.target.files
    preview.innerHTML = ''

    if (files.length > 5) {
        preview.innerHTML = '<p style="color:red">Maximum 5 photos allowed</p>'
        return
    }

    Array.from(files).forEach((file, i) => {
        const reader = new FileReader()
        reader.onload = (ev) => {
            const total = files.length
            let label = ''
            if (i === 0) label = 'Before'
            else if (i === total - 1) label = 'After'

            preview.innerHTML += `
                <div class="image-preview-item">
                    <img src="${ev.target.result}" alt="Preview ${i + 1}">
                    ${label ? `<span class="preview-label">${label}</span>` : ''}
                </div>
            `
        }
        reader.readAsDataURL(file)
    })
})

// ── Delete portfolio entry ──
async function deleteEntry(id, imageUrls) {
    if (!confirm('Are you sure you want to delete this entry?')) return

    for (const url of imageUrls) {
        const path = url.split('/Portfolio/')[1]
        if (path) await supabaseClient.storage.from('Portfolio').remove([path])
    }

    await supabaseClient.from('portfolio').delete().eq('id', id)
    loadEntries()
}