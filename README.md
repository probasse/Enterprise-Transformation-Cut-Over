# Go-Live Planner / Enterprise Transformation Cut-Over

A premium, interactive web application to manage and coordinate go-live activities, cut-over plans, and enterprise transformations. 

## Features

- **Dynamic Task Management**: Create, edit, and organize project tasks across customizable phases.
- **Team & Assignee Roster**: Define team members, their time zones, and working hour policies.
- **Drag-and-Drop Columns**: Fully rearrange the project board to your liking with HTML5 drag-and-drop.
- **Smart Timezone Support**: Instantly shift the timezone of the entire project board (e.g., from PST to IST) to coordinate global teams.
- **View-Only Mode**: The application defaults to a secure, read-only mode to prevent accidental edits. Toggle "Enable Editing" to make changes.
- **Bulk Actions**: Select multiple activities to update their statuses simultaneously or batch delete them.
- **Premium UI**: Designed with modern glassmorphism, responsive mobile off-canvas drawers, and smooth micro-animations.

## How to Run Locally

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/probasse/Enterprise-Transformation-Cut-Over.git
   ```
2. Navigate to the project directory:
   ```bash
   cd Enterprise-Transformation-Cut-Over
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

1. Start the backend server:
   ```bash
   npm start
   ```
   *(Alternatively, if you use nodemon for development: `npm run dev`)*
2. Open your web browser and navigate to:
   [http://localhost:3000](http://localhost:3000)

Your settings and activities are automatically persisted to an internal `settings.json` and `activities.json` file safely.
