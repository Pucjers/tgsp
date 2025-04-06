document.addEventListener('DOMContentLoaded', function() {
    // App state
    const state = {
        keywords: [],
        foundGroups: [],
        savedGroups: [],
        lists: [],
        isParsingActive: false,
        currentListId: 'all'
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
        savedGroupsList: document.getElementById('saved-groups-list'),
        emptyFoundGroups: document.getElementById('empty-found-groups'),
        emptySavedGroups: document.getElementById('empty-saved-groups'),
        
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
        const groupListSelectHTML = state.lists.map(list => `
            <option value="${list.id}">${list.name}</option>
        `).join('');
        
        elements.groupListSelect.innerHTML = groupListSelectHTML;
        
        // Populate the "Saved Groups Filter" dropdown
        const savedListFilterHTML = `
            <option value="all">All Lists</option>
            ${state.lists.map(list => `
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
        if (state.savedGroups.length === 0) {
            elements.emptySavedGroups.style.display = 'block';
            elements.savedGroupsList.innerHTML = '';
            return;
        }
        
        // Filter by the selected list
        const listId = elements.savedListFilter.value;
        const filteredGroups = listId === 'all' ? 
            state.savedGroups : 
            state.savedGroups.filter(group => group.list_id === listId);
        
        if (filteredGroups.length === 0) {
            elements.emptySavedGroups.style.display = 'block';
            elements.savedGroupsList.innerHTML = '';
            return;
        }
        
        elements.emptySavedGroups.style.display = 'none';
        
        elements.savedGroupsList.innerHTML = filteredGroups.map(group => {
            // Find list name
            const list = state.lists.find(l => l.id === group.list_id);
            const listName = list ? list.name : 'Unknown';
            
            return `
                <li class="group-item" data-id="${group.id}">
                    <div class="group-info">
                        <div class="group-title">${group.title}</div>
                        <div class="group-details">
                            <div class="group-detail">
                                <i class="fas fa-at"></i> ${group.username}
                            </div>
                            <div class="group-detail">
                                <i class="fas fa-list"></i> ${listName}
                            </div>
                        </div>
                    </div>
                    <div class="group-actions">
                        <button class="btn btn-danger delete-group-btn" data-id="${group.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </li>
            `;
        }).join('');
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-group-btn').forEach(button => {
            button.addEventListener('click', async () => {
                const groupId = button.dataset.id;
                await deleteGroup(groupId);
            });
        });
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
            showToast('Please add at least one keyword', 'warning');
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
            // In a real app, this would call an API to save the group
            const savedGroup = await api.saveGroups([group], listId);
            
            // Add to saved groups
            state.savedGroups = [...state.savedGroups, ...savedGroup];
            
            // Update UI
            renderSavedGroups();
            
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
            
            // Update UI
            renderSavedGroups();
            
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

    // Utilities
    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    };
    
    const getRandomGroupName = (keyword) => {
        const prefixes = ['', 'The ', 'Official ', 'Best ', 'Top '];
        const suffixes = ['Group', 'Community', 'Club', 'Network', 'Chat', 'Hub', 'Center', 'World'];
        
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        
        return `${prefix}${keyword} ${suffix}`;
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

    // Initialization
    const init = async () => {
        // Load lists
        state.lists = await api.getLists();
        renderListDropdowns();
        
        // Load saved groups
        state.savedGroups = await api.getSavedGroups();
        
        // Render initial states
        renderKeywordChips();
        renderFoundGroups();
        renderSavedGroups();
        
        // Attach event listeners
        attachEventListeners();
    };
    
    const attachEventListeners = () => {
        // Keyword input
        elements.addKeywordBtn.addEventListener('click', handleAddKeyword);
        elements.keywordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddKeyword();
            }
        });
        
        // Form submission
        elements.parserForm.addEventListener('submit', handleParserFormSubmit);
        
        // Save all button
        elements.saveAllBtn.addEventListener('click', saveAllGroups);
        
        // Saved list filter
        elements.savedListFilter.addEventListener('change', handleSavedListFilterChange);
        
        // Sidebar navigation
        elements.sidebarMenu.addEventListener('click', handleSidebarNavigation);
    };
    
    // Start the app
    init();
});