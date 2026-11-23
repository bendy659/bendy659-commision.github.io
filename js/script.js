const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
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
const portfolioSections = Array.from(document.querySelectorAll(".portfolio-section"));
const siteHeader = document.querySelector(".site-header");
const motionPanels = Array.from(document.querySelectorAll(
    ".order-guide, .portfolio-section, .contact-section, .render-pricing"
));
const motionCards = Array.from(document.querySelectorAll(
    ".guide-card, .pricing-cell, .contact-card, .calculator-card, .calculator-service"
));
const motionTargets = [...motionPanels, ...motionCards];
const motionTextElements = new WeakMap();
const motionSentinelTargets = new WeakMap();
const pendingCentralMotionTargets = new Set();
const pendingNestedMotionTargets = new Set();
const defaultPrices = Object.freeze({
    renderBase: 850,
    modelBase: 1000,
    animationBase: 500,
    animationPerSecond: 100,
    animationDetailBasic: 0,
    animationDetailMedium: 300,
    animationDetailHigh: 600
});
const visitorTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
});
const priceFormatter = new Intl.NumberFormat("ru-RU");

let frameRequested = false;
let prices = { ...defaultPrices };

function addMotionText(element, type, delay) {
    if (!element) return null;

    const textLength = element.textContent.trim().length;
    const stepCount = Math.min(Math.max(textLength, 8), 36);

    element.classList.add("motion-text", `motion-${type}-text`);
    element.style.setProperty("--motion-text-delay", `${delay}ms`);
    element.style.setProperty("--motion-text-steps", stepCount);
    return element;
}

function getMotionTextTargets(target) {
    const textElements = [];
    const isPanel = target.classList.contains("motion-panel");
    const titleDelay = isPanel ? 680 : 360;
    const copyDelay = isPanel ? 980 : 620;
    let title = null;
    let copy = null;

    if (target.matches(".order-guide")) {
        title = target.querySelector(":scope > .guide-heading h2");
        copy = target.querySelector(":scope > .guide-heading > p");
    } else if (target.matches(".portfolio-section")) {
        title = target.querySelector(":scope > .category-heading .category-title");
        copy = target.querySelector(":scope > .category-heading > p");
    } else if (target.matches(".render-pricing")) {
        title = target.querySelector(":scope > .pricing-heading h3");
        copy = target.querySelector(":scope > .pricing-heading > p");
    } else if (target.matches(".contact-card, .calculator-card")) {
        title = target.querySelector(":scope > h2");
        copy = target.querySelector(":scope > p");
    } else if (target.matches(".guide-card")) {
        title = target.querySelector(":scope > h3");
        copy = target.querySelector(":scope > p");
    } else if (target.matches(".pricing-cell")) {
        title = target.querySelector(":scope > h4");
        copy = target.querySelector(":scope > .price-list, :scope > .requirements-list");
    } else if (target.matches(".calculator-service")) {
        title = target.querySelector(":scope > legend");
        copy = target.querySelector(":scope > label, :scope > .calculator-fields");
    }

    const titleElement = addMotionText(title, "title", titleDelay);
    const copyElement = addMotionText(copy, "copy", copyDelay);

    if (titleElement) textElements.push(titleElement);
    if (copyElement) textElements.push(copyElement);
    return textElements;
}

function revealMotionTarget(target) {
    target.classList.add("is-revealed");
    pendingCentralMotionTargets.delete(target);
    pendingNestedMotionTargets.delete(target);
    motionTextElements.get(target)?.forEach((element) => {
        element.classList.add("is-text-revealed");
    });
}

function updateMotionTriggers() {
    if (reducedMotion.matches) return;

    const centralTriggerLine = window.innerHeight * 0.65;
    const nestedTriggerLine = window.innerHeight * 0.88;
    const pageBottomReached = window.scrollY + window.innerHeight
        >= document.documentElement.scrollHeight - 2;

    pendingCentralMotionTargets.forEach((target) => {
        const sentinel = target.previousElementSibling;
        if (sentinel?.classList.contains("motion-sentinel")
            && sentinel.getBoundingClientRect().top <= centralTriggerLine)
            revealMotionTarget(target);
    });
    pendingNestedMotionTargets.forEach((target) => {
        const bounds = target.getBoundingClientRect();
        const reachedTriggerLine = bounds.top <= nestedTriggerLine && bounds.bottom >= 0;
        const visibleAtPageBottom = pageBottomReached && bounds.top < window.innerHeight;

        if (reachedTriggerLine || visibleAtPageBottom) revealMotionTarget(target);
    });
}

