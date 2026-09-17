import { Spinner } from "../Spinner.jsx";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function SuggestSkillsCard({
  effectiveKeywordGaps,
  employerOptions,
  activeSuggestSkill,
  setActiveSuggestSkill,
  suggestBulletText,
  setSuggestBulletText,
  suggestBulletTarget,
  setSuggestBulletTarget,
  saveToMasterResume,
  setSaveToMasterResume,
  suggestTextareaRef,
  addingSkill,
  onAccept,
}) {
  return (
    <div className="mb-4 md:mb-6 rounded-lg border border-border bg-card p-4 md:p-5 shadow-card">
      <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">
        Skills the job wants that your resume doesn't cover
      </p>
      <div className="flex flex-wrap gap-1.5">
        {effectiveKeywordGaps.map((skill) => (
          <Button
            key={skill}
            size="sm"
            variant={activeSuggestSkill === skill ? "default" : "outline"}
            onClick={() => {
              setActiveSuggestSkill(activeSuggestSkill === skill ? null : skill);
              setSuggestBulletText("");
              setSuggestBulletTarget("");
              setSaveToMasterResume(true);
            }}
          >
            {skill}
          </Button>
        ))}
      </div>
      {activeSuggestSkill && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            If you genuinely have real experience with "{activeSuggestSkill}", write the real
            bullet below — it'll be added to your resume and this application retried with it.
          </p>
          {employerOptions.length > 0 && (
            <Select value={suggestBulletTarget} onValueChange={setSuggestBulletTarget}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Attach to which job? (optional)" />
              </SelectTrigger>
              <SelectContent>
                {employerOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {[option.company, option.role].filter(Boolean).join(" — ")}
                    {option.dateRange ? ` (${option.dateRange})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Textarea
            ref={suggestTextareaRef}
            value={suggestBulletText}
            onChange={(event) => setSuggestBulletText(event.target.value)}
            rows={3}
            placeholder={`Describe how you used ${activeSuggestSkill}…`}
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id="save-to-master-resume"
              checked={saveToMasterResume}
              onCheckedChange={(checked) => setSaveToMasterResume(checked === true)}
            />
            <Label htmlFor="save-to-master-resume" className="text-xs font-normal text-muted-foreground">
              Also keep this on my master resume (available to future applications too)
            </Label>
          </div>
          {!saveToMasterResume && (
            <p className="text-xs text-muted-foreground">
              This bullet will only be used for this application — it won't be saved to your master
              resume or show up when tailoring other applications.
            </p>
          )}
          <Button
            size="sm"
            className="w-fit"
            onClick={() => onAccept(activeSuggestSkill)}
            disabled={addingSkill || !suggestBulletText.trim()}
          >
            {addingSkill ? (
              <>
                <Spinner className="size-4" /> Adding…
              </>
            ) : (
              "Add & retry"
            )}
          </Button>
          {addingSkill && (
            <p className="text-xs text-muted-foreground">
              Re-analyzing skill gaps and re-tailoring — this can take up to a minute…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
