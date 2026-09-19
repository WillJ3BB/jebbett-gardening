// ── XSS Sanitization Helper ──
function escapeHtml(text) {
    if (!text) return ''
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

// ── Strict Admin Access Control ──
// Add your authorized admin email(s) here
const ADMIN_EMAILS = [
    'jackjebbett@gmail.com' 
];

async function checkAdmin() {
    const { data: { session }, error } = await supabaseClient.auth.getSession()

    if (error || !session) {
        window.location.href = 'login.html?redirect=admin.html'
        return false
    }

    const user = session.user
    const isExplicitAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === (user.email || '').toLowerCase())
    const hasAdminRole = user.app_metadata?.role === 'admin' || user.user_metadata?.is_admin === true

    if (!isExplicitAdmin && !hasAdminRole) {
        alert('Access denied. Administrator privileges required.')
        window.location.href = 'account.html'
        return false
    }

    return true
}

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

    if (label) {
        label.textContent = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }

    if (grid) {
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
                            <div class="week-booking-item ${escapeHtml(b.status)}">
                                <span class="week-booking-name">${escapeHtml(b.full_name)}</span>
                                <span class="week-booking-service">${escapeHtml((b.service_type || '').replace(/-/g, ' '))}</span>
                                <span class="week-booking-time">${escapeHtml(b.preferred_time || 'Flexible')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `
        }).join('')
    }
}

const prevWeekBtn = document.getElementById('prev-week')
if (prevWeekBtn) {
    prevWeekBtn.addEventListener('click', () => {
        calendarWeekStart.setDate(calendarWeekStart.getDate() - 7)
        loadWeekCalendar()
    })
}

const nextWeekBtn = document.getElementById('next-week')
if (nextWeekBtn) {
    nextWeekBtn.addEventListener('click', () => {
        calendarWeekStart.setDate(calendarWeekStart.getDate() + 7)
        loadWeekCalendar()
    })
}

// ── Load Bookings ──
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
    if (!list) return

    if (error || !data || data.length === 0) {
        list.innerHTML = '<p>No bookings found.</p>'
        return
    }

    list.innerHTML = data.map(booking => {
        const id = escapeHtml(booking.id)
        const status = escapeHtml(booking.status || 'pending')
        const service = escapeHtml((booking.service_type || '').replace(/-/g, ' '))
        const name = escapeHtml(booking.full_name)
        const email = escapeHtml(booking.email)
        const phone = escapeHtml(booking.phone || 'Not provided')
        const date = escapeHtml(new Date(booking.preferred_date).toLocaleDateString('en-GB'))
        const time = escapeHtml(booking.preferred_time || 'Flexible')
        const address = escapeHtml(booking.address || 'Not provided')
        const notes = escapeHtml(booking.notes || '')
        const submitted = escapeHtml(new Date(booking.created_at).toLocaleDateString('en-GB'))
        const adminNotes = escapeHtml(booking.admin_notes || '')

        return `
            <div class="admin-booking-card ${status}">
                <div class="admin-booking-header">
                    <h3>${service}</h3>
                    <span class="booking-status ${status}">${status}</span>
                </div>
                <div class="admin-booking-details">
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                    <p><strong>Phone:</strong> ${phone}</p>
                    <p><strong>Date:</strong> ${date}</p>
                    <p><strong>Time:</strong> ${time}</p>
                    <p><strong>Address:</strong> ${address}</p>
                    ${notes ? `<p><strong>Customer Notes:</strong> ${notes}</p>` : ''}
                    <p><strong>Submitted:</strong> ${submitted}</p>
                </div>
                <div class="admin-notes-section">
                    <label><strong>Internal Notes</strong></label>
                    <textarea class="admin-notes-input" id="notes-${id}" rows="2" placeholder="Private notes about this job...">${adminNotes}</textarea>
                    <button class="save-notes-btn" onclick="saveNotes('${id}')">Save Note</button>
                </div>
                <div class="admin-booking-actions">
                    <button onclick="updateBookingStatus('${id}', 'confirmed')" class="status-btn confirm-btn" ${status === 'confirmed' ? 'disabled' : ''}>Confirm</button>
                    <button onclick="updateBookingStatus('${id}', 'completed')" class="status-btn complete-btn" ${status === 'completed' ? 'disabled' : ''}>Complete</button>
                    <button onclick="updateBookingStatus('${id}', 'cancelled')" class="status-btn cancel-btn" ${status === 'cancelled' ? 'disabled' : ''}>Cancel</button>
                </div>
            </div>
        `
    }).join('')
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        currentFilter = btn.dataset.filter
        loadBookings()
    })
})

// ── Update Booking Status ──
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
    loadWeekCalendar()
}

// ── Save Internal Notes ──
async function saveNotes(id) {
    const textarea = document.getElementById(`notes-${id}`)
    if (!textarea) return
    const notes = textarea.value

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
        setTimeout(() => { saveBtn.textContent = 'Save Note' }, 2000)
    }
}

// ── Load Customer List ──
async function loadCustomers() {
    const list = document.getElementById('customers-list')
    if (!list) return

    const { data, error } = await supabaseClient
        .from('customer_summary')
        .select('*')
        .order('created_at', { ascending: false })

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
                        <td>${escapeHtml(customer.full_name || 'Not provided')}</td>
                        <td><a href="mailto:${escapeHtml(customer.email)}">${escapeHtml(customer.email)}</a></td>
                        <td>${escapeHtml(customer.booking_count)}</td>
                        <td>${escapeHtml(new Date(customer.created_at).toLocaleDateString('en-GB'))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `
}

// ══════════════════════════════════════════════════════════
// ── Unlimited Simple Portfolio Uploader & Manager ──
// ══════════════════════════════════════════════════════════
let selectedUploadFiles = []
let allPortfolioRecords = []

const fileInput = document.getElementById('portfolio-files')
const previewContainer = document.getElementById('upload-preview')

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        selectedUploadFiles = Array.from(e.target.files)
        previewContainer.innerHTML = ''

        if (selectedUploadFiles.length === 0) return

        selectedUploadFiles.forEach((file) => {
            const reader = new FileReader()
            reader.onload = (ev) => {
                const item = document.createElement('div')
                item.className = 'simple-preview-thumb'
                item.innerHTML = `<img src="${ev.target.result}" alt="Preview">`
                previewContainer.appendChild(item)
            }
            reader.readAsDataURL(file)
        })
    })
}

