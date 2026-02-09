/**
 * Drawing Canvas Module with Stylus Support
 */

let canvas = null;
let ctx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = '#1B1B1B';
let currentThickness = 2;
let hasDrawn = false;
let eraserMode = false;
const ERASER_SIZE = 20;

// For smooth line drawing
let points = [];

/**
 * Initialize the drawing canvas
 * @param {Function} onDrawStart - Callback when drawing starts (to hide hint)
 */
export function initCanvas(onDrawStart) {
    canvas = document.getElementById('drawing-canvas');
    ctx = canvas.getContext('2d');

    // Set up canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Pointer events for stylus support
    canvas.addEventListener('pointerdown', (e) => handlePointerDown(e, onDrawStart));
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);

    // Prevent default touch behavior
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    // Set up drawing context
    setupContext();
}

/**
 * Resize canvas to match container size
 */
function resizeCanvas() {
    if (!canvas) return;

    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();

    // Store current drawing
    const imageData = hasDrawn ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;

    // Set canvas size
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Restore context settings
    setupContext();

    // Restore drawing if any
    if (imageData) {
        ctx.putImageData(imageData, 0, 0);
    }
}

/**
 * Set up drawing context properties
 */
function setupContext() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentThickness;
}

/**
 * Handle pointer down (start drawing)
 */
function handlePointerDown(e, onDrawStart) {
    isDrawing = true;

    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;

    points = [{ x: lastX, y: lastY }];

    // Capture pointer for this element
    canvas.setPointerCapture(e.pointerId);

    // Notify that drawing has started
    if (!hasDrawn && onDrawStart) {
        hasDrawn = true;
        onDrawStart();
    }
}

/**
 * Handle pointer move (draw)
 */
function handlePointerMove(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Get pressure (1.0 if not supported)
    const pressure = e.pressure || 0.5;

    // Adjust line width based on pressure (for stylus)
    const dynamicWidth = currentThickness * (0.5 + pressure);

    // Add point to array for smooth curves
    points.push({ x, y });

    // Draw smooth line
    drawSmoothLine(eraserMode ? ERASER_SIZE : dynamicWidth);

    lastX = x;
    lastY = y;
}

/**
 * Draw a smooth line using quadratic curves
 */
function drawSmoothLine(lineWidth) {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.globalCompositeOperation = eraserMode ? 'destination-out' : 'source-over';
    ctx.strokeStyle = eraserMode ? 'rgba(0,0,0,1)' : currentColor;
    ctx.lineWidth = lineWidth;

    // If only 2 points, draw a simple line
    if (points.length === 2) {
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
    } else {
        // Use quadratic curves for smoothness
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }

        // Last point
        const lastPoint = points[points.length - 1];
        ctx.lineTo(lastPoint.x, lastPoint.y);
    }

    ctx.stroke();

    // Keep only the last few points for continuous smoothness
    if (points.length > 3) {
        points = points.slice(-3);
    }
}

/**
 * Handle pointer up (stop drawing)
 */
function handlePointerUp(e) {
    if (!isDrawing) return;

    isDrawing = false;
    points = [];

    // Release pointer capture
    if (e.pointerId !== undefined) {
        canvas.releasePointerCapture(e.pointerId);
    }
}

/**
 * Set pen color
 * @param {string} color - Hex color code
 */
export function setColor(color) {
    currentColor = color;
    if (ctx) {
        ctx.strokeStyle = color;
    }
}

/**
 * Set pen thickness
 * @param {number} thickness - Line width in pixels
 */
export function setThickness(thickness) {
    currentThickness = thickness;
    if (ctx) {
        ctx.lineWidth = thickness;
    }
}

/**
 * Clear the canvas
 */
export function clearCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
    points = [];
}

/**
 * Check if canvas has any drawing
 * @returns {boolean}
 */
export function hasContent() {
    return hasDrawn;
}

/**
 * Get canvas as PNG blob
 * @returns {Promise<Blob>}
 */
export function getCanvasBlob() {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
}

/**
 * Get canvas as data URL
 * @returns {string}
 */
export function getCanvasDataURL() {
    return canvas.toDataURL('image/png');
}

/**
 * Get current color
 * @returns {string}
 */
export function getColor() {
    return currentColor;
}

/**
 * Get current thickness
 * @returns {number}
 */
export function getThickness() {
    return currentThickness;
}

/**
 * Set eraser mode
 * @param {boolean} enabled
 */
export function setEraserMode(enabled) {
    eraserMode = enabled;
}

/**
 * Check if eraser mode is active
 * @returns {boolean}
 */
export function isEraser() {
    return eraserMode;
}

/**
 * Reset the has drawn state (for new entries)
 */
export function resetDrawnState() {
    hasDrawn = false;
}
