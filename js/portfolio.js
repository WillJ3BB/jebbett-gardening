// ── 5 Dedicated Frames / Headings ──
const CATEGORIES = [
    'Lawn Cuts',
    'Hedge Trimming',
    'Garden Clearance',
    'Planting & Borders',
    'General Maintenance'
];

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

// Robust extractor for plain strings, stringified JSON, or nested objects
function extractPhotoDetails(item) {
    if (!item) return null;

    if (typeof item === 'object' && item !== null) {
        if (item.url && typeof item.url === 'string') {
            return { url: item.url.trim(), label: item.label || '' };
        }
    }

    if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && parsed.url) {
                    return { url: String(parsed.url).trim(), label: parsed.label || '' };
                }
            } catch (e) {
                // Fallback regex if JSON was malformed by escaping
                const urlMatch = trimmed.match(/"url"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
                const labelMatch = trimmed.match(/"label"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
                if (urlMatch && urlMatch[1]) {
                    return {
                        url: urlMatch[1].replace(/\\/g, ''),
                        label: labelMatch && labelMatch[1] ? labelMatch[1] : ''
                    };
                }
            }
        }

        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return { url: trimmed, label: '' };
        }
    }

    return null;
}

const frameIndices = {};
window.categorySlides = {};

async function loadPortfolio() {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    const { data, error } = await supabaseClient
        .from('portfolio')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching portfolio:', error);
        grid.innerHTML = '<p>Unable to load portfolio entries. Please try again later.</p>';
        return;
    }

    CATEGORIES.forEach(cat => {
        window.categorySlides[cat] = [];
        frameIndices[cat] = 0;
    });

    if (data && data.length > 0) {
        data.forEach(entry => {
            const matchedCategory = normalizeCategory(entry.gallery) || normalizeCategory(entry.title);
            if (!matchedCategory || !window.categorySlides[matchedCategory]) return;

            let itemsToProcess = [];

            if (Array.isArray(entry.image_urls) && entry.image_urls.length > 0) {
                itemsToProcess.push(...entry.image_urls);
            }
            if (entry.after_image_url) {
                itemsToProcess.push({ url: entry.after_image_url, label: 'After' });
            }
            if (entry.before_image_url) {
                itemsToProcess.push({ url: entry.before_image_url, label: 'Before' });
            }

            itemsToProcess.forEach(raw => {
                const extracted = extractPhotoDetails(raw);
                if (extracted && extracted.url) {
                    const exists = window.categorySlides[matchedCategory].some(s => s.url === extracted.url);
                    if (!exists) {
                        window.categorySlides[matchedCategory].push({
                            url: extracted.url,
                            label: extracted.label,
                            title: entry.title || matchedCategory,
                            location: entry.location || '',
                            description: entry.description || ''
                        });
                    }
                }
            });
        });
    }

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
                             src="${escapeAttr(current.url)}" 
                             alt="${escapeAttr(current.title)}" 
                             onclick="openFrameLightbox('${categoryName}')">
                        ${current.label ? `<span class="frame-label" id="label-${idx}">${escapeAttr(current.label)}</span>` : `<span class="frame-label" id="label-${idx}" style="display:none;"></span>`}
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
                    <h3 id="title-${idx}">${hasImages ? escapeAttr(current.title) : 'Awaiting New Work'}</h3>
                    <p class="frame-loc" id="loc-${idx}">${hasImages && current.location ? `📍 ${escapeAttr(current.location)}` : ''}</p>
                    <p class="frame-desc" id="desc-${idx}">${hasImages && current.description ? escapeAttr(current.description) : ''}</p>
                </div>
            </div>
        `;
    });

    html += '</div>';
    grid.innerHTML = html;
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
    if (lightbox) {
        lightbox.style.display = 'flex';
        syncLightbox();
    }
}

function syncLightbox() {
    const slide = activeLightboxSlides[activeLightboxIndex];
    const img = document.getElementById('lightbox-img');
    if (img) img.src = slide.url;
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
    const lightbox = document.getElementById('lightbox');
    if (lightbox) lightbox.style.display = 'none';
}

const lightboxEl = document.getElementById('lightbox');
if (lightboxEl) {
    lightboxEl.addEventListener('click', (e) => {
        if (e.target === lightboxEl) closeLightbox();
    });
}

loadPortfolio();