const uploadBtn = document.getElementById('simple-upload-btn')
if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
        const category = document.getElementById('upload-category').value
        const status = document.getElementById('simple-upload-status')
        const progressBar = document.getElementById('upload-progress-bar')
        const progressFill = document.getElementById('progress-fill')

        if (!selectedUploadFiles || selectedUploadFiles.length === 0) {
            status.textContent = 'Please choose at least one photo.'
            status.style.color = '#cc0000'
            return
        }

        status.textContent = `Uploading 1 of ${selectedUploadFiles.length}...`
        status.style.color = '#2d5a27'
        progressBar.style.display = 'block'
        uploadBtn.disabled = true

        const uploadedUrls = []

        try {
            for (let i = 0; i < selectedUploadFiles.length; i++) {
                const file = selectedUploadFiles[i]
                const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
                const path = `gallery/${Date.now()}-${i}-${cleanName}`

                const { error: uploadError } = await supabaseClient.storage
                    .from('Portfolio')
                    .upload(path, file)

                if (uploadError) throw uploadError

                const { data: urlData } = supabaseClient.storage
                    .from('Portfolio')
                    .getPublicUrl(path)

                uploadedUrls.push(urlData.publicUrl)

                const percent = Math.round(((i + 1) / selectedUploadFiles.length) * 100)
                progressFill.style.width = `${percent}%`
                status.textContent = `Uploaded ${i + 1} of ${selectedUploadFiles.length}...`
            }

            const { error: insertError } = await supabaseClient
                .from('portfolio')
                .insert([{
                    title: category,
                    gallery: category,
                    image_urls: uploadedUrls,
                    created_at: new Date().toISOString()
                }])

            if (insertError) throw insertError

            status.textContent = `Successfully uploaded ${uploadedUrls.length} photo(s) to ${category}!`
            status.style.color = '#2d5a27'
            fileInput.value = ''
            previewContainer.innerHTML = ''
            selectedUploadFiles = []
            loadSimpleEntries()
        } catch (err) {
            console.error('Upload error:', err)
            status.textContent = `Upload failed: ${err.message}`
            status.style.color = '#cc0000'
        } finally {
            uploadBtn.disabled = false
            setTimeout(() => { progressBar.style.display = 'none' }, 2500)
        }
    })
}

