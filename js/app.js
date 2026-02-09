/**
 * Main App Controller for Visitor Book PWA
 */

import { initCamera, getCurrentPhoto, setCurrentPhoto, clearPhoto, createPhotoURL, revokePhotoURL } from './camera.js';
import { initCanvas, setColor, setThickness, clearCanvas, getCanvasDataURL, hasContent, resetDrawnState, setEraserMode } from './canvas.js';
import { initDB, saveEntry, getAllEntries, blobToDataURL, dataURLToBlob, addVisitor, getAllVisitors, deleteVisitor, getVisitor, deleteAllEntries } from './storage.js';

// Screen elements
const screens = {
    splash: document.getElementById('splash-screen'),
    home: document.getElementById('home-screen'),
    photo: document.getElementById('photo-screen'),
    feedback: document.getElementById('feedback-screen'),
    thankyou: document.getElementById('thankyou-screen'),
    gallery: document.getElementById('gallery-screen'),
    browse: document.getElementById('browse-screen'),
    admin: document.getElementById('admin-screen')
};

// Current state
let currentPhotoURL = null;
let currentVisitorName = '';
let currentVisitorDesignation = '';
let selectedVisitorId = null;

// Browse state
let browseEntries = [];
let browseCurrentIndex = 0;
let browseIsAnimating = false;

// PWA install prompt
let deferredInstallPrompt = null;

/**
 * Initialize the application
 */
async function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('Service worker registered');
        } catch (error) {
            console.log('Service worker registration failed:', error);
        }
    }

    // Initialize storage
    await initDB();

    // Initialize camera
    initCamera(handlePhotoSelected);

    // Initialize canvas (will be set up when feedback screen is shown)
    initCanvas(handleDrawStart);

    // Set up event listeners
    setupEventListeners();

    // Set up PWA install button
    setupInstallButton();

    // Show splash screen, then transition to home
    showScreen('splash');
    setTimeout(() => {
        showScreen('home');
    }, 2000);

    // Allow tap to skip splash
    screens.splash.addEventListener('click', () => {
        showScreen('home');
    });
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Home screen
    document.getElementById('btn-new-feedback').addEventListener('click', async () => {
        await loadPreregisteredVisitors();
        showScreen('photo');
    });

    document.getElementById('btn-browse-feedback').addEventListener('click', () => {
        loadBrowseScreen();
        showScreen('browse');
    });

    document.getElementById('btn-admin').addEventListener('click', () => {
        loadAdminVisitors();
        showScreen('admin');
    });

    // Photo screen
    document.getElementById('btn-retake-photo').addEventListener('click', resetPhotoSelection);
    document.getElementById('btn-continue-photo').addEventListener('click', () => {
        // Get name and designation from input
        currentVisitorName = document.getElementById('photo-name-input').value.trim();
        currentVisitorDesignation = document.getElementById('photo-designation-input').value.trim();
        setupFeedbackScreen();
        showScreen('feedback');
    });
    document.getElementById('btn-back-photo').addEventListener('click', () => {
        resetPhotoSelection();
        showScreen('home');
    });

    // Feedback screen
    setupColorButtons();
    setupThicknessButtons();
    document.getElementById('btn-clear-canvas').addEventListener('click', () => {
        clearCanvas();
        document.getElementById('canvas-hint').classList.remove('hidden');
    });
    document.getElementById('btn-back-feedback').addEventListener('click', () => {
        showScreen('photo');
    });
    document.getElementById('btn-submit').addEventListener('click', handleSubmit);

    // Gallery screen
    document.getElementById('btn-back-gallery').addEventListener('click', () => {
        showScreen('home');
    });

    // Browse screen
    document.getElementById('btn-back-browse').addEventListener('click', () => {
        showScreen('home');
    });
    document.getElementById('btn-export-json').addEventListener('click', handleExportJSON);
    document.getElementById('btn-delete-all').addEventListener('click', handleDeleteAll);
    document.getElementById('btn-prev-page').addEventListener('click', () => {
        navigateBrowse('prev');
    });
    document.getElementById('btn-next-page').addEventListener('click', () => {
        navigateBrowse('next');
    });
    setupBrowseSwipe();

    // Admin screen
    document.getElementById('btn-back-admin').addEventListener('click', () => {
        resetAdminForm();
        showScreen('home');
    });
    document.getElementById('admin-photo-input').addEventListener('change', handleAdminPhotoSelect);
    document.getElementById('btn-add-visitor').addEventListener('click', handleAddVisitor);
}

