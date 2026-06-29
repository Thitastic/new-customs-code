const DATA_URL = "new-code.json";
const MAX_SUGGESTIONS = 8;

let data = [];
let suggestions = [];
let highlightedSuggestion = -1;

const form = document.getElementById("searchForm");
const input = document.getElementById("searchInput");
const suggestionsBox = document.getElementById("suggestions");
const statusBox = document.getElementById("status");
const resultsBox = document.getElementById("results");
const openListButton = document.getElementById("openListButton");
const listModal = document.getElementById("listModal");
const fullListBox = document.getElementById("fullList");
const documentModal = document.getElementById("documentModal");
const documentTitle = document.getElementById("documentTitle");
const documentImage = document.getElementById("documentImage");
const documentError = document.getElementById("documentError");

document.addEventListener("DOMContentLoaded", loadData);
form.addEventListener("submit", search);
input.addEventListener("input", updateSuggestions);
input.addEventListener("keydown", handleSuggestionKeys);
openListButton.addEventListener("click", openFullList);
documentImage.addEventListener("load", showDocumentImage);
documentImage.addEventListener("error", showDocumentError);

document.addEventListener("click", (event) => {
  const suggestionButton = event.target.closest("[data-suggestion-index]");
  const documentButton = event.target.closest("[data-view-document]");
  if (suggestionButton) {
    selectSuggestion(Number(suggestionButton.dataset.suggestionIndex));
    return;
  }

  if (documentButton) {
    openDocument(documentButton.dataset.page);
    return;
  }

  if (event.target.closest("[data-close-list]")) {
    closeFullList();
    return;
  }

  if (event.target.closest("[data-close-document]")) {
    closeDocument();
    return;
  }

  if (!event.target.closest(".autocomplete-wrap")) {
    hideSuggestions();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!documentModal.hidden) {
      closeDocument();
      return;
    }

    if (!listModal.hidden) {
      closeFullList();
    }
  }
});

async function loadData() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const raw = await response.json();
    data = normalizeData(raw);
    statusBox.textContent = "";
    renderFullList();
  } catch (error) {
    data = [];
    statusBox.textContent = "Không thể tải filecuatoi.json";
    statusBox.classList.add("error");
    console.error(error);
  }
}

function search(event) {
  event.preventDefault();

  if (highlightedSuggestion >= 0 && suggestions[highlightedSuggestion]) {
    selectSuggestion(highlightedSuggestion);
    return;
  }

  runSearch(input.value);
  hideSuggestions();
}

function runSearch(value) {
  const query = normalizeText(value);
  resultsBox.innerHTML = "";

  if (!query) {
    return;
  }

  const matches = data.filter((item) => searchText(item).includes(query));

  if (matches.length === 0) {
    resultsBox.innerHTML = `<div class="empty">Không tìm thấy mã Hải quan phù hợp.</div>`;
    return;
  }

  resultsBox.innerHTML = matches.map(renderCard).join("");
}

function updateSuggestions() {
  const query = normalizeText(input.value);
  highlightedSuggestion = -1;

  if (!query) {
    hideSuggestions();
    return;
  }

  suggestions = data
    .filter((item) => searchText(item).includes(query))
    .slice(0, MAX_SUGGESTIONS);

  if (suggestions.length === 0) {
    hideSuggestions();
    return;
  }

  suggestionsBox.innerHTML = suggestions.map((item, index) => `
    <button class="suggestion-item" type="button" role="option" data-suggestion-index="${index}">
      ${escapeHtml(suggestionLabel(item))}
    </button>
  `).join("");
  suggestionsBox.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function handleSuggestionKeys(event) {
  if (suggestionsBox.hidden && !["ArrowDown", "ArrowUp"].includes(event.key)) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSuggestion(1);
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSuggestion(-1);
  }

  if (event.key === "Enter" && highlightedSuggestion >= 0) {
    event.preventDefault();
    selectSuggestion(highlightedSuggestion);
  }

  if (event.key === "Escape") {
    hideSuggestions();
  }
}

function moveSuggestion(direction) {
  if (suggestions.length === 0) {
    return;
  }

  highlightedSuggestion += direction;

  if (highlightedSuggestion >= suggestions.length) {
    highlightedSuggestion = 0;
  }

  if (highlightedSuggestion < 0) {
    highlightedSuggestion = suggestions.length - 1;
  }

  Array.from(suggestionsBox.children).forEach((button, index) => {
    button.classList.toggle("active", index === highlightedSuggestion);
  });
}

function selectSuggestion(index) {
  const item = suggestions[index];
  if (!item) {
    return;
  }

  input.value = suggestionLabel(item);
  resultsBox.innerHTML = renderCard(item);
  hideSuggestions();
}

function hideSuggestions() {
  suggestions = [];
  highlightedSuggestion = -1;
  suggestionsBox.innerHTML = "";
  suggestionsBox.hidden = true;
  input.setAttribute("aria-expanded", "false");
}

