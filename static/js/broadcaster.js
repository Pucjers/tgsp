document.addEventListener("DOMContentLoaded", function () {
  const state = {
    accounts: [],
    groups: [],
    accountLists: [],
    groupLists: [],
    selectedAccounts: new Set(),
    selectedGroups: new Set(),
    currentAccountListId: "all",
    currentGroupListId: "all",
    images: [],
    templates: {},
    broadcasting: false,
    paused: false,
    progress: {
      total: 0,
      completed: 0,
      errors: 0,
    },
  };

  const elements = {
    accountsFilter: document.getElementById("accounts-filter"),
    groupsFilter: document.getElementById("groups-filter"),
    accountsSelection: document.getElementById("accounts-selection"),
    groupsSelection: document.getElementById("groups-selection"),
    selectedAccountsCount: document.getElementById("selected-accounts-count"),
    selectedGroupsCount: document.getElementById("selected-groups-count"),

    messageInput: document.getElementById("message-input"),
    messageTemplate: document.getElementById("message-template"),
    addImageBtn: document.getElementById("add-image-btn"),
    imageUpload: document.getElementById("image-upload"),
    imagePreview: document.getElementById("image-preview"),

    intervalMin: document.getElementById("interval-min"),
    intervalMax: document.getElementById("interval-max"),

    randomizeMessages: document.getElementById("randomize-messages"),
    randomizeAccounts: document.getElementById("randomize-accounts"),
    skipErrors: document.getElementById("skip-errors"),

    startBroadcastBtn: document.getElementById("start-broadcast-btn"),
    pauseBroadcastBtn: document.getElementById("pause-broadcast-btn"),
    stopBroadcastBtn: document.getElementById("stop-broadcast-btn"),
    testMessageBtn: document.getElementById("test-message-btn"),

    selectAllAccountsBtn: document.getElementById("select-all-accounts-btn"),
    selectAllGroupsBtn: document.getElementById("select-all-groups-btn"),
    clearAccountsBtn: document.getElementById("clear-accounts-btn"),
    clearGroupsBtn: document.getElementById("clear-groups-btn"),

    addPlaceholderBtn: document.getElementById("add-placeholder-btn"),
    saveTemplateBtn: document.getElementById("save-template-btn"),

    progressIndicator: document.getElementById("progress-indicator"),
    progressFill: document.getElementById("progress-fill"),
    progressStatus: document.getElementById("progress-status"),
    progressCount: document.getElementById("progress-count"),

    logsContainer: document.getElementById("logs-container"),
    clearLogsBtn: document.getElementById("clear-logs-btn"),
    exportLogsBtn: document.getElementById("export-logs-btn"),

    modalContainer: document.getElementById("modal-container"),
  };

  const api = {
    async getAccounts(listId = "all") {
      try {
        const response = await fetch(`/api/accounts?list_id=${listId}`);
        if (!response.ok) throw new Error("Failed to fetch accounts");
        return await response.json();
      } catch (error) {
        console.error("Error fetching accounts:", error);
        showToast("Error loading accounts", "error");
        return [];
      }
    },

    async getAccountLists() {
      try {
        const response = await fetch("/api/account-lists");
        if (!response.ok) throw new Error("Failed to fetch account lists");
        return await response.json();
      } catch (error) {
        console.error("Error fetching account lists:", error);
        showToast("Error loading account lists", "error");
        return [];
      }
    },

    async getGroups(listId = "all") {
      try {
        const response = await fetch(`/api/groups?list_id=${listId}`);
        if (!response.ok) throw new Error("Failed to fetch groups");
        return await response.json();
      } catch (error) {
        console.error("Error fetching groups:", error);
        showToast("Error loading groups", "error");
        return [];
      }
    },

    async getGroupLists() {
      try {
        const response = await fetch("/api/group-lists");
        if (!response.ok) throw new Error("Failed to fetch group lists");
        return await response.json();
      } catch (error) {
        console.error("Error fetching group lists:", error);
        showToast("Error loading group lists", "error");
        return [];
      }
    },

    async uploadImage(file) {
      try {
        console.log(
          `Attempting to upload image: ${file.name}, type: ${file.type}, size: ${file.size} bytes`
        );

        const formData = new FormData();

        formData.append("avatar", file);
        formData.append("image", file);

        console.log("Sending POST request to /api/accounts/upload-avatar");
        const response = await fetch("/api/accounts/upload-avatar", {
          method: "POST",
          body: formData,
        });

        console.log(
          `Upload response status: ${response.status} ${response.statusText}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Upload failed with status ${response.status}: ${errorText}`
          );
          throw new Error(
            `Failed to upload image: ${errorText || response.statusText}`
          );
        }

        const result = await response.json();
        console.log("Upload successful, result:", result);

        return result;
      } catch (error) {
        console.error("Error in uploadImage():", error);
        showToast(`Error uploading image: ${error.message}`, "error");
        return null;
      }
    },

    async sendMessage(accountId, groupId, message, imageUrls = []) {
      try {
        console.log(
          `Sending message from account ${accountId} to group ${groupId}`
        );
        console.log(
          `Message content: ${message.substring(0, 50)}${
            message.length > 50 ? "..." : ""
          }`
        );
        console.log(`Including ${imageUrls.length} images:`, imageUrls);

        showToast("Sending message, please wait...", "info");

        const longOperationTimeout = setTimeout(() => {
          showToast(
            "Message sending is taking longer than expected. Please be patient...",
            "warning"
          );
          addLog(
            "Message sending is taking longer than expected. This could be due to network issues or Telegram rate limits.",
            "warning"
          );
        }, 10000);

        const failureTimeout = setTimeout(() => {
          console.error("Message sending timed out after 2 minutes");
          return {
            success: false,
            error:
              "Message sending timed out after 2 minutes. The operation might still be processing in the background.",
          };
        }, 120000);

        const response = await fetch("/api/broadcaster/send-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: accountId,
            group_id: groupId,
            message: message,
            image_urls: imageUrls,
          }),
        });

        clearTimeout(longOperationTimeout);
        clearTimeout(failureTimeout);

        console.log(
          `API response status: ${response.status} ${response.statusText}`
        );

        const result = await response.json();
        console.log("Send message API result:", result);

        if (!result.success) {
          console.error(`Message sending failed: ${result.error}`);

          if (result.cooldown_until) {
            console.warn(`Account cooldown until: ${result.cooldown_until}`);
          }
        }

        return result;
      } catch (error) {
        console.error("Error in sendMessage():", error);
        return {
          success: false,
          error: error.message,
        };
      }
    },

    async saveTemplate(template) {
      try {
        const templates = JSON.parse(
          localStorage.getItem("broadcaster_templates") || "{}"
        );
        templates[template.id] = template;
        localStorage.setItem(
          "broadcaster_templates",
          JSON.stringify(templates)
        );
        return template;
      } catch (error) {
        console.error("Error saving template:", error);
        showToast("Error saving template", "error");
        return null;
      }
    },

    getTemplates() {
      try {
        return JSON.parse(
          localStorage.getItem("broadcaster_templates") || "{}"
        );
      } catch (error) {
        console.error("Error loading templates:", error);
        return {};
      }
    },
  };

  const broadcaster = {
    broadcastQueue: [],
    currentInterval: null,

    setupBroadcast(accounts, groups, message, options) {
      this.stopBroadcast();
      this.broadcastQueue = [];

      for (const account of accounts) {
        for (const group of groups) {
          this.broadcastQueue.push({
            accountId: account.id,
            account: account,
            groupId: group.id,
            group: group,
            message: this.processMessageTemplate(message, account, group),
            imageUrls: state.images.map((img) => img.url),
            status: "pending",
          });
        }
      }

      if (options.randomize) {
        this.broadcastQueue = this.shuffleArray(this.broadcastQueue);
      }

      state.progress.total = this.broadcastQueue.length;
      state.progress.completed = 0;
      state.progress.errors = 0;

      return {
        total: this.broadcastQueue.length,
        accounts: accounts.length,
        groups: groups.length,
      };
    },

    startBroadcast() {
      if (this.broadcastQueue.length === 0) return false;

      state.broadcasting = true;
      state.paused = false;
      this.processNextMessage();

      return true;
    },

    async processNextMessage() {
      if (!state.broadcasting || state.paused) return;

      const nextMsg = this.broadcastQueue.find(
        (msg) => msg.status === "pending"
      );

      if (!nextMsg) {
        this.completeBroadcast();
        return;
      }

      nextMsg.status = "processing";
      updateProgress();

      addLog(
        `Sending message from ${nextMsg.account.name} to group ${nextMsg.group.title}...`,
        "info"
      );

      try {
        const result = await api.sendMessage(
          nextMsg.accountId,
          nextMsg.groupId,
          nextMsg.message,
          nextMsg.imageUrls
        );

        if (result.success) {
          nextMsg.status = "completed";
          state.progress.completed++;
          addLog(
            `Message sent successfully from ${nextMsg.account.name} to ${nextMsg.group.title}`,
            "success"
          );
        } else {
          if (
            result.error &&
            (result.error.includes("list") ||
              result.error.includes("album") ||
              result.error.includes("attribute"))
          ) {
            nextMsg.status = "completed";
            state.progress.completed++;
            addLog(
              `Message likely sent despite error: ${result.error}`,
              "warning"
            );
            addLog(
              `Message marked as sent from ${nextMsg.account.name} to ${nextMsg.group.title}`,
              "success"
            );
          } else {
            nextMsg.status = "error";
            nextMsg.error = result.error;
            state.progress.errors++;

            if (result.cooldown_until) {
              nextMsg.account.cooldown_until = result.cooldown_until;
              addLog(
                `Account ${
                  nextMsg.account.name
                } is rate limited until ${new Date(
                  result.cooldown_until
                ).toLocaleString()}`,
                "warning"
              );

              this.broadcastQueue.forEach((msg) => {
                if (
                  msg.status === "pending" &&
                  msg.accountId === nextMsg.accountId
                ) {
                  msg.status = "skipped";
                  msg.error = "Account is rate limited";
                }
              });
            }

            addLog(
              `Error sending message from ${nextMsg.account.name} to ${nextMsg.group.title}: ${result.error}`,
              "error"
            );
          }
        }
      } catch (error) {
        nextMsg.status = "error";
        nextMsg.error = error.message;
        state.progress.errors++;
        addLog(
          `Error sending message from ${nextMsg.account.name} to ${nextMsg.group.title}: ${error.message}`,
          "error"
        );
      }

      updateProgress();

      const shouldContinue =
        nextMsg.status !== "error" || elements.skipErrors.checked;

      if (!shouldContinue) {
        addLog(
          'Broadcasting paused due to error. Enable "Continue on errors" to automatically continue.',
          "warning"
        );
        this.pauseBroadcast();
        return;
      }

      const minInterval = parseInt(elements.intervalMin.value) || 30;
      const maxInterval = parseInt(elements.intervalMax.value) || 60;
      const randomInterval =
        Math.floor(Math.random() * (maxInterval - minInterval + 1)) +
        minInterval;

      addLog(
        `Waiting ${randomInterval} seconds before next message...`,
        "info"
      );

      this.currentInterval = setTimeout(() => {
        this.processNextMessage();
      }, randomInterval * 1000);
    },

    pauseBroadcast() {
      state.paused = true;
      if (this.currentInterval) {
        clearTimeout(this.currentInterval);
        this.currentInterval = null;
      }
      addLog("Broadcasting paused", "warning");
      updateProgress();
      return true;
    },

    resumeBroadcast() {
      state.paused = false;
      addLog("Broadcasting resumed", "info");
      this.processNextMessage();
      return true;
    },

    stopBroadcast() {
      state.broadcasting = false;
      state.paused = false;
      if (this.currentInterval) {
        clearTimeout(this.currentInterval);
        this.currentInterval = null;
      }
      if (state.progress.completed > 0) {
        addLog("Broadcasting stopped", "warning");
      }
      return true;
    },

    completeBroadcast() {
      state.broadcasting = false;
      addLog("Broadcasting completed!", "success");
      addLog(
        `Results: ${state.progress.completed} messages sent, ${state.progress.errors} errors`,
        "info"
      );
      updateProgress();
      return true;
    },

    processMessageTemplate(message, account, group) {
      let processedMessage = message;

      processedMessage = processedMessage.replace(
        /{name}/g,
        account.name || ""
      );
      processedMessage = processedMessage.replace(
        /{username}/g,
        account.username || ""
      );
      processedMessage = processedMessage.replace(
        /{phone}/g,
        account.phone || ""
      );

      processedMessage = processedMessage.replace(
        /{group}/g,
        group.title || ""
      );
      processedMessage = processedMessage.replace(
        /{group_username}/g,
        group.username || ""
      );

      const now = new Date();
      processedMessage = processedMessage.replace(
        /{date}/g,
        now.toLocaleDateString()
      );
      processedMessage = processedMessage.replace(
        /{time}/g,
        now.toLocaleTimeString()
      );

      return processedMessage;
    },

    shuffleArray(array) {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    },

    async sendTestMessage(accountId, groupId, message) {
      const account = state.accounts.find((acc) => acc.id === accountId);
      const group = state.groups.find((grp) => grp.id === groupId);

      if (!account || !group) {
        addLog("Test failed: Account or group not found", "error");
        return false;
      }

      const processedMessage = this.processMessageTemplate(
        message,
        account,
        group
      );

      addLog(
        `Sending test message from ${account.name} to group ${group.title}...`,
        "info"
      );

      try {
        const result = await api.sendMessage(
          accountId,
          groupId,
          processedMessage,
          state.images.map((img) => img.url)
        );

        if (result.success) {
          addLog(`Test message sent successfully!`, "success");
          return true;
        } else {
          addLog(`Error sending test message: ${result.error}`, "error");
          return false;
        }
      } catch (error) {
        addLog(`Error sending test message: ${error.message}`, "error");
        return false;
      }
    },
  };

  const renderAccountLists = () => {
    let options = '<option value="all">All Lists</option>';

    state.accountLists.forEach((list) => {
      options += `<option value="${list.id}">${list.name}</option>`;
    });

    elements.accountsFilter.innerHTML = options;
  };

  const renderGroupLists = () => {
    let options = '<option value="all">All Lists</option>';

    state.groupLists.forEach((list) => {
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

    let html = "";

    state.accounts.forEach((account) => {
      const isSelected = state.selectedAccounts.has(account.id);

      html += `
                <div class="selection-item ${
                  isSelected ? "selected" : ""
                }" data-id="${account.id}" data-type="account">
                    <div class="selection-item-avatar">
                        ${
                          account.avatar
                            ? `<img src="${account.avatar}" alt="${account.name}">`
                            : `<i class="fas fa-user"></i>`
                        }
                    </div>
                    <div class="selection-item-info">
                        <div class="selection-item-name">${account.name}</div>
                        <div class="selection-item-details">${
                          account.phone
                        }</div>
                    </div>
                </div>
            `;
    });

    elements.accountsSelection.innerHTML = html;

    elements.accountsSelection
      .querySelectorAll(".selection-item")
      .forEach((item) => {
        item.addEventListener("click", handleAccountSelection);
      });

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

    let html = "";

    state.groups.forEach((group) => {
      const isSelected = state.selectedGroups.has(group.id);

      html += `
                <div class="selection-item ${
                  isSelected ? "selected" : ""
                }" data-id="${group.id}" data-type="group">
                    <div class="selection-item-avatar">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="selection-item-info">
                        <div class="selection-item-name">${group.title}</div>
                        <div class="selection-item-details">@${
                          group.username || "unknown"
                        } · ${formatNumber(group.members || 0)} members</div>
                    </div>
                </div>
            `;
    });

    elements.groupsSelection.innerHTML = html;

    elements.groupsSelection
      .querySelectorAll(".selection-item")
      .forEach((item) => {
        item.addEventListener("click", handleGroupSelection);
      });

    elements.selectedGroupsCount.textContent = `${state.selectedGroups.size} selected`;
  };

  const renderImagePreviews = () => {
    let html = "";

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

    elements.imagePreview
      .querySelectorAll(".remove-image")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          const index = parseInt(button.dataset.index);
          removeImage(index);
        });
      });
  };

  const renderTemplates = () => {
    state.templates = api.getTemplates();

    let options = '<option value="">Load Template...</option>';

    Object.entries(state.templates).forEach(([id, template]) => {
      options += `<option value="${id}">${template.name}</option>`;
    });

    elements.messageTemplate.innerHTML = options;
  };

  const renderTestMessageModal = () => {
    const accountSelect = document.getElementById("test-account");
    const groupSelect = document.getElementById("test-group");

    let accountOptions = "";
    state.accounts.forEach((account) => {
      if (state.selectedAccounts.has(account.id)) {
        accountOptions += `<option value="${account.id}">${account.name} (${account.phone})</option>`;
      }
    });
    accountSelect.innerHTML =
      accountOptions || '<option value="">No accounts selected</option>';

    let groupOptions = "";
    state.groups.forEach((group) => {
      if (state.selectedGroups.has(group.id)) {
        groupOptions += `<option value="${group.id}">${group.title} (@${
          group.username || "unknown"
        })</option>`;
      }
    });
    groupSelect.innerHTML =
      groupOptions || '<option value="">No groups selected</option>';
  };

  const handleAccountListChange = async () => {
    const listId = elements.accountsFilter.value;
    state.currentAccountListId = listId;

    await loadAccounts(listId);
  };

  const handleGroupListChange = async () => {
    const listId = elements.groupsFilter.value;
    state.currentGroupListId = listId;

    await loadGroups(listId);
  };

  const handleAccountSelection = (event) => {
    const item = event.currentTarget;
    const accountId = item.dataset.id;

    if (state.selectedAccounts.has(accountId)) {
      state.selectedAccounts.delete(accountId);
      item.classList.remove("selected");
    } else {
      state.selectedAccounts.add(accountId);
      item.classList.add("selected");
    }

    elements.selectedAccountsCount.textContent = `${state.selectedAccounts.size} selected`;
  };

  const handleGroupSelection = (event) => {
    const item = event.currentTarget;
    const groupId = item.dataset.id;

    if (state.selectedGroups.has(groupId)) {
      state.selectedGroups.delete(groupId);
      item.classList.remove("selected");
    } else {
      state.selectedGroups.add(groupId);
      item.classList.add("selected");
    }

    elements.selectedGroupsCount.textContent = `${state.selectedGroups.size} selected`;
  };

  const handleSelectAllAccounts = () => {
    const items =
      elements.accountsSelection.querySelectorAll(".selection-item");

    const allSelected = state.selectedAccounts.size === state.accounts.length;

    if (allSelected) {
      state.selectedAccounts.clear();
      items.forEach((item) => item.classList.remove("selected"));
    } else {
      state.accounts.forEach((account) =>
        state.selectedAccounts.add(account.id)
      );
      items.forEach((item) => item.classList.add("selected"));
    }

    elements.selectedAccountsCount.textContent = `${state.selectedAccounts.size} selected`;
  };

  const handleSelectAllGroups = () => {
    const items = elements.groupsSelection.querySelectorAll(".selection-item");

    const allSelected = state.selectedGroups.size === state.groups.length;

    if (allSelected) {
      state.selectedGroups.clear();
      items.forEach((item) => item.classList.remove("selected"));
    } else {
      state.groups.forEach((group) => state.selectedGroups.add(group.id));
      items.forEach((item) => item.classList.add("selected"));
    }

    elements.selectedGroupsCount.textContent = `${state.selectedGroups.size} selected`;
  };

  const handleClearAccounts = () => {
    state.selectedAccounts.clear();
    elements.accountsSelection
      .querySelectorAll(".selection-item")
      .forEach((item) => {
        item.classList.remove("selected");
      });

    elements.selectedAccountsCount.textContent = `0 selected`;
  };

  const handleClearGroups = () => {
    state.selectedGroups.clear();
    elements.groupsSelection
      .querySelectorAll(".selection-item")
      .forEach((item) => {
        item.classList.remove("selected");
      });

    elements.selectedGroupsCount.textContent = `0 selected`;
  };

  const handleAddImage = () => {
    elements.imageUpload.click();
  };

  const handleImageUpload = async (event) => {
    const files = event.target.files;

    if (!files || files.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.type.startsWith("image/")) {
        showToast("Only image files are allowed", "error");
        errorCount++;
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast("Image is too large (max 5MB)", "error");
        errorCount++;
        continue;
      }

      try {
        const previewUrl = URL.createObjectURL(file);

        state.images.push({
          file,
          url: previewUrl,
          uploaded: false,
        });

        successCount++;
      } catch (error) {
        console.error("Error creating preview:", error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      renderImagePreviews();

      uploadImages();

      showToast(`Added ${successCount} images`, "success");
    }

    if (errorCount > 0) {
      showToast(`Failed to add ${errorCount} images`, "error");
    }

    event.target.value = "";
  };

  const uploadImages = async () => {
    const unprocessedImages = state.images.filter((img) => !img.uploaded);

    for (const image of unprocessedImages) {
      try {
        console.log(`Uploading image: ${image.file.name}`);

        const result = await api.uploadImage(image.file);

        if (result && result.url) {
          console.log(`Image upload successful, received URL: ${result.url}`);

          image.url = result.url;
          image.uploaded = true;
        } else {
          console.error("Image upload failed - no URL returned");
        }
      } catch (error) {
        console.error("Error in uploadImages():", error);
      }
    }

    renderImagePreviews();
  };

  const removeImage = (index) => {
    state.images.splice(index, 1);

    renderImagePreviews();
  };

  const handleAddPlaceholder = () => {
    showModal("add-placeholder-modal");

    const placeholderType = document.getElementById("placeholder-type");
    const customContainer = document.getElementById(
      "custom-placeholder-container"
    );

    placeholderType.value = "{name}";
    customContainer.style.display = "none";

    placeholderType.onchange = () => {
      if (placeholderType.value === "{custom}") {
        customContainer.style.display = "block";

        setTimeout(() => {
          document.getElementById("custom-placeholder").focus();
        }, 50);
      } else {
        customContainer.style.display = "none";
      }
    };

    const insertBtn = document.getElementById("insert-placeholder-btn");

    const newInsertBtn = insertBtn.cloneNode(true);
    insertBtn.parentNode.replaceChild(newInsertBtn, insertBtn);

    const customInput = document.getElementById("custom-placeholder");
    customInput.value = "";
    customInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        newInsertBtn.click();
      }
    };

    newInsertBtn.addEventListener("click", () => {
      let placeholder = placeholderType.value;

      if (placeholder === "{custom}") {
        const customPlaceholder = customInput.value.trim();

        if (!customPlaceholder) {
          showToast("Please enter a custom placeholder", "error");
          return;
        }

        placeholder = `{${customPlaceholder}}`;
      }

      insertTextAtCursor(elements.messageInput, placeholder);

      hideModal("add-placeholder-modal");

      setTimeout(() => {
        elements.messageInput.focus();
      }, 50);

      showToast(`Placeholder ${placeholder} inserted`, "success");
    });
  };

  const handleSaveTemplate = () => {
    const message = elements.messageInput.value.trim();

    if (!message) {
      showToast("Please enter a message to save as template", "error");
      return;
    }

    showModal("save-template-modal");

    const saveBtn = document.getElementById("confirm-save-template-btn");

    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener("click", async () => {
      const name = document.getElementById("template-name").value.trim();
      const description = document
        .getElementById("template-description")
        .value.trim();

      if (!name) {
        showToast("Please enter a template name", "error");
        return;
      }

      const template = {
        id: `template_${Date.now()}`,
        name,
        description,
        message,
        images: state.images.map((img) => ({
          url: img.url,
          uploaded: img.uploaded,
        })),
        createdAt: new Date().toISOString(),
      };

      const savedTemplate = await api.saveTemplate(template);

      if (savedTemplate) {
        renderTemplates();

        showToast("Template saved successfully", "success");

        hideModal("save-template-modal");
      }
    });
  };

  const handleLoadTemplate = () => {
    const templateId = elements.messageTemplate.value;

    if (!templateId) return;

    const template = state.templates[templateId];

    if (template) {
      if (
        elements.messageInput.value.trim() &&
        !confirm("This will replace your current message. Are you sure?")
      ) {
        elements.messageTemplate.value = "";
        return;
      }

      elements.messageInput.value = template.message;

      state.images = [];

      if (template.images && template.images.length > 0) {
        template.images.forEach((img) => {
          state.images.push({
            url: img.url,
            uploaded: img.uploaded || True,
            file: null,
          });
        });

        renderImagePreviews();

        showToast(
          "Template loaded with ${template.images.length} images",
          "success"
        );
      } else {
        renderImagePreviews();
        showToast("Template loaded without images", "success");
      }
    }

    elements.messageTemplate.value = "";
  };

  const handleStartBroadcast = () => {
    if (!validateBroadcastInputs()) return;

    const selectedAccounts = state.accounts.filter((acc) =>
      state.selectedAccounts.has(acc.id)
    );
    const selectedGroups = state.groups.filter((grp) =>
      state.selectedGroups.has(grp.id)
    );

    const message = elements.messageInput.value.trim();

    const options = {
      randomize: elements.randomizeMessages.checked,
      randomizeAccounts: elements.randomizeAccounts.checked,
      skipErrors: elements.skipErrors.checked,
      intervalMin: parseInt(elements.intervalMin.value) || 30,
      intervalMax: parseInt(elements.intervalMax.value) || 60,
    };

    const queueInfo = broadcaster.setupBroadcast(
      selectedAccounts,
      selectedGroups,
      message,
      options
    );

    showModal("confirmation-modal");

    document.getElementById("confirm-accounts-count").textContent =
      queueInfo.accounts;
    document.getElementById("confirm-groups-count").textContent =
      queueInfo.groups;
    document.getElementById("confirm-messages-total").textContent =
      queueInfo.total;

    const avgInterval = (options.intervalMin + options.intervalMax) / 2;
    const estimatedSeconds = queueInfo.total * avgInterval;
    const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
    document.getElementById("confirm-estimated-time").textContent =
      estimatedMinutes < 60
        ? `${estimatedMinutes} minutes`
        : `${Math.floor(estimatedMinutes / 60)} hours ${
            estimatedMinutes % 60
          } minutes`;

    const confirmBtn = document.getElementById("confirm-broadcast-btn");

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener("click", () => {
      hideModal("confirmation-modal");

      initiateBroadcasting();
    });
  };

  const initiateBroadcasting = () => {
    broadcaster.startBroadcast();

    elements.startBroadcastBtn.disabled = true;
    elements.pauseBroadcastBtn.disabled = false;
    elements.stopBroadcastBtn.disabled = false;
    elements.testMessageBtn.disabled = true;

    elements.progressIndicator.classList.add("active");

    addLog("Broadcasting started", "success");

    updateProgress();
  };

  const handlePauseBroadcast = () => {
    if (state.paused) {
      broadcaster.resumeBroadcast();
      elements.pauseBroadcastBtn.innerHTML =
        '<i class="fas fa-pause"></i> Pause';
    } else {
      broadcaster.pauseBroadcast();
      elements.pauseBroadcastBtn.innerHTML =
        '<i class="fas fa-play"></i> Resume';
    }
  };

  const handleStopBroadcast = () => {
    if (
      !confirm(
        "Are you sure you want to stop broadcasting? This cannot be resumed."
      )
    ) {
      return;
    }

    broadcaster.stopBroadcast();

    resetBroadcastUI();
  };

  const handleTestMessage = () => {
    if (!validateBroadcastInputs(true)) return;

    showModal("test-message-modal");

    renderTestMessageModal();

    const sendTestBtn = document.getElementById("send-test-message-btn");

    const newSendTestBtn = sendTestBtn.cloneNode(true);
    sendTestBtn.parentNode.replaceChild(newSendTestBtn, sendTestBtn);

    newSendTestBtn.addEventListener("click", async () => {
      const accountId = document.getElementById("test-account").value;
      const groupId = document.getElementById("test-group").value;

      if (!accountId || !groupId) {
        showToast("Please select an account and a group", "error");
        return;
      }

      const message = elements.messageInput.value.trim();

      newSendTestBtn.disabled = true;
      newSendTestBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Sending...';

      const success = await broadcaster.sendTestMessage(
        accountId,
        groupId,
        message
      );

      if (success) {
        hideModal("test-message-modal");
      }

      newSendTestBtn.disabled = false;
      newSendTestBtn.innerHTML = "Send Test Message";
    });
  };

  const handleClearLogs = () => {
    elements.logsContainer.innerHTML = "";

    addLog("Logs cleared", "info");
  };

  const handleExportLogs = () => {
    const logs = elements.logsContainer.querySelectorAll(".log-entry");

    if (logs.length === 0) {
      showToast("No logs to export", "error");
      return;
    }

    let logText = "TgNinja Broadcasting Logs\n";
    logText += `Generated: ${new Date().toLocaleString()}\n\n`;

    logs.forEach((log) => {
      const timeText = log.querySelector(".log-entry-time").textContent;
      const messageText = log.textContent.replace(timeText, "");
      logText += `${timeText} ${messageText.trim()}\n`;
    });

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `broadcast-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Logs exported successfully", "success");
  };

  const validateBroadcastInputs = (isTest = false) => {
    if (state.selectedAccounts.size === 0) {
      showToast("Please select at least one account", "error");
      return false;
    }

    if (state.selectedGroups.size === 0) {
      showToast("Please select at least one group", "error");
      return false;
    }

    const message = elements.messageInput.value.trim();
    if (!message) {
      showToast("Please enter a message", "error");
      return false;
    }

    if (!isTest) {
      const minInterval = parseInt(elements.intervalMin.value);
      const maxInterval = parseInt(elements.intervalMax.value);

      if (isNaN(minInterval) || minInterval < 5) {
        showToast("Minimum interval must be at least 5 seconds", "error");
        return false;
      }

      if (isNaN(maxInterval) || maxInterval < minInterval) {
        showToast(
          "Maximum interval must be greater than or equal to minimum interval",
          "error"
        );
        return false;
      }
    }

    return true;
  };

  const resetBroadcastUI = () => {
    elements.startBroadcastBtn.disabled = false;
    elements.pauseBroadcastBtn.disabled = true;
    elements.stopBroadcastBtn.disabled = true;
    elements.testMessageBtn.disabled = false;

    elements.pauseBroadcastBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';

    elements.progressIndicator.classList.remove("active");
  };

  const updateProgress = () => {
    const total = state.progress.total;
    const completed = state.progress.completed;
    const errors = state.progress.errors;

    if (total === 0) return;

    const percentage = Math.round(((completed + errors) / total) * 100);

    elements.progressFill.style.width = `${percentage}%`;

    elements.progressCount.textContent = `${completed + errors}/${total}`;

    if (state.broadcasting) {
      if (state.paused) {
        elements.progressStatus.textContent = "Paused";
      } else {
        elements.progressStatus.textContent = "Broadcasting...";
      }
    } else if (completed + errors === total && total > 0) {
      elements.progressStatus.textContent = "Completed";
    } else {
      elements.progressStatus.textContent = "Ready";
    }
  };

  const addLog = (message, type = "info") => {
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    const logEntry = document.createElement("div");
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
            <span class="log-entry-time">${timeString}</span>
            <span>${message}</span>
        `;

    elements.logsContainer.prepend(logEntry);

    const logs = elements.logsContainer.querySelectorAll(".log-entry");
    if (logs.length > 500) {
      elements.logsContainer.removeChild(logs[logs.length - 1]);
    }
  };

  const insertTextAtCursor = (textarea, text) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    textarea.value = value.substring(0, start) + text + value.substring(end);

    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const showModal = (modalId) => {
    elements.modalContainer.classList.add("active");
    document.getElementById(modalId).classList.add("active");
    document.body.style.overflow = "hidden";
  };

  const hideModal = (modalId) => {
    elements.modalContainer.classList.remove("active");
    document.getElementById(modalId).classList.remove("active");
    document.body.style.overflow = "";
  };

  const showToast = (message, type = "info") => {
    let toast = document.getElementById("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      document.body.appendChild(toast);

      const style = document.createElement("style");
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

    toast.textContent = message;
    toast.className = type;

    setTimeout(() => {
      toast.classList.add("visible");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("visible");
    }, 3000);
  };

  const loadAccountLists = async () => {
    try {
      const lists = await api.getAccountLists();
      state.accountLists = lists;
      renderAccountLists();
    } catch (error) {
      console.error("Error loading account lists:", error);
    }
  };

  const loadGroupLists = async () => {
    try {
      const lists = await api.getGroupLists();
      state.groupLists = lists;
      renderGroupLists();
    } catch (error) {
      console.error("Error loading group lists:", error);
    }
  };

  const loadAccounts = async (listId = "all") => {
    try {
      const accounts = await api.getAccounts(listId);
      state.accounts = accounts;
      renderAccounts();
    } catch (error) {
      console.error("Error loading accounts:", error);
    }
  };

  const loadGroups = async (listId = "all") => {
    try {
      const groups = await api.getGroups(listId);
      state.groups = groups;
      renderGroups();
    } catch (error) {
      console.error("Error loading groups:", error);
    }
  };

  const attachEventListeners = () => {
    elements.accountsFilter.addEventListener("change", handleAccountListChange);
    elements.groupsFilter.addEventListener("change", handleGroupListChange);

    elements.selectAllAccountsBtn.addEventListener(
      "click",
      handleSelectAllAccounts
    );
    elements.selectAllGroupsBtn.addEventListener(
      "click",
      handleSelectAllGroups
    );
    elements.clearAccountsBtn.addEventListener("click", handleClearAccounts);
    elements.clearGroupsBtn.addEventListener("click", handleClearGroups);

    elements.addImageBtn.addEventListener("click", handleAddImage);
    elements.imageUpload.addEventListener("change", handleImageUpload);
    elements.addPlaceholderBtn.addEventListener("click", handleAddPlaceholder);
    elements.saveTemplateBtn.addEventListener("click", handleSaveTemplate);
    elements.messageTemplate.addEventListener("change", handleLoadTemplate);

    elements.startBroadcastBtn.addEventListener("click", handleStartBroadcast);
    elements.pauseBroadcastBtn.addEventListener("click", handlePauseBroadcast);
    elements.stopBroadcastBtn.addEventListener("click", handleStopBroadcast);
    elements.testMessageBtn.addEventListener("click", handleTestMessage);

    elements.clearLogsBtn.addEventListener("click", handleClearLogs);
    elements.exportLogsBtn.addEventListener("click", handleExportLogs);

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        const modalId = button.dataset.closeModal;
        hideModal(modalId);
      });
    });
  };
  function showTemplateManagement() {
    renderTemplateList();

    showModal("manage-templates-modal");
  }
  function renderTemplateList(searchTerm = "") {
    const container = document.getElementById("templates-list-container");
    const emptyState = document.getElementById("empty-templates");

    const templates = Object.values(state.templates);

    const filteredTemplates = searchTerm
      ? templates.filter(
          (t) =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : templates;

    if (filteredTemplates.length === 0) {
      container.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

    filteredTemplates.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    container.innerHTML = filteredTemplates
      .map((template) => {
        const imageCount = template.images ? template.images.length : 0;
        const date = new Date(template.createdAt);
        const dateStr = date.toLocaleDateString();

        return `
                <div class="template-list-item" data-id="${template.id}">
                    <div class="template-name">${template.name}</div>
                    <div class="template-meta">
                        ${
                          imageCount > 0
                            ? `<div class="template-image-count">
                                <i class="fas fa-image"></i> ${imageCount}
                            </div>`
                            : ""
                        }
                        <div class="template-date">${dateStr}</div>
                        <div class="template-actions">
                            <button class="btn btn-icon btn-text view-template-btn" data-id="${
                              template.id
                            }" title="View template">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-icon btn-text load-template-btn" data-id="${
                              template.id
                            }" title="Load template">
                                <i class="fas fa-file-import"></i>
                            </button>
                            <button class="btn btn-icon btn-danger delete-template-btn" data-id="${
                              template.id
                            }" title="Delete template">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");

    container.querySelectorAll(".view-template-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const templateId = btn.dataset.id;
        viewTemplate(templateId);
      });
    });

    container.querySelectorAll(".load-template-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const templateId = btn.dataset.id;
        loadTemplateById(templateId);
        hideModal("manage-templates-modal");
      });
    });

    container.querySelectorAll(".delete-template-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const templateId = btn.dataset.id;
        deleteTemplate(templateId);
      });
    });

    container.querySelectorAll(".template-list-item").forEach((item) => {
      item.addEventListener("click", () => {
        const templateId = item.dataset.id;
        viewTemplate(templateId);
      });
    });
  }
  function viewTemplate(templateId) {
    const template = state.templates[templateId];
    if (!template) return;

    document.getElementById("view-template-title").textContent = template.name;
    document.getElementById("view-template-description").textContent =
      template.description || "No description provided.";
    document.getElementById("view-template-message").textContent =
      template.message;

    const imageSection = document.getElementById(
      "view-template-images-section"
    );
    const imageContainer = document.getElementById("view-template-images");
    const imageCount = document.getElementById("view-template-image-count");

    if (template.images && template.images.length > 0) {
      imageSection.style.display = "block";
      imageCount.textContent = template.images.length;

      imageContainer.innerHTML = template.images
        .map(
          (img) => `
                <div class="template-image-item">
                    <img src="${img.url}" alt="Template image">
                </div>
            `
        )
        .join("");
    } else {
      imageSection.style.display = "none";
      imageContainer.innerHTML = "";
      imageCount.textContent = "0";
    }

    const loadBtn = document.getElementById("load-viewed-template-btn");

    const newLoadBtn = loadBtn.cloneNode(true);
    loadBtn.parentNode.replaceChild(newLoadBtn, loadBtn);

    newLoadBtn.addEventListener("click", () => {
      loadTemplateById(templateId);
      hideModal("view-template-modal");
    });

    showModal("view-template-modal");
  }
  function loadTemplateById(templateId) {
    const template = state.templates[templateId];
    if (!template) return;

    if (state.images.length > 0 || elements.messageInput.value.trim()) {
      if (
        !confirm(
          "This will replace your current message and images. Are you sure?"
        )
      ) {
        return;
      }
    }

    elements.messageInput.value = template.message;

    state.images = [];

    if (template.images && template.images.length > 0) {
      template.images.forEach((img) => {
        state.images.push({
          url: img.url,
          uploaded: img.uploaded || true,
          file: null,
        });
      });
    }

    renderImagePreviews();

    showToast(`Template "${template.name}" loaded`, "success");
  }
  function deleteTemplate(templateId) {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      const templates = JSON.parse(
        localStorage.getItem("broadcaster_templates") || "{}"
      );

      delete templates[templateId];

      localStorage.setItem("broadcaster_templates", JSON.stringify(templates));

      state.templates = templates;

      renderTemplateList();

      showToast("Template deleted successfully", "success");
    } catch (error) {
      console.error("Error deleting template:", error);
      showToast("Error deleting template", "error");
    }
  }
  document
    .getElementById("template-search-input")
    .addEventListener("input", (e) => {
      renderTemplateList(e.target.value.trim());
    });

  document.getElementById("new-template-btn").addEventListener("click", () => {
    hideModal("manage-templates-modal");
    handleSaveTemplate();
  });
  function setupTemplateManagement() {
    const templateSection = document.querySelector(".message-options");

    const templateDropdown = document.getElementById("message-template");
    if (templateDropdown) {
      const templateButton = document.createElement("button");
      templateButton.id = "manage-templates-btn";
      templateButton.className = "btn btn-secondary";
      templateButton.innerHTML = '<i class="fas fa-file-alt"></i> Templates';
      templateDropdown.parentNode.replaceChild(
        templateButton,
        templateDropdown
      );

      templateButton.addEventListener("click", showTemplateManagement);
    }
  }

  const init = async () => {
    await Promise.all([loadAccountLists(), loadGroupLists()]);

    await Promise.all([loadAccounts("all"), loadGroups("all")]);

    renderTemplates();
    setupTemplateManagement();

    addLog("Broadcasting system initialized and ready.", "info");

    attachEventListeners();
  };
  function showTemplateManagement() {
    renderTemplateList();

    showModal("manage-templates-modal");
  }

  init();
});
