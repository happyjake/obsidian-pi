import { Menu, Notice, setIcon } from "obsidian";
import {
  CUSTOM_MODEL_VALUE,
  getModelOptions,
  getReasoningOptions,
  getResolvedReasoning,
  getToolModeOptions
} from "../plugin/settings.mjs";
import { confirmWithModal } from "./modals/confirm-modal.mjs";

export class RunSettingsControls {
  constructor(plugin, callbacks = {}) {
    this.plugin = plugin;
    this.callbacks = callbacks;
    this.modelPickerQuery = "";
  }

  render(containerEl) {
    this.row = containerEl.createDiv({ cls: "pi-agent-run-settings" });
    this.populate(this.row);
  }

  refresh() {
    if (!this.row) return;

    this.closeModelPicker();
    this.row.empty();
    this.populate(this.row);
  }

  populate(containerEl) {
    this.addModelRunSetting(
      containerEl,
      "Model",
      "sparkles",
      getModelOptions(this.plugin.settings),
      this.plugin.settings.model,
      async (value) => {
        this.plugin.settings.model = value;
        this.plugin.settings.reasoningEffort = "";
        if (value === CUSTOM_MODEL_VALUE && !this.plugin.settings.customModel) {
          new Notice("Set custom model ID in plugin settings.");
        }
        await this.plugin.saveSettings();
        this.notifyChange();
        this.refresh();
      }
    );

    this.addRunSetting(
      containerEl,
      "Think",
      "brain",
      getReasoningOptions(this.plugin.settings),
      this.plugin.settings.reasoningEffort,
      async (value) => {
        this.plugin.settings.reasoningEffort = value;
        await this.plugin.saveSettings();
        this.notifyChange();
      }
    );

    this.addRunSetting(
      containerEl,
      "Tools",
      this.getRunSettingIcon("Tools", this.plugin.settings.sandboxMode),
      getToolModeOptions(),
      this.plugin.settings.sandboxMode,
      async (value) => {
        if (
          (value === "edit" || value === "full-agent" || value === "workspace-write") &&
          !this.plugin.settings.acknowledgedToolRisk &&
          !(await confirmWithModal(this.plugin.app, {
            title: "Enable write tools?",
            message:
              "Pi tool modes are not an OS-level sandbox. Edit and Full agent can modify vault/project files, and Full agent can run shell commands.",
            confirmText: "Enable tools",
            warning: true
          }))
        ) {
          this.refresh();
          return;
        }

        this.plugin.settings.sandboxMode = value;
        if (value === "edit" || value === "full-agent" || value === "workspace-write") {
          this.plugin.settings.acknowledgedToolRisk = true;
        }
        await this.plugin.saveSettings();
        this.notifyChange();
      }
    );
  }

  notifyChange() {
    this.callbacks.onChange?.();
  }

  addModelRunSetting(containerEl, name, icon, options, value, onChange) {
    const { selectedValue, selectedLabel, displayLabel } = this.getRunSettingLabels(
      name,
      options,
      value
    );
    const buttonEl = this.createRunSettingButton(
      containerEl,
      name,
      icon,
      selectedValue,
      selectedLabel,
      displayLabel
    );

    buttonEl.addEventListener("click", async (event) => {
      event.preventDefault();
      if ((this.plugin.settings.availableModels ?? []).length === 0) {
        new Notice("Loading Pi models...");
        await this.plugin.refreshModelCatalog(true);
        this.refresh();
      }
      const currentOptions = getModelOptions(this.plugin.settings);
      this.toggleModelPicker(buttonEl, currentOptions, async (optionValue) => {
        await onChange(optionValue);
        this.closeModelPicker();
        this.refresh();
      });
    });
  }

  addRunSetting(containerEl, name, icon, options, value, onChange) {
    const { selectedValue, selectedLabel, displayLabel } = this.getRunSettingLabels(
      name,
      options,
      value
    );
    const buttonEl = this.createRunSettingButton(
      containerEl,
      name,
      icon,
      selectedValue,
      selectedLabel,
      displayLabel
    );

    buttonEl.addEventListener("click", async (event) => {
      event.preventDefault();
      const menu = new Menu();

      for (const [optionValue, optionLabel] of Object.entries(options)) {
        menu.addItem((item) => {
          item.setTitle(optionLabel).onClick(async () => {
            await onChange(optionValue);
            this.refresh();
          });
          if (optionValue === selectedValue) item.setIcon("check");
        });
      }

      menu.showAtMouseEvent(event);
    });
  }

