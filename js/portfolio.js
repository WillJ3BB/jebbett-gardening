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
        // ── Get images — support both old and new format ──
        const images = entry.image_urls && entry.image_urls.length > 0
            ? entry.image_urls
            : [entry.before_image_url, entry.after_image_url].filter(Boolean)

        const total = images.length

        // ── Build gallery strip ──
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

                <!-- Gallery strip — all screen sizes -->
                <div class="gallery-strip" id="gallery-${index}">
                    ${galleryItems}
                </div>

                <!-- Mobile drag slider — only for 2 image entries -->
                ${total === 2 ? `
                <div class="portfolio-slider mobile-only" id="slider-${index}">
                    <p class="slider-hint">👆 Drag to compare before & after</p>
                    <div class="slider-container">
                        <img src="${images[1]}" alt="After - ${entry.title}" class="slider-after">
                        <div class="slider-before-wrap">
                            <img src="${images[0]}" alt="Before - ${entry.title}" class="slider-before">
                        </div>
                        <div class="slider-handle">
                            <div class="slider-line"></div>
                            <div class="slider-circle">⟺</div>
                        </div>
                    </div>
                    <div class="slider-labels">
                        <span>Before</span>
                        <span>After</span>
                    </div>
                </div>
                ` : ''}

            </div>
        `
    }).join('')

    // ── Store images for lightbox ──
    window.portfolioData = data.map(entry => {
        return entry.image_urls && entry.image_urls.length > 0
            ? entry.image_urls
            : [entry.before_image_url, entry.after_image_url].filter(Boolean)
    })

    // Init sliders on mobile for 2-image entries
    document.querySelectorAll('.portfolio-slider').forEach(initSlider)
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

// Close on overlay click
document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target === document.getElementById('lightbox')) closeLightbox()
})

// ── Mobile: drag slider ──
function initSlider(sliderEl) {
    const container = sliderEl.querySelector('.slider-container')
    const beforeWrap = sliderEl.querySelector('.slider-before-wrap')
    const handle = sliderEl.querySelector('.slider-handle')

    let isDragging = false

    function setPosition(x) {
        const rect = container.getBoundingClientRect()
        let pos = ((x - rect.left) / rect.width) * 100
        pos = Math.max(0, Math.min(100, pos))
        beforeWrap.style.width = pos + '%'
        handle.style.left = pos + '%'
    }

    handle.addEventListener('touchstart', () => isDragging = true)
    window.addEventListener('touchend', () => isDragging = false)
    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return
        setPosition(e.touches[0].clientX)
    })

    handle.addEventListener('mousedown', () => isDragging = true)
    window.addEventListener('mouseup', () => isDragging = false)
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return
        setPosition(e.clientX)
    })

    beforeWrap.style.width = '50%'
    handle.style.left = '50%'
}

loadPortfolio()