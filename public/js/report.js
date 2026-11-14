/* ============================================
   LOSTLINK — Report Form Logic
   Multi-step wizard, Hick's Law Lost/Found toggle,
   1-Click Fast Found reporting, Miller's Law chunking,
   inline validation, and photo upload.
   ============================================ */

let currentStep = 1;
const totalSteps = 4;
let reportType = 'lost';
let uploadedFiles = [];
let matchedReferenceItem = null;
let fastFoundPhoto = '';

document.addEventListener('DOMContentLoaded', async () => {
  await initReportForm();
});

async function initReportForm() {
  // Check URL params FIRST if coming from "I found this" button on item detail
  const foundMatchFor = getParam('foundMatchFor');
  if (foundMatchFor) {
    const fastCard = document.getElementById('fast-found-card');
    const formCard = document.getElementById('form-card');
    const stepper = document.getElementById('report-stepper');
    const toggle = document.getElementById('report-type-toggle');
    if (stepper) stepper.style.display = 'none';
    if (toggle) toggle.style.display = 'none';
    if (formCard) formCard.style.display = 'none';
    if (fastCard) fastCard.style.display = 'block';

    let matchedItem = null;
    if (typeof LostLinkAPI !== 'undefined') {
      matchedItem = await LostLinkAPI.getItemById(foundMatchFor);
    }
    if (!matchedItem && typeof ITEMS !== 'undefined') {
      matchedItem = ITEMS.find(i => i.id === parseInt(foundMatchFor, 10));
    }

    if (matchedItem) {
      matchedReferenceItem = matchedItem;
      setupFastFoundCard(matchedItem);
    }
  }

  await populateDropdowns();
  setupTypeToggle();
  setupStepNavigation();
  setupFileUpload();
  setupTimePresets();
  setupValidationTriggers();

  // Pre-fill today's date
  const dateInput = document.getElementById('report-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

/**
 * 1-Click Fast-Track Found Card
 * Automatically triggered when user clicks "I Found This Item!" on a lost report.
 * Does NOT require filling out the 4-step wizard.
 */
function setupFastFoundCard(item) {
  const fastCard = document.getElementById('fast-found-card');
  const formCard = document.getElementById('form-card');
  const stepper = document.getElementById('report-stepper');
  const toggle = document.getElementById('report-type-toggle');

  if (!fastCard) return;

  // Hide 4-step wizard and show fast card
  if (stepper) stepper.style.display = 'none';
  if (toggle) toggle.style.display = 'none';
  if (formCard) formCard.style.display = 'none';
  fastCard.style.display = 'block';

  // Fill item summary
  const idEl = document.getElementById('ff-item-id');
  const titleEl = document.getElementById('ff-item-title');
  const ownerEl = document.getElementById('ff-item-owner');
  const locEl = document.getElementById('ff-item-loc');
  const colorEl = document.getElementById('ff-item-color');
  const imgEl = document.getElementById('ff-item-img');
  const iconEl = document.getElementById('ff-item-icon');

  if (idEl) idEl.textContent = item.id;
  if (titleEl) titleEl.textContent = item.title;
  if (ownerEl) ownerEl.textContent = item.user ? item.user.name : 'SRM Student';
  if (locEl) locEl.textContent = item.location;
  if (colorEl) colorEl.textContent = item.color || 'Unspecified';

  if (imgEl && iconEl) {
    if (item.image && item.image.trim() !== '') {
      imgEl.src = item.image;
      imgEl.style.display = 'block';
      iconEl.style.display = 'none';
    } else {
      imgEl.style.display = 'none';
      iconEl.style.display = 'block';
      iconEl.setAttribute('data-lucide', getCategoryIcon(item.category));
    }
  }

  // Populate Fast Found Locations Dropdown (20 SRM Locations)
  const ffLocSelect = document.getElementById('ff-location');
  if (ffLocSelect) {
    ffLocSelect.innerHTML = '';
    const locList = (typeof LOCATIONS !== 'undefined') ? LOCATIONS : [item.location];
    locList.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc;
      opt.textContent = loc;
      if (loc.toLowerCase() === (item.location || '').toLowerCase()) {
        opt.selected = true;
      }
      ffLocSelect.appendChild(opt);
    });
  }

  // Pre-fill friendly message to owner
  const noteEl = document.getElementById('ff-note');
  if (noteEl) {
    const ownerName = item.user ? item.user.name.split(' ')[0] : 'there';
    noteEl.value = `Hi ${ownerName}, I found your ${item.title} at ${item.location}! It's safe with me. Let's coordinate where to meet on campus to return it.`;
  }

  // Photo upload in fast-found card
  const ffDrop = document.getElementById('ff-drop-zone');
  const ffFileInput = document.getElementById('ff-file-input');
  const ffPreview = document.getElementById('ff-photo-preview');
  const ffImg = document.getElementById('ff-photo-img');
  const ffRemove = document.getElementById('ff-photo-remove');

  const processFastPhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Invalid File', 'Please select an image file (PNG, JPG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      fastFoundPhoto = evt.target.result;
      if (ffImg) ffImg.src = fastFoundPhoto;
      if (ffPreview) ffPreview.style.display = 'flex';
      showToast('success', 'Photo Attached', 'Found item photo attached successfully.');
    };
    reader.readAsDataURL(file);
  };

  if (ffDrop && ffFileInput) {
    ffDrop.addEventListener('click', () => ffFileInput.click());
    ffDrop.addEventListener('dragover', (e) => { e.preventDefault(); ffDrop.classList.add('dragover'); });
    ['dragleave', 'dragend'].forEach(t => ffDrop.addEventListener(t, () => ffDrop.classList.remove('dragover')));
    ffDrop.addEventListener('drop', (e) => {
      e.preventDefault();
      ffDrop.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFastPhoto(e.dataTransfer.files[0]);
      }
    });
    ffFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processFastPhoto(e.target.files[0]);
      }
    });
  }

  if (ffRemove) {
    ffRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      fastFoundPhoto = '';
      if (ffFileInput) ffFileInput.value = '';
      if (ffPreview) ffPreview.style.display = 'none';
      showToast('info', 'Photo Removed', 'Attached photo was removed.');
    });
  }

  // Fast Found Form Submit
  const ffForm = document.getElementById('fast-found-form');
  if (ffForm) {
    ffForm.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-ff-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Confirming & Opening Inbox...';
      }

      const selectedLoc = ffLocSelect ? ffLocSelect.value : item.location;
      const noteText = noteEl ? noteEl.value : '';

      try {
        let result = null;
        if (typeof LostLinkAPI !== 'undefined' && LostLinkAPI.quickReportFound) {
          result = await LostLinkAPI.quickReportFound(item.id, {
            location: selectedLoc,
            note: noteText,
            image: fastFoundPhoto
          });
        }

        showToast('success', 'Found Report Submitted!', `Matched with "${item.title}". Opening handover chat...`);

        setTimeout(() => {
          const redirectUrl = (result && result.redirectUrl) ? result.redirectUrl : `inbox.html?itemId=${item.id}`;
          window.location.href = redirectUrl;
        }, 800);
      } catch (err) {
        console.error('Fast Found error:', err);
        showToast('error', 'Submission Error', 'Failed to submit found report. Please try again.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i data-lucide="send"></i> Confirm Found & Open Direct Chat with Owner';
        }
      }
    };
  }

  // Allow switching to full form if user explicitly wants
  const toggleBtn = document.getElementById('btn-toggle-full-wizard');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      fastCard.style.display = 'none';
      if (stepper) stepper.style.display = 'flex';
      if (toggle) toggle.style.display = 'flex';
      if (formCard) formCard.style.display = 'block';
      prefillFullForm(item);
      showToast('info', 'Standard Wizard Active', 'Form fields pre-filled from the lost report.');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Pre-fills the 4-step wizard if user switches from fast mode to full wizard
 */
