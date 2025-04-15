document.addEventListener("DOMContentLoaded", function () {
  const state = {
    keywords: [],
    foundGroups: [],
    savedGroups: [],
    lists: [],
    groupLists: [],
    isParsingActive: false,
    currentListId: "all",
    currentGroupListId: "all",
    selectedGroups: new Set(),
  };

  const elements = {
    parserForm: document.getElementById("parser-form"),
    keywordInput: document.getElementById("keyword-input"),
    addKeywordBtn: document.getElementById("add-keyword-btn"),
    keywordChips: document.getElementById("keyword-chips"),
    languageSelect: document.getElementById("language-select"),
    groupListSelect: document.getElementById("group-list-select"),
    startParsingBtn: document.getElementById("start-parsing-btn"),

    parserProgress: document.getElementById("parser-progress"),
    progressBar: document.getElementById("parser-progress-bar"),

    foundGroupsList: document.getElementById("found-groups-list"),
    savedGroupsTableBody: document.getElementById("saved-groups-table-body"),
    emptyFoundGroups: document.getElementById("empty-found-groups"),
    emptySavedGroups: document.getElementById("empty-saved-groups"),

    groupLists: document.getElementById("group-lists"),
    addGroupListBtn: document.getElementById("add-group-list-btn"),

    selectAllGroupsCheckbox: document.getElementById(
      "select-all-groups-checkbox"
    ),
    selectedGroupsCount: document.getElementById("selected-groups-count"),
    groupSelectionActions: document.getElementById("group-selection-actions"),
    moveSelectedGroupsBtn: document.getElementById("move-selected-groups-btn"),
    deleteSelectedGroupsBtn: document.getElementById(
      "delete-selected-groups-btn"
    ),

    saveAllBtn: document.getElementById("save-all-btn"),
    savedListFilter: document.getElementById("saved-list-filter"),

  };

  const api = {
    async getLists() {
      try {
        const response = await fetch("/api/account-lists");
        if (!response.ok) throw new Error("Failed to fetch lists");
        return await response.json();
      } catch (error) {
        console.error("Error fetching lists:", error);
        showToast("Error loading lists", "error");
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

    async createGroupList(listData) {
      try {
        const response = await fetch("/api/group-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(listData),
        });
        if (!response.ok) throw new Error("Failed to create group list");
        return await response.json();
      } catch (error) {
        console.error("Error creating group list:", error);
        showToast("Error creating group list", "error");
        return null;
      }
    },

    async updateGroupList(listId, listData) {
      try {
        const response = await fetch(`/api/group-lists/${listId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(listData),
        });
        if (!response.ok) throw new Error("Failed to update group list");
        return await response.json();
      } catch (error) {
        console.error("Error updating group list:", error);
        showToast("Error updating group list", "error");
        return null;
      }
    },

    async deleteGroupList(listId) {
      try {
        const response = await fetch(`/api/group-lists/${listId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete group list");
        return await response.json();
      } catch (error) {
        console.error("Error deleting group list:", error);
        showToast("Error deleting group list", "error");
        return null;
      }
    },

    async getTelegramGroups(keywords, language) {
      try {
        const response = await fetch("/api/groups/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywords: keywords,
            language: language,
          }),
        });

        if (!response.ok) throw new Error("Failed to search for groups");

        return await response.json();
      } catch (error) {
        console.error("Error searching for groups:", error);
        showToast("Error searching for groups", "error");
        return [];
      }
    },

    async saveGroups(groups, listId) {
      try {
        const response = await fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groups: groups,
            list_id: listId,
          }),
        });

        if (!response.ok) throw new Error("Failed to save groups");

        const result = await response.json();
        return result.saved_groups || [];
      } catch (error) {
        console.error("Error saving groups:", error);
        showToast("Error saving groups", "error");
        return [];
      }
    },

    async getSavedGroups(listId = "all") {
      try {
        const response = await fetch(`/api/groups?list_id=${listId}`);

        if (!response.ok) throw new Error("Failed to fetch saved groups");

        return await response.json();
      } catch (error) {
        console.error("Error fetching saved groups:", error);
        showToast("Error loading saved groups", "error");
        return [];
      }
    },

    async deleteGroup(groupId) {
      try {
        const response = await fetch(`/api/groups/${groupId}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to delete group");

        return await response.json();
      } catch (error) {
        console.error("Error deleting group:", error);
        showToast("Error deleting group", "error");
        return null;
      }
    },

    async moveGroups(groupIds, targetListId) {
      try {
        const response = await fetch("/api/groups/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group_ids: groupIds,
            target_list_id: targetListId,
          }),
        });
        if (!response.ok) throw new Error("Failed to move groups");
        return await response.json();
      } catch (error) {
        console.error("Error moving groups:", error);
        showToast("Error moving groups", "error");
        return null;
      }
    },
    async addGroupToList(groupId, targetListId) {
      try {
        const response = await fetch("/api/groups/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group_ids: [groupId],
            target_list_id: targetListId,
            action: "add",
          }),
        });
        if (!response.ok) throw new Error("Failed to add group to list");
        return await response.json();
      } catch (error) {
        console.error("Error adding group to list:", error);
        showToast("Error adding group to list", "error");
        return null;
      }
    },

    async removeGroupFromList(groupId, listId) {
      try {
        const response = await fetch("/api/groups/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group_ids: [groupId],
            target_list_id: listId,
            action: "remove",
          }),
        });
        if (!response.ok) throw new Error("Failed to remove group from list");
        return await response.json();
      } catch (error) {
        console.error("Error removing group from list:", error);
        showToast("Error removing group from list", "error");
        return null;
      }
    },
  };

  const renderKeywordChips = () => {
    elements.keywordChips.innerHTML = state.keywords
      .map(
        (keyword) => `
            <div class="keyword-chip">
                ${keyword}
                <i class="fas fa-times" data-keyword="${keyword}"></i>
            </div>
        `
      )
      .join("");

    document.querySelectorAll(".keyword-chip i").forEach((icon) => {
      icon.addEventListener("click", () => {
        const keyword = icon.dataset.keyword;
        state.keywords = state.keywords.filter((k) => k !== keyword);
        renderKeywordChips();
      });
    });

    elements.startParsingBtn.disabled = state.keywords.length === 0;
  };

  const renderListDropdowns = () => {
    const groupListSelectHTML = state.groupLists
      .map(
        (list) => `
            <option value="${list.id}">${list.name}</option>
        `
      )
      .join("");

    elements.groupListSelect.innerHTML = groupListSelectHTML;

    const savedListFilterHTML = `
            <option value="all">All Lists</option>
            ${state.groupLists
              .map(
                (list) => `
                <option value="${list.id}">${list.name}</option>
            `
              )
              .join("")}
        `;

    elements.savedListFilter.innerHTML = savedListFilterHTML;
  };

  const renderFoundGroups = () => {
    if (state.foundGroups.length === 0) {
      elements.emptyFoundGroups.style.display = "block";
      elements.foundGroupsList.innerHTML = "";
      elements.saveAllBtn.disabled = true;
      return;
    }

    elements.emptyFoundGroups.style.display = "none";
    elements.saveAllBtn.disabled = false;

    elements.foundGroupsList.innerHTML = state.foundGroups
      .map(
        (group) => `
            <li class="group-item" data-id="${group.id}">
                <div class="group-info">
                    <div class="group-title">${group.title}</div>
                    <div class="group-details">
                        <div class="group-detail">
                            <i class="fas fa-at"></i> ${group.username}
                        </div>
                        <div class="group-detail">
                            <i class="fas fa-users"></i> ${formatNumber(
                              group.members
                            )}
                        </div>
                        <div class="group-detail">
                            <i class="fas fa-circle text-success"></i> ${formatNumber(
                              group.online
                            )} online
                        </div>
                        <div class="group-detail">
                            <i class="fas fa-globe"></i> ${group.language.toUpperCase()}
                        </div>
                    </div>
                </div>
                <div class="group-actions">
                    <button class="btn btn-secondary save-group-btn" data-id="${
                      group.id
                    }">
                        <i class="fas fa-save"></i> Save
                    </button>
                </div>
            </li>
        `
      )
      .join("");

    document.querySelectorAll(".save-group-btn").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const groupId = button.dataset.id;
        const group = state.foundGroups.find((g) => g.id === groupId);

        if (group) {
          const listId = elements.groupListSelect.value;
          await saveGroup(group, listId);

          button.disabled = true;
          button.innerHTML = '<i class="fas fa-check"></i> Saved';
        }
      });
    });
  };

  function createAddToListModal() {
    const modalHtml = `
        <div class="modal" id="add-to-list-modal">
            <div class="modal-header">
                <h3>Add to List</h3>
                <button class="btn-close" data-close-modal="add-to-list-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p id="add-to-list-message">Select the list to add this group to:</p>
                <div class="form-group">
                    <select id="add-to-list-select">
                        <!-- Lists will be loaded here -->
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-text" data-close-modal="add-to-list-modal">Cancel</button>
                <button class="btn btn-primary" id="confirm-add-to-list-btn">Add to List</button>
            </div>
        </div>`;

    const modalContainer = document.getElementById("modal-container");
    if (modalContainer) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = modalHtml;
      modalContainer.appendChild(tempDiv.firstElementChild);
    }
  }

  function showAddToListModal(groupId, groupTitle) {
    const modalSelect = document.getElementById("add-to-list-select");
    const confirmBtn = document.getElementById("confirm-add-to-list-btn");
    const messageEl = document.getElementById("add-to-list-message");

    modalSelect.innerHTML = "";

    state.groupLists.forEach((list) => {
      const option = document.createElement("option");
      option.value = list.id;
      option.textContent = list.name;
      modalSelect.appendChild(option);
    });

    messageEl.textContent = `Select the list to add "${groupTitle}" to:`;

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener("click", async () => {
      const targetListId = modalSelect.value;

      newConfirmBtn.disabled = true;
      newConfirmBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Adding...';

      try {
        const result = await api.addGroupToList(groupId, targetListId);

        if (result && result.updated_count > 0) {
          showToast("Group added to list successfully", "success");

          await loadSavedGroups(state.currentGroupListId);

          await updateGroupCounts();

          hideModal("add-to-list-modal");
        } else {
          showToast("Group is already in this list", "info");
        }
      } catch (error) {
        console.error("Error adding group to list:", error);
        showToast("Error adding group to list", "error");
      } finally {
        newConfirmBtn.disabled = false;
        newConfirmBtn.innerHTML = "Add to List";
      }
    });

    showModal("add-to-list-modal");
  }

  function createGroupContextMenu() {
    const contextMenuHtml = `
        <div class="group-context-menu" id="group-context-menu">
            <div class="group-context-menu-item" id="add-to-list-menu-item">
                <i class="fas fa-plus"></i> Add to List
            </div>
            <div class="group-context-menu-item" id="remove-from-list-menu-item">
                <i class="fas fa-minus"></i> Remove from List
            </div>
            <div class="group-context-menu-item danger" id="delete-group-menu-item">
                <i class="fas fa-trash"></i> Delete Group
            </div>
        </div>`;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = contextMenuHtml;
    document.body.appendChild(tempDiv.firstElementChild);

    document
      .getElementById("add-to-list-menu-item")
      .addEventListener("click", () => {
        const contextMenu = document.getElementById("group-context-menu");
        const groupId = contextMenu.dataset.groupId;
        const groupTitle = contextMenu.dataset.groupTitle;

        contextMenu.classList.remove("active");

        showAddToListModal(groupId, groupTitle);
      });

    document
      .getElementById("remove-from-list-menu-item")
      .addEventListener("click", async () => {
        const contextMenu = document.getElementById("group-context-menu");
        const groupId = contextMenu.dataset.groupId;
        const listId = contextMenu.dataset.listId;

        contextMenu.classList.remove("active");

        if (listId === "all" || listId === "main") {
          showToast("Cannot remove from main list", "error");
          return;
        }

        if (
          confirm(
            "Are you sure you want to remove this group from the current list?"
          )
        ) {
          try {
            const result = await api.removeGroupFromList(groupId, listId);

            if (result && result.updated_count > 0) {
              showToast("Group removed from list", "success");

              await loadSavedGroups(state.currentGroupListId);

              await updateGroupCounts();
            }
          } catch (error) {
            console.error("Error removing group from list:", error);
            showToast("Error removing group from list", "error");
          }
        }
      });

    document
      .getElementById("delete-group-menu-item")
      .addEventListener("click", async () => {
        const contextMenu = document.getElementById("group-context-menu");
        const groupId = contextMenu.dataset.groupId;

        contextMenu.classList.remove("active");

        await deleteGroup(groupId);
      });

    document.addEventListener("click", (event) => {
      const contextMenu = document.getElementById("group-context-menu");
      if (
        contextMenu &&
        !contextMenu.contains(event.target) &&
        !event.target.classList.contains("group-context-trigger")
      ) {
        contextMenu.classList.remove("active");
      }
    });
  }

  const renderSavedGroups = () => {
    const tableBody = elements.savedGroupsTableBody;

    if (!tableBody) return;

    if (state.savedGroups.length === 0) {
      elements.emptySavedGroups.style.display = "block";
      tableBody.innerHTML = "";
      return;
    }

    const listId = elements.savedListFilter.value;
    const filteredGroups =
      listId === "all"
        ? state.savedGroups
        : state.savedGroups.filter((group) => {
            if (group.list_ids) {
              return group.list_ids.includes(listId);
            }

            return group.list_id === listId;
          });

    if (filteredGroups.length === 0) {
      elements.emptySavedGroups.style.display = "block";
      tableBody.innerHTML = "";
      return;
    }

    elements.emptySavedGroups.style.display = "none";

    tableBody.innerHTML = filteredGroups
      .map((group) => {
        const list = state.groupLists.find((l) => l.id === group.list_id);
        const listName = list ? list.name : "Main Group List";

        const memberCount = formatNumber(group.members || 0);

        const listNames = (group.list_ids || [group.list_id])
          .map((lid) => {
            const l = state.groupLists.find((lst) => lst.id === lid);
            return l ? l.name : "Main Group List";
          })
          .join(", ");

        return `
                <tr data-id="${group.id}">
                    <td class="checkbox-col">
                        <input type="checkbox" class="group-checkbox" data-id="${
                          group.id
                        }" ${
          state.selectedGroups.has(group.id) ? "checked" : ""
        }>
                    </td>
                    <td>
                        <div class="group-info">
                            <div class="group-name">${group.title}</div>
                            <div class="group-details">${
                              group.description
                                ? group.description.substring(0, 60) +
                                  (group.description.length > 60 ? "..." : "")
                                : ""
                            }</div>
                        </div>
                    </td>
                    <td>@${group.username || ""}</td>
                    <td>${memberCount}</td>
                    <td title="${listNames}">${listName}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-icon btn-text add-to-list-btn" data-id="${
                              group.id
                            }" data-title="${group.title}" title="Add to list">
                                <i class="fas fa-plus-circle"></i>
                            </button>
                            <button class="btn btn-icon btn-text group-context-trigger" data-id="${
                              group.id
                            }" data-title="${
          group.title
        }" data-list-id="${listId}" title="More options">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <button class="btn btn-icon btn-danger delete-group-btn" data-id="${
                              group.id
                            }" title="Delete group">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
      })
      .join("");

    tableBody.querySelectorAll(".group-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", handleSelectGroup);
    });

    tableBody.querySelectorAll(".delete-group-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const groupId = button.dataset.id;
        await deleteGroup(groupId);
      });
    });

    tableBody.querySelectorAll(".add-to-list-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const groupId = button.dataset.id;
        const groupTitle = button.dataset.title;
        showAddToListModal(groupId, groupTitle);
      });
    });

    tableBody.querySelectorAll(".group-context-trigger").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const groupId = button.dataset.id;
        const groupTitle = button.dataset.title;
        const listId = button.dataset.listId;

        const contextMenu = document.getElementById("group-context-menu");
        if (contextMenu) {
          contextMenu.dataset.groupId = groupId;
          contextMenu.dataset.groupTitle = groupTitle;
          contextMenu.dataset.listId = listId;

          const rect = button.getBoundingClientRect();
          contextMenu.style.top = `${rect.bottom + window.scrollY}px`;
          contextMenu.style.left = `${rect.left + window.scrollX}px`;

          const removeItem = document.getElementById(
            "remove-from-list-menu-item"
          );
          if (listId === "all") {
            removeItem.style.display = "none";
          } else {
            removeItem.style.display = "flex";
          }

          contextMenu.classList.add("active");
        }
      });
    });
  };

  const renderGroupLists = () => {
    if (!elements.groupLists) return;

    const allGroupsItem = `
            <li data-list-id="all" ${
              state.currentGroupListId === "all" ? 'class="active"' : ""
            }>
                <i class="fas fa-layer-group"></i>
                <span>All Groups</span>
                <span class="group-count">0</span>
            </li>
        `;

    const listItems = state.groupLists
      .map(
        (list) => `
            <li data-list-id="${list.id}" ${
          state.currentGroupListId === list.id ? 'class="active"' : ""
        }>
                <i class="fas fa-list"></i>
                <span>${list.name}</span>
                <span class="group-count">0</span>
            </li>
        `
      )
      .join("");

    elements.groupLists.innerHTML = allGroupsItem + listItems;

    document.querySelectorAll("#group-lists li").forEach((item) => {
      item.addEventListener("click", handleGroupListClick);
    });

    updateGroupCounts();
  };

  const updateGroupListDropdowns = () => {
    if (elements.groupListSelect) {
      elements.groupListSelect.innerHTML = state.groupLists
        .map(
          (list) => `
                <option value="${list.id}">${list.name}</option>
            `
        )
        .join("");
    }

    if (elements.savedListFilter) {
      elements.savedListFilter.innerHTML = `
                <option value="all">All Lists</option>
                ${state.groupLists
                  .map(
                    (list) => `
                    <option value="${list.id}">${list.name}</option>
                `
                  )
                  .join("")}
            `;
    }

    const moveGroupsListSelect = document.getElementById("move-groups-list");
    if (moveGroupsListSelect) {
      moveGroupsListSelect.innerHTML = state.groupLists
        .map(
          (list) => `
                <option value="${list.id}">${list.name}</option>
            `
        )
        .join("");
    }
  };

  const handleAddKeyword = () => {
    const keyword = elements.keywordInput.value.trim();

    if (keyword && !state.keywords.includes(keyword)) {
      state.keywords.push(keyword);
      elements.keywordInput.value = "";
      renderKeywordChips();
    }
  };

  const handleParserFormSubmit = async (event) => {
    event.preventDefault();

    if (state.keywords.length === 0) {
      showToast("Please add at least one keyword", "error");
      return;
    }

    const language = elements.languageSelect.value;

    await startParsing(state.keywords, language);
  };

  const startParsing = async (keywords, language) => {
    elements.parserProgress.style.display = "block";
    elements.progressBar.style.width = "0%";

    toggleParsingState(true);

    const interval = setInterval(() => {
      const currentWidth = parseInt(elements.progressBar.style.width) || 0;
      if (currentWidth < 90) {
        elements.progressBar.style.width = currentWidth + 5 + "%";
      }
    }, 200);

    try {
      const groups = await api.getTelegramGroups(keywords, language);

      state.foundGroups = groups;

      elements.progressBar.style.width = "100%";

      renderFoundGroups();

      showToast(
        `Found ${groups.length} groups matching your keywords`,
        "success"
      );
    } catch (error) {
      console.error("Error parsing groups:", error);
      showToast("Error parsing groups. Please try again.", "error");
    } finally {
      setTimeout(() => {
        clearInterval(interval);
        toggleParsingState(false);

        setTimeout(() => {
          elements.parserProgress.style.display = "none";
        }, 500);
      }, 1000);
    }
  };

  const toggleParsingState = (isParsing) => {
    state.isParsingActive = isParsing;

    elements.startParsingBtn.disabled =
      isParsing || state.keywords.length === 0;
    elements.languageSelect.disabled = isParsing;
    elements.keywordInput.disabled = isParsing;
    elements.addKeywordBtn.disabled = isParsing;

    elements.startParsingBtn.innerHTML = isParsing
      ? '<i class="fas fa-spinner fa-spin"></i> Parsing...'
      : '<i class="fas fa-search"></i> Start Parsing';
  };

  const saveGroup = async (group, listId) => {
    try {
      const savedGroup = await api.saveGroups([group], listId);

      state.savedGroups = [...state.savedGroups, ...savedGroup];

      renderSavedGroups();

      updateGroupCounts();

      showToast("Group saved successfully", "success");

      return true;
    } catch (error) {
      console.error("Error saving group:", error);
      showToast("Error saving group", "error");
      return false;
    }
  };

  const saveAllGroups = async () => {
    if (state.foundGroups.length === 0) return;

    const listId = elements.groupListSelect.value;

    elements.saveAllBtn.disabled = true;
    elements.saveAllBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      const savedGroups = await api.saveGroups(state.foundGroups, listId);

      state.savedGroups = [...state.savedGroups, ...savedGroups];

      document.querySelectorAll(".save-group-btn").forEach((button) => {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-check"></i> Saved';
      });

      renderSavedGroups();

      updateGroupCounts();

      showToast(`Saved ${savedGroups.length} groups to list`, "success");
    } catch (error) {
      console.error("Error saving groups:", error);
      showToast("Error saving groups", "error");
    } finally {
      elements.saveAllBtn.disabled = false;
      elements.saveAllBtn.innerHTML = '<i class="fas fa-save"></i> Save All';
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      await api.deleteGroup(groupId);

      state.savedGroups = state.savedGroups.filter(
        (group) => group.id !== groupId
      );

      if (state.selectedGroups.has(groupId)) {
        state.selectedGroups.delete(groupId);
        updateGroupSelectionUI();
      }

      renderSavedGroups();

      updateGroupCounts();

      showToast("Group deleted successfully", "success");
    } catch (error) {
      console.error("Error deleting group:", error);
      showToast("Error deleting group", "error");
    }
  };

  const handleSavedListFilterChange = async () => {
    renderSavedGroups();
  };

  const handleGroupListClick = async (event) => {
    const listItem = event.target.closest("li");
    if (!listItem) return;

    const listId = listItem.dataset.listId;

    document.querySelectorAll("#group-lists li").forEach((item) => {
      item.classList.remove("active");
    });
    listItem.classList.add("active");

    state.currentGroupListId = listId;
    state.selectedGroups.clear();
    updateGroupSelectionUI();

    await loadSavedGroups(listId);
  };

  const handleAddGroupList = () => {
    showModal("add-group-list-modal");
  };

  const handleSaveGroupList = async () => {
    const listNameInput = document.getElementById("group-list-name");

    if (!listNameInput.value.trim()) {
      showToast("Please enter a list name", "error");
      listNameInput.focus();
      return;
    }

    const newList = await api.createGroupList({
      name: listNameInput.value.trim(),
    });

    if (newList) {
      showToast("Group list created successfully", "success");
      hideModal("add-group-list-modal");

      await loadGroupLists();
    }
  };

  const handleEditGroupList = async (listId) => {
    const list = state.groupLists.find((l) => l.id === listId);
    if (!list) return;

    const listNameInput = document.getElementById("edit-group-list-name");
    listNameInput.value = list.name;

    const saveBtn = document.getElementById("save-edit-group-list-btn");
    saveBtn.dataset.listId = listId;

    showModal("edit-group-list-modal");
  };

  const handleSaveEditGroupList = async () => {
    const listNameInput = document.getElementById("edit-group-list-name");
    const saveBtn = document.getElementById("save-edit-group-list-btn");
    const listId = saveBtn.dataset.listId;

    if (!listNameInput.value.trim()) {
      showToast("Please enter a list name", "error");
      listNameInput.focus();
      return;
    }

    const updatedList = await api.updateGroupList(listId, {
      name: listNameInput.value.trim(),
    });

    if (updatedList) {
      showToast("Group list updated successfully", "success");
      hideModal("edit-group-list-modal");

      await loadGroupLists();

      renderSavedGroups();
    }
  };

  const handleDeleteGroupList = async (listId) => {
    showModal("delete-group-list-modal");

    document.getElementById("delete-group-list-message").textContent =
      "Are you sure you want to delete this list? All groups will be moved to the Main Group List.";

    const confirmButton = document.getElementById(
      "confirm-delete-group-list-btn"
    );

    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    newConfirmButton.addEventListener("click", async () => {
      const result = await api.deleteGroupList(listId);

      if (result) {
        showToast("Group list deleted successfully", "success");
        hideModal("delete-group-list-modal");

        if (state.currentGroupListId === listId) {
          state.currentGroupListId = "all";
        }

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

    document.querySelectorAll(".group-checkbox").forEach((checkbox) => {
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

    if (elements.selectedGroupsCount) {
      elements.selectedGroupsCount.textContent = `${selectedCount} selected`;
    }

    if (elements.groupSelectionActions) {
      elements.groupSelectionActions.style.display =
        selectedCount > 0 ? "flex" : "none";
    }

    if (elements.selectAllGroupsCheckbox) {
      const totalGroups = document.querySelectorAll(".group-checkbox").length;
      elements.selectAllGroupsCheckbox.checked =
        selectedCount > 0 && selectedCount === totalGroups;
      elements.selectAllGroupsCheckbox.indeterminate =
        selectedCount > 0 && selectedCount < totalGroups;
    }

    if (elements.moveSelectedGroupsBtn) {
      elements.moveSelectedGroupsBtn.disabled = selectedCount === 0;
    }
    if (elements.deleteSelectedGroupsBtn) {
      elements.deleteSelectedGroupsBtn.disabled = selectedCount === 0;
    }
  };

  const handleMoveSelectedGroups = () => {
    if (state.selectedGroups.size === 0) return;

    showModal("move-groups-modal");

    document.getElementById(
      "move-groups-message"
    ).textContent = `Move ${state.selectedGroups.size} selected groups to:`;

    const confirmButton = document.getElementById("confirm-move-groups-btn");

    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    newConfirmButton.addEventListener("click", async () => {
      const targetListId = document.getElementById("move-groups-list").value;

      newConfirmButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Moving...';
      newConfirmButton.disabled = true;

      try {
        const result = await api.moveGroups(
          Array.from(state.selectedGroups),
          targetListId
        );

        if (result) {
          showToast("Groups moved successfully", "success");
          hideModal("move-groups-modal");

          state.selectedGroups.clear();
          updateGroupSelectionUI();

          await loadSavedGroups(state.currentGroupListId);

          await updateGroupCounts();
        }
      } catch (error) {
        console.error("Error moving groups:", error);
        showToast("Error moving groups", "error");
      } finally {
        newConfirmButton.innerHTML = "Move Groups";
        newConfirmButton.disabled = false;
      }
    });
  };

  const handleDeleteSelectedGroups = async () => {
    if (state.selectedGroups.size === 0) return;

    showModal("delete-groups-modal");

    document.getElementById(
      "delete-groups-message"
    ).textContent = `Are you sure you want to delete ${state.selectedGroups.size} selected groups? This action cannot be undone.`;

    const confirmButton = document.getElementById("confirm-delete-groups-btn");

    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    newConfirmButton.addEventListener("click", async () => {
      newConfirmButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Deleting...';
      newConfirmButton.disabled = true;

      try {
        const selectedGroupIds = Array.from(state.selectedGroups);
        let deletedCount = 0;

        for (const groupId of selectedGroupIds) {
          const result = await api.deleteGroup(groupId);
          if (result) {
            deletedCount++;
          }
        }

        showToast(`Successfully deleted ${deletedCount} groups`, "success");
        hideModal("delete-groups-modal");

        state.selectedGroups.clear();
        updateGroupSelectionUI();

        await loadSavedGroups(state.currentGroupListId);

        await updateGroupCounts();
      } catch (error) {
        console.error("Error deleting groups:", error);
        showToast("Error deleting groups", "error");
      } finally {
        newConfirmButton.innerHTML = "Delete Groups";
        newConfirmButton.disabled = false;
      }
    });
  };

  const updateGroupCounts = async () => {
    try {
      const allGroups = await api.getSavedGroups("all");

      const allGroupsCount = document.querySelector(
        'li[data-list-id="all"] .group-count'
      );
      if (allGroupsCount) {
        allGroupsCount.textContent = allGroups.length;
      }

      state.groupLists.forEach((list) => {
        const listCount = allGroups.filter(
          (group) => group.list_id === list.id
        ).length;

        const listCountElement = document.querySelector(
          `li[data-list-id="${list.id}"] .group-count`
        );
        if (listCountElement) {
          listCountElement.textContent = listCount;
        }
      });
    } catch (error) {
      console.error("Error updating group counts:", error);
    }
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
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    modalContainer.classList.add("active");
    document.getElementById(modalId).classList.add("active");
    document.body.style.overflow = "hidden";
  };

  const hideModal = (modalId) => {
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    modalContainer.classList.remove("active");
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

  const loadSavedGroups = async (listId = "all") => {
    try {
      const groups = await api.getSavedGroups(listId);
      state.savedGroups = groups;
      renderSavedGroups();
    } catch (error) {
      console.error("Error loading saved groups:", error);
    }
  };

  const loadGroupLists = async () => {
    try {
      state.groupLists = await api.getGroupLists();
      renderGroupLists();
      updateGroupListDropdowns();
    } catch (error) {
      console.error("Error loading group lists:", error);
    }
  };
  function addManualGroupButton() {
    const foundGroupsHeader = document.querySelector(
      ".found-groups .section-header div"
    );

    if (foundGroupsHeader) {
      const addButton = document.createElement("button");
      addButton.id = "add-group-manually-btn";
      addButton.className = "btn btn-text add-group-manually-btn";
      addButton.innerHTML = '<i class="fas fa-plus"></i> Add Group Manually';

      foundGroupsHeader.insertBefore(addButton, foundGroupsHeader.firstChild);

      addButton.addEventListener("click", showAddGroupManuallyModal);
    } else {
      console.error("Could not find the found groups header element");
    }
  }

  function showAddGroupManuallyModal() {
    document.getElementById("add-group-manually-form").reset();

    document.querySelectorAll(".error-message").forEach((element) => {
      element.classList.remove("active");
      element.textContent = "";
    });

    updateManualGroupListDropdown();

    showModal("add-group-manually-modal");

    const saveButton = document.getElementById("save-manual-group-btn");
    if (saveButton) {
      const newSaveButton = saveButton.cloneNode(true);
      saveButton.parentNode.replaceChild(newSaveButton, saveButton);

      newSaveButton.addEventListener("click", handleSaveManualGroup);
    }
  }

  function updateManualGroupListDropdown() {
    const listSelect = document.getElementById("manual-group-list-select");

    if (listSelect && state.groupLists) {
      listSelect.innerHTML = state.groupLists
        .map((list) => `<option value="${list.id}">${list.name}</option>`)
        .join("");
    }
  }

  function validateManualGroupForm() {
    let isValid = true;

    const titleInput = document.getElementById("group-title");
    const titleError = document.getElementById("group-title-error");

    if (!titleInput.value.trim()) {
      titleError.textContent = "Group title is required";
      titleError.classList.add("active");
      isValid = false;
    } else {
      titleError.classList.remove("active");
    }

    const usernameInput = document.getElementById("group-username");
    const usernameError = document.getElementById("group-username-error");
    const usernameValue = usernameInput.value.trim();

    if (usernameValue && !/^[a-zA-Z0-9_]{5,32}$/.test(usernameValue)) {
      usernameError.textContent =
        "Username must be 5-32 characters and only contain letters, numbers and underscores";
      usernameError.classList.add("active");
      isValid = false;
    } else {
      usernameError.classList.remove("active");
    }

    const membersInput = document.getElementById("group-members");
    const membersError = document.getElementById("group-members-error");
    const membersValue = parseInt(membersInput.value);

    if (isNaN(membersValue) || membersValue < 0) {
      membersError.textContent = "Member count must be a non-negative number";
      membersError.classList.add("active");
      isValid = false;
    } else {
      membersError.classList.remove("active");
    }

    return isValid;
  }

  function handleSaveManualGroup() {
    console.log("Save manual group button clicked");

    if (!validateManualGroupForm()) {
      return;
    }

    const formData = {
      title: document.getElementById("group-title").value.trim(),
      username: document.getElementById("group-username").value.trim(),
      members: parseInt(document.getElementById("group-members").value) || 0,
      description: document.getElementById("group-description").value.trim(),
      language: document.getElementById("group-language").value,
      list_id: document.getElementById("manual-group-list-select").value,
    };

    const newGroup = {
      id: crypto.randomUUID ? crypto.randomUUID() : generateUUID(),
      telegram_id: 0,
      title: formData.title,
      username: formData.username,
      members: formData.members,
      online: 0,
      language: formData.language,
      description: formData.description,
    };

    const saveButton = document.getElementById("save-manual-group-btn");
    const originalButtonText = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    api
      .saveGroups([newGroup], formData.list_id)
      .then((savedGroups) => {
        if (savedGroups && savedGroups.length > 0) {
          state.savedGroups = [...state.savedGroups, ...savedGroups];
          renderSavedGroups();

          updateGroupCounts();

          showToast("Group added successfully", "success");

          hideModal("add-group-manually-modal");
        } else {
          showToast("Error adding group", "error");
        }
      })
      .catch((error) => {
        console.error("Error adding group:", error);
        showToast("Error adding group", "error");
      })
      .finally(() => {
        saveButton.disabled = false;
        saveButton.innerHTML = originalButtonText;
      });
  }

  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  function initManualGroupAddition() {
    addManualGroupButton();

    updateManualGroupListDropdown();

    const saveButton = document.getElementById("save-manual-group-btn");
    if (saveButton) {
      saveButton.addEventListener("click", handleSaveManualGroup);
    } else {
      console.error("Save manual group button not found");
    }

    const closeButtons = document.querySelectorAll(
      '[data-close-modal="add-group-manually-modal"]'
    );
    closeButtons.forEach((btn) => {
      btn.addEventListener("click", () =>
        hideModal("add-group-manually-modal")
      );
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const checkInterval = setInterval(() => {
      if (window.state && window.api) {
        clearInterval(checkInterval);
        initManualGroupAddition();
      }
    }, 100);
  });

  const attachEventListeners = () => {
    if (elements.addKeywordBtn) {
      elements.addKeywordBtn.addEventListener("click", handleAddKeyword);
    }

    if (elements.keywordInput) {
      elements.keywordInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddKeyword();
        }
      });
    }

    if (elements.parserForm) {
      elements.parserForm.addEventListener("submit", handleParserFormSubmit);
    }

    if (elements.saveAllBtn) {
      elements.saveAllBtn.addEventListener("click", saveAllGroups);
    }

    if (elements.savedListFilter) {
      elements.savedListFilter.addEventListener(
        "change",
        handleSavedListFilterChange
      );
    }

    if (elements.addGroupListBtn) {
      elements.addGroupListBtn.addEventListener("click", handleAddGroupList);
    }

    const saveGroupListBtn = document.getElementById("save-group-list-btn");
    if (saveGroupListBtn) {
      saveGroupListBtn.addEventListener("click", handleSaveGroupList);
    }

    const saveEditGroupListBtn = document.getElementById(
      "save-edit-group-list-btn"
    );
    if (saveEditGroupListBtn) {
      saveEditGroupListBtn.addEventListener("click", handleSaveEditGroupList);
    }

    if (elements.selectAllGroupsCheckbox) {
      elements.selectAllGroupsCheckbox.addEventListener(
        "change",
        handleSelectAllGroups
      );
    }

    if (elements.moveSelectedGroupsBtn) {
      elements.moveSelectedGroupsBtn.addEventListener(
        "click",
        handleMoveSelectedGroups
      );
    }

    if (elements.deleteSelectedGroupsBtn) {
      elements.deleteSelectedGroupsBtn.addEventListener(
        "click",
        handleDeleteSelectedGroups
      );
    }

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        const modalId = button.dataset.closeModal;
        hideModal(modalId);
      });
    });
  };
  function fixAddGroupManuallyModal() {
    let modal = document.getElementById("add-group-manually-modal");

    if (modal && modal.parentElement.id !== "modal-container") {
      console.log(
        "Found modal outside of container, moving it to modal container"
      );

      const modalContainer = document.getElementById("modal-container");

      if (modalContainer) {
        modal.parentElement.removeChild(modal);

        modalContainer.appendChild(modal);
      }
    } else if (!modal) {
      console.log("Modal doesn't exist, creating it");

      const modalContainer = document.getElementById("modal-container");
      if (!modalContainer) return;

      const modalHTML = `
            <div class="modal" id="add-group-manually-modal">
                <div class="modal-header">
                    <h3>Add Group Manually</h3>
                    <button class="btn-close" data-close-modal="add-group-manually-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="add-group-manually-form">
                        <div class="form-group">
                            <label for="group-title">Group Title <span class="required">*</span></label>
                            <input type="text" id="group-title" name="title" required>
                            <div class="error-message" id="group-title-error"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="group-username">Username</label>
                            <div class="input-with-prefix">
                                <span class="input-prefix">@</span>
                                <input type="text" id="group-username" name="username" placeholder="username">
                            </div>
                            <div class="error-message" id="group-username-error"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="group-members">Member Count</label>
                            <input type="number" id="group-members" name="members" min="0" value="0">
                            <div class="error-message" id="group-members-error"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="group-description">Description</label>
                            <textarea id="group-description" name="description" rows="3"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="group-language">Language</label>
                            <select id="group-language" name="language">
                                <option value="en">English</option>
                                <option value="ru">Russian</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="manual-group-list-select">Save to List</label>
                            <select id="manual-group-list-select" name="list_id">
                                <!-- Lists will be loaded here -->
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-text" data-close-modal="add-group-manually-modal">Cancel</button>
                    <button class="btn btn-primary" id="save-manual-group-btn">Add Group</button>
                </div>
            </div>
          `;

      modalContainer.insertAdjacentHTML("beforeend", modalHTML);

      const closeButton = document.querySelector(
        '[data-close-modal="add-group-manually-modal"]'
      );
      if (closeButton) {
        closeButton.addEventListener("click", () => {
          hideModal("add-group-manually-modal");
        });
      }

      const saveButton = document.getElementById("save-manual-group-btn");
      if (saveButton) {
        saveButton.addEventListener("click", handleSaveManualGroup);
      }
    }
  }
  function initManualGroupAddition() {
    fixAddGroupManuallyModal();

    addManualGroupButton();
  }

  const init = async () => {
    createAddToListModal();

    createGroupContextMenu();

    await loadGroupLists();
    await loadSavedGroups("all");

    renderKeywordChips();
    renderFoundGroups();

    initManualGroupAddition();
    fixAddGroupManuallyModal();

    attachEventListeners();
  };

  init();
});
