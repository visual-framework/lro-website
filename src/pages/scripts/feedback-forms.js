import "@hcaptcha/vanilla-hcaptcha";

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
  ? `http://localhost:3333/api/send-feedback.php`
  : `${INDEX_URL.replace(/\/$/, "")}/api/send-feedback.php`;

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

const resetCaptcha = (captchaEl) => captchaEl?.reset?.();

async function ensureHcaptchaLoaded() {
  if (IS_LOCALHOST) {
    return true;
  }

  await customElements.whenDefined("h-captcha");
  return true;
}

function extractCaptchaToken(event) {
  const detail = event?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (detail && typeof detail.token === "string") {
    return detail.token;
  }

  return "";
}

// API call
function postFeedback(payload) {
  return fetch(FEEDBACK_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: payload.subject || "Feedback",
      message: payload.message || "",
      type: payload.type || "general",
      captchaToken: payload.captchaToken || ""
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
  let bound = false;

  const handleError = (message = "Captcha verification failed.") => {
    setBanner(banner, "error", message);
    pending = null;
    resetCaptcha(captcha);
  };

  const handleVerified = async (event) => {
    if (!pending) return;

    const captchaToken = extractCaptchaToken(event);

    if (!captchaToken) {
      handleError("Captcha verification failed.");
      return;
    }

    try {
      await postFeedback({
        ...pending,
        captchaToken
      });
      onSuccess();
    } catch {
      onError();
    } finally {
      pending = null;
      resetCaptcha(captcha);
    }
  };

  async function prepareCaptcha() {
    if (IS_LOCALHOST) {
      return true;
    }

    try {
      await ensureHcaptchaLoaded();

      if (typeof captcha.execute === "function") {
        return true;
      }

      handleError("Captcha not ready. Try again.");
      return false;
    } catch {
      handleError("Captcha failed to load.");
      return false;
    }
  }

  return {
    set(data) {
      pending = data;
    },

    async prepare() {
      return prepareCaptcha();
    },

    async trigger() {
      if (!pending) {
        return false;
      }

      if (IS_LOCALHOST) {
        try {
          await postFeedback(pending);
          onSuccess();
          return true;
        } catch {
          onError();
          return false;
        } finally {
          pending = null;
        }
      }

      const ready = await prepareCaptcha();
      if (!ready) {
        setBanner(banner, "error", "Captcha not ready. Try again.");
        resetCaptcha(captcha);
        return false;
      }

      captcha.execute();
      return true;
    },

    reset() {
      pending = null;
      resetCaptcha(captcha);
    },

    bind() {
      if (bound) return;
      bound = true;

      captcha.addEventListener("verified", handleVerified);
      captcha.addEventListener("error", () => handleError());
      captcha.addEventListener("expired", () => handleError("Captcha expired. Try again."));
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

  const flow = handleCaptchaFlow({
    captcha,
    banner,
    onSuccess: () => {
      setBanner(banner, "success", "Feedback submitted successfully.");
      form.reset();
      flow.reset();
      trigger.classList.remove("vf-u-display-none");
      form.classList.add("vf-u-display-none");
    },
    onError: () => {
      setBanner(banner, "error", "Submission failed. Try again.");
      flow.reset();
    }
  });

  flow.bind();

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    hideBanner(banner);
    trigger.classList.add("vf-u-display-none");
    form.classList.remove("vf-u-display-none");
    textarea.focus();

    void flow.prepare();
  });

  textarea.addEventListener("focus", () => {
    void flow.prepare();
  }, { once: true });

  cancel.addEventListener("click", () => {
    form.reset();
    setValidationMessage(validation);
    flow.reset();
    form.classList.add("vf-u-display-none");
    trigger.classList.remove("vf-u-display-none");
  });

  form.addEventListener("submit", async (e) => {
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

    await flow.trigger();
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

  const flow = handleCaptchaFlow({
    captcha,
    banner,
    onSuccess: () => {
      setBanner(banner, "success", "Feedback submitted successfully.");
      form.reset();
      flow.reset();
    },
    onError: () => {
      setBanner(banner, "error", "Submission failed. Try again.");
      flow.reset();
    }
  });

  flow.bind();

  textarea.addEventListener("focus", () => {
    void flow.prepare();
  }, { once: true });

  form.addEventListener("submit", async (e) => {
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

    await flow.trigger();
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
