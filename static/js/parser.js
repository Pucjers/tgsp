document.addEventListener('DOMContentLoaded', function() {
    // App state
    const state = {
        keywords: [],
        foundGroups: [],
        savedGroups: [],
        lists: [],
        groupLists: [],
        isParsingActive: false,
        currentListId: 'all',
        currentGroupListId: 'all',
        selectedGroups: new Set()
    };

    // DOM Elements
    const elements = {
        // Forms and inputs
        parserForm: document.getElementById('parser-form'),
        keywordInput: document.getElementById('keyword-input'),
        addKeywordBtn: document.getElementById('add-keyword-btn'),
        keywordChips: document.getElementById('keyword-chips'),
        languageSelect: document.getElementById('language-select'),
        groupListSelect: document.getElementById('group-list-select'),
        startParsingBtn: document.getElementById('start-parsing-btn'),
        
        // Progress
        parserProgress: document.getElementById('parser-progress'),
        progressBar: document.getElementById('parser-progress-bar'),
        
        // Group lists
        foundGroupsList: document.getElementById('found-groups-list'),
        savedGroupsTableBody: document.getElementById('saved-groups-table-body'),
        emptyFoundGroups: document.getElementById('empty-found-groups'),
        emptySavedGroups: document.getElementById('empty-saved-groups'),
        
        // Group lists sidebar
        groupLists: document.getElementById('group-lists'),
        addGroupListBtn: document.getElementById('add-group-list-btn'),
        
        // Group selection and actions
        selectAllGroupsCheckbox: document.getElementById('select-all-groups-checkbox'),
        selectedGroupsCount: document.getElementById('selected-groups-count'),
        groupSelectionActions: document.getElementById('group-selection-actions'),
        moveSelectedGroupsBtn: document.getElementById('move-selected-groups-btn'),
        deleteSelectedGroupsBtn: document.getElementById('delete-selected-groups-btn'),
        
        // Actions
        saveAllBtn: document.getElementById('save-all-btn'),
        savedListFilter: document.getElementById('saved-list-filter'),
        
        // Sidebar
        sidebarMenu: document.getElementById('sidebar-menu')
    };

    // API Service
    const api = {
        async getLists() {
            try {
                const response = await fetch('/api/account-lists');
                if (!response.ok) throw new Error('Failed to fetch lists');
                return await response.json();
            } catch (error) {
                console.error('Error fetching lists:', error);
                showToast('Error loading lists', 'error');
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

        async createGroupList(listData) {
            try {
                const response = await fetch('/api/group-lists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(listData)
                });
                if (!response.ok) throw new Error('Failed to create group list');
                return await response.json();
            } catch (error) {
                console.error('Error creating group list:', error);
                showToast('Error creating group list', 'error');
                return null;
            }
        },

        async updateGroupList(listId, listData) {
            try {
                const response = await fetch(`/api/group-lists/${listId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(listData)
                });
                if (!response.ok) throw new Error('Failed to update group list');
                return await response.json();
            } catch (error) {
                console.error('Error updating group list:', error);
                showToast('Error updating group list', 'error');
                return null;
            }
        },

        async deleteGroupList(listId) {
            try {
                const response = await fetch(`/api/group-lists/${listId}`, {
                    method: 'DELETE'
                });
                if (!response.ok) throw new Error('Failed to delete group list');
                return await response.json();
            } catch (error) {
                console.error('Error deleting group list:', error);
                showToast('Error deleting group list', 'error');
                return null;
            }
        },

        async getTelegramGroups(keywords, language) {
            try {
                const response = await fetch('/api/groups/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        keywords: keywords,
                        language: language
                    })
                });
                
                if (!response.ok) throw new Error('Failed to search for groups');
                
                return await response.json();
            } catch (error) {
                console.error('Error searching for groups:', error);
                showToast('Error searching for groups', 'error');
                return [];
            }
        },

        async saveGroups(groups, listId) {
            try {
                const response = await fetch('/api/groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        groups: groups,
                        list_id: listId
                    })
                });
                
                if (!response.ok) throw new Error('Failed to save groups');
                
                const result = await response.json();
                return result.saved_groups || [];
            } catch (error) {
                console.error('Error saving groups:', error);
                showToast('Error saving groups', 'error');
                return [];
            }
        },

        async getSavedGroups(listId = 'all') {
            try {
                const response = await fetch(`/api/groups?list_id=${listId}`);
                
                if (!response.ok) throw new Error('Failed to fetch saved groups');
                
                return await response.json();
            } catch (error) {
                console.error('Error fetching saved groups:', error);
                showToast('Error loading saved groups', 'error');
                return [];
            }
        },

        async deleteGroup(groupId) {
            try {
                const response = await fetch(`/api/groups/${groupId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) throw new Error('Failed to delete group');
                
                return await response.json();
            } catch (error) {
                console.error('Error deleting group:', error);
                showToast('Error deleting group', 'error');
                return null;
            }
        },

        async moveGroups(groupIds, targetListId) {
            try {
                const response = await fetch('/api/groups/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        group_ids: groupIds,
                        target_list_id: targetListId
                    })
                });
                if (!response.ok) throw new Error('Failed to move groups');
                return await response.json();
            } catch (error) {
                console.error('Error moving groups:', error);
                showToast('Error moving groups', 'error');
                return null;
            }
        }
    };

    // Rendering Functions
    const renderKeywordChips = () => {
        elements.keywordChips.innerHTML = state.keywords.map(keyword => `
            <div class="keyword-chip">
                ${keyword}
                <i class="fas fa-times" data-keyword="${keyword}"></i>
            </div>
        `).join('');
        
        // Add event listeners to the remove icons
        document.querySelectorAll('.keyword-chip i').forEach(icon => {
            icon.addEventListener('click', () => {
                const keyword = icon.dataset.keyword;
                state.keywords = state.keywords.filter(k => k !== keyword);
                renderKeywordChips();
            });
        });
        
        // Enable/disable the start button based on keywords
        elements.startParsingBtn.disabled = state.keywords.length === 0;
    };

    const renderListDropdowns = () => {
        // Populate the "Save to List" dropdown
        const groupListSelectHTML = state.groupLists.map(list => `
            <option value="${list.id}">${list.name}</option>
        `).join('');
        
        elements.groupListSelect.innerHTML = groupListSelectHTML;
        
        // Populate the "Saved Groups Filter" dropdown
        const savedListFilterHTML = `
            <option value="all">All Lists</option>
            ${state.groupLists.map(list => `
                <option value="${list.id}">${list.name}</option>
            `).join('')}
        `;
        
        elements.savedListFilter.innerHTML = savedListFilterHTML;
    };

    const renderFoundGroups = () => {
        if (state.foundGroups.length === 0) {
            elements.emptyFoundGroups.style.display = 'block';
            elements.foundGroupsList.innerHTML = '';
            elements.saveAllBtn.disabled = true;
            return;
        }
        
        elements.emptyFoundGroups.style.display = 'none';
        elements.saveAllBtn.disabled = false;
        
        elements.foundGroupsList.innerHTML = state.foundGroups.map(group => `
            <li class="group-item" data-id="${group.id}">
                <div class="group-info">
                    <div class="group-title">${group.title}</div>
                    <div class="group-details">
                        <div class="group-detail">
                            <i class="fas fa-at"></i> ${group.username}
                        </div>
                        <div class="group-detail">
                            <i class="fas fa-users"></i> ${formatNumber(group.members)}
                        </div>
                        <div class="group-detail">
                            <i class="fas fa-circle text-success"></i> ${formatNumber(group.online)} online
                        </div>
                        <div class="group-detail">
                            <i class="fas fa-globe"></i> ${group.language.toUpperCase()}
                        </div>
                    </div>
                </div>
                <div class="group-actions">
                    <button class="btn btn-secondary save-group-btn" data-id="${group.id}">
                        <i class="fas fa-save"></i> Save
                    </button>
                </div>
            </li>
        `).join('');
        
        // Add event listeners to save buttons
        document.querySelectorAll('.save-group-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const groupId = button.dataset.id;
                const group = state.foundGroups.find(g => g.id === groupId);
                
                if (group) {
                    const listId = elements.groupListSelect.value;
                    await saveGroup(group, listId);
                    
                    // Mark the button as saved
                    button.disabled = true;
                    button.innerHTML = '<i class="fas fa-check"></i> Saved';
                }
            });
        });
    };

    const renderSavedGroups = () => {
        // Get the table body
        const tableBody = elements.savedGroupsTableBody;
        
        if (!tableBody) return;
        
        if (state.savedGroups.length === 0) {
            elements.emptySavedGroups.style.display = 'block';
            tableBody.innerHTML = '';
            return;
        }
        
        // Filter by the selected list
        const listId = elements.savedListFilter.value;
        const filteredGroups = listId === 'all' ? 
            state.savedGroups : 
            state.savedGroups.filter(group => group.list_id === listId);
        
        if (filteredGroups.length === 0) {
            elements.emptySavedGroups.style.display = 'block';
            tableBody.innerHTML = '';
            return;
        }
        
        // Hide the empty state
        elements.emptySavedGroups.style.display = 'none';
        
        // Generate the table rows
        tableBody.innerHTML = filteredGroups.map(group => {
            // Find list name
            const list = state.groupLists.find(l => l.id === group.list_id);
            const listName = list ? list.name : 'Main Group List';
            
            // Format the member count
            const memberCount = formatNumber(group.members || 0);
            
            return `
                <tr data-id="${group.id}">
                    <td class="checkbox-col">
                        <input type="checkbox" class="group-checkbox" data-id="${group.id}" ${state.selectedGroups.has(group.id) ? 'checked' : ''}>
                    </td>
                    <td>
                        <div class="group-info">
                            <div class="group-name">${group.title}</div>
                            <div class="group-details">${group.description ? group.description.substring(0, 60) + (group.description.length > 60 ? '...' : '') : ''}</div>
                        </div>
                    </td>
                    <td>@${group.username || ''}</td>
                    <td>${memberCount}</td>
                    <td>${listName}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-icon btn-text edit-list-btn" data-id="${group.list_id}" title="Edit list">
                                <i class="fas fa-list"></i>
                            </button>
                            <button class="btn btn-icon btn-danger delete-group-btn" data-id="${group.id}" title="Delete group">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add event listeners for checkboxes
        tableBody.querySelectorAll('.group-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleSelectGroup);
        });
        
        // Add event listeners for delete buttons
        tableBody.querySelectorAll('.delete-group-btn').forEach(button => {
            button.addEventListener('click', async () => {
                const groupId = button.dataset.id;
                await deleteGroup(groupId);
            });
        });
        
        // Add event listeners for edit list buttons
        tableBody.querySelectorAll('.edit-list-btn').forEach(button => {
            button.addEventListener('click', () => {
                const listId = button.dataset.id;
                handleEditGroupList(listId);
            });
        });
    };

    const renderGroupLists = () => {
        if (!elements.groupLists) return;
        
        // Create the "All Groups" item
        const allGroupsItem = `
            <li data-list-id="all" ${state.currentGroupListId === 'all' ? 'class="active"' : ''}>
                <i class="fas fa-layer-group"></i>
                <span>All Groups</span>
                <span class="group-count">0</span>
            </li>
        `;
        
        // Create the list items for each group list
        const listItems = state.groupLists.map(list => `
            <li data-list-id="${list.id}" ${state.currentGroupListId === list.id ? 'class="active"' : ''}>
                <i class="fas fa-list"></i>
                <span>${list.name}</span>
                <span class="group-count">0</span>
            </li>
        `).join('');
        
        // Set the HTML content
        elements.groupLists.innerHTML = allGroupsItem + listItems;
        
        // Attach event listeners
        document.querySelectorAll('#group-lists li').forEach(item => {
            item.addEventListener('click', handleGroupListClick);
        });
        
        // Update group counts
        updateGroupCounts();
    };
    
    const updateGroupListDropdowns = () => {
        // Update the dropdown for saving groups
        if (elements.groupListSelect) {
            elements.groupListSelect.innerHTML = state.groupLists.map(list => `
                <option value="${list.id}">${list.name}</option>
            `).join('');
        }
        
        // Update the dropdown for filtering saved groups
        if (elements.savedListFilter) {
            elements.savedListFilter.innerHTML = `
                <option value="all">All Lists</option>
                ${state.groupLists.map(list => `
                    <option value="${list.id}">${list.name}</option>
                `).join('')}
            `;
        }
        
        // Update the dropdown for moving groups
        const moveGroupsListSelect = document.getElementById('move-groups-list');
        if (moveGroupsListSelect) {
            moveGroupsListSelect.innerHTML = state.groupLists.map(list => `
                <option value="${list.id}">${list.name}</option>
            `).join('');
        }
    };

    // Event handlers
    const handleAddKeyword = () => {
        const keyword = elements.keywordInput.value.trim();
        
        if (keyword && !state.keywords.includes(keyword)) {
            state.keywords.push(keyword);
            elements.keywordInput.value = '';
            renderKeywordChips();
        }
    };

    const handleParserFormSubmit = async (event) => {
        event.preventDefault();
        
        if (state.keywords.length === 0) {
            showToast('Please add at least one keyword', 'error');
            return;
        }
        
        // Get form values
        const language = elements.languageSelect.value;
        
        // Start parsing
        await startParsing(state.keywords, language);
    };

    const startParsing = async (keywords, language) => {
        // Show progress bar
        elements.parserProgress.style.display = 'block';
        elements.progressBar.style.width = '0%';
        
        // Disable form inputs during parsing
        toggleParsingState(true);
        
        // Gradually increase progress bar
        const interval = setInterval(() => {
            const currentWidth = parseInt(elements.progressBar.style.width) || 0;
            if (currentWidth < 90) {
                elements.progressBar.style.width = (currentWidth + 5) + '%';
            }
        }, 200);
        
        try {
            // Call API to get groups
            const groups = await api.getTelegramGroups(keywords, language);
            
            // Update state
            state.foundGroups = groups;
            
            // Complete progress bar
            elements.progressBar.style.width = '100%';
            
            // Render found groups
            renderFoundGroups();
            
            // Show success message
            showToast(`Found ${groups.length} groups matching your keywords`, 'success');
        } catch (error) {
            console.error('Error parsing groups:', error);
            showToast('Error parsing groups. Please try again.', 'error');
        } finally {
            // Clear interval and reset UI after a delay
            setTimeout(() => {
                clearInterval(interval);
                toggleParsingState(false);
                
                // Hide progress bar after animation completes
                setTimeout(() => {
                    elements.parserProgress.style.display = 'none';
                }, 500);
            }, 1000);
        }
    };

    const toggleParsingState = (isParsing) => {
        state.isParsingActive = isParsing;
        
        // Disable/enable form inputs
        elements.startParsingBtn.disabled = isParsing || state.keywords.length === 0;
        elements.languageSelect.disabled = isParsing;
        elements.keywordInput.disabled = isParsing;
        elements.addKeywordBtn.disabled = isParsing;
        
        // Update button text
        elements.startParsingBtn.innerHTML = isParsing ? 
            '<i class="fas fa-spinner fa-spin"></i> Parsing...' : 
            '<i class="fas fa-search"></i> Start Parsing';
    };

    const saveGroup = async (group, listId) => {
        try {
            // Save the group to the database
            const savedGroup = await api.saveGroups([group], listId);
            
            // Add to saved groups
            state.savedGroups = [...state.savedGroups, ...savedGroup];
            
            // Update UI
            renderSavedGroups();
            
            // Update group counts
            updateGroupCounts();
            
            // Show success message
            showToast('Group saved successfully', 'success');
            
            return true;
        } catch (error) {
            console.error('Error saving group:', error);
            showToast('Error saving group', 'error');
            return false;
        }
    };

    const saveAllGroups = async () => {
        if (state.foundGroups.length === 0) return;
        
        const listId = elements.groupListSelect.value;
        
        // Disable buttons during save
        elements.saveAllBtn.disabled = true;
        elements.saveAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        try {
            // Call API to save groups
            const savedGroups = await api.saveGroups(state.foundGroups, listId);
            
            // Update state
            state.savedGroups = [...state.savedGroups, ...savedGroups];
            
            // Disable all individual save buttons
            document.querySelectorAll('.save-group-btn').forEach(button => {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-check"></i> Saved';
            });
            
            // Update saved groups list
            renderSavedGroups();
            
            // Update group counts
            updateGroupCounts();
            
            // Show success message
            showToast(`Saved ${savedGroups.length} groups to list`, 'success');
        } catch (error) {
            console.error('Error saving groups:', error);
            showToast('Error saving groups', 'error');
        } finally {
            // Reset button
            elements.saveAllBtn.disabled = false;
            elements.saveAllBtn.innerHTML = '<i class="fas fa-save"></i> Save All';
        }
    };

    const deleteGroup = async (groupId) => {
        try {
            // Call API to delete group
            await api.deleteGroup(groupId);
            
            // Remove from state
            state.savedGroups = state.savedGroups.filter(group => group.id !== groupId);
            
            // Remove from selected groups if it's selected
            if (state.selectedGroups.has(groupId)) {
                state.selectedGroups.delete(groupId);
                updateGroupSelectionUI();
            }
            
            // Update UI
            renderSavedGroups();
            
            // Update group counts
            updateGroupCounts();
            
            // Show success message
            showToast('Group deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting group:', error);
            showToast('Error deleting group', 'error');
        }
    };

    const handleSavedListFilterChange = async () => {
        // Update UI with filtered saved groups
        renderSavedGroups();
    };

    const handleSidebarNavigation = (event) => {
        const item = event.target.closest('li');
        if (!item) return;
        
        const page = item.dataset.page;
        
        if (page === 'accounts') {
            // Redirect to accounts page
            window.location.href = '/index.html';
        }
    };

    const handleGroupListClick = async (event) => {
        const listItem = event.target.closest('li');
        if (!listItem) return;
        
        const listId = listItem.dataset.listId;
        
        // Update UI
        document.querySelectorAll('#group-lists li').forEach(item => {
            item.classList.remove('active');
        });
        listItem.classList.add('active');
        
        // Update state
        state.currentGroupListId = listId;
        state.selectedGroups.clear();
        updateGroupSelectionUI();
        
        // Load groups for this list
        await loadSavedGroups(listId);
    };

    const handleAddGroupList = () => {
        // Show the modal for adding a new group list
        showModal('add-group-list-modal');
    };

    const handleSaveGroupList = async () => {
        const listNameInput = document.getElementById('group-list-name');
        
        // Basic validation
        if (!listNameInput.value.trim()) {
            showToast('Please enter a list name', 'error');
            listNameInput.focus();
            return;
        }
        
        // Create list
        const newList = await api.createGroupList({
            name: listNameInput.value.trim()
        });
        
        if (newList) {
            showToast('Group list created successfully', 'success');
            hideModal('add-group-list-modal');
            
            // Reload group lists
            await loadGroupLists();
        }
    };

    const handleEditGroupList = async (listId) => {
        const list = state.groupLists.find(l => l.id === listId);
        if (!list) return;
        
        // Set the current value in the form
        const listNameInput = document.getElementById('edit-group-list-name');
        listNameInput.value = list.name;
        
        // Store the list ID in a data attribute
        const saveBtn = document.getElementById('save-edit-group-list-btn');
        saveBtn.dataset.listId = listId;
        
        // Show the modal
        showModal('edit-group-list-modal');
    };

    const handleSaveEditGroupList = async () => {
        const listNameInput = document.getElementById('edit-group-list-name');
        const saveBtn = document.getElementById('save-edit-group-list-btn');
        const listId = saveBtn.dataset.listId;
        
        // Basic validation
        if (!listNameInput.value.trim()) {
            showToast('Please enter a list name', 'error');
            listNameInput.focus();
            return;
        }
        
        // Update list
        const updatedList = await api.updateGroupList(listId, {
            name: listNameInput.value.trim()
        });
        
        if (updatedList) {
            showToast('Group list updated successfully', 'success');
            hideModal('edit-group-list-modal');
            
            // Reload group lists
            await loadGroupLists();
            
            // Refresh the saved groups display to show updated list names
            renderSavedGroups();
        }
    };

    const handleDeleteGroupList = async (listId) => {
        // Show confirmation dialog
        showModal('delete-group-list-modal');
        
        document.getElementById('delete-group-list-message').textContent = 
            'Are you sure you want to delete this list? All groups will be moved to the Main Group List.';
        
        // Set up the confirm button
        const confirmButton = document.getElementById('confirm-delete-group-list-btn');
        
        // Remove any existing event listeners
        const newConfirmButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
        
        // Add the new event listener
        newConfirmButton.addEventListener('click', async () => {
            const result = await api.deleteGroupList(listId);
            
            if (result) {
                showToast('Group list deleted successfully', 'success');
                hideModal('delete-group-list-modal');
                
                // If we were viewing the deleted list, switch to all
                if (state.currentGroupListId === listId) {
                    state.currentGroupListId = 'all';
                }
                
                // Reload group lists and groups
                await loadGroupLists();
                await loadSavedGroups(state.currentGroupListId);
            }
        });
    };

    const handleSelectGroup = (event) => {
        const checkbox = event.target;
        const groupId = checkbox.dataset.id;
        
        if (checkbox.checked) {
            state.selectedGroups.add(groupId);
        } else {
            state.selectedGroups.delete(groupId);
        }
        
        updateGroupSelectionUI();
    };

    const handleSelectAllGroups = (event) => {
        const checked = event.target.checked;
        
        document.querySelectorAll('.group-checkbox').forEach(checkbox => {
            checkbox.checked = checked;
            const groupId = checkbox.dataset.id;
            
            if (checked) {
                state.selectedGroups.add(groupId);
            } else {
                state.selectedGroups.delete(groupId);
            }
        });
        
        updateGroupSelectionUI();
    };

    const updateGroupSelectionUI = () => {
        const selectedCount = state.selectedGroups.size;
        
        // Update selected count
        if (elements.selectedGroupsCount) {
            elements.selectedGroupsCount.textContent = `${selectedCount} selected`;
        }
        
        // Show/hide selection actions
        if (elements.groupSelectionActions) {
            elements.groupSelectionActions.style.display = selectedCount > 0 ? 'flex' : 'none';
        }
        
        // Update select all checkbox
        if (elements.selectAllGroupsCheckbox) {
            const totalGroups = document.querySelectorAll('.group-checkbox').length;
            elements.selectAllGroupsCheckbox.checked = selectedCount > 0 && selectedCount === totalGroups;
            elements.selectAllGroupsCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalGroups;
        }
        
        // Update action buttons
        if (elements.moveSelectedGroupsBtn) {
            elements.moveSelectedGroupsBtn.disabled = selectedCount === 0;
        }
        if (elements.deleteSelectedGroupsBtn) {
            elements.deleteSelectedGroupsBtn.disabled = selectedCount === 0;
        }
    };

    const handleMoveSelectedGroups = () => {
        if (state.selectedGroups.size === 0) return;
        
        // Show the move groups modal
        showModal('move-groups-modal');
        
        document.getElementById('move-groups-message').textContent = 
            `Move ${state.selectedGroups.size} selected groups to:`;
        
        // Set up the confirm button
        const confirmButton = document.getElementById('confirm-move-groups-btn');
        
        // Remove any existing event listeners
        const newConfirmButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
        
        // Add the new event listener
        newConfirmButton.addEventListener('click', async () => {
            const targetListId = document.getElementById('move-groups-list').value;
            
            // Show loading indicator
            newConfirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Moving...';
            newConfirmButton.disabled = true;
            
            try {
                const result = await api.moveGroups(
                    Array.from(state.selectedGroups),
                    targetListId
                );
                
                if (result) {
                    showToast('Groups moved successfully', 'success');
                    hideModal('move-groups-modal');
                    
                    // Clear selection
                    state.selectedGroups.clear();
                    updateGroupSelectionUI();
                    
                    // Reload saved groups
                    await loadSavedGroups(state.currentGroupListId);
                    
                    // Update group counts
                    await updateGroupCounts();
                }
            } catch (error) {
                console.error('Error moving groups:', error);
                showToast('Error moving groups', 'error');
            } finally {
                // Reset button state
                newConfirmButton.innerHTML = 'Move Groups';
                newConfirmButton.disabled = false;
            }
        });
    };

    const handleDeleteSelectedGroups = async () => {
        if (state.selectedGroups.size === 0) return;
        
        // Show confirmation dialog
        showModal('delete-groups-modal');
        
        document.getElementById('delete-groups-message').textContent = 
            `Are you sure you want to delete ${state.selectedGroups.size} selected groups? This action cannot be undone.`;
        
        // Set up the confirm button
        const confirmButton = document.getElementById('confirm-delete-groups-btn');
        
        // Remove any existing event listeners
        const newConfirmButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
        
        // Add the new event listener
        newConfirmButton.addEventListener('click', async () => {
            // Show loading indicator
            newConfirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            newConfirmButton.disabled = true;
            
            try {
                // Delete each group individually
                const selectedGroupIds = Array.from(state.selectedGroups);
                let deletedCount = 0;
                
                for (const groupId of selectedGroupIds) {
                    const result = await api.deleteGroup(groupId);
                    if (result) {
                        deletedCount++;
                    }
                }
                
                showToast(`Successfully deleted ${deletedCount} groups`, 'success');
                hideModal('delete-groups-modal');
                
                // Clear selection
                state.selectedGroups.clear();
                updateGroupSelectionUI();
                
                // Reload saved groups
                await loadSavedGroups(state.currentGroupListId);
                
                // Update group counts
                await updateGroupCounts();
            } catch (error) {
                console.error('Error deleting groups:', error);
                showToast('Error deleting groups', 'error');
            } finally {
                // Reset button state
                newConfirmButton.innerHTML = 'Delete Groups';
                newConfirmButton.disabled = false;
            }
        });
    };

    const updateGroupCounts = async () => {
        try {
            // Get all groups
            const allGroups = await api.getSavedGroups('all');
            
            // Update the "All Groups" count
            const allGroupsCount = document.querySelector('li[data-list-id="all"] .group-count');
            if (allGroupsCount) {
                allGroupsCount.textContent = allGroups.length;
            }
            
            // For each list, count groups belonging to it
            state.groupLists.forEach(list => {
                const listCount = allGroups.filter(group => group.list_id === list.id).length;
                
                const listCountElement = document.querySelector(`li[data-list-id="${list.id}"] .group-count`);
                if (listCountElement) {
                    listCountElement.textContent = listCount;
                }
            });
        } catch (error) {
            console.error('Error updating group counts:', error);
        }
    };

    // Utilities
    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    };
    
    const showModal = (modalId) => {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;
        
        modalContainer.classList.add('active');
        document.getElementById(modalId).classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const hideModal = (modalId) => {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;
        
        modalContainer.classList.remove('active');
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

    // Data loading functions
    const loadSavedGroups = async (listId = 'all') => {
        try {
            const groups = await api.getSavedGroups(listId);
            state.savedGroups = groups;
            renderSavedGroups();
        } catch (error) {
            console.error('Error loading saved groups:', error);
        }
    };

    const loadGroupLists = async () => {
        try {
            state.groupLists = await api.getGroupLists();
            renderGroupLists();
            updateGroupListDropdowns();
        } catch (error) {
            console.error('Error loading group lists:', error);
        }
    };

    // Event Listeners Attachment
    const attachEventListeners = () => {
        // Keyword input
        if (elements.addKeywordBtn) {
            elements.addKeywordBtn.addEventListener('click', handleAddKeyword);
        }
        
        if (elements.keywordInput) {
            elements.keywordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKeyword();
                }
            });
        }
        
        // Form submission
        if (elements.parserForm) {
            elements.parserForm.addEventListener('submit', handleParserFormSubmit);
        }
        
        // Save all button
        if (elements.saveAllBtn) {
            elements.saveAllBtn.addEventListener('click', saveAllGroups);
        }
        
        // Saved list filter
        if (elements.savedListFilter) {
            elements.savedListFilter.addEventListener('change', handleSavedListFilterChange);
        }
        
        // Sidebar navigation
        if (elements.sidebarMenu) {
            elements.sidebarMenu.addEventListener('click', handleSidebarNavigation);
        }
        
        // Group list management
        if (elements.addGroupListBtn) {
            elements.addGroupListBtn.addEventListener('click', handleAddGroupList);
        }
        
        // Save group list button
        const saveGroupListBtn = document.getElementById('save-group-list-btn');
        if (saveGroupListBtn) {
            saveGroupListBtn.addEventListener('click', handleSaveGroupList);
        }
        
        // Save edit group list button
        const saveEditGroupListBtn = document.getElementById('save-edit-group-list-btn');
        if (saveEditGroupListBtn) {
            saveEditGroupListBtn.addEventListener('click', handleSaveEditGroupList);
        }
        
        // Group selection management
        if (elements.selectAllGroupsCheckbox) {
            elements.selectAllGroupsCheckbox.addEventListener('change', handleSelectAllGroups);
        }
        
        // Move selected groups button
        if (elements.moveSelectedGroupsBtn) {
            elements.moveSelectedGroupsBtn.addEventListener('click', handleMoveSelectedGroups);
        }
        
        // Delete selected groups button
        if (elements.deleteSelectedGroupsBtn) {
            elements.deleteSelectedGroupsBtn.addEventListener('click', handleDeleteSelectedGroups);
        }
        
        // Modal close buttons
        document.querySelectorAll('[data-close-modal]').forEach(button => {
            button.addEventListener('click', () => {
                const modalId = button.dataset.closeModal;
                hideModal(modalId);
            });
        });
    };

    // Initialization
    const init = async () => {
        // Load data
        await loadGroupLists();
        await loadSavedGroups('all');
        
        // Render initial states
        renderKeywordChips();
        renderFoundGroups();
        
        // Attach event listeners
        attachEventListeners();
    };
    
    // Start the app
    init();
});