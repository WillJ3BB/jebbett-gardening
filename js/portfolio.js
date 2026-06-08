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

    grid.innerHTML = data.map((entry, index) => `
        <div class="portfolio-card">
            <div class="portfolio-info">
                <h3>${entry.title}</h3>
                ${entry.location ? `<p class="portfolio-location">📍 ${entry.location}</p>` : ''}
                ${entry.description ? `<p class="portfolio-description">${entry.description}</p>` : ''}
            </div>

            <!-- Desktop: tap to toggle -->
            <div class="portfolio-toggle desktop-only" id="toggle-${index}">
                <div class="toggle-image-wrap">
                    <img src="${entry.before_image_url}" alt="Before - ${entry.title}" class="toggle-img active" data-state="before">
                    <img src="${entry.after_image_url}" alt="After - ${entry.title}" class="toggle-img" data-state="after">
                </div>
                <div class="toggle-controls">
                    <button class="toggle-btn active" data-target="before" onclick="switchImage(${index}, 'before')">Before</button>
                    <button class="toggle-btn" data-target="after" onclick="switchImage(${index}, 'after')">After</button>
                </div>
            </div>

            <!-- Mobile: drag slider -->
            <div class="portfolio-slider mobile-only" id="slider-${index}">
                <p class="slider-hint">👆 Drag to compare before & after</p>
                <div class="slider-container">
                    <img src="${entry.after_image_url}" alt="After - ${entry.title}" class="slider-after">
                    <div class="slider-before-wrap">
                        <img src="${entry.before_image_url}" alt="Before - ${entry.title}" class="slider-before">
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

        </div>
    `).join('')

    // Init sliders on mobile
    document.querySelectorAll('.portfolio-slider').forEach(initSlider)
}

// ── Desktop: tap to toggle ──
function switchImage(index, state) {
    const wrap = document.getElementById(`toggle-${index}`)
    const imgs = wrap.querySelectorAll('.toggle-img')
    const btns = wrap.querySelectorAll('.toggle-btn')

    imgs.forEach(img => img.classList.remove('active'))
    btns.forEach(btn => btn.classList.remove('active'))

    wrap.querySelector(`[data-state="${state}"]`).classList.add('active')
    wrap.querySelector(`[data-target="${state}"]`).classList.add('active')
}

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

    // Touch events
    handle.addEventListener('touchstart', () => isDragging = true)
    window.addEventListener('touchend', () => isDragging = false)
    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return
        setPosition(e.touches[0].clientX)
    })

    // Mouse events
    handle.addEventListener('mousedown', () => isDragging = true)
    window.addEventListener('mouseup', () => isDragging = false)
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return
        setPosition(e.clientX)
    })

    // Start at 50%
    beforeWrap.style.width = '50%'
    handle.style.left = '50%'
}

loadPortfolio()