const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const CSV_FILE = path.join(DATA_DIR, 'go_live_activities.csv');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const csvHeaders = [
  { id: 'id', title: 'id' },
  { id: 'phase', title: 'phase' },
  { id: 'title', title: 'title' },
  { id: 'description', title: 'description' },
  { id: 'assignee', title: 'assignee' },
  { id: 'status', title: 'status' },
  { id: 'begin_time', title: 'begin_time' },
  { id: 'end_time', title: 'end_time' },
  { id: 'duration', title: 'duration' },
  { id: 'edit_log', title: 'edit_log' },
  { id: 'dependency', title: 'dependency' }
];

// Initialize CSV file if it doesn't exist
if (!fs.existsSync(CSV_FILE)) {
  const csvWriter = createCsvWriter({
    path: CSV_FILE,
    header: csvHeaders
  });
  csvWriter.writeRecords([]).then(() => console.log('Created new CSV file'));
}

const defaultSettings = {
  appName: "Production Planner",
  activityListTitle: "Cut-over Activities",
  phases: ["Phase 1: Pre-Cutover", "Phase 2: Ramp Down", "Phase 3: Ramp Up", "Phase 4: Cutover", "Phase 5: Post-Go-Live"],
  statuses: ["Not Started", "Pending", "In Progress", "Completed"],
  assignees: [],
  workHours: []
};

if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
}

// Helper to read settings
const readSettings = () => {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return { ...defaultSettings, ...parsed }; // merge with defaults
  } catch (e) {
    return defaultSettings;
  }
};

// Helper to write settings
const writeSettings = (settings) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
};

// Helper to write all records
const writeRecords = async (records) => {
  const csvWriter = createCsvWriter({
    path: CSV_FILE,
    header: csvHeaders
  });
  return csvWriter.writeRecords(records);
};

// Helper to read all records
const readRecords = () => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(CSV_FILE)
      .pipe(csvParser())
      .on('data', (data) => {
        if (Object.values(data).some(val => val && val.trim() !== '')) {
          results.push(data);
        }
      })
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

// --- API Endpoints ---

// Get settings
app.get('/api/settings', (req, res) => {
  res.json(readSettings());
});

