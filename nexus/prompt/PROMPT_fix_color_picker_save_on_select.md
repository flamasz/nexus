# Prompt: Fix Color Picker to Only Save on Explicit "Select" Button Click

> Paste this as your task prompt when using your PAMS Codex agent.

---

```
## Task: Stop the color picker from saving every color scrolled through — only save on "Select" button click

### Bug

When the user opens the custom color picker and drags/scrolls through colors, every intermediate color the picker passes through gets saved to the recent colors list. The recent colors row fills up with dozens of unwanted colors from a single pick session. The color should only be saved to recent colors when the user explicitly confirms their choice.

### How to fix

1. **Separate preview state from committed state**: The color picker should use a local preview state that updates live as the user drags/scrolls, but this preview value must NOT be written to the category's `color` field or the recent colors list until the user clicks "Select".

   ```typescript
   const [previewColor, setPreviewColor] = useState(currentColor || '#000000');
   // The picker's onChange updates ONLY previewColor
   // Nothing is saved until "Select" is clicked
   ```

2. **Add a "Select" button** inside the color picker popover/modal:
   - Place it at the bottom of the color picker popover, below the color picker component.
   - Button text: "Select"
   - Style: primary button (blue/indigo filled, white text), full width of the popover or comfortably sized.
   - Optionally add a "Cancel" link/button next to it that closes the picker without saving.

3. **"Select" button behavior**: When clicked:
   a. Set the category's badge color to the `previewColor` value.
   b. Add the `previewColor` to the recent custom colors list (insert at front, dedup, cap at 15).
   c. Close the color picker popover.

4. **Live preview (optional but nice)**: While the user drags through colors in the picker, you CAN optionally show a live preview of the badge color changing in real-time within the popover (e.g., a small preview swatch showing what the badge would look like). But do NOT update the actual category badge, the recent colors list, or the database until "Select" is clicked.

5. **Closing without selecting**: If the user closes the picker by clicking outside or pressing Escape (without clicking "Select"), discard the preview color. No save, no addition to recent colors. The category keeps its previous color.

6. **Color picker popover layout**:
   ```
   ┌─────────────────────────┐
   │  [Color picker widget]  │
   │                         │
   │  Preview: [██] #FF6B35  │
   │                         │
   │  [       Select       ] │
   └─────────────────────────┘
   ```
   - Show the hex value next to a small preview swatch so the user knows exactly what they're selecting.
   - The "Select" button is the clear call-to-action at the bottom.

### What NOT to change

- Do not change the preset color swatches behavior (clicking a preset still selects it immediately — no confirmation needed for presets).
- Do not change the recent colors row display, ordering, or dedup logic.
- Do not change clicking a recent color swatch (still selects immediately).
- Do not change anything outside of the custom color picker interaction.

### Verification

- Open color picker → drag/scroll through many colors → close without clicking "Select" → recent colors list is unchanged, category color is unchanged.
- Open color picker → drag to a color → click "Select" → ONLY that one color is added to recent colors. No intermediate colors saved.
- Open color picker → pick a color → click "Select" → category badge updates to the selected color.
- Open color picker → click outside to dismiss → no color saved, no change.
- Open color picker → press Escape → no color saved, no change.
- Rapidly open picker, select, open again, select a different color → exactly 2 new colors in recent list, in correct order.
- Preset swatch clicks still work immediately without requiring a "Select" confirmation.
- Recent color swatch clicks still work immediately without requiring a "Select" confirmation.
```
