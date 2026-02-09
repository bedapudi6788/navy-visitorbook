/**
 * Camera/Photo Module for Visitor Book
 */

let currentPhotoBlob = null;

/**
 * Initialize camera inputs
 * @param {Function} onPhotoSelected - Callback when photo is selected
 */
export function initCamera(onPhotoSelected) {
    const cameraInput = document.getElementById('camera-input');
    const galleryInput = document.getElementById('gallery-input');

    const handleFile = async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                const processedBlob = await processImage(file);
                currentPhotoBlob = processedBlob;
                onPhotoSelected(processedBlob);
            } catch (error) {
                console.error('Error processing image:', error);
            }
        }
        // Reset input so same file can be selected again
        event.target.value = '';
    };

    cameraInput.addEventListener('change', handleFile);
    galleryInput.addEventListener('change', handleFile);
}

/**
 * Process and resize image for optimal storage
 * @param {File} file - The image file
 * @returns {Promise<Blob>} - Processed image blob
 */
async function processImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target.result;
        };

        img.onload = () => {
            // Target size for profile photo
            const maxSize = 400;
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions maintaining aspect ratio
            if (width > height) {
                if (width > maxSize) {
                    height = Math.round(height * (maxSize / width));
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = Math.round(width * (maxSize / height));
                    height = maxSize;
                }
            }

            // Create canvas and resize
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                },
                'image/jpeg',
                0.85
            );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        reader.onerror = () => reject(new Error('Failed to read file'));

        reader.readAsDataURL(file);
    });
}

/**
 * Get the current photo blob
 * @returns {Blob|null}
 */
export function getCurrentPhoto() {
    return currentPhotoBlob;
}

/**
 * Clear the current photo
 */
export function clearPhoto() {
    currentPhotoBlob = null;
}

/**
 * Set the current photo (for pre-registered visitors)
 * @param {Blob} blob
 */
export function setCurrentPhoto(blob) {
    currentPhotoBlob = blob;
}

/**
 * Create object URL for displaying blob
 * @param {Blob} blob
 * @returns {string}
 */
export function createPhotoURL(blob) {
    return URL.createObjectURL(blob);
}

/**
 * Revoke object URL to free memory
 * @param {string} url
 */
export function revokePhotoURL(url) {
    URL.revokeObjectURL(url);
}