// Update settings
app.put('/api/settings', (req, res) => {
  try {
    const settings = req.body;
    if (!settings.phases || !settings.statuses) {
      return res.status(400).json({ error: 'Invalid settings format' });
    }
    writeSettings(settings);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Get all activities
app.get('/api/activities', async (req, res) => {
  try {
    const records = await readRecords();
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read activities' });
  }
});

// Create new activity
app.post('/api/activities', async (req, res) => {
  try {
    const records = await readRecords();
    const settings = readSettings();
    const defaultStatus = settings.statuses.length > 0 ? settings.statuses[0] : 'Pending';

    const newActivity = {
      id: Date.now().toString(),
      phase: req.body.phase || '',
      title: req.body.title || '',
      description: req.body.description || '',
      assignee: req.body.assignee || '',
      status: req.body.status || defaultStatus,
      begin_time: req.body.begin_time || '',
      end_time: req.body.end_time || '',
      duration: req.body.duration || '',
      dependency: req.body.dependency || '',
      edit_log: JSON.stringify([{
        timestamp: new Date().toISOString(),
        action: 'Created',
        user: req.body.editor_name || 'System'
      }])
    };

    // Check if status is a "started" status (not the first one)
    const isStarted = settings.statuses.indexOf(newActivity.status) > 0;
    const isCompleted = settings.statuses.indexOf(newActivity.status) === settings.statuses.length - 1;

    if (isStarted && !newActivity.begin_time) {
      newActivity.begin_time = new Date().toISOString();
    }
    if (isCompleted && !newActivity.end_time) {
      newActivity.end_time = new Date().toISOString();
      if (!newActivity.begin_time) {
        newActivity.begin_time = newActivity.end_time; // Fallback if jumped straight to completed
      }
    }
    if (newActivity.begin_time && newActivity.end_time) {
      newActivity.duration = calculateDuration(newActivity.begin_time, newActivity.end_time);
    }

    records.push(newActivity);
    await writeRecords(records);
    res.status(201).json(newActivity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// Helper to calculate duration in HH:mm:ss format
function calculateDuration(startISO, endISO) {
  if (!startISO || !endISO) return '';
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (isNaN(start) || isNaN(end) || end < start) return '';

  const diffMs = end - start;
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  const s = Math.floor((diffMs % 60000) / 1000);

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Update activity
app.put('/api/activities/:id', async (req, res) => {
  try {
    const records = await readRecords();
    const settings = readSettings();
    const index = records.findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Only update fields that are provided
    const updatedRecord = { ...records[index] };
    const oldStatus = updatedRecord.status;
    const newStatus = req.body.status !== undefined ? req.body.status : oldStatus;

    if (req.body.phase !== undefined) updatedRecord.phase = req.body.phase;
    if (req.body.title !== undefined) updatedRecord.title = req.body.title;
    if (req.body.description !== undefined) updatedRecord.description = req.body.description;
    if (req.body.assignee !== undefined) updatedRecord.assignee = req.body.assignee;
    if (req.body.dependency !== undefined) {
      updatedRecord.dependency = req.body.dependency;
      if (req.body.dependency) {
        const depRecord = records.find(r => r.id === req.body.dependency);
        if (depRecord && depRecord.end_time) {
          updatedRecord.begin_time = depRecord.end_time;
        }
      }
    }

    const oldStatusIndex = settings.statuses.indexOf(oldStatus);
    const newStatusIndex = settings.statuses.indexOf(newStatus);
    const isNowStarted = newStatusIndex > 0;
    const wasStarted = oldStatusIndex > 0;
    const isNowCompleted = newStatusIndex === settings.statuses.length - 1;
    const wasCompleted = oldStatusIndex === settings.statuses.length - 1;

    // Auto-calculate begin_time when changing from pending to non-pending
    if (isNowStarted && !wasStarted && !updatedRecord.begin_time) {
      updatedRecord.begin_time = new Date().toISOString();
    }

    // Auto-calculate end_time when changing to latest status (Completed)
    if (isNowCompleted && !wasCompleted) {
      updatedRecord.end_time = new Date().toISOString();
    }

    // Manual overrides
    if (req.body.begin_time !== undefined) updatedRecord.begin_time = req.body.begin_time;
    if (req.body.end_time !== undefined) updatedRecord.end_time = req.body.end_time;

    // Recalculate duration every time if both times exist
    if (updatedRecord.begin_time && updatedRecord.end_time) {
      updatedRecord.duration = calculateDuration(updatedRecord.begin_time, updatedRecord.end_time);
    }

    updatedRecord.status = newStatus;
    if (req.body.duration !== undefined) updatedRecord.duration = req.body.duration;

    // Log the change
    let currentLog = [];
    try {
      currentLog = updatedRecord.edit_log ? JSON.parse(updatedRecord.edit_log) : [];
    } catch (e) { }

    // Build a message of what changed
    const changes = [];
    if (oldStatus !== newStatus) changes.push(`Status to ${newStatus}`);
    if (req.body.phase !== undefined && records[index].phase !== req.body.phase) changes.push(`Phase to ${req.body.phase}`);
    if (req.body.assignee !== undefined && records[index].assignee !== req.body.assignee) changes.push(`Assignee to ${req.body.assignee}`);
    if (req.body.title !== undefined && records[index].title !== req.body.title) changes.push(`Title edit`);
    if (req.body.description !== undefined && records[index].description !== req.body.description) changes.push(`Description edit`);
    if (req.body.begin_time !== undefined && records[index].begin_time !== req.body.begin_time) changes.push(`Begin Time edit`);
    if (req.body.end_time !== undefined && records[index].end_time !== req.body.end_time) changes.push(`End Time edit`);
    if (req.body.dependency !== undefined && records[index].dependency !== req.body.dependency) changes.push(`Dependency edit`);

    currentLog.push({
      timestamp: new Date().toISOString(),
      action: changes.length > 0 ? `Updated: ${changes.join(', ')}` : 'Updated (Inline)',
      user: req.body.editor_name || 'System'
    });

    updatedRecord.edit_log = JSON.stringify(currentLog);

    const previousEndTime = records[index].end_time;
    records[index] = updatedRecord;

    // Cascade Finish-to-Start timing to dependent tasks
    if (updatedRecord.end_time !== previousEndTime) {
      records.forEach(r => {
        if (r.dependency === updatedRecord.id) {
          r.begin_time = updatedRecord.end_time;
          if (r.end_time && r.begin_time) {
            r.duration = calculateDuration(r.begin_time, r.end_time);
          }
          let cLog = [];
          try { cLog = r.edit_log ? JSON.parse(r.edit_log) : []; } catch (e) { }
          cLog.push({
            timestamp: new Date().toISOString(),
            action: 'Auto-Updated: Begin Time synced from dependency finish',
            user: 'System'
          });
          r.edit_log = JSON.stringify(cLog);
        }
      });
    }

    await writeRecords(records);
    res.json(records[index]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// Delete activity
app.delete('/api/activities/:id', async (req, res) => {
  try {
    const records = await readRecords();
    const filteredRecords = records.filter(r => r.id !== req.params.id);
    if (records.length === filteredRecords.length) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    await writeRecords(filteredRecords);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
