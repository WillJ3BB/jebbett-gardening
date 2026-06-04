// ── Dynamic nav based on login state ──
async function updateNav() {
    const { data: { session } } = await supabaseClient.auth.getSession()

    const nav = document.querySelector('nav ul')

    if (session) {
        // User is logged in — show My Account and Logout
        const loginItem = document.querySelector('nav ul li a[href="login.html"]')
        const accountItem = document.querySelector('nav ul li a[href="account.html"]')

        if (loginItem) {
            loginItem.parentElement.style.display = 'none'
        }
        if (accountItem) {
            accountItem.textContent = 'My Account'
        }

        // Add logout link if not already there
        if (!document.getElementById('logout-nav')) {
            const li = document.createElement('li')
            li.id = 'logout-nav'
            li.innerHTML = '<a href="#" id="logout-link">Log Out</a>'
            nav.appendChild(li)

            document.getElementById('logout-link').addEventListener('click', async (e) => {
                e.preventDefault()
                await supabaseClient.auth.signOut()
                window.location.href = 'index.html'
            })
        }
    } else {
        // User is logged out — hide My Account
        const accountItem = document.querySelector('nav ul li a[href="account.html"]')
        if (accountItem) {
            accountItem.parentElement.style.display = 'none'
        }
    }
}
updateNav()