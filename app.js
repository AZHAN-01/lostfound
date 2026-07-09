// --- API BASE URL CONFIGURATION ---
// Set this to your Render URL when deploying the frontend, e.g., 'https://your-backend.onrender.com'
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'api' 
    : 'https://YOUR_BACKEND_APP.onrender.com/api'; // <--- UPDATE THIS URL AFTER RENDER DEPLOYMENT
// ----------------------------------

// -------------------------------------------------------------------------- //
//                            SAFE ICONS WRAPPER                              //
// -------------------------------------------------------------------------- //
function safeCreateIcons(options) {
  if (typeof lucide !== 'undefined') {
    try {
      lucide.createIcons(options);
    } catch (e) {
      console.warn("Lucide icon generation failed: ", e);
    }
  } else {
    console.warn("Lucide is not loaded. Falling back to default text icons.");
  }
}

// -------------------------------------------------------------------------- //
//                            INITIAL STATE & SEED DATA                       //
// -------------------------------------------------------------------------- //



// Fallback images based on category in case user doesn't upload one
const DEFAULT_DOCUMENT_PLACEHOLDER = "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&q=80&w=600";

// -------------------------------------------------------------------------- //
//                            DOM SELECTION                                   //
// -------------------------------------------------------------------------- //

// Navigation & Auth Screens
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginContainer = document.getElementById('login-container');
const registerContainer = document.getElementById('register-container');
const forgotContainer = document.getElementById('forgot-container');

// Forms & Modals
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const forgotForm = document.getElementById('forgot-form');
const reportForm = document.getElementById('report-form');
const reportModal = document.getElementById('report-modal');
const detailModal = document.getElementById('detail-modal');

// Buttons / Toggles
const themeToggleAuth = document.getElementById('theme-toggle-auth');
const themeToggleDashboard = document.getElementById('theme-toggle-dashboard');
const goToRegisterBtn = document.getElementById('go-to-register');
const goToLoginBtn = document.getElementById('go-to-login');
const goToForgotBtn = document.getElementById('go-to-forgot');
const goBackToLoginBtn = document.getElementById('go-back-to-login');
const logoutBtn = document.getElementById('btn-logout');
const profileBtn = document.getElementById('profile-btn');
const dropdownMenu = document.getElementById('profile-dropdown-menu');
const reportTriggerBtn = document.getElementById('btn-report-trigger');
const closeReportModalBtn = document.getElementById('close-report-report'); // wait, let's double check id in HTML
const cancelReportBtn = document.getElementById('btn-cancel-report');

// Alerts Container
const alertContainer = document.getElementById('alert-container');

// State variables
let dbItems = [];
let dbSavedDocs = [];
let currentUser = JSON.parse(localStorage.getItem('lostfound_session')) || null;
let currentImageData = null; // Temp holder for uploaded image base64

// -------------------------------------------------------------------------- //
//                                ALERT SYSTEM                                //
// -------------------------------------------------------------------------- //

function showAlert(message, type = 'success') {
  const alertEl = document.createElement('div');
  alertEl.className = `custom-alert ${type}`;

  let iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  if (type === 'info') iconName = 'info';

  alertEl.innerHTML = `
    <div class="alert-icon-wrapper">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="alert-message">${message}</div>
    <button class="alert-close" aria-label="Close Alert">
      <i data-lucide="x"></i>
    </button>
  `;

  alertContainer.appendChild(alertEl);
  safeCreateIcons({ attrs: { class: 'alert-icon' } });

  // Slide in sound/haptic (visually via anim)
  setTimeout(() => {
    alertEl.style.transform = 'translateX(0)';
  }, 10);

  // Close triggers
  const closeBtn = alertEl.querySelector('.alert-close');
  closeBtn.addEventListener('click', () => removeAlert(alertEl));

  // Auto-destruct after 4 seconds
  setTimeout(() => {
    if (alertEl.parentNode) {
      removeAlert(alertEl);
    }
  }, 4000);
}

function removeAlert(alertEl) {
  alertEl.style.transform = 'translateX(120%)';
  alertEl.style.opacity = '0';
  alertEl.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
  setTimeout(() => {
    if (alertEl.parentNode) {
      alertEl.remove();
    }
  }, 300);
}

// -------------------------------------------------------------------------- //
//                                THEME SYSTEM                                //
// -------------------------------------------------------------------------- //

function initTheme() {
  const savedTheme = localStorage.getItem('lostfound_theme') || 'dark';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('lostfound_theme', isDark ? 'dark' : 'light');
  showAlert(`${isDark ? 'Dark' : 'Light'} theme activated`, 'info');
}

themeToggleAuth.addEventListener('click', toggleTheme);
themeToggleDashboard.addEventListener('click', toggleTheme);

// -------------------------------------------------------------------------- //
//                                AUTH LOGIC                                  //
// -------------------------------------------------------------------------- //

// LOGIN OTP Verification State Variables
let otpStepActive = false;
let pendingLoginUserId = null;

function resetLoginOtpStep() {
  otpStepActive = false;
  pendingLoginUserId = null;

  const otpGroup = document.getElementById('login-otp-group');
  if (otpGroup) otpGroup.classList.add('hidden');

  const otpInput = document.getElementById('login-otp');
  if (otpInput) {
    otpInput.required = false;
    otpInput.value = '';
  }

  const passwordInput = document.getElementById('login-password');
  if (passwordInput) {
    const parentGroup = passwordInput.closest('.form-group');
    if (parentGroup) parentGroup.classList.remove('hidden');
    passwordInput.required = true;
  }

  const submitBtnSpan = loginForm.querySelector('button[type="submit"] span');
  if (submitBtnSpan) submitBtnSpan.textContent = "Sign In";

  const existing = document.getElementById('sim-otp-notification');
  if (existing) existing.remove();
}

// FORGOT PASSWORD State Variables
let forgotOtpStepActive = false;
let pendingForgotUserId = null;

function resetForgotFormStep() {
  forgotOtpStepActive = false;
  pendingForgotUserId = null;

  // Reset inputs
  const forgotIdentifier = document.getElementById('forgot-identifier');
  if (forgotIdentifier) forgotIdentifier.value = '';

  const forgotOtp = document.getElementById('forgot-otp');
  if (forgotOtp) {
    forgotOtp.required = false;
    forgotOtp.value = '';
  }

  const forgotNewPassword = document.getElementById('forgot-new-password');
  if (forgotNewPassword) {
    forgotNewPassword.required = false;
    forgotNewPassword.value = '';
  }

  // Reset step views
  const stepId = document.getElementById('forgot-step-identifier');
  if (stepId) stepId.classList.remove('hidden');

  const stepReset = document.getElementById('forgot-step-reset');
  if (stepReset) stepReset.classList.add('hidden');

  const errorMsg = document.getElementById('forgot-error-msg');
  if (errorMsg) {
    errorMsg.textContent = '';
    errorMsg.classList.remove('active');
  }

  const existing = document.getElementById('sim-otp-notification');
  if (existing) existing.remove();
}

