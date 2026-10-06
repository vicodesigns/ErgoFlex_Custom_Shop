# ErgoFlex Divi page editor

## Interactive product view

The video section now includes a click-to-load product viewer. Local file previews use `http://127.0.0.1:3000/product-demo.html`, served by the existing development server. It offers one fixed default desk finish, Product view only, height, tilt, glide, reset view, and backdrop selection. These controls operate the 3D model.

For the live LA Tech Week page, run `python3 divi-editor/build-site-upload.py`, then upload and **extract** `divi-editor/site-upload/ergoflex-explore-3d-tilt-lighting-20261006.zip` directly inside the existing hosting directory `wp-content/uploads/2026/promo/ergoflex-demo`, allowing its files to be overwritten. This flat archive puts `product-demo.html` directly in that directory; do not create a second nested `ergoflex-demo` folder. The package includes the public desk model in `assets/model/desk-public.glb`, matching trim/motion assets, current controller, saved looks and layered lighting. Set **Video section → Hosted 3D viewer URL** to `/wp-content/uploads/2026/promo/ergoflex-demo/product-demo.html?v=desktop-tilt-reach-20261006`. The staged module graph uses that release cache key, and `BUILD.json` records the release and file hashes. A local file preview maps the hosted URL to the local dev server; the public site needs the files hosted over HTTPS. Test the direct viewer URL before the page button. The separate `physical-auto-dj-engineer-handoff.zip` contains documentation, not a website update.

The editor retains the viewer URL, introduction, button label, and note through export/import. Use the standalone page preview to operate the viewer; clicking in the editor selects editing fields.

Open `ergoflex-editor.html` in Chrome or another modern browser. It is a single HTML file that can be moved to another folder or computer. Click a headline, paragraph, image, video, or section in the preview; its editing field opens on the left. The left panel also has fields for links, the five videos, colors, and dimensions. The right panel can preview desktop or phone width.

To use it in WordPress:

1. Edit the fields. For a replacement image, paste its URL or choose an image file. For a replacement video, upload it to WordPress Media Library and paste its public URL.
2. Click **Download Divi code**. Open the downloaded HTML file in a text editor, select all, and copy it. **Copy Divi code** may also work if your browser allows clipboard access to local files.
3. In Divi, open the existing Code module and replace its entire contents with the copied code. Set its enclosing section padding to 0 and row width/max width to 100%, as with the original page.
4. Preview on desktop and phone before publishing.

To edit the page again later, open this editor and choose **Open existing HTML**, then select the last exported HTML file. Keep a copy of each exported file as your backup.

This editor runs locally and does not publish anything to WordPress. The original supplied Code module is preserved in `original-divi-code-module.html`.

The revised LA Tech Week page is `tech-week-divi-code-module.html`. Open `ergoflex-demos.html` for a standalone preview, or `ergoflex-editor.html` to edit it. The palette adapts the magenta, black, and white of LA's 2026 Tech Week artwork; these are adapted colors, not official brand tokens. The page proposes a collaboration and does not claim a confirmed event appearance.

Launch copy reflects the founder's confirmation that this is the final launch version and that a third patent application has been submitted. Issued patent numbers 11,779,107 and 12,708,198 are recorded in the desk stack's `docs/ERGOFLEX_PLATFORM_CLAIM_MATRIX.md` and its preserved patent evidence. The third application's number was not provided. Copy states patent counts and status without assigning patent coverage to individual software features. Historical demonstration footage remains labeled as footage from across the ErgoFlex journey. The product section and patent highlights are editable under **Highlights**.

To rebuild the editor and preview after changing the revised module, run `python3 divi-editor/build-editor.py` from the project root. `refresh-tech-week.py` recreates the initial revised module from the preserved original; do not rerun it over later manual edits. Keep your downloaded edited HTML and reopen it with **Open existing HTML** to continue editing your own version.

The original page includes a short embedded hero video and embedded posters. Replacing these with Media Library URLs will reduce the size of the Code module. Images selected from your computer are embedded into the exported HTML so they do not require a separate upload.

The Fold fix includes microphone input under **Music → Live → Use microphone**, mobile browser guidance, and a single touch scroller for all compact LED Command Center settings. Android Chrome cannot share another app’s audio: visitors can use nearby music through the microphone, a song file, or the demo soundtrack. The microphone requires HTTPS and permission; use the direct viewer tab if an embed blocks permission.

Desktop reflections now follow tilt: the existing −5° footprint is preserved, 0° extends its depth by 25% to reach the front, and positive angles progressively fill the front through +15°. Both desktop sizes and power modules use the same field, with the existing surface controls. The curve is tuned from the owner’s observations. `npm run test:led-tilt` verifies rendered front illumination across five poses on both sizes.
