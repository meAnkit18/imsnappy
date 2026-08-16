/**
 * I'm Snappy — Settings page
 * Model provider, API keys, preferences, and profile/about text.
 * Editorial off-white canvas, warm ink type.
 */
import { useEffect, useState } from "react";
import { KeyRound, Bot, User, Bell, Palette, Globe2, Save } from "lucide-react";
import { toast } from "sonner";
import DiscoverLayout from "@/components/DiscoverLayout";
import { useApiSession } from "@/contexts/ApiSessionContext";

export default function SettingsPage() {
  const { api, session, saveSession, clearSession } = useApiSession();
  const [modelProvider, setModelProvider] = useState("opencode");
  const [modelId, setModelId] = useState("deepseek-v4-flash-free");
  const [temperature, setTemperature] = useState("0.7");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    opencode: "",
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountName, setAccountName] = useState("");
  const [hasSavedKey, setHasSavedKey] = useState(false);
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

  useEffect(() => {
    if (!session || !api.configured) return;
    void api.getProviderSettings().then(({ providers }) => {
      const current = providers.find((provider) => provider.provider === "opencode");
      if (current) {
        setModelId(current.modelId);
        setHasSavedKey(current.hasApiKey);
      }
    }).catch(() => undefined);
  }, [api, session]);

  const handleAccount = async (mode: "login" | "register") => {
    if (!api.configured) {
      toast.error("Add VITE_API_BASE_URL before connecting an account.");
      return;
    }
    try {
      const nextSession = mode === "register"
        ? await api.register({ name: accountName || email.split("@")[0] || "Snappy user", email, password })
        : await api.login({ email, password });
      saveSession(nextSession);
      setPassword("");
      toast.success(mode === "register" ? "Account created and connected." : "Signed in to your workspace.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account connection failed.");
    }
  };

  const handleSaveApiKey = async () => {
    if (!session) {
      toast.error("Sign in before saving a model configuration.");
      return;
    }
    try {
      const { provider } = await api.saveOpenCodeSettings({ modelId, apiKey: apiKeys.opencode || undefined });
      setApiKeys({ opencode: "" });
      setHasSavedKey(provider.hasApiKey);
      toast.success("OpenCode configuration saved securely.", { description: "The key is encrypted by the API and is never written to this browser’s persistent storage." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the OpenCode configuration.");
    }
  };

  const handleSaveProfile = () => {
    toast.message("Profile saved.", { description: "Your preferences and about text are updated." });
  };

  return (
    <DiscoverLayout page="settings">
      <div className="max-w-2xl">
        <section className="settings-section">
          <span className="settings-section-label flex items-center gap-2"><User size={12} /> Account connection</span>
          {session ? (
            <div className="settings-field">
              <span className="settings-field-hint">This browser is connected with a short-lived workspace session.</span>
              <button type="button" className="api-key-save mt-3" onClick={() => { clearSession(); toast.message("Signed out of this browser."); }}>Sign out</button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="settings-input" placeholder="Name (for a new account)" value={accountName} onChange={(event) => setAccountName(event.target.value)} />
              <input className="settings-input" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <input className="settings-input sm:col-span-2" type="password" minLength={12} placeholder="Password (12+ characters)" value={password} onChange={(event) => setPassword(event.target.value)} />
              <div className="flex gap-2 sm:col-span-2"><button type="button" className="api-key-save" onClick={() => void handleAccount("login")}>Sign in</button><button type="button" className="api-key-save" onClick={() => void handleAccount("register")}>Create account</button></div>
            </div>
          )}
        </section>
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
              <option value="opencode">OpenCode Zen</option>
            </select>
            <span className="settings-field-hint">
              The platform initially routes runs through OpenCode Zen. Additional providers can be added behind the same encrypted server-side configuration boundary.
            </span>
          </div>

          <div className="settings-field">
            <label className="settings-field-label" htmlFor="model-id">Model</label>
            <input id="model-id" className="settings-input" value={modelId} onChange={(event) => setModelId(event.target.value)} />
            <span className="settings-field-hint">Example: <code>deepseek-v4-flash-free</code>. The server validates and uses this model for new agent runs.</span>
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
                <button type="button" className="api-key-save" onClick={() => void handleSaveApiKey()}>
                  Save
                </button>
              </div>
              <span className="settings-field-hint">
                {hasSavedKey ? "A key is already encrypted in your workspace. Enter a replacement only to rotate it." : "Keys are sent directly to the API over HTTPS and encrypted before storage."}
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