function showOtpDeliveryStatusNotification(target, deliveryStatus, deliveryResponse) {
  const existing = document.getElementById('sim-otp-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'sim-otp-notification';
  notification.style.position = 'fixed';
  notification.style.top = '24px';
  notification.style.right = '24px';
  notification.style.zIndex = '9999';
  notification.style.background = 'var(--bg-card)';
  notification.style.border = '1px solid var(--border-color)';
  notification.style.borderRadius = 'var(--radius-md)';
  notification.style.boxShadow = 'var(--shadow-lg)';
  notification.style.padding = '16px';
  notification.style.maxWidth = '340px';
  notification.style.animation = 'slideDown 0.3s ease-out';

  let statusHtml = '';
  let activationNote = '';

  if (deliveryStatus === 'logged_to_server') {
    statusHtml = `
      <div style="color: var(--color-resolved); font-size: 0.85rem; margin-top: 6px; font-weight: 500; display: flex; align-items: flex-start; gap: 6px;">
        <span>🟢</span>
        <div>
          <strong>Developer Mode Active:</strong> OTP has been securely logged to the server backend.
          <br>
          <code style="background: var(--bg-body); padding: 2px 4px; border-radius: 4px; display: inline-block; margin-top: 4px; font-size: 0.75rem;">api/secure_debug_otp.log</code>
        </div>
      </div>`;
    activationNote = `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; font-style: italic; border-top: 1px solid var(--border-color); padding-top: 8px;">*For security, the actual OTP code is never sent to the client browser.</div>`;
  } else if (deliveryStatus === 'sent') {
    statusHtml = `<div style="color: var(--color-resolved); font-size: 0.75rem; margin-top: 6px; font-weight: 500;">🟢 OTP sent via real email!</div>`;
    activationNote = '';
  } else {
    const errorDetail = (deliveryResponse && deliveryResponse.message) ? `: ${deliveryResponse.message}` : '';
    statusHtml = `<div style="color: var(--color-lost); font-size: 0.75rem; margin-top: 6px; font-weight: 500;">🔴 Real-world dispatch failed${errorDetail}. Check your server config.</div>`;
  }

  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <i data-lucide="mail" style="color: var(--brand-primary); width: 18px; height: 18px;"></i>
      <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">Email OTP Delivery Gateway</span>
    </div>
    <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">
      <strong>OTP sent To:</strong> ${target}<br>
      ${statusHtml}
      ${activationNote}
    </div>
    <button onclick="this.parentElement.remove()" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: var(--text-muted); cursor: pointer;">
      <i data-lucide="x" style="width: 14px; height: 14px;"></i>
    </button>
  `;
  document.body.appendChild(notification);
  lucide.createIcons({
    attrs: {
      class: 'lucide-icon'
    },
    nameAttr: 'data-lucide'
  });
}

// Swap forms
goToRegisterBtn.addEventListener('click', () => {
  resetLoginOtpStep();
  resetForgotFormStep();
  loginContainer.classList.remove('active');
  forgotContainer.classList.remove('active');
  setTimeout(() => {
    registerContainer.classList.add('active');
  }, 150);
});

goToLoginBtn.addEventListener('click', () => {
  registerContainer.classList.remove('active');
  forgotContainer.classList.remove('active');
  setTimeout(() => {
    loginContainer.classList.add('active');
  }, 150);
});

if (goToForgotBtn) {
  goToForgotBtn.addEventListener('click', () => {
    resetLoginOtpStep();
    resetForgotFormStep();
    loginContainer.classList.remove('active');
    registerContainer.classList.remove('active');
    setTimeout(() => {
      forgotContainer.classList.add('active');
    }, 150);
  });
}

if (goBackToLoginBtn) {
  goBackToLoginBtn.addEventListener('click', () => {
    resetForgotFormStep();
    forgotContainer.classList.remove('active');
    registerContainer.classList.remove('active');
    setTimeout(() => {
      loginContainer.classList.add('active');
    }, 150);
  });
}

// Password visibility toggler
document.querySelectorAll('.toggle-password').forEach(button => {
  button.addEventListener('click', (e) => {
    const input = button.previousElementSibling;
    const eyeOpen = button.querySelector('.eye-open');
    const eyeClosed = button.querySelector('.eye-closed');

    if (input.type === 'password') {
      input.type = 'text';
      eyeOpen.classList.add('hidden');
      eyeClosed.classList.remove('hidden');
    } else {
      input.type = 'password';
      eyeOpen.classList.remove('hidden');
      eyeClosed.classList.add('hidden');
    }
  });
});

// REGISTER FORM SUBMISSION
registerForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const address = document.getElementById('reg-address').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm-password').value;
  const errorMsg = document.getElementById('register-error-msg');

  errorMsg.classList.remove('active');

  // Validation
  if (password !== confirmPassword) {
    errorMsg.textContent = "Passwords do not match!";
    errorMsg.classList.add('active');
    return;
  }

  if (password.length < 6) {
    errorMsg.textContent = "Password must be at least 6 characters long.";
    errorMsg.classList.add('active');
    return;
  }

  const payload = {
    id: 'user_' + Date.now(),
    name: name,
    email: email,
    phone: phone,
    address: address,
    password: password
  };

  fetch(`${API_BASE_URL}/register.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(async response => {
      let resData;
      try {
        resData = await response.json();
      } catch (e) {
        throw new Error(`Server returned invalid response (possibly PHP is offline or not executing). Status: ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(resData.message || 'Registration failed');
      }
      showAlert("Account registered successfully! Please log in.", "success");
      registerForm.reset();

      // Toggle back to login
      registerContainer.classList.remove('active');
      setTimeout(() => {
        loginContainer.classList.add('active');
        document.getElementById('login-identifier').value = email;
      }, 200);
    })
    .catch(err => {
      errorMsg.textContent = err.message;
      errorMsg.classList.add('active');
    });
});

// LOGIN FORM SUBMISSION
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value;
  const errorMsg = document.getElementById('login-error-msg');

  errorMsg.classList.remove('active');

  if (!otpStepActive) {
    fetch(`${API_BASE_URL}/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    })
      .then(async response => {
        let resData;
        try {
          resData = await response.json();
        } catch (e) {
          throw new Error(`Server returned invalid response (possibly PHP is offline or not executing). Status: ${response.status}`);
        }
        if (!response.ok) {
          throw new Error(resData.message || 'Login failed');
        }

        if (resData.otp_required) {
          pendingLoginUserId = resData.user_id;
          otpStepActive = true;

          // Show OTP section in UI
          const otpGroup = document.getElementById('login-otp-group');
          if (otpGroup) otpGroup.classList.remove('hidden');

          const otpInput = document.getElementById('login-otp');
          if (otpInput) {
            otpInput.required = true;
            otpInput.focus();
          }

          // Hide password section
          const passwordInput = document.getElementById('login-password');
          if (passwordInput) {
            const parentGroup = passwordInput.closest('.form-group');
            if (parentGroup) parentGroup.classList.add('hidden');
            passwordInput.required = false;
          }

          // Update helper message
          const deliveryMsg = document.getElementById('login-otp-delivery-msg');
          if (deliveryMsg) {
            deliveryMsg.textContent = `Verification code sent to email (${resData.target})`;
          }

          // Change submit button text
          const submitBtnSpan = loginForm.querySelector('button[type="submit"] span');
          if (submitBtnSpan) submitBtnSpan.textContent = "Verify & Log In";

          // Show notification overlay with instructions or status (email only)
          showOtpDeliveryStatusNotification(resData.target, resData.delivery_status, resData.delivery_response);

          showAlert("Password verified. Enter verification code (OTP) to continue.", "info");
        }
      })
      .catch(err => {
        errorMsg.textContent = err.message;
        errorMsg.classList.add('active');
      });
  } else {
    // OTP Verification step is active!
    const enteredOtp = document.getElementById('login-otp').value.trim();

    fetch(`${API_BASE_URL}/verify_otp.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: pendingLoginUserId, otp: enteredOtp })
    })
      .then(async response => {
        let resData;
        try {
          resData = await response.json();
        } catch (e) {
          throw new Error(`Server returned invalid verification response. Status: ${response.status}`);
        }
        if (!response.ok) {
          throw new Error(resData.message || 'Verification failed');
        }

        currentUser = resData.user;
        localStorage.setItem('lostfound_session', JSON.stringify(currentUser));
        showAlert(`Welcome back, ${currentUser.name || currentUser.email}!`, 'success');

        loginForm.reset();
        resetLoginOtpStep();
        transitionToDashboard();
      })
      .catch(err => {
        errorMsg.textContent = err.message;
        errorMsg.classList.add('active');
        const otpInput = document.getElementById('login-otp');
        if (otpInput) {
          otpInput.value = '';
          otpInput.focus();
        }
      });
  }
});

// FORGOT PASSWORD FORM SUBMISSION
if (forgotForm) {
  forgotForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const errorMsg = document.getElementById('forgot-error-msg');
    errorMsg.classList.remove('active');

    if (!forgotOtpStepActive) {
      // Step 1: Send OTP
      const identifier = document.getElementById('forgot-identifier').value.trim();

      fetch(`${API_BASE_URL}/forgot_password.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      })
        .then(async response => {
          let resData;
          try {
            resData = await response.json();
          } catch (e) {
            throw new Error(`Server returned invalid response. Status: ${response.status}`);
          }
          if (!response.ok) {
            throw new Error(resData.message || 'Forgot password request failed');
          }

          pendingForgotUserId = resData.user_id;
          forgotOtpStepActive = true;

          // Hide Step 1 UI, show Step 2 UI
          const stepId = document.getElementById('forgot-step-identifier');
          if (stepId) stepId.classList.add('hidden');

          const stepReset = document.getElementById('forgot-step-reset');
          if (stepReset) stepReset.classList.remove('hidden');

          const forgotOtpInput = document.getElementById('forgot-otp');
          if (forgotOtpInput) {
            forgotOtpInput.required = true;
            forgotOtpInput.focus();
          }

          const forgotNewPasswordInput = document.getElementById('forgot-new-password');
          if (forgotNewPasswordInput) {
            forgotNewPasswordInput.required = true;
          }

          // Update helper message
          const deliveryMsg = document.getElementById('forgot-otp-delivery-msg');
          if (deliveryMsg) {
            deliveryMsg.textContent = `Verification code sent to email (${resData.target})`;
          }

          // Show developer/email OTP notification
          showOtpDeliveryStatusNotification(resData.target, resData.delivery_status, resData.delivery_response);

          showAlert("Verification code (OTP) sent to your registered email.", "info");
        })
        .catch(err => {
          errorMsg.textContent = err.message;
          errorMsg.classList.add('active');
        });
    } else {
      // Step 2: Reset Password
      const otp = document.getElementById('forgot-otp').value.trim();
      const new_password = document.getElementById('forgot-new-password').value;

      if (new_password.length < 6) {
        errorMsg.textContent = "New password must be at least 6 characters long.";
        errorMsg.classList.add('active');
        return;
      }

      fetch(`${API_BASE_URL}/reset_password.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: pendingForgotUserId, otp, new_password })
      })
        .then(async response => {
          let resData;
          try {
            resData = await response.json();
          } catch (e) {
            throw new Error(`Server returned invalid response. Status: ${response.status}`);
          }
          if (!response.ok) {
            throw new Error(resData.message || 'Password reset failed');
          }

          showAlert(resData.message || "Password reset successfully!", "success");
          
          // Clean up and go back to login
          resetForgotFormStep();
          forgotContainer.classList.remove('active');
          setTimeout(() => {
            loginContainer.classList.add('active');
            const loginIdentifierInput = document.getElementById('login-identifier');
            const forgotIdentifierInput = document.getElementById('forgot-identifier');
            if (loginIdentifierInput && forgotIdentifierInput) {
              loginIdentifierInput.value = forgotIdentifierInput.value;
            }
          }, 150);
        })
        .catch(err => {
          errorMsg.textContent = err.message;
          errorMsg.classList.add('active');
          const forgotOtpInput = document.getElementById('forgot-otp');
          if (forgotOtpInput) {
            forgotOtpInput.value = '';
            forgotOtpInput.focus();
          }
        });
    }
  });
}

// Transition to dashboard view
async function transitionToDashboard() {
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');

  // Setup user details
  const displayName = currentUser.name || currentUser.email.split('@')[0];
  const initials = displayName.trim().split(/\s+/).map(n => n[0]).join('').substring(0, 2).toUpperCase() || displayName.substring(0, 2).toUpperCase();

  document.getElementById('user-avatar-initials').textContent = initials;
  document.getElementById('user-display-name').textContent = displayName;

  document.getElementById('menu-user-name').textContent = displayName;
  document.getElementById('menu-user-email').textContent = currentUser.email;
  document.getElementById('menu-user-phone').textContent = currentUser.phone;
  document.getElementById('menu-user-address').textContent = currentUser.address;

  // Fetch items and docs from the server
  try {
    const itemsResponse = await fetch(`${API_BASE_URL}/items.php');
    if (itemsResponse.ok) {
      dbItems = await itemsResponse.json();
    }

    const docsResponse = await fetch(`${API_BASE_URL}/docs.php?userId=${currentUser.id}`);
    if (docsResponse.ok) {
      dbSavedDocs = await docsResponse.json();
    }

    const certsResponse = await fetch(`${API_BASE_URL}/certificates.php?email=${currentUser.email}`);
    if (certsResponse.ok) {
      dbCertificates = await certsResponse.json();
    }
  } catch (e) {
    console.error("Failed to load dashboard data: ", e);
    showAlert("Failed to load dashboard data from server.", "error");
  }

  // Render list
  renderStats();
  renderItems();
  renderLockerGallery();
  startQuoteRotation();
  safeCreateIcons();
}

// Log out action
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('lostfound_session');
  currentUser = null;

  dropdownMenu.classList.remove('active');
  profileBtn.classList.remove('active');

  dashboardSection.classList.add('hidden');
  authSection.classList.remove('hidden');
  showAlert("Signed out successfully.", "info");
});

// Profile Dropdown Toggle
profileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  profileBtn.classList.toggle('active');
  dropdownMenu.classList.toggle('active');
});

// Close dropdown on click outside
window.addEventListener('click', () => {
  profileBtn.classList.remove('active');
  dropdownMenu.classList.remove('active');
});

dropdownMenu.addEventListener('click', (e) => {
  e.stopPropagation(); // prevent closure when interacting inside dropdown
});

// -------------------------------------------------------------------------- //
//                       THREE-TAB DASHBOARD & AI SCANNER MODULE              //
// -------------------------------------------------------------------------- //

// State (loaded asynchronously from API)
const quotesList = [
  { text: "We find ourselves by losing ourselves in the service of others.", author: "Mahatma Gandhi" },
  { text: "Honesty is the first chapter in the book of wisdom.", author: "Thomas Jefferson" },
  { text: "Integrity is doing the right thing, even when no one is watching.", author: "C.S. Lewis" },
  { text: "No legacy is so rich as honesty.", author: "William Shakespeare" },
  { text: "The greatness of a community is most accurately measured by the compassionate actions of its members.", author: "Coretta Scott King" },
  { text: "Honesty and integrity are by far the most worthy assets of an entrepreneur.", author: "Zig Ziglar" },
  { text: "Trust is built with consistency, honesty, and mutual respect.", author: "Unknown" },
  { text: "Small acts of honesty build deep pillars of community trust.", author: "Unknown" }
];
let activeQuoteIndex = 0;
let quoteRotationTimer = null;
let nextPrefetchedQuote = null;
let isPrefetching = false;

// Certificates state
let dbCertificates = [];

// Search/Filter states
let lostSearchQuery = '';
let foundSearchQuery = '';

// AI Scanner state
let scannedDocFile = null;
let scannedDocBase64 = null;

// DOM bindings for navigation
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.dashboard-view');

// DOM bindings for Quotes
const quoteTextEl = document.getElementById('quote-text');
const quoteAuthorEl = document.getElementById('quote-author');
const btnNextQuote = document.getElementById('btn-next-quote');

// DOM bindings for Scanner
const docDropZone = document.getElementById('doc-drop-zone');
const docImageInput = document.getElementById('doc-image-input');
const docImagePreview = document.getElementById('doc-image-preview');
const dropZoneIdle = document.getElementById('drop-zone-idle');
const dropZoneActive = document.getElementById('drop-zone-active');
const scanLaser = document.getElementById('scan-laser');
const btnRunScan = document.getElementById('btn-run-scan');
const btnClearScan = document.getElementById('btn-clear-scan');
const consoleLogsEl = document.getElementById('console-status-message');
const extractedFieldsForm = document.getElementById('extracted-fields-form');
const lockerGrid = document.getElementById('locker-grid');
const lockerCountEl = document.getElementById('locker-count');

// DOM bindings for Lost Items View
const lostSearchInput = document.getElementById('lost-search-input');
const lostClearSearch = document.getElementById('lost-clear-search');
const lostItemsGrid = document.getElementById('lost-items-grid');
const lostEmptyState = document.getElementById('lost-empty-state');
const lostBtnEmptyReset = document.getElementById('lost-btn-empty-reset');
const lostResultsCountEl = document.getElementById('lost-results-count');

// DOM bindings for Found Items View
const foundSearchInput = document.getElementById('found-search-input');
const foundClearSearch = document.getElementById('found-clear-search');
const foundItemsGrid = document.getElementById('found-items-grid');
const foundEmptyState = document.getElementById('found-empty-state');
const foundBtnEmptyReset = document.getElementById('found-btn-empty-reset');
const foundResultsCountEl = document.getElementById('found-results-count');

// 1. Navigation Switcher
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetView = item.dataset.view;
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    views.forEach(v => {
      if (v.id === `view-${targetView}`) {
        v.classList.remove('hidden');
      } else {
        v.classList.add('hidden');
      }
    });

    if (targetView === 'lost-items') {
      renderLostItems();
    } else if (targetView === 'found-items') {
      renderFoundItems();
    } else if (targetView === 'upload') {
      renderLockerGallery();
      startQuoteRotation();
    } else if (targetView === 'certificates') {
      renderCertificates();
    }

    safeCreateIcons();
  });
});

