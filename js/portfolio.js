// ── Load portfolio entries grouped by gallery ──
async function loadPortfolio() {
    const { data, error } = await supabaseClient
        .from('portfolio')
        .select('*')
        .order('gallery', { ascending: true })
        .order('created_at', { ascending: false })

    const grid = document.getElementById('portfolio-grid')

    if (error || !data || data.length === 0) {
        grid.innerHTML = '<p>No portfolio entries yet. Check back soon!</p>'
        return
    }

    // Group entries by gallery
    const galleryGroups = {}
    data.forEach(entry => {
        const galleryName = entry.gallery || 'Uncategorized'
        if (!galleryGroups[galleryName]) {
            galleryGroups[galleryName] = []
        }
        galleryGroups[galleryName].push(entry)
    })

    // Build HTML with gallery sections
    let html = ''
    Object.keys(galleryGroups).sort().forEach(galleryName => {
        const entries = galleryGroups[galleryName]
        
        html += `<div class="portfolio-gallery-section">
            <h2 class="gallery-section-heading">${galleryName}</h2>
            <div class="portfolio-gallery-grid">`

        entries.forEach((entry, entryIndex) => {
            const images = entry.image_urls && entry.image_urls.length > 0
                ? entry.image_urls
                : [entry.before_image_url, entry.after_image_url].filter(Boolean)

            const total = images.length

            const galleryItems = images.map((url, i) => {
                let label = ''
                if (i === 0) label = 'Before'
                else if (i === total - 1 && total > 1) label = 'After'

                return `
                    <div class="gallery-item" onclick="openLightbox('${galleryName}', ${entryIndex}, ${i})">
                        <img src="${url}" alt="${label || `Photo ${i + 1}`} - ${entry.title}">
                        ${label ? `<span class="gallery-label">${label}</span>` : ''}
                    </div>
                `
            }).join('')

            html += `
                <div class="portfolio-card">
                    <div class="portfolio-info">
                        <h3>${entry.title}</h3>
                        ${entry.location ? `<p class="portfolio-location">📍 ${entry.location}</p>` : ''}
                        ${entry.description ? `<p class="portfolio-description">${entry.description}</p>` : ''}
                    </div>
                    <div class="gallery-strip" id="gallery-${galleryName}-${entryIndex}">
                        ${galleryItems}
                    </div>
                </div>
            `
        })

        html += `</div></div>`
    })

    grid.innerHTML = html

    // Build portfolio data structure for lightbox
    window.portfolioGalleries = {}
    Object.keys(galleryGroups).forEach(galleryName => {
        window.portfolioGalleries[galleryName] = galleryGroups[galleryName].map(entry => {
            return entry.image_urls && entry.image_urls.length > 0
                ? entry.image_urls
                : [entry.before_image_url, entry.after_image_url].filter(Boolean)
        })
    })
}

// ── Lightbox ──
let lightboxCurrentGallery = null
let lightboxEntryIndex = 0
let lightboxImageIndex = 0
let lightboxImages = []

function openLightbox(galleryName, entryIndex, imageIndex) {
    lightboxCurrentGallery = galleryName
    lightboxEntryIndex = entryIndex
    lightboxImageIndex = imageIndex
    lightboxImages = window.portfolioGalleries[galleryName][entryIndex]
    
    const lightbox = document.getElementById('lightbox')
    lightbox.style.display = 'flex'
    updateLightbox()
}

function updateLightbox() {
    document.getElementById('lightbox-img').src = lightboxImages[lightboxImageIndex]
    document.getElementById('lightbox-counter').textContent = `${lightboxImageIndex + 1} / ${lightboxImages.length}`
}

function lightboxPrev() {
    lightboxImageIndex = (lightboxImageIndex - 1 + lightboxImages.length) % lightboxImages.length
    updateLightbox()
}

function lightboxNext() {
    lightboxImageIndex = (lightboxImageIndex + 1) % lightboxImages.length
    updateLightbox()
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none'
}

document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target === document.getElementById('lightbox')) closeLightbox()
})

loadPortfolio()