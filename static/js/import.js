/**
 * Telegram Account Import Implementation
 * 
 * This script handles the implementation of two account import methods:
 * 1. Session + JSON import
 * 2. Phone number import with verification code
 * 
 * Both methods require proxy integration.
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const elements = {
        // Session Import
        sessionForm: document.getElementById('session-import-form'),
        sessionFileInput: document.getElementById('session-file-input'),
        sessionUploadArea: document.getElementById('session-upload-area'),
        sessionFileInfo: document.getElementById('session-file-info'),
        jsonFileInput: document.getElementById('json-file-input'),
        jsonUploadArea: document.getElementById('json-upload-area'),
        jsonFileInfo: document.getElementById('json-file-info'),
        importSessionBtn: document.getElementById('import-session-btn'),
        sessionProxyDisplay: document.getElementById('session-selected-proxy'),
        sessionAccountList: document.getElementById('session-account-list'),
        sessionAccountName: document.getElementById('session-account-name'),
        
        // Phone Import
        phoneForm: document.getElementById('phone-import-form'),
        phoneInput: document.getElementById('phone'),
        nameInput: document.getElementById('name'),
        usernameInput: document.getElementById('username'),
        verificationCodeInput: document.getElementById('verification-code'),
        verificationCodeRow: document.getElementById('verification-code-row'),
        phoneImportFooter: document.getElementById('phone-import-footer'),
        phoneVerifyFooter: document.getElementById('phone-verify-footer'),
        requestCodeBtn: document.getElementById('request-code-btn'),
        verifyCodeBtn: document.getElementById('verify-code-btn'),
        avatarInput: document.getElementById('avatar-input'),
        avatarPreview: document.getElementById('avatar-preview'),
        avatarUrlInput: document.getElementById('avatar-url'),
        phoneProxyDisplay: document.getElementById('phone-selected-proxy'),
        accountList: document.getElementById('account-list'),
        
        // Modal Navigation
        backToImportBtnSession: document.getElementById('back-to-import-options-btn-session'),
        backToImportBtnPhone: document.getElementById('back-to-import-options-btn-phone'),
        backToPhoneInputBtn: document.getElementById('back-to-phone-input-btn'),
        
        // Modal Container
        modalContainer: document.getElementById('modal-container')
    };

    // ===== Session + JSON Import Implementation =====
    
    /**
     * Initialize session import functionality
     * @param {string} proxyId - Selected proxy ID
     */
    function setupSessionImport(proxyId) {
        // Update proxy display
        updateProxyDisplay(elements.sessionProxyDisplay, proxyId);
        
        // Setup session file upload area
        setupFileUpload(
            elements.sessionFileInput,
            elements.sessionUploadArea,
            elements.sessionFileInfo,
            '.session',
            'Session'
        );
        
        // Setup JSON file upload area
        setupFileUpload(
            elements.jsonFileInput,
            elements.jsonUploadArea,
            elements.jsonFileInfo,
            '.json',
            'JSON'
        );
        
        // Setup back button
        elements.backToImportBtnSession.onclick = function() {
            hideModal('session-import-modal');
            showModal('account-import-modal');
        };
        
        // Setup import button
        elements.importSessionBtn.onclick = function() {
            handleSessionImport(proxyId);
        };
    }
    
    /**
     * Handle the session import process
     * @param {string} proxyId - Selected proxy ID
     */
    async function handleSessionImport(proxyId) {
        // Validation
        if (!elements.sessionFileInput.files.length) {
            showToast('Please select a session file', 'error');
            return;
        }
        
        const sessionFile = elements.sessionFileInput.files[0];
        const jsonFile = elements.jsonFileInput.files.length ? elements.jsonFileInput.files[0] : null;
        const listId = elements.sessionAccountList.value;
        const customName = elements.sessionAccountName.value.trim();
        
        // Show loading state
        elements.importSessionBtn.disabled = true;
        elements.importSessionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
        
        try {
            const formData = new FormData();
            formData.append('session_file', sessionFile);
            
            if (jsonFile) {
                formData.append('json_file', jsonFile);
            }
            
            formData.append('list_id', listId);
            formData.append('proxy_id', proxyId);
            
            if (customName) {
                formData.append('name', customName);
            }
            
            // Send the request to the server
            const response = await fetch('/api/accounts/import-session', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to import account');
            }
            
            const result = await response.json();
            
            showToast('Account imported successfully', 'success');
            
            // Close the modal
            hideModal('session-import-modal');
            
            // Reload accounts list
            if (typeof loadAccounts === 'function') {
                await loadAccounts(state.currentListId);
                await loadStats(state.currentListId);
            } else {
                // Redirect to accounts page if necessary
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            console.error('Error importing session:', error);
            showToast('Error importing account: ' + error.message, 'error');
        } finally {
            // Reset button state
            elements.importSessionBtn.disabled = false;
            elements.importSessionBtn.innerHTML = 'Import Account';
        }
    }
    
    // ===== Phone Number Import Implementation =====
    
    /**
     * Initialize phone number import functionality
     * @param {string} proxyId - Selected proxy ID
     */
    function setupPhoneImport(proxyId) {
        // Update proxy display
        updateProxyDisplay(elements.phoneProxyDisplay, proxyId);
        
        // Reset the form
        elements.phoneForm.reset();
        
        // Reset avatar preview
        elements.avatarPreview.innerHTML = '<i class="fas fa-user"></i>';
        elements.avatarUrlInput.value = '';
        
        // Hide verification code row
        elements.verificationCodeRow.style.display = 'none';
        
        // Show phone footer, hide verify footer
        elements.phoneImportFooter.style.display = 'block';
        elements.phoneVerifyFooter.style.display = 'none';
        
        // Setup avatar upload
        setupAvatarUpload();
        
        // Setup back button
        elements.backToImportBtnPhone.onclick = function() {
            hideModal('phone-import-modal');
            showModal('account-import-modal');
        };
        
        // Setup request code button
        elements.requestCodeBtn.onclick = function() {
            handleRequestCode(proxyId);
        };
        
        // Setup verify code button
        elements.verifyCodeBtn.onclick = function() {
            handleVerifyCode(proxyId);
        };
        
        // Setup back to phone input button
        elements.backToPhoneInputBtn.onclick = function() {
            // Show phone footer, hide verify footer
            elements.phoneImportFooter.style.display = 'block';
            elements.phoneVerifyFooter.style.display = 'none';
            
            // Hide verification code row
            elements.verificationCodeRow.style.display = 'none';
        };
    }
    
    /**
     * Handle the request code process
     * @param {string} proxyId - Selected proxy ID
     */
    async function handleRequestCode(proxyId) {
        // Validate form
        const name = elements.nameInput.value.trim();
        const phone = elements.phoneInput.value.trim();
        
        if (!name) {
            showToast('Please enter a name', 'error');
            elements.nameInput.focus();
            return;
        }
        
        if (!phone) {
            showToast('Please enter a phone number', 'error');
            elements.phoneInput.focus();
            return;
        }
        
        // Disable button and show loading
        elements.requestCodeBtn.disabled = true;
        elements.requestCodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Requesting...';
        
        try {
            // Send request to the server to initiate the verification process
            const response = await fetch('/api/accounts/request-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone: phone,
                    proxy_id: proxyId
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to request verification code');
            }
            
            // Parse the response
            const result = await response.json();
            
            if (result.success) {
                // Show verification step
                elements.verificationCodeRow.style.display = 'block';
                elements.phoneImportFooter.style.display = 'none';
                elements.phoneVerifyFooter.style.display = 'block';
                
                showToast('Verification code sent to your Telegram app', 'success');
                
                // Focus the verification code input
                setTimeout(() => {
                    elements.verificationCodeInput.focus();
                }, 100);
            } else {
                throw new Error(result.error || 'Failed to request verification code');
            }
        } catch (error) {
            console.error('Error requesting code:', error);
            showToast('Error: ' + error.message, 'error');
        } finally {
            // Reset button state
            elements.requestCodeBtn.disabled = false;
            elements.requestCodeBtn.innerHTML = 'Request Code';
        }
    }
    
    /**
     * Handle the verification code submission
     * @param {string} proxyId - Selected proxy ID
     */
    async function handleVerifyCode(proxyId) {
        // Get the verification code
        const code = elements.verificationCodeInput.value.trim();
        
        if (!code) {
            showToast('Please enter the verification code', 'error');
            elements.verificationCodeInput.focus();
            return;
        }
        
        // Disable button and show loading
        elements.verifyCodeBtn.disabled = true;
        elements.verifyCodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        
        try {
            // Create account data
            const accountData = {
                name: elements.nameInput.value.trim(),
                phone: elements.phoneInput.value.trim(),
                username: elements.usernameInput.value.trim().replace('@', ''),
                avatar: elements.avatarUrlInput.value,
                list_id: elements.accountList.value,
                proxy_id: proxyId,
                code: code,
                limits: {
                    daily_invites: parseInt(document.getElementById('limit-invites').value) || 30,
                    daily_messages: parseInt(document.getElementById('limit-messages').value) || 50
                }
            };
            
            // Send the verification code to the server
            const response = await fetch('/api/accounts/verify-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(accountData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to verify code');
            }
            
            // Parse the response
            const result = await response.json();
            
            if (result.success) {
                showToast('Account verified and added successfully', 'success');
                
                // Close the modal
                hideModal('phone-import-modal');
                
                // Reload accounts list
                if (typeof loadAccounts === 'function') {
                    await loadAccounts(state.currentListId);
                    await loadStats(state.currentListId);
                } else {
                    // Redirect to accounts page if necessary
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
            } else {
                throw new Error(result.error || 'Failed to verify account');
            }
        } catch (error) {
            console.error('Error verifying code:', error);
            showToast('Error: ' + error.message, 'error');
        } finally {
            // Reset button state
            elements.verifyCodeBtn.disabled = false;
            elements.verifyCodeBtn.innerHTML = 'Verify & Add Account';
        }
    }
    
    // ===== Utility Functions =====
    
    /**
     * Set up file upload functionality for an area
     * @param {HTMLElement} fileInput - The file input element
     * @param {HTMLElement} uploadArea - The upload area element
     * @param {HTMLElement} infoElement - The element to display file info
     * @param {string} fileExtension - The allowed file extension
     * @param {string} fileType - The file type name for display
     */
    function setupFileUpload(fileInput, uploadArea, infoElement, fileExtension, fileType) {
        if (!fileInput || !uploadArea) return;
        
        // Reset file input
        fileInput.value = '';
        
        // Handle direct file selection
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                
                if (file.name.endsWith(fileExtension)) {
                    displayFileInfo(file, infoElement);
                } else {
                    showToast(`Please select a ${fileExtension} file`, 'error');
                }
            }
        });
        
        // Handle click on upload area
        uploadArea.addEventListener('click', (e) => {
            // Don't trigger if clicking on a child element
            if (e.target === uploadArea || e.target.tagName !== 'INPUT') {
                fileInput.click();
            }
        });
        
        // Handle drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                
                if (file.name.endsWith(fileExtension)) {
                    // Create a DataTransfer object to assign files to the input
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    fileInput.files = dataTransfer.files;
                    
                    displayFileInfo(file, infoElement);
                } else {
                    showToast(`Please select a ${fileExtension} file`, 'error');
                }
            }
        });
        
        // Make sure the "Browse Files" button works
        const browseButton = uploadArea.querySelector('label.btn');
        if (browseButton) {
            browseButton.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            };
        }
    }
    
    /**
     * Display file information
     * @param {File} file - The selected file
     * @param {HTMLElement} infoElement - The element to display file info
     */
    function displayFileInfo(file, infoElement) {
        if (!infoElement) return;
        
        const fileSize = formatFileSize(file.size);
        infoElement.textContent = `Selected: ${file.name} (${fileSize})`;
        infoElement.style.display = 'block';
    }
    
    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' B';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(2) + ' KB';
        } else {
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        }
    }
    
    /**
     * Set up avatar upload functionality
     */
    function setupAvatarUpload() {
        if (!elements.avatarInput || !elements.avatarPreview) return;
        
        // Reset avatar input
        elements.avatarInput.value = '';
        
        elements.avatarInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                
                if (file.type.startsWith('image/')) {
                    try {
                        // Create FormData for upload
                        const formData = new FormData();
                        formData.append('avatar', file);
                        
                        // Upload the avatar
                        const response = await fetch('/api/accounts/upload-avatar', {
                            method: 'POST',
                            body: formData
                        });
                        
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to upload avatar');
                        }
                        
                        const result = await response.json();
                        
                        if (result.url) {
                            // Update the avatar preview
                            elements.avatarPreview.innerHTML = `<img src="${result.url}" alt="Avatar">`;
                            
                            // Store the URL in the hidden input
                            elements.avatarUrlInput.value = result.url;
                        } else {
                            throw new Error('No URL returned from server');
                        }
                    } catch (error) {
                        console.error('Error uploading avatar:', error);
                        showToast('Error uploading avatar: ' + error.message, 'error');
                    }
                } else {
                    showToast('Please select an image file', 'error');
                }
            }
        });
        
        // Handle click on the avatar preview to trigger file selection
        const avatarUploadBtn = elements.avatarPreview.nextElementSibling;
        if (avatarUploadBtn) {
            avatarUploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                elements.avatarInput.click();
            });
        }
    }
    
    /**
     * Update the proxy display element with the selected proxy info
     * @param {HTMLElement} displayElement - The element to display the proxy info
     * @param {string} proxyId - The selected proxy ID
     */
    function updateProxyDisplay(displayElement, proxyId) {
        if (!displayElement) return;
        
        // Find the proxy in the state
        const proxy = window.state && window.state.proxies ? 
            window.state.proxies.find(p => p.id === proxyId) : null;
        
        if (proxy) {
            displayElement.textContent = `${proxy.host}:${proxy.port}`;
        } else {
            // Try to get the proxy from the account-proxy dropdown
            const proxySelect = document.getElementById('account-proxy');
            if (proxySelect) {
                const selectedOption = Array.from(proxySelect.options).find(opt => opt.value === proxyId);
                if (selectedOption) {
                    displayElement.textContent = selectedOption.textContent.trim();
                } else {
                    displayElement.textContent = 'None';
                }
            } else {
                displayElement.textContent = proxyId ? proxyId : 'None';
            }
        }
    }
    
    /**
     * Show a modal dialog
     * @param {string} modalId - The ID of the modal to show
     */
    function showModal(modalId) {
        const modalContainer = document.getElementById('modal-container');
        const modal = document.getElementById(modalId);
        
        if (modalContainer && modal) {
            modalContainer.classList.add('active');
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }
    
    /**
     * Hide a modal dialog
     * @param {string} modalId - The ID of the modal to hide
     */
    function hideModal(modalId) {
        const modalContainer = document.getElementById('modal-container');
        const modal = document.getElementById(modalId);
        
        if (modalContainer && modal) {
            modalContainer.classList.remove('active');
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - The type of notification (info, success, error, warning)
     */
    function showToast(message, type = 'info') {
        // Create or reuse the toast element
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
        }
        
        // Set the message and type
        toast.textContent = message;
        toast.className = type;
        
        // Show the toast
        setTimeout(() => {
            toast.classList.add('visible');
        }, 10);
        
        // Hide the toast after a delay
        setTimeout(() => {
            toast.classList.remove('visible');
        }, 3000);
    }
    
    // ===== Export Public API =====
    
    // Export functions to global scope for use in other scripts
    window.accountImporter = {
        setupSessionImport,
        handleSessionImport,
        setupPhoneImport,
        handleRequestCode,
        handleVerifyCode
    };
    
    // When the "Add Account" button is clicked from either the main page or empty state
    function setupAccountImportHandlers() {
        const addAccountBtn = document.getElementById('add-account-btn');
        const emptyAddBtn = document.getElementById('empty-add-btn');
        const continueImportBtn = document.getElementById('continue-import-btn');
        
        // Set up handlers for the main "Add Account" buttons
        [addAccountBtn, emptyAddBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    // This will be handled by the main scripts, but we wait for modal to be shown
                    setTimeout(() => {
                        // Setup import option handling
                        setupImportOptions();
                    }, 100);
                });
            }
        });
        
        if (continueImportBtn) {
            continueImportBtn.addEventListener('click', handleContinueImport);
        }
    }
    
    /**
     * Set up import options selection
     */
    function setupImportOptions() {
        const importOptions = document.querySelectorAll('.import-option');
        
        importOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Remove selected class from all options
                importOptions.forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                // Add selected class to this option
                this.classList.add('selected');
            });
        });
    }
    
    /**
     * Handle continuing to the next step of import
     */
    function handleContinueImport() {
        // Get selected import option
        const selectedOption = document.querySelector('.import-option.selected');
        if (!selectedOption) {
            showToast('Please select an import method', 'error');
            return;
        }
        
        // Get selected proxy
        const proxySelect = document.getElementById('account-proxy');
        if (!proxySelect || !proxySelect.value) {
            showToast('Please select a proxy', 'error');
            return;
        }
        
        // Store selected proxy ID
        const selectedProxyId = proxySelect.value;
        
        // Get import method
        const importMethod = selectedOption.dataset.option;
        
        // Hide the import options modal
        hideModal('account-import-modal');
        
        // Show the appropriate import modal based on the selected method
        switch (importMethod) {
            case 'session':
                showModal('session-import-modal');
                setupSessionImport(selectedProxyId);
                break;
            case 'tdata':
                // TData import is already implemented in the base system
                showModal('tdata-import-modal');
                break;
            case 'phone':
                showModal('phone-import-modal');
                setupPhoneImport(selectedProxyId);
                break;
            default:
                showToast('Invalid import method', 'error');
                break;
        }
    }
    
    // Initialize
    setupAccountImportHandlers();
});