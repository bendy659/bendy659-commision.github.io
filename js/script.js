const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduceMotion = reducedMotion.matches;
const visitorAvailability = document.querySelector("#visitor-availability");
const contactAvailability = document.querySelector("#contact-availability");
const priceCalculator = document.querySelector("#price-calculator");
const calculatorResult = document.querySelector("#calculator-result");
const portfolioLightbox = document.querySelector("#render-lightbox");
const portfolioLightboxCaption = portfolioLightbox.querySelector("figcaption");
const portfolioLightboxClose = portfolioLightbox.querySelector(".lightbox-close");
const portfolioLightboxImage = portfolioLightbox.querySelector("img");
const portfolioLightboxVideo = portfolioLightbox.querySelector("video");
const gallerySections = Array.from(document.querySelectorAll("[data-gallery]"));
const galleryPixelsPerSecond = 52;
const portfolioSections = Array.from(document.querySelectorAll(".portfolio-section"));
const siteHeader = document.querySelector(".site-header");
const homeLink = siteHeader.querySelector(".home-link");
const motionSections = Array.from(document.querySelectorAll(".tabbed-section"));
const pendingMotionSections = new Set(motionSections);
const defaultPrices = Object.freeze({
    renderBase: 850,
    modelBase: 500,
    animationBase: 285,
    animationPerSecond: 15,
    animationDetailBasic: 0,
    animationDetailMedium: 250,
    animationDetailHigh: 500
});
const visitorTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
});
const priceFormatter = new Intl.NumberFormat("ru-RU");

let frameRequested = false;
let prices = { ...defaultPrices };

function revealMotionTarget(target) {
    if (target.classList.contains("is-revealed")) return;

    target.classList.add("is-revealed");
    pendingMotionSections.delete(target);

    if (!target.matches("[data-gallery]")) return;

    const strip = target.querySelector(".render-strip");
    const bounds = strip.getBoundingClientRect();
    const preloadMargin = bounds.width * 0.35;
    strip.querySelectorAll("img").forEach((image) => {
        const imageBounds = image.getBoundingClientRect();
        if (imageBounds.right <= bounds.left || imageBounds.left >= bounds.right + preloadMargin) return;

        image.loading = "eager";
        image.decode().catch(() => {});
    });
}

function updateMotionTriggers() {
    if (reduceMotion) return;

    const viewportHeight = window.innerHeight;
    const triggerLine = viewportHeight * 0.65;
    const pageBottomReached = window.scrollY + viewportHeight >= root.scrollHeight - 2;

    pendingMotionSections.forEach((target) => {
        const targetTop = target.getBoundingClientRect().top;
        if (targetTop <= triggerLine || (pageBottomReached && targetTop < viewportHeight))
            revealMotionTarget(target);
    });
}

function prepareMotionSystem() {
    root.classList.toggle("motion-ready", !reduceMotion);
    root.classList.remove("motion-pending");
    if (reduceMotion) finishSectionAnimations();
}

function finishSectionAnimations() {
    motionSections.forEach(revealMotionTarget);
    gallerySections.forEach((section) => section.classList.add("is-gallery-ready"));
}

function updateBackgroundPosition() {
    const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = scrollRange > 0
        ? Math.min(Math.max(window.scrollY / scrollRange, 0), 1)
        : 0;
    const parallaxRange = window.innerHeight * 0.18;
    const offset = reduceMotion ? 0 : -(parallaxRange * scrollProgress);

    root.style.setProperty("--background-parallax", `${offset}px`);
    updateMotionTriggers();
    frameRequested = false;
}

function requestBackgroundUpdate() {
    if (frameRequested) {
        return;
    }

    frameRequested = true;
    window.requestAnimationFrame(updateBackgroundPosition);
}

function updateVisitorAvailability() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    const start = new Date(Date.UTC(year, month, day, 4));
    const end = new Date(Date.UTC(year, month, day, 16));
    const range = `${visitorTimeFormatter.format(start)}–${visitorTimeFormatter.format(end)}`;

    visitorAvailability.textContent = range;
    contactAvailability.textContent = range;
}

