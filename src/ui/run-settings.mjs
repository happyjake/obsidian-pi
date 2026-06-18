import { FuzzySuggestModal, Menu, Notice, setIcon } from "obsidian";
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
  }

  render(containerEl) {
    this.row = containerEl.createDiv({ cls: "pi-agent-run-settings" });
    this.populate(this.row);
  }

  refresh() {
    if (!this.row) return;

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
      const { selectedValue: currentSelectedValue } = this.getRunSettingLabels(
        name,
        currentOptions,
        this.plugin.settings.model
      );
      const modal = new ModelPickerModal(
        this.plugin.app,
        this.getModelPickerItems(currentOptions),
        currentSelectedValue,
        async (optionValue) => {
          await onChange(optionValue);
          this.refresh();
        }
      );
      modal.open();
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
    const buttonEl = containerEl.createEl("button", {
      cls: `clickable-icon pi-agent-run-setting ${this.getRunSettingClass(name, selectedValue)}`,
      attr: { "aria-label": `${name}: ${selectedLabel}`, title: `${name}: ${selectedLabel}` }
    });

    setIcon(buttonEl, icon);
    buttonEl.createSpan({ cls: "pi-agent-control-label", text: displayLabel });
    return buttonEl;
  }

  getModelPickerItems(options) {
    return Object.entries(options).map(([value, label]) => {
      const pickerLabel = value ? label : this.getDefaultModelPickerLabel(label);
      return {
        value,
        label: pickerLabel,
        searchText: `${value} ${pickerLabel}`.trim()
      };
    });
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
          ? value
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
    return model || "Pi default";
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

class ModelPickerModal extends FuzzySuggestModal {
  constructor(app, items, selectedValue, onChoose) {
    super(app);
    this.items = items;
    this.selectedValue = selectedValue;
    this.onChoose = onChoose;
    this.setPlaceholder("Search Pi models...");
  }

  getItems() {
    return this.items;
  }

  getItemText(item) {
    return item.searchText;
  }

  renderSuggestion(item, el) {
    const option = item.item;
    el.createDiv({
      cls: "pi-agent-model-picker-label",
      text: option.value ? option.value : "Pi default"
    });
    if (option.label && option.label !== option.value) {
      el.createDiv({ cls: "pi-agent-model-picker-detail", text: option.label });
    }
    if (option.value === this.selectedValue) {
      el.addClass("is-selected");
    }
  }

  async onChooseItem(item) {
    await this.onChoose(item.value);
  }
}