/**
 * Set up PWA install button
 */
function setupInstallButton() {
    const installBtn = document.getElementById('btn-install-app');

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the default browser prompt
        e.preventDefault();
        // Save the event for later use
        deferredInstallPrompt = e;
        // Show the install button
        installBtn.classList.remove('hidden');
        installBtn.classList.add('flex');
    });

    // Handle install button click
    installBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;

        // Show the browser's install prompt
        deferredInstallPrompt.prompt();

        // Wait for user response
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log('Install prompt outcome:', outcome);

        // Clear the saved prompt (can only be used once)
        deferredInstallPrompt = null;

        // Hide the button
        installBtn.classList.add('hidden');
        installBtn.classList.remove('flex');
    });

    // Hide button if app is already installed
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        deferredInstallPrompt = null;
        installBtn.classList.add('hidden');
        installBtn.classList.remove('flex');
    });
}

/**
 * Show a specific screen
 * @param {string} screenName
 */
function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });

    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

// ============ PHOTO SCREEN ============

/**
 * Load pre-registered visitors for the photo screen
 */
async function loadPreregisteredVisitors() {
    const section = document.getElementById('preregistered-section');
    const grid = document.getElementById('preregistered-grid');

    try {
        const visitors = await getAllVisitors();

        if (visitors.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        grid.innerHTML = '';

        for (const visitor of visitors) {
            // Photo is stored as data URL string
            const photoURL = visitor.photo;
            const card = document.createElement('button');
            card.className = 'visitor-card flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-800/30 hover:bg-slate-700/50 border-2 border-transparent transition-all';
            card.dataset.visitorId = visitor.id;

            const photoHTML = photoURL
                ? `<img src="${photoURL}" alt="${visitor.name}" class="w-16 h-16 object-cover rounded-full">`
                : `<div class="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center"><svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>`;

            card.innerHTML = `
                ${photoHTML}
                <span class="text-xs text-slate-300 truncate w-full text-center">${visitor.name}</span>
                ${visitor.designation ? `<span class="text-[10px] text-slate-500 truncate w-full text-center">${visitor.designation}</span>` : ''}
            `;

            card.addEventListener('click', () => selectPreregisteredVisitor(visitor, photoURL, card));
            grid.appendChild(card);
        }
    } catch (error) {
        console.error('Error loading pre-registered visitors:', error);
        section.classList.add('hidden');
    }
}

/**
 * Select a pre-registered visitor
 */
async function selectPreregisteredVisitor(visitor, photoURL, cardElement) {
    // Deselect all cards
    document.querySelectorAll('.visitor-card').forEach(card => {
        card.classList.remove('border-indigo-500', 'bg-indigo-500/20');
        card.classList.add('border-transparent');
    });

    // Select this card
    cardElement.classList.remove('border-transparent');
    cardElement.classList.add('border-indigo-500', 'bg-indigo-500/20');

    // Convert data URL to Blob and set as current photo
    selectedVisitorId = visitor.id;
    if (visitor.photo) {
        const photoBlob = await dataURLToBlob(visitor.photo);
        setCurrentPhoto(photoBlob);

        // Update preview (use the data URL directly)
        currentPhotoURL = photoURL;

        const preview = document.getElementById('photo-preview');
        preview.src = currentPhotoURL;

        // Show preview
        document.getElementById('photo-preview-container').classList.remove('hidden');
    } else {
        clearPhoto();
        currentPhotoURL = null;
        document.getElementById('photo-preview-container').classList.add('hidden');
    }

    // Set name and designation in inputs
    document.getElementById('photo-name-input').value = visitor.name;
    document.getElementById('photo-designation-input').value = visitor.designation || '';
}

/**
 * Handle photo selection (camera or gallery)
 * @param {Blob} photoBlob
 */
function handlePhotoSelected(photoBlob) {
    // Clear any pre-registered selection
    selectedVisitorId = null;
    document.querySelectorAll('.visitor-card').forEach(card => {
        card.classList.remove('border-indigo-500', 'bg-indigo-500/20');
        card.classList.add('border-transparent');
    });

    // Revoke previous URL if exists
    if (currentPhotoURL) {
        revokePhotoURL(currentPhotoURL);
    }

    currentPhotoURL = createPhotoURL(photoBlob);

    // Update preview
    const preview = document.getElementById('photo-preview');
    preview.src = currentPhotoURL;

    // Show preview and continue button
    document.getElementById('photo-preview-container').classList.remove('hidden');
    document.getElementById('btn-continue-photo').classList.remove('hidden');
}

/**
 * Reset photo selection
 */
function resetPhotoSelection() {
    if (currentPhotoURL) {
        revokePhotoURL(currentPhotoURL);
        currentPhotoURL = null;
    }
    clearPhoto();
    selectedVisitorId = null;
    currentVisitorName = '';
    currentVisitorDesignation = '';

    // Clear name and designation inputs
    document.getElementById('photo-name-input').value = '';
    document.getElementById('photo-designation-input').value = '';

    // Reset UI
    document.getElementById('photo-preview-container').classList.add('hidden');

    // Deselect all visitor cards
    document.querySelectorAll('.visitor-card').forEach(card => {
        card.classList.remove('border-indigo-500', 'bg-indigo-500/20');
        card.classList.add('border-transparent');
    });
}

// ============ FEEDBACK SCREEN ============

/**
 * Set up the feedback screen with current photo
 */
function setupFeedbackScreen() {
    const feedbackPhoto = document.getElementById('feedback-photo');
    if (currentPhotoURL) {
        feedbackPhoto.src = currentPhotoURL;
        feedbackPhoto.classList.remove('hidden');
    } else {
        feedbackPhoto.src = '';
        feedbackPhoto.classList.add('hidden');
    }

    // Set name and designation from photo screen
    document.getElementById('visitor-name').value = currentVisitorName;
    document.getElementById('visitor-designation').value = currentVisitorDesignation;

    // Clear canvas and reset state
    clearCanvas();
    resetDrawnState();
    document.getElementById('canvas-hint').classList.remove('hidden');

    // Trigger canvas resize after screen is visible
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 100);
}

