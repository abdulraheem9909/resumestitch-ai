import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTACT_CATEGORIES, guessContactCategory } from "@/lib/guessContactCategory.js";

// Fully controlled by the parent dialog's local state — never calls an API
// itself. Each contact is `{ _id?, name, role, email, category, categoryTouched? }`;
// `_id` and `categoryTouched` are UI-only, never sent to the server
// (normalizeOutreachCompanyPayload strips anything outside its own field
// list). `categoryTouched` tracks whether the user has ever picked a
// category by hand for this contact — while false, typing into Role
// re-guesses the category; once the dropdown is used directly, the guess
// never overwrites it again. Deliberately not built on EditableEntryList.jsx,
// since that component saves each array change immediately via its own API
// call, while this array must be held in the parent's state and submitted
// once with the rest of the company form.
export function ContactsFieldArray({ contacts, onChange }) {
  function updateField(index, field, value) {
    onChange(
      contacts.map((contact, i) => {
        if (i !== index) return contact;
        const next = { ...contact, [field]: value };
        if (field === "role" && !contact.categoryTouched) {
          next.category = guessContactCategory(value);
        }
        return next;
      })
    );
  }
  function updateCategory(index, value) {
    onChange(contacts.map((contact, i) => (i === index ? { ...contact, category: value, categoryTouched: true } : contact)));
  }
  function addContact() {
    onChange([...contacts, { name: "", role: "", email: "", category: "Other", categoryTouched: false }]);
  }
  function removeContact(index) {
    onChange(contacts.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label>Contacts</Label>
        <Button type="button" size="sm" variant="outline" onClick={addContact}>
          <Plus className="size-4" /> Add person
        </Button>
      </div>

      {contacts.length === 0 && <p className="text-sm text-muted-foreground">No contacts added yet.</p>}

      {contacts.map((contact, index) => (
        <div key={contact._id || `new-${index}`} className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Person {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="-my-1.5 text-muted-foreground hover:text-destructive"
              onClick={() => removeContact(index)}
              aria-label={`Remove contact ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <Input
            placeholder="Name"
            aria-label={`Contact ${index + 1} name`}
            value={contact.name}
            onChange={(event) => updateField(index, "name", event.target.value)}
          />
          <div className="flex gap-2">
            <Input
              placeholder="Role (e.g. CTO)"
              aria-label={`Contact ${index + 1} role`}
              value={contact.role}
              onChange={(event) => updateField(index, "role", event.target.value)}
              className="flex-1"
            />
            <Select value={contact.category || "Other"} onValueChange={(value) => updateCategory(index, value)}>
              <SelectTrigger className="w-36 shrink-0" aria-label={`Contact ${index + 1} category`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="email"
            placeholder="Email"
            aria-label={`Contact ${index + 1} email`}
            value={contact.email}
            onChange={(event) => updateField(index, "email", event.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
