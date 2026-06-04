// ── Hamburger Menu ──
const hamburger = document.getElementById('hamburger')
const nav = document.getElementById('main-nav')

if (hamburger) {
    hamburger.addEventListener('click', () => {
        nav.classList.toggle('open')
    })

    // Close nav when a link is clicked
    document.querySelectorAll('#main-nav a').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('open')
        })
    })
}