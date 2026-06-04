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

    grid.innerHTML = data.map(entry => `
        <div class="portfolio-card">
            <h3>${entry.title}</h3>
            ${entry.location ? `<p class="portfolio-location">📍 ${entry.location}</p>` : ''}
            ${entry.description ? `<p class="portfolio-description">${entry.description}</p>` : ''}
            <div class="portfolio-images">
                <div class="portfolio-image">
                    <span class="image-label">Before</span>
                    <img src="${entry.before_image_url}" alt="Before - ${entry.title}">
                </div>
                <div class="portfolio-image">
                    <span class="image-label">After</span>
                    <img src="${entry.after_image_url}" alt="After - ${entry.title}">
                </div>
            </div>
        </div>
    `).join('')
}
loadPortfolio()