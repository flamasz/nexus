# Prompt: Add Archive Button to Upload Blocks + Restrict Delete to Admin Only

> Paste this as your task prompt when using your PAMS Codex agent.

---

```
## Task: Add an archive button to each upload session block and restrict the delete button to admin roles only

### Part 1: Schema Change

1. **`upload_sessions` table** — add:
   - `archived (boolean, default: false)`

2. **Migration**: Add the `archived` column. Existing rows default to `false`.

### Part 2: Archive Button on Upload Blocks

3. Add an archive icon button to each upload session card in the right pane, positioned to the LEFT of the existing delete (trash) button.

   Current layout (top-right of each upload block):
   ```
   [Approved] [Approved ▾]                          [🗑]
   ```

   New layout:
   ```
   [Approved] [Approved ▾]                     [📦] [🗑]
   ```

4. **Archive button style**:
   - Small icon-only button, same size as the delete button.
   - Use an archive icon (e.g., `Archive` or `ArchiveX` from lucide-react).
   - Neutral/gray color: `text-gray-400 hover:text-gray-600`.
   - Add a tooltip on hover: "Archive".
   - Small gap between archive and delete buttons (`gap-1` or `gap-2`).

5. **Archive button behavior**:
   - Clicking it toggles the `archived` field on the upload session to `true`.
   - No confirmation dialog needed — archiving is non-destructive.
   - Archived upload blocks are hidden from the upload history by default.
   - Show a brief toast/notification: "Upload archived" with an "Undo" action that sets `archived` back to `false`.

6. **Unarchive / Show archived uploads**:
   - Add a toggle at the top of the Upload History section: "Show archived" (checkbox or toggle switch).
   - When toggled on, archived upload blocks appear in the history with a visual indicator that they're archived (e.g., a subtle gray background, reduced opacity, or an "Archived" badge).
   - Archived upload blocks show an unarchive button (same position as the archive button, but with an `ArchiveRestore` icon) so users can restore them.
   - Default state: archived uploads are hidden.

### Part 3: Restrict Delete Button to Admin Only

7. **Delete button visibility**: Only show the delete (trash) icon button if the current user has `role === 'admin'`. For non-admin users, the delete button is completely hidden — not disabled, not grayed out, just absent from the DOM.

8. **Server-side validation**: Also add a server-side check on the delete upload session endpoint/action. If a non-admin user somehow triggers a delete (e.g., via API), reject it with a 403 Forbidden. Do not rely solely on hiding the button.

9. **Layout adjustment**: When the delete button is hidden (non-admin user), the archive button sits alone in the top-right corner. Ensure spacing still looks clean — no empty gap where the delete button would have been.

### Part 4: Updated button layout by role

- **Admin sees**: `[Archive] [Delete]`
- **Non-admin sees**: `[Archive]`
- **On archived uploads (when "Show archived" is on)**:
  - **Admin sees**: `[Unarchive] [Delete]`
  - **Non-admin sees**: `[Unarchive]`

### What NOT to change

- Do not change upload session content (files, notes, status dropdown, timestamps).
- Do not change the upload flow, file storage, email notifications, or sidebar.
- Do not change the existing delete behavior or confirmation dialog for admins — just gate its visibility and add server-side protection.
- Do not archive/delete files from Supabase Storage when archiving — archiving is a soft hide, not a deletion.

### Verification

- Non-admin user: sees archive button on each upload block, does NOT see delete button.
- Admin user: sees both archive and delete buttons on each upload block.
- Click archive → upload block disappears from history → toast shows "Upload archived" with Undo.
- Click Undo on toast → upload block reappears.
- Toggle "Show archived" → archived blocks appear with visual distinction + unarchive button.
- Click unarchive → block returns to normal visibility.
- Admin clicks delete → existing confirmation + delete behavior works as before.
- Non-admin tries to call delete API directly → 403 Forbidden.
- Upload history with mix of archived and non-archived → only non-archived show by default.
- Confirm `npm run build` passes with zero type errors.
```
