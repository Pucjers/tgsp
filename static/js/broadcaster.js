// Enhanced Broadcaster Implementation
document.addEventListener("DOMContentLoaded", function() {
  // State management for our broadcaster
  const state = {
    tasks: [],
    selectedAccounts: [],
    accountsData: [],
    selectedGroups: [],
    groupsData: [],
    selectedFile: null,
    documentFile: null,
    sendMode: 'single',
    workMode: 'group'
  };

  // Cache DOM elements
  const elements = {
    // Task list container
    taskListContainer: document.getElementById('task-list-container'),
    emptyTasksMessage: document.getElementById('empty-tasks-message'),
    
    // Main buttons
    newTaskBtn: document.getElementById('new-task-btn'),
    refreshTasksBtn: document.getElementById('refresh-tasks-btn'),
    
    // Modal buttons
    createTaskBtn: document.getElementById('create-task-btn'),
    createAndRunTaskBtn: document.getElementById('create-and-run-task-btn'),
    accountSelectorBtn: document.getElementById('account-selector'),
    confirmAccountsBtn: document.getElementById('confirm-accounts-btn'),
    addDocumentBtn: document.getElementById('add-document-btn'),
    addDocumentConfirmBtn: document.getElementById('add-document-confirm-btn'),
    removeDocumentBtn: document.getElementById('remove-document-btn'),
    proxyWarningConfirmBtn: document.getElementById('proxy-warning-confirm-btn'),

    // Inputs
    taskNameInput: document.getElementById('taskName'),
    chatLinksFileInput: document.getElementById('chat-links-file'),
    messageTextArea: document.getElementById('enhanced-message-text'),
    chatCountInput: document.getElementById('chatCount'),
    waitMinInput: document.getElementById('waitMin'),
    waitMaxInput: document.getElementById('waitMax'),
    documentFileInput: document.getElementById('document-file-input'),
    accountFilter: document.getElementById('account-filter'),

    // Checkboxes
    sendModeRadios: document.getElementsByName('sendMode'),
    workModeRadios: document.getElementsByName('workMode'),
    joinChatsCheckbox: document.getElementById('joinChats'),
    repeatBroadcastCheckbox: document.getElementById('repeatBroadcast'),
    hideSourceCheckbox: document.getElementById('hideSource'),
    processAfterPostCheckbox: document.getElementById('processAfterPost'),
    deleteAfterCheckbox: document.getElementById('deleteAfter'),
    leaveChatsCheckbox: document.getElementById('leaveChats'),
    useFloodCheckCheckbox: document.getElementById('useFloodCheck'),

    // Containers
    singleMessageContainer: document.getElementById('single-message-container'),
    groupChatContainer: document.getElementById('group-chat-container'),
    repeatIntervalContainer: document.getElementById('repeat-interval-container'),
    selectedAccountsContainer: document.getElementById('selected-accounts-container'),
    accountsList: document.getElementById('accounts-list'),
    documentPreview: document.getElementById('document-preview'),
    documentName: document.getElementById('document-name'),
    documentSize: document.getElementById('document-size'),
    documentIcon: document.getElementById('document-icon'),
    selectedFileName: document.getElementById('selected-file-name'),
    proxyWarningOverlay: document.getElementById('proxy-warning-overlay'),
    
    // Stats counters
    todayCounter: document.getElementById('today-counter'),
    yesterdayCounter: document.getElementById('yesterday-counter'),
    totalCounter: document.getElementById('total-counter')
  };

  // API functions for interacting with the backend
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
    
    async getTasks() {
      try {
        const response = await fetch('/api/broadcaster/tasks');
        if (!response.ok) throw new Error('Failed to fetch tasks');
        const data = await response.json();
        return data.success ? data.tasks : {};
      } catch (error) {
        console.error('Error fetching tasks:', error);
        showToast('Error loading tasks', 'error');
        return {};
      }
    },

    async uploadChatListFile(file) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/broadcaster/upload-chat-list', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload file');
        }

        return await response.json();
      } catch (error) {
        console.error('Error uploading chat list file:', error);
        showToast('Error uploading file: ' + error.message, 'error');
        return null;
      }
    },

    async createTask(taskData, autoRun = false) {
      try {
        const response = await fetch('/api/broadcaster/create-task', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...taskData,
            auto_run: autoRun
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create task');
        }

        return await response.json();
      } catch (error) {
        console.error('Error creating task:', error);
        showToast('Error creating task: ' + error.message, 'error');
        return null;
      }
    },
    
    async startTask(taskId) {
      try {
        const response = await fetch(`/api/broadcaster/tasks/${taskId}/start`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start task');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error starting task:', error);
        showToast('Error starting task: ' + error.message, 'error');
        return null;
      }
    },
    
    async stopTask(taskId) {
      try {
        const response = await fetch(`/api/broadcaster/tasks/${taskId}/stop`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to stop task');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error stopping task:', error);
        showToast('Error stopping task: ' + error.message, 'error');
        return null;
      }
    },
    
    async deleteTask(taskId) {
      try {
        const response = await fetch(`/api/broadcaster/tasks/${taskId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete task');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error deleting task:', error);
        showToast('Error deleting task: ' + error.message, 'error');
        return null;
      }
    }
  };

  // Initialize everything
  function init() {
    loadAccountLists();
    loadGroupLists();
    loadTasks();
    attachEventListeners();
    updateStatsCounters(); // Update the counters on page load
  }
  
  // Load account lists and populate dropdowns
  async function loadAccountLists() {
    const lists = await api.getAccountLists();
    
    if (!lists || !lists.length) return;
    
    // Populate account filter dropdown
    if (elements.accountFilter) {
      let options = '<option value="all">All Accounts</option>';
      lists.forEach(list => {
        options += `<option value="${list.id}">${list.name}</option>`;
      });
      elements.accountFilter.innerHTML = options;
    }
  }
  
  // Load group lists and populate dropdowns
  async function loadGroupLists() {
    const lists = await api.getGroupLists();
    
    if (!lists || !lists.length) return;
    
    // You would populate a group filter dropdown here if needed
  }
  
  // Load tasks and render them
  async function loadTasks() {
    const tasks = await api.getTasks();
    
    if (!tasks) return;
    
    state.tasks = Object.values(tasks);
    renderTasks();
    updateStatsCounters();
  }
  
  // Render the tasks in the task list
  function renderTasks() {
    if (!elements.taskListContainer) return;
    
    if (!state.tasks.length) {
      elements.taskListContainer.style.display = 'none';
      if (elements.emptyTasksMessage) {
        elements.emptyTasksMessage.style.display = 'block';
      }
      return;
    }
    
    elements.taskListContainer.style.display = 'block';
    if (elements.emptyTasksMessage) {
      elements.emptyTasksMessage.style.display = 'none';
    }
    
    elements.taskListContainer.innerHTML = state.tasks.map(task => {
      const startedDate = task.startedAt ? new Date(task.startedAt).toLocaleString() : 'Not started';
      const completedDate = task.completedAt ? new Date(task.completedAt).toLocaleString() : 'Not completed';
      
      const progress = task.progress || { total: 0, completed: 0, errors: 0 };
      const progressPercentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
      
      let statusBadge = '';
      let actionButtons = '';
      
      switch (task.status) {
        case 'created':
          statusBadge = '<span class="status-badge unverified">Created</span>';
          actionButtons = `
            <button class="btn btn-icon btn-text start-task-btn" data-id="${task.id}" title="Start task">
              <i class="fas fa-play"></i>
            </button>
            <button class="btn btn-icon btn-danger delete-task-btn" data-id="${task.id}" title="Delete task">
              <i class="fas fa-trash"></i>
            </button>
          `;
          break;
        case 'running':
          statusBadge = '<span class="status-badge ok">Running</span>';
          actionButtons = `
            <button class="btn btn-icon btn-text stop-task-btn" data-id="${task.id}" title="Stop task">
              <i class="fas fa-stop"></i>
            </button>
          `;
          break;
        case 'completed':
          statusBadge = '<span class="status-badge ok">Completed</span>';
          actionButtons = `
            <button class="btn btn-icon btn-text restart-task-btn" data-id="${task.id}" title="Restart task">
              <i class="fas fa-redo"></i>
            </button>
            <button class="btn btn-icon btn-danger delete-task-btn" data-id="${task.id}" title="Delete task">
              <i class="fas fa-trash"></i>
            </button>
          `;
          break;
        case 'stopped':
          statusBadge = '<span class="status-badge temp-block">Stopped</span>';
          actionButtons = `
            <button class="btn btn-icon btn-text restart-task-btn" data-id="${task.id}" title="Restart task">
              <i class="fas fa-redo"></i>
            </button>
            <button class="btn btn-icon btn-danger delete-task-btn" data-id="${task.id}" title="Delete task">
              <i class="fas fa-trash"></i>
            </button>
          `;
          break;
        case 'error':
          statusBadge = '<span class="status-badge blocked">Error</span>';
          actionButtons = `
            <button class="btn btn-icon btn-text restart-task-btn" data-id="${task.id}" title="Restart task">
              <i class="fas fa-redo"></i>
            </button>
            <button class="btn btn-icon btn-danger delete-task-btn" data-id="${task.id}" title="Delete task">
              <i class="fas fa-trash"></i>
            </button>
          `;
          break;
        default:
          statusBadge = `<span class="status-badge unverified">${task.status || 'Unknown'}</span>`;
          actionButtons = `
            <button class="btn btn-icon btn-danger delete-task-btn" data-id="${task.id}" title="Delete task">
              <i class="fas fa-trash"></i>
            </button>
          `;
      }
      
      return `
        <tr data-id="${task.id}">
          <td>
            <div class="task-info">
              <div class="task-name">${task.name}</div>
              <div class="task-details">
                Mode: ${task.mode}, Work mode: ${task.workMode}
              </div>
            </div>
          </td>
          <td>
            ${statusBadge}
          </td>
          <td>
            <div>Created: ${new Date(task.createdAt).toLocaleString()}</div>
            <div>Started: ${startedDate}</div>
            <div>Completed: ${completedDate}</div>
          </td>
          <td>
            <div class="task-progress">
              <div>Progress: ${progress.completed}/${progress.total}</div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progressPercentage}%"></div>
              </div>
              <div>Errors: ${progress.errors}</div>
            </div>
          </td>
          <td>
            <div class="action-buttons">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    attachTaskEventListeners();
  }
  
  // Attach event listeners to the task buttons
  function attachTaskEventListeners() {
    document.querySelectorAll('.start-task-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const taskId = button.dataset.id;
        if (!taskId) return;
        
        button.disabled = true;
        const result = await api.startTask(taskId);
        button.disabled = false;
        
        if (result && result.success) {
          showToast('Task started successfully', 'success');
          await loadTasks();
        }
      });
    });
    
    document.querySelectorAll('.stop-task-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const taskId = button.dataset.id;
        if (!taskId) return;
        
        button.disabled = true;
        const result = await api.stopTask(taskId);
        button.disabled = false;
        
        if (result && result.success) {
          showToast('Task stopped successfully', 'success');
          await loadTasks();
        }
      });
    });
    
    document.querySelectorAll('.restart-task-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const taskId = button.dataset.id;
        if (!taskId) return;
        
        button.disabled = true;
        const result = await api.startTask(taskId);
        button.disabled = false;
        
        if (result && result.success) {
          showToast('Task restarted successfully', 'success');
          await loadTasks();
        }
      });
    });
    
    document.querySelectorAll('.delete-task-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const taskId = button.dataset.id;
        if (!taskId) return;
        
        if (!confirm('Are you sure you want to delete this task?')) return;
        
        button.disabled = true;
        const result = await api.deleteTask(taskId);
        button.disabled = false;
        
        if (result && result.success) {
          showToast('Task deleted successfully', 'success');
          await loadTasks();
        }
      });
    });
  }
  
  // Update the stats counters
  function updateStatsCounters() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let todayCount = 0;
    let yesterdayCount = 0;
    let totalCount = 0;
    
    state.tasks.forEach(task => {
      // Only count completed tasks
      if (task.status === 'completed' && task.completedAt) {
        const completedDate = new Date(task.completedAt);
        
        // Check if completed today
        if (completedDate >= today) {
          todayCount++;
        }
        // Check if completed yesterday
        else if (completedDate >= yesterday && completedDate < today) {
          yesterdayCount++;
        }
        
        // Count total
        totalCount++;
      }
    });
    
    // Update the counters
    if (elements.todayCounter) elements.todayCounter.textContent = todayCount;
    if (elements.yesterdayCounter) elements.yesterdayCounter.textContent = yesterdayCount;
    if (elements.totalCounter) elements.totalCounter.textContent = totalCount;
  }

  // Attach event listeners
  function attachEventListeners() {
    // New task button
    if (elements.newTaskBtn) {
      elements.newTaskBtn.addEventListener('click', () => {
        showModal('enhanced-broadcaster-modal');
      });
    }
    
    // Refresh tasks button
    if (elements.refreshTasksBtn) {
      elements.refreshTasksBtn.addEventListener('click', loadTasks);
    }
    
    // Send mode radio buttons
    if (elements.sendModeRadios) {
      elements.sendModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          state.sendMode = e.target.value;
          updateSendModeUI();
        });
      });
    }

    // Work mode radio buttons
    if (elements.workModeRadios) {
      elements.workModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          state.workMode = e.target.value;
          updateWorkModeUI();
        });
      });
    }

    // Repeat broadcast checkbox
    if (elements.repeatBroadcastCheckbox) {
      elements.repeatBroadcastCheckbox.addEventListener('change', (e) => {
        if (elements.repeatIntervalContainer) {
          elements.repeatIntervalContainer.style.display = e.target.checked ? 'flex' : 'none';
        }
      });
    }

    // File input change
    if (elements.chatLinksFileInput) {
      elements.chatLinksFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          state.selectedFile = e.target.files[0];
          if (elements.selectedFileName) {
            elements.selectedFileName.textContent = state.selectedFile.name;
          }
        }
      });
    }

    // Account selector
    if (elements.accountSelectorBtn) {
      elements.accountSelectorBtn.addEventListener('click', () => {
        loadAccounts();
        showModal('account-selection-modal');
      });
    }

    // Confirm accounts
    if (elements.confirmAccountsBtn) {
      elements.confirmAccountsBtn.addEventListener('click', () => {
        hideModal('account-selection-modal');
        renderSelectedAccounts();
      });
    }

    // Document upload
    if (elements.addDocumentBtn) {
      elements.addDocumentBtn.addEventListener('click', () => {
        showModal('document-upload-modal');
      });
    }

    // Document file input
    if (elements.documentFileInput) {
      elements.documentFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          handleDocumentSelection(e.target.files[0]);
        }
      });
    }

    // Remove document
    if (elements.removeDocumentBtn) {
      elements.removeDocumentBtn.addEventListener('click', () => {
        state.documentFile = null;
        if (elements.documentPreview) {
          elements.documentPreview.style.display = 'none';
        }
      });
    }

    // Create task
    if (elements.createTaskBtn) {
      elements.createTaskBtn.addEventListener('click', () => {
        createTask(false);
      });
    }

    // Create and run task
    if (elements.createAndRunTaskBtn) {
      elements.createAndRunTaskBtn.addEventListener('click', () => {
        createTask(true);
      });
    }

    // Proxy warning confirm
    if (elements.proxyWarningConfirmBtn) {
      elements.proxyWarningConfirmBtn.addEventListener('click', () => {
        if (elements.proxyWarningOverlay) {
          elements.proxyWarningOverlay.style.display = 'none';
        }
      });
    }

    // Account filter change
    if (elements.accountFilter) {
      elements.accountFilter.addEventListener('change', (e) => {
        loadAccounts(e.target.value);
      });
    }
    
    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(button => {
      button.addEventListener('click', () => {
        const modalId = button.getAttribute('data-close-modal');
        hideModal(modalId);
      });
    });
    
    // Document upload area drag and drop
    const documentUploadArea = document.getElementById('document-upload-area');
    if (documentUploadArea) {
        documentUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            documentUploadArea.classList.add('dragover');
        });

        documentUploadArea.addEventListener('dragleave', () => {
            documentUploadArea.classList.remove('dragover');
        });

        documentUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            documentUploadArea.classList.remove('dragover');

            if (e.dataTransfer.files.length > 0) {
                handleDocumentSelection(e.dataTransfer.files[0]);
            }
        });

        documentUploadArea.addEventListener('click', () => {
            if (elements.documentFileInput) {
                elements.documentFileInput.click();
            }
        });
    }
  }

  // Load accounts
  async function loadAccounts(listId = 'all') {
    const accounts = await api.getAccounts(listId);
    state.accountsData = accounts;
    
    if (!elements.accountsList) return;
    
    // Render accounts list
    if (!accounts || !accounts.length) {
      elements.accountsList.innerHTML = '<div class="p-4 text-center text-gray-500">No accounts found</div>';
      return;
    }
    
    let html = '';
    accounts.forEach(account => {
      const isSelected = state.selectedAccounts.some(acc => acc.id === account.id);
      html += `
        <div class="account-card p-3 mb-2 border rounded ${isSelected ? 'bg-blue-50 border-blue-500' : ''}" data-id="${account.id}">
          <div class="flex items-center">
            <div class="flex-shrink-0 mr-3">
              ${account.avatar 
                ? `<img src="${account.avatar}" alt="${account.name}" class="w-8 h-8 rounded-full">`
                : `<div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                    <i class="fas fa-user"></i>
                  </div>`
              }
            </div>
            <div class="flex-1">
              <div class="font-medium">${account.name}</div>
              <div class="text-sm text-gray-500">${account.phone || ''}</div>
            </div>
            <div>
              <input type="checkbox" ${isSelected ? 'checked' : ''} data-id="${account.id}" class="account-checkbox">
            </div>
          </div>
        </div>
      `;
    });
    
    elements.accountsList.innerHTML = html;
    
    // Attach event listeners to account cards
    document.querySelectorAll('.account-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('account-checkbox')) {
          return; // Let the checkbox handle its own click
        }
        
        const accountId = card.dataset.id;
        const checkbox = card.querySelector('.account-checkbox');
        checkbox.checked = !checkbox.checked;
        
        toggleAccountSelection(accountId, checkbox.checked);
        card.classList.toggle('bg-blue-50');
        card.classList.toggle('border-blue-500');
      });
    });
    
    // Attach event listeners to checkboxes
    document.querySelectorAll('.account-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const accountId = e.target.dataset.id;
        const card = e.target.closest('.account-card');
        
        toggleAccountSelection(accountId, e.target.checked);
        card.classList.toggle('bg-blue-50');
        card.classList.toggle('border-blue-500');
      });
    });
  }

  // Toggle account selection
  function toggleAccountSelection(accountId, isSelected) {
    if (isSelected) {
      if (!state.selectedAccounts.some(acc => acc.id === accountId)) {
        const account = state.accountsData.find(acc => acc.id === accountId);
        if (account) {
          state.selectedAccounts.push(account);
        }
      }
    } else {
      state.selectedAccounts = state.selectedAccounts.filter(acc => acc.id !== accountId);
    }
  }

  // Render selected accounts
  function renderSelectedAccounts() {
    if (!elements.accountSelectorBtn || !elements.selectedAccountsContainer) return;
    
    if (state.selectedAccounts.length === 0) {
      elements.accountSelectorBtn.innerHTML = 'Выбрать аккаунты';
      elements.accountSelectorBtn.classList.add('bg-blue-500');
      elements.selectedAccountsContainer.innerHTML = '';
      return;
    }
    
    elements.accountSelectorBtn.innerHTML = `Выбрано ${state.selectedAccounts.length} аккаунтов`;
    elements.accountSelectorBtn.classList.remove('bg-blue-500');
    elements.accountSelectorBtn.classList.add('bg-green-500');
    
    let html = '';
    state.selectedAccounts.forEach(account => {
      html += `
        <div class="border p-3 rounded" data-id="${account.id}">
          <div class="flex items-center">
            <div class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 mr-3 overflow-hidden">
              ${account.avatar 
                ? `<img src="${account.avatar}" alt="${account.name}" class="w-full h-full object-cover">`
                : `<i class="fas fa-user"></i>`
              }
            </div>
            <div>
              <div class="font-medium">${account.name}</div>
              <div class="text-sm text-gray-500">${account.phone || ''}</div>
            </div>
          </div>
        </div>
      `;
    });
    
    elements.selectedAccountsContainer.innerHTML = html;
  }

  // Handle document selection
  function handleDocumentSelection(file) {
    if (!elements.documentPreview || !elements.documentName || !elements.documentSize || !elements.documentIcon) return;
    
    if (file.size > 1024 * 1024) {
      showToast('File size exceeds 1MB limit', 'error');
      return;
    }
    
    state.documentFile = file;
    elements.documentPreview.style.display = 'block';
    elements.documentName.textContent = file.name;
    elements.documentSize.textContent = formatFileSize(file.size);
    
    // Set icon based on file type
    const fileType = file.type.split('/')[0];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (fileType === 'image') {
      elements.documentIcon.className = 'fas fa-image mr-3 text-2xl text-blue-500';
    } else if (fileExtension === 'pdf') {
      elements.documentIcon.className = 'fas fa-file-pdf mr-3 text-2xl text-red-500';
    } else if (['doc', 'docx'].includes(fileExtension)) {
      elements.documentIcon.className = 'fas fa-file-word mr-3 text-2xl text-blue-700';
    } else if (fileExtension === 'txt') {
      elements.documentIcon.className = 'fas fa-file-alt mr-3 text-2xl text-gray-500';
    } else {
      elements.documentIcon.className = 'fas fa-file mr-3 text-2xl text-gray-500';
    }
  }
  
  // Update send mode UI
  function updateSendModeUI() {
    if (!elements.singleMessageContainer) return;
    elements.singleMessageContainer.style.display = state.sendMode === 'single' ? 'block' : 'none';
  }
  
  // Update work mode UI
  function updateWorkModeUI() {
    if (!elements.groupChatContainer) return;
    elements.groupChatContainer.style.display = state.workMode === 'group' ? 'block' : 'none';
  }
  
  // Create task
  async function createTask(autoRun = false) {
    // Validate inputs
    if (!validateInputs()) {
      return;
    }
    
    // Check if all selected accounts have proxies
    const accountsWithoutProxy = state.selectedAccounts.filter(account => !account.proxy_id);
    if (accountsWithoutProxy.length > 0) {
      if (elements.proxyWarningOverlay) {
        elements.proxyWarningOverlay.style.display = 'flex';
      }
      return;
    }
    
    // Upload file if selected
    let fileUrl = null;
    if (state.selectedFile) {
      const fileResult = await api.uploadChatListFile(state.selectedFile);
      if (fileResult && fileResult.success) {
        fileUrl = fileResult.url;
      } else {
        showToast('Failed to upload chat list file', 'error');
        return;
      }
    }
    
    // Create task data
    const taskData = {
      name: elements.taskNameInput ? elements.taskNameInput.value : 'My task',
      mode: state.sendMode,
      workMode: state.workMode,
      message: elements.messageTextArea ? elements.messageTextArea.value : '',
      chatListUrl: fileUrl,
      chatCount: elements.chatCountInput ? parseInt(elements.chatCountInput.value) : 6,
      waitPeriod: {
        min: elements.waitMinInput ? parseInt(elements.waitMinInput.value) : 1,
        max: elements.waitMaxInput ? parseInt(elements.waitMaxInput.value) : 1
      },
      hideSource: elements.hideSourceCheckbox ? elements.hideSourceCheckbox.checked : false,
      repeatBroadcast: elements.repeatBroadcastCheckbox ? elements.repeatBroadcastCheckbox.checked : false,
      joinChats: elements.joinChatsCheckbox ? elements.joinChatsCheckbox.checked : false,
      processAfterPost: elements.processAfterPostCheckbox ? elements.processAfterPostCheckbox.checked : false,
      deleteAfter: elements.deleteAfterCheckbox ? elements.deleteAfterCheckbox.checked : false,
      leaveChats: elements.leaveChatsCheckbox ? elements.leaveChatsCheckbox.checked : false,
      useFloodCheck: elements.useFloodCheckCheckbox ? elements.useFloodCheckCheckbox.checked : false,
      selectedAccounts: state.selectedAccounts.map(acc => acc.id)
    };
    
    // Create task
    const result = await api.createTask(taskData, autoRun);
    
    if (result && result.success) {
      showToast(autoRun ? 'Task created and started' : 'Task created successfully', 'success');
      hideModal('enhanced-broadcaster-modal');
      
      // Reload tasks
      loadTasks();
      
      // Reset form
      resetForm();
    }
  }
  
  // Validate inputs
  function validateInputs() {
    if (elements.taskNameInput && !elements.taskNameInput.value.trim()) {
      showToast('Please enter a task name', 'error');
      elements.taskNameInput.focus();
      return false;
    }
    
    if (state.sendMode === 'single' && elements.messageTextArea && !elements.messageTextArea.value.trim()) {
      showToast('Please enter a message', 'error');
      elements.messageTextArea.focus();
      return false;
    }
    
    if (state.selectedAccounts.length === 0) {
      showToast('Please select at least one account', 'error');
      return false;
    }
    
    if (state.workMode === 'group' && elements.chatCountInput) {
      const chatCount = parseInt(elements.chatCountInput.value);
      if (isNaN(chatCount) || chatCount < 1 || chatCount > 30) {
        showToast('Chat count must be between 1 and 30', 'error');
        elements.chatCountInput.focus();
        return false;
      }
    }
    
    if (elements.repeatBroadcastCheckbox && elements.repeatBroadcastCheckbox.checked) {
      const waitMin = elements.waitMinInput ? parseInt(elements.waitMinInput.value) : 0;
      const waitMax = elements.waitMaxInput ? parseInt(elements.waitMaxInput.value) : 0;
      
      if (isNaN(waitMin) || waitMin < 1) {
        showToast('Minimum wait time must be at least 1 minute', 'error');
        elements.waitMinInput.focus();
        return false;
      }
      
      if (isNaN(waitMax) || waitMax < waitMin) {
        showToast('Maximum wait time must be greater than or equal to minimum', 'error');
        elements.waitMaxInput.focus();
        return false;
      }
    }
    
    return true;
  }
  
  // Reset form
  function resetForm() {
    if (elements.taskNameInput) elements.taskNameInput.value = 'My task';
    if (elements.messageTextArea) elements.messageTextArea.value = '[Здравствуйте]/[Добрый день]/[Доброго времени суток]. Увидел вас в чате...';
    if (elements.chatCountInput) elements.chatCountInput.value = '6';
    if (elements.waitMinInput) elements.waitMinInput.value = '1';
    if (elements.waitMaxInput) elements.waitMaxInput.value = '1';
    
    // Reset radio buttons
    if (elements.sendModeRadios) elements.sendModeRadios[0].checked = true;
    if (elements.workModeRadios) elements.workModeRadios[0].checked = true;
    
    // Reset checkboxes
    if (elements.joinChatsCheckbox) elements.joinChatsCheckbox.checked = false;
    if (elements.repeatBroadcastCheckbox) elements.repeatBroadcastCheckbox.checked = false;
    if (elements.hideSourceCheckbox) elements.hideSourceCheckbox.checked = false;
    if (elements.processAfterPostCheckbox) elements.processAfterPostCheckbox.checked = false;
    if (elements.deleteAfterCheckbox) elements.deleteAfterCheckbox.checked = false;
    if (elements.leaveChatsCheckbox) elements.leaveChatsCheckbox.checked = false;
    if (elements.useFloodCheckCheckbox) elements.useFloodCheckCheckbox.checked = false;
    
    // Reset selected file
    state.selectedFile = null;
    if (elements.selectedFileName) elements.selectedFileName.textContent = 'No file chosen';
    if (elements.chatLinksFileInput) elements.chatLinksFileInput.value = '';
    
    // Reset document
    state.documentFile = null;
    if (elements.documentPreview) elements.documentPreview.style.display = 'none';
    
    // Reset selected accounts
    state.selectedAccounts = [];
    renderSelectedAccounts();
    
    // Reset UI
    updateSendModeUI();
    updateWorkModeUI();
    if (elements.repeatIntervalContainer) elements.repeatIntervalContainer.style.display = 'none';
  }
  
  // Show modal
  function showModal(modalId) {
    const modalContainer = document.getElementById('modal-container');
    const modal = document.getElementById(modalId);
    
    if (modalContainer && modal) {
      modalContainer.classList.add('active');
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }
  
  // Hide modal
  function hideModal(modalId) {
    const modalContainer = document.getElementById('modal-container');
    const modal = document.getElementById(modalId);
    
    if (modalContainer && modal) {
      modalContainer.classList.remove('active');
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
  
  // Show toast notification
  function showToast(message, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      document.body.appendChild(toast);
      
      // Add toast styles if not already in CSS
      if (!document.querySelector('style#toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
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
    }
    
    toast.textContent = message;
    toast.className = type;
    
    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  }
  
  // Format file size
  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + ' bytes';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
  }
  
  // Initialize when DOM is loaded
  init();
});