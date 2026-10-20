# Dental Go Plus — brand and CMS website direction

Task: [GCMS-DENTAL-GO-PLUS-001](../../tasks/GCMS-DENTAL-GO-PLUS-001.md). Owner: desktop `/root`.

This folder contains the clinic's original brand assets and a design review document. **The HTML is not the live CMS website.** The local CMS implementation is now verified in the task record. Current wordmark, per Khiêm's feedback: **Dental GO+**. Original `logo-primary.png` remains an archived first version; use `logo-primary-go-plus.png` for the corrected full logo and `logo-mark.png` for the compact symbol.

Open `index.html` to review the logo, palette and original photography. `assets/cms-signature-reference.css` is a design-reference copy. The real theme received one generic correction to center a two-person doctor grid on desktop; no tenant-specific JSX was added. Actual theme teal is `#206c66`; brand teal `#087f82` belongs to the artwork. The HTML must not be substituted for CMS-backed content.

## Intended site

VI + EN. Home, About, Services, Doctors, Fees, Journal and Contact. Use `signature`, `teal`, `system`, `comfortable` in the existing CMS. Keep all limits unchanged. The full logo is for brand collateral; the compact mark is for the current CMS header, which already renders the clinic name separately.

Homepage order: one strong hero → short introduction → services → fictional team → clinic space → journal → FAQ → consultation. Prefer a single effective hero to unnecessary autoplay. On mobile, use the existing menu and fixed consultation controls. Actual contact forms remain the existing tenant-scoped CMS intake implementation.

## Asset provenance

Logo and photographs are generated with the built-in imagegen tool. All pictured people and interiors are fictional. Do not label an AI portrait as a real patient, fabricate credentials/awards, or imply photographed treatment outcomes. Prompts and asset hashes are saved in `prompts.json`, `logo-revision-go-plus.json`, `service-prompts.json` and `assets.json`. Ten active original assets have been uploaded and processed through the Media Library. Logo PNGs preserve transparency; all source PNGs satisfy the 5 MiB limit. No editable vector master is claimed.

## Actual local site and CMS

- Website VI: `http://localhost:5892/dental-go-plus`
- Website EN: `http://localhost:5892/dental-go-plus/en`
- CMS: `http://127.0.0.1:5891/cms?tenant=0f5d20b0-51a2-46ef-aebb-c9874c650eb9`
- Login handoff: workspace-private `.local/dental-go-login.txt`, mode 0600. Do not copy its contents into tracked files or evidence.

Actual review covers 22 resources/44 published VI/EN variants, ten ready media assets, 32 eligible public media URLs, CMS draft → private preview → explicit publish → public update, a synthetic website enquiry arriving in the correct CMS list, denied cross-tenant backend access, completed-seed replay preserving later CMS changes, and retained-data/file comparison. Desktop/mobile browser evidence and actual checks live under `docs/evidence/dental-go/`. Human acceptance remains pending.

Seed scripts are local provisioning/content tools, not website runtime imports. Use project-local Bun 1.4.3. The completed seed exits without resetting later CMS edits. The task records the original source/verification repairs and exact command boundaries. No new migration or dependency was required.
