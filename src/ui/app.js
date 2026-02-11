/**
 * Dextinity - Main Application
 *
 * Wires up the UI to the agent chain, handles user interaction,
 * and manages the application state including monitoring display.
 */

import { apiClient, AIApiClient, PROVIDERS } from '../core/api.js';
import { AgentChain } from '../agents/chain.js';
import { robloxExporter } from '../export/roblox-export.js';

class DextinityApp {
  constructor() {
    this.project = null;
    this.uploadedFiles = [];
    this.chain = null;
    this._monitorInterval = null;
    this._dirHandle = null; // For direct file writing

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

    // Stop button
    document.getElementById('btn-stop')?.addEventListener('click', () => this._stopGeneration());

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

    // Creativity slider
    const creativitySlider = document.getElementById('creativity-slider');
    if (creativitySlider) {
      creativitySlider.addEventListener('input', () => this._updateCreativityLabel());
    }

    // Build provider grid
    this._buildProviderGrid();
    this._buildModelButtons();

    // Export
    document.getElementById('btn-export').addEventListener('click', () => this._export());

    // Select Output Folder
    document.getElementById('btn-select-folder').addEventListener('click', () => this._selectOutputFolder());

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
      onAgentDone: (id, result) => this._onAgentDone(id, result),
      onAgentError: (id, err) => this._onAgentError(id, err),
      onAgentSkipped: (id) => this._onAgentSkipped(id),
      onNarrate: (entry) => this._onNarrate(entry),
      onChainStart: () => this._onChainStart(),
      onChainDone: (result) => this._onChainDone(result),
      onChainError: (err) => this._onChainError(err),
      onProgress: (progress) => this._onProgress(progress),
      onMonitorUpdate: (data) => this._onMonitorUpdate(data),
    });
  }

  _loadSettings() {
    const settings = apiClient.getSettings();
    this._selectedProvider = settings.provider;
    document.getElementById('api-key').value = settings.apiKey;
    document.getElementById('api-endpoint').value = settings.endpoint || '';
    document.getElementById('api-model').value = settings.model;
    document.getElementById('max-iterations').value = settings.maxIterations;

    // Creativity slider
    const creativitySlider = document.getElementById('creativity-slider');
    if (creativitySlider) {
      creativitySlider.value = Math.round((settings.creativity || 0.5) * 100);
      this._updateCreativityLabel();
    }

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

  _updateCreativityLabel() {
    const slider = document.getElementById('creativity-slider');
    const label = document.getElementById('creativity-label');
    if (!slider || !label) return;

    const value = parseInt(slider.value);
    let levelName;
    if (value < 20) levelName = 'Minimal';
    else if (value < 40) levelName = 'Conservative';
    else if (value < 60) levelName = 'Balanced';
    else if (value < 80) levelName = 'Adventurous';
    else levelName = 'Unhinged';

    label.textContent = `${levelName} (${value}%)`;
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
    const creativitySlider = document.getElementById('creativity-slider');
    const creativity = creativitySlider ? parseInt(creativitySlider.value) / 100 : 0.5;

    apiClient.saveSettings({
      provider: this._selectedProvider || 'anthropic',
      apiKey: document.getElementById('api-key').value,
      endpoint: document.getElementById('api-endpoint').value,
      model: document.getElementById('api-model').value,
      maxIterations: parseInt(document.getElementById('max-iterations').value) || 3,
      creativity,
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

  // ==== Auto Save (Browser FS Access) ====

  async _selectOutputFolder() {
    try {
      if (!window.showDirectoryPicker) {
        alert('Your browser does not support direct folder access. Please use Chrome or Edge.');
        return;
      }
      // Explicitly request readwrite mode
      this._dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

      this._addLog('system', 'System', `Output folder selected: ${this._dirHandle.name}`);
      document.getElementById('btn-select-folder').classList.add('btn-success');
      document.getElementById('btn-select-folder').textContent = `📂 ${this._dirHandle.name}`;

      // If we already have a project, save it now
      if (this.project && this.project.files?.length > 0) {
        await this._autoSaveFiles(this.project.files);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to select folder:', err);
        this._addLog('error', 'System', `Folder selection failed: ${err.message}`);
      }
    }
  }

  async _autoSaveFiles(files) {
    if (!this._dirHandle) return;

    // Check for permissions
    const options = { mode: 'readwrite' };
    if ((await this._dirHandle.queryPermission(options)) !== 'granted') {
      const request = await this._dirHandle.requestPermission(options);
      if (request !== 'granted') {
        this._addLog('error', 'System', 'Permission denied to write files.');
        return;
      }
    }

    this._addLog('system', 'System', `Auto-saving ${files.length} files to disk...`);

    try {
      for (const file of files) {
        // file.path examples: "src/server/init.server.lua", "Workspace/Part.json"
        const pathParts = file.path.split('/');
        const fileName = pathParts.pop();

        // Navigate/create directories
        let currentHandle = this._dirHandle;
        for (const part of pathParts) {
          currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
        }

        // Write file
        const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file.luau || file.content || '');
        await writable.close();
      }
      this._addLog('system', 'System', '✅ Files auto-saved successfully.');
    } catch (err) {
      console.error('Auto-save failed:', err);
      this._addLog('error', 'System', `Auto-save failed: ${err.message}`);
    }
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
    container.innerHTML = '';

    this.uploadedFiles.forEach((f, i) => {
      const div = document.createElement('div');
      div.className = 'uploaded-file';

      const span = document.createElement('span');
      span.textContent = `${f.name} (${(f.size / 1024).toFixed(1)}KB)`;
      div.appendChild(span);

      const btn = document.createElement('button');
      btn.className = 'remove-file';
      btn.innerHTML = '&times;';
      btn.addEventListener('click', () => {
        this.uploadedFiles.splice(i, 1);
        this._renderUploadedFiles();
      });
      div.appendChild(btn);

      container.appendChild(div);
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

    // Toggle button visibility
    const genBtn = document.getElementById('btn-generate');
    const stopBtn = document.getElementById('btn-stop');
    genBtn.disabled = true;
    genBtn.textContent = 'Generating...';
    if (stopBtn) stopBtn.classList.remove('hidden');

    // Start elapsed time display
    this._startMonitorTimer();

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
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Game';
      if (stopBtn) stopBtn.classList.add('hidden');
      this._stopMonitorTimer();
    }
  }

  _stopGeneration() {
    if (this.chain && this.chain.isRunning) {
      this.chain.stop();
      this._addLog('system', 'System', 'Stopping generation...');
    }
  }

  // ==== Agent Chain Callbacks ====

  _onChainStart() {
    // Reset all agent nodes
    document.querySelectorAll('.agent-node').forEach(node => {
      node.classList.remove('active', 'done', 'error', 'skipped');
      node.querySelector('.agent-status').textContent = 'waiting';
    });
    document.querySelectorAll('.agent-connector').forEach(c => {
      c.classList.remove('active', 'done');
    });

    const badge = document.getElementById('chain-status');
    badge.textContent = 'Running';
    badge.className = 'status-badge running';

    // Reset monitoring display
    this._updateMonitorDisplay(null);
  }

  _onAgentStart(id) {
    const node = document.querySelector(`[data-agent="${id}"]`);
    if (node) {
      node.classList.remove('skipped');
      node.classList.add('active');
      node.querySelector('.agent-status').innerHTML = '<span class="spinner"></span>running';
    }
  }

  _onAgentDone(id, result) {
    const node = document.querySelector(`[data-agent="${id}"]`);
    if (node) {
      node.classList.remove('active');
      node.classList.add('done');

      // Show duration if available
      const timing = this.chain?.monitor?.agentTimings?.[id];
      const dur = timing?.durationMs;
      const durText = dur ? ` (${this._formatDuration(dur)})` : '';
      node.querySelector('.agent-status').textContent = `done${durText}`;
    }

    // Activate connector after this node
    const connectors = document.querySelectorAll('.agent-connector');
    const nodes = document.querySelectorAll('.agent-node');
    const nodeArray = Array.from(nodes);
    const idx = nodeArray.findIndex(n => n.dataset.agent === id);
    if (idx >= 0 && idx < connectors.length) {
      connectors[idx].classList.add('done');
    }

    // Live preview: if this agent produced files, render them immediately
    // This lets users watch code appear and evolve through the pipeline
    if (result?.files?.length > 0) {
      this._livePreviewUpdate(result, id);

      // Real-time auto-save if folder is selected
      if (this._dirHandle) {
        this._autoSaveFiles(result.files);
      }
    }
  }

  /**
   * Update the code preview with intermediate results as agents complete.
   * Shows the current state of generated code in real-time.
   */
  _livePreviewUpdate(result, agentId) {
    // Switch to Code tab so the user sees it happening
    this._setTab('code');

    const fileCount = result.files.length;
    const label = agentId === 'coder' ? 'Code generated'
      : agentId === 'adapter' ? 'Code validated'
        : agentId === 'improver' ? 'Code improved'
          : 'Files updated';
    this._addLog('system', 'System', `${label}: ${fileCount} files now in preview`);

    try {
      this._renderFileTree(result);
    } catch (err) {
      console.error('Live preview: file tree render failed:', err);
    }

    // Display the first file (or keep the currently selected file)
    const activeTreeItem = document.querySelector('.tree-item.active');
    if (activeTreeItem) {
      // Find and re-display the currently selected file
      const activePath = activeTreeItem.textContent.trim();
      const matchedFile = result.files.find(f => {
        const fileName = f.path.split('/').pop();
        return activePath.includes(fileName);
      });
      if (matchedFile) {
        this._displayFile(matchedFile);
        return;
      }
    }

    // Default: show first file
    if (result.files.length > 0) {
      this._displayFile(result.files[0]);
    }
  }

  _onAgentSkipped(id) {
    const node = document.querySelector(`[data-agent="${id}"]`);
    if (node) {
      node.classList.add('skipped');
      node.querySelector('.agent-status').textContent = 'skipped';
    }

    // Activate connector after skipped node
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

  _onProgress(progress) {
    // Progress display is handled by _onMonitorUpdate to avoid conflicts
  }

  _onMonitorUpdate(data) {
    this._updateMonitorDisplay(data);
  }

  _onChainDone(result) {
    const badge = document.getElementById('chain-status');
    badge.textContent = 'Done';
    badge.className = 'status-badge done';

    // Enable export
    document.getElementById('btn-export').disabled = false;

    // Show final monitoring summary
    if (result._monitor) {
      const elapsed = this._formatDuration(result._monitor.chainElapsedMs);
      const tokens = result._monitor.totalTokens;
      this._addLog('system', 'System',
        `Generation complete! ${result.files?.length || 0} files ready. ` +
        `Elapsed: ${elapsed} | Tokens: ${tokens.input + tokens.output} (${tokens.input} in, ${tokens.output} out)`
      );
    } else {
      this._addLog('system', 'System', `Generation complete! ${result.files?.length || 0} files ready. Click "Export to Roblox" to download.`);
    }

    // Auto-save if folder is selected
    if (result.files?.length > 0 && this._dirHandle) {
      this._autoSaveFiles(result.files);
    }

    // Render output
    this._renderOutput(result);
  }

  _onChainError(error) {
    const badge = document.getElementById('chain-status');
    badge.textContent = 'Error';
    badge.className = 'status-badge error';

    this._addLog('error', 'System', `Chain failed: ${error.message}`);
  }

  // ==== Monitoring Display ====

  _startMonitorTimer() {
    this._stopMonitorTimer();
    const elapsedEl = document.getElementById('monitor-elapsed');
    if (!elapsedEl) return;

    const startTime = performance.now();
    this._monitorInterval = setInterval(() => {
      const elapsed = Math.round(performance.now() - startTime);
      elapsedEl.textContent = this._formatDuration(elapsed);
    }, 500);
  }

  _stopMonitorTimer() {
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
    }
  }

  _updateMonitorDisplay(data) {
    const tokenEl = document.getElementById('monitor-tokens');
    const progressBar = document.getElementById('chain-progress');
    const progressLabel = document.getElementById('monitor-progress-label');

    if (!data) {
      if (tokenEl) tokenEl.textContent = '0';
      if (progressBar) progressBar.style.width = '0%';
      if (progressLabel) progressLabel.textContent = '0%';
      return;
    }

    if (tokenEl) {
      const total = data.totalTokens.input + data.totalTokens.output;
      tokenEl.textContent = total.toLocaleString();
    }

    const pct = data.percent || 0;
    if (progressBar) {
      progressBar.style.width = `${pct}%`;
    }
    if (progressLabel) {
      progressLabel.textContent = `${pct}%`;
    }
  }

  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  // ==== Logging ====

  _addLog(type, agentName, message) {
    const container = document.getElementById('log-entries');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${this._escapeHtml(type)}`;

    const agentSpan = document.createElement('span');
    agentSpan.className = 'log-agent-name';
    agentSpan.textContent = `[${agentName}]`;

    const msgSpan = document.createElement('span');
    msgSpan.textContent = ` ${message}`;

    entry.appendChild(agentSpan);
    entry.appendChild(msgSpan);
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

    // Ensure the Code tab is visible
    this._setTab('code');

    if (files.length === 0) {
      // No files generated - show a clear message in the code display
      const display = document.getElementById('code-display');
      if (display) {
        display.textContent = '-- No files were generated.\n-- This can happen if the AI returned an unexpected response format.\n-- Try generating again, or check the agent log for errors.';
      }
      this._addLog('error', 'System', 'No code files were produced. The AI may have returned an unexpected response. Try generating again.');
      return;
    }

    // Render each section defensively - one failure shouldn't block the others
    try {
      this._renderFileTree(project);
    } catch (err) {
      console.error('Failed to render file tree:', err);
      this._addLog('error', 'System', `File tree rendering failed: ${err.message}`);
    }

    try {
      this._renderStructureView(project);
    } catch (err) {
      console.error('Failed to render structure view:', err);
    }

    try {
      this._renderAntigravityView(project);
    } catch (err) {
      console.error('Failed to render antigravity view:', err);
    }

    // Display the first file's code
    if (files.length > 0) {
      this._displayFile(files[0]);
    }
  }

  _renderFileTree(project) {
    const files = project.files || [];
    const container = document.getElementById('file-tree');
    if (!container) return;
    container.innerHTML = '';

    const tree = robloxExporter.buildFileTree(files);
    this._renderTreeNode(container, tree, 0, files);
  }

  _renderTreeNode(container, node, depth, files) {
    if (!node || typeof node !== 'object') return;

    for (const [name, value] of Object.entries(node)) {
      if (!value) continue;

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
    if (!display) {
      console.error('code-display element not found');
      return;
    }
    if (!file) {
      display.textContent = '-- No file selected';
      return;
    }
    display.textContent = file.luau || '-- No code generated for this file';
  }

  _renderStructureView(project) {
    const container = document.getElementById('structure-view');
    if (!container) return;

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
      ${(service.children || []).map(child => `
        <div class="structure-item" style="margin-left: 16px;">
          <span class="struct-type">${this._escapeHtml(child.type || '')}</span>
          <span class="struct-name">${this._escapeHtml(child.name || '')}</span>
          <span class="struct-desc">${this._escapeHtml(child.description || '')}</span>
        </div>
      `).join('')}
    `).join('');
  }

  _renderAntigravityView(project) {
    const files = project.files || [];
    const agFiles = files.filter(f => f.antigravity);
    const display = document.getElementById('antigravity-display');
    if (!display) return;

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
