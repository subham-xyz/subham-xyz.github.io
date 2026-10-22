const workspace = document.querySelector<HTMLElement>("#converter")!;
const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = get<HTMLInputElement>("file-input");
const format = get<HTMLSelectElement>("output-format");
const outputName = get<HTMLInputElement>("output-name");
function normalizeFilename(value: string) {
  return value.replace(/\.(jpe?g|png|webp)$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "").slice(0, 100) || "image-kittysuite";
}
outputName.addEventListener("blur", () => { outputName.value = normalizeFilename(outputName.value.trim()); });
const quality = get<HTMLInputElement>("quality");
const dropzone = get<HTMLDivElement>("dropzone");
const preview = get<HTMLImageElement>("input-preview");
const resultPreview = get<HTMLImageElement>("output-preview");
let original: File | null = null;
let sourceURL = "";
let outputURL = "";
let job = 0;
let phase = "upload";
let dragDepth = 0;
const size = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
function kittyState(state: string) {
  workspace
    .querySelectorAll<HTMLElement>("[data-kitty]")
    .forEach((kitty) => (kitty.dataset.state = state));
}
function announce(message: string) {
  get("tool-status").textContent = message;
}
function show(next: string, message: string) {
  phase = next;
  workspace.querySelectorAll<HTMLElement>(".state-panel").forEach((panel) => {
    panel.hidden = panel.id !== `${next}-panel`;
    panel.classList.remove("state-enter");
    if (!panel.hidden) panel.classList.add("state-enter");
  });
  workspace
    .querySelectorAll<HTMLElement>("[data-step]")
    .forEach((step) =>
      step.classList.toggle(
        "active",
        step.dataset.step === next ||
          (next === "processing" && step.dataset.step === "editor"),
      ),
    );
  workspace.setAttribute("aria-busy", String(next === "processing"));
  kittyState(
    next === "result"
      ? "success"
      : next === "error"
        ? "error"
        : next === "processing"
          ? "processing"
          : "idle",
  );
  announce(message);
}
function release() {
  preview.removeAttribute("src");
  resultPreview.removeAttribute("src");
  if (sourceURL) URL.revokeObjectURL(sourceURL);
  if (outputURL) URL.revokeObjectURL(outputURL);
  sourceURL = "";
  outputURL = "";
  original = null;
  get<HTMLAnchorElement>("download").removeAttribute("href");
}
function fail(message: string) {
  release();
  show("error", message);
  get("error-message").textContent = message;
  get("error-title").focus();
}
function reset() {
  job++;
  release();
  input.value = "";
  show("upload", "Ready for another image.");
  input.focus();
}
workspace
  .querySelectorAll<HTMLButtonElement>("[data-reset]")
  .forEach((button) => button.addEventListener("click", reset));
