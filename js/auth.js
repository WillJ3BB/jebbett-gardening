// ── Sign Up ──
const signupBtn = document.getElementById('signup-btn')

if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
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
    })
}

// ── Log In ──
const loginBtn = document.getElementById('login-btn')

if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
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
    async function checkSession() {
        const { data: { session } } = await supabaseClient.auth.getSession()

        if (!session) {
            window.location.href = 'login.html'
        } else {
            const name = session.user.user_metadata.full_name || 'there'
            document.getElementById('user-name').textContent = name
        }
    }
    checkSession()
}