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
const ADMIN_EMAILS = [
    'jack.jebbett@hotmail.co.uk'
];

async function checkAdmin() {
    const { data: { session }, error } = await supabaseClient.auth.getSession()

    if (error || !session) {
        window.location.href = 'login.html?redirect=admin.html'
        return false
    }

    const user = session.user
    const isExplicitAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === (user.email || '').toLowerCase().trim())
    const hasAdminRole = user.app_metadata?.role === 'admin' || user.user_metadata?.is_admin === true

    if (!isExplicitAdmin && !hasAdminRole) {
        alert('Access denied. Administrator privileges required.')
        window.location.href = 'account.html'
        return false
    }

    return true
}

// ── Chronological Sequential Reference Map (#JEB-001, #JEB-002, ...) ──
const bookingRefMap = new Map()

function assignSequentialRefs(bookings) {
    bookingRefMap.clear()
    const chronological = bookings.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    chronological.forEach((b, idx) => {
        const paddedNum = String(idx + 1).padStart(3, '0')
        bookingRefMap.set(b.id, `#JEB-${paddedNum}`)
    })
}

function getBookingRef(booking) {
    if (!booking || !booking.id) return '#JEB-000'
    return bookingRefMap.get(booking.id) || '#JEB-000'
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

    const { data } = await supabaseClient
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
                            <div class="week-booking-item ${escapeHtml(b.status)}" onclick="openBookingDossier('${escapeHtml(b.id)}')">
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

// ══════════════════════════════════════════════════════════
// ── Bookings File Archive & Window Dossier System ──
// ══════════════════════════════════════════════════════════
let allBookingsList = []
let activeFolderTab = 'all'
let searchFilterQuery = ''

async function loadBookingsArchive() {
    const { data, error } = await supabaseClient
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })

    if (error || !data) {
        console.error('Error fetching bookings:', error)
        return
    }

    allBookingsList = data
    assignSequentialRefs(allBookingsList)
    updateTabCounts()
    renderBookingCards()
}

function updateTabCounts() {
    const counts = {
        all: allBookingsList.length,
        pending: allBookingsList.filter(b => (b.status || 'pending').toLowerCase() === 'pending').length,
        confirmed: allBookingsList.filter(b => (b.status || '').toLowerCase() === 'confirmed').length,
        completed: allBookingsList.filter(b => (b.status || '').toLowerCase() === 'completed').length,
        cancelled: allBookingsList.filter(b => (b.status || '').toLowerCase() === 'cancelled').length
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id)
        if (el) el.textContent = val
    }

    setVal('tab-count-all', counts.all)
    setVal('tab-count-pending', counts.pending)
    setVal('tab-count-confirmed', counts.confirmed)
    setVal('tab-count-completed', counts.completed)
    setVal('tab-count-cancelled', counts.cancelled)
}

function switchFolderTab(tabName) {
    activeFolderTab = tabName
    document.querySelectorAll('.folder-tab').forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active')
        } else {
            tab.classList.remove('active')
        }
    })
    renderBookingCards()
}
window.switchFolderTab = switchFolderTab

function handleBookingSearch() {
    const input = document.getElementById('booking-search-input')
    searchFilterQuery = (input.value || '').trim().toLowerCase()
    renderBookingCards()
}
window.handleBookingSearch = handleBookingSearch

