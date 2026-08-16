/**
 * I'm Snappy — Settings page
 * Model provider, API keys, preferences, and profile/about text.
 * Editorial off-white canvas, warm ink type.
 */
import { useEffect, useState } from "react";
import { KeyRound, Bot, User, Palette, Globe2, Save } from "lucide-react";
import { toast } from "sonner";
import DiscoverLayout from "@/components/DiscoverLayout";
import { FREE_MODELS } from "@/lib/agent";
import { readPreferences, savePreferences } from "@/lib/localStore";
import { trpc } from "@/lib/trpc";

type ProviderKey = {
  id: string;
  name: string;
  placeholder: string;
  description: string;
};

const PROVIDER_KEYS: ProviderKey[] = [
  { id: "opencode-zen", name: "OpenCode Zen", placeholder: "sk-…", description: "Free research models — works in this preview immediately." },
  { id: "openai", name: "OpenAI", placeholder: "sk-…", description: "GPT models. Stored on this device until the backend forwards it." },
  { id: "anthropic", name: "Anthropic", placeholder: "sk-ant-…", description: "Claude models for long-form drafting." },
  { id: "google", name: "Google AI", placeholder: "AIza…", description: "Gemini models for multimodal work." },
  { id: "openrouter", name: "OpenRouter", placeholder: "sk-or-…", description: "Route across many providers through one key." },
  { id: "ollama", name: "Ollama (local)", placeholder: "http://localhost:11434", description: "Base URL of a local Ollama instance, no key needed." },
];

const readProviderKey = (id: string) => localStorage.getItem(`imsnappy:key:${id}`) ?? "";
const writeProviderKey = (id: string, value: string) => {
  if (value.trim()) localStorage.setItem(`imsnappy:key:${id}`, value.trim());
  else localStorage.removeItem(`imsnappy:key:${id}`);
};

const LOCAL_PERSISTED = readPreferences();

