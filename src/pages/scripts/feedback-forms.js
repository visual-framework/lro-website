const FEEDBACK_TO = "embldev@service-now.com";
const INDEX_URL = "https://wwwdev.ebi.ac.uk/web-optimisation-framework/";
const HCAPTCHA_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@hcaptcha/vanilla-hcaptcha";
const FEEDBACK_API_URL = "/api/send-feedback.php";

function text(el) {
  return (el && el.textContent ? el.textContent : "").trim();
}

function setValidationMessage(el, message) {
  if (!el) return;
  el.textContent = message || "";
}

function setBanner(bannerEl, kind, message) {
  if (!bannerEl) return;
  const textEl = bannerEl.querySelector(".vf-banner__text");
  if (textEl) textEl.textContent = message;

  bannerEl.classList.remove("vf-u-display-none", "vf-banner--alert", "vf-banner--success");
  bannerEl.classList.add(kind === "success" ? "vf-banner--success" : "vf-banner--alert");
}

function hideBanner(bannerEl) {
  if (!bannerEl) return;
  bannerEl.classList.add("vf-u-display-none");
}

function bindBannerDismiss(bannerEl) {
  if (!bannerEl) return;
  const closeBtn = bannerEl.querySelector(".vf-banner__button");
  if (!closeBtn) return;
  closeBtn.addEventListener("click", function () {
    hideBanner(bannerEl);
  });
}

function resetCaptcha(captchaEl) {
  if (!captchaEl || typeof captchaEl.reset !== "function") return;
  captchaEl.reset();
}

function ensureHcaptchaLoaded() {
  if (customElements.get("h-captcha")) {
    return Promise.resolve();
  }

  const existing = document.querySelector('script[data-hcaptcha-web-component="true"]');
  if (existing) {
    return new Promise(function (resolve, reject) {
      existing.addEventListener("load", function () {
        resolve();
      }, { once: true });
      existing.addEventListener("error", function () {
        reject(new Error("Failed to load captcha script."));
      }, { once: true });
    });
  }

  return new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.src = HCAPTCHA_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-hcaptcha-web-component", "true");
    script.addEventListener("load", function () {
      resolve();
    }, { once: true });
    script.addEventListener("error", function () {
      reject(new Error("Failed to load captcha script."));
    }, { once: true });
    document.head.appendChild(script);
  });
}

function postFeedback(payload) {
  return fetch(FEEDBACK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: payload.to || FEEDBACK_TO,
      subject: payload.subject || "Feedback",
      message: payload.message || "",
      type: payload.type || "general"
    })
  }).then(function (response) {
    if (!response.ok) {
      throw new Error("Failed to submit feedback.");
    }
    return response.json();
  }).then(function (data) {
    if (!data || data.success !== true) {
      throw new Error("Failed to submit feedback.");
    }
    return data;
  });
}