function renderBookingCards() {
    const grid = document.getElementById('bookings-files-grid')
    if (!grid) return

    let filtered = allBookingsList.slice()

    if (activeFolderTab !== 'all') {
        filtered = filtered.filter(b => (b.status || 'pending').toLowerCase() === activeFolderTab)
    }

    if (searchFilterQuery) {
        filtered = filtered.filter(b => {
            const ref = getBookingRef(b).toLowerCase()
            const name = (b.full_name || '').toLowerCase()
            const email = (b.email || '').toLowerCase()
            const phone = (b.phone || '').toLowerCase()
            const address = (b.address || '').toLowerCase()
            const service = (b.service_type || '').toLowerCase()

            return ref.includes(searchFilterQuery) ||
                   name.includes(searchFilterQuery) ||
                   email.includes(searchFilterQuery) ||
                   phone.includes(searchFilterQuery) ||
                   address.includes(searchFilterQuery) ||
                   service.includes(searchFilterQuery)
        })
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #666;">
                <p style="font-size: 16px; margin-bottom: 6px;">📂 No booking files found.</p>
                <small>${searchFilterQuery ? 'Try clearing your search query.' : 'No files in this folder tab yet.'}</small>
            </div>
        `
        return
    }

    grid.innerHTML = filtered.map(booking => {
        const id = escapeHtml(booking.id)
        const ref = getBookingRef(booking)
        const name = escapeHtml(booking.full_name)
        const service = escapeHtml((booking.service_type || '').replace(/-/g, ' '))
        const date = escapeHtml(new Date(booking.preferred_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))
        const time = escapeHtml(booking.preferred_time || 'Flexible')
        const status = escapeHtml(booking.status || 'pending')

        return `
            <div class="booking-folder-card status-${status}" onclick="openBookingDossier('${id}')">
                <div>
                    <div class="folder-card-header">
                        <span class="card-ref-badge">${ref}</span>
                        <span class="card-status-badge status-badge-${status}">${status}</span>
                    </div>
                    <div class="folder-card-body">
                        <h3>${name}</h3>
                        <span class="folder-service-tag">🌿 ${service}</span>
                        <p class="folder-card-info">📅 <strong>Date:</strong> ${date}</p>
                        <p class="folder-card-info">⏰ <strong>Time:</strong> ${time}</p>
                    </div>
                </div>
                <div class="folder-card-footer">
                    <span style="font-size:12px; color:#888;">Tap to open file</span>
                    <span class="folder-open-link">Open Dossier &rarr;</span>
                </div>
            </div>
        `
    }).join('')
}

// ── Open Dossier Window Modal ──
window.openBookingDossier = function(id) {
    const booking = allBookingsList.find(b => b.id == id)
    if (!booking) return

    const ref = getBookingRef(booking)
    const modal = document.getElementById('file-window-modal')
    const refTitle = document.getElementById('dossier-ref-title')
    const body = document.getElementById('dossier-content-body')

    refTitle.textContent = `📁 File Dossier: ${ref} — ${booking.full_name}`

    const name = escapeHtml(booking.full_name)
    const email = escapeHtml(booking.email)
    const phone = escapeHtml(booking.phone || 'Not provided')
    const address = escapeHtml(booking.address || 'Not specified')
    const service = escapeHtml((booking.service_type || '').replace(/-/g, ' '))
    const date = escapeHtml(new Date(booking.preferred_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    const time = escapeHtml(booking.preferred_time || 'Flexible')
    const customerNotes = escapeHtml(booking.notes || 'None')
    const adminNotes = escapeHtml(booking.admin_notes || '')
    const status = escapeHtml(booking.status || 'pending')
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address || '')}`

    body.innerHTML = `
        <div class="dossier-status-bar">
            <div>
                <span style="font-size:12px; color:#555;">Current Status:</span><br>
                <strong class="card-status-badge status-badge-${status}" style="font-size:13px;">${status}</strong>
            </div>
            <div class="dossier-status-buttons">
                <button class="dossier-btn btn-status-pending" onclick="updateDossierStatus('${booking.id}', 'pending')">Pending</button>
                <button class="dossier-btn btn-status-confirmed" onclick="updateDossierStatus('${booking.id}', 'confirmed')">Confirm</button>
                <button class="dossier-btn btn-status-completed" onclick="updateDossierStatus('${booking.id}', 'completed')">Complete</button>
                <button class="dossier-btn btn-status-cancelled" onclick="updateDossierStatus('${booking.id}', 'cancelled')">Cancel</button>
            </div>
        </div>

        <div class="dossier-grid">
            <div class="dossier-row">
                <strong>Reference Code</strong>
                <span class="card-ref-badge">${ref}</span>
            </div>
            <div class="dossier-row">
                <strong>Requested Service</strong>
                <span>🌿 ${service}</span>
            </div>
            <div class="dossier-row">
                <strong>Appointment Date</strong>
                <span>${date}</span>
            </div>
            <div class="dossier-row">
                <strong>Time Slot</strong>
                <span>${time}</span>
            </div>
            <div class="dossier-row">
                <strong>Customer Name</strong>
                <span>${name}</span>
            </div>
            <div class="dossier-row">
                <strong>Phone Number</strong>
                <span><a href="tel:${phone}">📞 ${phone}</a></span>
            </div>
            <div class="dossier-row" style="grid-column: 1 / -1;">
                <strong>Email Address</strong>
                <span><a href="mailto:${email}?subject=Jebbett Gardening - Appointment ${ref}">✉️ ${email}</a></span>
            </div>
            <div class="dossier-row" style="grid-column: 1 / -1;">
                <strong>Property Address</strong>
                <span>📍 ${address} &nbsp; <a href="${mapsLink}" target="_blank" rel="noopener">(Open in Maps ↗)</a></span>
            </div>
            <div class="dossier-row" style="grid-column: 1 / -1;">
                <strong>Client Instructions / Job Notes</strong>
                <span style="font-style: italic; color: #555;">"${customerNotes}"</span>
            </div>
        </div>

        <div class="dossier-notes-area">
            <label><strong>🔒 Private Admin Notes &amp; Job Instructions:</strong></label>
            <textarea id="modal-notes-${booking.id}" rows="3" placeholder="Add internal notes about gate codes, pricing, tools needed, etc...">${adminNotes}</textarea>
            <div style="margin-top: 8px; display: flex; align-items: center; gap: 10px;">
                <button class="btn" onclick="saveDossierNotes('${booking.id}')" style="padding: 7px 16px; font-size: 13px;">Save Notes</button>
                <span id="dossier-save-msg" style="color: #2d5a27; font-weight: bold; font-size: 13px;"></span>
            </div>
        </div>
    `

    modal.style.display = 'flex'
}

window.closeDossierWindow = function() {
    document.getElementById('file-window-modal').style.display = 'none'
}

window.handleModalOverlayClick = function(e) {
    if (e.target === document.getElementById('file-window-modal')) {
        closeDossierWindow()
    }
}

window.updateDossierStatus = async function(id, newStatus) {
    const { error } = await supabaseClient
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', id)

    if (error) {
        alert('Could not update status: ' + error.message)
        return
    }

    const b = allBookingsList.find(x => x.id == id)
    if (b) b.status = newStatus

    updateTabCounts()
    renderBookingCards()
    loadWeekCalendar()
    openBookingDossier(id)
}

window.saveDossierNotes = async function(id) {
    const textarea = document.getElementById(`modal-notes-${id}`)
    const msg = document.getElementById('dossier-save-msg')
    if (!textarea) return

    const { error } = await supabaseClient
        .from('bookings')
        .update({ admin_notes: textarea.value })
        .eq('id', id)

    if (error) {
        alert('Error saving notes: ' + error.message)
        return
    }

    const b = allBookingsList.find(x => x.id == id)
    if (b) b.admin_notes = textarea.value

    if (msg) {
        msg.textContent = '✓ Saved!'
        setTimeout(() => { msg.textContent = '' }, 2000)
    }
}

// ── Customer Summary ──
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
// ── Unlimited Portfolio Uploader & Drag-and-Drop Manager ──
// ══════════════════════════════════════════════════════════
let selectedUploadFiles = []
let allPortfolioRecords = []

function toggleCustomBadgeInput(val) {
    const customInput = document.getElementById('badge-custom-text')
    if (!customInput) return
    if (val === 'custom') {
        customInput.style.display = 'block'
        customInput.focus()
    } else {
        customInput.style.display = 'none'
    }
}
window.toggleCustomBadgeInput = toggleCustomBadgeInput

function getChosenLabel() {
    const preset = document.getElementById('badge-label-preset')?.value || 'none'
    if (preset === 'none') return ''
    if (preset === 'custom') {
        return (document.getElementById('badge-custom-text')?.value || '').trim()
    }
    return preset
}

function parseAdminPhotoItem(item) {
    if (!item) return null

    if (typeof item === 'object' && item !== null) {
        if (item.url && typeof item.url === 'string') {
            return { url: item.url.trim(), label: item.label || '' }
        }
    }

    if (typeof item === 'string') {
        const trimmed = item.trim()
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed)
                if (parsed && parsed.url) {
                    return { url: String(parsed.url).trim(), label: parsed.label || '' }
                }
            } catch (e) {
                const urlMatch = trimmed.match(/"url"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
                const labelMatch = trimmed.match(/"label"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
                if (urlMatch && urlMatch[1]) {
                    return {
                        url: urlMatch[1].replace(/\\/g, ''),
                        label: labelMatch && labelMatch[1] ? labelMatch[1] : ''
                    }
                }
            }
        }

        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return { url: trimmed, label: '' }
        }
    }

    return null
}

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
        const chosenLabel = getChosenLabel()
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

        const uploadedItems = []

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

                uploadedItems.push(JSON.stringify({
                    url: urlData.publicUrl,
                    label: chosenLabel
                }))

                const percent = Math.round(((i + 1) / selectedUploadFiles.length) * 100)
                progressFill.style.width = `${percent}%`
                status.textContent = `Uploaded ${i + 1} of ${selectedUploadFiles.length}...`
            }

            const existingRecord = allPortfolioRecords.find(r => (r.gallery === category || r.title === category))

            if (existingRecord) {
                let existingUrls = []
                if (Array.isArray(existingRecord.image_urls)) existingUrls.push(...existingRecord.image_urls)
                if (existingRecord.after_image_url) existingUrls.push(JSON.stringify({ url: existingRecord.after_image_url, label: 'After' }))
                if (existingRecord.before_image_url) existingUrls.push(JSON.stringify({ url: existingRecord.before_image_url, label: 'Before' }))

                const combined = [...existingUrls, ...uploadedItems]

                const { error: updateError } = await supabaseClient
                    .from('portfolio')
                    .update({ image_urls: combined })
                    .eq('id', existingRecord.id)

                if (updateError) throw updateError
            } else {
                const { error: insertError } = await supabaseClient
                    .from('portfolio')
                    .insert([{
                        title: category,
                        gallery: category,
                        image_urls: uploadedItems,
                        created_at: new Date().toISOString()
                    }])

                if (insertError) throw insertError
            }

            status.textContent = `Successfully uploaded ${uploadedItems.length} photo(s) to ${category}!`
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

