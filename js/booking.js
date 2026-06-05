// ── Booking Calendar ──

const today = new Date()
today.setHours(0, 0, 0, 0)

let currentMonth = today.getMonth()
let currentYear = today.getFullYear()
let selectedDate = null
let selectedTime = null
let bookedCounts = {}

// ── Capacity per day ──
function getCapacity(date) {
    const day = date.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    if (day === 1 || day === 2 || day === 3 || day === 4) return 2 // Mon-Thu
    if (day === 5) return 8 // Fri
    if (day === 6 || day === 0) return 6 // Sat-Sun
    return 0
}

// ── Time slots per day ──
function getTimeSlots(date) {
    const day = date.getDay()
    if (day === 1 || day === 2 || day === 3 || day === 4) {
        return ['9:00am – 10:30am', '11:00am – 12:30pm']
    }
    if (day === 5) {
        return ['8:00am – 9:30am', '9:30am – 11:00am', '11:00am – 12:30pm', '12:30pm – 2:00pm', '2:00pm – 3:30pm', '3:30pm – 5:00pm']
    }
    if (day === 6 || day === 0) {
        return ['7:00am – 8:30am', '8:30am – 10:00am', '10:00am – 11:30am', '11:30am – 1:00pm', '1:00pm – 2:30pm', '2:30pm – 4:00pm']
    }
    return []
}

// ── Load booked counts from Supabase ──
async function loadBookedCounts() {
    const { data, error } = await supabaseClient
        .from('bookings')
        .select('preferred_date, preferred_time')
        .neq('status', 'cancelled')

    if (error || !data) return

    bookedCounts = {}
    data.forEach(b => {
        if (!bookedCounts[b.preferred_date]) {
            bookedCounts[b.preferred_date] = {}
        }
        const time = b.preferred_time || 'flexible'
        bookedCounts[b.preferred_date][time] = (bookedCounts[b.preferred_date][time] || 0) + 1
    })
}

// ── Render calendar ──
function renderCalendar() {
    const grid = document.getElementById('calendar-grid')
    const title = document.getElementById('calendar-title')

    // Clear existing day cells (keep headers)
    const headers = grid.querySelectorAll('.calendar-day-header')
    grid.innerHTML = ''
    headers.forEach(h => grid.appendChild(h))

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
    title.textContent = `${monthNames[currentMonth]} ${currentYear}`

    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)

    // Monday = 0 offset
    let startOffset = firstDay.getDay() - 1
    if (startOffset < 0) startOffset = 6

    // Max booking date — 5 weeks ahead
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + 35)

    // Empty cells before first day
    for (let i = 0; i < startOffset; i++) {
        const empty = document.createElement('div')
        empty.classList.add('calendar-cell', 'empty')
        grid.appendChild(empty)
    }

    // Day cells
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const date = new Date(currentYear, currentMonth, d)
        const dateStr = date.toISOString().split('T')[0]
        const capacity = getCapacity(date)
        const booked = bookedCounts[dateStr] ? Object.values(bookedCounts[dateStr]).reduce((a, b) => a + b, 0) : 0
        const isPast = date < today
        const isTooFar = date > maxDate
        const isFull = booked >= capacity

        const cell = document.createElement('div')
        cell.classList.add('calendar-cell')
        cell.textContent = d

        if (isPast || isTooFar || isFull) {
            cell.classList.add('unavailable')
        } else {
            cell.classList.add('available')
            cell.addEventListener('click', () => selectDate(date, dateStr))
        }

        if (selectedDate === dateStr) {
            cell.classList.add('selected')
        }

        grid.appendChild(cell)
    }
}

// ── Select a date ──
function selectDate(date, dateStr) {
    selectedDate = dateStr
    renderCalendar()

    // Show step 2
    document.getElementById('step-1').style.display = 'none'
    document.getElementById('step-2').style.display = 'block'

    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    document.getElementById('selected-date-display').textContent = `Selected: ${date.toLocaleDateString('en-GB', options)}`

    // Render time slots
    const slots = getTimeSlots(date)
    const bookedSlots = bookedCounts[dateStr] || {}
    const slotsContainer = document.getElementById('time-slots')
    slotsContainer.innerHTML = ''

    slots.forEach(slot => {
        const count = bookedSlots[slot] || 0
        const capacity = getCapacity(date)
        const slotsFull = count >= Math.ceil(capacity / slots.length)

        const btn = document.createElement('button')
        btn.classList.add('time-slot-btn')
        btn.textContent = slot

        if (slotsFull) {
            btn.classList.add('slot-full')
            btn.disabled = true
            btn.textContent += ' — Full'
        } else {
            btn.addEventListener('click', () => selectTime(slot, btn))
        }

        slotsContainer.appendChild(btn)
    })
}

// ── Select a time ──
function selectTime(time, btn) {
    selectedTime = time
    document.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'))
    btn.classList.add('selected')

    setTimeout(() => {
        document.getElementById('step-2').style.display = 'none'
        document.getElementById('step-3').style.display = 'block'
        document.getElementById('selected-slot-display').textContent = `📅 ${selectedDate} at ${selectedTime}`
    }, 300)
}

// ── Navigation ──
document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--
    if (currentMonth < 0) { currentMonth = 11; currentYear-- }
    renderCalendar()
})

document.getElementById('next-month').addEventListener('click', () => {
    currentMonth++
    if (currentMonth > 11) { currentMonth = 0; currentYear++ }
    renderCalendar()
})

document.getElementById('back-to-step-1').addEventListener('click', () => {
    document.getElementById('step-2').style.display = 'none'
    document.getElementById('step-1').style.display = 'block'
})

document.getElementById('back-to-step-2').addEventListener('click', () => {
    document.getElementById('step-3').style.display = 'none'
    document.getElementById('step-2').style.display = 'block'
})

// ── Submit booking ──
async function handleBooking() {
    const fullName = document.getElementById('full-name').value
    const email = document.getElementById('email').value
    const phone = document.getElementById('phone').value
    const serviceType = document.getElementById('service').value
    const address = document.getElementById('address').value
    const notes = document.getElementById('notes').value

    if (!fullName || !email || !serviceType || !address) {
        alert('Please fill in all required fields')
        return
    }

    if (!selectedDate || !selectedTime) {
        alert('Please select a date and time')
        return
    }

    const { data: { session } } = await supabaseClient.auth.getSession()
    const userId = session ? session.user.id : null

    const { error } = await supabaseClient
        .from('bookings')
        .insert([{
            user_id: userId,
            full_name: fullName,
            email: email,
            phone: phone,
            service_type: serviceType,
            preferred_date: selectedDate,
            preferred_time: selectedTime,
            address: address,
            notes: notes,
            status: 'pending'
        }])

    if (error) {
        alert('Something went wrong: ' + error.message)
    } else {
        alert('Booking request received! We will be in touch to confirm.')
        window.location.href = 'index.html'
    }
}

document.getElementById('submit-booking').addEventListener('click', handleBooking)

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleBooking()
})

// ── Init ──
loadBookedCounts().then(renderCalendar)