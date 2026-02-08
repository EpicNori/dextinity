/**
 * Dextinity - Main Application
 *
 * Wires up the UI to the agent chain, handles user interaction,
 * and manages the application state.
 */

import { apiClient, AIApiClient, PROVIDERS } from '../core/api.js';
import { AgentChain } from '../agents/chain.js';
import { robloxExporter } from '../export/roblox-export.js';

class DextinityApp {
  constructor() {
    this.project = null;
    this.uploadedFiles = [];
    this.chain = null;

    this._initUI();
    this._initChain();
    this._loadSettings();
  }

  // ==== Initialization ====

  _initUI() {
    // Mode toggle
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this._setMode(btn.dataset.mode));
    });

    // Vibe presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('vibe-prompt').value = btn.dataset.vibe;
      });
    });

    // Generate button
    document.getElementById('btn-generate').addEventListener('click', () => this._generate());

    // Settings
    document.getElementById('btn-settings').addEventListener('click', () => this._showSettings());
    document.getElementById('btn-close-settings').addEventListener('click', () => this._hideSettings());
    document.querySelector('.modal-backdrop')?.addEventListener('click', () => this._hideSettings());
    document.getElementById('btn-save-settings').addEventListener('click', () => this._saveSettings());

    // Test connection
    document.getElementById('btn-test-connection').addEventListener('click', () => this._testConnection());

    // Toggle API key visibility
    document.getElementById('btn-toggle-key').addEventListener('click', () => {
      const input = document.getElementById('api-key');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Build provider grid
    this._buildProviderGrid();
    this._buildModelButtons();

    // Export
    document.getElementById('btn-export').addEventListener('click', () => this._export());

    // Upload
    document.getElementById('btn-upload').addEventListener('click', () => {
      document.getElementById('project-upload').click();
    });
    document.getElementById('project-upload').addEventListener('change', (e) => this._handleUpload(e));

    // Upload zone (in improve mode)
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');

    document.getElementById('browse-btn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this._handleFileInput(e));

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('drag-over');
    });
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      this._handleDroppedFiles(e.dataTransfer.files);
    });

    // Output tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._setTab(btn.dataset.tab));
    });

    // Clear log
    document.getElementById('btn-clear-log').addEventListener('click', () => {
      document.getElementById('log-entries').innerHTML = '';
    });
  }

  _initChain() {
    this.chain = new AgentChain({
      onAgentStart: (id) => this._onAgentStart(id),
      onAgentDone: (id) => this._onAgentDone(id),
      onAgentError: (id, err) => this._onAgentError(id, err),
      onNarrate: (entry) => this._onNarrate(entry),
      onChainStart: () => this._onChainStart(),
      onChainDone: (result) => this._onChainDone(result),
      onChainError: (err) => this._onChainError(err),
    });
  }

  _loadSettings() {
    const settings = apiClient.getSettings();
    this._selectedProvider = settings.provider;
    document.getElementById('api-key').value = settings.apiKey;
    document.getElementById('api-endpoint').value = settings.endpoint || '';
    document.getElementById('api-model').value = settings.model;
    document.getElementById('max-iterations').value = settings.maxIterations;

    this._updateProviderSelection(settings.provider);
    this._buildModelButtons();

    if (settings.provider === 'custom') {
      document.getElementById('custom-endpoint-group').style.display = 'block';
    }

    // Show settings on first load if no API key
    if (!settings.apiKey) {
      this._addLog('system', 'System', 'No API key configured. Click the gear icon to add one.');
    }
  }

  // ==== Provider Grid & Model UI ====

  _buildProviderGrid() {
    const grid = document.getElementById('provider-grid');
    const providers = AIApiClient.getProviders();

    grid.innerHTML = providers.map(p => `
      <div class="provider-card" data-provider="${p.id}">
        <span class="provider-dot" style="background: ${p.color}"></span>
        <span class="provider-name">${this._escapeHtml(p.name)}</span>
      </div>
    `).join('');

    grid.querySelectorAll('.provider-card').forEach(card => {
      card.addEventListener('click', () => {
        const providerId = card.dataset.provider;
        this._selectedProvider = providerId;
        this._updateProviderSelection(providerId);

        // Update model to provider default
        const provider = PROVIDERS[providerId];
        if (provider && provider.defaultModel) {
          document.getElementById('api-model').value = provider.defaultModel;
        }

        // Update API key placeholder
        if (provider) {
          document.getElementById('api-key').placeholder = provider.keyPlaceholder;
        }

        // Show/hide custom endpoint
        document.getElementById('custom-endpoint-group').style.display =
          providerId === 'custom' ? 'block' : 'none';

        // Rebuild model buttons for this provider
        this._buildModelButtons();

        // Update context window hint
        this._updateContextHint();

        // Hide previous connection result
        document.getElementById('connection-result').classList.add('hidden');
      });
    });
  }

  _updateProviderSelection(providerId) {
    document.querySelectorAll('.provider-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.provider === providerId);
    });

    const provider = PROVIDERS[providerId];
    const desc = document.getElementById('provider-desc');
    if (provider) {
      desc.textContent = provider.description;
    }
  }

  _buildModelButtons() {
    const container = document.getElementById('model-buttons');
    const providerId = this._selectedProvider || apiClient.getSettings().provider;
    const provider = PROVIDERS[providerId];

    if (!provider || !provider.models || provider.models.length === 0) {
      container.innerHTML = '';
      return;
    }

    const currentModel = document.getElementById('api-model').value;

    container.innerHTML = provider.models.map(m => {
      const isActive = m.id === currentModel;
      const dot = m.recommended ? '<span class="recommended-dot"></span>' : '';
      return `<button class="model-btn ${isActive ? 'active' : ''}" data-model="${m.id}">${this._escapeHtml(m.name)}${dot}</button>`;
    }).join('');

    container.querySelectorAll('.model-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('api-model').value = btn.dataset.model;
        container.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._updateContextHint();
      });
    });

    this._updateContextHint();
  }

  _updateContextHint() {
    const hint = document.getElementById('model-context-hint');
    const providerId = this._selectedProvider || apiClient.getSettings().provider;
    const provider = PROVIDERS[providerId];
    if (provider && provider.maxContextWindow) {
      const ctx = provider.maxContextWindow >= 1000000
        ? `${(provider.maxContextWindow / 1000000).toFixed(1)}M`
        : `${Math.round(provider.maxContextWindow / 1000)}K`;
      hint.textContent = `Context window: ~${ctx} tokens`;
    } else {
      hint.textContent = '';
    }
  }

  async _testConnection() {
    const resultEl = document.getElementById('connection-result');
    const btn = document.getElementById('btn-test-connection');

    // Temporarily save settings for the test
    this._applySettingsToClient();

    resultEl.className = 'connection-result testing';
    resultEl.textContent = 'Testing connection...';
    resultEl.classList.remove('hidden');
    btn.disabled = true;

    const result = await apiClient.testConnection();

    btn.disabled = false;

    if (result.ok) {
      resultEl.className = 'connection-result success';
      resultEl.textContent = `Connected! Model: ${result.model} | Latency: ${result.latencyMs}ms | Response: "${result.response}"`;
    } else {
      resultEl.className = 'connection-result failure';
      resultEl.textContent = `Failed: ${result.error}`;
    }
  }

  _applySettingsToClient() {
    apiClient.saveSettings({
      provider: this._selectedProvider || 'anthropic',
      apiKey: document.getElementById('api-key').value,
      endpoint: document.getElementById('api-endpoint').value,
      model: document.getElementById('api-model').value,
      maxIterations: parseInt(document.getElementById('max-iterations').value) || 3,
    });
  }

  // ==== Mode Switching ====

  _setMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

    document.querySelectorAll('.input-mode').forEach(m => m.classList.remove('active'));
    document.getElementById(`input-${mode}`).classList.add('active');
  }

  _setTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
  }

  // ==== Settings ====

  _showSettings() {
    document.getElementById('modal-settings').classList.remove('hidden');
  }

  _hideSettings() {
    document.getElementById('modal-settings').classList.add('hidden');
  }

  _saveSettings() {
    this._applySettingsToClient();
    this._hideSettings();

    const provider = PROVIDERS[this._selectedProvider];
    const name = provider?.name || 'Custom';
    this._addLog('system', 'System', `Settings saved. Provider: ${name} | Model: ${apiClient.getSettings().model}`);
  }

  // ==== File Upload ====

  _handleUpload(event) {
    const files = Array.from(event.target.files);
    this._processUploadedFiles(files);
    // Switch to improve mode
    this._setMode('upload');
  }

  _handleFileInput(event) {
    const files = Array.from(event.target.files);
    this._processUploadedFiles(files);
  }

  _handleDroppedFiles(fileList) {
    const files = Array.from(fileList);
    this._processUploadedFiles(files);
  }

  async _processUploadedFiles(files) {
    for (const file of files) {
      const content = await file.text();
      this.uploadedFiles.push({
        name: file.name,
        content,
        size: file.size,
      });
    }
    this._renderUploadedFiles();
  }

  _renderUploadedFiles() {
    const container = document.getElementById('uploaded-files');
    container.innerHTML = this.uploadedFiles.map((f, i) => `
      <div class="uploaded-file">
        <span>${f.name} (${(f.size / 1024).toFixed(1)}KB)</span>
        <button class="remove-file" data-index="${i}">&times;</button>
      </div>
    `).join('');

    container.querySelectorAll('.remove-file').forEach(btn => {
      btn.addEventListener('click', () => {
        this.uploadedFiles.splice(parseInt(btn.dataset.index), 1);
        this._renderUploadedFiles();
      });
    });
  }

  // ==== Generation ====

  async _generate() {
    const activeMode = document.querySelector('.mode-btn.active').dataset.mode;
    let prompt = '';
    let options = {};

    if (activeMode === 'vibe') {
      prompt = document.getElementById('vibe-prompt').value.trim();
    } else if (activeMode === 'detailed') {
      prompt = document.getElementById('detail-prompt').value.trim();
      options = {
        datastore: document.getElementById('opt-datastore').checked,
        monetization: document.getElementById('opt-monetization').checked,
        ui: document.getElementById('opt-ui').checked,
        anticheat: document.getElementById('opt-anticheat').checked,
        multiplayer: document.getElementById('opt-multiplayer').checked,
      };
    } else if (activeMode === 'upload') {
      prompt = document.getElementById('improve-prompt').value.trim();
    }

    if (!prompt) {
      this._addLog('error', 'System', 'Please enter a game description or improvement request.');
      return;
    }

    if (!apiClient.isConfigured()) {
      this._showSettings();
      this._addLog('error', 'System', 'Please configure your API key first.');
      return;
    }

    const input = {
      prompt,
      mode: activeMode,
      options,
      uploadedFiles: activeMode === 'upload' ? this.uploadedFiles : undefined,
    };

    // Disable generate button
    const btn = document.getElementById('btn-generate');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
      if (activeMode === 'upload' && this.uploadedFiles.length > 0) {
        this.project = await this.chain.runUploadImprove(input);
      } else {
        this.project = await this.chain.run(input);
      }
    } catch (err) {
      // Error already handled by chain callbacks
      console.error('Generation failed:', err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Game';
    }
  }

  // ==== Agent Chain Callbacks ====

  _onChainStart() {
    // Reset all agent nodes
    document.querySelectorAll('.agent-node').forEach(node => {
      node.classList.remove('active', 'done', 'error');
      node.querySelector('.agent-status').textContent = 'waiting';
    });
    document.querySelectorAll('.agent-connector').forEach(c => {
      c.classList.remove('active', 'done');
    });

    const badge = document.getElementById('chain-status');
    badge.textContent = 'Running';
    badge.className = 'status-badge running';
  }

  _onAgentStart(id) {
    const node = document.querySelector(`[data-agent="${id}"]`);
    if (node) {
      node.classList.add('active');
      node.querySelector('.agent-status').innerHTML = '<span class="spinner"></span>running';
    }
  }

  _onAgentDone(id) {
    const node = document.querySelector(`[data-agent="${id}"]`);
    if (node) {
      node.classList.remove('active');
      node.classList.add('done');
      node.querySelector('.agent-status').textContent = 'done';
    }

    // Activate connector after this node
    const connectors = document.querySelectorAll('.agent-connector');
    const nodes = document.querySelectorAll('.agent-node');
    const nodeArray = Array.from(nodes);
    const idx = nodeArray.findIndex(n => n.dataset.agent === id);
    if (idx >= 0 && idx < connectors.length) {
      connectors[idx].classList.add('done');
    }
  }

  _onAgentError(id, error) {
    const node = document.querySelector(`[data-agent="${id}"]`);
    if (node) {
      node.classList.remove('active');
      node.classList.add('error');
      node.querySelector('.agent-status').textContent = 'error';
    }
    this._addLog('error', id, `Error: ${error.message}`);
  }

  _onNarrate(entry) {
    this._addLog(entry.agent, entry.agentName, entry.message);
  }

  _onChainDone(result) {
    const badge = document.getElementById('chain-status');
    badge.textContent = 'Done';
    badge.className = 'status-badge done';

    // Enable export
    document.getElementById('btn-export').disabled = false;

    // Render output
    this._renderOutput(result);
    this._addLog('system', 'System', `Generation complete! ${result.files?.length || 0} files ready. Click "Export to Roblox" to download.`);
  }

  _onChainError(error) {
    const badge = document.getElementById('chain-status');
    badge.textContent = 'Error';
    badge.className = 'status-badge error';

    this._addLog('error', 'System', `Chain failed: ${error.message}`);
  }

  // ==== Logging ====

  _addLog(type, agentName, message) {
    const container = document.getElementById('log-entries');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `<span class="log-agent-name">[${agentName}]</span> ${this._escapeHtml(message)}`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ==== Output Rendering ====

  _renderOutput(project) {
    const files = project.files || [];

    if (files.length === 0) {
      // No files generated - show a clear message in the code display
      const display = document.getElementById('code-display');
      display.textContent = '-- No files were generated.\n-- This can happen if the AI returned an unexpected response format.\n-- Try generating again, or check the agent log for errors.';
      this._addLog('error', 'System', 'No code files were produced. The AI may have returned an unexpected response. Try generating again.');
      return;
    }

    this._renderFileTree(project);
    this._renderStructureView(project);
    this._renderAntigravityView(project);

    // Auto-select first file
    if (files.length > 0) {
      this._displayFile(files[0]);
    }
  }

  _renderFileTree(project) {
    const files = project.files || [];
    const container = document.getElementById('file-tree');
    container.innerHTML = '';

    const tree = robloxExporter.buildFileTree(files);
    this._renderTreeNode(container, tree, 0, files);
  }

  _renderTreeNode(container, node, depth, files) {
    for (const [name, value] of Object.entries(node)) {
      const div = document.createElement('div');
      div.className = `tree-item tree-indent-${Math.min(depth, 3)}`;

      if (value.type === 'folder') {
        div.classList.add('folder');
        div.innerHTML = `<span class="tree-icon">&#128193;</span> ${this._escapeHtml(name)}`;
        container.appendChild(div);
        this._renderTreeNode(container, value.children, depth + 1, files);
      } else {
        const icon = value.scriptType === 'Script' ? '&#128309;'
          : value.scriptType === 'LocalScript' ? '&#128310;'
          : '&#128311;';
        div.innerHTML = `<span class="tree-icon">${icon}</span> ${this._escapeHtml(name)}`;
        div.addEventListener('click', () => {
          const file = files.find(f => f.path === value.path);
          if (file) {
            document.querySelectorAll('.tree-item').forEach(t => t.classList.remove('active'));
            div.classList.add('active');
            this._displayFile(file);
          }
        });
        container.appendChild(div);
      }
    }
  }

  _displayFile(file) {
    const display = document.getElementById('code-display');
    display.textContent = file.luau || '-- No code generated';
  }

  _renderStructureView(project) {
    const container = document.getElementById('structure-view');
    const items = robloxExporter.buildStructureView(project);

    if (items.length === 0) {
      container.innerHTML = '<p class="placeholder-text">No structure to display.</p>';
      return;
    }

    container.innerHTML = items.map(service => `
      <div class="structure-item">
        <span class="struct-type">${this._escapeHtml(service.name)}</span>
        <span class="struct-desc">${this._escapeHtml(service.description)}</span>
      </div>
      ${service.children.map(child => `
        <div class="structure-item" style="margin-left: 16px;">
          <span class="struct-type">${this._escapeHtml(child.type)}</span>
          <span class="struct-name">${this._escapeHtml(child.name)}</span>
          <span class="struct-desc">${this._escapeHtml(child.description || '')}</span>
        </div>
      `).join('')}
    `).join('');
  }

  _renderAntigravityView(project) {
    const files = project.files || [];
    const agFiles = files.filter(f => f.antigravity);
    const display = document.getElementById('antigravity-display');

    if (agFiles.length === 0) {
      display.textContent = '# No Antigravity source available';
      return;
    }

    display.textContent = agFiles.map(f =>
      `# === ${f.path} ===\n${f.antigravity}`
    ).join('\n\n');
  }

  // ==== Export ====

  async _export() {
    if (!this.project) {
      this._addLog('error', 'System', 'No project to export. Generate a game first.');
      return;
    }

    this._addLog('system', 'System', 'Packaging project for Roblox Studio...');

    try {
      const blob = await robloxExporter.exportZip(this.project);

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.project.gameTitle || 'DextinityGame'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this._addLog('system', 'System', 'Download started! Check the README.md inside for import instructions.');
    } catch (err) {
      this._addLog('error', 'System', `Export failed: ${err.message}`);
    }
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  window.dextinity = new DextinityApp();
});