export default function SettingsPage() {
  const { data: me } = trpc.auth.me.useQuery(undefined, { retry: 0 });
  const isSignedIn = Boolean(me?.openId);
  const utils = trpc.useUtils();
  const { data: serverPrefs } = trpc.settings.get.useQuery(undefined, { enabled: isSignedIn, retry: 0 });
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      toast.message("Preferences saved.", { description: "Stored on the server and this device — the agent reads them everywhere." });
    },
    onError: (error) => {
      toast.error("Could not save to the server.", { description: `${error.message} — still stored on this device for the local preview.` });
    },
  });

  const PERSISTED = serverPrefs && isSignedIn ? { ...LOCAL_PERSISTED, ...serverPrefs } : LOCAL_PERSISTED;

  const [modelProvider, setModelProvider] = useState<string>(PERSISTED.provider);
  const [model, setModel] = useState(PERSISTED.model);
  const [temperature, setTemperature] = useState(String(PERSISTED.temperature));
  const [maxTokens, setMaxTokens] = useState(String(PERSISTED.maxTokens));

  useEffect(() => {
    if (serverPrefs && isSignedIn) {
      setModelProvider(serverPrefs.provider);
      setModel(serverPrefs.model);
      setTemperature(String(serverPrefs.temperature));
      setMaxTokens(String(serverPrefs.maxTokens));
      setUserName(serverPrefs.userName || "Avery Morgan");
      setAboutText(serverPrefs.aboutText);
      setWorkspaceName(serverPrefs.workspaceName || "");
      setAgentPersonality(serverPrefs.agentPersonality || "");
    }
  }, [serverPrefs, isSignedIn]);

  const [opencodeKey, setOpencodeKey] = useState(() => localStorage.getItem("imsnappy:opencode_key") ?? "");
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>(
    () => Object.fromEntries(PROVIDER_KEYS.filter((p) => p.id !== "opencode-zen").map((p) => [p.id, readProviderKey(p.id)])),
  );
  const [userName, setUserName] = useState(PERSISTED.userName || "Avery Morgan");
  const [aboutText, setAboutText] = useState(PERSISTED.aboutText);
  const [workspaceName, setWorkspaceName] = useState(PERSISTED.workspaceName || "");
  const [agentPersonality, setAgentPersonality] = useState(PERSISTED.agentPersonality || "");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [compactLayout, setCompactLayout] = useState(false);

  const applyPreferences = (patch: Partial<ReturnType<typeof readPreferences>>) => {
    savePreferences(patch);
    if (!isSignedIn) {
      toast.message("Preferences saved.", { description: "Stored on this device. The agent will use them in the local preview." });
      return;
    }
    updateSettings.mutate({
      provider: patch.provider ?? modelProvider,
      model: patch.model ?? model,
      temperature: patch.temperature ?? PERSISTED.temperature,
      maxTokens: patch.maxTokens ?? PERSISTED.maxTokens,
      aboutText: patch.aboutText ?? aboutText,
      workspaceName: patch.workspaceName ?? workspaceName,
      agentPersonality: patch.agentPersonality ?? agentPersonality,
      userName: patch.userName ?? userName,
      streaming: patch.streaming ?? PERSISTED.streaming,
    });
  };

  const handleSaveApiKey = () => {
    if (opencodeKey.trim().length < 12) {
      toast.error("That key looks too short.", { description: "Paste the full OpenCode Zen key so the agent can reach the model." });
      return;
    }
    localStorage.setItem("imsnappy:opencode_key", opencodeKey.trim());
    applyPreferences({ provider: "opencode-zen", model: model || "hy3-free" });
  };

  const handleClearApiKey = () => {
    localStorage.removeItem("imsnappy:opencode_key");
    setOpencodeKey("");
    toast.message("Provider key cleared.", { description: "The agent will fall back to the local preview loop." });
  };

  const handleSaveProfile = () => {
    applyPreferences({
      userName: userName.trim(),
      aboutText: aboutText.trim(),
      workspaceName: workspaceName.trim(),
      agentPersonality: agentPersonality.trim(),
    });
  };

  const handleSaveModel = () => {
    const numericTemperature = Number.parseFloat(temperature);
    const numericTokens = Number.parseInt(maxTokens, 10);
    applyPreferences({
      provider: modelProvider as ReturnType<typeof readPreferences>["provider"],
      model: model || "hy3-free",
      temperature: Number.isFinite(numericTemperature) ? numericTemperature : 0.6,
      maxTokens: Number.isFinite(numericTokens) && numericTokens > 0 ? numericTokens : 1024,
    });
  };

  return (
    <DiscoverLayout page="settings">
      <div className="max-w-2xl">
        {/* Model */}
        <section className="settings-section">
          <span className="settings-section-label flex items-center gap-2">
            <Bot size={12} /> Model &amp; Provider
          </span>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="model-provider">
              Model provider
            </label>
            <select
              id="model-provider"
              className="settings-select"
              value={modelProvider}
              onChange={(e) => setModelProvider(e.target.value)}
            >
              <option value="opencode-zen">OpenCode Zen (free models)</option>
              <option value="openai">OpenAI (GPT-4o)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="google">Google (Gemini)</option>
              <option value="openrouter">OpenRouter (multi-model)</option>
              <option value="local">Local (Ollama)</option>
            </select>
            <span className="settings-field-hint">
              OpenCode Zen’s free models work in this preview immediately. Add your key below for other providers.
            </span>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="model-id">
              Model
            </label>
            <select
              id="model-id"
              className="settings-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {FREE_MODELS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
            <span className="settings-field-hint">Model used for the local preview agent responses.</span>
          </div>

          <div className="settings-field">
            <button type="button" className="api-key-save flex items-center gap-2" onClick={handleSaveModel}>
              <Save size={13} />
              Save model settings
            </button>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="temperature">
              Temperature
            </label>
            <input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              className="settings-input"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
            <span className="settings-field-hint">Controls randomness. Lower is more deterministic.</span>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="max-tokens">
              Max output tokens
            </label>
            <input
              id="max-tokens"
              type="number"
              className="settings-input"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
            />
            <span className="settings-field-hint">Maximum length for a single agent response.</span>
          </div>
        </section>

        {/* Live preview hint */}
        <section className="settings-section">
          <span className="settings-section-label flex items-center gap-2">
            <KeyRound size={12} /> Preview model access
          </span>
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="opencode-key">
              OpenCode Zen key (local preview)
            </label>
            <div className="api-key-row">
              <input
                id="opencode-key"
                type="password"
                placeholder="sk-…"
                className="settings-input"
                value={opencodeKey}
                onChange={(e) => setOpencodeKey(e.target.value)}
              />
              <button type="button" className="api-key-save" onClick={handleSaveApiKey}>
                Save
              </button>
              {localStorage.getItem("imsnappy:opencode_key") && (
                <button type="button" className="api-key-clear" onClick={handleClearApiKey}>
                  Clear
                </button>
              )}
            </div>
            <span className="settings-field-hint">
              Stored only on this device so you can test the real model here. Rotate it after testing.
            </span>
          </div>
        </section>

        {/* API Keys — per-provider management */}
        <section className="settings-section">
          <span className="settings-section-label flex items-center gap-2">
            <KeyRound size={12} /> API Keys
          </span>

          {PROVIDER_KEYS.filter((p) => p.id !== "opencode-zen").map((provider) => (
            <div key={provider.id} className="settings-field">
              <label className="settings-field-label" htmlFor={`provider-key-${provider.id}`}>
                {provider.name}
              </label>
              <div className="api-key-row">
                <input
                  id={`provider-key-${provider.id}`}
                  type="password"
                  placeholder={provider.placeholder}
                  className="settings-input"
                  value={providerKeys[provider.id] ?? ""}
                  onChange={(e) => setProviderKeys((current) => ({ ...current, [provider.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="api-key-save"
                  onClick={() => {
                    const value = providerKeys[provider.id] ?? "";
                    writeProviderKey(provider.id, value);
                    setProviderKeys((current) => ({ ...current, [provider.id]: readProviderKey(provider.id) }));
                    toast.message(`${provider.name} key ${value.trim() ? "saved" : "cleared"}.`, {
                      description: provider.description,
                    });
                  }}
                >
                  {readProviderKey(provider.id) ? "Update" : "Save"}
                </button>
                {readProviderKey(provider.id) && (
                  <button
                    type="button"
                    className="api-key-clear"
                    onClick={() => {
                      writeProviderKey(provider.id, "");
                      setProviderKeys((current) => ({ ...current, [provider.id]: "" }));
                      toast.message(`${provider.name} key removed.`);
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <span className="settings-field-hint">{provider.description}</span>
            </div>
          ))}
        </section>

        {/* Profile & About */}
        <section className="settings-section">
          <span className="settings-section-label flex items-center gap-2">
            <User size={12} /> Profile &amp; About
          </span>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="user-name">
              Name
            </label>
            <input
              id="user-name"
              type="text"
              className="settings-input"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="about-text">
              About yourself
            </label>
            <textarea
              id="about-text"
              className="settings-textarea"
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              placeholder="Tell the agent about yourself, your work style, and what matters to you…"
            />
            <span className="settings-field-hint">
              The agent reads this when forming responses. Be as specific or as brief as you like.
            </span>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="workspace-name">
              Workspace name
            </label>
            <input
              id="workspace-name"
              type="text"
              className="settings-input"
              placeholder="e.g. Studio Folio, Research Desk"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
            <span className="settings-field-hint">A short name for this working room, shown in the sidebar.</span>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="agent-personality">
              Agent personality
            </label>
            <textarea
              id="agent-personality"
              className="settings-textarea"
              placeholder="How should I'm Snappy behave? Tone, rigor, verbosity, whether it proactively suggests next steps…"
              value={agentPersonality}
              onChange={(e) => setAgentPersonality(e.target.value)}
            />
            <span className="settings-field-hint">Shapes the agent's voice and working style across every conversation.</span>
          </div>

          <div className="settings-field">
            <button type="button" className="api-key-save flex items-center gap-2 mt-2" onClick={handleSaveProfile}>
              <Save size={13} />
              Save profile
            </button>
            <span className="settings-field-hint mt-2">Saved on this device; the agent reads it when forming responses.</span>
          </div>
        </section>

        {/* Preferences */}
        <section className="settings-section">
          <span className="settings-section-label flex items-center gap-2">
            <Palette size={12} /> Preferences
          </span>

          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-name">Push notifications</span>
              <span className="settings-toggle-desc">Receive alerts when scheduled tasks complete.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationsEnabled}
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`scheduled-switch ${notificationsEnabled ? "scheduled-switch-on" : ""}`}
            >
              <span className="scheduled-switch-thumb" />
            </button>
          </div>

          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-name">Sound effects</span>
              <span className="settings-toggle-desc">Play subtle sounds for agent actions and completions.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={soundEnabled}
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`scheduled-switch ${soundEnabled ? "scheduled-switch-on" : ""}`}
            >
              <span className="scheduled-switch-thumb" />
            </button>
          </div>

          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-name">Auto-save drafts</span>
              <span className="settings-toggle-desc">Automatically persist Canvas edits and conversation drafts.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoSave}
              onClick={() => setAutoSave(!autoSave)}
              className={`scheduled-switch ${autoSave ? "scheduled-switch-on" : ""}`}
            >
              <span className="scheduled-switch-thumb" />
            </button>
          </div>

          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-name">Dark mode</span>
              <span className="settings-toggle-desc">Switch the workspace to a dark ink-on-charcoal palette.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={darkMode}
              onClick={() => { setDarkMode(!darkMode); toast.message("Dark mode is planned for a future release."); }}
              className={`scheduled-switch ${darkMode ? "scheduled-switch-on" : ""}`}
            >
              <span className="scheduled-switch-thumb" />
            </button>
          </div>

          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-name">Compact layout</span>
              <span className="settings-toggle-desc">Reduce spacing for a denser workspace experience.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={compactLayout}
              onClick={() => setCompactLayout(!compactLayout)}
              className={`scheduled-switch ${compactLayout ? "scheduled-switch-on" : ""}`}
            >
              <span className="scheduled-switch-thumb" />
            </button>
          </div>
        </section>

        {/* Language & Region */}
        <section className="settings-section">
          <span className="settings-section-label flex items-center gap-2">
            <Globe2 size={12} /> Language &amp; Region
          </span>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="language">
              Interface language
            </label>
            <select id="language" className="settings-select" defaultValue="en">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
            </select>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="timezone">
              Timezone
            </label>
            <select id="timezone" className="settings-select" defaultValue="local">
              <option value="local">Local (detected)</option>
              <option value="utc">UTC</option>
              <option value="est">Eastern Time</option>
              <option value="pst">Pacific Time</option>
              <option value="gmt">GMT</option>
            </select>
          </div>
        </section>
      </div>
    </DiscoverLayout>
  );
}
