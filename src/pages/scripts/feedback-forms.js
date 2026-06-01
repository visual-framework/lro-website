// Detect environment once
const hostname = typeof window !== "undefined" ? window.location.hostname : "";
const pathname = typeof window !== "undefined" ? window.location.pathname : "";
const origin = typeof window !== "undefined" ? window.location.origin : "";
const IS_LOCALHOST =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname.startsWith("localhost:");

// Base URL (only used outside localhost)
const INDEX_URL = "https://wwwdev.ebi.ac.uk/web-optimisation-framework/";

const HAS_BASE_PATH = pathname.startsWith("/web-optimisation-framework/");
const LOCAL_API_PRIMARY_URL = `${origin}${HAS_BASE_PATH ? "/web-optimisation-framework/api/send-feedback.php" : "/api/send-feedback.php"}`;
const LOCAL_API_FALLBACK_URL = `${origin}${HAS_BASE_PATH ? "/api/send-feedback.php" : "/web-optimisation-framework/api/send-feedback.php"}`;

// Build API URL dynamically
const FEEDBACK_API_URL = IS_LOCALHOST
  ? LOCAL_API_PRIMARY_URL
  : `${INDEX_URL.replace(/\/$/, "")}/api/send-feedback.php`;

const HCAPTCHA_SCRIPT_URL = "https://js.hcaptcha.com/1/api.js?render=explicit";

// Small utility helpers
const text = (el) => (el?.textContent || "").trim();

const setValidationMessage = (el, message = "") => {
  if (el) el.textContent = message;
};

const setBanner = (bannerEl, kind, message) => {
  if (!bannerEl) return;

  const textEl = bannerEl.querySelector(".vf-banner__text");
  if (textEl) textEl.textContent = message;

  bannerEl.classList.remove("vf-u-display-none", "vf-banner--danger", "vf-banner--success");
  bannerEl.classList.add("vf-banner", "vf-banner--alert");
  bannerEl.classList.add(kind === "success" ? "vf-banner--success" : "vf-banner--danger");
};

const hideBanner = (el) => el?.classList.add("vf-u-display-none");

const bindBannerDismiss = (bannerEl) => {
  const btn = bannerEl?.querySelector(".vf-banner__button");
  btn?.addEventListener("click", () => hideBanner(bannerEl));
};

const resetCaptcha = (widgetId) => {
  if (typeof widgetId === "number" && window.hcaptcha?.reset) {
    window.hcaptcha.reset(widgetId);
  }
};

const getCaptchaSitekey = (el) => (el?.dataset?.sitekey || "").trim();

let hcaptchaLoadPromise = null;

// Load captcha script once
function ensureHcaptchaLoaded() {
  if (IS_LOCALHOST) {
    return Promise.resolve(null);
  }

  if (window.hcaptcha?.render) {
    return Promise.resolve(window.hcaptcha);
  }

  if (hcaptchaLoadPromise) {
    return hcaptchaLoadPromise;
  }

  const resolveScript = (resolve, reject) => {
    if (window.hcaptcha?.render) {
      resolve(window.hcaptcha);
      return;
    }

    reject(new Error("Captcha API unavailable"));
  };

  const existing = document.querySelector('[data-hcaptcha-api]');
  if (existing) {
    hcaptchaLoadPromise = new Promise((resolve, reject) => {
      if (window.hcaptcha?.render) {
        resolve(window.hcaptcha);
        return;
      }

      existing.addEventListener("load", () => resolveScript(resolve, reject), { once: true });
      existing.addEventListener("error", () => reject(new Error("Captcha load failed")), { once: true });
    });

    return hcaptchaLoadPromise;
  }

  hcaptchaLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = HCAPTCHA_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.hcaptchaApi = "true";

    script.addEventListener("load", () => resolveScript(resolve, reject), { once: true });
    script.addEventListener("error", () => reject(new Error("Captcha load failed")), { once: true });

    document.head.appendChild(script);
  });

  return hcaptchaLoadPromise;
}

// API call
function postFeedback(payload) {
  const request = (url) => fetch(url, {
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
      if (!res.ok) {
        const error = new Error("Request failed");
        error.status = res.status;
        throw error;
      }
      return res.json();
    })
    .then((data) => {
      if (!data?.success) throw new Error("API failure");
      return data;
    });

  return request(FEEDBACK_API_URL).catch((error) => {
    if (IS_LOCALHOST && error?.status === 404 && LOCAL_API_PRIMARY_URL !== LOCAL_API_FALLBACK_URL) {
      return request(LOCAL_API_FALLBACK_URL);
    }

    throw error;
  });
}

// Shared submit handler creator (reduces duplication)
function handleCaptchaFlow({ captchaContainer, banner, onSuccess, onError }) {
  let pending = null;
  let widgetId = null;
  let widgetPromise = null;

  const handleError = (message = "Captcha verification failed.") => {
    setBanner(banner, "error", message);
    pending = null;
    resetCaptcha(widgetId);
  };

  const handleVerified = async (captchaToken) => {
    if (!pending) return;

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
      resetCaptcha(widgetId);
    }
  };

  async function prepareWidget() {
    if (IS_LOCALHOST) {
      return true;
    }

    if (widgetId !== null) {
      return true;
    }

    if (widgetPromise) {
      return widgetPromise;
    }

    widgetPromise = ensureHcaptchaLoaded()
      .then((hcaptcha) => {
        const sitekey = getCaptchaSitekey(captchaContainer);

        if (!sitekey) {
          throw new Error("Captcha is not configured.");
        }

        if (widgetId !== null) {
          return true;
        }

        widgetId = hcaptcha.render(captchaContainer, {
          sitekey,
          size: "invisible",
          callback: handleVerified,
          "error-callback": () => handleError(),
          "expired-callback": () => handleError("Captcha expired. Try again.")
        });

        return true;
      })
      .catch((error) => {
        handleError(error.message === "Captcha is not configured." ? error.message : "Captcha failed to load.");
        return false;
      })
      .finally(() => {
        if (widgetId === null) {
          widgetPromise = null;
        }
      });

    return widgetPromise;
  }

  return {
    set(data) {
      pending = data;
    },

    async prepare() {
      return prepareWidget();
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

      const ready = await prepareWidget();
      if (!ready || widgetId === null || !window.hcaptcha?.execute) {
        setBanner(banner, "error", "Captcha not ready. Try again.");
        resetCaptcha(widgetId);
        return false;
      }

      window.hcaptcha.execute(widgetId);
      return true;
    },

    reset() {
      pending = null;
      resetCaptcha(widgetId);
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
  const captchaContainer = document.getElementById("framework-feedback-captcha");

  if (!trigger || !form || !textarea || !captchaContainer) return;

  bindBannerDismiss(banner);

  const flow = handleCaptchaFlow({
    captchaContainer,
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
  const captchaContainer = document.getElementById("article-feedback-captcha");

  if (!form || !textarea || !captchaContainer) return;

  bindBannerDismiss(banner);

  const flow = handleCaptchaFlow({
    captchaContainer,
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
