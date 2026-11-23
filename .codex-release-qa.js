const targets = await (await fetch("http://127.0.0.1:9246/json")).json();
const target = targets.find((item) => item.url.startsWith("http://127.0.0.1:4173/"));
const socket = new WebSocket(target.webSocketDebuggerUrl);

await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
});

let requestId = 0;
const pending = new Map();
const browserErrors = [];

socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.id && pending.has(message.id)) {
        const handler = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) handler.reject(new Error(message.error.message));
        else handler.resolve(message.result);
    }

    if (message.method === "Runtime.exceptionThrown")
        browserErrors.push(message.params.exceptionDetails.text);
});

function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = ++requestId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
}

async function evaluate(expression) {
    const response = await cdp("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true
    });

    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
}

await cdp("Runtime.enable");
await cdp("Network.enable");
await cdp("Network.setBlockedURLs", { urls: ["*://fonts.googleapis.com/*", "*://fonts.gstatic.com/*"] });
await cdp("Page.navigate", { url: "http://127.0.0.1:4173/" });
await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
});
await new Promise((resolve) => setTimeout(resolve, 700));

const wide = await evaluate(`(async () => {
    const calculator = document.querySelector("#price-calculator");
    calculator.elements.namedItem("animation-enabled").checked = true;
    calculator.elements.namedItem("animation-count").value = 2;
    calculator.elements.namedItem("animation-duration").value = 5;
    calculator.elements.namedItem("animation-detail").selectedIndex = 1;
    calculator.dispatchEvent(new Event("input", { bubbles: true }));

    const animationCard = document.querySelector("#animations .render-card:not([data-gallery-clone])");
    animationCard.click();
    await new Promise((resolve) => setTimeout(resolve, 400));

    const dialog = document.querySelector("#render-lightbox");
    const dialogVideo = dialog.querySelector("video");
    const stripStyle = getComputedStyle(document.querySelector("#animations .render-strip"));
    const result = {
        calculatorResult: document.querySelector("#calculator-result").textContent.trim(),
        countFieldExists: Boolean(calculator.elements.namedItem("animation-count")),
        oldTypeFieldExists: Boolean(calculator.elements.namedItem("animation-type")),
        galleries: [...document.querySelectorAll("[data-gallery]")].map((section) => ({
            id: section.id,
            originals: section.querySelectorAll(".render-card:not([data-gallery-clone])").length
        })),
        fadeMask: stripStyle.maskImage,
        lightboxOpen: dialog.open,
        lightboxReady: dialogVideo.readyState >= 2,
        pageOverflow: document.documentElement.scrollWidth > innerWidth
    };

    dialog.close();
    const animationCount = calculator.elements.namedItem("animation-count");
    animationCount.value = "1.5";
    animationCount.dispatchEvent(new Event("input", { bubbles: true }));
    result.rejectsFraction = !animationCount.validity.valid &&
        !document.querySelector("#calculator-result").textContent.includes("₽");
    result.offscreenPreviewsPaused = [...document.querySelectorAll(".render-card video")].every(video => video.paused);
    return result;
})()`);

await cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
});
await new Promise((resolve) => setTimeout(resolve, 300));

const mobile = await evaluate(`({
    viewport: [innerWidth, innerHeight],
    pageWidth: document.documentElement.scrollWidth,
    pageOverflow: document.documentElement.scrollWidth > innerWidth
})`);

const gallery = await evaluate(`(async () => {
    document.querySelector('nav a[href="#models"]').click();
    await new Promise(resolve => setTimeout(resolve, 3800));
    const strip = document.querySelector("#models .render-strip");
    const first = strip.scrollLeft;
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
        navigated: location.hash === "#models" && strip.getBoundingClientRect().top < innerHeight,
        playing: [...strip.querySelectorAll("video")].some(video => !video.paused),
        scrolling: strip.scrollLeft !== first
    };
})()`);
await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
const reduced = await evaluate(`(async () => {
    const strip = document.querySelector("#models .render-strip");
    await new Promise(resolve => setTimeout(resolve, 800));
    const first = strip.scrollLeft;
    await new Promise(resolve => setTimeout(resolve, 160));
    return { first, last: strip.scrollLeft, matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
        paused: [...strip.querySelectorAll("video")].every(video => video.paused),
        active: [...strip.querySelectorAll("video")].filter(video => !video.paused).map(video => [video.autoplay, visiblePreviews.has(video), reducedMotion.matches, root.className]) };
})()`);
await cdp("Emulation.setEmulatedMedia", { features: [] });
await cdp("Page.navigate", { url: "http://127.0.0.1:4173/admin/" });
await new Promise(resolve => setTimeout(resolve, 450));
const admin = await evaluate(`(async () => {
    const before = readEditorPrices();
    window.showOpenFilePicker = async () => [{ getFile: async () => new File(['{"modelBase":1}'], "prices.json") }];
    await openPriceFile();
    return before.renderBase > 0 && priceFileHandle === null &&
        JSON.stringify(before) === JSON.stringify(readEditorPrices()) && editorStatus.classList.contains("is-error");
})()`);
await cdp("Page.navigate", { url: "http://127.0.0.1:4173/" });
console.log(JSON.stringify({ wide, mobile, gallery, reduced, admin, browserErrors }, null, 2));
socket.close();
const prices = await fetch("http://127.0.0.1:4173/content/prices.json").then(response => response.json());
const expected = 2 * (prices.animationBase + 5 * prices.animationPerSecond + prices.animationDetailMedium);
if (Number(wide.calculatorResult.replace(/\D/g, "")) !== expected ||
    !wide.rejectsFraction || !wide.offscreenPreviewsPaused || !wide.lightboxOpen || !wide.lightboxReady ||
    wide.pageOverflow || mobile.pageOverflow || !gallery.navigated || !gallery.playing || !gallery.scrolling ||
    !reduced.matches || !reduced.paused || reduced.first !== reduced.last || !admin || browserErrors.length) process.exitCode = 1;