/**
 * Handle when drawing starts
 */
function handleDrawStart() {
    document.getElementById('canvas-hint').classList.add('hidden');
}

/**
 * Set up color picker buttons
 */
function setupColorButtons() {
    const colorButtons = document.querySelectorAll('.color-btn');
    const eraserBtn = document.getElementById('btn-eraser');

    colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all colors
            colorButtons.forEach(b => b.classList.remove('active'));
            // Add active to clicked
            btn.classList.add('active');
            // Deactivate eraser
            eraserBtn.classList.remove('active');
            setEraserMode(false);
            // Set color
            setColor(btn.dataset.color);
        });
    });

    // Eraser button
    eraserBtn.addEventListener('click', () => {
        const isActive = eraserBtn.classList.toggle('active');
        if (isActive) {
            // Deactivate all color buttons
            colorButtons.forEach(b => b.classList.remove('active'));
            setEraserMode(true);
        } else {
            // Re-activate the first color button as default
            colorButtons[0].classList.add('active');
            setEraserMode(false);
            setColor(colorButtons[0].dataset.color);
        }
    });
}

/**
 * Set up thickness buttons
 */
function setupThicknessButtons() {
    const thicknessButtons = document.querySelectorAll('.thickness-btn');

    thicknessButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            thicknessButtons.forEach(b => b.classList.remove('active'));
            // Add active to clicked
            btn.classList.add('active');
            // Set thickness
            setThickness(parseInt(btn.dataset.thickness));
        });
    });
}

/**
 * Handle form submission
 */