function prefillFullForm(matchedItem) {
  setReportType('found');

  // Populate Step 1 (Basics)
  const catSelect = document.getElementById('report-category');
  if (catSelect) catSelect.value = matchedItem.category;
  const titleInput = document.getElementById('report-title');
  if (titleInput) titleInput.value = `Found: ${matchedItem.title}`;
  const colorSelect = document.getElementById('report-color');
  if (colorSelect) colorSelect.value = matchedItem.color;

  // Populate Step 2 (Details)
  const descInput = document.getElementById('report-description');
  if (descInput) {
    descInput.value = `Found item matching lost report #${matchedItem.id} (${matchedItem.title}) at ${matchedItem.location}. In safe custody on campus.`;
  }

  // Populate Step 3 (Location & Time)
  const locSelect = document.getElementById('report-location');
  if (locSelect) locSelect.value = matchedItem.location;

  const hourSel = document.getElementById('report-time-hour');
  const minSel = document.getElementById('report-time-min');
  const ampmSel = document.getElementById('report-time-ampm');
  const timeInput = document.getElementById('report-time');
  const now = new Date();
  let h = now.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12 || 12;
  let m = Math.round(now.getMinutes() / 5) * 5;
  if (m === 60) { m = 0; h12 = (h12 % 12) + 1; }
  const mStr = String(m).padStart(2, '0');
  if (hourSel) hourSel.value = String(h12);
  if (minSel) minSel.value = mStr;
  if (ampmSel) ampmSel.value = ap;
  if (timeInput) timeInput.value = String(h).padStart(2, '0') + ':' + mStr;
}

