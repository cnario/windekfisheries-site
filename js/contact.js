// /js/contact-form.js
(function () {
  // Wait until DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    const wrapperDiv = document.getElementById('contact-form'); // parent wrapper containing the form
    if (!wrapperDiv) return;

    const form = wrapperDiv.querySelector('form#contactForm');
    const messageDiv = wrapperDiv.querySelector('#message') || document.getElementById('message'); // existing message div
    if (!form) return;

    const submitBtn = form.querySelector('#submit');
    const hpField = form.elements['website']; // honeypot
    const formTimeField = form.elements['form_time'];

    // 1) set timestamp on load (milliseconds)
    if (formTimeField) {
      formTimeField.value = Date.now();
    } else {
      // if hidden field missing, create it so server still gets it
      const hf = document.createElement('input');
      hf.type = 'hidden';
      hf.name = 'form_time';
      hf.id = 'form_time';
      hf.value = Date.now();
      form.appendChild(hf);
    }

    // Helpers
    function setButtonLoading(isLoading) {
      if (!submitBtn) return;
      submitBtn.disabled = isLoading;
      submitBtn.setAttribute('aria-busy', String(isLoading));
      submitBtn.style.opacity = isLoading ? '0.6' : '';
      submitBtn.innerText = isLoading ? 'Sending...' : 'Send Message';
    }

    function showInlineError(text) {
      if (!messageDiv) {
        alert(text);
        return;
      }
      messageDiv.className = ''; // reset classes
      messageDiv.innerHTML = '<div class="cf-error" role="alert">' + text + '</div>';
    }

    function clearInlineMessage() {
      if (!messageDiv) return;
      messageDiv.innerHTML = '';
    }

    function defaultLike(value) {
      // treat default placeholder-like values as empty
      if (!value) return true;
      const v = String(value).trim().toLowerCase();
      return v === '' || v === 'name' || v === 'e-mail' || v === 'email' || v === 'phone' || v === 'message';
    }

    function buildPayload() {
      const data = {};
      // name/email/phone/message names come from your markup
      data.name = form.elements['name'] ? form.elements['name'].value.trim() : '';
      data.email = form.elements['email'] ? form.elements['email'].value.trim() : '';
      data.phone = form.elements['phone'] ? form.elements['phone'].value.trim() : '';
      // your textarea has name="message" but id="comments" — use the name
      data.message = form.elements['message'] ? form.elements['message'].value.trim() : '';
      data.website = form.elements['website'] ? form.elements['website'].value.trim() : '';
      data.form_time = form.elements['form_time'] ? form.elements['form_time'].value : String(Date.now());
      // normalize default-like
      if (defaultLike(data.name)) data.name = '';
      if (defaultLike(data.email)) data.email = '';
      if (defaultLike(data.phone)) data.phone = '';
      if (defaultLike(data.message)) data.message = '';
      return data;
    }

    function showSuccessCard() {
      // Replace wrapperDiv content with success card (animated)
      const successHTML = '<div class="cf-success-card" role="status" aria-live="polite">' +
          '<div class="cf-spinner" aria-hidden="true"></div>' +
          '<div class="cf-success-text"><h3 tabindex="-1">Your message has been sent</h3>' +
          '<p>Thanks! We have received your message and will get back to you shortly.</p></div></div>';
      wrapperDiv.innerHTML = successHTML;
      // Move focus to heading for accessibility
      const h3 = wrapperDiv.querySelector('h3');
      if (h3 && typeof h3.focus === 'function') {
        h3.focus();
      }
    }

    async function submitHandler(ev) {
      ev.preventDefault();
      clearInlineMessage();

      const payload = buildPayload();

      // basic client validation
      if (!payload.email) {
        showInlineError('Please enter your email.');
        return;
      }
      if (!payload.message) {
        showInlineError('Please enter your message.');
        return;
      }

      // Honeypot: if filled, show success UX but don't actually send
      if (payload.website && payload.website.trim() !== '') {
        showSuccessCard();
        return;
      }

      // Speed check client-side too: if submitted too quickly (<5s), silently accept for UX
      const now = Date.now();
      let loadedAt = parseInt(payload.form_time, 10) || now;
      // normalize if in seconds
      if (loadedAt > 0 && loadedAt < 1e11) loadedAt = loadedAt * 1000;
      const delta = now - loadedAt;
      if (delta < 5000) {
        // show success card but skip sending to avoid spammers — server also does this
        showSuccessCard();
        return;
      }

      try {
        setButtonLoading(true);

        const res = await fetch(form.action || '/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'omit'
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || (json && json.ok === false)) {
          // server-side error
          const errMsg = (json && json.error) ? json.error : 'Failed to send message. Please try again later.';
          showInlineError(errMsg);
          setButtonLoading(false);
          return;
        }

        // success — show success card
        showSuccessCard();
      } catch (err) {
        console.error('Contact form submit error', err);
        showInlineError('Network error. Please check your connection and try again.');
        setButtonLoading(false);
      }
    }

    // Attach handler
    form.addEventListener('submit', submitHandler);

    // Optional: prevent placeholder text from actually being submitted if users don't change it
    // (we already normalized in buildPayload, but this keeps UI clean)
    const inputs = ['name','email','phone','message'];
    inputs.forEach((n) => {
      const el = form.elements[n];
      if (!el) return;
      el.addEventListener('focus', function () {
        // if value equals the old placeholder, clear it
        const v = String(this.value || '').trim();
        if (v === 'Name' || v === 'E-mail' || v === 'E-mail' || v === 'Phone' || v === 'Message') {
          this.value = '';
        }
      });
    });

    // Expose a small API for tests if needed
    form.__cf_submit = submitHandler;
  });
})();
