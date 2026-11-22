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
const visitorTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
});
const priceFormatter = new Intl.NumberFormat("ru-RU");

let frameRequested = false;

function updateBackgroundPosition() {
    const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = scrollRange > 0
        ? Math.min(Math.max(window.scrollY / scrollRange, 0), 1)
        : 0;
    const parallaxRange = window.innerHeight * 0.18;
    const offset = reducedMotion.matches ? 0 : -(parallaxRange * scrollProgress);

    root.style.setProperty("--background-parallax", `${offset}px`);
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

        total += count * 850;
        selectedServices += 1;
    }

    if (modelEnabled) {
        const count = Math.max(Number(priceCalculator.elements.namedItem("model-count").value), 1);

        total += count * 1000;
        selectedServices += 1;
    }

    if (animationEnabled) {
        const count = Math.max(Number(priceCalculator.elements.namedItem("animation-count").value), 1);
        const duration = Math.max(Number(priceCalculator.elements.namedItem("animation-duration").value), 1);
        const detail = Number(priceCalculator.elements.namedItem("animation-detail").value);

        total += count * (500 + (duration * 100) + detail);
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

    const header = document.querySelector(".site-header");
    const targetTop = target.offsetTop - header.offsetHeight;
    const previousScrollBehavior = root.style.scrollBehavior;

    root.style.scrollBehavior = "auto";
    window.scrollTo(0, targetTop);
    root.style.scrollBehavior = previousScrollBehavior;
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
            || document.hidden;

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

const galleryControllers = gallerySections.map(createPortfolioGallery);
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        entry.target.classList.toggle("is-in-focus", entry.intersectionRatio >= 0.45);
    });
}, { threshold: 0.45 });

updateBackgroundPosition();
updateVisitorAvailability();
updatePriceCalculator();
portfolioSections.forEach((section) => sectionObserver.observe(section));
window.addEventListener("scroll", requestBackgroundUpdate, { passive: true });
reducedMotion.addEventListener("change", requestBackgroundUpdate);
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