// 2. Inspirational Quotes Engine
async function prefetchNextQuote() {
  if (isPrefetching || nextPrefetchedQuote !== null) return;
  isPrefetching = true;
  try {
    const response = await fetch(`${API_BASE_URL}/quote.php');
    if (response.ok) {
      const data = await response.json();
      if (data && data.text && data.author) {
        nextPrefetchedQuote = data;
      }
    }
  } catch (error) {
    console.warn('Failed to pre-fetch next quote:', error);
  } finally {
    isPrefetching = false;
  }
}

async function rotateQuote() {
  if (!quoteTextEl || !quoteAuthorEl) return;

  // Fade out
  quoteTextEl.style.opacity = '0';
  quoteAuthorEl.style.opacity = '0';

  // Consume pre-fetched quote
  let quote = nextPrefetchedQuote;
  nextPrefetchedQuote = null;

  // Fallback if prefetch wasn't ready or failed
  if (!quote) {
    activeQuoteIndex = (activeQuoteIndex + 1) % quotesList.length;
    quote = quotesList[activeQuoteIndex];
  }

  setTimeout(() => {
    quoteTextEl.textContent = `"${quote.text}"`;
    quoteAuthorEl.textContent = `— ${quote.author}`;

    // Fade in
    quoteTextEl.style.opacity = '1';
    quoteAuthorEl.style.opacity = '1';

    // Prefetch the next quote in the background for the next transition
    prefetchNextQuote();
  }, 300);
}

function startQuoteRotation() {
  if (quoteRotationTimer) clearInterval(quoteRotationTimer);
  prefetchNextQuote(); // Ensure we start loading a quote in the background
  quoteRotationTimer = setInterval(rotateQuote, 20000);
}

if (btnNextQuote) {
  btnNextQuote.addEventListener('click', () => {
    rotateQuote();
    startQuoteRotation(); // Reset timer
  });
}

// 3. Lost Items Directory Logic
if (lostSearchInput) {
  lostSearchInput.addEventListener('input', (e) => {
    lostSearchQuery = e.target.value.trim().toLowerCase();
    if (lostSearchQuery.length > 0) {
      lostClearSearch.classList.remove('hidden');
    } else {
      lostClearSearch.classList.add('hidden');
    }
    renderLostItems();
  });
}

if (lostClearSearch) {
  lostClearSearch.addEventListener('click', () => {
    lostSearchInput.value = '';
    lostSearchQuery = '';
    lostClearSearch.classList.add('hidden');
    renderLostItems();
  });
}

if (lostBtnEmptyReset) {
  lostBtnEmptyReset.addEventListener('click', () => {
    lostSearchInput.value = '';
    lostSearchQuery = '';
    lostClearSearch.classList.add('hidden');
    renderLostItems();
  });
}

function renderLostItems() {
  if (!lostItemsGrid) return;
  lostItemsGrid.innerHTML = '';

  const filtered = dbItems.filter(item => {
    if (item.status !== 'lost') return false;
    if (currentUser && item.reporterEmail !== currentUser.email) return false;
    const searchString = `${item.title} ${item.description} ${item.location}`.toLowerCase();
    const matchesSearch = lostSearchQuery === '' || searchString.includes(lostSearchQuery);
    return matchesSearch;
  });

  lostResultsCountEl.textContent = `Showing ${filtered.length} document${filtered.length === 1 ? '' : 's'}`;

  if (filtered.length === 0) {
    lostItemsGrid.classList.add('hidden');
    lostEmptyState.classList.remove('hidden');
  } else {
    lostItemsGrid.classList.remove('hidden');
    lostEmptyState.classList.add('hidden');

    const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
    sorted.forEach((item, idx) => {
      const card = createListItemCard(item, idx);
      lostItemsGrid.appendChild(card);
    });
  }
  safeCreateIcons();
}

// 4. Found Items Directory Logic
if (foundSearchInput) {
  foundSearchInput.addEventListener('input', (e) => {
    foundSearchQuery = e.target.value.trim().toLowerCase();
    if (foundSearchQuery.length > 0) {
      foundClearSearch.classList.remove('hidden');
    } else {
      foundClearSearch.classList.add('hidden');
    }
    renderFoundItems();
  });
}

if (foundClearSearch) {
  foundClearSearch.addEventListener('click', () => {
    foundSearchInput.value = '';
    foundSearchQuery = '';
    foundClearSearch.classList.add('hidden');
    renderFoundItems();
  });
}

if (foundBtnEmptyReset) {
  foundBtnEmptyReset.addEventListener('click', () => {
    foundSearchInput.value = '';
    foundSearchQuery = '';
    foundClearSearch.classList.add('hidden');
    renderFoundItems();
  });
}

function renderFoundItems() {
  if (!foundItemsGrid) return;
  foundItemsGrid.innerHTML = '';

  const filtered = dbItems.filter(item => {
    if (item.status !== 'found') return false;
    const searchString = `${item.title} ${item.description} ${item.location}`.toLowerCase();
    const matchesSearch = foundSearchQuery === '' || searchString.includes(foundSearchQuery);
    return matchesSearch;
  });

  foundResultsCountEl.textContent = `Showing ${filtered.length} document${filtered.length === 1 ? '' : 's'}`;

  if (filtered.length === 0) {
    foundItemsGrid.classList.add('hidden');
    foundEmptyState.classList.remove('hidden');
  } else {
    foundItemsGrid.classList.remove('hidden');
    foundEmptyState.classList.add('hidden');

    const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
    sorted.forEach((item, idx) => {
      const card = createListItemCard(item, idx);
      foundItemsGrid.appendChild(card);
    });
  }
  safeCreateIcons();
}

// Listing Card Generator Helper
function createListItemCard(item, index) {
  const card = document.createElement('div');
  card.className = 'item-card';
  card.style.animationDelay = `${index * 0.05}s`;

  const badgeClass = `badge-${item.status}`;
  const statusLabel = item.status.toUpperCase();
  const isOwner = currentUser && currentUser.email === item.reporterEmail;

  card.innerHTML = `
    <div class="card-media">
      <span class="badge ${badgeClass}">${statusLabel}</span>
      ${isOwner ? `
      <button class="btn-card-delete" title="Delete Listing" onclick="event.stopPropagation(); window.deleteListingDirect('${item.id}')">
        <i data-lucide="trash-2"></i>
      </button>
      ` : ''}
      <img src="${item.image}" alt="${item.title}" loading="lazy">
    </div>
    <div class="card-body">
      <span class="card-date">${formatDate(item.date)}</span>
      <h3 class="card-title">${item.title}</h3>
      <p class="card-desc">${item.description}</p>
      <div class="card-footer">
        <div class="card-location">
          <i data-lucide="map-pin"></i>
          <span>${item.location}</span>
        </div>
        <span class="card-action-link">
          <span>Details</span>
          <i data-lucide="arrow-right" style="width: 14px; height: 14px;"></i>
        </span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openDetailModal(item));
  return card;
}

// Generic Render Items mapping
function renderItems() {
  renderLostItems();
  renderFoundItems();
  renderCertificates();
}

// Safe statistics rendering
function renderStats() {
  const lostCount = dbItems.filter(item => item.status === 'lost').length;
  const foundCount = dbItems.filter(item => item.status === 'found').length;
  const resolvedCount = dbItems.filter(item => item.status === 'resolved' || item.status === 'resolved_lost' || item.status === 'resolved_found').length;

  const elLost = document.getElementById('stat-lost-count');
  const elFound = document.getElementById('stat-found-count');
  const elResolved = document.getElementById('stat-resolved-count');

  if (elLost) elLost.textContent = lostCount;
  if (elFound) elFound.textContent = foundCount;
  if (elResolved) elResolved.textContent = resolvedCount;
}

// Date formatter helper
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', options);
}

// 5. AI Scanner & safe Box logic
function printConsoleLog(message, type = 'info') {
  if (!consoleLogsEl) return;
  consoleLogsEl.textContent = message;

  const statusBox = document.getElementById('console-status-box');
  if (statusBox) {
    if (type === 'success') {
      statusBox.style.borderColor = 'var(--color-found)';
      statusBox.style.color = 'var(--color-found)';
      statusBox.style.background = 'var(--color-found-glow)';
    } else if (type === 'error') {
      statusBox.style.borderColor = 'var(--color-lost)';
      statusBox.style.color = 'var(--color-lost)';
      statusBox.style.background = 'var(--color-lost-glow)';
    } else if (type === 'warning') {
      statusBox.style.borderColor = '#F59E0B';
      statusBox.style.color = '#F59E0B';
      statusBox.style.background = 'rgba(245, 158, 11, 0.1)';
    } else {
      statusBox.style.borderColor = 'var(--card-border)';
      statusBox.style.color = 'var(--text-secondary)';
      statusBox.style.background = 'var(--bg-primary)';
    }
  }
}

// Dropzone clicks & drag-drops
if (docDropZone) {
  docDropZone.addEventListener('click', (e) => {
    if (e.target.closest('#btn-doc-camera')) return;
    docImageInput.click();
  });
  docDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    docDropZone.classList.add('dragover');
  });
  docDropZone.addEventListener('dragleave', () => {
    docDropZone.classList.remove('dragover');
  });
  docDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    docDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleScannedDocFile(e.dataTransfer.files[0]);
    }
  });
}

const btnDocCamera = document.getElementById('btn-doc-camera');
const docCameraInput = document.getElementById('doc-camera-input');
if (btnDocCamera && docCameraInput) {
  btnDocCamera.addEventListener('click', (e) => {
    e.stopPropagation();
    docCameraInput.click();
  });
}

if (docCameraInput) {
  docCameraInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleScannedDocFile(e.target.files[0]);
    }
  });
}

if (docImageInput) {
  docImageInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleScannedDocFile(e.target.files[0]);
    }
  });
}

function compressImage(file, maxWidth, maxHeight, quality, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let origWidth = img.width;
      let origHeight = img.height;
      let rotate = false;

      // If in landscape view, flag it to rotate to portrait
      if (origWidth > origHeight) {
        rotate = true;
      }

      // Determine dimensions for canvas (always portrait)
      let targetWidth = rotate ? origHeight : origWidth;
      let targetHeight = rotate ? origWidth : origHeight;

      // Downscale if exceeds max dimensions
      if (targetWidth > maxWidth) {
        targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
        targetWidth = maxWidth;
      }
      if (targetHeight > maxHeight) {
        targetWidth = Math.round((targetWidth * maxHeight) / targetHeight);
        targetHeight = maxHeight;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');

      // Auto-crop zoom factor (1.12 zooms in by 12% to crop background margins)
      const zoom = 1.12; 
      
      if (rotate) {
        // Translate and rotate 90 degrees clockwise to pivot landscape into portrait
        ctx.translate(targetWidth / 2, targetHeight / 2);
        ctx.rotate((90 * Math.PI) / 180);
        
        // Draw the image scaled and cropped
        const drawW = targetHeight * zoom;
        const drawH = targetWidth * zoom;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        // Draw standard portrait image zoomed in slightly to crop margins
        const drawW = targetWidth * zoom;
        const drawH = targetHeight * zoom;
        const dx = (targetWidth - drawW) / 2;
        const dy = (targetHeight - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);
      }

      // Export as JPEG with given quality
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      callback(compressedBase64);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleScannedDocFile(file) {
  if (!file.type.startsWith('image/')) {
    showAlert("Please upload image files only.", "error");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showAlert("File size exceeds 10MB limit.", "error");
    return;
  }

  scannedDocFile = file;
  const reader = new FileReader();
  reader.onload = function(e) {
    openCropEditor(e.target.result, 'scanner');
  };
  reader.readAsDataURL(file);
}

// Clear Scan trigger
if (btnClearScan) {
  btnClearScan.addEventListener('click', (e) => {
    e.stopPropagation();
    resetScanner();
  });
}

function resetScanner() {
  scannedDocFile = null;
  scannedDocBase64 = null;
  docImagePreview.src = '';
  dropZoneActive.classList.add('hidden');
  dropZoneIdle.classList.remove('hidden');
  if (btnRunScan) {
    btnRunScan.disabled = true;
    btnRunScan.querySelector('span').textContent = 'AI Scanner Active';
  }
  btnClearScan.classList.add('hidden');
  if (scanLaser) scanLaser.classList.add('hidden');
  if (extractedFieldsForm) {
    extractedFieldsForm.classList.add('hidden');
    extractedFieldsForm.reset();
  }
  printConsoleLog("Awaiting document upload...", "info");
}

// Automated Scan and Database Storage Flow
function runAutomatedScanAndSave() {
  if (!scannedDocBase64) return;

  if (scanLaser) scanLaser.classList.remove('hidden');
  if (btnRunScan) {
    btnRunScan.disabled = true;
    btnRunScan.querySelector('span').textContent = 'AI Scanning...';
  }
  if (btnClearScan) btnClearScan.classList.add('hidden');
  if (extractedFieldsForm) extractedFieldsForm.classList.add('hidden');
  printConsoleLog("AI Document Analyzer starting...", "info");

  // 1. Try to analyze using Google Gemini API backend proxy
  printConsoleLog("Contacting server-side Google Gemini API...", "info");

  fetch(`${API_BASE_URL}/analyze.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: scannedDocBase64 })
  })
    .then(async response => {
      let resData;
      try {
        resData = await response.json();
      } catch (e) {
        throw new Error(`Server returned invalid response. Status: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(resData.message || 'Gemini analysis failed');
      }

      printConsoleLog("Gemini analysis successful! Parsing document details...", "success");
      processAndSaveExtractedData(resData);
    })
    .catch(err => {
      printConsoleLog(`Gemini API Error: ${err.message}`, "error");
      showAlert("AI Scanner failed: " + err.message, "error");
      resetScannerState();
    });
}

