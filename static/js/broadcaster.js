document.addEventListener('DOMContentLoaded', function() {
    // App state
    const state = {
        accounts: [],
        groups: [],
        accountLists: [],
        groupLists: [],
        selectedAccounts: new Set(),
        selectedGroups: new Set(),
        currentAccountListId: 'all',
        currentGroupListId: 'all',
        images: [],
        templates: {},
        broadcasting: false,
        paused: false,
        progress: {
            total: 0,
            completed: 0,
            errors: 0
        }
    };

    // DOM Elements
    const elements = {
        // Selection elements
        accountsFilter: document.getElementById('accounts-filter'),
        groupsFilter: document.getElementById('groups-filter'),
        accountsSelection: document.getElementById('accounts-selection'),
        groupsSelection: document.getElementById('groups-selection'),
        selectedAccountsCount: document.getElementById('selected-accounts-count'),
        selectedGroupsCount: document.getElementById('selected-groups-count'),
        
        // Message composer elements
        messageInput: document.getElementById('message-input'),
        messageTemplate: document.getElementById('message-template'),
        addImageBtn: document.getElementById('add-image-btn'),
        imageUpload: document.getElementById('image-upload'),
        imagePreview: document.getElementById('image-preview'),
        
        // Time interval elements
        intervalMin: document.getElementById('interval-min'),
        intervalMax: document.getElementById('interval-max'),
        
        // Options elements
        randomizeMessages: document.getElementById('randomize-messages'),
        randomizeAccounts: document.getElementById('randomize-accounts'),
        skipErrors: document.getElementById('skip-errors'),
        
        // Broadcasting control elements
        startBroadcastBtn: document.getElementById('start-broadcast-btn'),
        pauseBroadcastBtn: document.getElementById('pause-broadcast-btn'),
        stopBroadcastBtn: document.getElementById('stop-broadcast-btn'),
        testMessageBtn: document.getElementById('test-message-btn'),
        
        // Action buttons
        selectAllAccountsBtn: document.getElementById('select-all-accounts-btn'),
        selectAllGroupsBtn: document.getElementById('select-all-groups-btn'),
        clearAccountsBtn: document.getElementById('clear-accounts-btn'),
        clearGroupsBtn: document.getElementById('clear-groups-btn'),
        
        // Placeholder buttons
        addPlaceholderBtn: document.getElementById('add-placeholder-btn'),
        saveTemplateBtn: document.getElementById('save-template-btn'),
        
        // Progress elements
        progressIndicator: document.getElementById('progress-indicator'),
        progressFill: document.getElementById('progress-fill'),
        progressStatus: document.getElementById('progress-status'),
        progressCount: document.getElementById('progress-count'),
        
        // Logs elements
        logsContainer: document.getElementById('logs-container'),
        clearLogsBtn: document.getElementById('clear-logs-btn'),
        exportLogsBtn: document.getElementById('export-logs-btn'),
        
        // Modal elements
        modalContainer: document.getElementById('modal-container'),
        
        // Navigation
        sidebarMenu: document.getElementById('sidebar-menu')
    };

    // API Service
    const api = {
        async getAccounts(listId = 'all') {
            try {
                const response = await fetch(`/api/accounts?list_id=${listId}`);
                if (!response.ok) throw new Error('Failed to fetch accounts');
                return await response.json();
            } catch (error) {
                console.error('Error fetching accounts:', error);
                showToast('Error loading accounts', 'error');
                return [];
            }
        },

        async getAccountLists() {
            try {
                const response = await fetch('/api/account-lists');
                if (!response.ok) throw new Error('Failed to fetch account lists');
                return await response.json();
            } catch (error) {
                console.error('Error fetching account lists:', error);
                showToast('Error loading account lists', 'error');
                return [];
            }
        },

        async getGroups(listId = 'all') {
            try {
                const response = await fetch(`/api/groups?list_id=${listId}`);
                if (!response.ok) throw new Error('Failed to fetch groups');
                return await response.json();
            } catch (error) {
                console.error('Error fetching groups:', error);
                showToast('Error loading groups', 'error');
                return [];
            }
        },

        async getGroupLists() {
            try {
                const response = await fetch('/api/group-lists');
                if (!response.ok) throw new Error('Failed to fetch group lists');
                return await response.json();
            } catch (error) {
                console.error('Error fetching group lists:', error);
                showToast('Error loading group lists', 'error');
                return [];
            }
        },

        async uploadImage(file) {
            try {
                console.log(`Attempting to upload image: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
                
                const formData = new FormData();
                // Try both field names to be compatible with both endpoints
                formData.append('avatar', file);  // For accounts endpoint
                formData.append('image', file);   // For broadcaster endpoint
                
                console.log('Sending POST request to /api/accounts/upload-avatar');
                const response = await fetch('/api/accounts/upload-avatar', {
                    method: 'POST',
                    body: formData
                });
                
                console.log(`Upload response status: ${response.status} ${response.statusText}`);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Upload failed with status ${response.status}: ${errorText}`);
                    throw new Error(`Failed to upload image: ${errorText || response.statusText}`);
                }
                
                const result = await response.json();
                console.log('Upload successful, result:', result);
                
                return result;
            } catch (error) {
                console.error('Error in uploadImage():', error);
                showToast(`Error uploading image: ${error.message}`, 'error');
                return null;
            }
        },

        async sendMessage(accountId, groupId, message, imageUrls = []) {
            try {
                console.log(`Sending message from account ${accountId} to group ${groupId}`);
                console.log(`Message content: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
                console.log(`Including ${imageUrls.length} images:`, imageUrls);
                
                // Show a toast indicating the message is being sent
                showToast('Sending message, please wait...', 'info');
                
                // Create a timeout to show a "taking longer than expected" message
                const longOperationTimeout = setTimeout(() => {
                    showToast('Message sending is taking longer than expected. Please be patient...', 'warning');
                    addLog('Message sending is taking longer than expected. This could be due to network issues or Telegram rate limits.', 'warning');
                }, 10000); // 10 seconds
                
                // Create a timeout for a hard failure after 2 minutes
                const failureTimeout = setTimeout(() => {
                    console.error('Message sending timed out after 2 minutes');
                    return {
                        success: false,
                        error: 'Message sending timed out after 2 minutes. The operation might still be processing in the background.'
                    };
                }, 120000); // 2 minutes
                
                const response = await fetch('/api/broadcaster/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        account_id: accountId,
                        group_id: groupId,
                        message: message,
                        image_urls: imageUrls
                    })
                });
                
                // Clear the timeouts
                clearTimeout(longOperationTimeout);
                clearTimeout(failureTimeout);
                
                console.log(`API response status: ${response.status} ${response.statusText}`);
                
                const result = await response.json();
                console.log('Send message API result:', result);
                
                if (!result.success) {
                    console.error(`Message sending failed: ${result.error}`);
                    
                    // If we got a cooldown, record it
                    if (result.cooldown_until) {
                        console.warn(`Account cooldown until: ${result.cooldown_until}`);
                    }
                }
                
                return result;
            } catch (error) {
                console.error('Error in sendMessage():', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        },

        async saveTemplate(template) {
            // This would normally save to a server, but we'll use localStorage for now
            try {
                const templates = JSON.parse(localStorage.getItem('broadcaster_templates') || '{}');
                templates[template.id] = template;
                localStorage.setItem('broadcaster_templates', JSON.stringify(templates));
                return template;
            } catch (error) {
                console.error('Error saving template:', error);
                showToast('Error saving template', 'error');
                return null;
            }
        },

        getTemplates() {
            // Get templates from localStorage
            try {
                return JSON.parse(localStorage.getItem('broadcaster_templates') || '{}');
            } catch (error) {
                console.error('Error loading templates:', error);
                return {};
            }
        }
    };

    // Broadcasting Service
    const broadcaster = {
        broadcastQueue: [],
        currentInterval: null,
        
        // Initialize the broadcasting queue
        setupBroadcast(accounts, groups, message, options) {
            this.stopBroadcast();
            this.broadcastQueue = [];
            
            // Create all possible account-group combinations
            for (const account of accounts) {
                for (const group of groups) {
                    this.broadcastQueue.push({
                        accountId: account.id,
                        account: account,
                        groupId: group.id,
                        group: group,
                        message: this.processMessageTemplate(message, account, group),
                        imageUrls: state.images.map(img => img.url),
                        status: 'pending'
                    });
                }
            }
            
            // Randomize the queue if needed
            if (options.randomize) {
                this.broadcastQueue = this.shuffleArray(this.broadcastQueue);
            }
            
            // Update progress state
            state.progress.total = this.broadcastQueue.length;
            state.progress.completed = 0;
            state.progress.errors = 0;
            
            // Return queue info
            return {
                total: this.broadcastQueue.length,
                accounts: accounts.length,
                groups: groups.length
            };
        },
        
        // Start broadcasting
        startBroadcast() {
            if (this.broadcastQueue.length === 0) return false;
            
            state.broadcasting = true;
            state.paused = false;
            this.processNextMessage();
            
            return true;
        },
        
        // Process the next message in the queue
        async processNextMessage() {
            if (!state.broadcasting || state.paused) return;
            
            // Get the next pending message
            const nextMsg = this.broadcastQueue.find(msg => msg.status === 'pending');
            
            if (!nextMsg) {
                // Broadcasting completed
                this.completeBroadcast();
                return;
            }
            
            // Update message status
            nextMsg.status = 'processing';
            updateProgress();
            
            // Log the attempt
            addLog(`Sending message from ${nextMsg.account.name} to group ${nextMsg.group.title}...`, 'info');
            
            try {
                // Send the message
                const result = await api.sendMessage(
                    nextMsg.accountId, 
                    nextMsg.groupId, 
                    nextMsg.message, 
                    nextMsg.imageUrls
                );
                
                // Check if it was successful
                if (result.success) {
                    nextMsg.status = 'completed';
                    state.progress.completed++;
                    addLog(`Message sent successfully from ${nextMsg.account.name} to ${nextMsg.group.title}`, 'success');
                } else {
                    // Sometimes the message is actually sent but we get an error from the server
                    // Check if the error type indicates this could be the case
                    if (result.error && (
                        result.error.includes('list') || 
                        result.error.includes('album') ||
                        result.error.includes('attribute')
                    )) {
                        // Log a warning but consider it a success
                        nextMsg.status = 'completed';
                        state.progress.completed++;
                        addLog(`Message likely sent despite error: ${result.error}`, 'warning');
                        addLog(`Message marked as sent from ${nextMsg.account.name} to ${nextMsg.group.title}`, 'success');
                    } else {
                        nextMsg.status = 'error';
                        nextMsg.error = result.error;
                        state.progress.errors++;
                        
                        // Check if the account was rate limited
                        if (result.cooldown_until) {
                            // Add to account
                            nextMsg.account.cooldown_until = result.cooldown_until;
                            addLog(`Account ${nextMsg.account.name} is rate limited until ${new Date(result.cooldown_until).toLocaleString()}`, 'warning');
                            
                            // Mark other pending messages from this account as skipped
                            this.broadcastQueue.forEach(msg => {
                                if (msg.status === 'pending' && msg.accountId === nextMsg.accountId) {
                                    msg.status = 'skipped';
                                    msg.error = 'Account is rate limited';
                                }
                            });
                        }
                        
                        addLog(`Error sending message from ${nextMsg.account.name} to ${nextMsg.group.title}: ${result.error}`, 'error');
                    }
                }
            } catch (error) {
                // Handle unexpected errors
                nextMsg.status = 'error';
                nextMsg.error = error.message;
                state.progress.errors++;
                addLog(`Error sending message from ${nextMsg.account.name} to ${nextMsg.group.title}: ${error.message}`, 'error');
            }
            
            // Update progress UI
            updateProgress();
            
            // Check if we should skip to the next message because of errors
            const shouldContinue = nextMsg.status !== 'error' || elements.skipErrors.checked;
            
            if (!shouldContinue) {
                addLog('Broadcasting paused due to error. Enable "Continue on errors" to automatically continue.', 'warning');
                this.pauseBroadcast();
                return;
            }
            
            // Schedule next message after random interval
            const minInterval = parseInt(elements.intervalMin.value) || 30;
            const maxInterval = parseInt(elements.intervalMax.value) || 60;
            const randomInterval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
            
            addLog(`Waiting ${randomInterval} seconds before next message...`, 'info');
            
            this.currentInterval = setTimeout(() => {
                this.processNextMessage();
            }, randomInterval * 1000);
        },
        
        // Pause broadcasting
        pauseBroadcast() {
            state.paused = true;
            if (this.currentInterval) {
                clearTimeout(this.currentInterval);
                this.currentInterval = null;
            }
            addLog('Broadcasting paused', 'warning');
            updateProgress();
            return true;
        },
        
        // Resume broadcasting
        resumeBroadcast() {
            state.paused = false;
            addLog('Broadcasting resumed', 'info');
            this.processNextMessage();
            return true;
        },
        
        // Stop broadcasting
        stopBroadcast() {
            state.broadcasting = false;
            state.paused = false;
            if (this.currentInterval) {
                clearTimeout(this.currentInterval);
                this.currentInterval = null;
            }
            if (state.progress.completed > 0) {
                addLog('Broadcasting stopped', 'warning');
            }
            return true;
        },
        
        // Complete broadcasting
        completeBroadcast() {
            state.broadcasting = false;
            addLog('Broadcasting completed!', 'success');
            addLog(`Results: ${state.progress.completed} messages sent, ${state.progress.errors} errors`, 'info');
            updateProgress();
            return true;
        },
        
        // Process message template and replace placeholders
        processMessageTemplate(message, account, group) {
            // Replace all placeholders with actual values
            let processedMessage = message;
            
            // Account placeholders
            processedMessage = processedMessage.replace(/{name}/g, account.name || '');
            processedMessage = processedMessage.replace(/{username}/g, account.username || '');
            processedMessage = processedMessage.replace(/{phone}/g, account.phone || '');
            
            // Group placeholders
            processedMessage = processedMessage.replace(/{group}/g, group.title || '');
            processedMessage = processedMessage.replace(/{group_username}/g, group.username || '');
            
            // Date and time placeholders
            const now = new Date();
            processedMessage = processedMessage.replace(/{date}/g, now.toLocaleDateString());
            processedMessage = processedMessage.replace(/{time}/g, now.toLocaleTimeString());
            
            return processedMessage;
        },
        
        // Utility function to shuffle array
        shuffleArray(array) {
            const newArray = [...array];
            for (let i = newArray.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
            }
            return newArray;
        },
        
        // Send a test message
        async sendTestMessage(accountId, groupId, message) {
            const account = state.accounts.find(acc => acc.id === accountId);
            const group = state.groups.find(grp => grp.id === groupId);
            
            if (!account || !group) {
                addLog('Test failed: Account or group not found', 'error');
                return false;
            }
            
            // Process the message template
            const processedMessage = this.processMessageTemplate(message, account, group);
            
            addLog(`Sending test message from ${account.name} to group ${group.title}...`, 'info');
            
            try {
                // Send the message
                const result = await api.sendMessage(
                    accountId, 
                    groupId, 
                    processedMessage, 
                    state.images.map(img => img.url)
                );
                
                if (result.success) {
                    addLog(`Test message sent successfully!`, 'success');
                    return true;
                } else {
                    addLog(`Error sending test message: ${result.error}`, 'error');
                    return false;
                }
            } catch (error) {
                addLog(`Error sending test message: ${error.message}`, 'error');
                return false;
            }
        }
    };

    // UI Rendering
    const renderAccountLists = () => {
        // Render account list dropdown options
        let options = '<option value="all">All Lists</option>';
        
        state.accountLists.forEach(list => {
            options += `<option value="${list.id}">${list.name}</option>`;
        });
        
        elements.accountsFilter.innerHTML = options;
    };
    
    const renderGroupLists = () => {
        // Render group list dropdown options
        let options = '<option value="all">All Lists</option>';
        
        state.groupLists.forEach(list => {
            options += `<option value="${list.id}">${list.name}</option>`;
        });
        
        elements.groupsFilter.innerHTML = options;
    };
    
    const renderAccounts = () => {
        if (state.accounts.length === 0) {
            elements.accountsSelection.innerHTML = `
                <div class="empty-selection-message">
                    No accounts available. Add accounts from the Accounts page.
                </div>
            `;
            return;
        }
        
        // Render the list of accounts
        let html = '';
        
        state.accounts.forEach(account => {
            const isSelected = state.selectedAccounts.has(account.id);
            
            html += `
                <div class="selection-item ${isSelected ? 'selected' : ''}" data-id="${account.id}" data-type="account">
                    <div class="selection-item-avatar">
                        ${account.avatar ? 
                            `<img src="${account.avatar}" alt="${account.name}">` : 
                            `<i class="fas fa-user"></i>`
                        }
                    </div>
                    <div class="selection-item-info">
                        <div class="selection-item-name">${account.name}</div>
                        <div class="selection-item-details">${account.phone}</div>
                    </div>
                </div>
            `;
        });
        
        elements.accountsSelection.innerHTML = html;
        
        // Add click event listeners
        elements.accountsSelection.querySelectorAll('.selection-item').forEach(item => {
            item.addEventListener('click', handleAccountSelection);
        });
        
        // Update selected count
        elements.selectedAccountsCount.textContent = `${state.selectedAccounts.size} selected`;
    };
    
    const renderGroups = () => {
        if (state.groups.length === 0) {
            elements.groupsSelection.innerHTML = `
                <div class="empty-selection-message">
                    No groups available. Add groups from the Group Parser page.
                </div>
            `;
            return;
        }
        
        // Render the list of groups
        let html = '';
        
        state.groups.forEach(group => {
            const isSelected = state.selectedGroups.has(group.id);
            
            html += `
                <div class="selection-item ${isSelected ? 'selected' : ''}" data-id="${group.id}" data-type="group">
                    <div class="selection-item-avatar">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="selection-item-info">
                        <div class="selection-item-name">${group.title}</div>
                        <div class="selection-item-details">@${group.username || 'unknown'} · ${formatNumber(group.members || 0)} members</div>
                    </div>
                </div>
            `;
        });
        
        elements.groupsSelection.innerHTML = html;
        
        // Add click event listeners
        elements.groupsSelection.querySelectorAll('.selection-item').forEach(item => {
            item.addEventListener('click', handleGroupSelection);
        });
        
        // Update selected count
        elements.selectedGroupsCount.textContent = `${state.selectedGroups.size} selected`;
    };
    
    const renderImagePreviews = () => {
        let html = '';
        
        state.images.forEach((image, index) => {
            html += `
                <div class="image-preview-item" data-index="${index}">
                    <img src="${image.url}" alt="Image ${index + 1}">
                    <div class="remove-image" data-index="${index}">
                        <i class="fas fa-times"></i>
                    </div>
                </div>
            `;
        });
        
        elements.imagePreview.innerHTML = html;
        
        // Add click event listeners to remove buttons
        elements.imagePreview.querySelectorAll('.remove-image').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(button.dataset.index);
                removeImage(index);
            });
        });
    };
    
    const renderTemplates = () => {
        // Load templates from storage
        state.templates = api.getTemplates();
        
        // Populate template dropdown
        let options = '<option value="">Load Template...</option>';
        
        Object.entries(state.templates).forEach(([id, template]) => {
            options += `<option value="${id}">${template.name}</option>`;
        });
        
        elements.messageTemplate.innerHTML = options;
    };
    
    const renderTestMessageModal = () => {
        const accountSelect = document.getElementById('test-account');
        const groupSelect = document.getElementById('test-group');
        
        // Populate account dropdown
        let accountOptions = '';
        state.accounts.forEach(account => {
            if (state.selectedAccounts.has(account.id)) {
                accountOptions += `<option value="${account.id}">${account.name} (${account.phone})</option>`;
            }
        });
        accountSelect.innerHTML = accountOptions || '<option value="">No accounts selected</option>';
        
        // Populate group dropdown
        let groupOptions = '';
        state.groups.forEach(group => {
            if (state.selectedGroups.has(group.id)) {
                groupOptions += `<option value="${group.id}">${group.title} (@${group.username || 'unknown'})</option>`;
            }
        });
        groupSelect.innerHTML = groupOptions || '<option value="">No groups selected</option>';
    };

    // Event Handlers
    const handleAccountListChange = async () => {
        const listId = elements.accountsFilter.value;
        state.currentAccountListId = listId;
        
        // Load accounts for this list
        await loadAccounts(listId);
    };
    
    const handleGroupListChange = async () => {
        const listId = elements.groupsFilter.value;
        state.currentGroupListId = listId;
        
        // Load groups for this list
        await loadGroups(listId);
    };
    
    const handleAccountSelection = (event) => {
        const item = event.currentTarget;
        const accountId = item.dataset.id;
        
        if (state.selectedAccounts.has(accountId)) {
            state.selectedAccounts.delete(accountId);
            item.classList.remove('selected');
        } else {
            state.selectedAccounts.add(accountId);
            item.classList.add('selected');
        }
        
        // Update selected count
        elements.selectedAccountsCount.textContent = `${state.selectedAccounts.size} selected`;
    };
    
    const handleGroupSelection = (event) => {
        const item = event.currentTarget;
        const groupId = item.dataset.id;
        
        if (state.selectedGroups.has(groupId)) {
            state.selectedGroups.delete(groupId);
            item.classList.remove('selected');
        } else {
            state.selectedGroups.add(groupId);
            item.classList.add('selected');
        }
        
        // Update selected count
        elements.selectedGroupsCount.textContent = `${state.selectedGroups.size} selected`;
    };
    
    const handleSelectAllAccounts = () => {
        const items = elements.accountsSelection.querySelectorAll('.selection-item');
        
        // Check if all are already selected
        const allSelected = state.selectedAccounts.size === state.accounts.length;
        
        if (allSelected) {
            // Deselect all
            state.selectedAccounts.clear();
            items.forEach(item => item.classList.remove('selected'));
        } else {
            // Select all
            state.accounts.forEach(account => state.selectedAccounts.add(account.id));
            items.forEach(item => item.classList.add('selected'));
        }
        
        // Update selected count
        elements.selectedAccountsCount.textContent = `${state.selectedAccounts.size} selected`;
    };
    
    const handleSelectAllGroups = () => {
        const items = elements.groupsSelection.querySelectorAll('.selection-item');
        
        // Check if all are already selected
        const allSelected = state.selectedGroups.size === state.groups.length;
        
        if (allSelected) {
            // Deselect all
            state.selectedGroups.clear();
            items.forEach(item => item.classList.remove('selected'));
        } else {
            // Select all
            state.groups.forEach(group => state.selectedGroups.add(group.id));
            items.forEach(item => item.classList.add('selected'));
        }
        
        // Update selected count
        elements.selectedGroupsCount.textContent = `${state.selectedGroups.size} selected`;
    };
    
    const handleClearAccounts = () => {
        state.selectedAccounts.clear();
        elements.accountsSelection.querySelectorAll('.selection-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Update selected count
        elements.selectedAccountsCount.textContent = `0 selected`;
    };
    
    const handleClearGroups = () => {
        state.selectedGroups.clear();
        elements.groupsSelection.querySelectorAll('.selection-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Update selected count
        elements.selectedGroupsCount.textContent = `0 selected`;
    };
    
    const handleAddImage = () => {
        // Trigger the file input
        elements.imageUpload.click();
    };
    
    const handleImageUpload = async (event) => {
        const files = event.target.files;
        
        if (!files || files.length === 0) return;
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check if it's an image
            if (!file.type.startsWith('image/')) {
                showToast('Only image files are allowed', 'error');
                errorCount++;
                continue;
            }
            
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('Image is too large (max 5MB)', 'error');
                errorCount++;
                continue;
            }
            
            try {
                // Create a preview URL
                const previewUrl = URL.createObjectURL(file);
                
                // Add to state temporarily with the preview
                state.images.push({
                    file,
                    url: previewUrl,
                    uploaded: false
                });
                
                successCount++;
            } catch (error) {
                console.error('Error creating preview:', error);
                errorCount++;
            }
        }
        
        if (successCount > 0) {
            // Render the previews
            renderImagePreviews();
            
            // Upload the images in the background
            uploadImages();
            
            showToast(`Added ${successCount} images`, 'success');
        }
        
        if (errorCount > 0) {
            showToast(`Failed to add ${errorCount} images`, 'error');
        }
        
        // Clear the input
        event.target.value = '';
    };
    
    const uploadImages = async () => {
        // Find images that need to be uploaded
        const unprocessedImages = state.images.filter(img => !img.uploaded);
        
        for (const image of unprocessedImages) {
            try {
                console.log(`Uploading image: ${image.file.name}`);
                // Upload the image
                const result = await api.uploadImage(image.file);
                
                if (result && result.url) {
                    console.log(`Image upload successful, received URL: ${result.url}`);
                    // Update the image URL with the uploaded one
                    image.url = result.url;
                    image.uploaded = true;
                } else {
                    console.error('Image upload failed - no URL returned');
                }
            } catch (error) {
                console.error('Error in uploadImages():', error);
                // Keep the local preview URL for now
            }
        }
        
        // Re-render the previews
        renderImagePreviews();
    };
    
    const removeImage = (index) => {
        // Remove the image from state
        state.images.splice(index, 1);
        
        // Re-render the previews
        renderImagePreviews();
    };
    
    const handleAddPlaceholder = () => {
        // Show the placeholder modal
        showModal('add-placeholder-modal');
        
        // Handle change in placeholder type
        const placeholderType = document.getElementById('placeholder-type');
        const customContainer = document.getElementById('custom-placeholder-container');
        
        // Reset selection and hide custom container
        placeholderType.value = '{name}';
        customContainer.style.display = 'none';
        
        // Add change event listener
        placeholderType.onchange = () => {
            if (placeholderType.value === '{custom}') {
                customContainer.style.display = 'block';
                // Focus the custom input
                setTimeout(() => {
                    document.getElementById('custom-placeholder').focus();
                }, 50);
            } else {
                customContainer.style.display = 'none';
            }
        };
        
        // Set up the insert button
        const insertBtn = document.getElementById('insert-placeholder-btn');
        
        // Remove existing event listeners
        const newInsertBtn = insertBtn.cloneNode(true);
        insertBtn.parentNode.replaceChild(newInsertBtn, insertBtn);
        
        // Setup custom placeholder input
        const customInput = document.getElementById('custom-placeholder');
        customInput.value = '';
        customInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                newInsertBtn.click();
            }
        };
        
        newInsertBtn.addEventListener('click', () => {
            let placeholder = placeholderType.value;
            
            // Get custom placeholder if selected
            if (placeholder === '{custom}') {
                const customPlaceholder = customInput.value.trim();
                
                if (!customPlaceholder) {
                    showToast('Please enter a custom placeholder', 'error');
                    return;
                }
                
                placeholder = `{${customPlaceholder}}`;
            }
            
            // Insert at cursor position
            insertTextAtCursor(elements.messageInput, placeholder);
            
            // Close the modal
            hideModal('add-placeholder-modal');
            
            // Focus back on the message input
            setTimeout(() => {
                elements.messageInput.focus();
            }, 50);
            
            // Show toast
            showToast(`Placeholder ${placeholder} inserted`, 'success');
        });
    };
    
    const handleSaveTemplate = () => {
        // Get the message text
        const message = elements.messageInput.value.trim();
        
        if (!message) {
            showToast('Please enter a message to save as template', 'error');
            return;
        }
        
        // Show the save template modal
        showModal('save-template-modal');
        
        // Set up the save button
        const saveBtn = document.getElementById('confirm-save-template-btn');
        
        // Remove existing event listeners
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        newSaveBtn.addEventListener('click', async () => {
            const name = document.getElementById('template-name').value.trim();
            const description = document.getElementById('template-description').value.trim();
            
            if (!name) {
                showToast('Please enter a template name', 'error');
                return;
            }
            
            // Create template object
            const template = {
                id: `template_${Date.now()}`,
                name,
                description,
                message,
                images: state.images.map(img => ({
                    url: img.url,
                    uploaded: img.uploaded
                })),
                createdAt: new Date().toISOString()
            };
            
            // Save the template
            const savedTemplate = await api.saveTemplate(template);
            
            if (savedTemplate) {
                // Update templates
                renderTemplates();
                
                // Show success message
                showToast('Template saved successfully', 'success');
                
                // Close the modal
                hideModal('save-template-modal');
            }
        });
    };
    
    const handleLoadTemplate = () => {
        const templateId = elements.messageTemplate.value;
        
        if (!templateId) return;
        
        const template = state.templates[templateId];
        
        if (template) {
            // Ask for confirmation if there's already text in the message input
            if (elements.messageInput.value.trim() && !confirm('This will replace your current message. Are you sure?')) {
                // Reset the dropdown
                elements.messageTemplate.value = '';
                return;
            }
            
            // Set the message text
            elements.messageInput.value = template.message;
            
            state.images = [];

            // Load images if the template has any
            if (template.images && template.images.length > 0) {
               template.images.forEach(img => {
                state.images.push({
                    url: img.url,
                    uploaded: img.uploaded || True, // Asume uploaded if not specified
                    file: null // We don`t store the file object
                });
               });

            renderImagePreviews();
            
            // Show success message
            showToast('Template loaded with ${template.images.length} images', 'success');
            } else {
                // No images, just render empty previews
                renderImagePreviews();
                showToast('Template loaded without images', 'success');
            }
        }
        
        // Reset the dropdown
        elements.messageTemplate.value = '';
    };
    
    const handleStartBroadcast = () => {
        // Validate inputs
        if (!validateBroadcastInputs()) return;
        
        // Get the selected accounts and groups
        const selectedAccounts = state.accounts.filter(acc => state.selectedAccounts.has(acc.id));
        const selectedGroups = state.groups.filter(grp => state.selectedGroups.has(grp.id));
        
        // Get the message text
        const message = elements.messageInput.value.trim();
        
        // Get options
        const options = {
            randomize: elements.randomizeMessages.checked,
            randomizeAccounts: elements.randomizeAccounts.checked,
            skipErrors: elements.skipErrors.checked,
            intervalMin: parseInt(elements.intervalMin.value) || 30,
            intervalMax: parseInt(elements.intervalMax.value) || 60
        };
        
        // Setup the broadcasting queue
        const queueInfo = broadcaster.setupBroadcast(
            selectedAccounts,
            selectedGroups,
            message,
            options
        );
        
        // Show confirmation dialog
        showModal('confirmation-modal');
        
        // Update confirmation details
        document.getElementById('confirm-accounts-count').textContent = queueInfo.accounts;
        document.getElementById('confirm-groups-count').textContent = queueInfo.groups;
        document.getElementById('confirm-messages-total').textContent = queueInfo.total;
        
        // Calculate estimated time
        const avgInterval = (options.intervalMin + options.intervalMax) / 2;
        const estimatedSeconds = queueInfo.total * avgInterval;
        const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
        document.getElementById('confirm-estimated-time').textContent = 
            estimatedMinutes < 60 ? 
            `${estimatedMinutes} minutes` : 
            `${Math.floor(estimatedMinutes / 60)} hours ${estimatedMinutes % 60} minutes`;
        
        // Set up the confirm button
        const confirmBtn = document.getElementById('confirm-broadcast-btn');
        
        // Remove existing event listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            // Close the modal
            hideModal('confirmation-modal');
            
            // Start broadcasting
            initiateBroadcasting();
        });
    };
    
    const initiateBroadcasting = () => {
        // Start the broadcast
        broadcaster.startBroadcast();
        
        // Update UI
        elements.startBroadcastBtn.disabled = true;
        elements.pauseBroadcastBtn.disabled = false;
        elements.stopBroadcastBtn.disabled = false;
        elements.testMessageBtn.disabled = true;
        
        // Show progress indicator
        elements.progressIndicator.classList.add('active');
        
        // Log the start
        addLog('Broadcasting started', 'success');
        
        // Update progress
        updateProgress();
    };
    
    const handlePauseBroadcast = () => {
        if (state.paused) {
            // Resume
            broadcaster.resumeBroadcast();
            elements.pauseBroadcastBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        } else {
            // Pause
            broadcaster.pauseBroadcast();
            elements.pauseBroadcastBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
        }
    };
    
    const handleStopBroadcast = () => {
        // Confirm before stopping
        if (!confirm('Are you sure you want to stop broadcasting? This cannot be resumed.')) {
            return;
        }
        
        // Stop the broadcast
        broadcaster.stopBroadcast();
        
        // Reset UI
        resetBroadcastUI();
    };
    
    const handleTestMessage = () => {
        // Validate inputs
        if (!validateBroadcastInputs(true)) return;
        
        // Show the test message modal
        showModal('test-message-modal');
        
        // Render the test message modal content
        renderTestMessageModal();
        
        // Set up the send test button
        const sendTestBtn = document.getElementById('send-test-message-btn');
        
        // Remove existing event listeners
        const newSendTestBtn = sendTestBtn.cloneNode(true);
        sendTestBtn.parentNode.replaceChild(newSendTestBtn, sendTestBtn);
        
        newSendTestBtn.addEventListener('click', async () => {
            const accountId = document.getElementById('test-account').value;
            const groupId = document.getElementById('test-group').value;
            
            if (!accountId || !groupId) {
                showToast('Please select an account and a group', 'error');
                return;
            }
            
            // Get the message text
            const message = elements.messageInput.value.trim();
            
            // Disable the button
                            newSendTestBtn.disabled = true;
            newSendTestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            
            // Send the test message
            const success = await broadcaster.sendTestMessage(accountId, groupId, message);
            
            if (success) {
                // Close the modal
                hideModal('test-message-modal');
            }
            
            // Reset the button
            newSendTestBtn.disabled = false;
            newSendTestBtn.innerHTML = 'Send Test Message';
        });
    };
    
    const handleClearLogs = () => {
        // Clear logs
        elements.logsContainer.innerHTML = '';
        
        // Add initial log
        addLog('Logs cleared', 'info');
    };
    
    const handleExportLogs = () => {
        // Get all log entries
        const logs = elements.logsContainer.querySelectorAll('.log-entry');
        
        if (logs.length === 0) {
            showToast('No logs to export', 'error');
            return;
        }
        
        // Create a text file with all logs
        let logText = 'TgNinja Broadcasting Logs\n';
        logText += `Generated: ${new Date().toLocaleString()}\n\n`;
        
        logs.forEach(log => {
            const timeText = log.querySelector('.log-entry-time').textContent;
            const messageText = log.textContent.replace(timeText, '');
            logText += `${timeText} ${messageText.trim()}\n`;
        });
        
        // Create a download link
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `broadcast-logs-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show success message
        showToast('Logs exported successfully', 'success');
    };
    
    const handleSidebarNavigation = (event) => {
        const item = event.target.closest('li');
        if (!item) return;
        
        const page = item.dataset.page;
        
        if (page === 'accounts') {
            // Redirect to accounts page
            window.location.href = '/index.html';
        } else if (page === 'parser') {
            // Redirect to group parser page
            window.location.href = '/group-parser.html';
        }
        // Don't do anything if we're already on the broadcaster page
    };

    // Helper Functions
    const validateBroadcastInputs = (isTest = false) => {
        // Check if there are selected accounts
        if (state.selectedAccounts.size === 0) {
            showToast('Please select at least one account', 'error');
            return false;
        }
        
        // Check if there are selected groups
        if (state.selectedGroups.size === 0) {
            showToast('Please select at least one group', 'error');
            return false;
        }
        
        // Check if there's a message
        const message = elements.messageInput.value.trim();
        if (!message) {
            showToast('Please enter a message', 'error');
            return false;
        }
        
        // For regular broadcast (not test), check time intervals
        if (!isTest) {
            const minInterval = parseInt(elements.intervalMin.value);
            const maxInterval = parseInt(elements.intervalMax.value);
            
            if (isNaN(minInterval) || minInterval < 5) {
                showToast('Minimum interval must be at least 5 seconds', 'error');
                return false;
            }
            
            if (isNaN(maxInterval) || maxInterval < minInterval) {
                showToast('Maximum interval must be greater than or equal to minimum interval', 'error');
                return false;
            }
        }
        
        return true;
    };
    
    const resetBroadcastUI = () => {
        // Reset buttons
        elements.startBroadcastBtn.disabled = false;
        elements.pauseBroadcastBtn.disabled = true;
        elements.stopBroadcastBtn.disabled = true;
        elements.testMessageBtn.disabled = false;
        
        // Reset pause button text
        elements.pauseBroadcastBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        
        // Hide progress indicator
        elements.progressIndicator.classList.remove('active');
    };
    
    const updateProgress = () => {
        // Calculate progress percentage
        const total = state.progress.total;
        const completed = state.progress.completed;
        const errors = state.progress.errors;
        
        if (total === 0) return;
        
        const percentage = Math.round(((completed + errors) / total) * 100);
        
        // Update progress bar
        elements.progressFill.style.width = `${percentage}%`;
        
        // Update progress text
        elements.progressCount.textContent = `${completed + errors}/${total}`;
        
        // Update status text
        if (state.broadcasting) {
            if (state.paused) {
                elements.progressStatus.textContent = 'Paused';
            } else {
                elements.progressStatus.textContent = 'Broadcasting...';
            }
        } else if (completed + errors === total && total > 0) {
            elements.progressStatus.textContent = 'Completed';
        } else {
            elements.progressStatus.textContent = 'Ready';
        }
    };
    
    const addLog = (message, type = 'info') => {
        // Format current time
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        // Create log entry
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `
            <span class="log-entry-time">${timeString}</span>
            <span>${message}</span>
        `;
        
        // Add to container
        elements.logsContainer.prepend(logEntry);
        
        // Limit logs to 500 entries
        const logs = elements.logsContainer.querySelectorAll('.log-entry');
        if (logs.length > 500) {
            elements.logsContainer.removeChild(logs[logs.length - 1]);
        }
    };
    
    const insertTextAtCursor = (textarea, text) => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        
        textarea.value = value.substring(0, start) + text + value.substring(end);
        
        // Move cursor after inserted text
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
    };
    
    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    };
    
    const showModal = (modalId) => {
        elements.modalContainer.classList.add('active');
        document.getElementById(modalId).classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const hideModal = (modalId) => {
        elements.modalContainer.classList.remove('active');
        document.getElementById(modalId).classList.remove('active');
        document.body.style.overflow = '';
    };

    const showToast = (message, type = 'info') => {
        // Create toast element if it doesn't exist
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
            
            // Add toast styles
            const style = document.createElement('style');
            style.textContent = `
                #toast {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 10px 20px;
                    border-radius: 4px;
                    color: white;
                    font-weight: 500;
                    z-index: 9999;
                    transform: translateY(100px);
                    opacity: 0;
                    transition: all 0.3s ease;
                }
                #toast.visible {
                    transform: translateY(0);
                    opacity: 1;
                }
                #toast.info { background-color: var(--primary-color); }
                #toast.success { background-color: var(--success-color); }
                #toast.error { background-color: var(--danger-color); }
                #toast.warning { background-color: #f2994a; }
            `;
            document.head.appendChild(style);
        }
        
        // Set toast content and type
        toast.textContent = message;
        toast.className = type;
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('visible');
        }, 10);
        
        // Hide toast after a delay
        setTimeout(() => {
            toast.classList.remove('visible');
        }, 3000);
    };

    // Data Loading
    const loadAccountLists = async () => {
        try {
            const lists = await api.getAccountLists();
            state.accountLists = lists;
            renderAccountLists();
        } catch (error) {
            console.error('Error loading account lists:', error);
        }
    };
    
    const loadGroupLists = async () => {
        try {
            const lists = await api.getGroupLists();
            state.groupLists = lists;
            renderGroupLists();
        } catch (error) {
            console.error('Error loading group lists:', error);
        }
    };
    
    const loadAccounts = async (listId = 'all') => {
        try {
            const accounts = await api.getAccounts(listId);
            state.accounts = accounts;
            renderAccounts();
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    };
    
    const loadGroups = async (listId = 'all') => {
        try {
            const groups = await api.getGroups(listId);
            state.groups = groups;
            renderGroups();
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    };

    // Event Listeners
    const attachEventListeners = () => {
        // Selection filters
        elements.accountsFilter.addEventListener('change', handleAccountListChange);
        elements.groupsFilter.addEventListener('change', handleGroupListChange);
        
        // Selection buttons
        elements.selectAllAccountsBtn.addEventListener('click', handleSelectAllAccounts);
        elements.selectAllGroupsBtn.addEventListener('click', handleSelectAllGroups);
        elements.clearAccountsBtn.addEventListener('click', handleClearAccounts);
        elements.clearGroupsBtn.addEventListener('click', handleClearGroups);
        
        // Message composer
        elements.addImageBtn.addEventListener('click', handleAddImage);
        elements.imageUpload.addEventListener('change', handleImageUpload);
        elements.addPlaceholderBtn.addEventListener('click', handleAddPlaceholder);
        elements.saveTemplateBtn.addEventListener('click', handleSaveTemplate);
        elements.messageTemplate.addEventListener('change', handleLoadTemplate);
        
        // Broadcasting controls
        elements.startBroadcastBtn.addEventListener('click', handleStartBroadcast);
        elements.pauseBroadcastBtn.addEventListener('click', handlePauseBroadcast);
        elements.stopBroadcastBtn.addEventListener('click', handleStopBroadcast);
        elements.testMessageBtn.addEventListener('click', handleTestMessage);
        
        // Logs
        elements.clearLogsBtn.addEventListener('click', handleClearLogs);
        elements.exportLogsBtn.addEventListener('click', handleExportLogs);
        
        // Navigation
        elements.sidebarMenu.addEventListener('click', handleSidebarNavigation);
        
        // Modal close buttons
        document.querySelectorAll('[data-close-modal]').forEach(button => {
            button.addEventListener('click', () => {
                const modalId = button.dataset.closeModal;
                hideModal(modalId);
            });
        });
    };
    function showTemplateManagement() {
        // Populate the template list
        renderTemplateList();
        
        // Show the modal
        showModal('manage-templates-modal');
    }
    function renderTemplateList(searchTerm = '') {
        const container = document.getElementById('templates-list-container');
        const emptyState = document.getElementById('empty-templates');
        
        // Get all templates
        const templates = Object.values(state.templates);
        
        // Filter by search term if provided
        const filteredTemplates = searchTerm 
            ? templates.filter(t => 
                t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.description.toLowerCase().includes(searchTerm.toLowerCase()))
            : templates;
        
        if (filteredTemplates.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        // Sort templates by date (newest first)
        filteredTemplates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Generate HTML
        container.innerHTML = filteredTemplates.map(template => {
            const imageCount = template.images ? template.images.length : 0;
            const date = new Date(template.createdAt);
            const dateStr = date.toLocaleDateString();
            
            return `
                <div class="template-list-item" data-id="${template.id}">
                    <div class="template-name">${template.name}</div>
                    <div class="template-meta">
                        ${imageCount > 0 ? 
                            `<div class="template-image-count">
                                <i class="fas fa-image"></i> ${imageCount}
                            </div>` : ''}
                        <div class="template-date">${dateStr}</div>
                        <div class="template-actions">
                            <button class="btn btn-icon btn-text view-template-btn" data-id="${template.id}" title="View template">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-icon btn-text load-template-btn" data-id="${template.id}" title="Load template">
                                <i class="fas fa-file-import"></i>
                            </button>
                            <button class="btn btn-icon btn-danger delete-template-btn" data-id="${template.id}" title="Delete template">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add event listeners
        container.querySelectorAll('.view-template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const templateId = btn.dataset.id;
                viewTemplate(templateId);
            });
        });
        
        container.querySelectorAll('.load-template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const templateId = btn.dataset.id;
                loadTemplateById(templateId);
                hideModal('manage-templates-modal');
            });
        });
        
        container.querySelectorAll('.delete-template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const templateId = btn.dataset.id;
                deleteTemplate(templateId);
            });
        });
        
        // Make entire row clickable to view template
        container.querySelectorAll('.template-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const templateId = item.dataset.id;
                viewTemplate(templateId);
            });
        });
    }
    function viewTemplate(templateId) {
        const template = state.templates[templateId];
        if (!template) return;
        
        // Populate the view template modal
        document.getElementById('view-template-title').textContent = template.name;
        document.getElementById('view-template-description').textContent = template.description || 'No description provided.';
        document.getElementById('view-template-message').textContent = template.message;
        
        const imageSection = document.getElementById('view-template-images-section');
        const imageContainer = document.getElementById('view-template-images');
        const imageCount = document.getElementById('view-template-image-count');
        
        // Check if template has images
        if (template.images && template.images.length > 0) {
            imageSection.style.display = 'block';
            imageCount.textContent = template.images.length;
            
            // Generate image thumbnails
            imageContainer.innerHTML = template.images.map(img => `
                <div class="template-image-item">
                    <img src="${img.url}" alt="Template image">
                </div>
            `).join('');
        } else {
            imageSection.style.display = 'none';
            imageContainer.innerHTML = '';
            imageCount.textContent = '0';
        }
        
        // Set up load button
        const loadBtn = document.getElementById('load-viewed-template-btn');
        
        // Remove existing event listeners
        const newLoadBtn = loadBtn.cloneNode(true);
        loadBtn.parentNode.replaceChild(newLoadBtn, loadBtn);
        
        newLoadBtn.addEventListener('click', () => {
            loadTemplateById(templateId);
            hideModal('view-template-modal');
        });
        
        // Show the modal
        showModal('view-template-modal');
    }
    function loadTemplateById(templateId) {
        const template = state.templates[templateId];
        if (!template) return;
        
        // Clear existing state
        if (state.images.length > 0 || elements.messageInput.value.trim()) {
            if (!confirm('This will replace your current message and images. Are you sure?')) {
                return;
            }
        }
        
        // Set the message text
        elements.messageInput.value = template.message;
        
        // Clear existing images
        state.images = [];
        
        // Load images if the template has any
        if (template.images && template.images.length > 0) {
            // Add template images to state
            template.images.forEach(img => {
                state.images.push({
                    url: img.url,
                    uploaded: img.uploaded || true,
                    file: null // We don't store the file object
                });
            });
        }
        
        // Render the image previews
        renderImagePreviews();
        
        showToast(`Template "${template.name}" loaded`, 'success');
    }
    function deleteTemplate(templateId) {
        if (!confirm('Are you sure you want to delete this template?')) {
            return;
        }
        
        try {
            // Get templates from storage
            const templates = JSON.parse(localStorage.getItem('broadcaster_templates') || '{}');
            
            // Delete the template
            delete templates[templateId];
            
            // Save back to storage
            localStorage.setItem('broadcaster_templates', JSON.stringify(templates));
            
            // Update state
            state.templates = templates;
            
            // Re-render the list
            renderTemplateList();
            
            showToast('Template deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting template:', error);
            showToast('Error deleting template', 'error');
        }
    }
    document.getElementById('template-search-input').addEventListener('input', (e) => {
        renderTemplateList(e.target.value.trim());
    });
    
    // Add event listener for new template button
    document.getElementById('new-template-btn').addEventListener('click', () => {
        hideModal('manage-templates-modal');
        handleSaveTemplate();
    });
    function setupTemplateManagement() {
        // Create a button to manage templates instead of a dropdown
        const templateSection = document.querySelector('.message-options');
        
        // Replace the select dropdown with a button
        const templateDropdown = document.getElementById('message-template');
        if (templateDropdown) {
            const templateButton = document.createElement('button');
            templateButton.id = 'manage-templates-btn';
            templateButton.className = 'btn btn-secondary';
            templateButton.innerHTML = '<i class="fas fa-file-alt"></i> Templates';
            templateDropdown.parentNode.replaceChild(templateButton, templateDropdown);
            
            // Add event listener
            templateButton.addEventListener('click', showTemplateManagement);
        }
    }
    // Initialization
    const init = async () => {
        // Load data
        await Promise.all([
            loadAccountLists(),
            loadGroupLists()
        ]);
        
        await Promise.all([
            loadAccounts('all'),
            loadGroups('all')
        ]);
        
        // Load templates
        renderTemplates();
        setupTemplateManagement();
        
        // Add initial log
        addLog('Broadcasting system initialized and ready.', 'info');
        
        // Attach event listeners
        attachEventListeners();
    };
    function showTemplateManagement() {
    // Populate the template list
    renderTemplateList();
    
    // Show the modal
    showModal('manage-templates-modal');
}
    // Start the app
    init();
});