async function handleSubmit() {
    if (!hasContent()) {
        alert('Please write your feedback');
        return;
    }

    try {
        const photo = getCurrentPhoto();
        // Convert photo blob to data URL if present
        const photoDataURL = photo ? await blobToDataURL(photo) : null;
        // Get canvas as data URL
        const signatureDataURL = getCanvasDataURL();
        const name = document.getElementById('visitor-name').value.trim();
        const designation = document.getElementById('visitor-designation').value.trim();

        // Save to IndexedDB (as data URLs for browser compatibility)
        await saveEntry({
            photo: photoDataURL,
            signature: signatureDataURL,
            name: name,
            designation: designation
        });

        // Show thank you screen
        showThankYouScreen(photoDataURL, signatureDataURL);

    } catch (error) {
        console.error('Error saving entry:', error);
        alert('Failed to save. Please try again.');
    }
}

/**
 * Show the thank you screen
 * @param {string} photoDataURL
 * @param {string} signatureDataURL
 */
function showThankYouScreen(photoDataURL, signatureDataURL) {
    const thankyouPhoto = document.getElementById('thankyou-photo');
    if (photoDataURL) {
        thankyouPhoto.src = photoDataURL;
        thankyouPhoto.classList.remove('hidden');
    } else {
        thankyouPhoto.src = '';
        thankyouPhoto.classList.add('hidden');
    }
    document.getElementById('thankyou-signature').src = signatureDataURL;

    showScreen('thankyou');

    // Clean up and return to home after 3 seconds
    setTimeout(() => {
        resetPhotoSelection();
        showScreen('home');
    }, 3000);
}

// ============ GALLERY SCREEN ============

/**
 * Load and display gallery
 */
async function loadGallery() {
    const grid = document.getElementById('gallery-grid');
    const empty = document.getElementById('gallery-empty');

    try {
        const entries = await getAllEntries();

        if (entries.length === 0) {
            grid.classList.add('hidden');
            empty.classList.remove('hidden');
            empty.classList.add('flex');
            return;
        }

        grid.classList.remove('hidden');
        empty.classList.add('hidden');
        empty.classList.remove('flex');

        // Clear existing content
        grid.innerHTML = '';

        // Add entries
        for (const entry of entries) {
            const card = createGalleryCard(entry);
            grid.appendChild(card);
        }

    } catch (error) {
        console.error('Error loading gallery:', error);
    }
}

/**
 * Create a gallery card element
 * @param {Object} entry
 * @returns {HTMLElement}
 */
function createGalleryCard(entry) {
    const card = document.createElement('div');
    card.className = 'gallery-card p-4';

    // Photos are stored as data URL strings
    const photoURL = entry.photo;
    const signatureURL = entry.signature;

    // Format date
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const galleryPhotoHTML = photoURL
        ? `<img src="${photoURL}" alt="Visitor" class="w-12 h-12 rounded-full object-cover border border-slate-600">`
        : `<div class="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600"><svg class="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>`;

    card.innerHTML = `
        <div class="flex items-center gap-3 mb-3">
            ${galleryPhotoHTML}
            <div>
                <p class="text-sm font-medium text-slate-200">${entry.name || 'Anonymous'}</p>
                ${entry.designation ? `<p class="text-xs text-slate-400">${entry.designation}</p>` : ''}
                <p class="text-xs text-slate-500">${dateStr}</p>
            </div>
        </div>
        <div class="bg-slate-800/50 rounded-lg p-2">
            <img src="${signatureURL}" alt="Feedback" class="w-full h-24 object-contain">
        </div>
    `;

    return card;
}

// ============ BROWSE FEEDBACK SCREEN ============

/**
 * Load the browse screen with entries
 */
async function loadBrowseScreen() {
    const feedbackArea = document.getElementById('browse-feedback-area');
    const browseEmpty = document.getElementById('browse-empty');

    feedbackArea.innerHTML = '';

    try {
        const entries = await getAllEntries();
        browseEntries = entries;
        browseCurrentIndex = 0;
        browseIsAnimating = false;

        if (entries.length === 0) {
            browseEmpty.classList.remove('hidden');
            browseEmpty.classList.add('flex');
            document.getElementById('browse-nav').classList.add('hidden');
            document.getElementById('browse-visitor-list').innerHTML = '';
            document.getElementById('page-indicator').textContent = '0 / 0';
            return;
        }

        browseEmpty.classList.add('hidden');
        browseEmpty.classList.remove('flex');
        document.getElementById('browse-nav').classList.remove('hidden');

        // Populate the visitor list sidebar
        populateBrowseList();

        // Create initial slide
        const slide = createBrowseSlide(entries[0]);
        slide.classList.add('browse-slide-current');
        feedbackArea.appendChild(slide);

        updatePageIndicator();
        updateNavButtons();
        updateBrowseListActive();

    } catch (error) {
        console.error('Error loading browse screen:', error);
    }
}

