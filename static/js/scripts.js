document.addEventListener("DOMContentLoaded", function () {
  const state = {
    accounts: [],
    lists: [],
    proxies: [],
    currentListId: "all",
    selectedAccounts: new Set(),
  };

  const elements = {
    accountsTableBody: document.getElementById("accounts-table-body"),
    accountLists: document.getElementById("account-lists"),
    accountStats: document.getElementById("account-stats"),
    emptyState: document.getElementById("empty-state"),
    currentListName: document.getElementById("current-list-name"),
    searchInput: document.getElementById("search-input"),
    selectAllCheckbox: document.getElementById("select-all-checkbox"),
    selectionActions: document.getElementById("selection-actions"),
    selectedCount: document.getElementById("selected-count"),
    checkSelectedBtn: document.getElementById("check-selected-btn"),
    moveSelectedBtn: document.getElementById("move-selected-btn"),
    deleteSelectedBtn: document.getElementById("delete-selected-btn"),
    modalContainer: document.getElementById("modal-container"),
    addAccountBtn: document.getElementById("add-account-btn"),
    emptyAddBtn: document.getElementById("empty-add-btn"),
    addListBtn: document.getElementById("add-list-btn"),
    closeWarningBtn: document.getElementById("warning-confirm-btn"),
  };
  const pageUrls = {
    'accounts': '/index.html',
    'proxies': '/proxies.html',
    'parser': '/group-parser.html',
    'broadcaster': '/broadcaster.html'
};

  const api = {
    async getAccounts(listId = "all") {
      try {
        const timestamp = new Date().getTime();
        const url = `/api/accounts?list_id=${listId}&_=${timestamp}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch accounts");

        return await response.json();
      } catch (error) {
        console.error("Error fetching accounts:", error);
        showToast("Error loading accounts", "error");
        return [];
      }
    },
    async getProxies() {
      try {
        const response = await fetch("/api/proxies");
        if (!response.ok) throw new Error("Failed to fetch proxies");
        return await response.json();
      } catch (error) {
        console.error("Error fetching proxies:", error);
        showToast("Error loading proxies", "error");
        return [];
      }
    },

    async createProxy(proxyData) {
      try {
        const response = await fetch("/api/proxies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(proxyData),
        });
        if (!response.ok) throw new Error("Failed to create proxy");
        return await response.json();
      } catch (error) {
        console.error("Error creating proxy:", error);
        showToast("Error creating proxy", "error");
        return null;
      }
    },

    async testProxy(proxyData) {
      try {
        const response = await fetch("/api/proxies/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(proxyData),
        });
        if (!response.ok) throw new Error("Failed to test proxy");
        return await response.json();
      } catch (error) {
        console.error("Error testing proxy:", error);
        showToast("Error testing proxy", "error");
        return {
          success: false,
          error: error.message,
        };
      }
    },

    async updateAccountProxy(accountId, proxyId) {
      try {
        const response = await fetch(`/api/accounts/${accountId}/proxy`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proxy_id: proxyId }),
        });
        if (!response.ok) throw new Error("Failed to update account proxy");
        return await response.json();
      } catch (error) {
        console.error("Error updating account proxy:", error);
        showToast("Error updating proxy association", "error");
        return null;
      }
    },
    async getAccount(accountId) {
      try {
        const response = await fetch(`/api/accounts/${accountId}`);
        if (!response.ok) throw new Error("Failed to fetch account");
        return await response.json();
      } catch (error) {
        console.error("Error fetching account:", error);
        showToast("Error loading account details", "error");
        return null;
      }
    },

    async createAccount(accountData) {
      try {
        const response = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accountData),
        });
        if (!response.ok) throw new Error("Failed to create account");
        return await response.json();
      } catch (error) {
        console.error("Error creating account:", error);
        showToast("Error creating account", "error");
        return null;
      }
    },

    async updateAccount(accountId, accountData) {
      try {
        const response = await fetch(`/api/accounts/${accountId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accountData),
        });
        if (!response.ok) throw new Error("Failed to update account");
        return await response.json();
      } catch (error) {
        console.error("Error updating account:", error);
        showToast("Error updating account", "error");
        return null;
      }
    },

    async deleteAccount(accountId) {
      try {
        const response = await fetch(`/api/accounts/${accountId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete account");
        return await response.json();
      } catch (error) {
        console.error("Error deleting account:", error);
        showToast("Error deleting account", "error");
        return null;
      }
    },

    async bulkDeleteAccounts(accountIds) {
      try {
        const response = await fetch("/api/accounts/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_ids: accountIds }),
        });
        if (!response.ok) throw new Error("Failed to delete accounts");
        return await response.json();
      } catch (error) {
        console.error("Error deleting accounts:", error);
        showToast("Error deleting accounts", "error");
        return null;
      }
    },

    async checkAccounts(accountIds) {
      try {
        const response = await fetch("/api/accounts/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_ids: accountIds }),
        });
        if (!response.ok) throw new Error("Failed to check accounts");
        return await response.json();
      } catch (error) {
        console.error("Error checking accounts:", error);
        showToast("Error checking accounts", "error");
        return null;
      }
    },

    async moveAccounts(accountIds, targetListId) {
      try {
        const response = await fetch("/api/accounts/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_ids: accountIds,
            target_list_id: targetListId,
          }),
        });
        if (!response.ok) throw new Error("Failed to move accounts");
        return await response.json();
      } catch (error) {
        console.error("Error moving accounts:", error);
        showToast("Error moving accounts", "error");
        return null;
      }
    },

    async uploadAvatar(file) {
      try {
        const formData = new FormData();
        formData.append("avatar", file);

        const response = await fetch("/api/accounts/upload-avatar", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Failed to upload avatar");
        return await response.json();
      } catch (error) {
        console.error("Error uploading avatar:", error);
        showToast("Error uploading avatar", "error");
        return null;
      }
    },

    async getLists() {
      try {
        const response = await fetch("/api/account-lists");
        if (!response.ok) throw new Error("Failed to fetch lists");
        return await response.json();
      } catch (error) {
        console.error("Error fetching lists:", error);
        showToast("Error loading account lists", "error");
        return [];
      }
    },

    async createList(listData) {
      try {
        const response = await fetch("/api/account-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(listData),
        });
        if (!response.ok) throw new Error("Failed to create list");
        return await response.json();
      } catch (error) {
        console.error("Error creating list:", error);
        showToast("Error creating list", "error");
        return null;
      }
    },

    async updateList(listId, listData) {
      try {
        const response = await fetch(`/api/account-lists/${listId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(listData),
        });
        if (!response.ok) throw new Error("Failed to update list");
        return await response.json();
      } catch (error) {
        console.error("Error updating list:", error);
        showToast("Error updating list", "error");
        return null;
      }
    },

    async deleteList(listId) {
      try {
        const response = await fetch(`/api/account-lists/${listId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete list");
        return await response.json();
      } catch (error) {
        console.error("Error deleting list:", error);
        showToast("Error deleting list", "error");
        return null;
      }
    },

    async getStats(listId = "all") {
      try {
        const response = await fetch(`/api/stats?list_id=${listId}`);
        if (!response.ok) throw new Error("Failed to fetch stats");
        return await response.json();
      } catch (error) {
        console.error("Error fetching stats:", error);
        showToast("Error loading account statistics", "error");
        return null;
      }
    },

    async importTData(files) {
      try {
        const formData = new FormData();
        for (const file of files) {
          formData.append("tdata", file);
        }

        const response = await fetch("/api/accounts/import-tdata", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Failed to import TData");
        return await response.json();
      } catch (error) {
        console.error("Error importing TData:", error);
        showToast("Error importing TData", "error");
        return null;
      }
    },
  };
  const updateProxyDropdowns = () => {
    const accountProxy = document.getElementById("account-proxy");
    if (accountProxy) {
      let options = '<option value="">-- Select Proxy --</option>';

      state.proxies.forEach((proxy) => {
        const accountCount = proxy.accounts ? proxy.accounts.length : 0;
        const isFull = accountCount >= 3;

        options += `<option value="${proxy.id}" ${isFull ? "disabled" : ""}>
                    ${proxy.host}:${proxy.port} (${accountCount}/3)
                </option>`;
      });

      accountProxy.innerHTML = options;

      const saveAccountBtn = document.getElementById("save-account-btn");
      if (saveAccountBtn) {
        saveAccountBtn.disabled = state.proxies.length === 0;
      }
    }

    [
      "tdata-selected-proxy",
      "session-selected-proxy",
      "phone-selected-proxy",
    ].forEach((id) => {
      const proxyDisplay = document.getElementById(id);
      if (proxyDisplay && accountProxy) {
        const selectedProxy = accountProxy.options[accountProxy.selectedIndex];
        if (selectedProxy && selectedProxy.value) {
          proxyDisplay.textContent = selectedProxy.textContent.trim();
        } else {
          proxyDisplay.textContent = "None";
        }
      }
    });
  };
  const handleProxyChange = async (event) => {
    const select = event.target;
    const accountId = select.dataset.accountId;
    const proxyId = select.value;

    select.disabled = true;
    const originalHtml = select.parentNode.innerHTML;
    select.parentNode.innerHTML = `<div class="proxy-loading"><i class="fas fa-spinner fa-spin"></i> Updating...</div>`;

    try {
      const result = await api.updateAccountProxy(accountId, proxyId);

      if (result) {
        showToast("Proxy updated successfully", "success");

        const accountIndex = state.accounts.findIndex(
          (acc) => acc.id === accountId
        );
        if (accountIndex !== -1) {
          state.accounts[accountIndex].proxy_id = proxyId;
        }

        if (proxyId) {
          const proxyIndex = state.proxies.findIndex((p) => p.id === proxyId);
          if (proxyIndex !== -1) {
            if (!state.proxies[proxyIndex].accounts) {
              state.proxies[proxyIndex].accounts = [];
            }

            if (!state.proxies[proxyIndex].accounts.includes(accountId)) {
              state.proxies[proxyIndex].accounts.push(accountId);
            }
          }
        }

        await loadAccounts(state.currentListId);
      } else {
        showToast("Failed to update proxy", "error");
        select.parentNode.innerHTML = originalHtml;
        document
          .querySelector(`select[data-account-id="${accountId}"]`)
          .addEventListener("change", handleProxyChange);
      }
    } catch (error) {
      console.error("Error updating proxy:", error);
      showToast("Error updating proxy", "error");
      select.parentNode.innerHTML = originalHtml;
      document
        .querySelector(`select[data-account-id="${accountId}"]`)
        .addEventListener("change", handleProxyChange);
    }
  };

  const renderAccounts = (accounts) => {
    if (!accounts.length) {
      elements.emptyState.style.display = "flex";
      elements.accountsTableBody.innerHTML = "";
      return;
    }

    elements.emptyState.style.display = "none";
    elements.accountsTableBody.innerHTML = accounts
      .map((account) => {
        const getAvatarDisplay = () => {
          if (account.avatar) {
            const isValidAvatar =
              account.avatar.startsWith("http") ||
              account.avatar.startsWith("/uploads") ||
              account.avatar.startsWith("data:image");

            if (isValidAvatar) {
              return `<img src="${account.avatar}" alt="${account.name}">`;
            }
          }

          return `<i class="fas fa-user"></i>`;
        };

        const proxy = account.proxy_id
          ? state.proxies.find((p) => p.id === account.proxy_id)
          : null;

        const proxyDropdown = `
                <div class="proxy-select-wrapper">
                    <select class="account-proxy-select" data-account-id="${
                      account.id
                    }">
                        <option value="">-- Select Proxy --</option>
                        ${state.proxies
                          .map((p) => {
                            const accountCount = p.accounts
                              ? p.accounts.length
                              : 0;
                            const isFull =
                              accountCount >= 3 &&
                              !p.accounts.includes(account.id);

                            return `<option value="${p.id}" ${
                              account.proxy_id === p.id ? "selected" : ""
                            } ${isFull ? "disabled" : ""}>
                                ${p.host}:${p.port} (${accountCount}/3)
                            </option>`;
                          })
                          .join("")}
                    </select>
                </div>
                ${
                  proxy
                    ? `
                <div class="proxy-status ${proxy.status || "untested"}">
                    <i class="fas fa-${
                      proxy.status === "online"
                        ? "check-circle"
                        : proxy.status === "offline"
                        ? "times-circle"
                        : "question-circle"
                    }"></i>
                    ${
                      proxy.status === "online"
                        ? "Online"
                        : proxy.status === "offline"
                        ? "Offline"
                        : "Untested"
                    }
                </div>`
                    : ""
                }
            `;

        return `
            <tr data-id="${account.id}">
                <td class="checkbox-col">
                    <input type="checkbox" class="account-checkbox" data-id="${
                      account.id
                    }">
                </td>
                <td>
                    <div class="account-info">
                        <div class="account-avatar">
                            ${getAvatarDisplay()}
                        </div>
                        <div class="account-details">
                            <div class="account-name">${account.name}</div>
                            <div class="account-username">${
                              account.username || ""
                            }</div>
                        </div>
                    </div>
                </td>
                <td>${account.phone}</td>
                <td>
                    ${getStatusBadge(account.status, account.cooldown_until)}
                </td>
                <td>
                    ${
                      account.premium
                        ? `<div class="premium-badge"><i class="fas fa-star"></i> Premium</div>`
                        : ""
                    }
                </td>
                <td class="proxy-column">
                    <div class="account-proxy">
                        ${proxyDropdown}
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-icon btn-text edit-account-btn" data-id="${
                          account.id
                        }" title="Edit account">
                            <i class="fas fa-pencil"></i>
                        </button>
                        <button class="btn btn-icon btn-danger delete-account-btn" data-id="${
                          account.id
                        }" title="Delete account">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
      })
      .join("");

    attachAccountEventListeners();

    document.querySelectorAll(".account-proxy-select").forEach((select) => {
      select.addEventListener("change", handleProxyChange);
    });
  };

  const renderLists = (lists) => {
    const customListsHtml = lists
      .map(
        (list) => `
            <li data-list-id="${list.id}" ${
          state.currentListId === list.id ? 'class="active"' : ""
        }>
                <i class="fas fa-list"></i>
                <span>${list.name}</span>
                <span class="account-count">0</span>
            </li>
        `
      )
      .join("");

    const allAccountsItem = `
            <li data-list-id="all" ${
              state.currentListId === "all" ? 'class="active"' : ""
            }>
                <i class="fas fa-layer-group"></i>
                <span>All Accounts</span>
                <span class="account-count">0</span>
            </li>
        `;

    elements.accountLists.innerHTML = allAccountsItem + customListsHtml;

    attachListEventListeners();

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

    updateAccountCounts(stats.all);
  };

  const debugAccountLoading = async () => {
    console.log("Debug: Starting account loading diagnostics");
    try {
      console.log("Debug: Testing API endpoint directly");
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/accounts?list_id=all&_=${timestamp}`);

      if (!response.ok) {
        console.error(
          `Debug: API request failed with status ${response.status}`
        );
        const responseText = await response.text();
        console.error(`Debug: Response: ${responseText}`);
      } else {
        const data = await response.json();
        console.log(`Debug: API returned ${data.length} accounts`);
        console.log("Debug: Account data sample:", data.slice(0, 2));

        if (data.length === 0) {
          console.log("Debug: No accounts found - checking accounts file");

          try {
            const fileResponse = await fetch("/data/accounts.json");
            if (fileResponse.ok) {
              const fileData = await fileResponse.json();
              console.log(
                `Debug: accounts.json contains ${fileData.length} accounts`
              );
            } else {
              console.log(
                `Debug: Could not access accounts.json, status: ${fileResponse.status}`
              );
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
      const timestamp = new Date().getTime();
      const allAccounts = await api.getAccounts("all", timestamp);

      const allAccountsCount = document.querySelector(
        'li[data-list-id="all"] .account-count'
      );
      if (allAccountsCount) {
        allAccountsCount.textContent = allAccounts.length;
      }

      state.lists.forEach((list) => {
        const listCount = allAccounts.filter(
          (acc) =>
            (acc.list_ids && acc.list_ids.includes(list.id)) ||
            acc.list_id === list.id
        ).length;

        const listCountElement = document.querySelector(
          `li[data-list-id="${list.id}"] .account-count`
        );
        if (listCountElement) {
          listCountElement.textContent = listCount;
        }
      });
    } catch (error) {
      console.error("Error updating account counts:", error);
    }
  };

  const updateListDropdowns = (lists) => {
    const accountListDropdown = document.getElementById("account-list");
    if (accountListDropdown) {
      accountListDropdown.innerHTML = lists
        .map((list) => `<option value="${list.id}">${list.name}</option>`)
        .join("");
    }

    const targetListDropdown = document.getElementById("target-list");
    if (targetListDropdown) {
      targetListDropdown.innerHTML = lists
        .map((list) => `<option value="${list.id}">${list.name}</option>`)
        .join("");
    }
  };

  const getStatusBadge = (status, cooldownUntil) => {
    let badgeClass = "";
    let icon = "";

    switch (status) {
      case "Ок":
        badgeClass = "ok";
        icon = "check-circle";
        break;
      case "Заблокирован":
        badgeClass = "blocked";
        icon = "ban";
        break;
      case "Временный блок":
        badgeClass = "temp-block";
        icon = "clock";
        break;
      case "Не авторизован":
        badgeClass = "unverified";
        icon = "user-clock";
        break;
      case "Ошибка проверки":
        badgeClass = "error";
        icon = "exclamation-circle";
        break;
      default:
        badgeClass = "unverified";
        icon = "question-circle";
    }

    let statusText = status;

    if (cooldownUntil && status === "Временный блок") {
      const cooldownDate = new Date(cooldownUntil);
      const now = new Date();

      if (cooldownDate > now) {
        const hoursDiff = Math.round((cooldownDate - now) / (1000 * 60 * 60));
        statusText += ` (${hoursDiff}ч)`;
      }
    }

    return `<div class="status-badge ${badgeClass}"><i class="fas fa-${icon}"></i> ${statusText}</div>`;
  };

  const handleListClick = async (event) => {
    const listItem = event.target.closest("li");
    if (!listItem) return;

    const listId = listItem.dataset.listId;

    document.querySelectorAll("#account-lists li").forEach((item) => {
      item.classList.remove("active");
    });
    listItem.classList.add("active");

    state.currentListId = listId;
    state.selectedAccounts.clear();
    updateSelectionUI();

    elements.currentListName.textContent =
      listId === "all"
        ? "All Accounts"
        : state.lists.find((l) => l.id === listId)?.name || "Accounts";

    await loadAccounts(listId);

    await loadStats(listId);

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

    document.querySelectorAll(".account-checkbox").forEach((checkbox) => {
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
  function showWarning() {
    document.getElementById('proxy-warning-popup').style.display = 'flex';
  }
  function closeWarning() {
    document.getElementById('proxy-warning-popup').style.display = 'none';
  }
  const handleAddAccountClick = () => {
    if (state.proxies.length === 0) {
      showWarning();
      return;
    }

    showModal("account-import-modal");

    document.querySelectorAll(".import-option").forEach((option) => {
      option.classList.remove("selected");
    });

    updateProxyDropdowns();

    const continueBtn = document.getElementById("continue-import-btn");
    if (continueBtn) {
      const newContinueBtn = continueBtn.cloneNode(true);
      continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);

      newContinueBtn.addEventListener("click", handleContinueImport);
    }

    document.querySelectorAll(".import-option").forEach((option) => {
      option.addEventListener("click", function () {
        document.querySelectorAll(".import-option").forEach((o) => {
          o.classList.remove("selected");
        });

        this.classList.add("selected");
      });
    });
  };
  const handleContinueImport = () => {
    const selectedOption = document.querySelector(".import-option.selected");
    if (!selectedOption) {
      showToast("Please select an import method", "error");
      return;
    }
  
    const proxySelect = document.getElementById("account-proxy");
    if (!proxySelect || !proxySelect.value) {
      showToast("Please select a proxy", "error");
      return;
    }
  
    const proxyId = proxySelect.value;
    const importMethod = selectedOption.dataset.option;
  
    hideModal("account-import-modal");
  
    switch (importMethod) {
      case "session":
        showModal("session-import-modal");
        setupSessionImport(proxyId);
        break;
      case "tdata":
        showModal("tdata-import-modal");
        setupTDataImport(proxyId);
        break;
      case "phone":
        showModal("phone-import-modal");
        setupPhoneImport(proxyId);
        break;
      default:
        showToast("Invalid import method", "error");
        break;
    }
  }
  const setupSessionImport = (proxyId) => {
    const backBtn = document.getElementById(
      "back-to-import-options-btn-session"
    );
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        hideModal("session-import-modal");
        showModal("account-import-modal");
      });
    }

    const sessionUploadArea = document.getElementById("session-upload-area");
    const jsonUploadArea = document.getElementById("json-upload-area");

    if (sessionUploadArea) {
      sessionUploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        sessionUploadArea.classList.add("dragover");
      });

      sessionUploadArea.addEventListener("dragleave", (e) => {
        e.preventDefault();
        sessionUploadArea.classList.remove("dragover");
      });

      sessionUploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        sessionUploadArea.classList.remove("dragover");

        if (e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.name.endsWith(".session")) {
            handleSessionFileSelect(file);
          } else {
            showToast("Please select a .session file", "error");
          }
        }
      });
    }

    if (jsonUploadArea) {
      jsonUploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        jsonUploadArea.classList.add("dragover");
      });

      jsonUploadArea.addEventListener("dragleave", (e) => {
        e.preventDefault();
        jsonUploadArea.classList.remove("dragover");
      });

      jsonUploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        jsonUploadArea.classList.remove("dragover");

        if (e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.name.endsWith(".json")) {
            handleJsonFileSelect(file);
          } else {
            showToast("Please select a .json file", "error");
          }
        }
      });
    }

    const sessionFileInput = document.getElementById("session-file-input");
    const jsonFileInput = document.getElementById("json-file-input");

    if (sessionFileInput) {
      sessionFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
          handleSessionFileSelect(e.target.files[0]);
        }
      });
    }

    if (jsonFileInput) {
      jsonFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
          handleJsonFileSelect(e.target.files[0]);
        }
      });
    }

    const proxyDisplay = document.getElementById("session-selected-proxy");
    if (proxyDisplay) {
      const selectedProxy = state.proxies.find((p) => p.id === proxyId);
      if (selectedProxy) {
        proxyDisplay.textContent = `${selectedProxy.host}:${selectedProxy.port}`;
      } else {
        proxyDisplay.textContent = "None";
      }
    }

    const accountListSelect = document.getElementById("account-list");
  if (accountListSelect) {
    let options = "";
    state.lists.forEach((list) => {
      options += `<option value="${list.id}">${list.name}</option>`;
    });
    accountListSelect.innerHTML = options;
  }

    const importBtn = document.getElementById("import-session-btn");
    if (importBtn) {
      const newImportBtn = importBtn.cloneNode(true);
      importBtn.parentNode.replaceChild(newImportBtn, importBtn);

      newImportBtn.addEventListener("click", () => {
        handleSessionImport(proxyId);
      });
    }
  };
  const handleSessionImport = async (proxyId) => {
    if (!elements.sessionFileInput.files.length) {
      showToast("Please select a session file", "error");
      return;
    }
  
    const sessionFile = elements.sessionFileInput.files[0];
    const jsonFile = elements.jsonFileInput.files.length 
      ? elements.jsonFileInput.files[0] 
      : null;
    const listId = elements.sessionAccountList.value;
    const customName = elements.sessionAccountName.value.trim();
  
    elements.importSessionBtn.disabled = true;
    elements.importSessionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
  
    try {
      const formData = new FormData();
      formData.append("session_file", sessionFile);
  
      if (jsonFile) {
        formData.append("json_file", jsonFile);
      }
  
      formData.append("list_id", listId);
      formData.append("proxy_id", proxyId);
  
      if (customName) {
        formData.append("name", customName);
      }
  
      const response = await fetch("/api/accounts/import-session", {
        method: "POST",
        body: formData,
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import account");
      }
  
      const result = await response.json();
  
      showToast("Account imported successfully", "success");
      hideModal("session-import-modal");
  
      await loadAccounts(state.currentListId);
      await loadStats(state.currentListId);
    } catch (error) {
      console.error("Error importing session:", error);
      showToast("Error importing account: " + error.message, "error");
    } finally {
      elements.importSessionBtn.disabled = false;
      elements.importSessionBtn.innerHTML = "Import Account";
    }
  };
  const setupPhoneImport = (proxyId) => {
    const backBtn = document.getElementById("back-to-import-options-btn-phone");
    if (backBtn) {
      const newBackBtn = backBtn.cloneNode(true);
      backBtn.parentNode.replaceChild(newBackBtn, backBtn);
  
      newBackBtn.addEventListener("click", () => {
        hideModal("phone-import-modal");
        showModal("account-import-modal");
      });
    }
  
    // Reset form state
    document.getElementById("phone-import-form").reset();
    document.getElementById("avatar-preview").innerHTML = '<i class="fas fa-user"></i>';
    document.getElementById("avatar-url").value = "";
    document.getElementById("verification-code-row").style.display = "none";
    document.getElementById("phone-import-footer").style.display = "block";
    document.getElementById("phone-verify-footer").style.display = "none";
  
    // Update the proxy display
    const proxyDisplay = document.getElementById("phone-selected-proxy");
    if (proxyDisplay) {
      const proxy = state.proxies.find(p => p.id === proxyId);
      if (proxy) {
        proxyDisplay.textContent = `${proxy.host}:${proxy.port}`;
      } else {
        proxyDisplay.textContent = "None";
      }
    }
  
    // Setup account list dropdown
    const accountListSelect = document.getElementById("account-list");
    if (accountListSelect) {
      let options = "";
      state.lists.forEach((list) => {
        options += `<option value="${list.id}">${list.name}</option>`;
      });
      accountListSelect.innerHTML = options;
    }
  
    // Setup avatar upload
    setupAvatarUpload();
  
    // Replace the request code button with a new one to prevent duplicate event listeners
    const requestCodeBtn = document.getElementById("request-code-btn");
    if (requestCodeBtn) {
      const newRequestCodeBtn = requestCodeBtn.cloneNode(true);
      requestCodeBtn.parentNode.replaceChild(newRequestCodeBtn, requestCodeBtn);
      
      newRequestCodeBtn.addEventListener("click", () => {
        handleRequestCode(proxyId);
      });
    }
  
    // Replace the verify code button with a new one to prevent duplicate event listeners
    const verifyCodeBtn = document.getElementById("verify-code-btn");
    if (verifyCodeBtn) {
      const newVerifyCodeBtn = verifyCodeBtn.cloneNode(true);
      verifyCodeBtn.parentNode.replaceChild(newVerifyCodeBtn, verifyCodeBtn);
      
      newVerifyCodeBtn.addEventListener("click", () => {
        handleVerifyCode(proxyId);
      });
    }
  
    // Replace the back to phone input button with a new one to prevent duplicate event listeners
    const backToPhoneBtn = document.getElementById("back-to-phone-input-btn");
    if (backToPhoneBtn) {
      const newBackToPhoneBtn = backToPhoneBtn.cloneNode(true);
      backToPhoneBtn.parentNode.replaceChild(newBackToPhoneBtn, backToPhoneBtn);
      
      newBackToPhoneBtn.addEventListener("click", () => {
        document.getElementById("phone-import-footer").style.display = "block";
        document.getElementById("phone-verify-footer").style.display = "none";
        document.getElementById("verification-code-row").style.display = "none";
      });
    }
  }
  
  const handleSessionFileSelect = (file) => {
    const fileInfo = document.getElementById("session-file-info");
    if (fileInfo) {
      fileInfo.textContent = `Selected file: ${file.name} (${formatFileSize(
        file.size
      )})`;
    }
  };
  const setupFileUpload = (fileInput, uploadArea, infoElement, fileExtension) => {
    if (!fileInput || !uploadArea || !infoElement) return;
  
    fileInput.value = "";
  
    // Replace the input with a clone to remove any existing event listeners
    const newFileInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newFileInput, fileInput);
    
    newFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file.name.endsWith(fileExtension)) {
          infoElement.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
          infoElement.style.display = "block";
        } else {
          showToast(`Please select a ${fileExtension} file`, "error");
        }
      }
    });
  
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });
  
    uploadArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
    });
  
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
  
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith(fileExtension)) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          newFileInput.files = dataTransfer.files;
  
          infoElement.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
          infoElement.style.display = "block";
        } else {
          showToast(`Please select a ${fileExtension} file`, "error");
        }
      }
    });
  
    // Handle browse file button
    const browseBtn = uploadArea.querySelector("label.btn");
    if (browseBtn) {
      browseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        newFileInput.click();
      });
    }
  
    // Click on upload area to select file
    uploadArea.addEventListener("click", (e) => {
      if (e.target === uploadArea || !e.target.closest('label')) {
        newFileInput.click();
      }
    });
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) {
      return bytes + " B";
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + " KB";
    } else {
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }
  };
  const setupAvatarUpload = () => {
    const input = document.getElementById("avatar-input");
    const preview = document.getElementById("avatar-preview");
    const urlInput = document.getElementById("avatar-url");
  
    if (!input || !preview) return;
  
    input.value = "";
  
    // Replace the input with a clone to remove any existing event listeners
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
  
    newInput.addEventListener("change", async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
  
        if (!file.type.startsWith("image/")) {
          showToast("Please select an image file", "error");
          return;
        }
  
        try {
          const formData = new FormData();
          formData.append("avatar", file);
  
          const response = await fetch("/api/accounts/upload-avatar", {
            method: "POST",
            body: formData,
          });
  
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to upload avatar");
          }
  
          const result = await response.json();
  
          if (result.url) {
            preview.innerHTML = `<img src="${result.url}" alt="Avatar">`;
            urlInput.value = result.url;
          } else {
            throw new Error("No URL returned from server");
          }
        } catch (error) {
          console.error("Error uploading avatar:", error);
          showToast("Error uploading avatar: " + error.message, "error");
        }
      }
    });
  
    // Handle avatar upload button click
    const uploadBtn = preview.parentNode.querySelector(".avatar-upload-btn");
    if (uploadBtn) {
      uploadBtn.addEventListener("click", (e) => {
        e.preventDefault();
        newInput.click();
      });
    }
  }
    
  const handleTDataImport = async (proxyId) => {
    const tdataFile = document.getElementById("tdata-input").files[0];
    if (!tdataFile) {
      showToast("Please select a TData ZIP file", "error");
      return;
    }
  
    const listId = document.getElementById("tdata-account-list").value;
    const submitBtn = document.getElementById("import-tdata-submit-btn");
    const progressBar = document.getElementById("upload-progress-bar");
    const statusText = document.getElementById("upload-status-text");
  
    if (submitBtn) submitBtn.disabled = false;
    if (statusText) statusText.textContent = "Uploading and processing TData...";
  
    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      if (progress > 90) {
        clearInterval(interval);
      }
      if (progressBar) progressBar.style.width = `${progress}%`;
    }, 300);
  
    try {
      const formData = new FormData();
      formData.append("tdata_zip", tdataFile);
      formData.append("target_list_id", listId);
      formData.append("proxy_id", proxyId);
  
      const response = await fetch("/api/accounts/import-tdata-zip", {
        method: "POST",
        body: formData,
      });
  
      clearInterval(interval);
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import TData");
      }
  
      const result = await response.json();
  
      if (progressBar) progressBar.style.width = "100%";
      if (statusText) statusText.textContent = "TData imported successfully!";
  
      setTimeout(() => {
        hideModal("tdata-import-modal");
        showToast("Account imported successfully", "success");
        
        loadAccounts(state.currentListId);
        loadStats(state.currentListId);
      }, 1000);
    } catch (error) {
      console.error("Error importing TData:", error);
      
      if (progressBar) progressBar.style.width = "0%";
      if (statusText) statusText.textContent = `Error: ${error.message}`;
      if (submitBtn) submitBtn.disabled = false;
      
      showToast(`Error: ${error.message}`, "error");
    }
  };

  const handleRequestCode = async (proxyId) => {
    const nameInput = document.getElementById("name");
    const phoneInput = document.getElementById("phone");
  
    if (!nameInput.value.trim()) {
      showToast("Please enter a name", "error");
      nameInput.focus();
      return;
    }
  
    if (!phoneInput.value.trim()) {
      showToast("Please enter a phone number", "error");
      phoneInput.focus();
      return;
    }
  
    const requestBtn = document.getElementById("request-code-btn");
    if (requestBtn) {
      requestBtn.disabled = true;
      requestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Requesting...';
    }
  
    try {
      const response = await fetch("/api/accounts/request-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phoneInput.value.trim(),
          proxy_id: proxyId,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to request verification code");
      }
  
      const result = await response.json();
  
      if (result.success) {
        document.getElementById("verification-code-row").style.display = "block";
        document.getElementById("phone-import-footer").style.display = "none";
        document.getElementById("phone-verify-footer").style.display = "block";
  
        showToast("Verification code sent to your Telegram app", "success");
  
        setTimeout(() => {
          document.getElementById("verification-code").focus();
        }, 100);
      } else {
        throw new Error(result.error || "Failed to request verification code");
      }
    } catch (error) {
      console.error("Error requesting code:", error);
      showToast("Error: " + error.message, "error");
    } finally {
      if (requestBtn) {
        requestBtn.disabled = false;
        requestBtn.innerHTML = "Request Code";
      }
    }
  };

  const handleVerifyCode = async (proxyId) => {
    const codeInput = document.getElementById("verification-code");
  
    if (!codeInput.value.trim()) {
      showToast("Please enter the verification code", "error");
      codeInput.focus();
      return;
    }
  
    const verifyBtn = document.getElementById("verify-code-btn");
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    }
  
    try {
      const accountData = {
        name: document.getElementById("name").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        username: document.getElementById("username").value.trim(),
        avatar: document.getElementById("avatar-url").value,
        list_id: document.getElementById("account-list").value,
        proxy_id: proxyId,
        code: codeInput.value.trim(),
        limits: {
          daily_invites: parseInt(document.getElementById("limit-invites").value) || 30,
          daily_messages: parseInt(document.getElementById("limit-messages").value) || 50,
        },
      };
  
      const response = await fetch("/api/accounts/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(accountData),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify code");
      }
  
      const result = await response.json();
  
      if (result.success) {
        showToast("Account verified and added successfully", "success");
        hideModal("phone-import-modal");
  
        await loadAccounts(state.currentListId);
        await loadStats(state.currentListId);
      } else {
        throw new Error(result.error || "Failed to verify account");
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      showToast("Error: " + error.message, "error");
    } finally {
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = "Verify & Add Account";
      }
    }
  };
  const handleAddListClick = () => {
    document.getElementById("add-list-form").reset();

    showModal("add-list-modal");
  };

  const handleSaveAccount = async () => {
    const form = document.getElementById("add-account-form");
    const nameInput = document.getElementById("name");
    const phoneInput = document.getElementById("phone");
    const proxySelect = document.getElementById("account-proxy");

    if (!nameInput.value.trim()) {
      showToast("Please enter a name", "error");
      nameInput.focus();
      return;
    }

    if (!phoneInput.value.trim()) {
      showToast("Please enter a phone number", "error");
      phoneInput.focus();
      return;
    }

    if (!proxySelect.value) {
      showToast("Please select a proxy", "error");
      proxySelect.focus();
      return;
    }

    const accountData = {
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      username: document.getElementById("username").value.trim(),
      avatar:
        document.getElementById("avatar-url").value ||
        "https://ui-avatars.com/api/?name=${encodeURIComponent(nameInput.value.trim())}&background=random",
      list_id: document.getElementById("account-list").value,
      proxy_id: proxySelect.value,
      limits: {
        daily_invites:
          parseInt(document.getElementById("limit-invites").value) || 30,
        daily_messages:
          parseInt(document.getElementById("limit-messages").value) || 50,
      },
    };

    const newAccount = await api.createAccount(accountData);

    if (newAccount) {
      showToast("Account created successfully", "success");
      hideModal("add-account-modal");

      await loadAccounts(state.currentListId);
      await loadStats(state.currentListId);
    }
  };

  const handleSaveList = async () => {
    const listNameInput = document.getElementById("list-name");

    if (!listNameInput.value.trim()) {
      showToast("Please enter a list name", "error");
      listNameInput.focus();
      return;
    }

    const newList = await api.createList({
      name: listNameInput.value.trim(),
    });

    if (newList) {
      showToast("List created successfully", "success");
      hideModal("add-list-modal");

      await loadLists();
    }
  };

  const handleDeleteAccount = async (accountId) => {
    showModal("delete-confirmation-modal");

    document.getElementById("delete-confirmation-message").textContent =
      "Are you sure you want to delete this account? This action cannot be undone.";

    const confirmButton = document.getElementById("confirm-delete-btn");

    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    newConfirmButton.addEventListener("click", async () => {
      const result = await api.deleteAccount(accountId);

      if (result) {
        showToast("Account deleted successfully", "success");
        hideModal("delete-confirmation-modal");

        await loadAccounts(state.currentListId);
        await loadStats(state.currentListId);
      }
    });
  };

  const handleDeleteSelected = async () => {
    if (state.selectedAccounts.size === 0) return;

    showModal("delete-confirmation-modal");

    document.getElementById(
      "delete-confirmation-message"
    ).textContent = `Are you sure you want to delete ${state.selectedAccounts.size} selected accounts? This action cannot be undone.`;

    const confirmButton = document.getElementById("confirm-delete-btn");

    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    newConfirmButton.addEventListener("click", async () => {
      const result = await api.bulkDeleteAccounts(
        Array.from(state.selectedAccounts)
      );

      if (result) {
        showToast(
          `Successfully deleted ${result.deleted_count} accounts`,
          "success"
        );
        hideModal("delete-confirmation-modal");

        state.selectedAccounts.clear();
        updateSelectionUI();

        await loadAccounts(state.currentListId);
        await loadStats(state.currentListId);
      }
    });
  };

  const handleMoveSelected = () => {
    if (state.selectedAccounts.size === 0) return;

    showModal("move-accounts-modal");

    document.getElementById(
      "move-accounts-message"
    ).textContent = `Move ${state.selectedAccounts.size} selected accounts to:`;

    const confirmButton = document.getElementById("confirm-move-btn");

    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    newConfirmButton.addEventListener("click", async () => {
      const targetListId = document.getElementById("target-list").value;
      const action =
        document.querySelector('input[name="move-action"]:checked')?.value ||
        "move";

      newConfirmButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Moving...';
      newConfirmButton.disabled = true;

      try {
        const result = await api.moveAccounts(
          Array.from(state.selectedAccounts),
          targetListId,
          action
        );

        if (result) {
          showToast("Accounts updated successfully", "success");
          hideModal("move-accounts-modal");

          state.selectedAccounts.clear();
          updateSelectionUI();

          if (
            state.currentListId === targetListId ||
            state.currentListId === "all"
          ) {
            await loadAccounts(state.currentListId);
          } else {
            await loadAccounts(state.currentListId);
          }

          await loadStats(state.currentListId);
          await updateAccountCounts();
        }
      } catch (error) {
        console.error("Error moving accounts:", error);
        showToast("Error moving accounts", "error");
      } finally {
        newConfirmButton.innerHTML = "Move Accounts";
        newConfirmButton.disabled = false;
      }
    });
  };
  const handleCheckSelected = async () => {
    if (state.selectedAccounts.size === 0) return;

    elements.checkSelectedBtn.disabled = true;
    elements.checkSelectedBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Checking...';

    const result = await api.checkAccounts(Array.from(state.selectedAccounts));

    if (result) {
      showToast(`Successfully checked ${result.length} accounts`, "success");

      await loadAccounts(state.currentListId);
      await loadStats(state.currentListId);
    }
    elements.selectAllCheckbox.checked = false;
    elements.selectAllCheckbox.indeterminate = false;
    elements.checkSelectedBtn.disabled = false;
    elements.checkSelectedBtn.innerHTML =
      '<i class="fas fa-check-circle"></i> Check Selected';
  };

  const handleAvatarUpload = () => {
    const input = document.getElementById("avatar-input");
    const preview = document.getElementById("avatar-preview");
    const avatarUrlInput = document.getElementById("avatar-url");

    input.addEventListener("change", async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];

        console.log("File to upload:", {
          name: file.name,
          type: file.type,
          size: file.size,
        });

        const formData = new FormData();
        formData.append("avatar", file);

        try {
          const response = await fetch("/api/accounts/upload-avatar", {
            method: "POST",
            body: formData,
          });

          const result = await response.json();

          console.log("Upload response:", result);

          if (response.ok && result.url) {
            preview.innerHTML = `<img src="${result.url}" alt="Avatar">`;

            avatarUrlInput.value = result.url;
          } else {
            console.error("Upload failed:", result);
            showToast(
              `Upload failed: ${result.error || "Unknown error"}`,
              "error"
            );
          }
        } catch (error) {
          console.error("Upload error:", error);
          showToast("Error uploading avatar", "error");
        }
      }
    });
  };

  const setupTDataImport = (proxyId) => {
    const backBtn = document.getElementById("back-to-import-options-btn-tdata");
    if (backBtn) {
      const newBackBtn = backBtn.cloneNode(true);
      backBtn.parentNode.replaceChild(newBackBtn, backBtn);
  
      newBackBtn.addEventListener("click", () => {
        hideModal("tdata-import-modal");
        showModal("account-import-modal");
      });
    }
  
    const uploadArea = document.getElementById("tdata-upload-area");
    const uploadInput = document.getElementById("tdata-input");
    const uploadStatus = document.getElementById("upload-status");
    const progressBar = document.getElementById("upload-progress-bar");
    const statusText = document.getElementById("upload-status-text");
    const submitBtn = document.getElementById("import-tdata-submit-btn");
  
    // Reset upload state
    if (uploadStatus) uploadStatus.style.display = "none";
    if (progressBar) progressBar.style.width = "0%";
    if (statusText) statusText.textContent = "";
    if (submitBtn) submitBtn.disabled = false;
    if (uploadInput) uploadInput.value = "";
  
    // Set up drag and drop for TData ZIP file
    if (uploadArea && uploadInput) {
      const browseBtn = uploadArea.querySelector("label.btn");
      if (browseBtn) {
        browseBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          uploadInput.click();
        });
      }
  
      uploadInput.addEventListener("change", (e) => {
        console.log("File selected:", e.target.files);
        if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          if (file.name.endsWith(".zip")) {
            if (statusText) {
              statusText.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
            }
            if (uploadStatus) uploadStatus.style.display = "block";
            if (submitBtn) submitBtn.disabled = false;
          } else {
            showToast("Please select a ZIP file containing TData", "error");
          }
        }
      });
  
      uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
      });
  
      uploadArea.addEventListener("dragleave", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");
      });
  
      uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");
  
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.name.endsWith(".zip")) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            uploadInput.files = dataTransfer.files;
  
            if (statusText) {
              statusText.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
            }
            if (uploadStatus) uploadStatus.style.display = "block";
            if (submitBtn) submitBtn.disabled = false;
          } else {
            showToast("Please select a ZIP file containing TData", "error");
          }
        }
      });
  
      uploadArea.addEventListener("click", (e) => {
        if (e.target === uploadArea || !e.target.closest("label")) {
          uploadInput.click();
        }
      });
    }
  
    // Update the proxy display
    const proxyDisplay = document.getElementById("tdata-selected-proxy");
    if (proxyDisplay) {
      const proxy = state.proxies.find(p => p.id === proxyId);
      if (proxy) {
        proxyDisplay.textContent = `${proxy.host}:${proxy.port}`;
      } else {
        proxyDisplay.textContent = "None";
      }
    }
  
    // Setup account list dropdown
    const accountListSelect = document.getElementById("tdata-account-list");
    if (accountListSelect) {
      let options = "";
      state.lists.forEach((list) => {
        options += `<option value="${list.id}">${list.name}</option>`;
      });
      accountListSelect.innerHTML = options;
    }
  
    // Replace the import button with a new one to prevent duplicate event listeners
    if (submitBtn) {
      const newImportBtn = submitBtn.cloneNode(true);
      submitBtn.parentNode.replaceChild(newImportBtn, submitBtn);
      
      //newImportBtn.disabled = true;
      newImportBtn.addEventListener("click", () => {
        handleTDataImport(proxyId);
      });
    }
  }

  const updateSelectionUI = () => {
    const selectedCount = state.selectedAccounts.size;

    elements.selectedCount.textContent = `${selectedCount} selected`;

    elements.selectionActions.style.display =
      selectedCount > 0 ? "flex" : "none";

    const totalAccounts = document.querySelectorAll(".account-checkbox").length;
    elements.selectAllCheckbox.checked =
      selectedCount > 0 && selectedCount === totalAccounts;
    elements.selectAllCheckbox.indeterminate =
      selectedCount > 0 && selectedCount < totalAccounts;

    elements.checkSelectedBtn.disabled = selectedCount === 0;
    elements.moveSelectedBtn.disabled = selectedCount === 0;
    elements.deleteSelectedBtn.disabled = selectedCount === 0;
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

  const attachAccountEventListeners = () => {
    document.querySelectorAll(".account-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", handleSelectAccount);
    });

    document.querySelectorAll(".edit-account-btn").forEach((button) => {
      button.addEventListener("click", () => {
        showToast(
          "Edit account functionality is not implemented in this demo",
          "info"
        );
      });
    });

    document.querySelectorAll(".delete-account-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const accountId = button.dataset.id;
        handleDeleteAccount(accountId);
      });
    });
  };

  const attachListEventListeners = () => {
    document.querySelectorAll("#account-lists li").forEach((listItem) => {
      listItem.addEventListener("click", handleListClick);
    });
  };

  const attachGlobalEventListeners = () => {
    elements.selectAllCheckbox.addEventListener("change", handleSelectAll);

    elements.addAccountBtn.addEventListener("click", handleAddAccountClick);
    elements.emptyAddBtn.addEventListener("click", handleAddAccountClick);

    elements.addListBtn.addEventListener("click", handleAddListClick);

    elements.checkSelectedBtn.addEventListener("click", handleCheckSelected);

    elements.moveSelectedBtn.addEventListener("click", handleMoveSelected);

    elements.deleteSelectedBtn.addEventListener("click", handleDeleteSelected);

    elements.closeWarningBtn.addEventListener("click", closeWarning);

    document
      .getElementById("save-list-btn")
      .addEventListener("click", handleSaveList);

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        const modalId = button.dataset.closeModal;
        hideModal(modalId);
      });
    });

    elements.searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase();
      filterAccounts(searchTerm);
    });

    handleAvatarUpload();
  };

  const loadAccounts = async (listId = "all") => {
    const accounts = await api.getAccounts(listId);
    state.accounts = accounts;
    renderAccounts(accounts);
  };

  const loadLists = async () => {
    const lists = await api.getLists();
    state.lists = lists;
    renderLists(lists);
  };

  const loadStats = async (listId = "all") => {
    const stats = await api.getStats(listId);
    renderStats(stats);
  };

  const filterAccounts = (searchTerm) => {
    if (!searchTerm) {
      renderAccounts(state.accounts);
      return;
    }

    const filteredAccounts = state.accounts.filter((account) => {
      return (
        account.name.toLowerCase().includes(searchTerm) ||
        account.phone.toLowerCase().includes(searchTerm) ||
        (account.username &&
          account.username.toLowerCase().includes(searchTerm))
      );
    });

    renderAccounts(filteredAccounts);
  };

  const init = async () => {
    const logoSVG = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    logoSVG.setAttribute("viewBox", "0 0 24 24");
    logoSVG.classList.add("logo");
    logoSVG.innerHTML = `
            <path d="M12,2 C17.5228,2 22,6.47715 22,12 C22,17.5228 17.5228,22 12,22 C6.47715,22 2,17.5228 2,12 C2,6.47715 6.47715,2 12,2 Z M12,5 C8.13401,5 5,8.13401 5,12 C5,15.866 8.13401,19 12,19 C15.866,19 19,15.866 19,12 C19,8.13401 15.866,5 12,5 Z M14.1213,8.46447 L15.5355,9.87868 L12,13.4142 L8.46447,9.87868 L9.87868,8.46447 L12,10.5858 L14.1213,8.46447 Z" fill="currentColor"/>
        `;
    const logoContainer = document.querySelector(".sidebar-header");
    logoContainer.replaceChild(logoSVG, logoContainer.querySelector(".logo"));

    const emptySVG = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
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
    const emptyStateContainer = document.querySelector(".empty-state");
    emptyStateContainer.replaceChild(
      emptySVG,
      emptyStateContainer.querySelector(".empty-illustration")
    );

    await loadLists();

    state.proxies = await api.getProxies();

    const proxyWarning = document.getElementById("proxy-warning");
    if (proxyWarning) {
      if (state.proxies.length === 0) {
        proxyWarning.style.display = "flex";

        const addProxyBtn = document.getElementById(
          "add-proxy-from-warning-btn"
        );
        if (addProxyBtn) {
          addProxyBtn.addEventListener("click", () => {
            window.location.href = 'proxies.html';
          });
        }
      } else {
        proxyWarning.style.display = "none";
        document.getElementById('proxy-count').textContent = state.proxies.length;  
      }
    }

    await loadAccounts("all");
    await loadStats("all");

    updateProxyDropdowns();

    attachGlobalEventListeners();
  };

  init();
});