# Management Panel - Complete Guide

## Your shop, simplified.

The management panel is the heart of your administration. It centralizes employee management, vehicle tracking, real-time work order monitoring, media management and billing. Accessible from any browser, it gives you full control over your shop operations.

---

## Secure Access

The panel is protected by a password and two-factor authentication (2FA). Upon login, a 6-digit code is sent by email. You can check the "Don't ask again for 30 days" option to simplify frequent logins.

After multiple failed attempts, access is temporarily locked to protect your account.

---

## Overview

The management panel contains 5 main sections:

| Section | Description |
|---------|-------------|
| **Employees** | Manage your team and their NFC badges |
| **Vehicles** | Complete directory of all vehicles |
| **Monitoring** | Real-time work order tracking |
| **Media** | Photos and documents linked to vehicles |
| **Dashboard** | Full-screen NFC scanner for the workstation |

A notification bell in the top right keeps you informed in real-time of all activity: new work orders, pauses, resumes, and completions.

---

## 1. Employees

### Adding an Employee
Click **"New Employee"** and fill in:
- First name and last name
- Hire date
- NFC badge (optional, can be assigned later)

### Employee List
The list displays all your employees with their hire date and NFC badge status (assigned or unassigned). Each employee has 4 quick actions:

- **Statistics** (chart icon): View employee performance
- **Billed Hours** (clock icon): Manage monthly billed hours
- **Edit** (pencil icon): Modify employee information
- **Delete** (trash icon): Remove the employee from the system

### Employee Statistics
By clicking on an employee's name or the statistics icon, you access a detailed dashboard:

**Period Filters:**
- Today, This Week, This Month, This Year, All
- Specific month selector (e.g., March 2026, February 2026...)

**Statistics Cards:**
- **Hours Worked**: Total punched hours for the period
- **Billed Hours**: Total hours billed to customers for the period
- **Efficiency**: Billed hours / worked hours ratio as a percentage
  - Green: 80% and above
  - Orange: between 50% and 79%
  - Red: below 50%
- **Vehicles**: Number of vehicles worked on
- **Average Time / Vehicle**: Average duration per vehicle

**Recent History:** Paginated table showing each work order with date, vehicle, and duration.

### Billed Hours
The clock icon opens the billed hours manager. This is where you enter the hours the employee billed to customers.

**Adding an Entry:**
1. Select the month (defaults to the previous month)
2. Enter the number of billed hours
3. Add an optional note (e.g., "1 week vacation", "overtime")
4. Click **Add**

**Editing an Entry:** Click the pencil icon, modify the values, then click **Edit**.

**Deleting an Entry:** Click the red trash icon.

The table displays all entries by month, from most recent to oldest.

### NFC Badges
Each employee can have an NFC badge assigned. This badge is used to "punch" work orders via the scanner. To assign a badge:
1. Edit the employee or create a new one
2. Click **Scan**
3. Hold the NFC badge in front of the reader
4. The badge is automatically associated

To remove a badge, click **Remove** in the edit form.

---

## 2. Vehicles

### Adding a Vehicle
Click **"New Vehicle"** and fill in the information:
- **Owner** (required) and contact info (phone, email)
- **Reference**: internal file number
- **Make** (required), model, year, color
- **License plate** and **VIN**
- **Vehicle photo**: add a photo for quick identification
- **NFC badge**: assign a badge directly to the vehicle (optional)

### Vehicle List
The list displays all vehicles with a search bar for quick filtering. Each vehicle shows:
- Make, model, and year
- Owner name and license plate
- Status (active, paused, or inactive)
- Number of assigned media
- Actions: Detail, Edit, Delete

### Vehicle Detail Page
By clicking on a vehicle name, you open its complete profile:

- **Photo and information**: all vehicle data
- **Active work order**: if the vehicle is being worked on, a real-time timer shows the duration, assigned employee, and status (active or paused)
- **Statistics**: total number of repairs, total time, and number of employees
- **Work history**: paginated table of all past work orders
- **Media**: photos and documents linked to the vehicle with shareable link option
- **Notes**: add, view, and delete internal notes about the vehicle

---

## 3. Monitoring

Monitoring is the real-time control center for your shop.

### "Live" Indicator
A pulsing green dot confirms that data refreshes automatically every 5 seconds.

