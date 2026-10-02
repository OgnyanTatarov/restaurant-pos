import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { menuFromTextItems } from "../core/menu-pdf.mjs";
import type { Category, MenuItem } from "./types";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function menuFromPdf(data: Uint8Array): Promise<{
  categories: Category[];
  menu: MenuItem[];
}> {
  const pdf = await getDocument({ data, verbosity: 0 }).promise;
  const items: { str: string; x: number; y: number }[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      items.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5] - (pageNumber - 1) * 10000,
      });
    }
  }
  await pdf.cleanup();
  return menuFromTextItems(items) as {
    categories: Category[];
    menu: MenuItem[];
  };
}