/**
 * Create a slide element for a feedback entry (just the signature image)
 */
function createBrowseSlide(entry) {
    const slide = document.createElement('div');
    slide.className = 'browse-slide';
    slide.innerHTML = `<img src="${entry.signature}" alt="Feedback">`;
    return slide;
}

/**
 * Populate the browse visitor list sidebar
 */
function populateBrowseList() {
    const list = document.getElementById('browse-visitor-list');
    list.innerHTML = '';

    browseEntries.forEach((entry, index) => {
        const d = new Date(entry.timestamp);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const item = document.createElement('button');
        item.className = 'browse-list-item flex items-center gap-3 p-2 rounded-xl text-left transition-all shrink-0';
        item.dataset.index = index;
        const browsePhotoHTML = entry.photo
            ? `<img src="${entry.photo}" alt="" class="w-10 h-10 object-cover rounded-full shrink-0 border-2 border-transparent">`
            : `<div class="w-10 h-10 rounded-full bg-book-leatherLight/50 flex items-center justify-center shrink-0 border-2 border-transparent"><svg class="w-5 h-5 text-book-warmGray" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>`;

        item.innerHTML = `
            ${browsePhotoHTML}
            <div class="min-w-0 flex-1">
                <p class="text-sm text-book-warmLight truncate">${entry.name || 'Anonymous'}</p>
                <p class="text-[10px] text-book-warmGray truncate">${entry.designation ? entry.designation + ' · ' : ''}${dateStr}</p>
            </div>
        `;

        item.addEventListener('click', () => {
            navigateBrowseToIndex(index);
        });

        list.appendChild(item);
    });
}

/**
 * Highlight the active entry in the browse list
 */
function updateBrowseListActive() {
    const items = document.querySelectorAll('.browse-list-item');
    items.forEach((item, i) => {
        const img = item.querySelector('img');
        if (i === browseCurrentIndex) {
            item.classList.add('bg-book-goldLight/20');
            img.classList.add('border-book-goldLight');
            img.classList.remove('border-transparent');
        } else {
            item.classList.remove('bg-book-goldLight/20');
            img.classList.remove('border-book-goldLight');
            img.classList.add('border-transparent');
        }
    });

    // Scroll active item into view
    const activeItem = items[browseCurrentIndex];
    if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

/**
 * Navigate directly to a specific index
 */
function navigateBrowseToIndex(index) {
    if (browseIsAnimating || index === browseCurrentIndex || index < 0 || index >= browseEntries.length) return;

    const direction = index > browseCurrentIndex ? 'next' : 'prev';
    browseCurrentIndex = index;
    browseIsAnimating = true;

    const feedbackArea = document.getElementById('browse-feedback-area');
    const currentSlide = feedbackArea.querySelector('.browse-slide-current');
    const entry = browseEntries[index];

    const newSlide = createBrowseSlide(entry);
    newSlide.classList.add(direction === 'next' ? 'browse-slide-enter-right' : 'browse-slide-enter-left');
    feedbackArea.appendChild(newSlide);

    newSlide.offsetHeight;

    if (currentSlide) {
        currentSlide.classList.remove('browse-slide-current');
        currentSlide.classList.add(direction === 'next' ? 'browse-slide-exit-left' : 'browse-slide-exit-right');
    }
    newSlide.classList.remove(direction === 'next' ? 'browse-slide-enter-right' : 'browse-slide-enter-left');
    newSlide.classList.add('browse-slide-current');

    updatePageIndicator();
    updateNavButtons();
    updateBrowseListActive();

    const onDone = () => {
        newSlide.removeEventListener('transitionend', onDone);
        clearTimeout(safetyTimeout);
        if (currentSlide && currentSlide.parentNode) {
            currentSlide.parentNode.removeChild(currentSlide);
        }
        browseIsAnimating = false;
    };

    newSlide.addEventListener('transitionend', onDone);
    const safetyTimeout = setTimeout(onDone, 500);
}

/**
 * Set up touch/pointer swipe detection on the browse feedback area
 */
function setupBrowseSwipe() {
    const area = document.getElementById('browse-feedback-area');
    let startX = 0;
    let startY = 0;
    let tracking = false;

    area.addEventListener('pointerdown', (e) => {
        if (browseIsAnimating || browseEntries.length === 0) return;
        startX = e.clientX;
        startY = e.clientY;
        tracking = true;
        area.setPointerCapture(e.pointerId);
    });

    area.addEventListener('pointerup', (e) => {
        if (!tracking) return;
        tracking = false;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Only count horizontal swipes (more horizontal than vertical, min 50px)
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) {
                // Swipe left → next
                navigateBrowse('next');
            } else {
                // Swipe right → previous
                navigateBrowse('prev');
            }
        }
    });

    area.addEventListener('pointercancel', () => {
        tracking = false;
    });
}