  getRunSettingLabels(name, options, value) {
    const selectedValue =
      Object.prototype.hasOwnProperty.call(options, value) || value ? value : "";
    const selectedLabel = options[selectedValue] ?? value ?? "Default";
    const displayLabel = this.formatRunSettingDisplayLabel(name, selectedValue, selectedLabel);
    const titleLabel = name === "Model" ? displayLabel : selectedLabel;
    return { selectedValue, selectedLabel: titleLabel, displayLabel };
  }

  createRunSettingButton(containerEl, name, icon, selectedValue, selectedLabel, displayLabel) {
    const parentEl =
      name === "Model"
        ? containerEl.createSpan({ cls: "pi-agent-model-picker-anchor" })
        : containerEl;
    const buttonEl = parentEl.createEl("button", {
      cls: `clickable-icon pi-agent-run-setting ${this.getRunSettingClass(name, selectedValue)}`,
      attr: { "aria-label": `${name}: ${selectedLabel}`, title: `${name}: ${selectedLabel}` }
    });

    setIcon(buttonEl, icon);
    buttonEl.createSpan({ cls: "pi-agent-control-label", text: displayLabel });
    return buttonEl;
  }

  getModelPickerItems(options) {
    const modelsBySlug = new Map(
      (this.plugin.settings.availableModels ?? []).map((model) => [model.slug, model])
    );
    return Object.entries(options).map(([value, label]) => {
      const pickerLabel = value ? label : this.getDefaultModelPickerLabel(label);
      const model = modelsBySlug.get(value);
      return {
        value,
        label: pickerLabel,
        name: this.formatModelPickerName(value, pickerLabel, model),
        provider: this.formatModelPickerProvider(value, pickerLabel, model),
        searchText: `${value} ${pickerLabel}`.trim()
      };
    });
  }

  toggleModelPicker(buttonEl, options, onChoose) {
    if (this.modelPickerEl) {
      this.closeModelPicker();
      return;
    }
    this.modelPickerButtonEl = buttonEl;
    this.modelPickerOptions = options;
    this.modelPickerOnChoose = onChoose;
    this.modelPickerQuery = "";
    this.renderModelPicker();

    const closeOnOutsidePointer = (event) => {
      if (this.modelPickerEl?.contains(event.target) || buttonEl.contains(event.target)) return;
      this.closeModelPicker();
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") this.closeModelPicker();
    };
    const reposition = () => this.positionModelPicker();
    document.addEventListener("mousedown", closeOnOutsidePointer, true);
    document.addEventListener("keydown", closeOnEscape, true);
    window.addEventListener("resize", reposition, true);
    window.addEventListener("scroll", reposition, true);
    this.modelPickerCleanup = () => {
      document.removeEventListener("mousedown", closeOnOutsidePointer, true);
      document.removeEventListener("keydown", closeOnEscape, true);
      window.removeEventListener("resize", reposition, true);
      window.removeEventListener("scroll", reposition, true);
    };
  }

  closeModelPicker() {
    this.modelPickerCleanup?.();
    this.modelPickerCleanup = undefined;
    this.modelPickerEl?.remove();
    this.modelPickerEl = undefined;
    this.modelPickerButtonEl = undefined;
    this.modelPickerOptions = undefined;
    this.modelPickerOnChoose = undefined;
  }

