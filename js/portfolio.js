// ── 5 Dedicated Frames / Headings ──
const CATEGORIES = [
    'Lawn Cuts',
    'Hedge Trimming',
    'Garden Clearance',
    'Planting & Borders',
    'General Maintenance'
];

// Helper to normalize category names so variations match the right frame
function normalizeCategory(raw) {
    if (!raw) return null;
    const clean = raw.trim().toLowerCase();
    
    if (clean.includes('lawn') || clean.includes('cut') || clean.includes('mow')) return 'Lawn Cuts';
    if (clean.includes('hedge') || clean.includes('trim')) return 'Hedge Trimming';
    if (clean.includes('clearance') || clean.includes('waste')) return 'Garden Clearance';
    if (clean.includes('plant') || clean.includes('border') || clean.includes('bed')) return 'Planting & Borders';
    if (clean.includes('maintenance')) return 'General Maintenance';

    return null;
}

const frameIndices = {};
window.categorySlides = {};

async function loadPortfolio() {
    const grid = document.getElementById('portfolio-grid');

    const { data, error } = await supabaseClient
        .from('portfolio')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching portfolio:', error);
        grid.innerHTML = '<p>Unable to load portfolio entries. Please try again later.</p>';
        return;
    }

    // Initialize buckets for each frame
    CATEGORIES.forEach(cat => {
        window.categorySlides[cat] = [];
        frameIndices[cat] = 0;
    });

    if (data && data.length > 0) {
        data.forEach(entry => {
            // Find which frame this belongs to
            const matchedCategory = normalizeCategory(entry.gallery) || normalizeCategory(entry.title);

            // If it doesn't match any of our 5, skip rather than dumping into Lawn Cuts
            if (!matchedCategory || !window.categorySlides[matchedCategory]) return;

            const images = entry.image_urls && entry.image_urls.length > 0
                ? entry.image_urls
                : [entry.after_image_url, entry.before_image_url].filter(Boolean);

            const total = images.length;

            images.forEach((url, i) => {
                let label = '';
                if (i === 0 && total > 1) label = 'Before';
                else if (i === total - 1 && total > 1) label = 'After';

                window.categorySlides[matchedCategory].push({
                    url,
                    label,
                    title: entry.title || matchedCategory,
                    location: entry.location || '',
                    description: entry.description || ''
                });
            });
        });
    }

    // Build the 5 frames HTML
    let html = '<div class="frames-grid">';

    CATEGORIES.forEach((categoryName, idx) => {
        const slides = window.categorySlides[categoryName] || [];
        const hasImages = slides.length > 0;
        const current = hasImages ? slides[0] : null;

        html += `
            <div class="category-frame" id="frame-${idx}">
                <div class="frame-header">
                    <h2>${categoryName}</h2>
                    ${hasImages ? `<span class="frame-counter" id="counter-${idx}">1 / ${slides.length}</span>` : ''}
                </div>

                <div class="frame-viewport">
                    ${hasImages ? `
                        <img id="frame-img-${idx}" 
                             src="${current.url}" 
                             alt="${current.title}" 
                             onclick="openFrameLightbox('${categoryName}')">
                        ${current.label ? `<span class="frame-label" id="label-${idx}">${current.label}</span>` : `<span class="frame-label" id="label-${idx}" style="display:none;"></span>`}
                    ` : `
                        <div class="frame-empty">
                            <p>No photos uploaded yet.</p>
                        </div>
                    `}

                    ${slides.length > 1 ? `
                        <button class="frame-arrow frame-prev" onclick="shiftFrame('${categoryName}',${idx}, -1)" aria-label="Previous photo">&#10094;</button>
                        <button class="frame-arrow frame-next" onclick="shiftFrame('${categoryName}',${idx}, 1)" aria-label="Next photo">&#10095;</button>
                    ` : ''}
                </div>

                <div class="frame-details">
                    <h3 id="title-${idx}">${hasImages ? current.title : 'Awaiting New Work'}</h3>
                    <p class="frame-loc" id="loc-${idx}">${hasImages && current.location ? `📍 ${current.location}` : ''}</p>
                    <p class="frame-desc" id="desc-${idx}">${hasImages && current.description ? current.description : ''}</p>
                </div>
            </div>
        `;
    });

    html += '</div>';
    grid.innerHTML = html;
}

// ── Move through photos inside a frame ──
function shiftFrame(categoryName, frameIdx, delta) {
    const slides = window.categorySlides[categoryName];
    if (!slides || slides.length <= 1) return;

    let currentIndex = frameIndices[categoryName];
    currentIndex = (currentIndex + delta + slides.length) % slides.length;
    frameIndices[categoryName] = currentIndex;

    const slide = slides[currentIndex];
    const img = document.getElementById(`frame-img-${frameIdx}`);

    img.style.opacity = '0.3';
    setTimeout(() => {
        img.src = slide.url;
        img.alt = slide.title;
        img.style.opacity = '1';

        const counterEl = document.getElementById(`counter-${frameIdx}`);
        if (counterEl) counterEl.textContent = `${currentIndex + 1} / ${slides.length}`;

        const labelEl = document.getElementById(`label-${frameIdx}`);
        if (labelEl) {
            if (slide.label) {
                labelEl.textContent = slide.label;
                labelEl.style.display = 'block';
            } else {
                labelEl.style.display = 'none';
            }
        }

        const titleEl = document.getElementById(`title-${frameIdx}`);
        if (titleEl) titleEl.textContent = slide.title;

        const locEl = document.getElementById(`loc-${frameIdx}`);
        if (locEl) locEl.textContent = slide.location ? `📍 ${slide.location}` : '';

        const descEl = document.getElementById(`desc-${frameIdx}`);
        if (descEl) descEl.textContent = slide.description || '';
    }, 120);
}

// ── Lightbox ──
let activeLightboxSlides = [];
let activeLightboxIndex = 0;

function openFrameLightbox(categoryName) {
    const slides = window.categorySlides[categoryName];
    if (!slides || slides.length === 0) return;

    activeLightboxSlides = slides;
    activeLightboxIndex = frameIndices[categoryName] || 0;

    const lightbox = document.getElementById('lightbox');
    lightbox.style.display = 'flex';
    syncLightbox();
}

function syncLightbox() {
    const slide = activeLightboxSlides[activeLightboxIndex];
    document.getElementById('lightbox-img').src = slide.url;
    const counter = document.getElementById('lightbox-counter');
    if (counter) counter.textContent = `${activeLightboxIndex + 1} / ${activeLightboxSlides.length}`;
}

function lightboxPrev() {
    if (activeLightboxSlides.length <= 1) return;
    activeLightboxIndex = (activeLightboxIndex - 1 + activeLightboxSlides.length) % activeLightboxSlides.length;
    syncLightbox();
}

function lightboxNext() {
    if (activeLightboxSlides.length <= 1) return;
    activeLightboxIndex = (activeLightboxIndex + 1) % activeLightboxSlides.length;
    syncLightbox();
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
}

document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target === document.getElementById('lightbox')) closeLightbox();
});

loadPortfolio();