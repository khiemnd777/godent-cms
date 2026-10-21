import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { BuilderFields, PresentationFields } from "./builder-fields";
import { emptyBuilder } from "../lib/builder-state";
import { newSection } from "../lib/builder-content";
import { sourceDocument } from "../lib/rich-text";
import type { SitePresentation } from "../../api/src/contracts/m4";

test("homepage slide editor offers selection and manual phrase controls", () => {
  const home = emptyBuilder("home"); home.sections = [newSection("hero_carousel")];
  const props = { tenantId: "tenant", locale: "vi" as const, sources: {}, disabled: false, slugLocked: false, onChange: () => {}, onSource: () => {} };
  const html = renderToStaticMarkup(<BuilderFields {...props} content={home}/>);
  expect(html).toContain("Cụm từ nhấn trong tiêu đề");
  expect(html).toContain('aria-label="Dùng đoạn tiêu đề đang chọn cho ảnh 1"');
  expect(html).toContain("Dùng đoạn đang chọn");
  expect(html).toContain("Chọn đúng những từ cần nhấn trong tiêu đề; dòng chữ sẽ tự ngắt theo màn hình.");
  const page = emptyBuilder("page"); page.sections = [newSection("hero_carousel")];
  expect(renderToStaticMarkup(<BuilderFields {...props} content={page}/>)).not.toContain("Dùng đoạn đang chọn");
});

test("signature config editor offers per-locale style without requiring a new field on old drafts", () => {
  const content: SitePresentation = { name: "Clinic", logo: null, theme: "signature", themeVersion: 1, palette: "teal", font: "system", layout: "comfortable", footer: { intro: "", body: sourceDocument("") }, menu: [], signature: { navigation: [], headerLocation: null, footerLocations: [] } };
  const html = renderToStaticMarkup(<PresentationFields content={content} tenantId="tenant" locale="en" footerSource="" disabled={false} onChange={() => {}} onSource={() => {}}/>);
  expect(html).toContain("Kiểu chữ Hero trang chủ");
  expect(html).toContain("Biên tập ấm");
  expect(html).toContain("Biên tập hồng");
  expect(html).toContain('<option value="default" selected="">Mặc định</option>');
});

test("private and public Signature layouts bundle the same editorial font source", () => {
  const css = readFileSync(new URL("../../website/app/signature.css", import.meta.url), "utf8");
  expect(readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8")).toContain('import "../../website/app/signature.css"');
  expect(readFileSync(new URL("../../website/app/layout.tsx", import.meta.url), "utf8")).toContain('import "./signature.css"');
  for (const name of ["dm-serif-display-regular.ttf", "dm-serif-display-italic.ttf"]) {
    expect(css).toContain(`url("./fonts/${name}")`);
    expect(readFileSync(new URL(`../../website/app/fonts/${name}`, import.meta.url)).length).toBeGreaterThan(1000);
  }
  expect(readFileSync(new URL("../../website/app/fonts/DMSerifDisplay-OFL.txt", import.meta.url), "utf8")).toContain("SIL OPEN FONT LICENSE Version 1.1");
});