async function populateDropdowns() {
  // Category dropdown
  const catSelect = document.getElementById('report-category');
  if (catSelect && catSelect.options.length <= 1) {
    const cats = typeof CATEGORIES !== 'undefined' ? CATEGORIES : [];
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.count} in database)`;
      catSelect.appendChild(opt);
    });
  }

  // Colors dropdown
  const colorSelect = document.getElementById('report-color');
  if (colorSelect && colorSelect.options.length <= 1) {
    const colors = typeof COLORS !== 'undefined' ? COLORS : ['Black', 'White', 'Blue', 'Red', 'Silver'];
    colors.forEach(col => {
      const opt = document.createElement('option');
      opt.value = col;
      opt.textContent = col;
      colorSelect.appendChild(opt);
    });
  }

  // Locations dropdown (The 20 SRM Locations)
  const locSelect = document.getElementById('report-location');
  if (locSelect && locSelect.options.length <= 1) {
    let locs = typeof LOCATIONS !== 'undefined' ? LOCATIONS : [];
    if (typeof LostLinkAPI !== 'undefined' && LostLinkAPI.getLocations) {
      try {
        const fetched = await LostLinkAPI.getLocations();
        if (fetched && fetched.length > 0) locs = fetched;
      } catch (e) {}
    }
    locs.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc;
      opt.textContent = loc;
      locSelect.appendChild(opt);
    });
  }
}

function setupTypeToggle() {
  const toggle = document.getElementById('report-type-toggle');
  if (!toggle) return;

  toggle.querySelectorAll('.toggle-pill-option').forEach(btn => {
    btn.addEventListener('click', () => {
      setReportType(btn.dataset.type);
    });
  });
}

function setReportType(type) {
  reportType = type;
  const toggle = document.getElementById('report-type-toggle');
  if (!toggle) return;

  toggle.querySelectorAll('.toggle-pill-option').forEach(btn => {
    const isSelected = btn.dataset.type === type;
    btn.classList.toggle('active', isSelected);
    btn.setAttribute('aria-selected', isSelected);
  });

  const revType = document.getElementById('rev-type');
  if (revType) {
    revType.textContent = type === 'lost' ? 'Lost Item' : 'Found Item';
  }
}

function setupStepNavigation() {
  const btnNext = document.getElementById('btn-next');
  const btnBack = document.getElementById('btn-back');
  const form = document.getElementById('report-multi-form');

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (validateCurrentStep()) {
        if (currentStep < totalSteps) {
          goToStep(currentStep + 1);
        }
      }
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (currentStep > 1) {
        goToStep(currentStep - 1);
      }
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (validateCurrentStep()) {
        submitReportForm();
      }
    });
  }
}

function goToStep(step) {
  currentStep = step;

  // Show corresponding step container
  document.querySelectorAll('.report-form-step').forEach((el, idx) => {
    el.classList.toggle('active', idx + 1 === step);
  });

  // Update Stepper circles & labels
  const stepper = document.getElementById('report-stepper');
  if (stepper) {
    const stepEls = stepper.querySelectorAll('.step');
    stepEls.forEach((el, idx) => {
      const stepNum = idx + 1;
      el.classList.remove('active', 'completed');
      if (stepNum < step) {
        el.classList.add('completed');
        el.querySelector('.step-circle').innerHTML = '<i data-lucide="check" style="width:16px;height:16px;"></i>';
      } else if (stepNum === step) {
        el.classList.add('active');
        el.querySelector('.step-circle').textContent = stepNum;
      } else {
        el.querySelector('.step-circle').textContent = stepNum;
      }
    });

    const connectors = stepper.querySelectorAll('.step-connector');
    connectors.forEach((conn, idx) => {
      conn.classList.toggle('completed', idx + 1 < step);
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Button visibility
  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');
  const btnSubmit = document.getElementById('btn-submit');

  if (btnBack) btnBack.style.visibility = step === 1 ? 'hidden' : 'visible';

  if (step === totalSteps) {
    if (btnNext) btnNext.style.display = 'none';
    if (btnSubmit) btnSubmit.style.display = 'inline-flex';
    populateReviewStep();
  } else {
    if (btnNext) btnNext.style.display = 'inline-flex';
    if (btnSubmit) btnSubmit.style.display = 'none';
  }

  window.scrollTo({ top: 120, behavior: 'smooth' });
}

function validateCurrentStep() {
  let valid = true;

  if (currentStep === 1) {
    const cat = document.getElementById('report-category');
    const title = document.getElementById('report-title');
    const color = document.getElementById('report-color');

    const errCat = document.getElementById('err-category');
    const errTitle = document.getElementById('err-title');
    const errColor = document.getElementById('err-color');

    if (!cat.value) {
      cat.classList.add('input-error');
      if (errCat) errCat.style.display = 'flex';
      valid = false;
    } else {
      cat.classList.remove('input-error');
      if (errCat) errCat.style.display = 'none';
    }

    if (!title.value.trim() || title.value.trim().length < 3) {
      title.classList.add('input-error');
      if (errTitle) errTitle.style.display = 'flex';
      valid = false;
    } else {
      title.classList.remove('input-error');
      if (errTitle) errTitle.style.display = 'none';
    }

    if (!color.value) {
      color.classList.add('input-error');
      if (errColor) errColor.style.display = 'flex';
      valid = false;
    } else {
      color.classList.remove('input-error');
      if (errColor) errColor.style.display = 'none';
    }
  }

  if (currentStep === 2) {
    const desc = document.getElementById('report-description');
    const errDesc = document.getElementById('err-desc');

    if (!desc.value.trim() || desc.value.trim().length < 15) {
      desc.classList.add('input-error');
      if (errDesc) errDesc.style.display = 'flex';
      valid = false;
    } else {
      desc.classList.remove('input-error');
      if (errDesc) errDesc.style.display = 'none';
    }
  }

  if (currentStep === 3) {
    const loc = document.getElementById('report-location');
    const date = document.getElementById('report-date');
    const errLoc = document.getElementById('err-location');
    const errDate = document.getElementById('err-date');

    if (!loc.value) {
      loc.classList.add('input-error');
      if (errLoc) errLoc.style.display = 'flex';
      valid = false;
    } else {
      loc.classList.remove('input-error');
      if (errLoc) errLoc.style.display = 'none';
    }

    if (!date.value) {
      date.classList.add('input-error');
      if (errDate) errDate.style.display = 'flex';
      valid = false;
    } else {
      date.classList.remove('input-error');
      if (errDate) errDate.style.display = 'none';
    }
  }

  if (!valid) {
    showToast('error', 'Incomplete Step', 'Please fill out all required fields before proceeding.');
  }

  return valid;
}

function setupValidationTriggers() {
  const inputs = ['report-category', 'report-title', 'report-color', 'report-description', 'report-location', 'report-date'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.classList.remove('input-error');
      const errEl = document.getElementById(`err-${id.replace('report-', '')}`);
      if (errEl) errEl.style.display = 'none';
    });
  });
}

function setupFileUpload() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const previewList = document.getElementById('preview-list');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  ['dragleave', 'dragend'].forEach(type => {
    dropZone.addEventListener(type, () => dropZone.classList.remove('dragover'));
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  });
}

function handleFiles(files) {
  const previewList = document.getElementById('preview-list');
  if (!previewList) return;

  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Invalid File', `${file.name} is not an image.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'File Too Large', `${file.name} exceeds 5MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      uploadedFiles.push(dataUrl);

      const itemDiv = document.createElement('div');
      itemDiv.className = 'file-preview-item';
      itemDiv.innerHTML = `
        <img src="${dataUrl}" alt="${file.name}">
        <div class="file-name">${file.name}</div>
        <button type="button" class="btn-remove" aria-label="Remove image">&times;</button>
      `;

      itemDiv.querySelector('.btn-remove').addEventListener('click', () => {
        const idx = uploadedFiles.indexOf(dataUrl);
        if (idx !== -1) uploadedFiles.splice(idx, 1);
        itemDiv.remove();
      });

      previewList.appendChild(itemDiv);
    };
    reader.readAsDataURL(file);
  });
}

function setupTimePresets() {
  const container = document.getElementById('time-presets-container');
  const timeInput = document.getElementById('report-time');
  const hourSel = document.getElementById('report-time-hour');
  const minSel = document.getElementById('report-time-min');
  const ampmSel = document.getElementById('report-time-ampm');
  const displayBadge = document.getElementById('time-display-badge');
  const displayText = document.getElementById('time-display-text');
  const clearBtn = document.getElementById('btn-clear-time');

  // Populate hour select (1–12) if empty
  if (hourSel && hourSel.options.length <= 1) {
    for (let h = 1; h <= 12; h++) {
      const opt = document.createElement('option');
      opt.value = String(h);
      opt.textContent = String(h).padStart(2, '0');
      hourSel.appendChild(opt);
    }
  }

  function updateDisplayUI(timeVal) {
    if (timeVal) {
      if (displayBadge) displayBadge.style.display = 'inline-flex';
      if (displayText) displayText.textContent = `Time: ${formatTime(timeVal)}`;
      if (clearBtn) clearBtn.style.display = 'inline-block';
    } else {
      if (displayBadge) displayBadge.style.display = 'none';
      if (clearBtn) clearBtn.style.display = 'none';
    }
  }

  function syncTimeFromSelects() {
    if (!hourSel || !minSel || !ampmSel || !timeInput) return;
    const h = hourSel.value;
    let m = minSel.value;
    const ap = ampmSel.value || 'AM';

    if (!h) { 
      timeInput.value = ''; 
      updateDisplayUI('');
      return; 
    }

    if (!m) {
      m = '00';
      minSel.value = '00';
    }

    let hour24 = parseInt(h, 10);
    if (ap === 'PM' && hour24 !== 12) hour24 += 12;
    if (ap === 'AM' && hour24 === 12) hour24 = 0;
    const finalTime = String(hour24).padStart(2, '0') + ':' + m;
    timeInput.value = finalTime;
    updateDisplayUI(finalTime);
  }

  if (hourSel) hourSel.addEventListener('change', syncTimeFromSelects);
  if (minSel) minSel.addEventListener('change', syncTimeFromSelects);
  if (ampmSel) ampmSel.addEventListener('change', syncTimeFromSelects);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (timeInput) timeInput.value = '';
      if (hourSel) hourSel.value = '';
      if (minSel) minSel.value = '';
      if (ampmSel) ampmSel.value = 'AM';
      if (container) {
        container.querySelectorAll('.time-preset-pill').forEach(b => b.classList.remove('active'));
      }
      updateDisplayUI('');
      showToast('info', 'Time Cleared', 'Approximate time has been reset.');
    });
  }

  if (!container) return;

  container.querySelectorAll('.time-preset-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.time-preset-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const preset = btn.dataset.preset;
      const now = new Date();
      let targetHour = 12;
      let targetMin = 0;
      let targetAp = 'PM';

      if (preset === 'morning') {
        targetHour = 9; targetMin = 0; targetAp = 'AM';
      } else if (preset === 'afternoon') {
        targetHour = 2; targetMin = 0; targetAp = 'PM';
      } else if (preset === 'evening') {
        targetHour = 5; targetMin = 30; targetAp = 'PM';
      } else if (preset === 'just-now') {
        let h = now.getHours();
        targetAp = h >= 12 ? 'PM' : 'AM';
        targetHour = h % 12 || 12;
        targetMin = Math.round(now.getMinutes() / 5) * 5;
        if (targetMin === 60) { targetMin = 0; targetHour = (targetHour % 12) + 1; }
      }

      if (hourSel) hourSel.value = String(targetHour);
      if (minSel) minSel.value = String(targetMin).padStart(2, '0');
      if (ampmSel) ampmSel.value = targetAp;

      let h24 = targetHour;
      if (targetAp === 'PM' && h24 !== 12) h24 += 12;
      if (targetAp === 'AM' && h24 === 12) h24 = 0;
      const timeVal = String(h24).padStart(2, '0') + ':' + String(targetMin).padStart(2, '0');

      if (timeInput) timeInput.value = timeVal;
      updateDisplayUI(timeVal);

      showToast('info', 'Time Selected', `Approximate time set to ${formatTime(timeVal)}`);
    });
  });
}

function populateReviewStep() {
  const cat = document.getElementById('report-category').value;
  const title = document.getElementById('report-title').value;
  const color = document.getElementById('report-color').value;
  const loc = document.getElementById('report-location').value;
  const date = document.getElementById('report-date').value;
  const time = document.getElementById('report-time').value;
  const desc = document.getElementById('report-description').value;

  const catObj = (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).find(c => c.id === cat);

  document.getElementById('rev-type').textContent = reportType === 'lost' ? 'Lost Item' : 'Found Item';
  document.getElementById('rev-category').textContent = catObj ? catObj.name : cat;
  document.getElementById('rev-title').textContent = title || '—';
  document.getElementById('rev-color').textContent = color || '—';
  document.getElementById('rev-location').textContent = loc || '—';
  document.getElementById('rev-datetime').textContent = `${formatDate(date)}${time ? ' at ' + formatTime(time) : ''}`;
  document.getElementById('rev-desc').textContent = desc || '—';
}

async function submitReportForm() {
  const btnSubmit = document.getElementById('btn-submit');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner"></span> Submitting Report...';
  }

  const title = document.getElementById('report-title').value;
  const category = document.getElementById('report-category').value;
  const color = document.getElementById('report-color').value;
  const location = document.getElementById('report-location').value;
  const date = document.getElementById('report-date').value;
  const time = document.getElementById('report-time').value;
  const description = document.getElementById('report-description').value;

  // Strictly user-uploaded photos only — no random fallback SVGs
  const primaryImage = uploadedFiles.length > 0 ? uploadedFiles[0] : '';
  const allImages = uploadedFiles.length > 0 ? [...uploadedFiles] : [];

  let createdItem = null;
  const currentUser = (typeof LostLinkAPI !== 'undefined') ? LostLinkAPI.getCurrentUser() : null;

  if (typeof LostLinkAPI !== 'undefined') {
    createdItem = await LostLinkAPI.createItem({
      type: reportType,
      title: title,
      category: category,
      color: color,
      description: description,
      location: location,
      date: date,
      time: time || '12:00',
      image: primaryImage,
      images: allImages,
      userEmail: currentUser ? currentUser.email : '',
      foundMatchFor: matchedReferenceItem ? matchedReferenceItem.id : null
    });
  } else {
    const newId = (typeof ITEMS !== 'undefined' ? ITEMS.length : 0) + 1;
    const author = currentUser
      ? { name: currentUser.name, avatar: currentUser.avatar, email: currentUser.email }
      : { name: 'SRM Student', avatar: 'ST', email: '' };

    createdItem = {
      id: newId,
      type: reportType,
      status: matchedReferenceItem ? 'matched' : 'reported',
      title: title,
      category: category,
      color: color,
      description: description,
      location: location,
      date: date,
      time: time || '12:00',
      image: primaryImage,
      images: allImages,
      user: author,
      postedAt: 'Just now'
    };

    if (typeof ITEMS !== 'undefined') {
      ITEMS.unshift(createdItem);
    }
  }

  showToast('success', 'Report Published!', 'Your report is now live on the SRMIST campus board.');

  setTimeout(() => {
    if (matchedReferenceItem) {
      window.location.href = `inbox.html?itemId=${matchedReferenceItem.id}`;
    } else {
      window.location.href = `matches.html?reportId=${createdItem ? createdItem.id : 1}`;
    }
  }, 1000);
}
