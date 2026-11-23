const editor = document.querySelector("#price-editor");
const editorStatus = document.querySelector("#editor-status");
const openPricesButton = document.querySelector("#open-prices");
const downloadPricesButton = document.querySelector("#download-prices");
const priceFormatter = new Intl.NumberFormat("ru-RU");
const priceKeys = [
    "renderBase",
    "modelBase",
    "animationBase",
    "animationPerSecond",
    "animationDetailBasic",
    "animationDetailMedium",
    "animationDetailHigh"
];

let priceFileHandle = null;

function readEditorPrices() {
    return Object.fromEntries(priceKeys.map((key) => {
        const value = Math.max(Number(editor.elements.namedItem(key).value), 0);
        return [key, value];
    }));
}

function populateEditor(prices) {
    if (priceKeys.some((key) => !Number.isInteger(prices?.[key]) || prices[key] < 0 || prices[key] > 100000))
        throw new Error("Проверьте цены: нужны все семь полей с целыми значениями от 0 до 100000.");

    priceKeys.forEach((key) => {
        editor.elements.namedItem(key).value = prices[key];
    });

    updatePreview();
}

function updatePreview() {
    const prices = readEditorPrices();
    const formatPrice = (value) => `${priceFormatter.format(value)} ₽`;
    const example = prices.animationBase
        + (5 * prices.animationPerSecond)
        + prices.animationDetailMedium;

    document.querySelector("#preview-render").textContent = `от ${formatPrice(prices.renderBase)}`;
    document.querySelector("#preview-model").textContent = `от ${formatPrice(prices.modelBase)}`;
    document.querySelector("#preview-animation-base").textContent = formatPrice(prices.animationBase);
    document.querySelector("#preview-animation-second").textContent = formatPrice(prices.animationPerSecond);
    document.querySelector("#preview-animation-medium").textContent = `+${formatPrice(prices.animationDetailMedium)}`;
    document.querySelector("#preview-example").textContent = formatPrice(example);
}

function setStatus(message, isError = false) {
    editorStatus.textContent = message;
    editorStatus.classList.toggle("is-error", isError);
}

async function loadCurrentPrices() {
    try {
        const response = await fetch("../content/prices.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const prices = await response.json();
        if (priceFileHandle) return;
        populateEditor(prices);
        setStatus("Текущие цены загружены. Для записи в проект сначала выберите prices.json.");
    } catch (error) {
        setStatus(`Не удалось загрузить текущие цены: ${error.message}`, true);
    }
}

async function openPriceFile() {
    if (!("showOpenFilePicker" in window)) {
        setStatus("Этот браузер не поддерживает прямое открытие файла. Используйте скачивание копии.", true);
        return;
    }

    try {
        const [selectedHandle] = await window.showOpenFilePicker({
            types: [{
                description: "JSON с ценами",
                accept: { "application/json": [".json"] }
            }],
            multiple: false
        });

        const file = await selectedHandle.getFile();
        populateEditor(JSON.parse(await file.text()));
        priceFileHandle = selectedHandle;
        setStatus(`Открыт ${file.name}. Изменения можно сохранить напрямую.`);
    } catch (error) {
        if (error.name !== "AbortError") setStatus(`Не удалось открыть файл: ${error.message}`, true);
    }
}

async function savePrices(event) {
    event.preventDefault();
    if (!editor.reportValidity()) return;

    if (!priceFileHandle) {
        setStatus("Сначала нажмите «Открыть prices.json» и выберите content/prices.json.", true);
        return;
    }

    try {
        const writable = await priceFileHandle.createWritable();
        await writable.write(`${JSON.stringify(readEditorPrices(), null, 2)}\n`);
        await writable.close();
        setStatus("prices.json сохранён. Обновите локальный сайт, чтобы увидеть новые цены.");
    } catch (error) {
        setStatus(`Не удалось сохранить файл: ${error.message}`, true);
    }
}

function downloadPrices() {
    if (!editor.reportValidity()) return;
    const content = `${JSON.stringify(readEditorPrices(), null, 2)}\n`;
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = "prices.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Копия prices.json скачана.");
}

editor.addEventListener("input", updatePreview);
editor.addEventListener("submit", savePrices);
openPricesButton.addEventListener("click", openPriceFile);
downloadPricesButton.addEventListener("click", downloadPrices);
loadCurrentPrices();