  renderModelPicker() {
    const anchorEl = this.modelPickerButtonEl?.closest(".pi-agent-model-picker-anchor");
    if (!anchorEl || !this.modelPickerOptions) return;

    this.modelPickerEl?.remove();
    const pickerEl = document.body.createDiv({ cls: "pi-agent-model-picker-popover" });
    this.modelPickerEl = pickerEl;

    const searchEl = pickerEl.createDiv({ cls: "pi-agent-model-picker-search" });
    setIcon(searchEl.createSpan(), "search");
    const inputEl = searchEl.createEl("input", {
      attr: { type: "text", placeholder: "Search 300+ models..." }
    });
    inputEl.value = this.modelPickerQuery;
    inputEl.addEventListener("input", () => {
      this.modelPickerQuery = inputEl.value;
      this.populateModelPickerResults();
    });

    this.modelPickerResultsEl = pickerEl.createDiv({ cls: "pi-agent-model-picker-results" });
    this.populateModelPickerResults();
    window.setTimeout(() => inputEl.focus(), 0);
  }

  positionModelPicker() {
    if (!this.modelPickerEl || !this.modelPickerButtonEl) return;

    const rect = this.modelPickerButtonEl.getBoundingClientRect();
    const width = Math.min(540, window.innerWidth - 16);
    this.modelPickerEl.style.width = `${width}px`;

    const height = this.modelPickerEl.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left));
    const topAbove = rect.top - height - 8;
    const topBelow = rect.bottom + 8;
    const top =
      topAbove >= 8 ? topAbove : Math.max(8, Math.min(window.innerHeight - height - 8, topBelow));

    this.modelPickerEl.style.left = `${left}px`;
    this.modelPickerEl.style.top = `${top}px`;
  }

  populateModelPickerResults() {
    if (!this.modelPickerResultsEl || !this.modelPickerOptions) return;

    this.modelPickerResultsEl.empty();
    const query = this.modelPickerQuery.trim().toLowerCase();
    const items = this.getModelPickerItems(this.modelPickerOptions).filter((item) =>
      query ? item.searchText.toLowerCase().includes(query) : true
    );
    const favorites = items.filter((item) => this.isFavoriteModel(item.value));
    const allModels = items.filter((item) => !this.isFavoriteModel(item.value));

    if (favorites.length > 0) {
      this.renderModelPickerSection("Favorites", favorites, true);
      this.modelPickerResultsEl.createDiv({ cls: "pi-agent-model-picker-separator" });
    }
    this.renderModelPickerSection("All models", allModels, false);
    if (items.length === 0) {
      this.modelPickerResultsEl.createDiv({
        cls: "pi-agent-model-picker-empty",
        text: `No models match "${this.modelPickerQuery}".`
      });
    }
    this.positionModelPicker();
  }

  renderModelPickerSection(title, items, favoriteSection) {
    if (!this.modelPickerResultsEl || items.length === 0) return;
    const headingEl = this.modelPickerResultsEl.createDiv({ cls: "pi-agent-model-picker-heading" });
    if (favoriteSection) setIcon(headingEl.createSpan(), "star");
    headingEl.createSpan({ text: title });
    for (const item of items) this.renderModelPickerRow(item);
  }

  renderModelPickerRow(item) {
    if (!this.modelPickerResultsEl) return;
    const selected = item.value === this.plugin.settings.model;
    const favorite = this.isFavoriteModel(item.value);
    const rowEl = this.modelPickerResultsEl.createDiv({
      cls: `pi-agent-model-picker-row${selected ? " is-selected" : ""}`
    });
    setIcon(rowEl.createSpan({ cls: "pi-agent-model-picker-row-icon" }), "sparkles");
    const textEl = rowEl.createDiv({ cls: "pi-agent-model-picker-row-text" });
    textEl.createDiv({ cls: "pi-agent-model-picker-row-name", text: item.name });
    textEl.createDiv({ cls: "pi-agent-model-picker-row-provider", text: item.provider });
    if (selected) setIcon(rowEl.createSpan({ cls: "pi-agent-model-picker-check" }), "check");
    const canFavorite = item.value && item.value !== CUSTOM_MODEL_VALUE;
    if (canFavorite) {
      const favoriteEl = rowEl.createEl("button", {
        cls: `clickable-icon pi-agent-model-picker-favorite${favorite ? " is-favorite" : ""}`,
        attr: { type: "button", title: favorite ? "Unfavorite model" : "Favorite model" }
      });
      setIcon(favoriteEl, "star");
      favoriteEl.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await this.toggleFavoriteModel(item.value);
        this.populateModelPickerResults();
      });
    }
    rowEl.addEventListener("click", () => this.modelPickerOnChoose?.(item.value));
  }

  isFavoriteModel(value) {
    return this.plugin.isScopedModel?.(value) ?? false;
  }

  async toggleFavoriteModel(value) {
    try {
      await this.plugin.toggleScopedModel(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(message);
      console.warn("Pi Agent: failed to update scoped models", error);
    }
  }

  getDefaultModelPickerLabel(label) {
    return this.plugin.settings.effectiveModel
      ? `${label} (${this.plugin.settings.effectiveModel})`
      : label;
  }

  formatRunSettingDisplayLabel(name, value, label) {
    return name === "Model"
      ? value === CUSTOM_MODEL_VALUE
        ? this.plugin.settings.customModel.trim() || this.formatDefaultModelLabel()
        : value
          ? this.formatModelPickerName(
              value,
              label,
              this.plugin.settings.availableModels.find((model) => model.slug === value)
            )
          : this.formatDefaultModelLabel()
      : name === "Think"
        ? value
          ? label.split(" - ")[0].replace(/^XHigh$/i, "XHigh")
          : this.formatDefaultReasoningLabel()
        : name === "Tools"
          ? value === "chat"
            ? "Chat"
            : value === "read-only"
              ? "Review"
              : value === "full-agent"
                ? "Full"
                : value === "edit" || value === "workspace-write"
                  ? "Edit"
                  : label
          : label;
  }

  formatDefaultModelLabel() {
    const model = this.plugin.settings.effectiveModel;
    return model ? this.formatModelPickerName(model, model) : "Pi default";
  }

  formatModelPickerName(value, label, model) {
    if (!value) return "Pi default";
    if (value === CUSTOM_MODEL_VALUE) return this.plugin.settings.customModel.trim() || "Custom";
    const slug = model?.slug ?? value;
    return titleCaseModel(slug.split("/").pop() || label || value);
  }

  formatModelPickerProvider(value, label, model) {
    if (!value) return this.plugin.settings.effectiveModel || "Use Pi default";
    if (value === CUSTOM_MODEL_VALUE) return "Custom model ID";
    const slug = model?.slug ?? value;
    const parts = slug.split("/");
    return titleCaseProvider(parts.length > 2 ? parts[1] : parts[0] || label);
  }

  formatDefaultReasoningLabel() {
    const reasoning = this.plugin.settings.effectiveReasoning;
    return reasoning
      ? this.formatReasoningLabel(reasoning)
      : this.formatReasoningLabel(getResolvedReasoning(this.plugin.settings));
  }

  formatReasoningLabel(reasoning) {
    return reasoning === "pi-default" || reasoning === "cli-default"
      ? "Pi default"
      : reasoning === "xhigh"
        ? "XHigh"
        : reasoning.charAt(0).toUpperCase() + reasoning.slice(1);
  }

  getRunSettingIcon(name, value) {
    return name === "Tools"
      ? value === "chat"
        ? "message-square"
        : value === "full-agent"
          ? "terminal"
          : value === "edit" || value === "workspace-write"
            ? "pencil-line"
            : "eye"
      : "";
  }

  getRunSettingClass(name, value) {
    return name === "Model"
      ? "pi-agent-run-setting-model"
      : name === "Tools"
        ? value === "full-agent"
          ? "pi-agent-run-setting-mode-full"
          : value === "edit" || value === "workspace-write"
            ? "pi-agent-run-setting-mode-write"
            : "pi-agent-run-setting-mode-read"
        : "";
  }
}

function titleCaseModel(value) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      return lower === "gpt"
        ? "GPT"
        : lower === "ai"
          ? "AI"
          : lower === "api"
            ? "API"
            : /^\d+(?:\.\d+)?$/.test(part)
              ? part
              : `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

function titleCaseProvider(value) {
  const lower = String(value || "").toLowerCase();
  return lower === "openai"
    ? "OpenAI"
    : lower === "anthropic"
      ? "Anthropic"
      : lower === "google"
        ? "Google"
        : titleCaseModel(value);
}
