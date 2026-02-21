const API_URL = '/api/activities';

// DOM Elements
const activitiesBody = document.getElementById('activities-body');
const activityCount = document.getElementById('activity-count');
const addBtn = document.getElementById('add-btn');
const modal = document.getElementById('modal');
const closeModalBtn = document.getElementById('close-modal');
const cancelBtn = document.getElementById('cancel-btn');
const activityForm = document.getElementById('activity-form');
const modalTitle = document.getElementById('modal-title');
const appHeadingInput = document.getElementById('app-heading-input');

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-modal');
const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');

const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebar = document.querySelector('.sidebar');
const appContainer = document.querySelector('.app-container');
const sidebarOverlay = document.getElementById('sidebar-overlay'); // Added sidebarOverlay

const historyModal = document.getElementById('history-modal');
const closeHistoryBtn = document.getElementById('close-history-modal');
const cancelHistoryBtn = document.getElementById('cancel-history-btn');
const historyList = document.getElementById('history-list');

const columnsBtn = document.getElementById('columns-btn');
const columnsMenu = document.getElementById('columns-menu');
const dynamicColumnStyles = document.getElementById('dynamic-column-styles');

// Initialize
let activities = [];
let appSettings = { phases: [], statuses: [] };
let editingSettings = { phases: [], statuses: [] };
let currentFilter = { type: 'all', value: null };
let selectedActivities = new Set();
let selectedTimezone = localStorage.getItem('selectedTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;

const bulkEditBtn = document.getElementById('bulk-edit-btn');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');

// Column Configuration
const COLUMNS = [
  { id: 'select', label: 'Select', defaultWidth: 50, isVisible: true, isFixed: true },
  { id: 'phase', label: 'Phase', defaultWidth: 80, isVisible: true },
  { id: 'dependency', label: 'Dependency', defaultWidth: 140, isVisible: true },
  { id: 'title', label: 'Title', defaultWidth: 200, isVisible: true },
  { id: 'description', label: 'Description', defaultWidth: 250, isVisible: true },
  { id: 'assignee', label: 'Assignee', defaultWidth: 120, isVisible: true },
  { id: 'status', label: 'Status', defaultWidth: 120, isVisible: true },
  { id: 'begin_time', label: 'Begin Time', defaultWidth: 160, isVisible: true },
  { id: 'end_time', label: 'End Time', defaultWidth: 160, isVisible: true },
  { id: 'duration', label: 'Duration', defaultWidth: 100, isVisible: true }
];

let columnState = JSON.parse(localStorage.getItem('tableColumnState')) || COLUMNS;

// Ensure new code doesn't break if COLUMNS array structural length changed
if (columnState.length !== COLUMNS.length) {
  columnState = COLUMNS;
  saveColumnState();
}

let isEditMode = false;
document.body.classList.add('view-mode');

function saveColumnState() {
  localStorage.setItem('tableColumnState', JSON.stringify(columnState));
}

// Edit Mode Toggle
const editModeBtn = document.getElementById('edit-mode-btn');
if (editModeBtn) {
  editModeBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    if (isEditMode) {
      document.body.classList.remove('view-mode');
      editModeBtn.textContent = 'Exit Edit Mode';
      editModeBtn.classList.replace('btn-secondary', 'btn-primary');
    } else {
      document.body.classList.add('view-mode');
      editModeBtn.textContent = 'Enable Editing';
      editModeBtn.classList.replace('btn-primary', 'btn-secondary');
      selectedActivities.clear();
      const selectAll = document.getElementById('select-all-checkbox');
      if (selectAll) selectAll.checked = false;
      updateBulkActionButtons();
    }
    renderActivities();
  });
}

// Drag & Drop for Columns
let draggedColumnIndex = null;

window.handleDragStart = (e, index) => {
  draggedColumnIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', index);
  e.target.style.opacity = '0.5';
};

window.handleDragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};

window.handleDrop = (e, dropIndex) => {
  e.preventDefault();
  e.target.style.opacity = '1';

  if (draggedColumnIndex === null || draggedColumnIndex === dropIndex) return;

  const visibleColumns = columnState.filter(c => c.isVisible);
  const draggedCol = visibleColumns[draggedColumnIndex];
  const targetCol = visibleColumns[dropIndex];

  if (draggedCol.isFixed || targetCol.isFixed) return;

  const actualDragIndex = columnState.findIndex(c => c.id === draggedCol.id);
  const actualDropIndex = columnState.findIndex(c => c.id === targetCol.id);

  const [removed] = columnState.splice(actualDragIndex, 1);
  columnState.splice(actualDropIndex, 0, removed);

  saveColumnState();
  renderActivities();
};

window.handleDragEnd = (e) => {
  e.target.style.opacity = '1';
  draggedColumnIndex = null;
};

function renderTableHeader() {
  const tr = document.querySelector('#activities-table thead tr');
  if (!tr) return;

  let html = '';
  columnState.filter(c => c.isVisible).forEach((col, index) => {
    if (col.id === 'select') {
      html += `<th class="select-col" style="width: ${col.width || col.defaultWidth}px; text-align: center; padding-left: 16px;"><input type="checkbox" id="select-all-checkbox"></th>`;
    } else {
      let widthStyle = col.width ? `width: ${col.width}px;` : `width: ${col.defaultWidth}px;`;
      html += `<th draggable="true" ondragstart="handleDragStart(event, ${index})" ondragover="handleDragOver(event)" ondrop="handleDrop(event, ${index})" ondragend="handleDragEnd(event)" data-col="${col.id}" style="${widthStyle}">
        ${col.label}
        <div class="resizer" onmousedown="initResize(event, '${col.id}')" ondblclick="autoSizeColumn('${col.id}')"></div>
      </th>`;
    }
  });

  tr.innerHTML = html;

  // Re-bind select all checkbox
  const selectAll = document.getElementById('select-all-checkbox');
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      let filteredActivities = activities;
      if (currentFilter.type === 'phase') {
        filteredActivities = activities.filter(a => a.phase === currentFilter.value);
      } else if (currentFilter.type === 'status') {
        filteredActivities = activities.filter(a => a.status === currentFilter.value);
      }

      if (isChecked) {
        filteredActivities.forEach(a => selectedActivities.add(a.id));
      } else {
        selectedActivities.clear();
      }
      renderActivities();
    });
  }
}