function runLocalOcrFallback() {
  printConsoleLog("Initializing local Tesseract.js OCR engine...", "info");

  if (typeof Tesseract === 'undefined') {
    printConsoleLog("[Error] Tesseract.js library not loaded. Ensure CDN is accessible.", "error");
    showAlert("OCR library offline. Cannot parse document.", "error");
    resetScannerState();
    return;
  }

  Tesseract.recognize(
    scannedDocBase64,
    'eng',
    {
      logger: m => {
        if (m.status === 'recognizing text') {
          printConsoleLog(`[Local OCR] Processing: ${Math.round(m.progress * 100)}%`, "info");
        }
      }
    }
  )
    .then(({ data: { text } }) => {
      printConsoleLog("Local OCR character extraction complete. Parsing entities...", "success");

      const upperText = text.toUpperCase();
      let docType = 'other';
      let docName = 'Scanned Document';

      if (upperText.includes('PASSPORT')) {
        docType = 'passport';
        docName = 'US Passport';
      } else if (upperText.includes('LICENSE') || upperText.includes('DRIVE') || upperText.includes('DL')) {
        docType = 'driver_license';
        docName = "Driver's License";
      } else if (upperText.includes('STUDENT') || upperText.includes('UNIVERSITY') || upperText.includes('COLLEGE')) {
        docType = 'student_id';
        docName = 'Student ID Card';
      } else if (upperText.includes('VISA') || upperText.includes('MASTERCARD') || upperText.includes('DEBIT') || upperText.includes('CREDIT') || upperText.includes('CARD')) {
        docType = 'credit_card';
        docName = 'Personal Card';
      } else if (upperText.includes('RECEIPT') || upperText.includes('INVOICE') || upperText.includes('TOTAL') || upperText.includes('CASH')) {
        docType = 'receipt';
        docName = 'Purchase Receipt';
      }

      // Holder Name extraction:
      let holderName = '';
      if (currentUser && currentUser.name) {
        const userWords = currentUser.name.toLowerCase().split(/\s+/);
        const matchesUser = userWords.every(word => text.toLowerCase().includes(word));
        if (matchesUser) {
          holderName = currentUser.name;
        }
      }

      if (!holderName) {
        const nameMatch = text.match(/(?:name|holder|holder's name|issued to|full name)[:\s]+([A-Za-z\s]+)/i);
        if (nameMatch && nameMatch[1]) {
          holderName = nameMatch[1].trim().split('\n')[0];
        } else {
          holderName = 'Unknown Holder';
        }
      }

      // Document ID extraction:
      let docId = '';
      const idMatch = text.match(/(?:id|document no|passport no|number|no|card no)[:\s#]+([A-Z0-9-]+)/i);
      if (idMatch && idMatch[1]) {
        docId = idMatch[1].trim();
      } else {
        const generalIdMatch = text.match(/[A-Z0-9]{6,12}/);
        docId = generalIdMatch ? generalIdMatch[0] : `DOC-${Math.floor(100000 + Math.random() * 900000)}`;
      }

      // Expiration Date extraction:
      let expiry = 'N/A';
      const dateMatch = text.match(/(?:expiry|expires|exp|valid thru)[:\s]+([0-9\/-]+)/i);
      if (dateMatch && dateMatch[1]) {
        expiry = dateMatch[1].trim();
      } else {
        const generalDateMatch = text.match(/\d{4}-\d{2}-\d{2}/) || text.match(/\d{2}\/\d{2}\/\d{4}/);
        expiry = generalDateMatch ? generalDateMatch[0] : 'N/A';
      }

      const parsedData = {
        type: docType,
        name: docName,
        id: docId,
        holderName: holderName,
        expiryDate: expiry,
        rawText: text
      };

      processAndSaveExtractedData(parsedData);
    })
    .catch(err => {
      printConsoleLog(`Local OCR Failed: ${err.message}`, "error");
      showAlert("Failed to analyze document locally.", "error");
      resetScannerState();
    });
}

function processAndSaveExtractedData(data) {
  printConsoleLog("Verifying owner credentials...", "info");

  const holderName = (data.holderName || '').trim();
  const accHolderName = (currentUser && currentUser.name) ? currentUser.name.trim() : '';

  if (holderName.toLowerCase() !== accHolderName.toLowerCase()) {
    printConsoleLog(`[Error] Owner verification failed. Document belongs to "${holderName}", but logged-in user is "${accHolderName}".`, "error");
    showAlert(`Access Denied: The document owner name ("${holderName || 'Unknown'}") does not match the account holder's name ("${accHolderName}").`, "error");
    resetScannerState();
    return;
  }

  if (data.id && data.id !== 'N/A' && data.id.trim() !== '') {
    const isDuplicate = dbSavedDocs.some(doc => doc.docId === data.id);
    if (isDuplicate) {
      printConsoleLog(`[Error] Document ID ${data.id} is already in your Safe Locker.`, "error");
      showAlert("This document is already saved in your Safe Locker!", "warning");
      resetScanner();
      return;
    }
  }

  printConsoleLog("Owner verification successful! Requesting custom document name...", "success");

  // Prompt user to customize the document name/label before saving
  const customName = prompt("Enter a custom name/label for this document:", data.name || "Scanned Document");
  if (customName === null) {
    printConsoleLog("Save cancelled by user.", "warning");
    showAlert("Document save cancelled.", "info");
    resetScannerState();
    return;
  }

  const finalName = customName.trim() || data.name || "Scanned Document";
  printConsoleLog(`Saving document as "${finalName}"...`, "info");

  const docData = {
    id: 'doc_' + Date.now(),
    userId: currentUser.id,
    name: finalName,
    type: data.type || 'other',
    docId: data.id || 'N/A',
    holderName: holderName,
    expiryDate: data.expiryDate || 'N/A',
    rawText: data.rawText || '',
    image: scannedDocBase64 || DEFAULT_DOCUMENT_PLACEHOLDER,
    createdAt: Date.now()
  };

  fetch(`${API_BASE_URL}/docs.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docData)
  })
    .then(async response => {
      let resData;
      try {
        resData = await response.json();
      } catch (e) {
        throw new Error(`Server returned invalid response. Status: ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(resData.message || 'Failed to save document');
      }

      printConsoleLog("Document successfully stored in Safe Locker database!", "success");
      dbSavedDocs.unshift(docData);
      showAlert("Document analyzed and saved to Safe Locker!", "success");
      resetScanner(); // Fully reset the scanner, removing the image
      renderLockerGallery();
    })
    .catch(err => {
      printConsoleLog(`Save Failed: ${err.message}`, "error");
      showAlert(`Failed to save document: ${err.message}`, "error");
      resetScannerState();
    });
}

function resetScannerState() {
  if (scanLaser) scanLaser.classList.add('hidden');
  if (btnClearScan) btnClearScan.classList.remove('hidden');
  if (btnRunScan) {
    btnRunScan.disabled = true;
    btnRunScan.querySelector('span').textContent = 'AI Scanner Active';
  }
}

// Locker cards rendering
function renderLockerGallery() {
  if (!lockerGrid) return;
  lockerGrid.innerHTML = '';

  // Set count badge
  lockerCountEl.textContent = `${dbSavedDocs.length} Document${dbSavedDocs.length === 1 ? '' : 's'} Saved`;

  if (dbSavedDocs.length === 0) {
    lockerGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i data-lucide="folder-lock" style="width: 40px; height: 40px; margin-bottom: 12px; color: var(--text-muted);"></i>
        <p>No documents stored. Scan a document above to keep it in your safe locker</p>
      </div>
    `;
    safeCreateIcons();
    return;
  }

  dbSavedDocs.forEach(doc => {
    const card = document.createElement('div');
    card.className = 'locker-card';

    // Icon selection
    let cardIcon = 'file-text';
    if (doc.type === 'driver_license') cardIcon = 'car';
    else if (doc.type === 'passport') cardIcon = 'globe';
    else if (doc.type === 'credit_card') cardIcon = 'credit-card';
    else if (doc.type === 'student_id') cardIcon = 'graduation-cap';

    card.innerHTML = `
      <button class="btn-locker-delete" title="Delete Saved Scan">
        <i data-lucide="trash-2"></i>
      </button>
      <div class="locker-card-media">
        <img src="${doc.image}" alt="${doc.name}" loading="lazy">
      </div>
      <div class="locker-card-header">
        <div class="locker-icon-wrapper">
          <i data-lucide="${cardIcon}"></i>
        </div>
        <span class="locker-type-badge ${doc.type}">${doc.type.replace('_', ' ')}</span>
      </div>
      <div class="locker-card-body">
        <h4>${doc.name}</h4>
        <div class="locker-meta-row">
          <span><strong>ID:</strong> ${doc.docId || 'N/A'}</span>
          <span><strong>Holder:</strong> ${doc.holderName || 'N/A'}</span>
          <span><strong>Expires:</strong> ${doc.expiryDate || 'N/A'}</span>
        </div>
      </div>
      <div class="locker-card-actions">
        <button class="btn-locker-action btn-view-scan" title="View full scan image and details">
          <i data-lucide="eye" style="width: 13px; height: 13px;"></i> View Scan
        </button>
        <button class="btn-locker-action btn-copy-info" title="Copy detail credentials">
          <i data-lucide="copy" style="width: 13px; height: 13px;"></i> Copy Info
        </button>
        <button class="btn-locker-action btn-file-report" style="grid-column: 1 / -1;" title="File a Listing Report">
          <i data-lucide="alert-triangle" style="width: 13px; height: 13px;"></i> Report Item
        </button>
      </div>
    `;

    // Make entire card clickable (except actions) to open details
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-locker-delete') || e.target.closest('.btn-locker-action')) {
        return;
      }
      openLockerDetailModal(doc);
    });

    // View scan trigger
    card.querySelector('.btn-view-scan').addEventListener('click', () => {
      openLockerDetailModal(doc);
    });

    // Copy info trigger
    card.querySelector('.btn-copy-info').addEventListener('click', () => {
      const detailsText = `Document: ${doc.name}\nType: ${doc.type.toUpperCase()}\nID Number: ${doc.docId}\nHolder: ${doc.holderName}\nExpiry: ${doc.expiryDate}\nRaw Text:\n${doc.rawText}`;
      navigator.clipboard.writeText(detailsText).then(() => {
        showAlert("Document details copied to clipboard!", "success");
      }).catch(err => {
        showAlert("Failed to copy details to clipboard.", "error");
      });
    });

    // File report from scanner document
    card.querySelector('.btn-file-report').addEventListener('click', () => {
      if (confirm(`Are you sure you want to report "${doc.name}" as a lost document?`)) {
        const displayUserName = currentUser.name || currentUser.email.split('@')[0];
        const newReport = {
          id: 'item_' + Date.now(),
          title: doc.name,
          category: 'documents',
          status: 'lost',
          date: new Date().toISOString().split('T')[0],
          location: currentUser.address || 'Unknown Location',
          description: `Scanned Credentials:\n- Holder Name: ${doc.holderName}\n- Document ID Number: ${doc.docId}\n- Expiration Date: ${doc.expiryDate}\n\nFull Gemini AI Text transcript:\n${doc.rawText}`,
          image: doc.image || DEFAULT_DOCUMENT_PLACEHOLDER,
          reporterName: displayUserName,
          reporterEmail: currentUser.email,
          reporterPhone: currentUser.phone,
          reporterAddress: currentUser.address,
          createdAt: Date.now()
        };

        fetch(`${API_BASE_URL}/items.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReport)
        })
          .then(async response => {
            let resData;
            try {
              resData = await response.json();
            } catch (e) {
              throw new Error(`Server returned invalid response. Status: ${response.status}`);
            }
            if (!response.ok) {
              throw new Error(resData.message || 'Failed to submit report');
            }

            dbItems.unshift(newReport);
            showAlert(`Document "${doc.name}" reported as LOST successfully!`, "success");

            // Transition to Lost Items view
            const lostTab = document.querySelector('.nav-item[data-view="lost-items"]');
            if (lostTab) {
              lostTab.click();
            } else {
              renderStats();
              renderItems();
            }
          })
          .catch(err => {
            showAlert(err.message, "error");
          });
      }
    });

    // Delete scan trigger
    card.querySelector('.btn-locker-delete').addEventListener('click', () => {
      if (confirm(`Remove "${doc.name}" scan from Safe Locker?`)) {
        fetch(`${API_BASE_URL}/docs.php?id=${doc.id}&userId=${currentUser.id}`, {
          method: 'DELETE'
        })
          .then(async response => {
            let resData;
            try {
              resData = await response.json();
            } catch (e) {
              throw new Error(`Server returned invalid response. Status: ${response.status}`);
            }
            if (!response.ok) {
              throw new Error(resData.message || 'Failed to delete scan');
            }
            dbSavedDocs = dbSavedDocs.filter(d => d.id !== doc.id);
            showAlert("Scan deleted from locker.", "info");
            renderLockerGallery();
          })
          .catch(err => {
            showAlert(err.message, "error");
          });
      }
    });

    lockerGrid.appendChild(card);
  });

  safeCreateIcons();
}

// 6. Item Details Modal & Actions
const detailTitle = document.getElementById('detail-title');
const detailLocation = document.getElementById('detail-location');
const detailDate = document.getElementById('detail-date');
const detailDescription = document.getElementById('detail-description');
const detailImg = document.getElementById('detail-img');
const detailStatusBadge = document.getElementById('detail-status-badge');
const detailReporterName = document.getElementById('detail-reporter-name');
const detailReporterAvatar = document.getElementById('detail-reporter-avatar');
const revealContactBtn = document.getElementById('btn-reveal-contact');
const contactDetailsPanel = document.getElementById('contact-details-panel');
const contactEmailLink = document.getElementById('contact-email-link');
const contactPhoneLink = document.getElementById('contact-phone-link');
const contactAddressText = document.getElementById('contact-address-text');
const deleteReportBtn = document.getElementById('btn-delete-report');
const gotBackBtn = document.getElementById('btn-got-back');

let activeViewingItem = null;

function openDetailModal(item) {
  activeViewingItem = item;

  // Text details
  detailTitle.textContent = item.title;
  detailLocation.textContent = item.location;
  detailDate.textContent = formatDate(item.date);
  detailDescription.textContent = item.description;

  // Image
  detailImg.src = item.image;
  detailImg.alt = item.title;

  // Status Badge styling
  detailStatusBadge.textContent = item.status.toUpperCase();
  detailStatusBadge.className = 'badge detail-badge'; // reset
  if (item.status === 'lost') detailStatusBadge.classList.add('badge-lost');
  else if (item.status === 'found') detailStatusBadge.classList.add('badge-found');
  else detailStatusBadge.classList.add('badge-resolved');

  // Reporter details
  detailReporterName.textContent = item.reporterName;
  detailReporterAvatar.textContent = item.reporterName.substring(0, 2).toUpperCase();

  // Reset contact details reveal panel
  revealContactBtn.classList.remove('hidden');
  contactDetailsPanel.classList.add('hidden');

  // Wire up links
  contactEmailLink.href = `mailto:${item.reporterEmail}`;
  contactEmailLink.textContent = item.reporterEmail;
  contactPhoneLink.href = `tel:${item.reporterPhone}`;
  contactPhoneLink.textContent = item.reporterPhone;
  contactAddressText.textContent = item.reporterAddress || "No address provided";

  // Check ownership for deletion capabilities
  if (currentUser && currentUser.email === item.reporterEmail) {
    deleteReportBtn.classList.remove('hidden');
  } else {
    deleteReportBtn.classList.add('hidden');
  }

  // Show Got Back button if item is lost (owner sees it) or found (non-finder sees it)
  if (gotBackBtn) {
    if (item.status === 'lost' && currentUser && currentUser.email === item.reporterEmail) {
      gotBackBtn.classList.remove('hidden');
    } else if (item.status === 'found' && currentUser && currentUser.email !== item.reporterEmail) {
      gotBackBtn.classList.remove('hidden');
    } else {
      gotBackBtn.classList.add('hidden');
    }
  }

  detailModal.classList.add('active');
}
// Close detail modal
document.getElementById('close-detail-modal').addEventListener('click', () => {
  detailModal.classList.remove('active');
  activeViewingItem = null;
});

