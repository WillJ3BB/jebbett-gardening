// ── Load portfolio entries ──
async function loadPortfolio() {
    const { data, error } = await supabaseClient
        .from('portfolio')
        .select('*')
        .order('created_at', { ascending: false })

    const grid = document.getElementById('portfolio-grid')

    if (error || !data || data.length === 0) {
        grid.innerHTML = '<p>No portfolio entries yet. Check back soon!</p>'
        return
    }

    grid.innerHTML = data.map((entry, index) => {
        const images = entry.image_urls && entry.image_urls.length > 0
            ? entry.image_urls
            : [entry.before_image_url, entry.after_image_url].filter(Boolean)

        const total = images.length

        const galleryItems = images.map((url, i) => {
            let label = ''
            if (i === 0) label = 'Before'
            else if (i === total - 1 && total > 1) label = 'After'

            return `
                <div class="gallery-item" onclick="openLightbox(${index}, ${i})">
                    <img src="${url}" alt="${label || `Photo ${i + 1}`} - ${entry.title}">
                    ${label ? `<span class="gallery-label">${label}</span>` : ''}
                </div>
            `
        }).join('')

        return `
            <div class="portfolio-card">
                <div class="portfolio-info">
                    <h3>${entry.title}</h3>
                    ${entry.location ? `<p class="portfolio-location">📍 ${entry.location}</p>` : ''}
                    ${entry.description ? `<p class="portfolio-description">${entry.description}</p>` : ''}
                </div>
                <div class="gallery-strip" id="gallery-${index}">
                    ${galleryItems}
                </div>
            </div>
        `
    }).join('')

    window.portfolioData = data.map(entry => {
        return entry.image_urls && entry.image_urls.length > 0
            ? entry.image_urls
            : [entry.before_image_url, entry.after_image_url].filter(Boolean)
    })
}

// ── Lightbox ──
let lightboxIndex = 0
let lightboxImages = []

function openLightbox(entryIndex, imageIndex) {
    lightboxImages = window.portfolioData[entryIndex]
    lightboxIndex = imageIndex
    const lightbox = document.getElementById('lightbox')
    lightbox.style.display = 'flex'
    updateLightbox()
}

function updateLightbox() {
    document.getElementById('lightbox-img').src = lightboxImages[lightboxIndex]
    document.getElementById('lightbox-counter').textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`
}

function lightboxPrev() {
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length
    updateLightbox()
}

function lightboxNext() {
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length
    updateLightbox()
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none'
}

document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target === document.getElementById('lightbox')) closeLightbox()
})

loadPortfolio()