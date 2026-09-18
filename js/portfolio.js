// ── 5 Dedicated Frames / Headings ──
// (You can rename any of these to match your exact 5 services)
const CATEGORIES = [
    'Lawn Cuts',
    'Hedge Trimming',
    'Garden Clearance',
    'Planting Bed',
    'General Maintenance'
];

// Track active slide index for each frame
const frameIndices = {};
window.categorySlides = {};

async function loadPortfolio() {
    const grid = document.getElementById('portfolio-grid');

    // Fetch all entries sorted by newest first
    const { data, error } = await supabaseClient
        .from('portfolio')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching portfolio:', error);
        grid.innerHTML = '<p>Unable to load portfolio entries. Please try again later.</p>';
        return;
    }

    // Initialize buckets for each of the 5 categories
    CATEGORIES.forEach(cat => {
        window.categorySlides[cat] = [];
        frameIndices[cat] = 0;
    });

    // Populate the categories with images from Supabase
    if (data && data.length > 0) {
        data.forEach(entry => {
            const galleryName = entry.gallery || 'General Maintenance';

            const images = entry.image_urls && entry.image_urls.length > 0
                ? entry.image_urls
                : [entry.after_image_url, entry.before_image_url].filter(Boolean);

            const total = images.length;

            images.forEach((url, i) => {
                let label = '';
                if (i === 0 && total > 1) label = 'Before';
                else if (i === total - 1 && total > 1) label = 'After';

                const slide = {
                    url,
                    label,
                    title: entry.title || galleryName,
                    location: entry.location || '',
                    description: entry.description || ''
                };

                if (window.categorySlides[galleryName]) {
                    window.categorySlides[galleryName].push(slide);
                } else {
                    // Fallback to the first category if an entry has an unrecognized name
                    window.categorySlides[CATEGORIES[0]].push(slide);
                }
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
                    <span class="frame-counter" id="counter-${idx}">
                        ${hasImages ? `1 / ${slides.length}` : '0 / 0'}
                    </span>
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

    // Quick subtle fade for smooth browsing
    img.style.opacity = '0.3';
    setTimeout(() => {
        img.src = slide.url;
        img.alt = slide.title;
        img.style.opacity = '1';

        document.getElementById(`counter-${frameIdx}`).textContent = `${currentIndex + 1} / ${slides.length}`;

        const labelEl = document.getElementById(`label-${frameIdx}`);
        if (slide.label) {
            labelEl.textContent = slide.label;
            labelEl.style.display = 'block';
        } else {
            labelEl.style.display = 'none';
        }

        document.getElementById(`title-${frameIdx}`).textContent = slide.title;
        document.getElementById(`loc-${frameIdx}`).textContent = slide.location ? `📍 ${slide.location}` : '';
        document.getElementById(`desc-${frameIdx}`).textContent = slide.description || '';
    }, 120);
}

// ── Lightbox for expanded full-screen view ──
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
    document.getElementById('lightbox-counter').textContent = `${activeLightboxIndex + 1} / ${activeLightboxSlides.length}`;
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