// Fetch settings
const fetchSettings = async () => {
  try {
    const res = await fetch('/api/settings');
    appSettings = await res.json();
    if (appSettings.appName) {
      document.getElementById('app-title-tag').textContent = appSettings.appName;
      document.getElementById('app-name-display').innerHTML = appSettings.appName.replace(' ', '<br>');
    }
    if (appSettings.activityListTitle) {
      appHeadingInput.value = appSettings.activityListTitle;
    }
    populateSelects();
    renderSidebarNav(); // Added
  } catch (err) {
    console.error('Failed to fetch settings', err);
  }
}

function populateSelects() {
  const phaseSelect = document.getElementById('phase');
  const statusSelect = document.getElementById('status');
  phaseSelect.innerHTML = appSettings.phases.map(p => `<option value="${p}">${p}</option>`).join('');
  statusSelect.innerHTML = appSettings.statuses.map(s => `<option value="${s}">${s}</option>`).join('');

  const assigneeSelect = document.getElementById('assignee');
  if (assigneeSelect) {
    assigneeSelect.innerHTML = '<option value="">Unassigned</option>' + (appSettings.assignees || []).map(a => `<option value="${a.id}">${a.firstName} ${a.lastName}</option>`).join('');
  }
}

// Fetch and render
async function fetchActivities() {
  try {
    const res = await fetch(API_URL);
    activities = await res.json();
    renderActivities();
  } catch (err) {
    console.error('Failed to fetch activities', err);
  }
}

function getStatusClass(status) {
  const index = appSettings.statuses.indexOf(status);
  if (index === 0) return 'status-pending';
  if (index === appSettings.statuses.length - 1) return 'status-completed';
  return 'status-progress';
}

function formatForDateTimeLocal(isoString, tz = selectedTimezone) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d)) return '';

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = formatter.formatToParts(d);
    const p = {};
    parts.forEach(part => p[part.type] = part.value);
    const hour = p.hour === '24' ? '00' : p.hour;
    return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
  } catch (e) {
    // Fallback if timezone is invalid
    console.warn("Invalid timezone", tz);
    const pad = (num) => num.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

function parseFromTimezoneToUTC(localString, tz = selectedTimezone) {
  if (!localString) return '';
  // Convert 'YYYY-MM-DDThh:mm' input into a UTC timestamp to measure the raw numerical distance
  const faceTime = new Date(localString + 'Z').getTime();
  if (isNaN(faceTime)) return '';

  // See what UTC time it formats to in that timezone
  const formattedInTz = formatForDateTimeLocal(new Date(faceTime).toISOString(), tz);
  const faceTimeInTz = new Date(formattedInTz + 'Z').getTime();

  const offset = faceTimeInTz - faceTime;
  return new Date(faceTime - offset).toISOString();
}

// Convert HH:mm:ss to total seconds
function durationToSeconds(durationStr) {
  if (!durationStr) return 0;
  const parts = durationStr.split(':');
  if (parts.length !== 3) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const s = parseInt(parts[2], 10) || 0;
  return (h * 3600) + (m * 60) + s;
}

// Convert total seconds to HH:mm:ss
function secondsToDuration(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (num) => num.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

window.updateActivityField = async (id, field, value) => {
  try {
    let payloadValue = value;
    if ((field === 'begin_time' || field === 'end_time') && value) {
      payloadValue = parseFromTimezoneToUTC(value);
    } else if ((field === 'begin_time' || field === 'end_time') && !value) {
      payloadValue = '';
    }
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: payloadValue })
    });
    fetchActivities();
  } catch (err) {
    console.error('Failed to update field', err);
  }
};

window.resizeTextarea = (el) => {
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight) + 'px';
};

function formatDisplayDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat(navigator.language, {
    timeZone: selectedTimezone,
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function renderActivityRow(act, phaseNumber = '-', actIndex = -1) {
  const subNumber = phaseNumber !== '-' && actIndex !== -1 ? `${phaseNumber}.${actIndex + 1}` : '-';
  const isSelected = selectedActivities.has(act.id);

  let rowHtml = `<tr class="${isSelected ? 'selected-row' : ''}">`;

  columnState.filter(c => c.isVisible).forEach((col) => {
    if (col.id === 'select') {
      rowHtml += `<td class="select-col" style="text-align: center; padding-left: 16px;">
           <input type="checkbox" class="row-checkbox" value="${act.id}" ${isSelected ? 'checked' : ''}>
         </td>`;
    } else if (col.id === 'phase') {
      rowHtml += `<td style="font-weight: 600; color: var(--text-secondary);">${subNumber}</td>`;
    } else if (col.id === 'dependency') {
      if (isEditMode) {
        rowHtml += `<td>
           <select class="inline-select" style="max-width: 120px;" onchange="updateActivityField('${act.id}', 'dependency', this.value)">
             <option value="">None</option>
             ${activities.filter(a => a.id !== act.id).map(a => `<option value="${a.id}" ${a.id === act.dependency ? 'selected' : ''}>${getActivityNumber(a)} - ${a.title}</option>`).join('')}
           </select>
         </td>`;
      } else {
        const depAct = activities.find(a => a.id === act.dependency);
        rowHtml += `<td>${depAct ? getActivityNumber(depAct) + ' - ' + depAct.title : 'None'}</td>`;
      }
    } else if (col.id === 'title') {
      if (isEditMode) {
        rowHtml += `<td>
           <textarea class="inline-text inline-textarea" style="font-weight: 500;" oninput="resizeTextarea(this)" onchange="updateActivityField('${act.id}', 'title', this.value)" placeholder="Title" rows="1">${act.title}</textarea>
         </td>`;
      } else {
        rowHtml += `<td style="font-weight: 500; white-space: pre-wrap;">${act.title || ''}</td>`;
      }
    } else if (col.id === 'description') {
      if (isEditMode) {
        rowHtml += `<td>
           <textarea class="inline-text inline-textarea" style="color: var(--text-secondary);" oninput="resizeTextarea(this)" onchange="updateActivityField('${act.id}', 'description', this.value)" placeholder="Description" rows="1">${act.description}</textarea>
         </td>`;
      } else {
        rowHtml += `<td style="color: var(--text-secondary); white-space: pre-wrap;">${act.description || ''}</td>`;
      }
    } else if (col.id === 'assignee') {
      let assigneeDisplay = act.assignee || 'Unassigned';
      let initial = assigneeDisplay.charAt(0).toUpperCase() || '?';

      const assigneeObj = appSettings.assignees?.find(a => a.id === act.assignee);
      if (assigneeObj) {
        assigneeDisplay = `${assigneeObj.firstName} ${assigneeObj.lastName}`;
        initial = assigneeObj.firstName.charAt(0);
      }

      if (isEditMode) {
        rowHtml += `<td>
           <div style="display: flex; align-items: center; gap: 8px;">
             <div style="width: 24px; height: 24px; border-radius: 50%; background-color: var(--bg-tertiary); flex-shrink: 0; display: flex; justify-content: center; align-items: center; font-size: 0.7rem; font-weight: bold; color: var(--text-primary);">
               ${act.assignee ? initial : '?'}
             </div>
             <select class="inline-select" style="max-width: 120px;" onchange="updateActivityField('${act.id}', 'assignee', this.value)">
               <option value="">Unassigned</option>
               ${(appSettings.assignees || []).map(a => `<option value="${a.id}" ${a.id === act.assignee ? 'selected' : ''}>${a.firstName} ${a.lastName}</option>`).join('')}
               ${(!appSettings.assignees?.find(a => a.id === act.assignee) && act.assignee) ? `<option value="${act.assignee}" selected>${act.assignee}</option>` : ''}
             </select>
           </div>
         </td>`;
      } else {
        rowHtml += `<td>
           <div style="display: flex; align-items: center; gap: 8px;">
             <div style="width: 24px; height: 24px; border-radius: 50%; background-color: var(--bg-tertiary); flex-shrink: 0; display: flex; justify-content: center; align-items: center; font-size: 0.7rem; font-weight: bold; color: var(--text-primary);">
               ${act.assignee ? initial : '?'}
             </div>
             ${assigneeDisplay}
           </div>
         </td>`;
      }
    } else if (col.id === 'status') {
      if (isEditMode) {
        rowHtml += `<td>
           <select class="inline-select status-badge ${getStatusClass(act.status)}" style="padding: 2px 8px; font-weight: 600; text-transform: uppercase;" onchange="updateActivityField('${act.id}', 'status', this.value)">
             ${appSettings.statuses.map(s => `<option value="${s}" ${s === act.status ? 'selected' : ''} style="color: var(--text-primary); background: var(--bg-secondary);">${s}</option>`).join('')}
           </select>
         </td>`;
      } else {
        rowHtml += `<td><span class="status-badge ${getStatusClass(act.status)}" style="padding: 2px 8px; font-weight: 600; text-transform: uppercase; display: inline-block;">${act.status || ''}</span></td>`;
      }
    } else if (col.id === 'begin_time') {
      if (isEditMode) {
        rowHtml += `<td class="time-col">
           <input type="datetime-local" class="inline-input" value="${formatForDateTimeLocal(act.begin_time)}" onchange="updateActivityField('${act.id}', 'begin_time', this.value)">
         </td>`;
      } else {
        rowHtml += `<td class="time-col" style="white-space: nowrap;">${act.begin_time ? formatDisplayDate(act.begin_time) : '-'}</td>`;
      }
    } else if (col.id === 'end_time') {
      if (isEditMode) {
        rowHtml += `<td class="time-col">
           <input type="datetime-local" class="inline-input" value="${formatForDateTimeLocal(act.end_time)}" onchange="updateActivityField('${act.id}', 'end_time', this.value)">
         </td>`;
      } else {
        rowHtml += `<td class="time-col" style="white-space: nowrap;">${act.end_time ? formatDisplayDate(act.end_time) : '-'}</td>`;
      }
    } else if (col.id === 'duration') {
      rowHtml += `<td class="time-col" style="font-family: monospace;">${act.duration || '-'}</td>`;
    }
  });

  rowHtml += `</tr>`;
  return rowHtml;
}

// Compute dynamic sub-number (e.g. 1.1) for an activity
function getActivityNumber(act) {
  const phaseIndex = appSettings.phases.indexOf(act.phase);
  if (phaseIndex === -1) return '-';
  const phaseNumber = phaseIndex + 1;
  const phaseActivities = activities.filter(a => a.phase === act.phase);
  const actIndex = phaseActivities.findIndex(a => a.id === act.id);
  return actIndex !== -1 ? `${phaseNumber}.${actIndex + 1}` : '-';
}

function renderActivities() {
  renderTableHeader();

  let filteredActivities = activities;
  if (currentFilter.type === 'phase') {
    filteredActivities = activities.filter(a => a.phase === currentFilter.value);
  } else if (currentFilter.type === 'status') {
    filteredActivities = activities.filter(a => a.status === currentFilter.value);
  }

  // Calculate global total time
  const globalTotalSeconds = filteredActivities.reduce((sum, act) => sum + durationToSeconds(act.duration), 0);
  const globalTotalDuration = secondsToDuration(globalTotalSeconds);

  activityCount.innerHTML = `
    <span style="font-weight: 500">${filteredActivities.length} Activit${filteredActivities.length === 1 ? 'y' : 'ies'}</span>
    <span style="background-color: var(--bg-tertiary); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; margin-left: 12px; border: 1px solid var(--border-color);">Total Time: <strong>${globalTotalDuration}</strong></span>
  `;

  if (filteredActivities.length === 0) {
    activitiesBody.innerHTML = `
      <tr>
        <td colspan="${columnState.length}">
          <div class="empty-state">
            <p>No ${appSettings.appName ? appSettings.appName : 'go-live'} activities found for this filter.</p>
          </div>
        </td>
      </tr>
    `;
    setTimeout(initTextareas, 0);
    return;
  }

  let html = '';

  // Group activities by Phase configuration order
  appSettings.phases.forEach((phase, phaseIndex) => {
    // Hide Phase if filtering by a different phase
    if (currentFilter.type === 'phase' && currentFilter.value !== phase) return;

    const phaseNumber = phaseIndex + 1;
    const phaseActivities = filteredActivities.filter(a => a.phase === phase);

    // Calculate Phase Total Time
    const phaseTotalSeconds = phaseActivities.reduce((sum, act) => sum + durationToSeconds(act.duration), 0);
    const phaseTotalDuration = secondsToDuration(phaseTotalSeconds);

    // Always render a phase header row
    html += `
          <tr style="background-color: rgba(255,255,255,0.05);">
            <td colspan="${columnState.length - 2}" style="font-weight: 700; color: var(--accent-color); padding: 12px 24px; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em;">
              Phase ${phaseNumber}: ${phase}
            </td>
            <td colspan="2" style="font-weight: 700; color: var(--text-primary); text-align: right; padding: 12px 24px; font-size: 0.85rem; font-family: monospace;">
              Total: ${phaseTotalDuration}
            </td>
          </tr>
        `;

    // Render activities within this phase
    if (phaseActivities.length === 0) {
      html += `
             <tr>
               <td colspan="${columnState.length}" style="text-align: center; color: var(--text-secondary); padding: 24px; font-style: italic;">
                 No activities in this phase.
               </td>
             </tr>
           `;
    } else {
      html += phaseActivities.map((act, actIndex) => renderActivityRow(act, phaseNumber, actIndex)).join('');
    }
  });

  // Render unassigned or orphaned phase activities at the bottom
  const unphasedActivities = filteredActivities.filter(a => !appSettings.phases.includes(a.phase));
  if (unphasedActivities.length > 0) {
    html += `
          <tr style="background-color: rgba(255,255,255,0.02);">
            <td colspan="${columnState.length}" style="font-weight: 700; color: var(--text-secondary); padding: 12px 24px; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em;">
              Uncategorized Activities
            </td>
          </tr>
        `;
    html += unphasedActivities.map((act) => renderActivityRow(act, '-', -1)).join('');
  }

  activitiesBody.innerHTML = html;

  // Update select-all checkbox state
  const saf = document.getElementById('select-all-checkbox');
  if (saf) {
    if (filteredActivities.length > 0 && selectedActivities.size === filteredActivities.length) {
      saf.checked = true;
    } else {
      saf.checked = false;
    }
  }

  updateBulkActionButtons();

  setTimeout(initTextareas, 0);
}

function updateBulkActionButtons() {
  if (selectedActivities.size > 0) {
    bulkEditBtn.style.display = 'inline-block';
    bulkDeleteBtn.style.display = 'inline-block';
  } else {
    bulkEditBtn.style.display = 'none';
    bulkDeleteBtn.style.display = 'none';
  }
}

// Bulk Selection Event Listeners

activitiesBody.addEventListener('change', (e) => {
  if (e.target.classList.contains('row-checkbox')) {
    const id = e.target.value;
    if (e.target.checked) {
      selectedActivities.add(id);
    } else {
      selectedActivities.delete(id);
    }

    // Toggle row class
    const tr = e.target.closest('tr');
    if (tr) tr.classList.toggle('selected-row', e.target.checked);

    updateBulkActionButtons();

    // Check if we need to update select-all checkbox visually without full re-render
    const visibleCheckboxes = activitiesBody.querySelectorAll('.row-checkbox');
    const allChecked = Array.from(visibleCheckboxes).every(cb => cb.checked);
    const saf2 = document.getElementById('select-all-checkbox');
    if (saf2) saf2.checked = allChecked && visibleCheckboxes.length > 0;
  }
});

function initTextareas() {
  document.querySelectorAll('.inline-textarea').forEach(ta => {
    window.resizeTextarea(ta);
  });
}

function renderSidebarNav() {
  const nav = document.getElementById('sidebar-nav');
  let html = `<a href="#" data-type="all" data-value="" class="${currentFilter.type === 'all' ? 'active' : ''}"><span>All Activities</span></a>`;

  if (appSettings.phases && appSettings.phases.length > 0) {
    html += `<div style="padding: 12px 24px 8px; font-size: 0.70rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); letter-spacing: 0.05em;">Phases</div>`;
    appSettings.phases.forEach(phase => {
      const isActive = currentFilter.type === 'phase' && currentFilter.value === phase;
      html += `<a href="#" data-type="phase" data-value="${phase}" class="${isActive ? 'active' : ''}"><span>${phase}</span></a>`;
    });
  }

  if (appSettings.statuses && appSettings.statuses.length > 0) {
    html += `<div style="padding: 12px 24px 8px; font-size: 0.70rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); letter-spacing: 0.05em;">Statuses</div>`;
    appSettings.statuses.forEach(status => {
      const isActive = currentFilter.type === 'status' && currentFilter.value === status;
      html += `<a href="#" data-type="status" data-value="${status}" class="${isActive ? 'active' : ''}"><span>${status}</span></a>`;
    });
  }

  nav.innerHTML = html;

  nav.querySelectorAll('a').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      currentFilter = {
        type: anchor.getAttribute('data-type'),
        value: anchor.getAttribute('data-value')
      };
      renderSidebarNav();
      renderActivities();
    });
  });
}