function initFrameworkFeedback() {
  const trigger = document.getElementById("framework-feedback-trigger");
  const form = document.getElementById("framework-feedback-form");
  const cancel = document.getElementById("framework-feedback-cancel");
  const textarea = document.getElementById("framework-feedback");
  const validation = document.querySelector(".framework-feedback-validation-msg");
  const banner = document.getElementById("framework-feedback-banner");
  const captcha = document.getElementById("framework-feedback-captcha");

  if (!trigger || !form || !textarea || !captcha) return;

  bindBannerDismiss(banner);
  ensureHcaptchaLoaded().catch(function () {
    setBanner(banner, "error", "Captcha failed to load. Please refresh and try again.");
  });

  let pendingSubmission = null;

  function showForm() {
    trigger.classList.add("vf-u-display-none");
    form.classList.remove("vf-u-display-none");
    textarea.focus();
  }

  function showTrigger() {
    form.classList.add("vf-u-display-none");
    trigger.classList.remove("vf-u-display-none");
  }

  function resetFormState() {
    form.reset();
    setValidationMessage(validation, "");
    resetCaptcha(captcha);
    pendingSubmission = null;
  }

  trigger.addEventListener("click", function (e) {
    e.preventDefault();
    hideBanner(banner);
    showForm();
  });

  cancel.addEventListener("click", function () {
    resetFormState();
    showTrigger();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBanner(banner);

    const feedback = textarea.value.trim();
    if (!feedback) {
      setValidationMessage(validation, "Comments are required.");
      return;
    }

    setValidationMessage(validation, "");
    pendingSubmission = {
      subject: "LRO : Framework feedback",
      message: [
        "Dear Team,",
        "",
        "Following feedback received from user:",
        "",
        "URL - " + INDEX_URL,
        "Feedback - " + feedback,
        "",
        "Thanks,",
        "LRO team"
      ].join("\n")
    };

    if (typeof captcha.execute === "function") {
      captcha.execute();
    } else {
      setBanner(banner, "error", "Captcha is not ready. Please try again.");
      resetCaptcha(captcha);
    }
  });

  captcha.addEventListener("verified", async function () {
    if (!pendingSubmission) return;

    try {
      await postFeedback({
        to: FEEDBACK_TO,
        subject: pendingSubmission.subject,
        message: pendingSubmission.message,
        type: "framework"
      });

      setBanner(banner, "success", "Thanks for your feedback. It was submitted successfully.");
      resetFormState();
      showTrigger();
    } catch (error) {
      setBanner(banner, "error", "Feedback could not be submitted. Please try again.");
      resetCaptcha(captcha);
      showTrigger();
    } finally {
      pendingSubmission = null;
    }
  });

  captcha.addEventListener("error", function () {
    setBanner(banner, "error", "Captcha verification failed. Please try again.");
    pendingSubmission = null;
    resetCaptcha(captcha);
  });
}

function initArticleFeedback() {
  const form = document.getElementById("article-feedback-form");
  const textarea = document.getElementById("article-feedback");
  const validation = document.querySelector(".article-feedback-validation-msg");
  const banner = document.getElementById("feedback-response-banner");
  const captcha = document.getElementById("article-feedback-captcha");

  if (!form || !textarea || !captcha) return;

  bindBannerDismiss(banner);
  ensureHcaptchaLoaded().catch(function () {
    setBanner(banner, "error", "Captcha failed to load. Please refresh and try again.");
  });

  let pendingSubmission = null;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBanner(banner);

    const feedback = textarea.value.trim();
    if (!feedback) {
      setValidationMessage(validation, "Comments are required.");
      return;
    }

    const pageTitle = text(document.querySelector("h1.vf-intro__heading"));
    const category = text(document.querySelector("nav[aria-label='Breadcrumb'] .vf-intro__kicker span"));
    const pageUrl = window.location.href;

    setValidationMessage(validation, "");
    pendingSubmission = {
      subject: "LRO : Article Feedback",
      message: [
        "Dear Team,",
        "",
        "Following feedback received from user:",
        "",
        "URL - " + pageUrl,
        "Category - " + category,
        "Title - " + pageTitle,
        "",
        "Feedback - " + feedback,
        "",
        "Thanks,",
        "LRO team"
      ].join("\n")
    };

    if (typeof captcha.execute === "function") {
      captcha.execute();
    } else {
      setBanner(banner, "error", "Captcha is not ready. Please try again.");
      resetCaptcha(captcha);
    }
  });

  captcha.addEventListener("verified", async function (event) {
    if (!pendingSubmission) return;

    try {
      await postFeedback({
        to: FEEDBACK_TO,
        subject: pendingSubmission.subject,
        message: pendingSubmission.message,
        type: "article"
      });

      setBanner(banner, "success", "Thanks for your feedback. It was submitted successfully.");
      form.reset();
      resetCaptcha(captcha);
    } catch (error) {
      setBanner(banner, "error", "Feedback could not be submitted. Please try again.");
      resetCaptcha(captcha);
    } finally {
      pendingSubmission = null;
    }
  });

  captcha.addEventListener("error", function () {
    setBanner(banner, "error", "Captcha verification failed. Please try again.");
    pendingSubmission = null;
    resetCaptcha(captcha);
  });
}

export function initFeedbackForms() {
  initFrameworkFeedback();
  initArticleFeedback();
}