// Reveal contact action
revealContactBtn.addEventListener('click', () => {
  revealContactBtn.classList.add('hidden');
  contactDetailsPanel.classList.remove('hidden');
});

// Confetti effect for rewards
function createConfetti() {
  const colors = ['#d4af37', '#10B981', '#3B82F6', '#F59E0B', '#EF4444'];
  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement('div');
    confetti.style.position = 'fixed';
    confetti.style.width = '10px';
    confetti.style.height = '10px';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.top = '-10px';
    confetti.style.borderRadius = '50%';
    confetti.style.zIndex = '9999';
    confetti.style.opacity = Math.random();
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    
    document.body.appendChild(confetti);
    
    const animation = confetti.animate([
      { top: '-10px', transform: `translateX(0) rotate(0deg)` },
      { top: '100vh', transform: `translateX(${(Math.random() - 0.5) * 200}px) rotate(${Math.random() * 720}deg)` }
    ], {
      duration: Math.random() * 2000 + 1500,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });
    
    animation.onfinish = () => confetti.remove();
  }
}

// Automatically scale certificate to perfectly fit any mobile screen
function fitCertificateToScreen() {
  const certContainer = document.querySelector('.premium-certificate');
  if (!certContainer) return;
  const modalBody = certContainer.parentElement;
  
  if (window.innerWidth < 900) {
    // 15px padding on each side of modal-body = 30px
    const availableWidth = modalBody.clientWidth - 30;
    // 800px width + 100px padding + 6px border = 906px
    const scale = availableWidth / 906;
    
    certContainer.style.transform = `scale(${scale})`;
    certContainer.style.transformOrigin = 'top left';
    
    // Set the wrapper's height to match the scaled height exactly
    // This perfectly pulls the buttons up to sit right under the certificate
    const exactHeight = certContainer.offsetHeight;
    const scaleWrapper = document.getElementById('cert-scale-wrapper');
    if (scaleWrapper) {
      scaleWrapper.style.height = `${scale * exactHeight}px`;
    }
  } else {
    certContainer.style.transform = 'none';
    const scaleWrapper = document.getElementById('cert-scale-wrapper');
    if (scaleWrapper) scaleWrapper.style.height = 'auto';
  }
}

window.addEventListener('resize', () => {
  const certModal = document.getElementById('certificate-modal');
  if (certModal && certModal.classList.contains('active')) {
    fitCertificateToScreen();
  }
});

// Show Certificate of Appreciation
function showCertificate(returnerName, itemTitle, dateAwarded, certId) {
  const certModal = document.getElementById('certificate-modal');
  const certRecipientEl = document.getElementById('cert-recipient-name');
  const certItemTitleEl = document.getElementById('cert-item-title');
  const certDateEl = document.getElementById('cert-date');
  const certSerialEl = document.getElementById('cert-serial-number');
  const certQrCodeEl = document.getElementById('cert-qr-code');
  
  if (certRecipientEl) certRecipientEl.textContent = returnerName;
  if (certItemTitleEl) certItemTitleEl.textContent = `"${itemTitle}"`;
  
  const dateObj = dateAwarded ? new Date(dateAwarded) : new Date();
  const dateAwardedStr = dateObj.toISOString().split('T')[0];
  if (certDateEl) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    certDateEl.textContent = dateObj.toLocaleDateString('en-US', options);
  }

  // Generate deterministic serial number
  let serialNo = '';
  if (certId) {
    const numericPart = certId.replace(/[^0-9]/g, '');
    serialNo = `LF-${numericPart || Math.floor(10000000 + Math.random() * 90000000)}`;
  } else {
    serialNo = `LF-${Math.floor(10000000 + Math.random() * 90000000)}`;
  }
  if (certSerialEl) {
    certSerialEl.textContent = `Certificate No: ${serialNo}`;
  }

  // Generate QR code content for scan verification
  const verificationText = `VERIFIED HONESTY CERTIFICATE\nCertificate No: ${serialNo}\nPresented to: ${returnerName}\nFor returning: ${itemTitle}\nAwarded on: ${dateAwardedStr}\nVerification: lostfound Platform`;
  if (certQrCodeEl) {
    certQrCodeEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationText)}`;
  }
  
  if (certModal) {
    certModal.classList.add('active');
    
    // Run scaler immediately, and again after a slight delay to ensure DOM layout is complete
    fitCertificateToScreen();
    setTimeout(fitCertificateToScreen, 50);
    
    createConfetti();
    safeCreateIcons();
  }
}

// Close certificate modal
const closeCertModalBtn = document.getElementById('close-certificate-modal');
const btnCloseCert = document.getElementById('btn-close-cert');
const certModalElement = document.getElementById('certificate-modal');

if (closeCertModalBtn) {
  closeCertModalBtn.addEventListener('click', () => certModalElement.classList.remove('active'));
}
if (btnCloseCert) {
  btnCloseCert.addEventListener('click', () => certModalElement.classList.remove('active'));
}

// Print / Save PDF Certificate Action
const btnPrintCert = document.getElementById('btn-print-certificate');
if (btnPrintCert) {
  // Update text to reflect PDF feature
  btnPrintCert.innerHTML = '<i data-lucide="download"></i> Download PDF';
  if (window.lucide) {
    window.lucide.createIcons();
  }

  btnPrintCert.addEventListener('click', async () => {
    // Show spinner immediately to give instant UI feedback
    const originalHTML = btnPrintCert.innerHTML;
    btnPrintCert.innerHTML = '<i data-lucide="loader" style="animation: spin 1s linear infinite;"></i> Generating PDF...';
    if (window.lucide) window.lucide.createIcons();
    btnPrintCert.disabled = true;

    // Yield back to the browser so it can paint the loading state before the heavy thread-blocking operations start
    await new Promise(r => setTimeout(r, 50));

    try {
    // Wait until fonts and images (like QR code) are fully loaded
    await document.fonts.ready;
    const qrImage = document.getElementById('cert-qr-code');
    if (qrImage && !qrImage.complete) {
      await new Promise(resolve => {
        qrImage.onload = resolve;
        qrImage.onerror = resolve;
      });
    }

    const originalCert = document.querySelector('.premium-certificate');
    
    // Create an invisible wrapper so HTML2CANVAS can render it within viewport bounds
    // Set position absolute (not fixed) to prevent viewport clipping on mobile
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.zIndex = '-9999';
    wrapper.style.opacity = '0';
    wrapper.style.pointerEvents = 'none';

    // Guarantee the clone renders at full high-resolution desktop width
    const targetWidth = Math.max(originalCert.offsetWidth, 906);
    
    // Create a 100% scale clone
    const printClone = originalCert.cloneNode(true);
    printClone.style.transform = 'none';
    printClone.style.marginBottom = '0px';
    printClone.style.width = targetWidth + 'px';
    
    wrapper.appendChild(printClone);
    document.body.appendChild(wrapper);

    // Dynamic margin calculation to center perfectly on A4 Landscape
    const certWidth = printClone.offsetWidth || targetWidth;
    const certHeight = printClone.offsetHeight || 650;
    
    const certRatio = certWidth / certHeight;
    const a4Width = 297;
    const a4Height = 210;
    const baseMargin = 15; // 15mm margins on all sides
    
    const printableWidth = a4Width - (baseMargin * 2);
    const printableHeight = a4Height - (baseMargin * 2);
    const printableRatio = printableWidth / printableHeight;
    
    let marginTop, marginLeft;
    
    if (certRatio > printableRatio) {
      // Constrained by width
      const scaledHeight = printableWidth / certRatio;
      marginTop = (a4Height - scaledHeight) / 2;
      marginLeft = baseMargin;
    } else {
      // Constrained by height
      const scaledWidth = printableHeight * certRatio;
      marginLeft = (a4Width - scaledWidth) / 2;
      marginTop = baseMargin;
    }

    const opt = {
      margin:       [marginTop, marginLeft, marginTop, marginLeft],
      filename:     `Certificate_of_Appreciation_${Date.now()}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { 
        scale: 3, 
        useCORS: true, 
        backgroundColor: '#ffffff', 
        logging: false,
        windowWidth: certWidth + 50,
        windowHeight: certHeight + 50,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    // Generate PDF from the 100% scale clone
    await html2pdf().set(opt).from(printClone).save();
    
    } catch (err) {
      console.error("PDF generation failed:", err);
      showAlert("Error generating PDF. Please try again.", "error");
    } finally {
      // Restore button state
      btnPrintCert.innerHTML = originalHTML;
      if (window.lucide) window.lucide.createIcons();
      btnPrintCert.disabled = false;
      
      // Cleanup DOM
      if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
    }
  });
}

