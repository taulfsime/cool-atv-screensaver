// app state
const state = {
  tempId: null,
  blur: window.APP_CONFIG.defaults.blur,
  scale: window.APP_CONFIG.defaults.scale,
  debounceTimer: null,
};

// dom elements
const elements = {
  // sections
  uploadSection: document.getElementById('upload-section'),
  previewSection: document.getElementById('preview-section'),
  successSection: document.getElementById('success-section'),

  // upload
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  uploadError: document.getElementById('upload-error'),

  // preview
  previewImage: document.getElementById('preview-image'),
  previewLoading: document.getElementById('preview-loading'),
  previewError: document.getElementById('preview-error'),
  blurSlider: document.getElementById('blur-slider'),
  blurValue: document.getElementById('blur-value'),
  scaleSlider: document.getElementById('scale-slider'),
  scaleValue: document.getElementById('scale-value'),
  saveBtn: document.getElementById('save-btn'),
  resetBtn: document.getElementById('reset-btn'),

  // success
  successFilename: document.getElementById('success-filename'),
  uploadAnotherBtn: document.getElementById('upload-another-btn'),
};

// load saved settings from localStorage
function loadSettings() {
  try {
    const saved = localStorage.getItem('cool-atv-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      state.blur = clamp(settings.blur, window.APP_CONFIG.limits.blur);
      state.scale = clamp(settings.scale, window.APP_CONFIG.limits.scale);
      elements.blurSlider.value = state.blur;
      elements.scaleSlider.value = state.scale;
      updateSliderDisplays();
    }
  } catch (e) {
    // ignore invalid saved settings
  }
}

// save settings to localStorage
function saveSettings() {
  try {
    localStorage.setItem('cool-atv-settings', JSON.stringify({
      blur: state.blur,
      scale: state.scale,
    }));
  } catch (e) {
    // ignore storage errors
  }
}

// clamp value to limits
function clamp(value, limits) {
  return Math.max(limits.min, Math.min(limits.max, value));
}

// update slider display values
function updateSliderDisplays() {
  elements.blurValue.textContent = state.blur;
  elements.scaleValue.textContent = `${state.scale}%`;
}

// show section
function showSection(section) {
  elements.uploadSection.hidden = section !== 'upload';
  elements.previewSection.hidden = section !== 'preview';
  elements.successSection.hidden = section !== 'success';
}

// show error
function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

// hide error
function hideError(element) {
  element.hidden = true;
}

// upload file
async function uploadFile(file) {
  hideError(elements.uploadError);

  // client-side validation
  if (!file) {
    showError(elements.uploadError, 'No file selected');
    return;
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|heic|heif)$/i)) {
    showError(elements.uploadError, 'Invalid file type. Please use JPG, PNG, or HEIC');
    return;
  }

  const maxSize = 25 * 1024 * 1024;
  if (file.size > maxSize) {
    showError(elements.uploadError, 'File too large. Maximum size is 25MB');
    return;
  }

  // show loading state
  elements.dropZone.setAttribute('aria-busy', 'true');
  elements.dropZone.style.pointerEvents = 'none';

  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    // store temp ID and show preview
    state.tempId = data.tempId;
    elements.previewImage.src = data.preview;

    // apply saved settings if different from defaults
    if (state.blur !== data.defaults.blur || state.scale !== data.defaults.scale) {
      // request preview with saved settings
      requestPreview();
    }

    showSection('preview');
  } catch (error) {
    showError(elements.uploadError, error.message);
  } finally {
    elements.dropZone.removeAttribute('aria-busy');
    elements.dropZone.style.pointerEvents = '';
  }
}

// request preview with current settings (debounced)
function requestPreviewDebounced() {
  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(requestPreview, window.APP_CONFIG.previewDebounceMs);
}

// request preview with current settings
async function requestPreview() {
  if (!state.tempId) return;

  hideError(elements.previewError);
  elements.previewLoading.hidden = false;

  try {
    const response = await fetch('/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tempId: state.tempId,
        blur: state.blur,
        scale: state.scale,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Preview failed');
    }

    elements.previewImage.src = data.preview;
    saveSettings();
  } catch (error) {
    showError(elements.previewError, error.message);
  } finally {
    elements.previewLoading.hidden = true;
  }
}

// save image
async function saveImage() {
  if (!state.tempId) return;

  hideError(elements.previewError);
  elements.saveBtn.disabled = true;
  elements.saveBtn.setAttribute('aria-busy', 'true');

  try {
    const response = await fetch('/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tempId: state.tempId,
        blur: state.blur,
        scale: state.scale,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Save failed');
    }

    // show success
    elements.successFilename.textContent = data.filename;
    state.tempId = null;
    showSection('success');
  } catch (error) {
    showError(elements.previewError, error.message);
  } finally {
    elements.saveBtn.disabled = false;
    elements.saveBtn.removeAttribute('aria-busy');
  }
}

// reset to upload state
function reset() {
  state.tempId = null;
  elements.fileInput.value = '';
  elements.previewImage.src = '';
  hideError(elements.uploadError);
  hideError(elements.previewError);
  showSection('upload');
}

// event listeners

// drop zone click
elements.dropZone.addEventListener('click', () => {
  elements.fileInput.click();
});

// drop zone keyboard
elements.dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    elements.fileInput.click();
  }
});

// file input change
elements.fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    uploadFile(file);
  }
});

// drag and drop
elements.dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  elements.dropZone.classList.add('drag-over');
});

elements.dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  elements.dropZone.classList.remove('drag-over');
});

elements.dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  elements.dropZone.classList.remove('drag-over');

  const file = e.dataTransfer.files[0];
  if (file) {
    uploadFile(file);
  }
});

// sliders
elements.blurSlider.addEventListener('input', (e) => {
  state.blur = parseInt(e.target.value, 10);
  updateSliderDisplays();
  requestPreviewDebounced();
});

elements.scaleSlider.addEventListener('input', (e) => {
  state.scale = parseInt(e.target.value, 10);
  updateSliderDisplays();
  requestPreviewDebounced();
});

// buttons
elements.saveBtn.addEventListener('click', saveImage);
elements.resetBtn.addEventListener('click', reset);
elements.uploadAnotherBtn.addEventListener('click', reset);

// initialize
loadSettings();
updateSliderDisplays();