// Drag State
let draggedRecordId = null
let draggedIndex = null

function filterEntriesList() {
    const grid = document.getElementById('simple-photos-grid')
    const totalCount = document.getElementById('total-photos-count')
    const filterSelect = document.getElementById('filter-manage-category')
    const clearBtn = document.getElementById('clear-photos-btn')
    if (!grid || !filterSelect) return

    const filter = filterSelect.value
    let displayPhotos = []

    if (clearBtn) {
        clearBtn.textContent = filter === 'ALL' ? '🗑️ Clear All Photos' : `🗑️ Clear ${filter} Photos`
    }

    allPortfolioRecords.forEach(record => {
        const cat = record.gallery || record.title || 'General Maintenance'
        if (filter !== 'ALL' && cat !== filter) return

        let rawItems = []
        if (Array.isArray(record.image_urls) && record.image_urls.length > 0) {
            rawItems.push(...record.image_urls)
        }
        if (record.after_image_url) rawItems.push({ url: record.after_image_url, label: 'After' })
        if (record.before_image_url) rawItems.push({ url: record.before_image_url, label: 'Before' })

        rawItems.forEach((item, index) => {
            const parsed = parseAdminPhotoItem(item)
            if (parsed && parsed.url && typeof parsed.url === 'string' && parsed.url.startsWith('http')) {
                displayPhotos.push({
                    recordId: record.id,
                    gallery: cat,
                    url: parsed.url,
                    label: parsed.label,
                    arrayIndex: index,
                    totalInRecord: rawItems.length
                })
            }
        })
    })

    if (totalCount) totalCount.textContent = displayPhotos.length

    if (displayPhotos.length === 0) {
        grid.innerHTML = '<p style="color:#777;">No photos in this category.</p>'
        return
    }

    grid.innerHTML = displayPhotos.map((item) => {
        const isCover = item.arrayIndex === 0

        return `
            <div class="admin-photo-card draggable" 
                 draggable="true" 
                 data-record-id="${escapeHtml(item.recordId)}" 
                 data-index="${item.arrayIndex}"
                 ondragstart="handleCardDragStart(event)"
                 ondragover="handleCardDragOver(event)"
                 ondragleave="handleCardDragLeave(event)"
                 ondrop="handleCardDrop(event)"
                 ondragend="handleCardDragEnd(event)">
                
                <div class="drag-grip-bar">
                    <span class="drag-handle-badge">
                        ⠿ ${isCover ? '★ Cover' : `Slide #${item.arrayIndex + 1}`}
                    </span>
                    <span style="font-size:11px; color:#fff; text-shadow:0 1px 2px #000;">Drag to shuffle</span>
                </div>

                <img src="${escapeHtml(item.url)}" alt="Uploaded photo" draggable="false">

                <div class="admin-photo-overlay">
                    <span class="photo-category-pill">${escapeHtml(item.gallery)}${item.label ? ` • ${escapeHtml(item.label)}` : ''}</span>
                    <button class="delete-photo-btn" onclick="deleteIndividualPhoto('${escapeHtml(item.recordId)}', '${encodeURIComponent(item.url)}')" title="Delete photo">✕</button>
                </div>
            </div>
        `
    }).join('')
}

// ── HTML5 Drag & Drop Shuffle Handlers ──
window.handleCardDragStart = function(e) {
    const card = e.currentTarget
    draggedRecordId = card.getAttribute('data-record-id')
    draggedIndex = parseInt(card.getAttribute('data-index'), 10)
    card.classList.add('dragging')
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', draggedIndex)
}

window.handleCardDragOver = function(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const card = e.currentTarget
    if (!card.classList.contains('dragging')) {
        card.classList.add('drag-over')
    }
}

window.handleCardDragLeave = function(e) {
    e.currentTarget.classList.remove('drag-over')
}

window.handleCardDrop = async function(e) {
    e.preventDefault()
    const targetCard = e.currentTarget
    targetCard.classList.remove('drag-over')

    const targetRecordId = targetCard.getAttribute('data-record-id')
    const targetIndex = parseInt(targetCard.getAttribute('data-index'), 10)

    if (draggedRecordId === null || draggedIndex === null) return
    if (draggedRecordId !== targetRecordId || draggedIndex === targetIndex) return

    const record = allPortfolioRecords.find(r => r.id == targetRecordId)
    if (!record || !Array.isArray(record.image_urls)) return

    // Reorder the array by moving the dragged item to the drop slot
    const updated = [...record.image_urls]
    const [movedItem] = updated.splice(draggedIndex, 1)
    updated.splice(targetIndex, 0, movedItem)

    // Immediate optimistic UI update
    record.image_urls = updated
    filterEntriesList()

    showSaveIndicator('Saving order...')

    // Persist to Supabase
    const { error } = await supabaseClient
        .from('portfolio')
        .update({ image_urls: updated })
        .eq('id', targetRecordId)

    if (error) {
        alert('Could not save reordered photos: ' + error.message)
        loadSimpleEntries()
    } else {
        showSaveIndicator('✓ Order saved!')
        setTimeout(hideSaveIndicator, 1500)
    }
}

window.handleCardDragEnd = function(e) {
    e.currentTarget.classList.remove('dragging')
    document.querySelectorAll('.admin-photo-card').forEach(card => {
        card.classList.remove('drag-over')
        card.classList.remove('dragging')
    })
    draggedRecordId = null
    draggedIndex = null
}

function showSaveIndicator(text) {
    let el = document.getElementById('drag-save-indicator')
    if (!el) {
        el = document.createElement('div')
        el.id = 'drag-save-indicator'
        el.className = 'drag-save-indicator'
        document.body.appendChild(el)
    }
    el.textContent = text
    el.style.display = 'block'
}

function hideSaveIndicator() {
    const el = document.getElementById('drag-save-indicator')
    if (el) el.style.display = 'none'
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

    let currentImages = []
    if (Array.isArray(record.image_urls)) {
        currentImages = record.image_urls.filter(u => {
            const parsed = parseAdminPhotoItem(u)
            return parsed && parsed.url !== targetUrl
        })
    }

    if (currentImages.length === 0) {
        await supabaseClient.from('portfolio').delete().eq('id', recordId)
    } else {
        await supabaseClient.from('portfolio').update({ image_urls: currentImages }).eq('id', recordId)
    }

    loadSimpleEntries()
}

// ── Clear All Photos (Selective by Category or Global) ──
window.clearAllPhotos = async function() {
    const filter = document.getElementById('filter-manage-category')?.value || 'ALL'
    const targetDesc = filter === 'ALL' ? 'ALL photos across all categories' : `ALL photos under "${filter}"`

    const confirmed = confirm(`⚠️ WARNING: Are you sure you want to permanently delete ${targetDesc}?\n\nThis action cannot be undone.`)
    if (!confirmed) return

    const clearBtn = document.getElementById('clear-photos-btn')
    if (clearBtn) {
        clearBtn.disabled = true
        clearBtn.textContent = 'Deleting...'
    }

    try {
        const targetRecords = allPortfolioRecords.filter(record => filter === 'ALL' || record.gallery === filter)

        const pathsToDelete = []
        targetRecords.forEach(record => {
            let rawItems = []
            if (Array.isArray(record.image_urls)) rawItems.push(...record.image_urls)
            if (record.after_image_url) rawItems.push(record.after_image_url)
            if (record.before_image_url) rawItems.push(record.before_image_url)

            rawItems.forEach(item => {
                const parsed = parseAdminPhotoItem(item)
                if (parsed && parsed.url) {
                    const match = parsed.url.match(/\/Portfolio\/(.+)$/)
                    if (match && match[1]) pathsToDelete.push(match[1])
                }
            })
        })

        if (pathsToDelete.length > 0) {
            await supabaseClient.storage.from('Portfolio').remove(pathsToDelete)
        }

        const recordIds = targetRecords.map(r => r.id)
        if (recordIds.length > 0) {
            const { error: deleteDbError } = await supabaseClient
                .from('portfolio')
                .delete()
                .in('id', recordIds)

            if (deleteDbError) throw deleteDbError
        }

        alert(`Successfully cleared ${pathsToDelete.length} photo(s).`)
        await loadSimpleEntries()
    } catch (err) {
        console.error('Error clearing photos:', err)
        alert('Failed to clear photos: ' + err.message)
    } finally {
        if (clearBtn) {
            clearBtn.disabled = false
            clearBtn.textContent = filter === 'ALL' ? '🗑️ Clear All Photos' : `🗑️ Clear ${filter} Photos`
        }
    }
}

// ── Application Initialization ──
checkAdmin().then(isAdmin => {
    if (isAdmin) {
        loadWeekCalendar()
        loadBookingsArchive()
        loadCustomers()
        loadSimpleEntries()
    }
})