// Got Back Action
if (gotBackBtn) {
  gotBackBtn.addEventListener('click', async () => {
    if (!activeViewingItem) return;
    
    let returnerName = '';
    let returnerEmail = '';
    const nextStatus = activeViewingItem.status === 'found' ? 'resolved_found' : 'resolved_lost';
    let matchingFoundItem = null;
    
    if (activeViewingItem.status === 'found') {
      returnerName = activeViewingItem.reporterName;
      returnerEmail = activeViewingItem.reporterEmail;
    } else {
      // It's a lost item. Automatically scan the database to find the matching 'found' item
      matchingFoundItem = dbItems.find(item => {
        if (item.status !== 'found') return false;
        
        // Helper to extract fields from description text
        const extractField = (desc, label) => {
          if (!desc) return null;
          const regex = new RegExp(label + ':\\s*([^\\n\\r]+)', 'i');
          const match = desc.match(regex);
          if (match) {
            const val = match[1].trim();
            if (val.toLowerCase() !== 'unknown' && val.toLowerCase() !== 'n/a' && val.length > 2) {
              return val.toLowerCase();
            }
          }
          return null;
        };

        // 1. Try to match by extracted Document ID
        const lostDocId = extractField(activeViewingItem.description, 'Document ID Number');
        const foundDocId = extractField(item.description, 'Document ID Number');
        if (lostDocId && foundDocId && lostDocId === foundDocId) return true;

        // 2. Try to match by extracted Holder Name
        const lostHolder = extractField(activeViewingItem.description, 'Holder Name');
        const foundHolder = extractField(item.description, 'Holder Name');
        if (lostHolder && foundHolder && lostHolder === foundHolder) return true;

        // 3. Fallback to category + title keyword overlap
        if (item.category.toLowerCase() !== activeViewingItem.category.toLowerCase()) return false;
        const lostTitle = activeViewingItem.title.toLowerCase();
        const foundTitle = item.title.toLowerCase();
        return lostTitle.includes(foundTitle) || foundTitle.includes(lostTitle) || 
               lostTitle.split(/\s+/).some(word => word.length > 2 && foundTitle.includes(word));
      });

      if (matchingFoundItem) {
        returnerName = matchingFoundItem.reporterName;
        returnerEmail = matchingFoundItem.reporterEmail;
      } else {
        returnerName = "Community Benefactor";
        returnerEmail = "support@lostfound.org";
      }
    }
    
    try {
      // 1. Update the status of the current item
      const response = await fetch(`${API_BASE_URL}/items.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeViewingItem.id, status: nextStatus })
      });
      
      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.message || "Failed to update item status");
      }
      
      // Update local dbItems state
      const dbItem = dbItems.find(item => item.id === activeViewingItem.id);
      if (dbItem) dbItem.status = nextStatus;
      
      // 2. If it was a lost item and we matched a found item, update the found item to resolved_found so the finder gets the certificate
      if (matchingFoundItem) {
        const matchResponse = await fetch(`${API_BASE_URL}/items.php', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: matchingFoundItem.id, status: 'resolved_found' })
        });
        if (matchResponse.ok) {
          const dbMatchItem = dbItems.find(item => item.id === matchingFoundItem.id);
          if (dbMatchItem) dbMatchItem.status = 'resolved_found';
        }
      }
      
      // 3. Create the Certificate row in the separate certificates database table!
      const dateAwardedStr = new Date().toISOString().split('T')[0];
      const certResponse = await fetch(`${API_BASE_URL}/certificates.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: activeViewingItem.id,
          recipientName: returnerName,
          recipientEmail: returnerEmail,
          itemTitle: activeViewingItem.title,
          dateAwarded: dateAwardedStr
        })
      });
      
      let finalCertId = null;
      if (certResponse.ok) {
        const certData = await certResponse.json();
        finalCertId = certData.id;
        if (currentUser && returnerEmail === currentUser.email) {
          dbCertificates.unshift({
            id: certData.id,
            itemId: activeViewingItem.id,
            recipientName: returnerName,
            recipientEmail: returnerEmail,
            itemTitle: activeViewingItem.title,
            dateAwarded: dateAwardedStr
          });
        }
      }

      // Close the detail modal
      detailModal.classList.remove('active');
      
      // Show the Certificate of Appreciation Modal for the returner
      showCertificate(returnerName, activeViewingItem.title, dateAwardedStr, finalCertId);
      
      // Refresh stats and items lists
      renderStats();
      renderItems();
      
    } catch (error) {
      showAlert("Error updating item status: " + error.message, "error");
    }
  });
}

// Centralized function to delete listing from DB and UI
function deleteListing(itemId) {
  if (!currentUser) return;

  if (confirm("Are you sure you want to delete this listing report?")) {
    fetch(`${API_BASE_URL}/items.php?id=${itemId}&email=${currentUser.email}`, {
      method: 'DELETE'
    })
      .then(async response => {
        let resData;
        try {
          resData = await response.json();
        } catch (e) {
          throw new Error(`Server returned invalid response. Status: ${response.status}`);
        }
        if (!response.ok) {
          throw new Error(resData.message || 'Failed to delete listing');
        }

        dbItems = dbItems.filter(item => item.id !== itemId);
        showAlert("Item report deleted successfully.", "success");

        if (detailModal.classList.contains('active') && activeViewingItem && activeViewingItem.id === itemId) {
          detailModal.classList.remove('active');
          activeViewingItem = null;
        }

        renderStats();
        renderItems();
      })
      .catch(err => {
        showAlert(err.message, "error");
      });
  }
}
window.deleteListingDirect = deleteListing;

// Delete Item Button from Modal
deleteReportBtn.addEventListener('click', () => {
  if (!activeViewingItem) return;
  deleteListing(activeViewingItem.id);
});

// -------------------------------------------------------------------------- //
//                           REPORT ITEM MODAL HANDLER                        //
// -------------------------------------------------------------------------- //

const fileDropZone = document.getElementById('file-drop-zone');
const reportImageInput = document.getElementById('report-image-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const selectDocGroup = document.getElementById('select-doc-group');
const reportSelectDoc = document.getElementById('report-select-doc');

// Populate Saved Documents in dropdown
function populateSavedDocsDropdown() {
  if (!selectDocGroup || !reportSelectDoc) return;

  if (dbSavedDocs && dbSavedDocs.length > 0) {
    selectDocGroup.classList.remove('hidden');
    reportSelectDoc.innerHTML = '<option value="">-- Choose a saved document --</option>';
    dbSavedDocs.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = `${doc.name} (${doc.type.replace('_', ' ').toUpperCase()})`;
      reportSelectDoc.appendChild(option);
    });
  } else {
    selectDocGroup.classList.remove('hidden');
    reportSelectDoc.innerHTML = '<option value="">-- No documents uploaded. Please upload to Safe Locker first --</option>';
  }
}

const reportStatusSelect = document.getElementById('report-status');

function toggleReportFormMode() {
  if (!reportStatusSelect) return;
  const status = reportStatusSelect.value;
  const dropTextPrimary = fileDropZone.querySelector('.primary-text');
  const reportTitle = document.getElementById('report-title');
  const reportDescription = document.getElementById('report-description');

  if (status === 'lost') {
    // Show select document group & make it required
    selectDocGroup.classList.remove('hidden');
    reportSelectDoc.required = true;

    // Make title/description readonly
    reportTitle.readOnly = true;
    reportTitle.placeholder = "Will be filled from selected document";
    reportDescription.readOnly = true;
    reportDescription.placeholder = "Will be filled from selected document";

    // Disable drop zone for manual upload
    fileDropZone.style.pointerEvents = 'none';
    fileDropZone.style.opacity = '0.85';
    if (dropTextPrimary) dropTextPrimary.textContent = "Photo is linked to the selected document";
    reportImageInput.disabled = true;
    const btnReportCamera = document.getElementById('btn-report-camera');
    const reportCameraInput = document.getElementById('report-camera-input');
    if (btnReportCamera) btnReportCamera.classList.add('hidden');
    if (reportCameraInput) reportCameraInput.disabled = true;
    if (removeImageBtn) removeImageBtn.classList.add('hidden');

    // Clear preview if no document is selected
    if (!reportSelectDoc.value) {
      clearImagePreview();
      reportTitle.value = '';
      reportDescription.value = '';
    } else {
      // Trigger the selection logic to populate it
      const doc = dbSavedDocs.find(d => d.id === reportSelectDoc.value);
      if (doc) {
        reportTitle.value = doc.name;
        reportDescription.value = `Scanned Credentials:\n- Holder Name: ${doc.holderName}\n- Document ID Number: ${doc.docId}\n- Expiration Date: ${doc.expiryDate}\n\nFull Gemini AI Text transcript:\n${doc.rawText}`;
        if (doc.image) {
          currentImageData = doc.image;
          imagePreview.src = currentImageData;
          imagePreviewContainer.classList.remove('hidden');
        }
      }
    }
  } else {
    // Found mode
    // Hide select document group & remove required
    selectDocGroup.classList.add('hidden');
    reportSelectDoc.required = false;
    reportSelectDoc.value = '';

    // Make title/description editable
    reportTitle.readOnly = false;
    reportTitle.placeholder = "e.g. Found Blue Leather Wallet, Driver's License";
    reportDescription.readOnly = false;
    reportDescription.placeholder = "Provide distinct details e.g. name on card, location found, color...";

    // Enable drop zone for manual upload
    fileDropZone.style.pointerEvents = 'auto';
    fileDropZone.style.opacity = '1';
    if (dropTextPrimary) {
      dropTextPrimary.innerHTML = 'Drag and drop an image or <span>browse files</span>';
    }
    reportImageInput.disabled = false;
    const btnReportCamera = document.getElementById('btn-report-camera');
    const reportCameraInput = document.getElementById('report-camera-input');
    if (btnReportCamera) btnReportCamera.classList.remove('hidden');
    if (reportCameraInput) reportCameraInput.disabled = false;
    if (removeImageBtn) removeImageBtn.classList.remove('hidden');

    // Clear preview so they can upload their own
    clearImagePreview();
    reportTitle.value = '';
    reportDescription.value = '';
  }
}

if (reportStatusSelect) {
  reportStatusSelect.addEventListener('change', toggleReportFormMode);
}

// Add change listener to report select document dropdown
if (reportSelectDoc) {
  reportSelectDoc.addEventListener('change', (e) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      document.getElementById('report-title').value = '';
      document.getElementById('report-description').value = '';
      clearImagePreview();
      return;
    }

    const doc = dbSavedDocs.find(d => d.id === selectedId);
    if (doc) {
      const reportTitle = document.getElementById('report-title');
      const reportDescription = document.getElementById('report-description');

      if (reportTitle) reportTitle.value = doc.name;

      if (reportDescription) {
        reportDescription.value = `Scanned Credentials:\n- Holder Name: ${doc.holderName}\n- Document ID Number: ${doc.docId}\n- Expiration Date: ${doc.expiryDate}\n\nFull Gemini AI Text transcript:\n${doc.rawText}`;
      }

      if (doc.image) {
        currentImageData = doc.image;
        if (imagePreview && imagePreviewContainer) {
          imagePreview.src = currentImageData;
          imagePreviewContainer.classList.remove('hidden');
        }
      }
    }
  });
}

// Open report modal (Lost mode by default)
reportTriggerBtn.addEventListener('click', () => {
  // Pre-fill date with current date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('report-date').value = today;

  // Default to lost mode
  if (reportStatusSelect) {
    reportStatusSelect.value = 'lost';
  }

  // Populate the documents dropdown
  populateSavedDocsDropdown();

  // Run toggle
  toggleReportFormMode();

  reportModal.classList.add('active');
});

// Open report modal in Found mode
const reportFoundTriggerBtn = document.getElementById('btn-report-found-trigger');
if (reportFoundTriggerBtn) {
  reportFoundTriggerBtn.addEventListener('click', () => {
    // Pre-fill date with current date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('report-date').value = today;

    // Set status to found
    if (reportStatusSelect) {
      reportStatusSelect.value = 'found';
    }

    // Populate the documents dropdown
    populateSavedDocsDropdown();

    // Run toggle
    toggleReportFormMode();

    reportModal.classList.add('active');
  });
}

// Close buttons
const closeReport = () => {
  reportModal.classList.remove('active');
  reportForm.reset();
  clearImagePreview();
};

document.getElementById('close-report-modal').addEventListener('click', closeReport);
cancelReportBtn.addEventListener('click', closeReport);

function clearImagePreview() {
  currentImageData = null;
  imagePreview.src = '';
  imagePreviewContainer.classList.add('hidden');
  if (reportImageInput) {
    reportImageInput.value = '';
  }
  const aiAnalysisContainer = document.getElementById('ai-analysis-container');
  if (aiAnalysisContainer) {
    aiAnalysisContainer.classList.add('hidden');
  }
  const matchContainer = document.getElementById('match-result-container');
  if (matchContainer) {
    matchContainer.innerHTML = '';
    matchContainer.classList.add('hidden');
  }
  const submitBtn = reportForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = false;
  }
}

// File Drop Zone Clicks & Drags for manual upload (active only in Found mode)
fileDropZone.addEventListener('click', (e) => {
  if (reportStatusSelect && reportStatusSelect.value === 'found') {
    if (e.target.closest('#btn-report-camera')) return;
    reportImageInput.click();
  }
});

fileDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (reportStatusSelect && reportStatusSelect.value === 'found') {
    fileDropZone.classList.add('dragover');
  }
});

fileDropZone.addEventListener('dragleave', () => {
  fileDropZone.classList.remove('dragover');
});

fileDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  fileDropZone.classList.remove('dragover');

  if (reportStatusSelect && reportStatusSelect.value === 'found' && e.dataTransfer.files.length > 0) {
    handleImageFile(e.dataTransfer.files[0]);
  }
});

const btnReportCamera = document.getElementById('btn-report-camera');
const reportCameraInput = document.getElementById('report-camera-input');
if (btnReportCamera && reportCameraInput) {
  btnReportCamera.addEventListener('click', (e) => {
    e.stopPropagation();
    reportCameraInput.click();
  });
}

if (reportCameraInput) {
  reportCameraInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageFile(e.target.files[0]);
    }
  });
}

reportImageInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleImageFile(e.target.files[0]);
  }
});

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showAlert("Please upload image files only.", "error");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showAlert("File is too large. Max size is 10MB.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    openCropEditor(e.target.result, 'reporter');
  };
  reader.readAsDataURL(file);
}

if (removeImageBtn) {
  removeImageBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent triggering input selector
    if (reportStatusSelect && reportStatusSelect.value === 'found') {
      clearImagePreview();
    }
  });
}

// AI OCR Scanning & Database Owner Matching for Found Items
function runFoundDocumentOcrAndMatch(base64Data) {
  const scanLaser = document.getElementById('report-scan-laser');
  const submitBtn = reportForm.querySelector('button[type="submit"]');
  const matchContainer = document.getElementById('match-result-container');
  const reportTitle = document.getElementById('report-title');
  const reportDescription = document.getElementById('report-description');

  if (scanLaser) scanLaser.classList.remove('hidden');
  if (submitBtn) submitBtn.disabled = true;
  if (matchContainer) {
    matchContainer.classList.add('hidden');
    matchContainer.innerHTML = '';
  }

  showAlert("Google Gemini AI: Analyzing document image...", "info");

  fetch(`${API_BASE_URL}/analyze.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Data })
  })
    .then(async response => {
      let resData;
      try {
        resData = await response.json();
      } catch (e) {
        throw new Error(`Server returned invalid response. Status: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(resData.message || 'Analysis failed');
      }

      processAndMatchFoundData(resData);
    })
    .catch(err => {
      showAlert("AI Scanning failed: " + err.message, "error");
      finishFoundScanning(null);
    });
}

function runFoundDocumentLocalOcrFallback(base64Data) {
  if (typeof Tesseract === 'undefined') {
    showAlert("OCR library offline. Cannot parse document.", "error");
    finishFoundScanning(null);
    return;
  }

  Tesseract.recognize(
    base64Data,
    'eng'
  )
    .then(({ data: { text } }) => {
      const upperText = text.toUpperCase();
      let docType = 'other';
      let docName = 'Scanned Document';

      if (upperText.includes('PASSPORT')) {
        docType = 'passport';
        docName = 'US Passport';
      } else if (upperText.includes('LICENSE') || upperText.includes('DRIVE') || upperText.includes('DL')) {
        docType = 'driver_license';
        docName = "Driver's License";
      } else if (upperText.includes('STUDENT') || upperText.includes('UNIVERSITY') || upperText.includes('COLLEGE')) {
        docType = 'student_id';
        docName = 'Student ID Card';
      } else if (upperText.includes('VISA') || upperText.includes('MASTERCARD') || upperText.includes('DEBIT') || upperText.includes('CREDIT') || upperText.includes('CARD')) {
        docType = 'credit_card';
        docName = 'Personal Card';
      } else if (upperText.includes('RECEIPT') || upperText.includes('INVOICE') || upperText.includes('TOTAL') || upperText.includes('CASH')) {
        docType = 'receipt';
        docName = 'Purchase Receipt';
      }

      // Holder Name extraction:
      let holderName = '';
      const nameMatch = text.match(/(?:name|holder|holder's name|issued to|full name)[:\s]+([A-Za-z\s]+)/i);
      if (nameMatch && nameMatch[1]) {
        holderName = nameMatch[1].trim().split('\n')[0];
      } else {
        holderName = 'Unknown Holder';
      }

      // Document ID extraction:
      let docId = '';
      const idMatch = text.match(/(?:id|document no|passport no|number|no|card no)[:\s#]+([A-Z0-9-]+)/i);
      if (idMatch && idMatch[1]) {
        docId = idMatch[1].trim();
      } else {
        const generalIdMatch = text.match(/[A-Z0-9]{6,12}/);
        docId = generalIdMatch ? generalIdMatch[0] : '';
      }

      // Expiration Date extraction:
      let expiry = 'N/A';
      const dateMatch = text.match(/(?:expiry|expires|exp|valid thru)[:\s]+([0-9\/-]+)/i);
      if (dateMatch && dateMatch[1]) {
        expiry = dateMatch[1].trim();
      } else {
        const generalDateMatch = text.match(/\d{4}-\d{2}-\d{2}/) || text.match(/\d{2}\/\d{2}\/\d{4}/);
        expiry = generalDateMatch ? generalDateMatch[0] : 'N/A';
      }

      const parsedData = {
        type: docType,
        name: docName,
        id: docId,
        holderName: holderName,
        expiryDate: expiry,
        rawText: text
      };

      processAndMatchFoundData(parsedData);
    })
    .catch(err => {
      showAlert(`Local OCR failed: ${err.message}`, "error");
      finishFoundScanning(null);
    });
}

function processAndMatchFoundData(data) {
  const reportTitle = document.getElementById('report-title');
  const reportDescription = document.getElementById('report-description');
  const aiAnalysisContainer = document.getElementById('ai-analysis-container');

  if (reportTitle) reportTitle.value = `Found ${data.name || 'Document'}`;
  if (reportDescription) {
    reportDescription.value = `Scanned Credentials:\n- Holder Name: ${data.holderName || 'Unknown'}\n- Document ID Number: ${data.id || 'Unknown'}\n- Expiration Date: ${data.expiryDate || 'N/A'}\n\nFull Gemini AI Transcript:\n${data.rawText || ''}`;
  }

  // Populate and show the AI analysis review block
  if (aiAnalysisContainer) {
    aiAnalysisContainer.classList.remove('hidden');
    document.getElementById('analysis-type').textContent = (data.type || 'Other').toUpperCase();
    document.getElementById('analysis-id').textContent = data.id || 'Unknown';
    document.getElementById('analysis-holder').textContent = data.holderName || 'Unknown';
    document.getElementById('analysis-expiry').textContent = data.expiryDate || 'N/A';
    safeCreateIcons();
  }

  // Call matching backend
  fetch(`${API_BASE_URL}/match.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      docId: data.id || '',
      holderName: data.holderName || '',
      type: data.type || ''
    })
  })
    .then(async response => {
      let resData;
      try {
        resData = await response.json();
      } catch (e) {
        throw new Error("Invalid response from matching server.");
      }

      finishFoundScanning(resData);
    })
    .catch(err => {
      console.error("Match call failed: ", err);
      finishFoundScanning(null);
    });
}