/**
 * Navigate to next/prev entry with slide animation
 */
function navigateBrowse(direction) {
    if (browseIsAnimating) return;

    const feedbackArea = document.getElementById('browse-feedback-area');
    const currentSlide = feedbackArea.querySelector('.browse-slide-current');

    if (direction === 'next') {
        if (browseCurrentIndex >= browseEntries.length - 1) return;
        browseCurrentIndex++;
    } else {
        if (browseCurrentIndex <= 0) return;
        browseCurrentIndex--;
    }

    browseIsAnimating = true;
    const entry = browseEntries[browseCurrentIndex];

    // Create new slide offscreen
    const newSlide = createBrowseSlide(entry);
    newSlide.classList.add(direction === 'next' ? 'browse-slide-enter-right' : 'browse-slide-enter-left');
    feedbackArea.appendChild(newSlide);

    // Force reflow
    newSlide.offsetHeight;

    // Animate current slide out, new slide in
    if (currentSlide) {
        currentSlide.classList.remove('browse-slide-current');
        currentSlide.classList.add(direction === 'next' ? 'browse-slide-exit-left' : 'browse-slide-exit-right');
    }
    newSlide.classList.remove(direction === 'next' ? 'browse-slide-enter-right' : 'browse-slide-enter-left');
    newSlide.classList.add('browse-slide-current');

    // Update controls and list highlight immediately
    updatePageIndicator();
    updateNavButtons();
    updateBrowseListActive();

    // Clean up after animation
    const onDone = () => {
        newSlide.removeEventListener('transitionend', onDone);
        clearTimeout(safetyTimeout);
        if (currentSlide && currentSlide.parentNode) {
            currentSlide.parentNode.removeChild(currentSlide);
        }
        browseIsAnimating = false;
    };

    newSlide.addEventListener('transitionend', onDone);
    const safetyTimeout = setTimeout(onDone, 500);
}

/**
 * Update the page indicator text
 */
function updatePageIndicator() {
    const indicator = document.getElementById('page-indicator');
    if (browseEntries.length === 0) {
        indicator.textContent = '0 / 0';
    } else {
        indicator.textContent = `${browseCurrentIndex + 1} / ${browseEntries.length}`;
    }
}

/**
 * Update prev/next button disabled states
 */
function updateNavButtons() {
    document.getElementById('btn-prev-page').disabled = browseCurrentIndex <= 0;
    document.getElementById('btn-next-page').disabled = browseCurrentIndex >= browseEntries.length - 1;
}

// ============ EXPORT ============

/**
 * Export all entries as a JSON file download
 */
