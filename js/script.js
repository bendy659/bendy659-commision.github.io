const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const localClock = document.querySelector("#local-clock");
const portfolioLightbox = document.querySelector("#render-lightbox");
const portfolioLightboxCaption = portfolioLightbox.querySelector("figcaption");
const portfolioLightboxClose = portfolioLightbox.querySelector(".lightbox-close");
const portfolioLightboxImage = portfolioLightbox.querySelector("img");
const gallerySections = Array.from(document.querySelectorAll("[data-gallery]"));
const portfolioSections = Array.from(document.querySelectorAll(".portfolio-section"));
const localTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yakutsk",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
});

let frameRequested = false;

function updateBackgroundPosition() {
    const offset = reducedMotion.matches
        ? 0
        : Math.min(window.scrollY * 0.08, 72);

    root.style.setProperty("--background-parallax", `${-offset}px`);
    frameRequested = false;
}

function requestBackgroundUpdate() {
    if (frameRequested) {
        return;
    }

    frameRequested = true;
    window.requestAnimationFrame(updateBackgroundPosition);
}

function updateLocalClock() {
    const now = new Date();

    localClock.dateTime = now.toISOString();
    localClock.textContent = localTimeFormatter.format(now);
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
        const image = card.querySelector("img");

        portfolioLightboxImage.src = image.currentSrc || image.src;
        portfolioLightboxImage.alt = image.alt;
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

const galleryControllers = gallerySections.map(createPortfolioGallery);
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        entry.target.classList.toggle("is-in-focus", entry.intersectionRatio >= 0.45);
    });
}, { threshold: 0.45 });

updateBackgroundPosition();
updateLocalClock();
portfolioSections.forEach((section) => sectionObserver.observe(section));
window.addEventListener("scroll", requestBackgroundUpdate, { passive: true });
reducedMotion.addEventListener("change", requestBackgroundUpdate);
portfolioLightbox.addEventListener("click", closePortfolioLightbox);
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
    galleryControllers.forEach((gallery) => gallery.updateLoopWidth());
});
window.setInterval(updateLocalClock, 1000);
