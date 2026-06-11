// ── Cookie Notice ──
function initCookieNotice() {
    if (!localStorage.getItem('cookiesAccepted')) {
        document.getElementById('cookie-notice').style.display = 'flex'
    }

    document.getElementById('cookie-accept').addEventListener('click', () => {
        localStorage.setItem('cookiesAccepted', 'true')
        document.getElementById('cookie-notice').style.display = 'none'
    })
}

initCookieNotice()