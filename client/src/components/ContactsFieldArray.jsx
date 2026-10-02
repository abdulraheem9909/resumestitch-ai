import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Fully controlled by the parent dialog's local state — never calls an API
// itself. Each contact is `{ _id?, name, role, email }`; `_id` (present only
// when editing an existing company) is kept only as a React key, never sent
// back to the server (normalizeOutreachCompanyPayload strips it server-side
// too). Deliberately not built on EditableEntryList.jsx, since that
// component saves each array change immediately via its own API call, while
// this array must be held in the parent's state and submitted once with the
// rest of the company form.
export function ContactsFieldArray({ contacts, onChange }) {
  function updateContact(index, field, value) {
    onChange(contacts.map((contact, i) => (i === index ? { ...contact, [field]: value } : contact)));
  }
  function addContact() {
    onChange([...contacts, { name: "", role: "", email: "" }]);
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
            onChange={(event) => updateContact(index, "name", event.target.value)}
          />
          <Input
            placeholder="Role (e.g. CTO)"
            aria-label={`Contact ${index + 1} role`}
            value={contact.role}
            onChange={(event) => updateContact(index, "role", event.target.value)}
          />
          <Input
            type="email"
            placeholder="Email"
            aria-label={`Contact ${index + 1} email`}
            value={contact.email}
            onChange={(event) => updateContact(index, "email", event.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
