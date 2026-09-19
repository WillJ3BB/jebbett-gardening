// ── 5 Core Services ──
const CATEGORIES = [
    'Lawn Cuts',
    'Hedge Trimming',
    'Garden Clearance',
    'Planting & Borders',
    'General Maintenance'
];

function normalizeCategory(raw) {
    if (!raw) return 'General Maintenance';
    const clean = raw.trim().toLowerCase();
    
    if (clean.includes('lawn') || clean.includes('cut') || clean.includes('mow')) return 'Lawn Cuts';
    if (clean.includes('hedge') || clean.includes('trim')) return 'Hedge Trimming';
    if (clean.includes('clearance') || clean.includes('waste')) return 'Garden Clearance';
    if (clean.includes('plant') || clean.includes('border') || clean.includes('bed')) return 'Planting & Borders';
    if (clean.includes('maintenance')) return 'General Maintenance';

    return 'General Maintenance';
}

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

function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Global Store
let allPortfolioItems = [];
let activeFilter = 'ALL';
let currentLightboxList = [];
let currentLightboxIndex = 0;

async function loadPortfolio() {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    const { data, error } = await supabaseClient
        .from('portfolio')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching portfolio:', error);
        grid.innerHTML = `
            <div class="portfolio-empty-state">
                <p>Unable to load portfolio. Please refresh or try again later.</p>
            </div>
        `;
        return;
    }

    allPortfolioItems = [];

    if (data && data.length > 0) {
        data.forEach(entry => {
            const cat = normalizeCategory(entry.gallery || entry.title);
            let rawItems = [];

            if (Array.isArray(entry.image_urls) && entry.image_urls.length > 0) {
                rawItems.push(...entry.image_urls);
            }
            if (entry.after_image_url) {
                rawItems.push({ url: entry.after_image_url, label: 'After' });
            }
            if (entry.before_image_url) {
                rawItems.push({ url: entry.before_image_url, label: 'Before' });
            }

            rawItems.forEach((raw, idx) => {
                const details = extractPhotoDetails(raw);
                if (details && details.url) {
                    const alreadyExists = allPortfolioItems.some(i => i.url === details.url);
                    if (!alreadyExists) {
                        allPortfolioItems.push({
                            url: details.url,
                            label: details.label,
                            category: cat,
                            title: entry.title || cat,
                            sortIndex: idx
                        });
                    }
                }
            });
        });
    }

    updateFilterCounts();
    renderGallery();
}

function updateFilterCounts() {
    const counts = {
        all: allPortfolioItems.length,
        'Lawn Cuts': allPortfolioItems.filter(i => i.category === 'Lawn Cuts').length,
        'Hedge Trimming': allPortfolioItems.filter(i => i.category === 'Hedge Trimming').length,
        'Garden Clearance': allPortfolioItems.filter(i => i.category === 'Garden Clearance').length,
        'Planting & Borders': allPortfolioItems.filter(i => i.category === 'Planting & Borders').length,
        'General Maintenance': allPortfolioItems.filter(i => i.category === 'General Maintenance').length
    };

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    set('count-all', counts.all);
    set('count-lawn', counts['Lawn Cuts']);
    set('count-hedge', counts['Hedge Trimming']);
    set('count-clearance', counts['Garden Clearance']);
    set('count-planting', counts['Planting & Borders']);
    set('count-maintenance', counts['General Maintenance']);
}

function filterPortfolio(category) {
    activeFilter = category;

    document.querySelectorAll('.filter-pill').forEach(pill => {
        if (pill.dataset.filter === category) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    renderGallery();
}
window.filterPortfolio = filterPortfolio;

function renderGallery() {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    let items = allPortfolioItems.slice();
    if (activeFilter !== 'ALL') {
        items = items.filter(i => i.category === activeFilter);
    }

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="portfolio-empty-state">
                <span class="empty-icon">🌿</span>
                <h3>No photos under "${escapeAttr(activeFilter)}" yet</h3>
                <p>New project photos will be uploaded soon. Check back shortly!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = items.map((item, index) => {
        const hasLabel = Boolean(item.label && item.label.trim() !== '');

        return `
            <div class="portfolio-card" onclick="openLightbox(${index})">
                <div class="portfolio-card-media">
                    <img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.category)}" loading="lazy">
                    ${hasLabel ? `<span class="portfolio-badge">${escapeAttr(item.label)}</span>` : ''}
                    <div class="card-glass-hover">
                        <span class="hover-view-tag">🔍 Tap to expand</span>
                    </div>
                </div>
                <div class="portfolio-card-info">
                    <span class="card-category-pill">${escapeAttr(item.category)}</span>
                    <h4>${escapeAttr(item.title)}</h4>
                </div>
            </div>
        `;
    }).join('');
}

// ── Lightbox System ──
function openLightbox(index) {
    let items = allPortfolioItems.slice();
    if (activeFilter !== 'ALL') {
        items = items.filter(i => i.category === activeFilter);
    }

    if (items.length === 0 || !items[index]) return;

    currentLightboxList = items;
    currentLightboxIndex = index;

    const modal = document.getElementById('lightbox');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        syncLightbox();
    }
}
window.openLightbox = openLightbox;

function syncLightbox() {
    const item = currentLightboxList[currentLightboxIndex];
    if (!item) return;

    const img = document.getElementById('lightbox-img');
    const badge = document.getElementById('lightbox-badge');
    const category = document.getElementById('lightbox-category');
    const title = document.getElementById('lightbox-title');
    const counter = document.getElementById('lightbox-counter');
    const bookBtn = document.getElementById('lightbox-book-btn');

    if (img) {
        img.style.opacity = '0.3';
        img.src = item.url;
        img.onload = () => { img.style.opacity = '1'; };
    }

    if (badge) {
        if (item.label && item.label.trim() !== '') {
            badge.textContent = item.label;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    if (category) category.textContent = item.category;
    if (title) title.textContent = item.title || item.category;
    if (counter) counter.textContent = `${currentLightboxIndex + 1} of ${currentLightboxList.length}`;

    if (bookBtn) {
        const encodedService = encodeURIComponent(item.category.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-'));
        bookBtn.href = `booking.html?service=${encodedService}`;
    }
}

function lightboxPrev() {
    if (currentLightboxList.length <= 1) return;
    currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxList.length) % currentLightboxList.length;
    syncLightbox();
}
window.lightboxPrev = lightboxPrev;

function lightboxNext() {
    if (currentLightboxList.length <= 1) return;
    currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxList.length;
    syncLightbox();
}
window.lightboxNext = lightboxNext;

function closeLightbox() {
    const modal = document.getElementById('lightbox');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}
window.closeLightbox = closeLightbox;

function handleLightboxClick(e) {
    if (e.target === document.getElementById('lightbox')) {
        closeLightbox();
    }
}
window.handleLightboxClick = handleLightboxClick;

// Keyboard navigation
window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('lightbox');
    if (!modal || modal.style.display === 'none') return;

    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxPrev();
    if (e.key === 'ArrowRight') lightboxNext();
});

loadPortfolio();