function finishFoundScanning(matchResult) {
  const scanLaser = document.getElementById('report-scan-laser');
  const submitBtn = reportForm.querySelector('button[type="submit"]');
  const matchContainer = document.getElementById('match-result-container');

  if (scanLaser) scanLaser.classList.add('hidden');
  if (submitBtn) submitBtn.disabled = false;

  if (matchResult && matchResult.matched) {
    showAlert("Success! Matching document owner found in database!", "success");
    if (matchContainer) {
      matchContainer.classList.remove('hidden');
      const owner = matchResult.owner;
      matchContainer.innerHTML = `
        <h4><i data-lucide="shield-check"></i> Owner Match Found!</h4>
        <div class="owner-contact-card">
          <div class="owner-contact-row">
            <i data-lucide="user"></i>
            <span><strong>Name:</strong> ${owner.name}</span>
          </div>
          <div class="owner-contact-row">
            <i data-lucide="mail"></i>
            <span><strong>Email:</strong> <a href="mailto:${owner.email}" style="color: var(--brand-primary); text-decoration: underline;">${owner.email}</a></span>
          </div>
          <div class="owner-contact-row">
            <i data-lucide="phone"></i>
            <span><strong>Phone:</strong> <a href="tel:${owner.phone}" style="color: var(--brand-primary); text-decoration: underline;">${owner.phone}</a></span>
          </div>
          <div class="owner-contact-row">
            <i data-lucide="map-pin"></i>
            <span><strong>Address:</strong> ${owner.address}</span>
          </div>
        </div>
      `;
      safeCreateIcons();
    }
  } else {
    showAlert("AI Scanning complete. No matching owner records found.", "info");
    if (matchContainer) {
      matchContainer.classList.add('hidden');
      matchContainer.innerHTML = '';
    }
  }
}

// FORM SUBMISSION FOR REPORTING
reportForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const title = document.getElementById('report-title').value.trim();
  const status = document.getElementById('report-status').value;
  const category = 'documents';
  const date = document.getElementById('report-date').value;
  const location = document.getElementById('report-location').value.trim();
  const description = document.getElementById('report-description').value.trim();

  if (status === 'found' && !currentImageData) {
    showAlert("Please upload a photo of the found document.", "error");
    return;
  }

  // Fallback image if none uploaded
  const imgUrl = currentImageData || DEFAULT_DOCUMENT_PLACEHOLDER;

  // Build new report item
  const displayUserName = currentUser.name || currentUser.email.split('@')[0];
  const newReport = {
    id: 'item_' + Date.now(),
    title: title,
    category: category,
    status: status,
    date: date,
    location: location,
    description: description,
    image: imgUrl,
    reporterName: displayUserName,
    reporterEmail: currentUser.email,
    reporterPhone: currentUser.phone,
    reporterAddress: currentUser.address,
    createdAt: Date.now()
  };

  fetch(`${API_BASE_URL}/items.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReport)
  })
    .then(async response => {
      let resData;
      try {
        resData = await response.json();
      } catch (e) {
        throw new Error(`Server returned invalid response. Status: ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(resData.message || 'Failed to submit report');
      }

      dbItems.unshift(newReport);
      showAlert(`Report submitted successfully! Item listed as ${status.toUpperCase()}.`, "success");
      closeReport();

      renderStats();
      renderItems();
    })
    .catch(err => {
      showAlert(err.message, "error");
    });
});

// -------------------------------------------------------------------------- //
//                       LOCKER DETAILS MODAL ACTION                         //
// -------------------------------------------------------------------------- //
const lockerDetailModal = document.getElementById('locker-detail-modal');
const lockerDetailTitle = document.getElementById('locker-detail-title');
const lockerDetailImg = document.getElementById('locker-detail-img');
const lockerDetailType = document.getElementById('locker-detail-type');
const lockerDetailId = document.getElementById('locker-detail-id');
const lockerDetailHolder = document.getElementById('locker-detail-holder');
const lockerDetailExpiry = document.getElementById('locker-detail-expiry');
const lockerDetailScanned = document.getElementById('locker-detail-scanned');
const lockerDetailRawtext = document.getElementById('locker-detail-rawtext');

function openLockerDetailModal(doc) {
  if (!lockerDetailModal) return;

  lockerDetailTitle.textContent = doc.name;
  lockerDetailImg.src = doc.image || DEFAULT_DOCUMENT_PLACEHOLDER;
  lockerDetailImg.alt = doc.name;

  lockerDetailType.textContent = doc.type.replace('_', ' ').toUpperCase();
  lockerDetailId.textContent = doc.docId || 'N/A';
  lockerDetailHolder.textContent = doc.holderName || 'N/A';
  lockerDetailExpiry.textContent = doc.expiryDate || 'N/A';
  
  let scannedDateStr = 'N/A';
  if (doc.createdAt) {
    const numTs = Number(doc.createdAt);
    scannedDateStr = !isNaN(numTs) ? formatDate(numTs) : formatDate(doc.createdAt);
  }
  if (lockerDetailScanned) {
    lockerDetailScanned.textContent = scannedDateStr;
  }
  
  lockerDetailRawtext.value = doc.rawText || 'No transcript text available.';

  lockerDetailModal.classList.add('active');
  safeCreateIcons();
}

// Close locker detail modal
const closeLockerModalBtn = document.getElementById('close-locker-modal');
if (closeLockerModalBtn) {
  closeLockerModalBtn.addEventListener('click', () => {
    lockerDetailModal.classList.remove('active');
  });
}

// Close locker modal on overlay click
if (lockerDetailModal) {
  lockerDetailModal.addEventListener('click', (e) => {
    if (e.target === lockerDetailModal) {
      lockerDetailModal.classList.remove('active');
    }
  });
}

// -------------------------------------------------------------------------- //
//                             INITIALIZATION RUN                             //
// -------------------------------------------------------------------------- //

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // Check if running on file:// protocol
  if (window.location.protocol === 'file:') {
    setTimeout(() => {
      showAlert("Warning: You opened this app via file:// protocol. The PHP backend requires a web server. Please open http://localhost:8000 in your browser.", "error");
    }, 500);
  }

  // Check active session
  if (currentUser) {
    transitionToDashboard();
  } else {
    // Keep auth panel active
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    safeCreateIcons();
  }
});

// -------------------------------------------------------------------------- //
//                       ADVANCED DOCUMENT CROP EDITOR & WARP                 //
// -------------------------------------------------------------------------- //

let originalImage = null;
let currentImageCorners = []; // Coordinates on the ORIGINAL image size
let activeCornerIdx = -1;
let editorScale = 1.0;
let drawWidth = 0;
let drawHeight = 0;
let targetInputSource = 'scanner'; // 'scanner' or 'reporter'

function openCropEditor(imgSrc, source) {
  targetInputSource = source;
  originalImage = new Image();
  originalImage.onload = function() {
    // 1. Initial Corner Detection
    // Draw to a temp canvas to inspect pixels
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalImage.width;
    tempCanvas.height = originalImage.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(originalImage, 0, 0);

    currentImageCorners = detectDocumentCorners(tempCanvas);

    // 2. Open Modal
    const modal = document.getElementById('crop-editor-modal');
    if (modal) modal.classList.add('active');

    // 3. Render Editor
    initCropEditorCanvas();
    safeCreateIcons();
  };
  originalImage.src = imgSrc;
}

function detectDocumentCorners(canvas) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  // Helper to get grayscale value at (x, y)
  function getGray(x, y) {
    const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
    return pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114;
  }

  const cx = width / 2;
  const cy = height / 2;

  // Target corner points
  let corners = [
    { x: width * 0.15, y: height * 0.15 }, // TL
    { x: width * 0.85, y: height * 0.15 }, // TR
    { x: width * 0.85, y: height * 0.85 }, // BR
    { x: width * 0.15, y: height * 0.85 }  // BL
  ];

  // Search directions: target corners
  const dirs = [
    { targetX: 0, targetY: 0, index: 0 },
    { targetX: width, targetY: 0, index: 1 },
    { targetX: width, targetY: height, index: 2 },
    { targetX: 0, targetY: height, index: 3 }
  ];

  dirs.forEach(dir => {
    let maxGrad = -1;
    let bestX = corners[dir.index].x;
    let bestY = corners[dir.index].y;

    const steps = 100;
    const startStep = Math.floor(steps * 0.2);
    const endStep = Math.floor(steps * 0.95);

    let prevVal = getGray(cx + (dir.targetX - cx) * (startStep - 1) / steps, cy + (dir.targetY - cy) * (startStep - 1) / steps);

    for (let s = startStep; s <= endStep; s++) {
      const t = s / steps;
      const x = cx + (dir.targetX - cx) * t;
      const y = cy + (dir.targetY - cy) * t;

      if (x < 0 || x >= width || y < 0 || y >= height) break;

      const val = getGray(x, y);
      const grad = Math.abs(val - prevVal);

      if (grad > maxGrad) {
        maxGrad = grad;
        bestX = x;
        bestY = y;
      }
      prevVal = val;
    }

    if (maxGrad > 10) {
      corners[dir.index] = { x: bestX, y: bestY };
    }
  });

  return corners;
}

function initCropEditorCanvas() {
  const canvas = document.getElementById('crop-editor-canvas');
  if (!canvas || !originalImage) return;

  // Fit canvas dimensions to screen viewport
  const maxViewW = Math.min(window.innerWidth - 60, 680);
  const maxViewH = Math.min(window.innerHeight - 300, 420);

  let w = originalImage.width;
  let h = originalImage.height;

  if (w > maxViewW) {
    h = Math.round((h * maxViewW) / w);
    w = maxViewW;
  }
  if (h > maxViewH) {
    w = Math.round((w * maxViewH) / h);
    h = maxViewH;
  }

  canvas.width = w;
  canvas.height = h;

  editorScale = w / originalImage.width;
  drawWidth = w;
  drawHeight = h;

  drawCropEditor();
}