// Modal logic
let isBulkEdit = false;

function openModal(isEdit = false, editingId = null) {
  const depSelect = document.getElementById('dependency');
  depSelect.innerHTML = '<option value="">None</option>' +
    activities.filter(a => a.id !== editingId).map(a => `<option value="${a.id}">${getActivityNumber(a)} - ${a.title}</option>`).join('');

  modal.classList.add('active');
  modalTitle.textContent = isEdit ? 'Edit Activity' : 'New Activity';
}

function openBulkEditModal() {
  isBulkEdit = true;
  modal.classList.add('active');
  modalTitle.textContent = `Bulk Edit (${selectedActivities.size} Activities)`;
  activityForm.reset();
  document.getElementById('activity-id').value = '';

  const depSelect = document.getElementById('dependency');
  depSelect.innerHTML = '<option value="">None</option>' +
    activities.map(a => `<option value="${a.id}">${getActivityNumber(a)} - ${a.title}</option>`).join('');

  // Hide fields that shouldn't be bulk edited
  document.getElementById('title').closest('.form-group').style.display = 'none';
  document.getElementById('title').removeAttribute('required');
  document.getElementById('description').closest('.form-group').style.display = 'none';
  document.getElementById('begin_time').closest('.form-group').style.display = 'none';

  // Clear defaults so we don't accidentally overwrite if left blank
  document.getElementById('phase').value = '';
  document.getElementById('status').value = '';
}

