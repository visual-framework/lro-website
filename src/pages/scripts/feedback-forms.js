// Detect environment once
const hostname = typeof window !== "undefined" ? window.location.hostname : "";
const IS_LOCALHOST =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname.startsWith("localhost:");

// Base URL (only used outside localhost)
const INDEX_URL = "https://wwwdev.ebi.ac.uk/web-optimisation-framework/";

// Build API URL dynamically
const FEEDBACK_API_URL = IS_LOCALHOST
  ? `${window.location.origin}/web-optimisation-framework/api/send-feedback.php`
  : `${INDEX_URL.replace(/\/$/, "")}/api/send-feedback.php`;

const HCAPTCHA_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@hcaptcha/vanilla-hcaptcha";
console.log("Feedback API URL:", FEEDBACK_API_URL);

// Small utility helpers
const text = (el) => (el?.textContent || "").trim();

const setValidationMessage = (el, message = "") => {
  if (el) el.textContent = message;
};

const setBanner = (bannerEl, kind, message) => {
  if (!bannerEl) return;

  const textEl = bannerEl.querySelector(".vf-banner__text");
  if (textEl) textEl.textContent = message;

  bannerEl.classList.remove("vf-u-display-none", "vf-banner--alert", "vf-banner--success");
  bannerEl.classList.add(kind === "success" ? "vf-banner--success" : "vf-banner--alert");
};

const hideBanner = (el) => el?.classList.add("vf-u-display-none");

const bindBannerDismiss = (bannerEl) => {
  const btn = bannerEl?.querySelector(".vf-banner__button");
  btn?.addEventListener("click", () => hideBanner(bannerEl));
};

const resetCaptcha = (el) => el?.reset?.();

// Load captcha script once
function ensureHcaptchaLoaded() {
  if (customElements.get("h-captcha")) return Promise.resolve();

  const existing = document.querySelector('[data-hcaptcha-web-component]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Captcha load failed")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = HCAPTCHA_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.hcaptchaWebComponent = "true";

    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Captcha load failed")), { once: true });

    document.head.appendChild(script);
  });
}

// API call
function postFeedback(payload) {
  return fetch(FEEDBACK_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: payload.subject || "Feedback",
      message: payload.message || "",
      type: payload.type || "general"
    })
  })
    .then((res) => {
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    })
    .then((data) => {
      if (!data?.success) throw new Error("API failure");
      return data;
    });
}

// Shared submit handler creator (reduces duplication)
function handleCaptchaFlow({ captcha, banner, onSuccess, onError }) {
  let pending = null;

  return {
    set(data) {
      pending = data;
    },
    trigger() {
      if (typeof captcha.execute === "function") {
        captcha.execute();
      } else if (IS_LOCALHOST) {
        captcha.dispatchEvent(new Event("verified"));
      } else {
        setBanner(banner, "error", "Captcha not ready. Try again.");
        resetCaptcha(captcha);
      }
    },
    bind(type) {
      captcha.addEventListener("verified", async () => {
        if (!pending) return;

        try {
          await postFeedback(pending);
          onSuccess();
        } catch {
          onError();
        } finally {
          pending = null;
        }
      });

      captcha.addEventListener("error", () => {
        setBanner(banner, "error", "Captcha verification failed.");
        pending = null;
        resetCaptcha(captcha);
      });
    }
  };
}

// Framework feedback
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

  if (!IS_LOCALHOST) {
    ensureHcaptchaLoaded().catch(() =>
      setBanner(banner, "error", "Captcha failed to load.")
    );
  }

  const flow = handleCaptchaFlow({
    captcha,
    banner,
    onSuccess: () => {
      setBanner(banner, "success", "Feedback submitted successfully.");
      form.reset();
      resetCaptcha(captcha);
      trigger.classList.remove("vf-u-display-none");
      form.classList.add("vf-u-display-none");
    },
    onError: () => {
      setBanner(banner, "error", "Submission failed. Try again.");
      resetCaptcha(captcha);
    }
  });

  flow.bind();

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    hideBanner(banner);
    trigger.classList.add("vf-u-display-none");
    form.classList.remove("vf-u-display-none");
    textarea.focus();
  });

  cancel.addEventListener("click", () => {
    form.reset();
    setValidationMessage(validation);
    resetCaptcha(captcha);
    form.classList.add("vf-u-display-none");
    trigger.classList.remove("vf-u-display-none");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    hideBanner(banner);

    const feedback = textarea.value.trim();
    if (!feedback) {
      return setValidationMessage(validation, "Comments are required.");
    }

    setValidationMessage(validation);

    flow.set({
      subject: "LRO : Framework feedback",
      message: `Dear Team,\n\nFollowing feedback received:\n\nURL - ${INDEX_URL}\nFeedback - ${feedback}\n\nThanks,\nLRO team`,
      type: "framework"
    });

    flow.trigger();
  });
}

// Article feedback (same pattern, less duplication)
function initArticleFeedback() {
  const form = document.getElementById("article-feedback-form");
  const textarea = document.getElementById("article-feedback");
  const validation = document.querySelector(".article-feedback-validation-msg");
  const banner = document.getElementById("feedback-response-banner");
  const captcha = document.getElementById("article-feedback-captcha");

  if (!form || !textarea || !captcha) return;

  bindBannerDismiss(banner);

  if (!IS_LOCALHOST) {
    ensureHcaptchaLoaded().catch(() =>
      setBanner(banner, "error", "Captcha failed to load.")
    );
  }

  const flow = handleCaptchaFlow({
    captcha,
    banner,
    onSuccess: () => {
      setBanner(banner, "success", "Feedback submitted successfully.");
      form.reset();
      resetCaptcha(captcha);
    },
    onError: () => {
      setBanner(banner, "error", "Submission failed. Try again.");
      resetCaptcha(captcha);
    }
  });

  flow.bind();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    hideBanner(banner);

    const feedback = textarea.value.trim();
    if (!feedback) {
      return setValidationMessage(validation, "Comments are required.");
    }

    const pageTitle = text(document.querySelector("h1.vf-intro__heading"));
    const category = text(document.querySelector("nav[aria-label='Breadcrumb'] span"));

    flow.set({
      subject: "LRO : Article Feedback",
      message: `Dear Team\n\nURL - ${location.href}\nCategory - ${category}\nTitle - ${pageTitle}\n\nFeedback - ${feedback}\n\nThanks,\nLRO team`,
      type: "article"
    });

    flow.trigger();
  });
}

// Init
let initialized = false;

export function initFeedbackForms() {
  if (initialized) return;
  initialized = true;

  initFrameworkFeedback();
  initArticleFeedback();
}