function drawCropEditor() {
  const canvas = document.getElementById('crop-editor-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // 1. Draw Image
  ctx.drawImage(originalImage, 0, 0, w, h);

  // 2. Draw Quad Boundary Lines
  ctx.strokeStyle = '#6366F1'; // Brand primary
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(currentImageCorners[0].x * editorScale, currentImageCorners[0].y * editorScale);
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(currentImageCorners[i].x * editorScale, currentImageCorners[i].y * editorScale);
  }
  ctx.closePath();
  ctx.stroke();

  // Draw semi-transparent overlay outside the crop boundary
  ctx.fillStyle = 'rgba(9, 13, 22, 0.55)';
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.moveTo(currentImageCorners[0].x * editorScale, currentImageCorners[0].y * editorScale);
  ctx.lineTo(currentImageCorners[3].x * editorScale, currentImageCorners[3].y * editorScale);
  ctx.lineTo(currentImageCorners[2].x * editorScale, currentImageCorners[2].y * editorScale);
  ctx.lineTo(currentImageCorners[1].x * editorScale, currentImageCorners[1].y * editorScale);
  ctx.closePath();
  ctx.fill('evenodd');

  // 3. Draw Corner Handles (circles with border)
  const handleRadius = 11;
  for (let i = 0; i < 4; i++) {
    const cx = currentImageCorners[i].x * editorScale;
    const cy = currentImageCorners[i].y * editorScale;

    ctx.fillStyle = '#6366F1';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.arc(cx, cy, handleRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Draw little inner dot
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
  
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;
  
  return {
    x: (cssX / rect.width) * canvas.width,
    y: (cssY / rect.height) * canvas.height,
    cssX: cssX,
    cssY: cssY
  };
}

function handleStart(evt) {
  const canvas = document.getElementById('crop-editor-canvas');
  if (!canvas) return;
  const pos = getMousePos(canvas, evt);
  const rect = canvas.getBoundingClientRect();

  const clickRadius = 28; // Click/touch radius in screen CSS pixels
  activeCornerIdx = -1;

  for (let i = 0; i < 4; i++) {
    // Map buffer coordinates of handles to current CSS coordinates
    const hBufferX = currentImageCorners[i].x * editorScale;
    const hBufferY = currentImageCorners[i].y * editorScale;
    const hCssX = (hBufferX / canvas.width) * rect.width;
    const hCssY = (hBufferY / canvas.height) * rect.height;

    const dist = Math.hypot(pos.cssX - hCssX, pos.cssY - hCssY);
    if (dist < clickRadius) {
      activeCornerIdx = i;
      break;
    }
  }
  
  if (activeCornerIdx !== -1) {
    evt.preventDefault();
  }
}

function handleMove(evt) {
  if (activeCornerIdx === -1) return;
  const canvas = document.getElementById('crop-editor-canvas');
  if (!canvas) return;
  const pos = getMousePos(canvas, evt);

  const px = Math.min(originalImage.width, Math.max(0, pos.x / editorScale));
  const py = Math.min(originalImage.height, Math.max(0, pos.y / editorScale));

  currentImageCorners[activeCornerIdx] = { x: px, y: py };
  evt.preventDefault();
  drawCropEditor();
}

function handleEnd() {
  activeCornerIdx = -1;
}

// Bind Canvas Touch & Mouse Events
const cropCanvas = document.getElementById('crop-editor-canvas');
if (cropCanvas) {
  cropCanvas.addEventListener('mousedown', handleStart);
  cropCanvas.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);

  cropCanvas.addEventListener('touchstart', handleStart, { passive: false });
  cropCanvas.addEventListener('touchmove', handleMove, { passive: false });
  window.addEventListener('touchend', handleEnd);
}

// Bind Close & Cancel crop buttons
function closeCropModal() {
  const modal = document.getElementById('crop-editor-modal');
  if (modal) modal.classList.remove('active');
  originalImage = null;
  activeCornerIdx = -1;
}

const closeCropBtn = document.getElementById('close-crop-editor');
if (closeCropBtn) closeCropBtn.addEventListener('click', closeCropModal);

const btnCropCancel = document.getElementById('btn-crop-cancel');
if (btnCropCancel) btnCropCancel.addEventListener('click', closeCropModal);

// Rotate Image 90 Degrees Clockwise
const btnCropRotate = document.getElementById('btn-crop-rotate');
if (btnCropRotate) {
  btnCropRotate.addEventListener('click', () => {
    if (!originalImage) return;

    const canvas = document.createElement('canvas');
    canvas.width = originalImage.height;
    canvas.height = originalImage.width;
    const ctx = canvas.getContext('2d');

    ctx.translate(originalImage.height / 2, originalImage.width / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(originalImage, -originalImage.width / 2, -originalImage.height / 2);

    const rotatedSrc = canvas.toDataURL('image/jpeg', 0.95);
    originalImage = new Image();
    originalImage.onload = function() {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalImage.width;
      tempCanvas.height = originalImage.height;
      tempCanvas.getContext('2d').drawImage(originalImage, 0, 0);
      currentImageCorners = detectDocumentCorners(tempCanvas);

      initCropEditorCanvas();
    };
    originalImage.src = rotatedSrc;
  });
}

// Reset corners to full screen bounds
const btnCropReset = document.getElementById('btn-crop-reset');
if (btnCropReset) {
  btnCropReset.addEventListener('click', () => {
    if (!originalImage) return;
    currentImageCorners = [
      { x: 0, y: 0 },
      { x: originalImage.width, y: 0 },
      { x: originalImage.width, y: originalImage.height },
      { x: 0, y: originalImage.height }
    ];
    drawCropEditor();
  });
}

// Process and Perspective Warp Submit Handler
const btnCropSubmit = document.getElementById('btn-crop-submit');
if (btnCropSubmit) {
  btnCropSubmit.addEventListener('click', () => {
    if (!originalImage) return;

    const p0 = currentImageCorners[0];
    const p1 = currentImageCorners[1];
    const p2 = currentImageCorners[2];
    const p3 = currentImageCorners[3];

    const widthA = Math.hypot(p2.x - p3.x, p2.y - p3.y);
    const widthB = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const targetW = Math.max(widthA, widthB);

    const heightA = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const heightB = Math.hypot(p0.x - p3.x, p0.y - p3.y);
    const targetH = Math.max(heightA, heightB);

    // Bound size to 1200 max dimension
    const maxBound = 1200;
    let w = targetW;
    let h = targetH;

    if (w > maxBound) {
      h = Math.round((h * maxBound) / w);
      w = maxBound;
    }
    if (h > maxBound) {
      w = Math.round((w * maxBound) / h);
      h = maxBound;
    }

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = originalImage.width;
    srcCanvas.height = originalImage.height;
    srcCanvas.getContext('2d').drawImage(originalImage, 0, 0);

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = w;
    dstCanvas.height = h;

    const srcCoords = [p0, p1, p2, p3];
    const dstCoords = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h }
    ];

    // Homography Warp
    const transform = getPerspectiveTransform(srcCoords, dstCoords);
    warpPerspective(srcCanvas, dstCanvas, transform);

    // Apply Enhancements (Contrast: 1.18, Brightness: 10, Sharpen: true)
    enhanceImage(dstCanvas, 10, 1.18, true);

    const processedBase64 = dstCanvas.toDataURL('image/jpeg', 0.82);

    if (targetInputSource === 'scanner') {
      scannedDocBase64 = processedBase64;
      docImagePreview.src = scannedDocBase64;
      dropZoneIdle.classList.add('hidden');
      dropZoneActive.classList.remove('hidden');
      runAutomatedScanAndSave();
    } else {
      currentImageData = processedBase64;
      imagePreview.src = currentImageData;
      imagePreviewContainer.classList.remove('hidden');

      if (reportStatusSelect && reportStatusSelect.value === 'found') {
        runFoundDocumentOcrAndMatch(currentImageData);
      }
    }

    closeCropModal();
    showAlert("Document processed and optimized successfully!", "success");
  });
}

// -------------------------------------------------------------------------- //
//                        HOMOGRAPHY & IMAGE PROCESSING MATH                  //
// -------------------------------------------------------------------------- //

function getPerspectiveTransform(src, dst) {
  const A = [];
  const B = [];
  for (let i = 0; i < 4; i++) {
    const s = src[i];
    const d = dst[i];
    A.push([d.x, d.y, 1, 0, 0, 0, -s.x * d.x, -s.x * d.y]);
    B.push(s.x);
    A.push([0, 0, 0, d.x, d.y, 1, -s.y * d.x, -s.y * d.y]);
    B.push(s.y);
  }
  return solveLinearSystem(A, B);
}

function solveLinearSystem(A, B) {
  const n = B.length;
  for (let i = 0; i < n; i++) {
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }
    for (let k = i; k < n; k++) {
      const tmp = A[maxRow][k];
      A[maxRow][k] = A[i][k];
      A[i][k] = tmp;
    }
    const tmp = B[maxRow];
    B[maxRow] = B[i];
    B[i] = tmp;

    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) A[k][j] = 0;
        else A[k][j] += c * A[i][j];
      }
      B[k] += c * B[i];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = B[i] / A[i][i];
    for (let k = i - 1; k >= 0; k--) {
      B[k] -= A[k][i] * x[i];
    }
  }
  return x;
}

function warpPerspective(srcCanvas, dstCanvas, transform) {
  const srcCtx = srcCanvas.getContext('2d');
  const dstCtx = dstCanvas.getContext('2d');
  const srcWidth = srcCanvas.width;
  const srcHeight = srcCanvas.height;
  const dstWidth = dstCanvas.width;
  const dstHeight = dstCanvas.height;

  const srcData = srcCtx.getImageData(0, 0, srcWidth, srcHeight);
  const dstData = dstCtx.createImageData(dstWidth, dstHeight);
  const sPixels = srcData.data;
  const dPixels = dstData.data;

  const [a, b, c, d, e, f, g, h] = transform;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const denominator = g * x + h * y + 1;
      const sx = (a * x + b * y + c) / denominator;
      const sy = (d * x + e * y + f) / denominator;

      if (sx >= 0 && sx < srcWidth - 1 && sy >= 0 && sy < srcHeight - 1) {
        const ix = Math.floor(sx);
        const iy = Math.floor(sy);
        const dx = sx - ix;
        const dy = sy - iy;

        const idx00 = (iy * srcWidth + ix) * 4;
        const idx10 = (iy * srcWidth + (ix + 1)) * 4;
        const idx01 = ((iy + 1) * srcWidth + ix) * 4;
        const idx11 = ((iy + 1) * srcWidth + (ix + 1)) * 4;

        const targetIdx = (y * dstWidth + x) * 4;

        for (let chan = 0; chan < 4; chan++) {
          const val00 = sPixels[idx00 + chan];
          const val10 = sPixels[idx10 + chan];
          const val01 = sPixels[idx01 + chan];
          const val11 = sPixels[idx11 + chan];

          const val = val00 * (1 - dx) * (1 - dy) +
                      val10 * dx * (1 - dy) +
                      val01 * (1 - dx) * dy +
                      val11 * dx * dy;

          dPixels[targetIdx + chan] = val;
        }
      } else {
        const targetIdx = (y * dstWidth + x) * 4;
        dPixels[targetIdx + 3] = 0; // Alpha transparent
      }
    }
  }
  dstCtx.putImageData(dstData, 0, 0);
}

function enhanceImage(canvas, brightness, contrast, sharpen) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  // 1. Brightness & Contrast adjustment
  for (let i = 0; i < pixels.length; i += 4) {
    for (let chan = 0; chan < 3; chan++) {
      let val = pixels[i + chan];
      val = (val - 128) * contrast + 128 + brightness;
      pixels[i + chan] = Math.min(255, Math.max(0, val));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // 2. Convolution Sharpening Filter
  if (sharpen) {
    const srcData = ctx.getImageData(0, 0, width, height);
    const srcPixels = srcData.data;
    const dstData = ctx.createImageData(width, height);
    const dstPixels = dstData.data;

    const weights = [
       0,   -0.5,  0,
      -0.5,  3,   -0.5,
       0,   -0.5,  0
    ];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const dstIdx = (y * width + x) * 4;
        dstPixels[dstIdx + 3] = srcPixels[dstIdx + 3];

        for (let chan = 0; chan < 3; chan++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const srcIdx = ((y + ky) * width + (x + kx)) * 4;
              const w = weights[(ky + 1) * 3 + (kx + 1)];
              sum += srcPixels[srcIdx + chan] * w;
            }
          }
          dstPixels[dstIdx + chan] = Math.min(255, Math.max(0, sum));
        }
      }
    }
    ctx.putImageData(dstData, 0, 0);
  }
}

// 6. Dynamic Certificate of Appreciation Listing
const certsResultsCountEl = document.getElementById('certs-results-count');
const certsEmptyState = document.getElementById('certs-empty-state');
const certsGrid = document.getElementById('certs-grid');

function renderCertificates() {
  if (!certsGrid) return;
  certsGrid.innerHTML = '';

  if (certsResultsCountEl) {
    certsResultsCountEl.textContent = `Showing ${dbCertificates.length} certificate${dbCertificates.length === 1 ? '' : 's'}`;
  }

  if (dbCertificates.length === 0) {
    certsGrid.classList.add('hidden');
    if (certsEmptyState) certsEmptyState.classList.remove('hidden');
  } else {
    certsGrid.classList.remove('hidden');
    if (certsEmptyState) certsEmptyState.classList.add('hidden');

    dbCertificates.forEach(cert => {
      const card = document.createElement('div');
      card.className = 'item-card cert-preview-card';
      card.style.border = '1px solid #d4af37';
      card.style.background = 'var(--bg-tertiary)';
      card.style.cursor = 'pointer';
      
      card.innerHTML = `
        <div class="card-media" style="background: rgba(212, 175, 55, 0.1); height: 140px; display: flex; align-items: center; justify-content: center; position: relative;">
          <div style="color: #d4af37; font-size: 3rem;">🏆</div>
          <span class="badge" style="background: #d4af37; color: #fff; position: absolute; top: 10px; left: 10px;">CERTIFICATE</span>
          <button class="btn-delete-cert" style="position: absolute; top: 10px; right: 10px; background: rgba(239, 68, 68, 0.2); border: none; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; color: #ef4444; cursor: pointer; transition: background 0.2s;" title="Delete Certificate">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
        <div class="card-body" style="padding: 15px;">
          <span class="card-date" style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(cert.dateAwarded)}</span>
          <h3 class="card-title" style="font-size: 1rem; font-weight: 600; margin-top: 5px;">Honesty Award</h3>
          <p class="card-desc" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 5px; height: 36px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">For returning: "${cert.itemTitle}"</p>
          <div class="card-footer" style="margin-top: 15px; border-top: 1px solid var(--card-border); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; font-weight: 500; color: #d4af37;">View Certificate</span>
            <i data-lucide="arrow-right" style="width: 14px; height: 14px; color: #d4af37;"></i>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        showCertificate(cert.recipientName, cert.itemTitle, cert.dateAwarded, cert.id);
      });

      const deleteBtn = card.querySelector('.btn-delete-cert');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteCertificate(cert.id);
        });
      }

      certsGrid.appendChild(card);
    });
  }
  safeCreateIcons();
}

function deleteCertificate(certId) {
  if (!currentUser) return;
  if (confirm("Are you sure you want to delete this appreciation certificate?")) {
    fetch(`${API_BASE_URL}/certificates.php?id=${certId}&email=${currentUser.email}`, {
      method: 'DELETE'
    })
      .then(async response => {
        let resData;
        try {
          resData = await response.json();
        } catch (e) {
          throw new Error(`Server returned invalid response. Status: ${response.status}`);
        }
        if (!response.ok) {
          throw new Error(resData.message || 'Failed to delete certificate');
        }
        
        dbCertificates = dbCertificates.filter(c => c.id !== certId);
        showAlert("Certificate deleted successfully.", "success");
        renderCertificates();
      })
      .catch(err => {
        showAlert(err.message, "error");
      });
  }
}
