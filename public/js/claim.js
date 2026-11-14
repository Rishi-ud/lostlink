/* ============================================
   LOSTLINK — Claim & Verification Logic
   Ownership quiz, registration ID validation,
   timeline progression, and collection pass reveal.
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await initClaimPage();
});

let targetItem = null;

async function initClaimPage() {
  const itemIdParam = getParam('id');
  const itemId = itemIdParam ? parseInt(itemIdParam, 10) : 0;

  if (itemId && typeof LostLinkAPI !== 'undefined') {
    targetItem = await LostLinkAPI.getItemById(itemId);
  }
  if (!targetItem && typeof ITEMS !== 'undefined' && ITEMS.length > 0) {
    targetItem = ITEMS.find(i => i.id === itemId) || ITEMS.find(i => i.type === 'found');
  }

  if (!targetItem) {
    const claimPage = document.querySelector('.claim-page');
    if (claimPage) {
      claimPage.innerHTML = `
        <div class="card" style="padding:var(--space-12); text-align:center; max-width:600px; margin:0 auto;">
          <div class="empty-state-icon" style="margin:0 auto var(--space-4);"><i data-lucide="help-circle"></i></div>
          <h2>Item Not Found</h2>
          <p class="text-secondary" style="margin-top:var(--space-2); margin-bottom:var(--space-6);">
            The item you are attempting to claim does not exist or may have already been collected.
          </p>
          <a href="browse.html" class="btn btn-primary"><i data-lucide="search"></i> Browse Campus Items</a>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    return;
  }

  // Pre-fill reg no if user is logged in
  const currentUser = (typeof LostLinkAPI !== 'undefined') ? LostLinkAPI.getCurrentUser() : null;
  const regInput = document.getElementById('claim-reg-no');
  if (currentUser && currentUser.regNo && regInput) {
    regInput.value = currentUser.regNo;
  }

  // Populate Item Summary Card
  const imgEl = document.getElementById('claim-item-img');
  const titleEl = document.getElementById('claim-item-title');
  const locEl = document.querySelector('#claim-item-loc span');
  const dateEl = document.querySelector('#claim-item-date span');

  const hasRealPhoto = targetItem.image && targetItem.image.trim() !== '' && !targetItem.image.includes('assets/images/items/item');
  if (imgEl) {
    if (hasRealPhoto) {
      imgEl.src = targetItem.image;
      imgEl.alt = targetItem.title;
      imgEl.style.display = 'block';
    } else {
      imgEl.style.display = 'none';
      const container = imgEl.parentElement;
      if (container && !container.querySelector('.item-thumb-no-photo')) {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'item-thumb-no-photo';
        iconDiv.innerHTML = `<i data-lucide="${getCategoryIcon ? getCategoryIcon(targetItem.category) : 'package'}"></i>`;
        container.insertBefore(iconDiv, imgEl);
      }
    }
  }
  if (titleEl) titleEl.textContent = targetItem.title;
  if (locEl) locEl.textContent = targetItem.location;
  if (dateEl) dateEl.textContent = formatDate(targetItem.date);

  // Render Verification Questions
  renderQuestions(targetItem.id);

  // Form submit listener
  const form = document.getElementById('claim-form');
  if (form) {
    form.addEventListener('submit', handleClaimSubmit);
  }
}

function renderQuestions(itemId) {
  const container = document.getElementById('dynamic-questions');
  if (!container) return;

  const defaultQuestions = [
    { id: 'q1', question: 'Describe any specific brand markings, internal labels, or scratches on this item.', type: 'textarea' },
    { id: 'q2', question: 'What items or contents were kept inside or with this item?', type: 'textarea' },
    { id: 'q3', question: 'What date and time did you approximate losing this item?', type: 'text' }
  ];

  const questions = VERIFICATION_QUESTIONS[itemId] || defaultQuestions;

  container.innerHTML = questions.map((q, idx) => `
    <div class="verification-question card" style="margin-bottom:var(--space-5);">
      <h4 style="font-size:var(--text-sm); font-weight:var(--weight-semibold); color:var(--text-heading); margin-bottom:var(--space-2);">
        Question ${idx + 1}: ${q.question} <span class="required" style="color:var(--error);">*</span>
      </h4>
      ${q.type === 'textarea' 
        ? `<textarea class="input quiz-input" id="${q.id}" rows="3" placeholder="Provide as much verifiable detail as possible..." required></textarea>`
        : `<input type="text" class="input quiz-input" id="${q.id}" placeholder="Your answer..." required>`
      }
      <span class="form-error" id="err-${q.id}" style="display:none; margin-top:4px;"><i data-lucide="alert-circle"></i> Please answer this question.</span>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function handleClaimSubmit(e) {
  e.preventDefault();

  let valid = true;

  // Validate Reg No
  const regInput = document.getElementById('claim-reg-no');
  const errReg = document.getElementById('err-reg-no');
  if (!regInput.value.trim() || regInput.value.trim().length < 5) {
    regInput.classList.add('input-error');
    if (errReg) errReg.style.display = 'flex';
    valid = false;
  } else {
    regInput.classList.remove('input-error');
    if (errReg) errReg.style.display = 'none';
  }

  // Validate Secret Identifying Details (e.g. "White keychain attached")
  const secretInput = document.getElementById('claim-secret-details');
  const errSecret = document.getElementById('err-secret-details');
  if (secretInput) {
    if (!secretInput.value.trim() || secretInput.value.trim().length < 5) {
      secretInput.classList.add('input-error');
      if (errSecret) errSecret.style.display = 'flex';
      valid = false;
    } else {
      secretInput.classList.remove('input-error');
      if (errSecret) errSecret.style.display = 'none';
    }
  }

  // Validate quiz questions
  const quizInputs = document.querySelectorAll('.quiz-input');
  quizInputs.forEach(input => {
    const errEl = document.getElementById(`err-${input.id}`);
    if (!input.value.trim()) {
      input.classList.add('input-error');
      if (errEl) errEl.style.display = 'flex';
      valid = false;
    } else {
      input.classList.remove('input-error');
      if (errEl) errEl.style.display = 'none';
    }
  });

  // Validate agreement
  const agreement = document.getElementById('claim-agreement');
  const errAgreement = document.getElementById('err-agreement');
  if (!agreement.checked) {
    if (errAgreement) errAgreement.style.display = 'flex';
    valid = false;
  } else {
    if (errAgreement) errAgreement.style.display = 'none';
  }

  if (!valid) {
    showToast('error', 'Verification Incomplete', 'Please provide answers to all required verification questions.');
    return;
  }

  // Submission animation
  const submitBtn = document.getElementById('btn-submit-claim');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Verifying Answers...';
  }

  setTimeout(async () => {
    const formCard = document.getElementById('claim-form-card');
    const successCard = document.getElementById('claim-success-card');

    const authUser = (typeof LostLinkAPI !== 'undefined') ? LostLinkAPI.getCurrentUser() : null;
    const claimantName = authUser ? authUser.name : 'SRM Student';
    const claimantEmail = authUser ? authUser.email : 'student@srmist.edu.in';
    const secretDetails = secretInput ? secretInput.value.trim() : '';

    // Collect answers
    const answersObj = {};
    quizInputs.forEach(input => {
      answersObj[input.id] = input.value.trim();
    });
    const addNotes = document.getElementById('claim-additional')?.value.trim();
    if (addNotes) answersObj['notes'] = addNotes;

    let claimResult = null;
    if (typeof LostLinkAPI !== 'undefined' && targetItem) {
      try {
        claimResult = await LostLinkAPI.submitClaim({
          itemId: targetItem.id,
          claimantName,
          claimantEmail,
          claimantRegNo: regInput.value.trim(),
          secretDetails,
          answers: answersObj
        });
      } catch (err) {
        console.warn('API submitClaim error:', err);
      }
    }

    if (formCard) formCard.style.display = 'none';
    if (successCard) {
      successCard.style.display = 'block';

      // Update pass values dynamically based on targetItem
      const passBadge = document.getElementById('pass-code-badge');
      const passLoc = document.getElementById('pass-location-val');
      const passCust = document.getElementById('pass-custodian-val');
      const chatLink = document.getElementById('btn-claim-chat');

      if (targetItem) {
        const passCode = claimResult?.passCode || `LL-${targetItem.id}0${Math.floor(100 + Math.random() * 900)}`;
        if (passBadge) passBadge.textContent = `Collection Pass #${passCode}`;
        if (passLoc) passLoc.textContent = `${targetItem.location} — Custodian / Security Desk`;
        if (passCust) passCust.textContent = targetItem.user ? `${targetItem.user.name} (Finder)` : 'Campus Security Desk';
        if (chatLink) {
          chatLink.href = `item-detail.html?id=${targetItem.id}#chat-section`;
        }
      }
    }

    // Add to user claims if logged in
    if (authUser && targetItem) {
      authUser.claims = authUser.claims || [];
      if (!authUser.claims.includes(targetItem.id)) {
        authUser.claims.push(targetItem.id);
        LostLinkAPI.setCurrentUser(authUser);
      }
    }

    showToast('success', 'Claim Submitted!', 'Your private proof has been sent to the finder for verification.');
    window.scrollTo({ top: 100, behavior: 'smooth' });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }, 700);
}
