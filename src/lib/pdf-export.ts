/**
 * Export a DOM node to a multi-page A4 PDF.
 * Page cuts are moved back to the top of the nearest ".break-inside-avoid"
 * block, so a page always starts at the beginning of a question / section
 * and nothing is sliced in half.
 */
export async function exportNodeToPdf(
  node: HTMLElement,
  fileName: string,
  options?: { credit?: string },
) {
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const scale = 2;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 6;
  const credit = options?.credit?.trim() || "";
  const footerSpace = credit ? 9 : 0;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2 - footerSpace;


  // Render the sheet at true A4 content width (96dpi) so text fills the page
  // instead of being shrunk down from a wide desktop layout.
  const A4_CONTENT_PX = Math.round((usableWidth / 25.4) * 96);
  const previousWidth = node.style.width;
  const previousMaxWidth = node.style.maxWidth;
  node.style.width = `${A4_CONTENT_PX}px`;
  node.style.maxWidth = `${A4_CONTENT_PX}px`;
  node.classList.add("pdf-exporting");
  // Force reflow before measuring keep-together blocks.
  void node.offsetHeight;

  const nodeRect = node.getBoundingClientRect();
  // Measure keep-together blocks before rasterizing, relative to the node top.
  const avoidBlocks = Array.from(node.querySelectorAll<HTMLElement>(".break-inside-avoid"))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: (rect.top - nodeRect.top) * scale,
        bottom: (rect.bottom - nodeRect.top) * scale,
      };
    })
    .filter((b) => b.bottom > b.top && b.bottom > 0)
    .sort((a, b) => a.top - b.top);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(node, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: A4_CONTENT_PX,
      windowWidth: A4_CONTENT_PX,
      onclone: (clonedDoc) => {
        clonedDoc.documentElement.classList.remove("dark");
        clonedDoc.body.classList.remove("dark");
        clonedDoc.body.style.background = "#ffffff";
      },
    });
  } finally {
    node.classList.remove("pdf-exporting");
    node.style.width = previousWidth;
    node.style.maxWidth = previousMaxWidth;
  }
  const canvasPageHeight = (usableHeight * canvas.width) / usableWidth;

  const splitsBlock = (end: number, start: number) =>
    avoidBlocks.some((b) => b.top > start && b.top < end && b.bottom > end);

  const cuts: number[] = [0];
  let pageStart = 0;
  let guard = 0;
  while (pageStart < canvas.height && guard++ < 200) {
    const naturalEnd = pageStart + canvasPageHeight;
    if (naturalEnd >= canvas.height) break;

    // Prefer cutting at the natural end, but never inside a keep-together block.
    let pageEnd = naturalEnd;
    if (splitsBlock(naturalEnd, pageStart)) {
      // Move the cut to the start of the block that would be split,
      // so the whole block moves to the next page.
      const block = avoidBlocks.find(
        (b) => b.top > pageStart && b.top < naturalEnd && b.bottom > naturalEnd,
      )!;
      pageEnd = block.top;
    }

    // Avoid a very short page (less than 25% filled) unless keeping a block together.
    const minFill = pageStart + canvasPageHeight * 0.25;
    if (pageEnd < minFill) {
      // Only fall back to naturalEnd if it doesn't split a block.
      if (!splitsBlock(naturalEnd, pageStart)) {
        pageEnd = naturalEnd;
      }
    }

    if (pageEnd <= pageStart) break;
    cuts.push(pageEnd);
    pageStart = pageEnd;
  }


  const { getIsPremium } = await import("@/lib/premium-flag");
  const watermark = getIsPremium() ? null : "تصميم مروة أبوبكر / أكاديمية التعزيز";


  cuts.forEach((start, index) => {
    const end = cuts[index + 1] ?? canvas.height;
    const sliceHeight = Math.max(1, Math.round(end - start));
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, Math.round(start), canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    const imageHeight = (sliceHeight * usableWidth) / canvas.width;
    if (index > 0) pdf.addPage();
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.95),
      "JPEG",
      margin,
      margin,
      usableWidth,
      Math.min(imageHeight, usableHeight),
    );
  });

  if (watermark) {
    // Drawn from a canvas so Arabic text keeps correct shaping.
    const dpi = 4; // px per mm
    const heightMm = 14;
    const probe = document.createElement("canvas").getContext("2d");
    const fontPx = Math.round(heightMm * dpi * 0.6);
    const font = `700 ${fontPx}px "Cairo", "Tajawal", system-ui, sans-serif`;
    if (probe) probe.font = font;
    const widthMm = Math.max(40, (probe?.measureText(watermark).width ?? 300) / dpi + 6);
    const c = document.createElement("canvas");
    c.width = Math.round(widthMm * dpi);
    c.height = Math.round(heightMm * dpi);
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.font = font;
      ctx.fillStyle = "rgba(120,120,120,0.18)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(watermark, c.width / 2, c.height / 2);
      const dataUrl = c.toDataURL("image/png");
      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page++) {
        pdf.setPage(page);
        for (let row = 0; row < 5; row++) {
          pdf.addImage(
            dataUrl,
            "PNG",
            (pageWidth - widthMm) / 2,
            30 + row * 55,
            widthMm,
            heightMm,
            undefined,
            "NONE",
            -20,
          );
        }
      }
    }
  }


  // Designer credit at the bottom of every page. Drawn from a canvas so
  // Arabic text keeps its correct shaping (the PDF core fonts cannot).
  if (credit) {
    const dpi = 4; // px per mm
    const heightMm = 5;
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (ctx) {
      const fontPx = Math.round(heightMm * dpi * 0.72);
      ctx.font = `600 ${fontPx}px "Cairo", "Tajawal", system-ui, sans-serif`;
      const widthMm = Math.max(20, ctx.measureText(credit).width / dpi + 4);
      c.width = Math.round(widthMm * dpi);
      c.height = Math.round(heightMm * dpi);
      const ctx2 = c.getContext("2d")!;
      ctx2.fillStyle = "#ffffff";
      ctx2.fillRect(0, 0, c.width, c.height);
      ctx2.font = `600 ${fontPx}px "Cairo", "Tajawal", system-ui, sans-serif`;
      ctx2.fillStyle = "#6b7280";
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillText(credit, c.width / 2, c.height / 2);
      const dataUrl = c.toDataURL("image/png");
      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page++) {
        pdf.setPage(page);
        pdf.addImage(
          dataUrl,
          "PNG",
          (pageWidth - widthMm) / 2,
          pageHeight - margin - heightMm,
          widthMm,
          heightMm,
        );
      }
    }
  }

  pdf.save(fileName);
}

