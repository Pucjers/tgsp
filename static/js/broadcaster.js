document.addEventListener("DOMContentLoaded", function() {
  const state = {
      selectedAccounts: [],
      accountsData: [],
      selectedFile: null,
      documentFile: null,
      sendMode: 'single',
      workMode: 'group'
  };

  // Elements
  const elements = {
      // Buttons
      addEnhancedBtn: document.getElementById('add-enhanced-broadcast-btn'),
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
      proxyWarningOverlay: document.getElementById('proxy-warning-overlay')
  };

  // API functions
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

      async uploadDocument(file) {
          try {
              const formData = new FormData();
              formData.append('image', file);

              const response = await fetch('/api/broadcaster/upload-image', {
                  method: 'POST',
                  body: formData
              });

              if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || 'Failed to upload file');
              }

              return await response.json();
          } catch (error) {
              console.error('Error uploading document:', error);
              showToast('Error uploading document: ' + error.message, 'error');
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
      }
  };

  // Initialize
  function initEnhancedBroadcaster() {
      // Add enhanced broadcast button to the existing broadcasting controls
      const broadcastingControls = document.querySelector('.broadcasting-controls');
      if (broadcastingControls) {
          const addEnhancedBtn = document.createElement('button');
          addEnhancedBtn.id = 'add-enhanced-broadcast-btn';
          addEnhancedBtn.className = 'btn btn-secondary';
          addEnhancedBtn.innerHTML = '<i class="fas fa-bolt"></i> Enhanced Broadcaster';
          broadcastingControls.appendChild(addEnhancedBtn);
          
          elements.addEnhancedBtn = addEnhancedBtn;
      }

      // Attach event listeners
      attachEventListeners();
      
      // Load account lists
      loadAccountLists();
  }

  // Event listeners
  function attachEventListeners() {
      // Open enhanced broadcaster modal
      if (elements.addEnhancedBtn) {
          elements.addEnhancedBtn.addEventListener('click', () => {
              showModal('enhanced-broadcaster-modal');
          });
      }

      // Send mode radio buttons
      elements.sendModeRadios.forEach(radio => {
          radio.addEventListener('change', (e) => {
              state.sendMode = e.target.value;
              updateSendModeUI();
          });
      });

      // Work mode radio buttons
      elements.workModeRadios.forEach(radio => {
          radio.addEventListener('change', (e) => {
              state.workMode = e.target.value;
              updateWorkModeUI();
          });
      });

      // Repeat broadcast checkbox
      elements.repeatBroadcastCheckbox.addEventListener('change', (e) => {
          elements.repeatIntervalContainer.style.display = e.target.checked ? 'flex' : 'none';
      });

      // File input change
      elements.chatLinksFileInput.addEventListener('change', (e) => {
          if (e.target.files.length > 0) {
              state.selectedFile = e.target.files[0];
              elements.selectedFileName.textContent = state.selectedFile.name;
          }
      });

      // Account selector
      elements.accountSelectorBtn.addEventListener('click', () => {
          loadAccounts();
          showModal('account-selection-modal');
      });

      // Confirm accounts
      elements.confirmAccountsBtn.addEventListener('click', () => {
          hideModal('account-selection-modal');
          renderSelectedAccounts();
      });

      // Document upload
      elements.addDocumentBtn.addEventListener('click', () => {
          showModal('document-upload-modal');
      });

      // Document file input
      elements.documentFileInput.addEventListener('change', (e) => {
          if (e.target.files.length > 0) {
              handleDocumentSelection(e.target.files[0]);
          }
      });

      // Remove document
      elements.removeDocumentBtn.addEventListener('click', () => {
          state.documentFile = null;
          elements.documentPreview.style.display = 'none';
      });

      // Add document confirm
      elements.addDocumentConfirmBtn.addEventListener('click', async () => {
          if (state.documentFile) {
              // Upload the document
              const result = await api.uploadDocument(state.documentFile);
              if (result && result.url) {
                  hideModal('document-upload-modal');
                  showToast('Document added successfully', 'success');
              }
          } else {
              showToast('Please select a document', 'error');
          }
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
              elements.documentFileInput.click();
          });
      }

      // Create task
      elements.createTaskBtn.addEventListener('click', () => {
          createTask(false);
      });

      // Create and run task
      elements.createAndRunTaskBtn.addEventListener('click', () => {
          createTask(true);
      });

      // Proxy warning confirm
      elements.proxyWarningConfirmBtn.addEventListener('click', () => {
          elements.proxyWarningOverlay.style.display = 'none';
      });

      // Account filter change
      elements.accountFilter.addEventListener('change', (e) => {
          loadAccounts(e.target.value);
      });
  }

  // Load account lists
  async function loadAccountLists() {
      const lists = await api.getAccountLists();
      
      // Populate account filter dropdown
      let options = '<option value="all">All Accounts</option>';
      lists.forEach(list => {
          options += `<option value="${list.id}">${list.name}</option>`;
      });
      elements.accountFilter.innerHTML = options;
  }

  // Load accounts
  async function loadAccounts(listId = 'all') {
      const accounts = await api.getAccounts(listId);
      state.accountsData = accounts;
      
      // Render accounts list
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
      
      elements.accountsList.innerHTML = html || '<div class="p-4 text-center text-gray-500">No accounts found</div>';
      
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
      elements.singleMessageContainer.style.display = state.sendMode === 'single' ? 'block' : 'none';
  }
  
  // Update work mode UI
  function updateWorkModeUI() {
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
          elements.proxyWarningOverlay.style.display = 'flex';
          return;
      }
      
      // Create task data
      const taskData = {
          name: elements.taskNameInput.value,
          mode: state.sendMode,
          workMode: state.workMode,
          message: elements.messageTextArea.value,
          chatCount: parseInt(elements.chatCountInput.value),
          waitPeriod: {
              min: parseInt(elements.waitMinInput.value),
              max: parseInt(elements.waitMaxInput.value)
          },
          hideSource: elements.hideSourceCheckbox.checked,
          repeatBroadcast: elements.repeatBroadcastCheckbox.checked,
          joinChats: elements.joinChatsCheckbox.checked,
          processAfterPost: elements.processAfterPostCheckbox.checked,
          deleteAfter: elements.deleteAfterCheckbox.checked,
          leaveChats: elements.leaveChatsCheckbox.checked,
          useFloodCheck: elements.useFloodCheckCheckbox.checked,
          selectedAccounts: state.selectedAccounts.map(acc => acc.id)
      };
      
      // Add file if selected
      if (state.selectedFile) {
          // Upload file logic would go here
          // taskData.chatListFile = uploadedFileUrl;
      }
      
      // Create task
      const result = await api.createTask(taskData, autoRun);
      
      if (result && result.success) {
          showToast(autoRun ? 'Task created and started' : 'Task created successfully', 'success');
          hideModal('enhanced-broadcaster-modal');
          
          // Reset form
          resetForm();
      }
  }
  
  // Validate inputs
  function validateInputs() {
      if (!elements.taskNameInput.value.trim()) {
          showToast('Please enter a task name', 'error');
          elements.taskNameInput.focus();
          return false;
      }
      
      if (state.sendMode === 'single' && !elements.messageTextArea.value.trim()) {
          showToast('Please enter a message', 'error');
          elements.messageTextArea.focus();
          return false;
      }
      
      if (state.selectedAccounts.length === 0) {
          showToast('Please select at least one account', 'error');
          return false;
      }
      
      if (state.workMode === 'group') {
          const chatCount = parseInt(elements.chatCountInput.value);
          if (isNaN(chatCount) || chatCount < 1 || chatCount > 30) {
              showToast('Chat count must be between 1 and 30', 'error');
              elements.chatCountInput.focus();
              return false;
          }
      }
      
      if (elements.repeatBroadcastCheckbox.checked) {
          const waitMin = parseInt(elements.waitMinInput.value);
          const waitMax = parseInt(elements.waitMaxInput.value);
          
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
      elements.taskNameInput.value = 'My task';
      elements.messageTextArea.value = '[Здравствуйте]/[Добрый день]/[Доброго времени суток]. Увидел вас в чате...';
      elements.chatCountInput.value = '6';
      elements.waitMinInput.value = '1';
      elements.waitMaxInput.value = '1';
      
      // Reset radio buttons
      elements.sendModeRadios[0].checked = true;
      elements.workModeRadios[0].checked = true;
      
      // Reset checkboxes
      elements.joinChatsCheckbox.checked = false;
      elements.repeatBroadcastCheckbox.checked = false;
      elements.hideSourceCheckbox.checked = false;
      elements.processAfterPostCheckbox.checked = false;
      elements.deleteAfterCheckbox.checked = false;
      elements.leaveChatsCheckbox.checked = false;
      elements.useFloodCheckCheckbox.checked = false;
      
      // Reset selected file
      state.selectedFile = null;
      elements.selectedFileName.textContent = 'No file chosen';
      elements.chatLinksFileInput.value = '';
      
      // Reset document
      state.documentFile = null;
      elements.documentPreview.style.display = 'none';
      
      // Reset selected accounts
      state.selectedAccounts = [];
      renderSelectedAccounts();
      
      // Reset UI
      updateSendModeUI();
      updateWorkModeUI();
      elements.repeatIntervalContainer.style.display = 'none';
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
  initEnhancedBroadcaster();
});