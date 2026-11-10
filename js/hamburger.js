
 // ── Hamburger Menu ──
const hamburger = document.getElementById('hamburger')
const nav = document.getElementById('main-nav')

if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('open')
        hamburger.setAttribute('aria-expanded', String(isOpen))
    })

    // Close nav when a link is clicked
    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('open')
            hamburger.setAttribute('aria-expanded', 'false')
        })
    })

    // Close nav when clicking outside the menu
    document.addEventListener('click', (event) => {
        if (!nav.contains(event.target) && !hamburger.contains(event.target)) {
            nav.classList.remove('open')
            hamburger.setAttribute('aria-expanded', 'false')
        }
    })

    // Close nav when Escape is pressed
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            nav.classList.remove('open')
            hamburger.setAttribute('aria-expanded', 'false')
        }
    })
}