function openFullList() {
  listModal.hidden = false;
}

function closeFullList() {
  listModal.hidden = true;
}

function openDocument(page) {
  const cleanPage = clean(page);
  if (!cleanPage) {
    return;
  }

  documentTitle.textContent = `Tài liệu trang ${cleanPage}`;
  documentError.hidden = true;
  documentImage.hidden = true;
  documentImage.src = `/images/${encodeURIComponent(cleanPage)}.jpg`;
  documentModal.hidden = false;
}

function closeDocument() {
  documentModal.hidden = true;
  documentImage.removeAttribute("src");
}

function showDocumentImage() {
  documentError.hidden = true;
  documentImage.hidden = false;
}

function showDocumentError() {
  documentImage.hidden = true;
  documentError.hidden = false;
}

function normalizeData(raw) {
  const pages = Array.isArray(raw) ? raw : [];
  const flat = [];

  pages.forEach((pageData) => {
    const page = clean(pageData?.page);
    const groups = Array.isArray(pageData?.customsSubDepartments) ? pageData.customsSubDepartments : [];

    groups.forEach((group) => {
      const customsSubDepartment = clean(group?.customsSubDepartment);
      const items = Array.isArray(group?.items) ? group.items : [];

      items.forEach((item) => {
        flat.push({
          page,
          customsSubDepartment,
          currentCode: clean(item?.currentCode),
          departmentName: clean(item?.departmentName),
          newCode: clean(item?.newCode),
          shortedName: clean(item?.shortedName),
          newDepartmentName: clean(item?.newDepartmentName),
        });
      });
    });
  });

  return flat;
}

function renderCard(item) {
  return `
    <article class="result-card">
      ${renderField("Tên cũ", item.departmentName)}
      ${renderField("Tên mới", item.newDepartmentName)}
      ${renderField("Mã cũ -> Mã mới", renderCodeLine(item), true)}
      ${renderField("Tên rút gọn", `<span class="shorted-name">${escapeHtml(item.shortedName)}</span>`, true)}
      ${renderField("Chi cục Hải quan khu vực", item.customsSubDepartment)}
      <div class="actions">
        ${renderDocumentButton(item)}
      </div>
    </article>
  `;
}

function renderFullList() {
  if (data.length === 0) {
    fullListBox.innerHTML = `<div class="empty">Không có dữ liệu.</div>`;
    return;
  }

  const tableRows = data.map((item) => `
    <tr>
      <td>${escapeHtml(item.departmentName)}</td>
      <td>${escapeHtml(item.newDepartmentName)}</td>
      <td>${renderCodeLine(item)}</td>
      <td><span class="shorted-name">${escapeHtml(item.shortedName)}</span></td>
      <td>${escapeHtml(item.customsSubDepartment)}</td>
      <td>${escapeHtml(item.page)}</td>
      <td>${renderDocumentButton(item)}</td>
    </tr>
  `).join("");

  const cards = data.map((item) => `
    <article class="list-card">
      ${renderField("Tên cũ", item.departmentName)}
      ${renderField("Tên mới", item.newDepartmentName)}
      ${renderField("Mã cũ -> Mã mới", renderCodeLine(item), true)}
      ${renderField("Tên rút gọn", `<span class="shorted-name">${escapeHtml(item.shortedName)}</span>`, true)}
      ${renderField("Chi cục", item.customsSubDepartment)}
      ${renderField("Trang", item.page)}
      <div class="actions">${renderDocumentButton(item)}</div>
    </article>
  `).join("");

  fullListBox.innerHTML = `
    <table class="list-table">
      <thead>
        <tr>
          <th>Tên cũ</th>
          <th>Tên mới</th>
          <th>Mã cũ -> Mã mới</th>
          <th>Tên rút gọn</th>
          <th>Chi cục</th>
          <th>Trang</th>
          <th>Xem tài liệu</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="list-cards">${cards}</div>
  `;
}

function renderField(label, value, isHtml = false) {
  return `
    <div class="field">
      <div class="label">${escapeHtml(label)}</div>
      <div>${isHtml ? value : escapeHtml(value)}</div>
    </div>
  `;
}

function renderCodeLine(item) {
  return `
    <div class="code-line">
      <span class="badge old">${escapeHtml(item.currentCode)}</span>
      <span class="arrow">-></span>
      <span class="badge new">${escapeHtml(item.newCode)}</span>
    </div>
  `;
}

function renderDocumentButton(item) {
  return `<button class="document-button" type="button" data-view-document data-page="${escapeHtml(item.page)}">Xem tài liệu</button>`;
}

function suggestionLabel(item) {
  return `${item.currentCode} -> ${item.newCode} | ${item.departmentName}`;
}

function searchText(item) {
  return normalizeText([
    item.currentCode,
    item.newCode,
    item.departmentName,
    item.newDepartmentName,
    item.shortedName,
    item.customsSubDepartment,
  ].join(" "));
}

function normalizeText(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function clean(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