function updateDisplayedPrices() {
    document.querySelectorAll("[data-price-key]").forEach((element) => {
        const value = prices[element.dataset.priceKey];

        if (element instanceof HTMLOptionElement) {
            element.value = value;
            element.textContent = `${element.dataset.priceLabel} · +${priceFormatter.format(value)} ₽`;
            return;
        }

        const prefix = element.dataset.pricePrefix || "";
        element.textContent = `${prefix}${priceFormatter.format(value)} ₽`;
    });
}

async function loadPrices() {
    try {
        const response = await fetch("content/prices.json", { cache: "no-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const loadedPrices = await response.json();
        Object.keys(defaultPrices).forEach((key) => {
            const value = Number(loadedPrices[key]);
            if (Number.isFinite(value) && value >= 0) prices[key] = value;
        });

        updateDisplayedPrices();
        updatePriceCalculator();
    } catch (error) {
        console.warn("Не удалось загрузить content/prices.json, используются встроенные цены.", error);
    }
}

function updatePriceCalculator() {
    const renderEnabled = priceCalculator.elements.namedItem("render-enabled").checked;
    const modelEnabled = priceCalculator.elements.namedItem("model-enabled").checked;
    const animationEnabled = priceCalculator.elements.namedItem("animation-enabled").checked;
    const services = Array.from(priceCalculator.querySelectorAll(".calculator-service"));

    services.forEach((service) => {
        const checkbox = service.querySelector('input[type="checkbox"]');
        const state = service.querySelector(".calculator-service-state");
        const enabled = checkbox.checked;

        service.classList.toggle("is-selected", enabled);
        checkbox.setAttribute("aria-expanded", String(enabled));
        state.textContent = enabled ? "Добавлено" : "Выбрать";
        service.querySelectorAll('input:not([type="checkbox"]), select').forEach((control) => {
            control.disabled = !enabled;
        });
    });

    let total = 0;
    let selectedServices = 0;

    const invalidField = priceCalculator.querySelector('input[type="number"]:enabled:invalid');
    if (invalidField) {
        calculatorResult.textContent = `Введите целое число от ${invalidField.min} до ${invalidField.max}`;
        return;
    }

    if (renderEnabled) {
        const count = Math.max(Number(priceCalculator.elements.namedItem("render-count").value), 1);

        total += count * prices.renderBase;
        selectedServices += 1;
    }

    if (modelEnabled) {
        const count = Math.max(Number(priceCalculator.elements.namedItem("model-count").value), 1);

        total += count * prices.modelBase;
        selectedServices += 1;
    }

    if (animationEnabled) {
        const count = Math.max(Number(priceCalculator.elements.namedItem("animation-count").value), 1);
        const duration = Math.max(Number(priceCalculator.elements.namedItem("animation-duration").value), 1);
        const detail = Number(priceCalculator.elements.namedItem("animation-detail").value);

        total += count * (prices.animationBase + (duration * prices.animationPerSecond) + detail);
        selectedServices += 1;
    }

    calculatorResult.textContent = selectedServices > 0
        ? `Примерно: ${priceFormatter.format(total)} ₽`
        : "Выберите услуги";
}

function findSectionTarget(hash) {
    let targetId;
    try {
        targetId = decodeURIComponent(hash.slice(1));
    } catch {
        return null;
    }
    return document.getElementById(targetId);
}

function scrollToSection(target, behavior) {
    const bounds = target.getBoundingClientRect();
    const headerBottom = siteHeader.getBoundingClientRect().bottom;
    const heading = target.querySelector(".category-heading, .contact-heading");
    const headingInset = heading ? heading.getBoundingClientRect().top - bounds.top : 0;
    const centeredTop = (window.innerHeight - bounds.height) / 2;
    const minimumTop = headerBottom + 8;
    const viewportTop = centeredTop >= 0
        ? Math.max(centeredTop, minimumTop - headingInset)
        : minimumTop;

    window.scrollTo({
        top: target.id === "welcome" ? 0 : window.scrollY + bounds.top - viewportTop,
        behavior
    });
}

function alignInitialSection() {
    const target = findSectionTarget(window.location.hash);
    if (!target) return;

    scrollToSection(target, "instant");
    if (target.classList.contains("tabbed-section")) revealMotionTarget(target);
}

function createPortfolioGallery(section) {
    const strip = section.querySelector(".render-strip");
    const track = section.querySelector(".render-track");
    const cards = Array.from(strip.querySelectorAll(".render-card"));
    const itemLabel = section.dataset.galleryItemLabel;

    let galleryInitialized = false;
    let galleryLoopWidth = 0;
    let galleryScrollPosition = 0;
    let lastGalleryFrame = 0;
    let galleryPausedUntil = 0;
    let isGalleryPointerActive = false;

    function pauseBriefly() {
        galleryPausedUntil = performance.now() + 120;
    }

    function startInteraction() {
        isGalleryPointerActive = true;
    }

    function normalizePosition(position) {
        if (galleryLoopWidth <= 0) return position;

        const lowerBoundary = galleryLoopWidth * 0.5;
        const upperBoundary = galleryLoopWidth * 2;

        while (position < lowerBoundary) position += galleryLoopWidth;
        while (position >= upperBoundary) position -= galleryLoopWidth;
        return position;
    }

    function endInteraction() {
        if (!isGalleryPointerActive) return;

        isGalleryPointerActive = false;
        galleryScrollPosition = normalizePosition(strip.scrollLeft);
        strip.scrollLeft = galleryScrollPosition;
        pauseBriefly();
    }

    function updateLoopWidth() {
        const firstAfterClone = track.querySelector('[data-gallery-clone="after"]');

        if (!firstAfterClone) return;

        const previousLoopWidth = galleryLoopWidth;
        const previousRatio = previousLoopWidth > 0
            ? galleryScrollPosition / previousLoopWidth
            : 1;

        galleryLoopWidth = firstAfterClone.getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
        galleryScrollPosition = galleryLoopWidth * previousRatio;
        galleryScrollPosition = normalizePosition(galleryScrollPosition);
        strip.scrollLeft = galleryScrollPosition;
        galleryInitialized = true;
    }

    function updateScroll(timestamp) {
        const elapsed = Math.min(timestamp - lastGalleryFrame, 50);
        const isPaused = reduceMotion || isGalleryPointerActive
            || timestamp < galleryPausedUntil
            || portfolioLightbox.open
            || document.hidden
            || (!reduceMotion && !section.classList.contains("is-gallery-ready"));

        if (!galleryInitialized) {
            lastGalleryFrame = timestamp;
            window.requestAnimationFrame(updateScroll);
            return;
        }

        if (isPaused) {
            galleryScrollPosition = normalizePosition(strip.scrollLeft);
            strip.scrollLeft = galleryScrollPosition;
        } else {
            galleryScrollPosition += elapsed * galleryPixelsPerSecond / 1000;
            galleryScrollPosition = normalizePosition(galleryScrollPosition);
            strip.scrollLeft = galleryScrollPosition;
        }

        lastGalleryFrame = timestamp;
        window.requestAnimationFrame(updateScroll);
    }

    function openLightbox(card, index) {
        const preview = card.querySelector("img, video");
        const isVideo = card.dataset.mediaType === "video";
        const mediaSource = card.dataset.fullSrc || preview.currentSrc || preview.src;

        portfolioLightboxImage.hidden = isVideo;
        portfolioLightboxVideo.hidden = !isVideo;

        if (isVideo) {
            portfolioLightboxVideo.src = mediaSource;
            portfolioLightboxVideo.play().catch(() => {});
        } else {
            portfolioLightboxImage.src = mediaSource;
            portfolioLightboxImage.alt = preview.alt;
        }

        portfolioLightboxCaption.textContent = `${itemLabel} ${index + 1} из ${cards.length}`;
        portfolioLightbox.showModal();
        updateVisiblePreviews();
    }

    function createClone(card, index, side) {
        const clone = card.cloneNode(true);

        clone.dataset.galleryClone = side;
        clone.setAttribute("aria-hidden", "true");
        clone.tabIndex = -1;
        clone.addEventListener("click", () => openLightbox(clone, index));
        return clone;
    }

    cards.forEach((card, index) => {
        card.addEventListener("click", () => openLightbox(card, index));
    });

    const beforeClones = cards.map((card, index) => createClone(card, index, "before"));
    const afterClones = cards.map((card, index) => createClone(card, index, "after"));
    track.prepend(...beforeClones);
    track.append(...afterClones);
    strip.addEventListener("pointerdown", startInteraction, { passive: true });
    strip.addEventListener("wheel", pauseBriefly, { passive: true });
    strip.addEventListener("keydown", pauseBriefly);
    section.querySelector(".render-gallery").addEventListener("animationend", (event) => {
        if (event.animationName !== "reveal-motion-gallery") return;

        section.classList.add("is-gallery-ready");
        updateVisiblePreviews();
    });
    updateLoopWidth();
    window.requestAnimationFrame(updateScroll);

    return { endInteraction, updateLoopWidth };
}

function closePortfolioLightbox(event) {
    if (event.target !== portfolioLightbox) return;

    portfolioLightbox.close();
}

function resetPortfolioLightbox() {
    portfolioLightboxVideo.pause();
    portfolioLightboxVideo.removeAttribute("src");
    portfolioLightboxVideo.load();
    portfolioLightboxImage.removeAttribute("src");
    portfolioLightboxImage.alt = "";
}

prepareMotionSystem();
const galleryControllers = gallerySections.map(createPortfolioGallery);
const visiblePreviews = new Set();
function updatePreviewPlayback(video) {
    const galleryReady = video.closest("[data-gallery]").classList.contains("is-gallery-ready");
    if (galleryReady && visiblePreviews.has(video) && !document.hidden && !portfolioLightbox.open && !reduceMotion) {
        video.play().catch(() => {});
    } else {
        video.pause();
    }
}
function updateVisiblePreviews() {
    visiblePreviews.forEach(updatePreviewPlayback);
}
const previewObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) visiblePreviews.add(target);
        else visiblePreviews.delete(target);
        updatePreviewPlayback(target);
    });
});
document.querySelectorAll(".render-card video").forEach((video) => previewObserver.observe(video));
document.addEventListener("visibilitychange", updateVisiblePreviews);
portfolioLightbox.addEventListener("close", updateVisiblePreviews);
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        entry.target.classList.toggle("is-in-focus", entry.intersectionRatio >= 0.45);
    });
}, { threshold: 0.45 });