function prepareMotionSystem() {
    const main = document.querySelector("main");
    const centralMotionElements = [];
    const nestedMotionElements = [];

    motionPanels.forEach((panel) => panel.classList.add("motion-target", "motion-panel"));
    motionCards.forEach((card, index) => {
        card.classList.add("motion-target", "motion-card");
        card.style.setProperty("--motion-order", index % 4);
    });
    motionTargets.forEach((target) => {
        motionTextElements.set(target, getMotionTextTargets(target));
        target.addEventListener("animationend", (event) => {
            const isOwnAnimation = event.target === target
                && (event.animationName === "assemble-motion-panel"
                    || event.animationName === "assemble-motion-card");

            if (isOwnAnimation) target.classList.add("motion-complete");
        });

        if (target.parentElement === main) {
            const sentinel = document.createElement("span");

            sentinel.className = "motion-sentinel";
            sentinel.setAttribute("aria-hidden", "true");
            target.before(sentinel);
            motionSentinelTargets.set(sentinel, target);
            pendingCentralMotionTargets.add(target);
            centralMotionElements.push(sentinel);
        } else {
            pendingNestedMotionTargets.add(target);
            nestedMotionElements.push(target);
        }
    });

    if (reducedMotion.matches) {
        motionTargets.forEach(revealMotionTarget);
        portfolioSections.forEach((section) => section.classList.add("is-gallery-ready"));
        return;
    }

    root.classList.add("motion-ready");
    const revealIntersectingTargets = (entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const target = motionSentinelTargets.get(entry.target) || entry.target;

            revealMotionTarget(target);
            observer.unobserve(entry.target);
        });
    };
    const centralMotionObserver = new IntersectionObserver(revealIntersectingTargets, {
        rootMargin: "-35% 0px -35%",
        threshold: 0
    });
    const nestedMotionObserver = new IntersectionObserver(revealIntersectingTargets, {
        rootMargin: "0px 0px -12%",
        threshold: 0
    });

    centralMotionElements.forEach((element) => centralMotionObserver.observe(element));
    nestedMotionElements.forEach((element) => nestedMotionObserver.observe(element));
}

function updateBackgroundPosition() {
    const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = scrollRange > 0
        ? Math.min(Math.max(window.scrollY / scrollRange, 0), 1)
        : 0;
    const parallaxRange = window.innerHeight * 0.18;
    const offset = reducedMotion.matches ? 0 : -(parallaxRange * scrollProgress);

    root.style.setProperty("--background-parallax", `${offset}px`);
    updateMotionTriggers();
    updateStickyCategoryHeadings();
    frameRequested = false;
}

function updateStickyCategoryHeadings() {
    const headerHeight = siteHeader.getBoundingClientRect().bottom;

    root.style.setProperty("--site-header-height", `${headerHeight}px`);

    portfolioSections.forEach((section) => {
        const sectionBounds = section.getBoundingClientRect();
        const headingBounds = section.querySelector(".category-heading").getBoundingClientRect();
        const headingIsStuck = headingBounds.top <= headerHeight
            && sectionBounds.bottom > headerHeight + 80;

        section.classList.toggle("is-heading-stuck", headingIsStuck);
    });
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
        const enabled = checkbox.checked;

        service.classList.toggle("is-selected", enabled);
        service.querySelectorAll('input:not([type="checkbox"]), select').forEach((control) => {
            control.disabled = !enabled;
        });
    });

    let total = 0;
    let selectedServices = 0;

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

function alignInitialSection() {
    if (!window.location.hash) return;

    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const target = document.getElementById(targetId);
    if (!target) return;

    const targetTop = target.offsetTop - siteHeader.getBoundingClientRect().bottom;
    const previousScrollBehavior = root.style.scrollBehavior;

    root.style.scrollBehavior = "auto";
    window.scrollTo(0, targetTop);
    root.style.scrollBehavior = previousScrollBehavior;

    if (target.classList.contains("motion-target")) revealMotionTarget(target);
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

    cards.forEach((card, index) => {
        card.style.setProperty("--motion-order", index % 6);
    });

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

        galleryLoopWidth = firstAfterClone.offsetLeft - cards[0].offsetLeft;
        galleryScrollPosition = galleryLoopWidth * previousRatio;
        galleryScrollPosition = normalizePosition(galleryScrollPosition);
        strip.scrollLeft = galleryScrollPosition;
        galleryInitialized = true;
    }

    function updateScroll(timestamp) {
        const elapsed = Math.min(timestamp - lastGalleryFrame, 50);
        const isPaused = isGalleryPointerActive
            || timestamp < galleryPausedUntil
            || portfolioLightbox.open
            || document.hidden
            || (!reducedMotion.matches && !section.classList.contains("is-gallery-ready"));

        if (!galleryInitialized) {
            lastGalleryFrame = timestamp;
            window.requestAnimationFrame(updateScroll);
            return;
        }

        if (isPaused) {
            galleryScrollPosition = normalizePosition(strip.scrollLeft);
            strip.scrollLeft = galleryScrollPosition;
        } else {
            galleryScrollPosition += elapsed * 0.045;
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
        if (event.animationName === "reveal-motion-gallery")
            section.classList.add("is-gallery-ready");
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
reducedMotion.addEventListener("change", () => {
    requestBackgroundUpdate();
    if (!reducedMotion.matches) return;

    root.classList.remove("motion-ready");
    motionTargets.forEach(revealMotionTarget);
    portfolioSections.forEach((section) => section.classList.add("is-gallery-ready"));
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
