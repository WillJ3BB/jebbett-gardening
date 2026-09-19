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

// ── Open-Redirect Protected URL resolver ──
function getSafeRedirectUrl() {
    const params = new URLSearchParams(window.location.search)
    const rawRedirect = params.get('redirect')

    if (!rawRedirect) return 'account.html'

    const decoded = decodeURIComponent(rawRedirect).trim()

    // Must start with a relative local path (.html) and not protocol-relative (//)
    if (decoded.startsWith('/') && !decoded.startsWith('//')) {
        return decoded
    }

    if (/^[a-zA-Z0-9_-]+\.html(\?[a-zA-Z0-9_=&-]*)?$/.test(decoded)) {
        return decoded
    }

    // Default safe fallback if invalid
    return 'account.html'
}

// ── Pass redirect parameter between Login and Signup links ──
function preserveRedirectLinks() {
    const params = new URLSearchParams(window.location.search)
    const redirectParam = params.get('redirect')
    if (!redirectParam) return

    const toSignup = document.getElementById('to-signup-link')
    if (toSignup) {
        toSignup.href = `signup.html?redirect=${encodeURIComponent(redirectParam)}`
    }

    const toLogin = document.getElementById('to-login-link')
    if (toLogin) {
        toLogin.href = `login.html?redirect=${encodeURIComponent(redirectParam)}`
    }
}
preserveRedirectLinks()

// ── In-page UI Alerts ──
function showAuthAlert(message, isError = true) {
    const box = document.getElementById('auth-alert')
    if (!box) {
        alert(message)
        return
    }
    box.textContent = message
    box.style.display = 'block'
    box.style.background = isError ? '#ffebee' : '#e8f5e9'
    box.style.color = isError ? '#c62828' : '#2e7d32'
    box.style.border = `1px solid ${isError ? '#ef9a9a' : '#a5d6a7'}`
}

// ── Sign Up Handler ──
const signupBtn = document.getElementById('signup-btn')

async function handleSignup() {
    const nameEl = document.getElementById('full-name')
    const emailEl = document.getElementById('email')
    const passwordEl = document.getElementById('password')

    if (!nameEl || !emailEl || !passwordEl) return

    const name = nameEl.value.trim()
    const email = emailEl.value.trim().toLowerCase()
    const password = passwordEl.value

    if (!name || !email || !password) {
        showAuthAlert('Please fill in all fields.')
        return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
        showAuthAlert('Please enter a valid email address.')
        return
    }

    if (password.length < 8) {
        showAuthAlert('Password must be at least 8 characters long.')
        return
    }

    signupBtn.disabled = true
    signupBtn.textContent = 'Creating account...'

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name }
            }
        })

        if (error) throw error

        showAuthAlert('Account created successfully! Redirecting...', false)

        const targetUrl = getSafeRedirectUrl()
        setTimeout(() => {
            window.location.href = targetUrl
        }, 1200)

    } catch (err) {
        showAuthAlert(err.message || 'Error creating account.')
        signupBtn.disabled = false
        signupBtn.textContent = 'Create Account'
    }
}

if (signupBtn) {
    signupBtn.addEventListener('click', handleSignup)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSignup()
    })
}

// ── Log In Handler ──
const loginBtn = document.getElementById('login-btn')

async function handleLogin() {
    const emailEl = document.getElementById('email')
    const passwordEl = document.getElementById('password')

    if (!emailEl || !passwordEl) return

    const email = emailEl.value.trim().toLowerCase()
    const password = passwordEl.value

    if (!email || !password) {
        showAuthAlert('Please fill in both email and password.')
        return
    }

    loginBtn.disabled = true
    loginBtn.textContent = 'Logging in...'

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        })

        if (error) throw error

        const redirectUrl = getSafeRedirectUrl()
        window.location.href = redirectUrl

    } catch (err) {
        showAuthAlert(err.message || 'Invalid login credentials.')
        loginBtn.disabled = false
        loginBtn.textContent = 'Log In'
    }
}

if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin()
    })
}

// ── Log Out Handler ──
const logoutBtn = document.getElementById('logout-btn')