### Active Work Orders
Each active work order displays:
- **Real-time timer**: elapsed time updated every second
- **Vehicle**: make, model, and plate
- **Employee**: assigned employee's name
- **Status**: Active (amber strip) or Paused (green strip)
- **Actions**:
  - **Pause/Resume**: pause or resume the work order
  - **Stop**: complete the work order

### Automatic Pause
The system automatically manages pauses according to the configured schedule. For example:
- Automatic pause at noon (lunch break)
- Automatic resume at 1 PM
- Automatic pause at 5 PM (end of day)
- Automatic resume the next morning

Automatic actions are identified by the **(sys)** suffix in notifications.

### Recent Activity
An activity feed shows the latest completed work orders with their total duration.

---

## 4. Media

The media section lets you manage all photos and documents for your shop.

### Unclassified Photos
New photos appear in the **"New"** section. A badge indicates the number of unclassified media.

### Classifying Photos
1. Click **"Classify"** to activate classification mode
2. Select the photos to classify (a counter shows the number selected)
3. Search for the vehicle in the search field (instant filtering)
4. Click **"Assign"** to link the photos to the vehicle

### Classified Photos
Classified photos are grouped by vehicle. The vehicle name is clickable and leads directly to its detail page. Each group displays a badge with the photo count.

### Deleting Media
1. Click the trash icon to activate deletion mode
2. Select the photos to delete
3. Confirm the deletion

### Sharing
Each photo can be shared via a direct link. Click the copy icon to copy the link to your clipboard.

---

## 5. Dashboard (NFC Scanner)

The Dashboard is designed to be permanently displayed on a workstation in the shop.

### Full-Screen Scanner
Click **"Open Scanner"** to enter full-screen mode. This mode is optimized for daily use:

1. The screen waits for an NFC scan
2. An employee holds their badge in front of the reader
3. The system identifies the employee and displays their name
4. The employee scans a vehicle's badge
5. The work order is automatically created or closed

**If the employee already has an active work order on that vehicle**, the scan automatically closes it.

**If the employee has no active work order**, the scan creates a new one.

### NFC Reader Setup
The Dashboard shows the NFC reader connection status:
- **Green**: reader connected and ready
- **Red**: reader disconnected

Installation instructions are included directly in the interface:
1. Install the ACR122U driver
2. Download the NFC Reader application
3. Plug in the USB reader
4. Launch NFC Reader

Automatic startup with Windows option included.

---

## Notifications

### Notification Bell
In the top right, a bell displays a red badge with the number of new notifications. Click it to see the list:

- **Work order started**: a new work order has been opened
- **Work order completed**: a work order has been finished
- **Work order paused**: a work order has been paused
- **Work order resumed**: a work order has resumed after a pause

Automatic notifications (scheduled pause/resume) are identified by **(sys)**.

### Notification Preferences
In the **Configuration** section, you can enable or disable each notification type individually. Notifications are still recorded in the history even when disabled.

### Notification History
Accessible from **Configuration > Notification History**, the history displays a complete, paginated table of all past notifications with:
- Date and time
- Type (color-coded by category)
- Title and detail
- System indicator (sys) for automatic actions

---

## Configuration

The Configuration section groups all system settings:

### Security
- **2FA Verification**: enable or disable two-factor authentication

### Pause Schedule
Define working hours for each day of the week. Each day is collapsible to save space. Click the arrow to expand a day and modify its time slots.

Example configuration:
- Monday to Friday: 8:00 AM - 12:00 PM, 1:00 PM - 5:00 PM
- Saturday: 9:00 AM - 12:00 PM
- Sunday: Closed

The system will use these schedules to automatically trigger pauses and resumes.

### Notifications
Choose which notification types appear in the bell:
- Work order started
- Work order completed
- Work order paused
- Work order resumed

### Notification History
View the complete history of all system alerts and notifications.

---

## Summary

| Feature | What it does |
|---------|-------------|
| Employee management | Add, edit, delete, assign NFC badges |
| Employee statistics | Hours worked, billed, efficiency, history |
| Billed hours | Monthly entry, editing, notes |
| Vehicle management | Complete profile with photo, history, notes, media |
| Real-time monitoring | Live timers, manual pause/resume |
| Automatic pause | Smart management based on configured schedule |
| NFC scanner | Quick work order punch via badge |
| Media management | Upload, classify by vehicle, share |
| Notifications | Real-time alerts with complete history |
| Configuration | 2FA, schedules, notification preferences |

---

*This system is designed to simplify the daily management of your auto repair shop. Everything is centralized, automated, and accessible in real-time.*
