document.addEventListener('DOMContentLoaded', function() {
    // App state
    const state = {
        accounts: [],
        lists: [],
        currentListId: 'all',
        selectedAccounts: new Set(),
    };

    // DOM Elements
    const elements = {
        accountsTableBody: document.getElementById('accounts-table-body'),
        accountLists: document.getElementById('account-lists'),
        accountStats: document.getElementById('account-stats'),
        emptyState: document.getElementById('empty-state'),
        currentListName: document.getElementById('current-list-name'),
        searchInput: document.getElementById('search-input'),
        selectAllCheckbox: document.getElementById('select-all-checkbox'),
        selectionActions: document.getElementById('selection-actions'),
        selectedCount: document.getElementById('selected-count'),
        checkSelectedBtn: document.getElementById('check-selected-btn'),
        moveSelectedBtn: document.getElementById('move-selected-btn'),
        deleteSelectedBtn: document.getElementById('delete-selected-btn'),
        modalContainer: document.getElementById('modal-container'),
        addAccountBtn: document.getElementById('add-account-btn'),
        emptyAddBtn: document.getElementById('empty-add-btn'),
        importTdataBtn: document.getElementById('import-tdata-btn'),
        addListBtn: document.getElementById('add-list-btn'),
    };

    // API Service
    const api = {
        async getAccounts(listId = 'all') {
            try {
                // Add cache busting parameter
                const timestamp = new Date().getTime();
                const url = `/api/accounts?list_id=${listId}&_=${timestamp}`;
                
                const response = await fetch(url);
                if (!response.ok) throw new Error('Failed to fetch accounts');
                
                return await response.json();
            } catch (error) {
                console.error('Error fetching accounts:', error);
                showToast('Error loading accounts', 'error');
                return [];
            }
        },

        async getAccount(accountId) {
            try {
                const response = await fetch(`/api/accounts/${accountId}`);
                if (!response.ok) throw new Error('Failed to fetch account');
                return await response.json();
            } catch (error) {
                console.error('Error fetching account:', error);
                showToast('Error loading account details', 'error');
                return null;
            }
        },

        async createAccount(accountData) {
            try {
                const response = await fetch('/api/accounts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(accountData)
                });
                if (!response.ok) throw new Error('Failed to create account');
                return await response.json();
            } catch (error) {
                console.error('Error creating account:', error);
                showToast('Error creating account', 'error');
                return null;
            }
        },

        async updateAccount(accountId, accountData) {
            try {
                const response = await fetch(`/api/accounts/${accountId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(accountData)
                });
                if (!response.ok) throw new Error('Failed to update account');
                return await response.json();
            } catch (error) {
                console.error('Error updating account:', error);
                showToast('Error updating account', 'error');
                return null;
            }
        },

        async deleteAccount(accountId) {
            try {
                const response = await fetch(`/api/accounts/${accountId}`, {
                    method: 'DELETE'
                });
                if (!response.ok) throw new Error('Failed to delete account');
                return await response.json();
            } catch (error) {
                console.error('Error deleting account:', error);
                showToast('Error deleting account', 'error');
                return null;
            }
        },

        async bulkDeleteAccounts(accountIds) {
            try {
                const response = await fetch('/api/accounts/bulk-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ account_ids: accountIds })
                });
                if (!response.ok) throw new Error('Failed to delete accounts');
                return await response.json();
            } catch (error) {
                console.error('Error deleting accounts:', error);
                showToast('Error deleting accounts', 'error');
                return null;
            }
        },

        async checkAccounts(accountIds) {
            try {
                const response = await fetch('/api/accounts/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ account_ids: accountIds })
                });
                if (!response.ok) throw new Error('Failed to check accounts');
                return await response.json();
            } catch (error) {
                console.error('Error checking accounts:', error);
                showToast('Error checking accounts', 'error');
                return null;
            }
        },

        async moveAccounts(accountIds, targetListId) {
            try {
                const response = await fetch('/api/accounts/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        account_ids: accountIds,
                        target_list_id: targetListId 
                    })
                });
                if (!response.ok) throw new Error('Failed to move accounts');
                return await response.json();
            } catch (error) {
                console.error('Error moving accounts:', error);
                showToast('Error moving accounts', 'error');
                return null;
            }
        },

        async uploadAvatar(file) {
            try {
                const formData = new FormData();
                formData.append('avatar', file);
                
                const response = await fetch('/api/accounts/upload-avatar', {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error('Failed to upload avatar');
                return await response.json();
            } catch (error) {
                console.error('Error uploading avatar:', error);
                showToast('Error uploading avatar', 'error');
                return null;
            }
        },

        async getLists() {
            try {
                const response = await fetch('/api/account-lists');
                if (!response.ok) throw new Error('Failed to fetch lists');
                return await response.json();
            } catch (error) {
                console.error('Error fetching lists:', error);
                showToast('Error loading account lists', 'error');
                return [];
            }
        },

        async createList(listData) {
            try {
                const response = await fetch('/api/account-lists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(listData)
                });
                if (!response.ok) throw new Error('Failed to create list');
                return await response.json();
            } catch (error) {
                console.error('Error creating list:', error);
                showToast('Error creating list', 'error');
                return null;
            }
        },

        async updateList(listId, listData) {
            try {
                const response = await fetch(`/api/account-lists/${listId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(listData)
                });
                if (!response.ok) throw new Error('Failed to update list');
                return await response.json();
            } catch (error) {
                console.error('Error updating list:', error);
                showToast('Error updating list', 'error');
                return null;
            }
        },

        async deleteList(listId) {
            try {
                const response = await fetch(`/api/account-lists/${listId}`, {
                    method: 'DELETE'
                });
                if (!response.ok) throw new Error('Failed to delete list');
                return await response.json();
            } catch (error) {
                console.error('Error deleting list:', error);
                showToast('Error deleting list', 'error');
                return null;
            }
        },

        async getStats(listId = 'all') {
            try {
                const response = await fetch(`/api/stats?list_id=${listId}`);
                if (!response.ok) throw new Error('Failed to fetch stats');
                return await response.json();
            } catch (error) {
                console.error('Error fetching stats:', error);
                showToast('Error loading account statistics', 'error');
                return null;
            }
        },

        async importTData(files) {
            try {
                const formData = new FormData();
                for (const file of files) {
                    formData.append('tdata', file);
                }
                
                const response = await fetch('/api/accounts/import-tdata', {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error('Failed to import TData');
                return await response.json();
            } catch (error) {
                console.error('Error importing TData:', error);
                showToast('Error importing TData', 'error');
                return null;
            }
        }
    };

    // UI Rendering
    const renderAccounts = (accounts) => {
        if (!accounts.length) {
            elements.emptyState.style.display = 'flex';
            elements.accountsTableBody.innerHTML = '';
            return;
        }
        
        elements.emptyState.style.display = 'none';
        elements.accountsTableBody.innerHTML = accounts.map(account => {
            // Function to determine avatar display
            const getAvatarDisplay = () => {
                // Check if avatar exists and is a valid URL
                if (account.avatar) {
                    // Check for full URLs, upload paths, or base64 images
                    const isValidAvatar = 
                        account.avatar.startsWith('http') || 
                        account.avatar.startsWith('/uploads') || 
                        account.avatar.startsWith('data:image');
                    
                    if (isValidAvatar) {
                        return `<img src="${account.avatar}" alt="${account.name}">`;
                    }
                }
                
                // Fallback to UI avatars if no valid avatar
                return `<i class="fas fa-user"></i>`;
            };

            return `
            <tr data-id="${account.id}">
                <td class="checkbox-col">
                    <input type="checkbox" class="account-checkbox" data-id="${account.id}">
                </td>
                <td>
                    <div class="account-info">
                        <div class="account-avatar">
                            ${getAvatarDisplay()}
                        </div>
                        <div class="account-details">
                            <div class="account-name">${account.name}</div>
                            <div class="account-username">${account.username || ''}</div>
                        </div>
                    </div>
                </td>
                <td>${account.phone}</td>
                <td>
                    ${getStatusBadge(account.status, account.cooldown_until)}
                </td>
                <td>
                    ${account.premium ? 
                        `<div class="premium-badge"><i class="fas fa-star"></i> Premium</div>` : 
                        ''
                    }
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-icon btn-text edit-account-btn" data-id="${account.id}" title="Edit account">
                            <i class="fas fa-pencil"></i>
                        </button>
                        <button class="btn btn-icon btn-danger delete-account-btn" data-id="${account.id}" title="Delete account">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `}).join('');
        
        // Attach event listeners
        attachAccountEventListeners();
    };

    const renderLists = (lists) => {
        // First render the custom lists
        const customListsHtml = lists.map(list => `
            <li data-list-id="${list.id}" ${state.currentListId === list.id ? 'class="active"' : ''}>
                <i class="fas fa-list"></i>
                <span>${list.name}</span>
                <span class="account-count">0</span>
            </li>
        `).join('');
        
        // Insert them after the "All Accounts" item
        const allAccountsItem = `
            <li data-list-id="all" ${state.currentListId === 'all' ? 'class="active"' : ''}>
                <i class="fas fa-layer-group"></i>
                <span>All Accounts</span>
                <span class="account-count">0</span>
            </li>
        `;
        
        elements.accountLists.innerHTML = allAccountsItem + customListsHtml;
        
        // Attach event listeners
        attachListEventListeners();
        
        // Update dropdowns in modals
        updateListDropdowns(lists);
    };

    const renderStats = (stats) => {
        if (!stats) return;
        
        elements.accountStats.innerHTML = `
            <div class="stat-item all">
                <i class="fas fa-users"></i>
                <span>${stats.all} Accounts</span>
            </div>
            <div class="stat-item ok">
                <i class="fas fa-check-circle"></i>
                <span>${stats.ok} Active</span>
            </div>
            <div class="stat-item blocked">
                <i class="fas fa-ban"></i>
                <span>${stats.blocked} Blocked</span>
            </div>
            <div class="stat-item temp-block">
                <i class="fas fa-clock"></i>
                <span>${stats.temp_block} Temp. Blocked</span>
            </div>
            <div class="stat-item premium">
                <i class="fas fa-star"></i>
                <span>${stats.premium} Premium</span>
            </div>
        `;
        
        // Update count badges in the sidebar
        updateAccountCounts(stats.all);
    };

    const debugAccountLoading = async () => {
        console.log("Debug: Starting account loading diagnostics");
        try {
            // Test direct fetch to API
            console.log("Debug: Testing API endpoint directly");
            const timestamp = new Date().getTime();
            const response = await fetch(`/api/accounts?list_id=all&_=${timestamp}`);
            
            if (!response.ok) {
                console.error(`Debug: API request failed with status ${response.status}`);
                const responseText = await response.text();
                console.error(`Debug: Response: ${responseText}`);
            } else {
                const data = await response.json();
                console.log(`Debug: API returned ${data.length} accounts`);
                console.log("Debug: Account data sample:", data.slice(0, 2));
                
                if (data.length === 0) {
                    console.log("Debug: No accounts found - checking accounts file");
                    // Try to fetch accounts.json to see if data exists
                    try {
                        const fileResponse = await fetch('/data/accounts.json');
                        if (fileResponse.ok) {
                            const fileData = await fileResponse.json();
                            console.log(`Debug: accounts.json contains ${fileData.length} accounts`);
                        } else {
                            console.log(`Debug: Could not access accounts.json, status: ${fileResponse.status}`);
                        }
                    } catch (fileError) {
                        console.error("Debug: Error checking accounts file:", fileError);
                    }
                }
            }
        } catch (error) {
            console.error("Debug: Error in diagnostics:", error);
        }
        
        console.log("Debug: End of diagnostics");
    };
    const updateAccountCounts = async () => {
        try {
            // Add cache busting to ensure fresh data
            const timestamp = new Date().getTime();
            const allAccounts = await api.getAccounts('all', timestamp);
            
            // Update the "All Accounts" count
            const allAccountsCount = document.querySelector('li[data-list-id="all"] .account-count');
            if (allAccountsCount) {
                allAccountsCount.textContent = allAccounts.length;
            }
            
            // For each list, count accounts belonging to it
            state.lists.forEach(list => {
                // Count accounts that have this list ID in their list_ids array
                // Also check list_id for backward compatibility
                const listCount = allAccounts.filter(acc => 
                    (acc.list_ids && acc.list_ids.includes(list.id)) || 
                    acc.list_id === list.id
                ).length;
                
                const listCountElement = document.querySelector(`li[data-list-id="${list.id}"] .account-count`);
                if (listCountElement) {
                    listCountElement.textContent = listCount;
                }
            });
        } catch (error) {
            console.error('Error updating account counts:', error);
        }
    };

    const updateListDropdowns = (lists) => {
        // Update list dropdown in add account modal
        const accountListDropdown = document.getElementById('account-list');
        if (accountListDropdown) {
            accountListDropdown.innerHTML = lists.map(list => 
                `<option value="${list.id}">${list.name}</option>`
            ).join('');
        }
        
        // Update list dropdown in move accounts modal
        const targetListDropdown = document.getElementById('target-list');
        if (targetListDropdown) {
            targetListDropdown.innerHTML = lists.map(list => 
                `<option value="${list.id}">${list.name}</option>`
            ).join('');
        }
    };

    const getStatusBadge = (status, cooldownUntil) => {
        let badgeClass = '';
        let icon = '';
        
        switch (status) {
            case 'Ок':
                badgeClass = 'ok';
                icon = 'check-circle';
                break;
            case 'Заблокирован':
                badgeClass = 'blocked';
                icon = 'ban';
                break;
            case 'Временный блок':
                badgeClass = 'temp-block';
                icon = 'clock';
                break;
            case 'Не авторизован':
                badgeClass = 'unverified';
                icon = 'user-clock';
                break;
            case 'Ошибка проверки':
                badgeClass = 'error';
                icon = 'exclamation-circle';
                break;
            default:
                badgeClass = 'unverified';
                icon = 'question-circle';
        }
        
        let statusText = status;
        
        // Add cooldown information if available
        if (cooldownUntil && status === 'Временный блок') {
            const cooldownDate = new Date(cooldownUntil);
            const now = new Date();
            
            if (cooldownDate > now) {
                const hoursDiff = Math.round((cooldownDate - now) / (1000 * 60 * 60));
                statusText += ` (${hoursDiff}ч)`;
            }
        }
        
        return `<div class="status-badge ${badgeClass}"><i class="fas fa-${icon}"></i> ${statusText}</div>`;
    };

    // Event Handlers
    const handleListClick = async (event) => {
        const listItem = event.target.closest('li');
        if (!listItem) return;
        
        const listId = listItem.dataset.listId;
        
        // Update UI
        document.querySelectorAll('#account-lists li').forEach(item => {
            item.classList.remove('active');
        });
        listItem.classList.add('active');
        
        // Update state
        state.currentListId = listId;
        state.selectedAccounts.clear();
        updateSelectionUI();
        
        // Update current list name
        elements.currentListName.textContent = listId === 'all' ? 
            'All Accounts' : 
            state.lists.find(l => l.id === listId)?.name || 'Accounts';
        
        // Load accounts for this list
        await loadAccounts(listId);
        
        // Load stats for this list
        await loadStats(listId);
        
        // Update all account counts
        await updateAccountCounts();
    };

    const handleSelectAccount = (event) => {
        const checkbox = event.target;
        const accountId = checkbox.dataset.id;
        
        if (checkbox.checked) {
            state.selectedAccounts.add(accountId);
        } else {
            state.selectedAccounts.delete(accountId);
        }
        
        updateSelectionUI();
    };

    const handleSelectAll = (event) => {
        const checked = event.target.checked;
        
        document.querySelectorAll('.account-checkbox').forEach(checkbox => {
            checkbox.checked = checked;
            const accountId = checkbox.dataset.id;
            
            if (checked) {
                state.selectedAccounts.add(accountId);
            } else {
                state.selectedAccounts.delete(accountId);
            }
        });
        
        updateSelectionUI();
    };

    const handleAddAccountClick = () => {
        // Reset the form
        document.getElementById('add-account-form').reset();
        document.getElementById('avatar-preview').innerHTML = '<i class="fas fa-user"></i>';
        document.getElementById('avatar-url').value = '';
        
        // Show the modal
        showModal('add-account-modal');
    };

    const handleAddListClick = () => {
        // Reset the form
        document.getElementById('add-list-form').reset();
        
        // Show the modal
        showModal('add-list-modal');
    };

    const handleSaveAccount = async () => {
        const form = document.getElementById('add-account-form');
        const nameInput = document.getElementById('name');
        const phoneInput = document.getElementById('phone');
        
        // Basic validation
        if (!nameInput.value.trim()) {
            showToast('Please enter a name', 'error');
            nameInput.focus();
            return;
        }
        
        if (!phoneInput.value.trim()) {
            showToast('Please enter a phone number', 'error');
            phoneInput.focus();
            return;
        }
        
        // Collect form data
        const accountData = {
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            username: document.getElementById('username').value.trim(),
            avatar: document.getElementById('avatar-url').value || `https://ui-avatars.com/api/?name=${encodeURIComponent(nameInput.value.trim())}&background=random`,
            list_id: document.getElementById('account-list').value,
            limits: {
                daily_invites: parseInt(document.getElementById('limit-invites').value) || 30,
                daily_messages: parseInt(document.getElementById('limit-messages').value) || 50
            }
        };
        
        // Create account
        const newAccount = await api.createAccount(accountData);
        
        if (newAccount) {
            showToast('Account created successfully', 'success');
            hideModal('add-account-modal');
            
            // Reload accounts
            await loadAccounts(state.currentListId);
            await loadStats(state.currentListId);
        }
    };

    const handleSaveList = async () => {
        const listNameInput = document.getElementById('list-name');
        
        // Basic validation
        if (!listNameInput.value.trim()) {
            showToast('Please enter a list name', 'error');
            listNameInput.focus();
            return;
        }
        
        // Create list
        const newList = await api.createList({
            name: listNameInput.value.trim()
        });
        
        if (newList) {
            showToast('List created successfully', 'success');
            hideModal('add-list-modal');
            
            // Reload lists
            await loadLists();
        }
    };

    const handleDeleteAccount = async (accountId) => {
        // Show confirmation dialog
        showModal('delete-confirmation-modal');
        
        document.getElementById('delete-confirmation-message').textContent = 
            'Are you sure you want to delete this account? This action cannot be undone.';
        
        // Set up the confirm button
        const confirmButton = document.getElementById('confirm-delete-btn');
        
        // Remove any existing event listeners
        const newConfirmButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
        
        // Add the new event listener
        newConfirmButton.addEventListener('click', async () => {
            const result = await api.deleteAccount(accountId);
            
            if (result) {
                showToast('Account deleted successfully', 'success');
                hideModal('delete-confirmation-modal');
                
                // Reload accounts
                await loadAccounts(state.currentListId);
                await loadStats(state.currentListId);
            }
        });
    };

    const handleDeleteSelected = async () => {
        if (state.selectedAccounts.size === 0) return;
        
        // Show confirmation dialog
        showModal('delete-confirmation-modal');
        
        document.getElementById('delete-confirmation-message').textContent = 
            `Are you sure you want to delete ${state.selectedAccounts.size} selected accounts? This action cannot be undone.`;
        
        // Set up the confirm button
        const confirmButton = document.getElementById('confirm-delete-btn');
        
        // Remove any existing event listeners
        const newConfirmButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
        
        // Add the new event listener
        newConfirmButton.addEventListener('click', async () => {
            const result = await api.bulkDeleteAccounts(Array.from(state.selectedAccounts));
            
            if (result) {
                showToast(`Successfully deleted ${result.deleted_count} accounts`, 'success');
                hideModal('delete-confirmation-modal');
                
                // Clear selection
                state.selectedAccounts.clear();
                updateSelectionUI();
                
                // Reload accounts
                await loadAccounts(state.currentListId);
                await loadStats(state.currentListId);
            }
        });
    };

    const handleMoveSelected = () => {
        if (state.selectedAccounts.size === 0) return;
        
        // Show the move accounts modal
        showModal('move-accounts-modal');
        
        document.getElementById('move-accounts-message').textContent = 
            `Move ${state.selectedAccounts.size} selected accounts to:`;
        
        // Set up the confirm button
        const confirmButton = document.getElementById('confirm-move-btn');
        
        // Remove any existing event listeners
        const newConfirmButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
        
        // Add the new event listener
        newConfirmButton.addEventListener('click', async () => {
            const targetListId = document.getElementById('target-list').value;
            // Default to 'move' if radio buttons aren't implemented yet
            const action = document.querySelector('input[name="move-action"]:checked')?.value || 'move';
            
            // Show loading indicator
            newConfirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Moving...';
            newConfirmButton.disabled = true;
            
            try {
                const result = await api.moveAccounts(
                    Array.from(state.selectedAccounts),
                    targetListId,
                    action
                );
                
                if (result) {
                    showToast('Accounts updated successfully', 'success');
                    hideModal('move-accounts-modal');
                    
                    // Clear selection
                    state.selectedAccounts.clear();
                    updateSelectionUI();
                    
                    // Force a complete reload of accounts data
                    if (state.currentListId === targetListId || state.currentListId === 'all') {
                        // We're already on the target list or all accounts, just reload
                        await loadAccounts(state.currentListId);
                    } else {
                        // We're on a different list, reload that list's accounts
                        await loadAccounts(state.currentListId);
                    }
                    
                    // Update stats and list counters
                    await loadStats(state.currentListId);
                    await updateAccountCounts();
                }
            } catch (error) {
                console.error('Error moving accounts:', error);
                showToast('Error moving accounts', 'error');
            } finally {
                // Reset button state
                newConfirmButton.innerHTML = 'Move Accounts';
                newConfirmButton.disabled = false;
            }
        });
    };
    function setupSidebarNavigation() {
        const sidebarMenu = document.getElementById('sidebar-menu');
        
        if (sidebarMenu) {
            sidebarMenu.addEventListener('click', (event) => {
                const item = event.target.closest('li');
                if (!item) return;
                
                const page = item.dataset.page;
                
                if (page === 'parser') {
                    // Navigate to the group parser page
                    window.location.href = '/group-parser.html';
                }
                // No need to handle the accounts page as we're already on it
            });
        }
    }
    const handleCheckSelected = async () => {
        if (state.selectedAccounts.size === 0) return;
        
        // Disable the button during the operation
        elements.checkSelectedBtn.disabled = true;
        elements.checkSelectedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
        
        const result = await api.checkAccounts(Array.from(state.selectedAccounts));
        
        if (result) {
            showToast(`Successfully checked ${result.length} accounts`, 'success');
            
            // Reload accounts to show the updated status
            await loadAccounts(state.currentListId);
            await loadStats(state.currentListId);
        }
        
        // Re-enable the button
        elements.checkSelectedBtn.disabled = false;
        elements.checkSelectedBtn.innerHTML = '<i class="fas fa-check-circle"></i> Check Selected';
    };

    const handleAvatarUpload = () => {
        const input = document.getElementById('avatar-input');
        const preview = document.getElementById('avatar-preview');
        const avatarUrlInput = document.getElementById('avatar-url');
        
        input.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                
                console.log('File to upload:', {
                    name: file.name,
                    type: file.type,
                    size: file.size
                });
                
                // Create FormData to upload
                const formData = new FormData();
                formData.append('avatar', file);
                
                try {
                    const response = await fetch('/api/accounts/upload-avatar', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    console.log('Upload response:', result);
                    
                    if (response.ok && result.url) {
                        // Update preview
                        preview.innerHTML = `<img src="${result.url}" alt="Avatar">`;
                        
                        // Store the URL
                        avatarUrlInput.value = result.url;
                    } else {
                        console.error('Upload failed:', result);
                        showToast(`Upload failed: ${result.error || 'Unknown error'}`, 'error');
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    showToast('Error uploading avatar', 'error');
                }
            }
        });
    };

    const handleImportTData = () => {
        showModal('import-tdata-modal');
        
        // Get references to elements
        const uploadArea = document.getElementById('tdata-upload-area');
        const uploadInput = document.getElementById('tdata-input');
        const submitBtn = document.getElementById('import-tdata-submit-btn');
        const uploadStatus = document.getElementById('upload-status');
        const progressBar = document.getElementById('upload-progress-bar');
        const statusText = document.getElementById('upload-status-text');
        const browseButton = document.querySelector('#tdata-upload-area label');
        const tdataTargetList = document.getElementById('tdata-target-list');
        
        // Populate the list dropdown
        tdataTargetList.innerHTML = '';
        state.lists.forEach(list => {
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = list.name;
            tdataTargetList.appendChild(option);
        });
        
        // Clear previous status
        uploadStatus.style.display = 'none';
        statusText.textContent = '';
        submitBtn.disabled = true;
        
        // Variable to store the selected file
        let selectedFile = null;
        
        // Remove all previous event listeners by cloning and replacing elements
        function setupDragAndDrop() {
            // Handle file selection via the file input
            uploadInput.onchange = function(e) {
                if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];
                    
                    if (file.name.endsWith('.zip')) {
                        selectedFile = file;
                        uploadStatus.style.display = 'block';
                        statusText.textContent = `Selected: ${file.name}`;
                        submitBtn.disabled = false;
                        
                        // Show the list selection
                        document.getElementById('tdata-list-selection').style.display = 'block';
                    } else {
                        showToast('Please select a ZIP file containing TData', 'error');
                    }
                }
            };
            
            // Setup the "Browse Files" button click
            browseButton.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                uploadInput.click();
            };
            
            // Prevent the default behavior for drag events on the upload area
            uploadArea.ondragover = function(e) {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            };
            
            uploadArea.ondragleave = function(e) {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
            };
            
            uploadArea.ondragend = function(e) {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
            };
            
            // Handle file drop
            uploadArea.ondrop = function(e) {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.remove('dragover');
                
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    
                    if (file.name.endsWith('.zip')) {
                        selectedFile = file;
                        uploadStatus.style.display = 'block';
                        statusText.textContent = `Selected: ${file.name}`;
                        submitBtn.disabled = false;
                        
                        // Show the list selection
                        document.getElementById('tdata-list-selection').style.display = 'block';
                    } else {
                        showToast('Please select a ZIP file containing TData', 'error');
                    }
                }
            };
        }
        // Setup the drag and drop functionality
        setupDragAndDrop();
        
        // Handle confirm button click
    submitBtn.onclick = async function() {
        if (!selectedFile) return;
        
        // Show progress
        progressBar.style.width = '0%';
        statusText.textContent = 'Importing...';
        submitBtn.disabled = true;
        
        // Get the selected list ID
        const targetListId = tdataTargetList.value;
        
        // Simulate progress (actual progress events would be better)
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            if (progress > 90) {
                clearInterval(interval);
            }
            progressBar.style.width = `${progress}%`;
        }, 300);
    
    // Create FormData with the zip file and target list ID
    const formData = new FormData();
    formData.append('tdata_zip', selectedFile);
    formData.append('target_list_id', targetListId);
    
    console.log("Starting import process with file:", selectedFile.name);
    console.log("Target list ID:", targetListId);
    
    try {
        // Import TData with a longer timeout
        console.log("Sending request to /api/accounts/import-tdata-zip");
        
        // Use fetch with a longer timeout by wrapping in a Promise.race
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
        
        const response = await fetch('/api/accounts/import-tdata-zip', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        console.log("Server response received:", response.status, response.statusText);
        
        if (!response.ok) {
            console.error("Server returned error status:", response.status);
            let errorText = await response.text();
            console.error("Error details:", errorText);
            throw new Error(`Server returned ${response.status}: ${errorText || response.statusText}`);
        }
        
        let result = await response.json();
        console.log("Server response parsed:", result);
        
        // Clear the interval
        clearInterval(interval);
        
        if (result && result.success) {
            console.log("Import successful!");
            progressBar.style.width = '100%';
            statusText.textContent = 'Import successful!';
            
            setTimeout(() => {
                hideModal('import-tdata-modal');
                showToast('Account imported successfully', 'success');
                
                // Reload accounts
                loadAccounts(state.currentListId);
                loadStats(state.currentListId);
            }, 1000);
        } else {
            console.error("Import failed:", result?.error || "No error message");
            progressBar.style.width = '0%';
            statusText.textContent = `Error: ${result?.error || 'Failed to import account'}`;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error("Exception during import:", error);
        clearInterval(interval);
        progressBar.style.width = '0%';
        
        // Provide more specific error messages
        if (error.name === 'AbortError') {
            statusText.textContent = 'Error: Request timed out. The server may be busy processing the TData.';
        } else {
            statusText.textContent = `Error: ${error.message || 'Failed to import account'}`;
        }
        
        submitBtn.disabled = false;
    }
};
    };

    // UI Helpers
    const updateSelectionUI = () => {
        const selectedCount = state.selectedAccounts.size;
        
        // Update selected count
        elements.selectedCount.textContent = `${selectedCount} selected`;
        
        // Show/hide selection actions
        elements.selectionActions.style.display = selectedCount > 0 ? 'flex' : 'none';
        
        // Update select all checkbox
        const totalAccounts = document.querySelectorAll('.account-checkbox').length;
        elements.selectAllCheckbox.checked = selectedCount > 0 && selectedCount === totalAccounts;
        elements.selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalAccounts;
        
        // Update action buttons
        elements.checkSelectedBtn.disabled = selectedCount === 0;
        elements.moveSelectedBtn.disabled = selectedCount === 0;
        elements.deleteSelectedBtn.disabled = selectedCount === 0;
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

    // Event Listeners Attachment
    const attachAccountEventListeners = () => {
        // Account checkboxes
        document.querySelectorAll('.account-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleSelectAccount);
        });
        
        // Edit buttons
        document.querySelectorAll('.edit-account-btn').forEach(button => {
            button.addEventListener('click', () => {
                // Not implemented in this demo
                showToast('Edit account functionality is not implemented in this demo', 'info');
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.delete-account-btn').forEach(button => {
            button.addEventListener('click', () => {
                const accountId = button.dataset.id;
                handleDeleteAccount(accountId);
            });
        });
    };

    const attachListEventListeners = () => {
        document.querySelectorAll('#account-lists li').forEach(listItem => {
            listItem.addEventListener('click', handleListClick);
        });
    };

    const attachGlobalEventListeners = () => {
        // Select all checkbox
        elements.selectAllCheckbox.addEventListener('change', handleSelectAll);
        
        // Add account button
        elements.addAccountBtn.addEventListener('click', handleAddAccountClick);
        elements.emptyAddBtn.addEventListener('click', handleAddAccountClick);
        
        // Add list button
        elements.addListBtn.addEventListener('click', handleAddListClick);
        
        // Check selected button
        elements.checkSelectedBtn.addEventListener('click', handleCheckSelected);
        
        // Move selected button
        elements.moveSelectedBtn.addEventListener('click', handleMoveSelected);
        
        // Delete selected button
        elements.deleteSelectedBtn.addEventListener('click', handleDeleteSelected);
        
        // Import TData button
        elements.importTdataBtn.addEventListener('click', handleImportTData);
        
        // Save account button
        document.getElementById('save-account-btn').addEventListener('click', handleSaveAccount);
        
        // Save list button
        document.getElementById('save-list-btn').addEventListener('click', handleSaveList);
        
        // Modal close buttons
        document.querySelectorAll('[data-close-modal]').forEach(button => {
            button.addEventListener('click', () => {
                const modalId = button.dataset.closeModal;
                hideModal(modalId);
            });
        });
        
        // Search input
        elements.searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterAccounts(searchTerm);
        });
        
        // Avatar upload
        handleAvatarUpload();
    };

    // Data Operations
    const loadAccounts = async (listId = 'all') => {
        // Add cache busting parameter to ensure we get fresh data
        const accounts = await api.getAccounts(listId);
        state.accounts = accounts;
        renderAccounts(accounts);
    };

    const loadLists = async () => {
        const lists = await api.getLists();
        state.lists = lists;
        renderLists(lists);
    };

    const loadStats = async (listId = 'all') => {
        const stats = await api.getStats(listId);
        renderStats(stats);
    };

    const filterAccounts = (searchTerm) => {
        if (!searchTerm) {
            renderAccounts(state.accounts);
            return;
        }
        
        const filteredAccounts = state.accounts.filter(account => {
            return (
                account.name.toLowerCase().includes(searchTerm) ||
                account.phone.toLowerCase().includes(searchTerm) ||
                (account.username && account.username.toLowerCase().includes(searchTerm))
            );
        });
        
        renderAccounts(filteredAccounts);
    };

    // Initialization
    const init = async () => {
        // Create SVG logo
        const logoSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        logoSVG.setAttribute("viewBox", "0 0 24 24");
        logoSVG.classList.add("logo");
        logoSVG.innerHTML = `
            <path d="M12,2 C17.5228,2 22,6.47715 22,12 C22,17.5228 17.5228,22 12,22 C6.47715,22 2,17.5228 2,12 C2,6.47715 6.47715,2 12,2 Z M12,5 C8.13401,5 5,8.13401 5,12 C5,15.866 8.13401,19 12,19 C15.866,19 19,15.866 19,12 C19,8.13401 15.866,5 12,5 Z M14.1213,8.46447 L15.5355,9.87868 L12,13.4142 L8.46447,9.87868 L9.87868,8.46447 L12,10.5858 L14.1213,8.46447 Z" fill="currentColor"/>
        `;
        const logoContainer = document.querySelector('.sidebar-header');
        logoContainer.replaceChild(logoSVG, logoContainer.querySelector('.logo'));
        
        // Create empty state illustration
        const emptySVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        emptySVG.setAttribute("viewBox", "0 0 128 128");
        emptySVG.classList.add("empty-illustration");
        emptySVG.innerHTML = `
            <rect x="10" y="10" width="108" height="108" rx="8" fill="#f1f5f9"></rect>
            <rect x="30" y="30" width="68" height="10" rx="3" fill="#e2e8f0"></rect>
            <rect x="30" y="50" width="48" height="8" rx="3" fill="#e2e8f0"></rect>
            <rect x="30" y="68" width="68" height="30" rx="3" fill="#e2e8f0"></rect>
            <circle cx="64" cy="64" r="40" fill="none" stroke="#3e8ed0" stroke-width="4" stroke-dasharray="6 6"></circle>
            <path d="M64,40 L64,64 L78,78" fill="none" stroke="#3e8ed0" stroke-width="4" stroke-linecap="round"></path>
        `;
        const emptyStateContainer = document.querySelector('.empty-state');
        emptyStateContainer.replaceChild(emptySVG, emptyStateContainer.querySelector('.empty-illustration'));
        
        // Load initial data
        await loadLists();
        await loadAccounts('all');
        await loadStats('all');
        
        // Attach event listeners
        attachGlobalEventListeners();
        setupSidebarNavigation();
    };

    // Start the app
    init();
});