if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault()
        try {
            await supabaseClient.auth.signOut()
        } catch (err) {
            console.warn('Signout issue:', err)
        } finally {
            localStorage.clear()
            sessionStorage.clear()
            window.location.href = 'index.html'
        }
    })
}

// ── Protect account page ──
if (window.location.pathname.includes('account.html')) {

    let bookingToCancel = null

    async function checkSession() {
        const { data: { session } } = await supabaseClient.auth.getSession()

        if (!session) {
            window.location.href = 'login.html'
            return
        }

        const rawName = session.user.user_metadata?.full_name || 'there'
        const userGreeting = document.getElementById('user-name')
        if (userGreeting) userGreeting.textContent = rawName

        const { data, error } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })

        const bookingsDiv = document.getElementById('no-bookings')
        if (!bookingsDiv) return

        if (error || !data || data.length === 0) {
            bookingsDiv.innerHTML = '<p>You have no bookings yet. <a href="booking.html">Book a service</a></p>'
            return
        }

        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const activeBookings = data.filter(b => b.status !== 'cancelled')
        const cancelledBookings = data.filter(b => {
            if (b.status !== 'cancelled') return false
            return new Date(b.created_at) > thirtyDaysAgo
        })

        function renderCard(booking, faded = false) {
            const cleanService = escapeHtml((booking.service_type || '').replace(/-/g, ' '))
            const cleanDate = escapeHtml(new Date(booking.preferred_date).toLocaleDateString('en-GB'))
            const cleanTime = escapeHtml(booking.preferred_time || 'Flexible')
            const cleanAddress = escapeHtml(booking.address || 'Not specified')
            const cleanStatus = escapeHtml(booking.status || 'pending')
            const cleanId = escapeHtml(booking.id)

            return `
                <div class="booking-card ${faded ? 'booking-card-faded' : ''}">
                    <h3>${cleanService}</h3>
                    <p><strong>Date:</strong> ${cleanDate}</p>
                    <p><strong>Time:</strong> ${cleanTime}</p>
                    <p><strong>Address:</strong> ${cleanAddress}</p>
                    <p><strong>Status:</strong> <span class="booking-status ${cleanStatus}">${cleanStatus}</span></p>
                    ${booking.status !== 'cancelled' && booking.status !== 'completed' ? `
                        <button class="cancel-booking-btn" data-id="${cleanId}">Cancel Booking</button>
                    ` : ''}
                </div>
            `
        }

        let html = ''

        if (activeBookings.length > 0) {
            html += activeBookings.map(b => renderCard(b)).join('')
        } else {
            html += '<p>You have no active bookings. <a href="booking.html">Book a service</a></p>'
        }

        if (cancelledBookings.length > 0) {
            html += `
                <details class="cancelled-bookings-details">
                    <summary>Show cancelled bookings (${cancelledBookings.length})</summary>
                    <div class="cancelled-bookings-list">
                        ${cancelledBookings.map(b => renderCard(b, true)).join('')}
                    </div>
                </details>
            `
        }

        bookingsDiv.innerHTML = html

        document.querySelectorAll('.cancel-booking-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                bookingToCancel = btn.dataset.id
                const modal = document.getElementById('cancel-modal')
                if (modal) modal.style.display = 'flex'
            })
        })
    }

    checkSession()

    // ── Modal Interactions ──
    const closeModalBtn = document.getElementById('close-modal-btn')
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            const modal = document.getElementById('cancel-modal')
            if (modal) modal.style.display = 'none'
            bookingToCancel = null
        })
    }

    const modal = document.getElementById('cancel-modal')
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none'
                bookingToCancel = null
            }
        })
    }

    const confirmCancelBtn = document.getElementById('confirm-cancel-btn')
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', async () => {
            if (!bookingToCancel) return

            confirmCancelBtn.disabled = true
            confirmCancelBtn.textContent = 'Cancelling...'

            const { error } = await supabaseClient
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingToCancel)

            confirmCancelBtn.disabled = false
            confirmCancelBtn.textContent = 'Yes, Cancel Booking'

            if (error) {
                alert('Error cancelling booking: ' + error.message)
                return
            }

            if (modal) modal.style.display = 'none'
            bookingToCancel = null
            checkSession()
        })
    }
}