function updateOptions() {
  get("file-extension").textContent = format.value === "image/jpeg" ? ".jpg" : `.${format.value.split("/")[1]}`;
  get("quality-field").hidden = format.value === "image/png";
  get("format-hint").textContent =
    format.value === "image/jpeg"
      ? "Transparent areas become white. Animated inputs become a still image."
      : "Transparency is preserved. Animated inputs become a still image.";
}
format.addEventListener("change", updateOptions);
quality.addEventListener("input", () => {
  get("quality-value").textContent = `${quality.value}%`;
});
const probe = document.createElement("canvas");
probe.width = probe.height = 1;
if (!probe.toDataURL("image/webp").startsWith("data:image/webp")) {
  format.querySelector<HTMLOptionElement>('[value="image/webp"]')!.disabled =
    true;
  format.value = "image/jpeg";
}
updateOptions();
async function selectFile(files: FileList | File[]) {
  if (phase === "processing") return;
  const current = ++job;
  release();
  if (files.length !== 1) {
    fail(
      "Please choose one image at a time. Loki will give each file its full attention.",
    );
    return;
  }
  const file = files[0];
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    fail("This format is not supported yet. Choose a JPG, PNG, or WebP image.");
    return;
  }
  if (file.size === 0 || file.size > 20 * 1024 * 1024) {
    fail("Choose a non-empty image smaller than 20 MB, then try again.");
    return;
  }
  show("processing", "Checking your image.");
  try {
    sourceURL = URL.createObjectURL(file);
    preview.src = sourceURL;
    await preview.decode();
    if (current !== job) return;
    if (
      !preview.naturalWidth ||
      preview.naturalWidth * preview.naturalHeight > 16000000 ||
      preview.naturalWidth > 16384 ||
      preview.naturalHeight > 16384
    )
      throw new Error(
        "This image is too large to process comfortably. Choose an image under 16 megapixels with each side below 16,384 pixels.",
      );
    original = file;
    get<HTMLInputElement>("output-name").value = `${file.name.replace(/\.[^.]+$/, "") || "image"}-kittysuite`;
    get("file-name").textContent = file.name;
    get("file-meta").textContent =
      `${preview.naturalWidth} × ${preview.naturalHeight} px · ${size(file.size)}`;
    show("editor", `${file.name} selected. Choose an output format.`);
    format.focus();
  } catch (error) {
    if (current === job)
      fail(
        error instanceof Error && error.message.startsWith("This image")
          ? error.message
          : "We could not read this image. It may be damaged or saved with a different file type. Try another JPG, PNG, or WebP.",
      );
  }
}
input.addEventListener("change", () => {
  if (input.files?.length) void selectFile(input.files);
});
function fileDrag(event: DragEvent) {
  return event.dataTransfer?.types.includes("Files");
}
document.addEventListener("dragenter", (event) => {
  if (!fileDrag(event)) return;
  event.preventDefault();
  dragDepth++;
  if (phase === "upload") {
    dropzone.classList.add("dragging");
    kittyState("upload");
  }
});
document.addEventListener("dragover", (event) => {
  if (fileDrag(event)) {
    event.preventDefault();
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = phase === "processing" ? "none" : "copy";
  }
});
document.addEventListener("dragleave", (event) => {
  if (!fileDrag(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) {
    dropzone.classList.remove("dragging");
    if (phase === "upload") kittyState("idle");
  }
});
document.addEventListener("drop", (event) => {
  if (!fileDrag(event)) return;
  event.preventDefault();
  dragDepth = 0;
  dropzone.classList.remove("dragging");
  if (event.dataTransfer?.files.length)
    void selectFile(event.dataTransfer.files);
});
get("convert").addEventListener("click", async () => {
  if (!original || phase !== "editor") return;
  const file = original;
  const current = ++job;
  const mime = format.value;
  const value = Number(quality.value) / 100;
  const requestedName = get<HTMLInputElement>("output-name").value.trim();
  const safeName = normalizeFilename(requestedName);
  show("processing", "Converting your image locally.");
  const canvas = document.createElement("canvas");
  try {
    // Let the browser paint the honest processing state before canvas work.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    canvas.width = preview.naturalWidth;
    canvas.height = preview.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Your browser could not create an image canvas. Try a smaller image or another browser.",
      );
    if (mime === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(preview, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(
                new Error(
                  "Your browser could not convert this image. Try a smaller image.",
                ),
              ),
        mime,
        value,
      ),
    );
    if (current !== job) return;
    if (blob.type !== mime)
      throw new Error(
        "Your browser does not support this output format. Try JPG or PNG instead.",
      );
    outputURL = URL.createObjectURL(blob);
    resultPreview.src = outputURL;
    const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const download = get<HTMLAnchorElement>("download");
    download.href = outputURL;
    download.download = `${safeName}.${extension}`;
    get("result-meta").replaceChildren(
      ...[
        `Original: ${size(file.size)}`,
        `${extension.toUpperCase()}: ${size(blob.size)}`,
        `${canvas.width} × ${canvas.height} px`,
      ].map((text) => {
        const span = document.createElement("span");
        span.textContent = text;
        return span;
      }),
    );
    show(
      "result",
      `Conversion complete. Your ${extension.toUpperCase()} image is ready to download.`,
    );
    get("result-title").focus();
  } catch (error) {
    if (current === job)
      fail(
        error instanceof Error
          ? error.message
          : "Something went wrong. Try a smaller image or another format.",
      );
  } finally {
    canvas.width = canvas.height = 0;
  }
});
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    job++;
    release();
  }
});