function closeModal() {
  modal.classList.remove('active');
  activityForm.reset();
  document.getElementById('activity-id').value = '';

  if (isBulkEdit) {
    isBulkEdit = false;
    document.getElementById('title').closest('.form-group').style.display = 'block';
    document.getElementById('title').setAttribute('required', 'true');
    document.getElementById('description').closest('.form-group').style.display = 'block';
    document.getElementById('begin_time').closest('.form-group').style.display = 'flex';
  }
}

function showConfirm(message, onConfirm) {
  const confirmModal = document.getElementById('confirm-modal');
  document.getElementById('confirm-message').textContent = message;
  confirmModal.classList.add('active');

  const okBtn = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');

  const newOkBtn = okBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newOkBtn.addEventListener('click', () => {
    confirmModal.classList.remove('active');
    onConfirm();
  });

  newCancelBtn.addEventListener('click', () => {
    confirmModal.classList.remove('active');
  });
}

window.openEditModal = (id) => {
  const act = activities.find(a => a.id === id);
  if (act) {
    document.getElementById('activity-id').value = act.id;
    document.getElementById('phase').value = act.phase || '';
    document.getElementById('title').value = act.title;
    document.getElementById('description').value = act.description;
    document.getElementById('assignee').value = act.assignee;
    document.getElementById('status').value = act.status;
    document.getElementById('begin_time').value = formatForDateTimeLocal(act.begin_time);
    document.getElementById('end_time').value = formatForDateTimeLocal(act.end_time);
    openModal(true, act.id);
    document.getElementById('dependency').value = act.dependency || '';
  }
};

window.deleteActivity = (id) => {
  showConfirm('Are you sure you want to delete this activity?', async () => {
    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      fetchActivities();
    } catch (err) {
      console.error('Failed to delete activity', err);
    }
  });
};

// --- Event Listeners ---

// Inline Title Edit
const saveAppHeading = async () => {
  const newTitle = appHeadingInput.value.trim() || 'Cut-over Activities';
  appHeadingInput.value = newTitle;
  appSettings.activityListTitle = newTitle;
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appSettings)
    });
  } catch (err) {
    console.error('Failed to save heading', err);
  }
};
appHeadingInput.addEventListener('blur', saveAppHeading);
appHeadingInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    appHeadingInput.blur();
  }
});

// Sidebar toggle & Overlay
addBtn.addEventListener('click', () => openModal(false));
closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

bulkDeleteBtn.addEventListener('click', () => {
  showConfirm(`Are you sure you want to delete ${selectedActivities.size} activities?`, async () => {
    try {
      for (const actId of selectedActivities) {
        await fetch(`${API_URL}/${actId}`, { method: 'DELETE' });
      }
      selectedActivities.clear();
      const saf3 = document.getElementById('select-all-checkbox');
      if (saf3) saf3.checked = false;
      updateBulkActionButtons();
      fetchActivities();
    } catch (err) {
      console.error('Failed to bulk delete activities', err);
    }
  });
});

bulkEditBtn.addEventListener('click', () => {
  if (selectedActivities.size === 1) {
    openEditModal(Array.from(selectedActivities)[0]);
  } else if (selectedActivities.size > 1) {
    openBulkEditModal();
  }
});

activityForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('activity-id').value;
  const beginValue = document.getElementById('begin_time').value;
  const endValue = document.getElementById('end_time').value;
  const activityData = {
    phase: document.getElementById('phase').value,
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    assignee: document.getElementById('assignee').value,
    status: document.getElementById('status').value,
    dependency: document.getElementById('dependency').value,
    begin_time: beginValue ? parseFromTimezoneToUTC(beginValue) : '',
    end_time: endValue ? parseFromTimezoneToUTC(endValue) : ''
  };

  try {
    if (isBulkEdit) {
      const bulkData = {};
      if (document.getElementById('phase').value) bulkData.phase = document.getElementById('phase').value;
      if (activityData.assignee) bulkData.assignee = activityData.assignee;
      if (document.getElementById('status').value) bulkData.status = document.getElementById('status').value;
      if (activityData.dependency) bulkData.dependency = activityData.dependency;

      if (Object.keys(bulkData).length === 0) {
        alert("Please set at least one field to update.");
        return;
      }

      for (const actId of selectedActivities) {
        await fetch(`${API_URL}/${actId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulkData)
        });
      }
      selectedActivities.clear();
      const saf3 = document.getElementById('select-all-checkbox');
      if (saf3) saf3.checked = false;
      updateBulkActionButtons();
    } else {
      if (id) {
        // Update
        await fetch(`${API_URL}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activityData)
        });
      } else {
        // Create
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activityData)
        });
      }
    }
    closeModal();
    fetchActivities();
  } catch (err) {
    console.error('Failed to save activity', err);
  }
});

// Settings Modal Logic
function openSettingsModal() {
  editingSettings = JSON.parse(JSON.stringify(appSettings));
  if (!editingSettings.workHours) editingSettings.workHours = [];
  if (!editingSettings.assignees) editingSettings.assignees = [];

  document.getElementById('settings-app-name-input').value = editingSettings.appName || 'Go-Live Planner';
  switchSettingsTab('general');
  renderSettingsLists();
  settingsModal.classList.add('active');
}

document.getElementById('tab-general-btn').addEventListener('click', () => switchSettingsTab('general'));
document.getElementById('tab-team-btn').addEventListener('click', () => switchSettingsTab('team'));

function switchSettingsTab(tab) {
  const genBtn = document.getElementById('tab-general-btn');
  const teamBtn = document.getElementById('tab-team-btn');
  const genContent = document.getElementById('tab-general-content');
  const teamContent = document.getElementById('tab-team-content');

  if (tab === 'general') {
    genBtn.classList.add('active');
    genBtn.style.borderBottomColor = 'var(--accent-color)';
    genBtn.style.color = 'var(--text-primary)';
    teamBtn.classList.remove('active');
    teamBtn.style.borderBottomColor = 'transparent';
    teamBtn.style.color = 'var(--text-secondary)';
    genContent.style.display = 'block';
    teamContent.style.display = 'none';
  } else {
    teamBtn.classList.add('active');
    teamBtn.style.borderBottomColor = 'var(--accent-color)';
    teamBtn.style.color = 'var(--text-primary)';
    genBtn.classList.remove('active');
    genBtn.style.borderBottomColor = 'transparent';
    genBtn.style.color = 'var(--text-secondary)';
    teamContent.style.display = 'block';
    genContent.style.display = 'none';
    populateAssigneeFormSelects(); // Ensure dropdowns are loaded if needed
  }
}

function closeSettingsModal() {
  settingsModal.classList.remove('active');
}

function renderSettingsLists() {
  const phasesList = document.getElementById('settings-phases-list');
  const statusesList = document.getElementById('settings-statuses-list');
  const workHoursList = document.getElementById('settings-workhours-list');
  const assigneesList = document.getElementById('settings-assignees-list');

  phasesList.innerHTML = editingSettings.phases.map((p, i) => `
    <div class="sortable-item" draggable="true" ondragstart="dragStart(event, 'phases', ${i})" ondragover="dragOver(event)" ondrop="drop(event, 'phases', ${i})">
      <div><span class="drag-handle">≡</span><span>${p}</span></div>
      <div class="item-actions"><button type="button" onclick="removeSettingItem('phases', ${i})">✖</button></div>
    </div>
  `).join('');

  statusesList.innerHTML = editingSettings.statuses.map((s, i) => `
    <div class="sortable-item" draggable="true" ondragstart="dragStart(event, 'statuses', ${i})" ondragover="dragOver(event)" ondrop="drop(event, 'statuses', ${i})">
      <div><span class="drag-handle">≡</span><span>${s}</span></div>
      <div class="item-actions"><button type="button" onclick="removeSettingItem('statuses', ${i})">✖</button></div>
    </div>
  `).join('');

  if (workHoursList) {
    workHoursList.innerHTML = (editingSettings.workHours || []).map((w, i) => `
      <div class="sortable-item" style="cursor: default;">
        <div><span>${w.label}</span></div>
        <div class="item-actions"><button type="button" onclick="removeWorkHour(${i})">✖</button></div>
      </div>
    `).join('');
  }

  if (assigneesList) {
    assigneesList.innerHTML = (editingSettings.assignees || []).map((a, i) => `
      <div class="sortable-item" style="cursor: default; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03);">
        <div>
          <div style="font-weight: 600;">${a.firstName} ${a.lastName}</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">${a.email} | ${a.timezone}</div>
        </div>
        <div class="item-actions">
          <button type="button" onclick="editAssignee(${i})" style="margin-right: 8px; background: none; border: none; color: var(--text-secondary); cursor: pointer;">✎</button>
          <button type="button" onclick="removeAssignee(${i})" style="background: none; border: none; color: var(--text-secondary); cursor: pointer;">✖</button>
        </div>
      </div>
    `).join('');
  }
}

let draggedItem = null;
window.dragStart = (e, list, index) => { draggedItem = { list, index }; };
window.dragOver = (e) => { e.preventDefault(); };
window.drop = (e, list, targetIndex) => {
  e.preventDefault();
  if (draggedItem && draggedItem.list === list) {
    const items = editingSettings[list];
    const [movedItem] = items.splice(draggedItem.index, 1);
    items.splice(targetIndex, 0, movedItem);
    renderSettingsLists();
  }
};

