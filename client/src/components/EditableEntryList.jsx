import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function emptyEntry(fields) {
  return Object.fromEntries(fields.map((field) => [field.key, ""]));
}

function EntryFields({ fields, values, onChange, idPrefix }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((field) => (
        <div
          key={field.key}
          className={field.type === "textarea" ? "col-span-2 flex flex-col gap-1.5" : "flex flex-col gap-1.5"}
        >
          <Label htmlFor={`${idPrefix}-${field.key}`}>{field.label}</Label>
          {field.type === "textarea" ? (
            <Textarea
              id={`${idPrefix}-${field.key}`}
              value={values[field.key] || ""}
              onChange={(event) => onChange(field.key, event.target.value)}
              rows={3}
            />
          ) : (
            <Input
              id={`${idPrefix}-${field.key}`}
              value={values[field.key] || ""}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * A reusable editable list of structured entries — Education, Projects,
 * Certifications, and Volunteer Work on the resume detail page all use this.
 * Add/edit/delete an entry in place; every change saves the whole updated
 * array in one call to `onSave`. No save-on-blur anywhere — every add/edit
 * needs an explicit Save/Add click, matching every other write path already
 * in this codebase (bullet editing, skill chips, the personalInfo dialog).
 */
export function EditableEntryList({ title, entries, fields, onSave, emptyMessage, addLabel, renderSummary }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValues, setEditingValues] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [newValues, setNewValues] = useState(() => emptyEntry(fields));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEditing(index) {
    setEditingIndex(index);
    setEditingValues({ ...emptyEntry(fields), ...entries[index] });
    setError("");
  }

  function cancelEditing() {
    setEditingIndex(null);
    setEditingValues({});
  }

  async function saveEditing() {
    setSaving(true);
    setError("");
    try {
      const next = entries.map((entry, index) => (index === editingIndex ? editingValues : entry));
      await onSave(next);
      setEditingIndex(null);
      setEditingValues({});
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(index) {
    setSaving(true);
    setError("");
    try {
      await onSave(entries.filter((_, i) => i !== index));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addEntry() {
    setSaving(true);
    setError("");
    try {
      await onSave([...entries, newValues]);
      setIsAdding(false);
      setNewValues(emptyEntry(fields));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const hasAnyNewValue = fields.some((field) => (newValues[field.key] || "").trim());

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">{title}</p>
        {!isAdding && (
          <Button variant="ghost" size="sm" className="w-fit" onClick={() => setIsAdding(true)} disabled={saving}>
            <Plus className="size-4" /> {addLabel}
          </Button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {entries.length === 0 && !isAdding && <p className="text-sm text-muted-foreground">{emptyMessage}</p>}

      <ul className="flex flex-col gap-3">
        {entries.map((entry, index) => (
          <li key={entry._id || index} className={index > 0 ? "border-t border-border pt-3" : ""}>
            {editingIndex === index ? (
              <div className="flex flex-col gap-3">
                <EntryFields
                  fields={fields}
                  values={editingValues}
                  onChange={(key, value) => setEditingValues((prev) => ({ ...prev, [key]: value }))}
                  idPrefix={`edit-${title}-${index}`}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEditing} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={saving}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">{renderSummary(entry)}</div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => startEditing(index)} disabled={saving}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteEntry(index)}
                    disabled={saving}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {isAdding && (
        <div className={`flex flex-col gap-3${entries.length > 0 ? " mt-3 border-t border-border pt-3" : ""}`}>
          <EntryFields
            fields={fields}
            values={newValues}
            onChange={(key, value) => setNewValues((prev) => ({ ...prev, [key]: value }))}
            idPrefix={`new-${title}`}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={addEntry} disabled={saving || !hasAnyNewValue}>
              {saving ? "Adding…" : "Add"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNewValues(emptyEntry(fields));
                setError("");
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
