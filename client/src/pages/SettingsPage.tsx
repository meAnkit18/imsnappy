/**
 * I'm Snappy — Settings page
 * Model provider, API keys, preferences, and profile/about text.
 * Editorial off-white canvas, warm ink type.
 */
import { useState } from "react";
import { KeyRound, Bot, User, Bell, Palette, Globe2, Save } from "lucide-react";
import { toast } from "sonner";
import DiscoverLayout from "@/components/DiscoverLayout";

export default function SettingsPage() {
  const [modelProvider, setModelProvider] = useState("openai");
  const [temperature, setTemperature] = useState("0.7");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openai: "",
    anthropic: "",
    google: "",
    openrouter: "",
  });
  const [userName, setUserName] = useState("Avery Morgan");
  const [workspaceName, setWorkspaceName] = useState("Personal workspace");
  const [aboutText, setAboutText] = useState(
    "I work on editorial and research projects. I prefer concise, well-structured outputs with a warm but professional tone. I value clarity over verbosity.",
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [compactLayout, setCompactLayout] = useState(false);

  const handleSaveApiKey = (provider: string) => {
    toast.message(`${provider} API key saved.`, {
      description: "The key is stored locally in this prototype.",
    });
  };

  const handleSaveProfile = () => {
    toast.message("Profile saved.", { description: "Your preferences and about text are updated." });
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
              <option value="openai">OpenAI (GPT-4o)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="google">Google (Gemini)</option>
              <option value="openrouter">OpenRouter (multi-model)</option>
              <option value="local">Local (Ollama)</option>
            </select>
            <span className="settings-field-hint">
              Select the primary model provider for agent responses. API keys are configured below.
            </span>
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

        {/* API Keys */}
        <section className="settings-section">
          <span className="settings-section-label flex items-center gap-2">
            <KeyRound size={12} /> API Keys
          </span>

          {Object.entries(apiKeys).map(([provider, value]) => (
            <div key={provider} className="settings-field">
              <label className="settings-field-label" htmlFor={`api-${provider}`}>
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </label>
              <div className="api-key-row">
                <input
                  id={`api-${provider}`}
                  type="password"
                  placeholder={`sk-…`}
                  className="settings-input"
                  value={value}
                  onChange={(e) => setApiKeys((prev) => ({ ...prev, [provider]: e.target.value }))}
                />
                <button type="button" className="api-key-save" onClick={() => handleSaveApiKey(provider)}>
                  Save
                </button>
              </div>
              <span className="settings-field-hint">
                Keys are stored locally in this prototype. Connect a backend to encrypt them.
              </span>
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
            <label className="settings-field-label" htmlFor="workspace-name">
              Workspace
            </label>
            <input
              id="workspace-name"
              type="text"
              className="settings-input"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
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

          <button type="button" className="api-key-save flex items-center gap-2 mt-2" onClick={handleSaveProfile}>
            <Save size={13} />
            Save profile
          </button>
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