window.removeSettingItem = (list, index) => {
  editingSettings[list].splice(index, 1);
  renderSettingsLists();
};

document.getElementById('add-phase-btn').addEventListener('click', () => {
  const input = document.getElementById('new-phase-input');
  if (input.value.trim()) {
    editingSettings.phases.push(input.value.trim());
    input.value = '';
    renderSettingsLists();
  }
});

document.getElementById('add-status-btn').addEventListener('click', () => {
  const input = document.getElementById('new-status-input');
  if (input.value.trim()) {
    editingSettings.statuses.push(input.value.trim());
    input.value = '';
    renderSettingsLists();
  }
});

document.getElementById('add-workhour-btn').addEventListener('click', () => {
  const input = document.getElementById('new-workhour-input');
  if (input.value.trim()) {
    editingSettings.workHours.push({
      id: Date.now().toString(),
      label: input.value.trim()
    });
    input.value = '';
    renderSettingsLists();
    populateAssigneeFormSelects(); // update assignee form immediately
  }
});

window.removeWorkHour = (index) => {
  editingSettings.workHours.splice(index, 1);
  renderSettingsLists();
  populateAssigneeFormSelects(); // update assignee form immediately
};

const assigneeFormContainer = document.getElementById('add-assignee-form-container');
document.getElementById('show-add-assignee-btn').addEventListener('click', () => {
  resetAssigneeForm();
  assigneeFormContainer.style.display = 'block';
});

document.getElementById('cancel-assignee-btn').addEventListener('click', () => {
  assigneeFormContainer.style.display = 'none';
});

document.getElementById('save-assignee-btn').addEventListener('click', () => {
  const idInput = document.getElementById('assignee-id').value;
  const firstName = document.getElementById('assignee-firstname').value.trim();
  const lastName = document.getElementById('assignee-lastname').value.trim();
  const email = document.getElementById('assignee-email').value.trim();
  const phone = document.getElementById('assignee-phone').value.trim();
  const timezone = document.getElementById('assignee-timezone').value;
  const workHoursId = document.getElementById('assignee-workhours').value;

  if (!firstName || !lastName || !email || !timezone || !workHoursId) {
    alert("Please fill out all required fields.");
    return;
  }

  if (idInput) {
    const idx = editingSettings.assignees.findIndex(a => a.id === idInput);
    if (idx !== -1) {
      editingSettings.assignees[idx] = { id: idInput, firstName, lastName, email, phone, timezone, workHoursId };
    }
  } else {
    editingSettings.assignees.push({
      id: Date.now().toString(),
      firstName, lastName, email, phone, timezone, workHoursId
    });
  }

  assigneeFormContainer.style.display = 'none';
  renderSettingsLists();
});

window.editAssignee = (index) => {
  const a = editingSettings.assignees[index];
  document.getElementById('assignee-id').value = a.id;
  document.getElementById('assignee-firstname').value = a.firstName;
  document.getElementById('assignee-lastname').value = a.lastName;
  document.getElementById('assignee-email').value = a.email;
  document.getElementById('assignee-phone').value = a.phone || '';

  populateAssigneeFormSelects();

  document.getElementById('assignee-timezone').value = a.timezone;
  document.getElementById('assignee-workhours').value = a.workHoursId;

  document.getElementById('assignee-form-title').textContent = 'Edit Assignee';
  assigneeFormContainer.style.display = 'block';
};

window.removeAssignee = (index) => {
  editingSettings.assignees.splice(index, 1);
  renderSettingsLists();
};

function resetAssigneeForm() {
  document.getElementById('assignee-id').value = '';
  document.getElementById('assignee-firstname').value = '';
  document.getElementById('assignee-lastname').value = '';
  document.getElementById('assignee-email').value = '';
  document.getElementById('assignee-phone').value = '';
  document.getElementById('assignee-form-title').textContent = 'New Assignee';

  populateAssigneeFormSelects();
}

function populateAssigneeFormSelects() {
  const tzSelect = document.getElementById('assignee-timezone');
  if (tzSelect && tzSelect.options.length === 0) {
    try {
      tzSelect.innerHTML = Intl.supportedValuesOf('timeZone').map(tz => `<option value="${tz}">${tz}</option>`).join('');
    } catch (e) { tzSelect.innerHTML = '<option value="UTC">UTC</option>'; }
    tzSelect.value = selectedTimezone;
  }

  const whSelect = document.getElementById('assignee-workhours');
  if (whSelect) {
    whSelect.innerHTML = '<option value="">Select Policy...</option>' + (editingSettings.workHours || []).map(w => `<option value="${w.id}">${w.label}</option>`).join('');
  }
}

saveSettingsBtn.addEventListener('click', async () => {
  editingSettings.appName = document.getElementById('settings-app-name-input').value.trim() || 'Go-Live Planner';
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingSettings)
    });
    if (res.ok) {
      appSettings = await res.json();
      if (appSettings.appName) {
        document.getElementById('app-title-tag').textContent = appSettings.appName;
        document.getElementById('app-name-display').innerHTML = appSettings.appName.replace(' ', '<br>');
      }
      populateSelects();
      renderSidebarNav();
      renderActivities();
      closeSettingsModal();
    }
  } catch (err) {
    console.error('Failed to save settings', err);
  }
});

settingsBtn.addEventListener('click', openSettingsModal);
closeSettingsBtn.addEventListener('click', closeSettingsModal);
cancelSettingsBtn.addEventListener('click', closeSettingsModal);