async function handleExportJSON() {
    try {
        const entries = await getAllEntries();

        if (entries.length === 0) {
            alert('No entries to export');
            return;
        }

        const exportData = entries.map(entry => ({
            id: entry.id,
            name: entry.name || '',
            designation: entry.designation || '',
            timestamp: entry.timestamp,
            photo: entry.photo || null,
            signature: entry.signature || null
        }));

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `visitorbook-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting entries:', error);
        alert('Failed to export entries');
    }
}

/**
 * Delete all entries after password verification
 */
async function handleDeleteAll() {
    const password = prompt('Enter password to delete all entries:');

    if (password === null) {
        // User cancelled
        return;
    }

    if (password !== '67886788') {
        alert('Incorrect password');
        return;
    }

    const confirmDelete = confirm('Are you sure you want to delete ALL entries? This cannot be undone.');

    if (!confirmDelete) {
        return;
    }

    try {
        await deleteAllEntries();
        alert('All entries deleted successfully');

        // Reload the browse screen to reflect the changes
        loadBrowseScreen();
    } catch (error) {
        console.error('Error deleting entries:', error);
        alert('Failed to delete entries');
    }
}

// ============ ADMIN SCREEN ============

let adminPhotoDataURL = null;

/**
 * Load visitors in admin screen
 */
async function loadAdminVisitors() {
    const grid = document.getElementById('admin-visitor-grid');
    const empty = document.getElementById('admin-empty');

    try {
        const visitors = await getAllVisitors();

        if (visitors.length === 0) {
            grid.classList.add('hidden');
            empty.classList.remove('hidden');
            empty.classList.add('flex');
            return;
        }

        grid.classList.remove('hidden');
        empty.classList.add('hidden');
        empty.classList.remove('flex');

        grid.innerHTML = '';

        for (const visitor of visitors) {
            const card = await createAdminVisitorCard(visitor);
            grid.appendChild(card);
        }

    } catch (error) {
        console.error('Error loading admin visitors:', error);
    }
}

/**
 * Create an admin visitor card
 */
async function createAdminVisitorCard(visitor) {
    const card = document.createElement('div');
    card.className = 'bg-slate-800/30 rounded-xl p-4 flex flex-col items-center gap-2 relative group';

    // Photo is stored as data URL string
    const photoURL = visitor.photo;
    const photoHTML = photoURL
        ? `<img src="${photoURL}" alt="${visitor.name}" class="w-20 h-20 object-cover rounded-full border-2 border-slate-600">`
        : `<div class="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-600"><svg class="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>`;

    card.innerHTML = `
        <button class="delete-visitor-btn absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" data-visitor-id="${visitor.id}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
        ${photoHTML}
        <span class="text-sm text-slate-300 text-center">${visitor.name}</span>
        ${visitor.designation ? `<span class="text-xs text-slate-500 text-center">${visitor.designation}</span>` : ''}
    `;

    // Add delete handler
    card.querySelector('.delete-visitor-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete ${visitor.name}?`)) {
            await deleteVisitor(visitor.id);
            loadAdminVisitors();
        }
    });

    return card;
}

/**
 * Handle admin photo selection
 */
function handleAdminPhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Process and resize image
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Resize
            const maxSize = 400;
            let width = img.width;
            let height = img.height;

            if (width > height && width > maxSize) {
                height = Math.round(height * (maxSize / width));
                width = maxSize;
            } else if (height > maxSize) {
                width = Math.round(width * (maxSize / height));
                height = maxSize;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Store as data URL for better IndexedDB compatibility
            adminPhotoDataURL = canvas.toDataURL('image/jpeg', 0.85);

            document.getElementById('admin-photo-placeholder').classList.add('hidden');
            const preview = document.getElementById('admin-photo-preview');
            preview.src = adminPhotoDataURL;
            preview.classList.remove('hidden');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Reset input
    event.target.value = '';
}

/**
 * Handle adding a new visitor
 */
async function handleAddVisitor() {
    const nameInput = document.getElementById('admin-name-input');
    const designationInput = document.getElementById('admin-designation-input');
    const name = nameInput.value.trim();
    const designation = designationInput.value.trim();

    if (!name) {
        alert('Please enter a name');
        return;
    }

    try {
        await addVisitor({
            photo: adminPhotoDataURL || null,
            name: name,
            designation: designation
        });

        // Reset form and reload
        resetAdminForm();
        loadAdminVisitors();

    } catch (error) {
        console.error('Error adding visitor:', error);
        alert('Failed to add visitor');
    }
}

/**
 * Reset admin form
 */
function resetAdminForm() {
    adminPhotoDataURL = null;

    document.getElementById('admin-name-input').value = '';
    document.getElementById('admin-designation-input').value = '';
    document.getElementById('admin-photo-placeholder').classList.remove('hidden');
    document.getElementById('admin-photo-preview').classList.add('hidden');
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