async function loadSimpleEntries() {
    const grid = document.getElementById('simple-photos-grid')
    if (!grid) return

    const { data, error } = await supabaseClient
        .from('portfolio')
        .select('*')
        .order('created_at', { ascending: false })

    if (error || !data) {
        grid.innerHTML = '<p>No photos found.</p>'
        return
    }

    allPortfolioRecords = data
    filterEntriesList()
}

function filterEntriesList() {
    const grid = document.getElementById('simple-photos-grid')
    const totalCount = document.getElementById('total-photos-count')
    const filterSelect = document.getElementById('filter-manage-category')
    if (!grid || !filterSelect) return

    const filter = filterSelect.value
    let displayPhotos = []

    allPortfolioRecords.forEach(record => {
        if (filter !== 'ALL' && record.gallery !== filter) return

        const imgs = record.image_urls && record.image_urls.length > 0
            ? record.image_urls
            : [record.after_image_url, record.before_image_url].filter(Boolean)

        imgs.forEach((url) => {
            displayPhotos.push({
                recordId: record.id,
                gallery: record.gallery || 'General Maintenance',
                url: url
            })
        })
    })

    if (totalCount) totalCount.textContent = displayPhotos.length

    if (displayPhotos.length === 0) {
        grid.innerHTML = '<p style="color:#777;">No photos in this category.</p>'
        return
    }

    grid.innerHTML = displayPhotos.map(item => `
        <div class="admin-photo-card">
            <img src="${escapeHtml(item.url)}" alt="Uploaded photo">
            <div class="admin-photo-overlay">
                <span class="photo-category-pill">${escapeHtml(item.gallery)}</span>
                <button class="delete-photo-btn" onclick="deleteIndividualPhoto('${escapeHtml(item.recordId)}', '${encodeURIComponent(item.url)}')" title="Delete photo">✕</button>
            </div>
        </div>
    `).join('')
}

async function deleteIndividualPhoto(recordId, encodedUrl) {
    const targetUrl = decodeURIComponent(encodedUrl)
    if (!confirm('Are you sure you want to delete this photo?')) return

    const match = targetUrl.match(/\/Portfolio\/(.+)$/)
    const path = match ? match[1] : null

    if (path) {
        await supabaseClient.storage.from('Portfolio').remove([path])
    }

    const record = allPortfolioRecords.find(r => r.id == recordId)
    if (!record) return

    const currentImages = (record.image_urls || []).filter(u => u !== targetUrl)

    if (currentImages.length === 0) {
        await supabaseClient.from('portfolio').delete().eq('id', recordId)
    } else {
        await supabaseClient.from('portfolio').update({ image_urls: currentImages }).eq('id', recordId)
    }

    loadSimpleEntries()
}

// ── Application Initialization ──
checkAdmin().then(isAdmin => {
    if (isAdmin) {
        loadWeekCalendar()
        loadBookings()
        loadCustomers()
        loadSimpleEntries()
    }
})