// Sidebar Toggle
const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
if (isCollapsed) {
  sidebar.classList.add('collapsed');
  appContainer.classList.add('sidebar-collapsed');
}

sidebarToggleBtn.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  appContainer.classList.toggle('sidebar-collapsed');
  localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
});

sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.add('collapsed');
  appContainer.classList.add('sidebar-collapsed');
  localStorage.setItem('sidebarCollapsed', true);
});

// History Modal Logic
window.openHistoryModal = (id) => {
  const act = activities.find(a => a.id === id);
  if (!act) return;

  let history = [];
  try {
    history = act.edit_log ? JSON.parse(act.edit_log) : [];
  } catch (e) { }

  if (history.length === 0) {
    historyList.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No history available.</p>';
  } else {
    // Sort newest first
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    historyList.innerHTML = history.map(log => `
            <div style="background-color: var(--bg-tertiary); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">${log.user}</span>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">${new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                    ${log.action}
                </div>
            </div>
        `).join('');
  }
  historyModal.classList.add('active');
};

closeHistoryBtn.addEventListener('click', () => historyModal.classList.remove('active'));
cancelHistoryBtn.addEventListener('click', () => historyModal.classList.remove('active'));

// --- Column Resizing & Toggling Logic ---

const tableHeaders = document.querySelectorAll('#activities-table th');

function renderColumnsMenu() {
  columnsMenu.innerHTML = columnState.map((col, index) => {
    if (col.isFixed) return ''; // Hide fixed columns from menu
    return `
      <label class="dropdown-item">
        <input type="checkbox" data-index="${index}" ${col.isVisible ? 'checked' : ''}>
        ${col.label}
      </label>
    `;
  }).join('');

  columnsMenu.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      columnState[idx].isVisible = e.target.checked;
      saveColumnState();
      applyColumnStyles();
    });
  });
}

function applyColumnStyles() {
  let cssVars = '';
  let hideRules = '';

  columnState.forEach((col, index) => {
    const nth = index + 1; // 1-indexed for CSS
    if (!col.isVisible) {
      hideRules += `
        #activities-table th:nth-child(${nth}),
        #activities-table td:nth-child(${nth}) {
          display: none;
        }
      `;
    }
  });

  tableHeaders.forEach((th, index) => {
    th.style.width = columnState[index].defaultWidth + 'px';
  });

  dynamicColumnStyles.textContent = hideRules;
}

function initResizing() {
  tableHeaders.forEach((th, index) => {
    let resizer = th.querySelector('.resizer');
    if (!resizer) {
      resizer = document.createElement('div');
      resizer.classList.add('resizer');
      th.appendChild(resizer);
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.pageX;
      startWidth = th.offsetWidth;
      resizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      e.stopPropagation();
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const currentWidth = Math.max(50, startWidth + (e.pageX - startX));
      th.style.width = currentWidth + 'px';
      columnState[index].defaultWidth = currentWidth;
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        saveColumnState();
      }
    });

    resizer.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const nth = index + 1;
      const cells = document.querySelectorAll(`#activities-table th:nth-child(${nth}), #activities-table td:nth-child(${nth})`);

      let maxWidth = 50;
      cells.forEach(cell => {
        let contentWidth = 0;
        const textarea = cell.querySelector('textarea');
        const select = cell.querySelector('select');

        if (textarea) {
          contentWidth = textarea.scrollWidth;
        } else if (select) {
          contentWidth = select.offsetWidth;
        } else {
          // For standard cells, temporarily force them to measure full width
          cell.style.whiteSpace = 'nowrap';
          contentWidth = cell.scrollWidth;
          cell.style.whiteSpace = ''; // Reset
        }

        if (contentWidth > maxWidth) {
          maxWidth = contentWidth;
        }
      });

      // Add buffer for paddings
      maxWidth += 24;

      th.style.width = maxWidth + 'px';
      columnState[index].defaultWidth = maxWidth;
      saveColumnState();
    });
  });
}

columnsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  columnsMenu.classList.toggle('active');
});

document.addEventListener('click', (e) => {
  if (!columnsBtn.contains(e.target) && !columnsMenu.contains(e.target)) {
    columnsMenu.classList.remove('active');
  }
});


// Init Timezone Selector
const timezoneSelector = document.getElementById('timezone-selector');
const TIMEZONES = [
  { value: Intl.DateTimeFormat().resolvedOptions().timeZone, label: 'Local Time' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/Los_Angeles', label: 'PST/PDT (US Pacific)' },
  { value: 'America/Denver', label: 'MST/MDT (US Mountain)' },
  { value: 'America/Chicago', label: 'CST/CDT (US Central)' },
  { value: 'America/New_York', label: 'EST/EDT (US Eastern)' },
  { value: 'Europe/London', label: 'UK Time' },
  { value: 'Europe/Berlin', label: 'CET/CEST (Germany)' },
  { value: 'Europe/Bucharest', label: 'EET/EEST (Romania)' },
  { value: 'Asia/Kolkata', label: 'IST (India)' },
  { value: 'Asia/Singapore', label: 'SGT (Singapore)' },
  { value: 'Australia/Sydney', label: 'AEST/AEDT (Sydney)' }
];

timezoneSelector.innerHTML = TIMEZONES.map(tz =>
  `<option value="${tz.value}" ${tz.value === selectedTimezone ? 'selected' : ''} style="color: var(--text-primary); background: var(--bg-secondary);">${tz.label}</option>`
).join('');

timezoneSelector.addEventListener('change', (e) => {
  selectedTimezone = e.target.value;
  localStorage.setItem('selectedTimezone', selectedTimezone);
  renderActivities();
});

// Init
fetchSettings().then(() => {
  renderSidebarNav();
  fetchActivities();
  renderColumnsMenu();
  applyColumnStyles();
  initResizing();
});
