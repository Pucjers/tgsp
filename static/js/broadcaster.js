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
    selectAllAccountsCheckbox: document.getElementById('select-all-accounts'),

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
    injectStyles();
    loadAccountLists();
    loadTasks();
    attachEventListeners();
    updateStatsCounters();
  }
  
  // Load account lists and populate dropdowns
  async function loadAccountLists() {
    const lists = await api.getAccountLists();
    
    if (!lists || !lists.length) return;
    
    // Populate account filter dropdown
    if (elements.accountFilter) {
      let options = '<option value="all">Все аккаунты</option>';
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
      const startedDate = task.startedAt ? new Date(task.startedAt).toLocaleString() : 'Не запущена';
      const completedDate = task.completedAt ? new Date(task.completedAt).toLocaleString() : 'Не завершена';
      
      const progress = task.progress || { total: 0, completed: 0, errors: 0 };
      const progressPercentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
      
      let statusBadge = '';
      let actionButtons = '';
      
      switch (task.status) {
        case 'created':
          statusBadge = '<span class="status-badge unverified">Создана</span>';
          actionButtons = `
            <button class="btn btn-icon btn-text start-task-btn" data-id="${task.id}" title="Запустить задачу">
              <i class="fas fa-play"></i>
            </button>
            <button class="btn btn-icon btn-danger delete-task-btn" data-id="${task.id}" title="Удалить задачу">
              <i class="fas fa-trash"></i>
            </button>
          `;
          break;
        case 'running':
          statusBadge = '<span class="status-badge ok">Выполняется</span>';
          actionButtons = `
            <button class="btn btn-icon btn-text stop-task-btn" data-id="${task.id}" title="Остановить задачу">
              <i class="fas fa-stop"></i>
            </button>
          `;
          break;
        case 'completed':
          statusBadge = '<span class="status-badge ok">Завершена</span>';
          actionButtons = `
            <button class="btn btn-icon btn-text restart-task-btn" data-id="${task.id}" title="Перезапустить задачу">
              <i class="fas fa-redo"></i>
            </button>
            <button class="btn btn-icon btn-danger delete-task-btn" data-id="${task.id}" title="Удалить задачу">
              <i class="fas fa-trash"></i>
            </button>
          `;
          break;
        case 'stopped':
          statusBadge = '<span class="status-badge temp-block">Остановлена</span>';
          actionButtons = `
            <button class="btn btn-icon btn-text restart-task-btn" data-id="${task.id}" title="Перезапустить задачу">
              <i class="fas fa-redo"></i>
            </button>
            <button class="btn btn-icon btn-danger delete-task-btn" data-id="${task.id}" title="Удалить задачу">
              <i class="fas fa-trash"></i>
            </button>
          `;
          break;
        case 'error':
          statusBadge = '<span class="status-badge blocked">Ошибка</span>';
          actionButtons = `
            <button class="btn btn-icon btn-text restart-task-btn" data-id="${task.id}" title="Перезапустить задачу">
              <i class="fas fa-redo"></i>
            </button>
            <button class="btn btn-icon btn-danger delete-task-btn" data-id="${task.id}" title="Удалить задачу">
              <i class="fas fa-trash"></i>
            </button>
          `;
          break;
        default:
          statusBadge = `<span class="status-badge unverified">${task.status || 'Неизвестно'}</span>`;
          actionButtons = `
            <button class="btn btn-icon btn-danger delete-task-btn" data-id="${task.id}" title="Удалить задачу">
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
                Режим: ${
                  task.mode === 'single' ? 'Одно сообщение' : 
                  task.mode === 'file' ? 'Сообщения из файла' : 
                  'Репосты из канала'
                }, 
                Способ: ${
                  task.workMode === 'group' ? 'В группу чатов' : 'В один чат'
                }
              </div>
            </div>
          </td>
          <td>
            ${statusBadge}
          </td>
          <td>
            <div>Создана: ${new Date(task.createdAt).toLocaleString()}</div>
            <div>Запущена: ${startedDate}</div>
            <div>Завершена: ${completedDate}</div>
          </td>
          <td>
            <div class="task-progress">
              <div>Прогресс: ${progress.completed}/${progress.total}</div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progressPercentage}%"></div>
              </div>
              <div>Ошибок: ${progress.errors}</div>
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
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const result = await api.startTask(taskId);
        
        if (result && result.success) {
          showToast('Задача успешно запущена', 'success');
          await loadTasks();
        } else {
          button.disabled = false;
          button.innerHTML = '<i class="fas fa-play"></i>';
        }
      });
    });
    
    document.querySelectorAll('.stop-task-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const taskId = button.dataset.id;
        if (!taskId) return;
        
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const result = await api.stopTask(taskId);
        
        if (result && result.success) {
          showToast('Задача остановлена', 'success');
          await loadTasks();
        } else {
          button.disabled = false;
          button.innerHTML = '<i class="fas fa-stop"></i>';
        }
      });
    });
    
    document.querySelectorAll('.restart-task-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const taskId = button.dataset.id;
        if (!taskId) return;
        
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const result = await api.startTask(taskId);
        
        if (result && result.success) {
          showToast('Задача перезапущена', 'success');
          await loadTasks();
        } else {
          button.disabled = false;
          button.innerHTML = '<i class="fas fa-redo"></i>';
        }
      });
    });
    
    document.querySelectorAll('.delete-task-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const taskId = button.dataset.id;
        if (!taskId) return;
        
        if (!confirm('Вы уверены, что хотите удалить эту задачу?')) return;
        
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const result = await api.deleteTask(taskId);
        
        if (result && result.success) {
          showToast('Задача удалена', 'success');
          await loadTasks();
        } else {
          button.disabled = false;
          button.innerHTML = '<i class="fas fa-trash"></i>';
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
    
    // Animate the counters
    animateCounter(elements.todayCounter, todayCount);
    animateCounter(elements.yesterdayCounter, yesterdayCount);
    animateCounter(elements.totalCounter, totalCount);
  }
  function animateCounter(element, targetValue) {
    if (!element) return;
    
    const duration = 1000;
    const startValue = parseInt(element.textContent) || 0;
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easeOutExpo for smooth animation
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      const currentValue = Math.floor(startValue + (targetValue - startValue) * easeProgress);
      element.textContent = currentValue;
      
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = targetValue;
      }
    }
    
    requestAnimationFrame(updateCounter);
  }
  // Attach event listeners
  function attachEventListeners() {
    // New task button
    if (elements.newTaskBtn) {
      elements.newTaskBtn.addEventListener('click', () => {
        showModal('enhanced-broadcaster-modal');
      });
      
      // Also wire up the empty state button
      const emptyAddTaskBtn = document.getElementById('empty-add-task-btn');
      if (emptyAddTaskBtn) {
        emptyAddTaskBtn.addEventListener('click', () => {
          showModal('enhanced-broadcaster-modal');
        });
      }
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
            const file = e.target.files[0];
            elements.selectedFileName.textContent = file.name;
            
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('file', file);
            
            // Upload the file immediately when selected
            fetch('/api/broadcaster/upload-chat-list', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Store the URL in the state
                    state.chatListUrl = data.url;
                    showToast('File uploaded successfully: ' + file.name, 'success');
                    console.log('File uploaded, URL:', data.url);
                } else {
                    showToast('Error uploading file: ' + (data.error || 'Unknown error'), 'error');
                }
            })
            .catch(error => {
                console.error('Error uploading file:', error);
                showToast('Error uploading file: Network error', 'error');
            });
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

    // Select All Accounts checkbox
    if (elements.selectAllAccountsCheckbox) {
      elements.selectAllAccountsCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.account-checkbox');
        checkboxes.forEach(checkbox => {
          checkbox.checked = e.target.checked;
          const accountId = checkbox.dataset.id;
          const card = checkbox.closest('.account-card');
          
          toggleAccountSelection(accountId, e.target.checked);
          if (card) {
            if (e.target.checked) {
              card.classList.add('selected');
            } else {
              card.classList.remove('selected');
            }
          }
        });
      });
    }

    // Account filter change
    if (elements.accountFilter) {
      elements.accountFilter.addEventListener('change', (e) => {
        // Reset select all checkbox when changing filter
        if (elements.selectAllAccountsCheckbox) {
          elements.selectAllAccountsCheckbox.checked = false;
        }
        loadAccounts(e.target.value);
      });
    }

    // Confirm accounts with improved UI feedback
    if (elements.confirmAccountsBtn) {
      elements.confirmAccountsBtn.addEventListener('click', () => {
        hideModal('account-selection-modal');
        renderSelectedAccounts();
        
        // Update the select accounts button appearance
        if (state.selectedAccounts.length > 0) {
          elements.accountSelectorBtn.textContent = `Выбрано ${state.selectedAccounts.length} аккаунтов`;
          elements.accountSelectorBtn.classList.add('accounts-selected');
        } else {
          elements.accountSelectorBtn.textContent = 'Выбрать аккаунты';
          elements.accountSelectorBtn.classList.remove('accounts-selected');
        }
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

    // Create task button
    if (elements.createTaskBtn) {
      elements.createTaskBtn.addEventListener('click', () => {
        createTask(false);
      });
    }

    // Create and run task button
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
    
    // Browse button in document upload modal
    const browseBtn = document.querySelector('.browse-btn');
    if (browseBtn && elements.documentFileInput) {
        browseBtn.addEventListener('click', () => {
            elements.documentFileInput.click();
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
      elements.accountsList.innerHTML = '<div class="empty-accounts-message">Нет доступных аккаунтов</div>';
      // Update select all checkbox state
      if (elements.selectAllAccountsCheckbox) {
        elements.selectAllAccountsCheckbox.checked = false;
        elements.selectAllAccountsCheckbox.disabled = true;
      }
      return;
    }
    
    // Enable select all checkbox
    if (elements.selectAllAccountsCheckbox) {
      elements.selectAllAccountsCheckbox.disabled = false;
    }
    
    let html = '';
    accounts.forEach(account => {
      const isSelected = state.selectedAccounts.some(acc => acc.id === account.id);
      html += `
        <div class="account-card ${isSelected ? 'selected' : ''}" data-id="${account.id}">
          <div class="account-card-content">
            <div class="account-avatar">
              ${account.avatar 
                ? `<img src="${account.avatar}" alt="${account.name}" class="account-avatar-img">`
                : `<span class="account-avatar-placeholder"><i class="fas fa-user"></i></span>`
              }
            </div>
            <div class="account-details">
              <div class="account-name">${account.name}</div>
              <div class="account-phone">${account.phone || ''}</div>
            </div>
            <div class="account-checkbox-wrapper">
              <input type="checkbox" ${isSelected ? 'checked' : ''} data-id="${account.id}" class="account-checkbox">
            </div>
          </div>
        </div>
      `;
    });
    
    elements.accountsList.innerHTML = html;
    
    // Update select all checkbox state
    updateSelectAllCheckboxState();
    
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
        card.classList.toggle('selected');
        
        // Update the select all checkbox state
        updateSelectAllCheckboxState();
      });
    });
    function updateSelectAllCheckboxState() {
      if (!elements.selectAllAccountsCheckbox) return;
      
      const checkboxes = document.querySelectorAll('.account-checkbox');
      const checkedCount = document.querySelectorAll('.account-checkbox:checked').length;
      
      if (checkboxes.length === 0) {
        elements.selectAllAccountsCheckbox.checked = false;
        elements.selectAllAccountsCheckbox.disabled = true;
      } else {
        elements.selectAllAccountsCheckbox.disabled = false;
        elements.selectAllAccountsCheckbox.checked = checkedCount > 0 && checkedCount === checkboxes.length;
        // Set indeterminate state if some (but not all) are checked
        elements.selectAllAccountsCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
      }
    }
    // Attach event listeners to checkboxes
    document.querySelectorAll('.account-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const accountId = e.target.dataset.id;
        const card = e.target.closest('.account-card');
        
        toggleAccountSelection(accountId, e.target.checked);
        if (card) {
          card.classList.toggle('selected', e.target.checked);
        }
        
        // Update the select all checkbox state
        updateSelectAllCheckboxState();
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
    if (!elements.selectedAccountsContainer) return;
    
    if (state.selectedAccounts.length === 0) {
      elements.selectedAccountsContainer.innerHTML = '<div class="no-accounts-selected">Аккаунты не выбраны</div>';
      return;
    }
    
    let html = '';
    state.selectedAccounts.forEach(account => {
      html += `
        <div class="selected-account-card" data-id="${account.id}">
          <div class="selected-account-content">
            <div class="selected-account-avatar">
              ${account.avatar 
                ? `<img src="${account.avatar}" alt="${account.name}" class="selected-account-img">`
                : `<span class="selected-account-placeholder"><i class="fas fa-user"></i></span>`
              }
            </div>
            <div class="selected-account-details">
              <div class="selected-account-name">${account.name}</div>
              <div class="selected-account-phone">${account.phone || ''}</div>
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
      showToast('Размер файла превышает лимит в 1МБ', 'error');
      return;
    }
    
    state.documentFile = file;
    elements.documentPreview.style.display = 'flex';
    elements.documentName.textContent = file.name;
    elements.documentSize.textContent = formatFileSize(file.size);
    
    // Set icon based on file type
    const fileType = file.type.split('/')[0];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (fileType === 'image') {
      elements.documentIcon.className = 'fas fa-image text-blue-500';
    } else if (fileExtension === 'pdf') {
      elements.documentIcon.className = 'fas fa-file-pdf text-red-500';
    } else if (['doc', 'docx'].includes(fileExtension)) {
      elements.documentIcon.className = 'fas fa-file-word text-blue-700';
    } else if (fileExtension === 'txt') {
      elements.documentIcon.className = 'fas fa-file-alt text-gray-500';
    } else {
      elements.documentIcon.className = 'fas fa-file text-gray-500';
    }
  }
  
  // Update send mode UI
  function updateSendModeUI() {
    if (!elements.singleMessageContainer) return;
    
    // Get all mode containers
    const fileMessageContainer = document.getElementById('file-message-container');
    const repostMessageContainer = document.getElementById('repost-message-container');
    
    // Default: hide all containers
    if (elements.singleMessageContainer) elements.singleMessageContainer.style.display = 'none';
    if (fileMessageContainer) fileMessageContainer.style.display = 'none';
    if (repostMessageContainer) repostMessageContainer.style.display = 'none';
    
    // Show the selected container
    switch (state.sendMode) {
      case 'single':
        if (elements.singleMessageContainer) elements.singleMessageContainer.style.display = 'block';
        break;
      case 'file':
        if (fileMessageContainer) fileMessageContainer.style.display = 'block';
        break;
      case 'repost':
        if (repostMessageContainer) repostMessageContainer.style.display = 'block';
        break;
    }
  }
  
  // Update work mode UI
  function updateWorkModeUI() {
    if (!elements.groupChatContainer) return;
    
    // Get single chat container
    const singleChatContainer = document.getElementById('single-chat-container');
    
    // Default: hide all containers
    if (elements.groupChatContainer) elements.groupChatContainer.style.display = 'none';
    if (singleChatContainer) singleChatContainer.style.display = 'none';
    
    // Show the selected container
    switch (state.workMode) {
      case 'group':
        if (elements.groupChatContainer) elements.groupChatContainer.style.display = 'block';
        break;
      case 'single':
        if (singleChatContainer) singleChatContainer.style.display = 'block';
        break;
    }
  }
  
  // Create task
  async function createTask(autoRun = false) {
    // Validate inputs
    if (!validateInputs()) {
        return;
    }
    
    // Create task data object with all parameters
    const taskData = {
        name: elements.taskNameInput ? elements.taskNameInput.value : 'New Task',
        mode: state.sendMode,
        workMode: state.workMode,
        message: elements.messageTextArea ? elements.messageTextArea.value : '',
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
        selectedAccounts: state.selectedAccounts.map(acc => acc.id),
        auto_run: autoRun
    };
    
    // Important: Include the chat list URL if available
    if (state.chatListUrl) {
        console.log('Including chat list URL in task:', state.chatListUrl);
        taskData.chatListUrl = state.chatListUrl;
    } else if (state.selectedFile) {
        // If file was selected but not yet uploaded, show warning
        showToast('Please wait for file upload to complete', 'warning');
        return;
    }
    
    // Create task via API
    try {
        const response = await fetch('/api/broadcaster/create-task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskData),
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(autoRun ? 'Task created and started' : 'Task created successfully', 'success');
            hideModal('enhanced-broadcaster-modal');
            
            // Reload tasks
            loadTasks();
            
            // Reset form
            resetForm();
        } else {
            showToast('Error creating task: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error creating task:', error);
        showToast('Error creating task: Network error', 'error');
    }
}
  
  // Validate inputs
  function validateInputs() {
    if (elements.taskNameInput && !elements.taskNameInput.value.trim()) {
      showToast('Пожалуйста, введите название задачи', 'error');
      elements.taskNameInput.focus();
      return false;
    }
    
    if (state.sendMode === 'single' && elements.messageTextArea && !elements.messageTextArea.value.trim()) {
      showToast('Пожалуйста, введите текст сообщения', 'error');
      elements.messageTextArea.focus();
      return false;
    }
    
    if (state.selectedAccounts.length === 0) {
      showToast('Пожалуйста, выберите хотя бы один аккаунт', 'error');
      return false;
    }
    
    if (state.workMode === 'group' && elements.chatCountInput) {
      const chatCount = parseInt(elements.chatCountInput.value);
      if (isNaN(chatCount) || chatCount < 1 || chatCount > 30) {
        showToast('Количество чатов должно быть от 1 до 30', 'error');
        elements.chatCountInput.focus();
        return false;
      }
    }
    
    if (elements.repeatBroadcastCheckbox && elements.repeatBroadcastCheckbox.checked) {
      const waitMin = elements.waitMinInput ? parseInt(elements.waitMinInput.value) : 0;
      const waitMax = elements.waitMaxInput ? parseInt(elements.waitMaxInput.value) : 0;
      
      if (isNaN(waitMin) || waitMin < 1) {
        showToast('Минимальное время ожидания должно быть не менее 1 минуты', 'error');
        elements.waitMinInput.focus();
        return false;
      }
      
      if (isNaN(waitMax) || waitMax < waitMin) {
        showToast('Максимальное время ожидания должно быть больше или равно минимальному', 'error');
        elements.waitMaxInput.focus();
        return false;
      }
    }
    
    return true;
  }
  
  
  // Reset form
  function resetForm() {
    if (elements.taskNameInput) elements.taskNameInput.value = 'Новая задача';
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
    if (elements.selectedFileName) elements.selectedFileName.textContent = 'Файл не выбран';
    if (elements.chatLinksFileInput) elements.chatLinksFileInput.value = '';
    
    // Reset document
    state.documentFile = null;
    if (elements.documentPreview) elements.documentPreview.style.display = 'none';
    
    // Reset selected accounts
    state.selectedAccounts = [];
    renderSelectedAccounts();
    
    // Reset account selector button
    if (elements.accountSelectorBtn) {
      elements.accountSelectorBtn.textContent = 'Выбрать аккаунты';
      elements.accountSelectorBtn.classList.remove('accounts-selected');
    }
    
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
      
      // Add fade-in animation
      modal.style.opacity = '0';
      modal.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        modal.style.opacity = '1';
        modal.style.transform = 'translateY(0)';
      }, 10);
    }
  }
  function injectStyles() {
    const broadcasterStyles = document.createElement('style');
    broadcasterStyles.textContent = `
      /* Enhanced Broadcaster Modal Styles */
      /* These styles improve the modal appearance and functionality */
      
      /* Wider modal */
      .wider-modal {
          max-width: 700px !important;
          width: 90% !important;
      }
      
      /* Input container */
      .input-container {
          position: relative;
          width: 100%;
      }
      
      /* File upload container */
      .file-upload-container {
          display: flex;
          align-items: center;
          gap: 12px;
      }
      
      .file-upload-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
          background-color: var(--primary-color);
          color: white;
          border-radius: var(--border-radius);
          cursor: pointer;
          font-weight: 500;
          transition: var(--transition);
      }
      
      .file-upload-btn:hover {
          background-color: var(--primary-hover);
      }
      
      .file-name {
          color: var(--text-light);
      }
      
      .hidden-input {
          display: none;
      }
      
      /* Radio and checkbox options */
      .radio-options, .checkbox-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
      }
      
      .radio-option, .checkbox-option {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          cursor: pointer;
      }
      
      .radio-option input, .checkbox-option input {
          margin-top: 3px;
      }
      
      /* Message container */
      .message-container {
          margin-left: 24px;
          margin-top: 8px;
          margin-bottom: 12px;
      }
      
      .message-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          resize: vertical;
          min-height: 100px;
          font-family: inherit;
          font-size: inherit;
          transition: var(--transition);
      }
      
      .message-textarea:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(62, 142, 208, 0.2);
      }
      
      .document-btn-container {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
      }
      
      .document-btn {
          background: none;
          border: none;
          color: var(--primary-color);
          cursor: pointer;
          font-size: 13px;
          padding: 6px 10px;
          border-radius: var(--border-radius);
          transition: var(--transition);
      }
      
      .document-btn:hover {
          background-color: rgba(62, 142, 208, 0.1);
      }
      
      /* Chat count container */
      .chat-count-container {
          margin-left: 24px;
          margin-top: 8px;
          margin-bottom: 12px;
      }
      
      .chat-count-input {
          display: flex;
          align-items: center;
          gap: 10px;
      }
      
      .number-input {
          width: 60px;
          padding: 6px 8px;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          transition: var(--transition);
      }
      
      .number-input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(62, 142, 208, 0.2);
      }
      
      .help-text {
          font-size: 12px;
          color: var(--text-light);
          margin-top: 6px;
          margin-left: 4px;
      }
      
      /* Repeat interval */
      .repeat-interval {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: 24px;
          margin-top: 8px;
          padding: 8px 12px;
          background-color: rgba(0, 0, 0, 0.02);
          border-radius: var(--border-radius);
      }
      
      /* Account selection */
      .account-selection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          padding-top: 15px;
          border-top: 1px solid var(--border-color);
      }
      
      .select-accounts-btn {
          background-color: var(--primary-color);
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: var(--border-radius);
          font-weight: 500;
          cursor: pointer;
          transition: var(--transition);
      }
      
      .select-accounts-btn:hover {
          background-color: var(--primary-hover);
      }
      
      .select-accounts-btn.accounts-selected {
          background-color: var(--success-color);
      }
      
      .selected-accounts {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
          margin-top: 15px;
      }
      
      .empty-accounts-message {
        padding: 30px 20px;
        text-align: center;
        color: var(--text-light);
      }
      
      .no-accounts-selected {
        padding: 15px;
        text-align: center;
        color: var(--text-light);
        font-style: italic;
      }
      
      /* Account selection modal */
      .account-filter-container {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
      }
      
      .account-filter {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
      }
      
      .accounts-selection-list {
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 10px;
      }
      
      .account-card {
          padding: 10px;
          border-radius: var(--border-radius);
          border: 1px solid var(--border-color);
          margin-bottom: 8px;
          transition: var(--transition);
          cursor: pointer;
      }
      
      .account-card:hover {
          border-color: var(--primary-color);
          background-color: rgba(62, 142, 208, 0.05);
      }
      
      .account-card.selected {
          border-color: var(--primary-color);
          background-color: rgba(62, 142, 208, 0.1);
      }
      
      .account-card-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .account-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        overflow: hidden;
        background-color: var(--light-bg);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .account-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .account-avatar-placeholder {
        color: var(--text-light);
      }
      
      .account-details {
        flex: 1;
      }
      
      .account-name {
        font-weight: 500;
      }
      
      .account-phone {
        font-size: 12px;
        color: var(--text-light);
      }
      
      .account-checkbox-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .selected-account-card {
        padding: 10px;
        border-radius: var(--border-radius);
        border: 1px solid var(--border-color);
        transition: var(--transition);
      }
      
      .selected-account-card:hover {
        background-color: rgba(0, 0, 0, 0.02);
      }
      
      .selected-account-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .selected-account-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        overflow: hidden;
        background-color: var(--light-bg);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .selected-account-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .selected-account-placeholder {
        color: var(--text-light);
      }
      
      .selected-account-details {
        flex: 1;
      }
      
      .selected-account-name {
        font-weight: 500;
      }
      
      .selected-account-phone {
        font-size: 12px;
        color: var(--text-light);
      }
      
      /* Dark theme adjustments */
      [data-theme="dark"] .document-upload-area {
          background-color: var(--bg-white);
      }
      
      [data-theme="dark"] .repeat-interval {
          background-color: rgba(255, 255, 255, 0.05);
      }
      
      [data-theme="dark"] .document-btn:hover {
          background-color: rgba(62, 142, 208, 0.2);
      }
      
      [data-theme="dark"] .remove-document-btn:hover {
          background-color: rgba(241, 70, 104, 0.2);
      }
      
      [data-theme="dark"] .cancel-btn:hover {
          background-color: rgba(255, 255, 255, 0.1);
      }
      
      [data-theme="dark"] .account-card:hover {
          background-color: rgba(62, 142, 208, 0.15);
      }
      
      [data-theme="dark"] .account-card.selected {
          background-color: rgba(62, 142, 208, 0.2);
      }
      
      [data-theme="dark"] .selected-account-card:hover {
          background-color: rgba(255, 255, 255, 0.05);
      }
    `;
    document.head.appendChild(broadcasterStyles);
  }
  // Hide modal
  function hideModal(modalId) {
    const modalContainer = document.getElementById('modal-container');
    const modal = document.getElementById(modalId);
    
    if (modalContainer && modal) {
      // Add fade-out animation
      modal.style.opacity = '0';
      modal.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        modalContainer.classList.remove('active');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Reset the styles after animation
        setTimeout(() => {
          modal.style.opacity = '';
          modal.style.transform = '';
        }, 300);
      }, 200);
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
            padding: 12px 24px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 9999;
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            max-width: 300px;
          }
          #toast.visible {
            transform: translateY(0);
            opacity: 1;
          }
          #toast.info { background-color: var(--primary-color); }
          #toast.success { background-color: var(--success-color); }
          #toast.error { background-color: var(--danger-color); }
          #toast.warning { background-color: #f39c12; }
          
          /* Dark theme adjustments */
          [data-theme="dark"] #toast {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }
        `;
        document.head.appendChild(style);
      }
    }
    
    // Add icon based on type
    let icon = '';
    switch (type) {
      case 'success':
        icon = '<i class="fas fa-check-circle mr-2"></i>';
        break;
      case 'error':
        icon = '<i class="fas fa-exclamation-circle mr-2"></i>';
        break;
      case 'warning':
        icon = '<i class="fas fa-exclamation-triangle mr-2"></i>';
        break;
      case 'info':
      default:
        icon = '<i class="fas fa-info-circle mr-2"></i>';
        break;
    }
    
    toast.innerHTML = icon + message;
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
      return bytes + ' байт';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' КБ';
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    }
  }
  
  // Initialize when DOM is loaded
  init();
});