updateBackgroundPosition();
updateVisitorAvailability();
updateDisplayedPrices();
updatePriceCalculator();
loadPrices();
portfolioSections.forEach((section) => sectionObserver.observe(section));
window.addEventListener("scroll", requestBackgroundUpdate, { passive: true });
homeLink.addEventListener("click", (event) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;

    const isOpen = siteHeader.classList.toggle("is-touch-open");
    if (isOpen) event.preventDefault();
});
siteHeader.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button !== 0
        || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    const target = findSectionTarget(link.hash);
    if (!target) return;

    event.preventDefault();
    if (window.location.hash !== link.hash) history.pushState(null, "", link.hash);
    if (event.detail === 0) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
    }
    scrollToSection(target, reduceMotion ? "instant" : "smooth");
});
document.addEventListener("click", (event) => {
    if (!homeLink.contains(event.target)) siteHeader.classList.remove("is-touch-open");
});
reducedMotion.addEventListener("change", (event) => {
    reduceMotion = event.matches;
    updateVisiblePreviews();
    requestBackgroundUpdate();
    if (!reduceMotion) return;

    root.classList.remove("motion-ready");
    finishSectionAnimations();
});
priceCalculator.addEventListener("input", updatePriceCalculator);
priceCalculator.addEventListener("change", updatePriceCalculator);
portfolioLightbox.addEventListener("click", closePortfolioLightbox);
portfolioLightbox.addEventListener("close", resetPortfolioLightbox);
portfolioLightboxClose.addEventListener("click", () => portfolioLightbox.close());
window.addEventListener("pointerup", () => {
    galleryControllers.forEach((gallery) => gallery.endInteraction());
}, { passive: true });
window.addEventListener("pointercancel", () => {
    galleryControllers.forEach((gallery) => gallery.endInteraction());
}, { passive: true });
window.addEventListener("load", () => {
    alignInitialSection();
    galleryControllers.forEach((gallery) => gallery.updateLoopWidth());
});
window.addEventListener("resize", () => {
    requestBackgroundUpdate();
    galleryControllers.forEach((gallery) => gallery.updateLoopWidth());
});
