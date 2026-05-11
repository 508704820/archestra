"use client";

import type { archestraApiTypes } from "@shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCreateCatalogPreset,
  useUpdateCatalogPreset,
  useUpdateInternalMcpCatalogItem,
} from "@/lib/mcp/internal-mcp-catalog.query";
import { type CatalogItem, listCatalogFields } from "./preset-helpers";

const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

type FieldValue = string | number | boolean | string[];
type Preset = archestraApiTypes.GetCatalogChildrenResponses["200"][number];

interface PresetEditorDialogProps {
  cat: CatalogItem;
  /** When null, dialog is in "create" mode. When set, edits that preset (or parent's default values when preset.id === cat.id). */
  preset: Preset | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PresetEditorDialog({
  cat,
  preset,
  open,
  onOpenChange,
}: PresetEditorDialogProps) {
  const isEdit = preset !== null;
  const isEditingDefaultPreset = preset !== null && preset.id === cat.id;

  const presetFields = listCatalogFields(cat).filter(
    (f) => f.scope === "preset",
  );

  const create = useCreateCatalogPreset(cat.id);
  const update = useUpdateCatalogPreset(cat.id);
  const updateParent = useUpdateInternalMcpCatalogItem();

  const [name, setName] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>(
    {},
  );
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (preset) {
      setName(preset.name);
      setFieldValues({ ...preset.presetFieldValues });
    } else {
      setName("");
      setFieldValues({});
    }
    setNameError(null);
  }, [open, preset]);

  async function save() {
    setNameError(null);
    if (isEdit && preset) {
      if (isEditingDefaultPreset) {
        await updateParent.mutateAsync({
          id: cat.id,
          data: { presetFieldValues: fieldValues },
        });
      } else {
        await update.mutateAsync({
          presetId: preset.id,
          data: { presetFieldValues: fieldValues },
        });
      }
    } else {
      const trimmed = name.trim();
      if (!DNS_LABEL.test(trimmed)) {
        setNameError(
          "Name must be a DNS-1123 label: lowercase alphanumeric and hyphens, starting and ending with alphanumeric.",
        );
        return;
      }
      await create.mutateAsync({
        name: trimmed,
        presetFieldValues: fieldValues,
      });
    }
    onOpenChange(false);
  }

  const isPending =
    create.isPending || update.isPending || updateParent.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {isEditingDefaultPreset
              ? "Edit default preset"
              : isEdit
                ? `Edit preset — ${preset?.name}`
                : "New preset"}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="preset-name">Name</Label>
              <Input
                id="preset-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="staging"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                DNS-1123 label, max 63 chars. Immutable after creation.
              </p>
              {nameError && (
                <p className="text-xs text-destructive" role="alert">
                  {nameError}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Field values
            </div>
            {presetFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This catalog has no preset-scoped fields. Mark fields with{" "}
                <span className="font-mono">promptOnPreset</span> in the
                Configuration tab first.
              </p>
            ) : (
              <div className="space-y-3">
                {presetFields.map((f) => (
                  <FieldValueInput
                    key={`${f.origin}:${f.key}`}
                    fieldKey={f.key}
                    label={`${f.origin === "userConfig" ? "user" : "env"}.${f.key}`}
                    description={f.description}
                    fallback={f.staticValue}
                    value={fieldValues[f.key]}
                    onChange={(v) =>
                      setFieldValues((prev) => {
                        if (v === undefined) {
                          const { [f.key]: _drop, ...rest } = prev;
                          return rest;
                        }
                        return { ...prev, [f.key]: v };
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Create preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FieldValueInputProps {
  fieldKey: string;
  label: string;
  description?: string;
  fallback?: FieldValue;
  value: FieldValue | undefined;
  onChange: (v: FieldValue | undefined) => void;
}

function FieldValueInput({
  fieldKey,
  label,
  description,
  fallback,
  value,
  onChange,
}: FieldValueInputProps) {
  const useFallback = value === undefined;
  const fallbackText =
    fallback === undefined ? "(no catalog default)" : String(fallback);
  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={`fv-${fieldKey}`} className="font-mono text-xs">
          {label}
        </Label>
        <Label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <Checkbox
            checked={useFallback}
            onCheckedChange={(checked) =>
              onChange(checked ? undefined : (value ?? ""))
            }
          />
          Use catalog default
        </Label>
      </div>
      {description && (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      )}
      {useFallback ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          → {fallbackText}
        </p>
      ) : (
        <Input
          id={`fv-${fieldKey}`}
          value={typeof value === "string" ? value : String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
      )}
    </div>
  );
}
