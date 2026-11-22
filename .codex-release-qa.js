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
    calculator.elements.namedItem("animation-detail").value = 300;
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

console.log(JSON.stringify({ wide, mobile, browserErrors }, null, 2));
socket.close();
