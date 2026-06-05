// ── Sign Up ──
const signupBtn = document.getElementById('signup-btn')

async function handleSignup() {
    const name = document.getElementById('full-name').value
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value

    if (!name || !email || !password) {
        alert('Please fill in all fields')
        return
    }

    const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name }
        }
    })

    if (error) {
        alert('Error: ' + error.message)
    } else {
        alert('Account created! Please check your email to confirm your account.')
        window.location.href = 'login.html'
    }
}

if (signupBtn) {
    signupBtn.addEventListener('click', handleSignup)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSignup()
    })
}

// ── Log In ──
const loginBtn = document.getElementById('login-btn')

async function handleLogin() {
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value

    if (!email || !password) {
        alert('Please fill in all fields')
        return
    }

    const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    })

    if (error) {
        alert('Error: ' + error.message)
    } else {
        window.location.href = 'account.html'
    }
}

if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin()
    })
}

// ── Log Out ──
const logoutBtn = document.getElementById('logout-btn')

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut()
        window.location.href = 'index.html'
    })
}

// ── Protect account page ──
if (window.location.pathname.includes('account.html')) {

    let bookingToCancel = null

    async function checkSession() {
        const { data: { session } } = await supabaseClient.auth.getSession()

        if (!session) {
            window.location.href = 'login.html'
        } else {
            const name = session.user.user_metadata.full_name || 'there'
            document.getElementById('user-name').textContent = name

            const { data, error } = await supabaseClient
                .from('bookings')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })

            const bookingsDiv = document.getElementById('no-bookings')

            if (error || !data || data.length === 0) {
                bookingsDiv.innerHTML = '<p>You have no bookings yet. <a href="booking.html">Book a service</a></p>'
                return
            }

            bookingsDiv.innerHTML = data.map(booking => `
                <div class="booking-card">
                    <h3>${booking.service_type.replace(/-/g, ' ')}</h3>
                    <p><strong>Date:</strong> ${new Date(booking.preferred_date).toLocaleDateString('en-GB')}</p>
                    <p><strong>Time:</strong> ${booking.preferred_time || 'Flexible'}</p>
                    <p><strong>Address:</strong> ${booking.address || 'Not specified'}</p>
                    <p><strong>Status:</strong> <span class="booking-status ${booking.status}">${booking.status}</span></p>
                    ${booking.status !== 'cancelled' && booking.status !== 'completed' ? `
                        <button class="cancel-booking-btn" data-id="${booking.id}">Cancel Booking</button>
                    ` : ''}
                </div>
            `).join('')

            // ── Cancel button click — show modal ──
            document.querySelectorAll('.cancel-booking-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    bookingToCancel = btn.dataset.id
                    document.getElementById('cancel-modal').style.display = 'flex'
                })
            })
        }
    }
    checkSession()

    // ── Close modal ──
    const closeModalBtn = document.getElementById('close-modal-btn')
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('cancel-modal').style.display = 'none'
            bookingToCancel = null
        })
    }

    // ── Close modal on overlay click ──
    const modal = document.getElementById('cancel-modal')
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none'
                bookingToCancel = null
            }
        })
    }

    // ── Confirm cancellation ──
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn')
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', async () => {
            if (!bookingToCancel) return

            const { error } = await supabaseClient
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingToCancel)

            if (error) {
                alert('Error cancelling booking: ' + error.message)
                return
            }

            document.getElementById('cancel-modal').style.display = 'none'
            bookingToCancel = null
            checkSession()
        })
    }
}