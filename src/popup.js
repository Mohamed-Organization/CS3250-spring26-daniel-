'use strict';

/**
 * GLOBAL VARIABLES
 * These stay outside the functions so they don't get "forgotten" between clicks.
 */
let originalThemeId = null; // Remembers what theme you had before you started hovering
let lockedInTheme = null;   // Remembers what theme you actually clicked

/**
 * INITIALIZE POPUP
 * Main function that clears the UI and builds the list of grouped themes.
 */
// this function has some asistance from ai
async function initializePopup() {
    const currentDiv = document.getElementById('popup-content');
    if (!currentDiv) return;

    // 1. Get ALL installed themes and your saved Group data
    const allAddons = await browser.management.getAll();
    const storageData = await browser.storage.local.get('userThemes');
    
    const installedThemes = allAddons.filter(addon => addon.type === 'theme');
    const savedThemes = storageData.userThemes || [];

    // 2. Clear the old list before redrawing
    while (currentDiv.firstChild) {
        currentDiv.removeChild(currentDiv.firstChild);
    }

    // 3. Create a Sorting Object (The "Group Map")
    const themeGroups = {};
    savedThemes.forEach(savedItem => {
        const groupName = savedItem.group.toUpperCase(); 
        if (!themeGroups[groupName]) {
            themeGroups[groupName] = [];
        }
        const match = installedThemes.find(t => t.id === savedItem.id);
        if (match) {
            themeGroups[groupName].push(match);
        }
    });

    // 4. Build the Expandable UI (Accordion)
    for (const groupName in themeGroups) {
        const groupWrapper = document.createElement('div');
        groupWrapper.className = 'group-container';

        // Header Container for Title + Delete Group Button
        const headerContainer = document.createElement('div');
        headerContainer.className = 'group-header-container';
        headerContainer.style.display = "flex"; // Puts them on the same line

        const header = document.createElement('button');
        header.className = 'group-header';
        header.style.flex = "1"; // Makes the title take up the most space
        header.textContent = groupName + " (" + themeGroups[groupName].length + ")";

        // Inside your initializePopup loop
        const delGroupBtn = document.createElement('button');
        delGroupBtn.textContent = "×"; // Changed from "DELETE GROUP" to just "×"
        delGroupBtn.className = 'delete-group-btn';
        // used gemini for the next couple lines
        delGroupBtn.onclick = (e) => {
            e.stopPropagation(); // Stops the folder from toggling
            handleDeleteGroup(groupName);
        };

        const contentArea = document.createElement('div');
        contentArea.className = 'group-content';
        contentArea.style.display = "none"; 

        // Loop that adds the Theme + Remove "x" Button
        // used gemini for this
        themeGroups[groupName].forEach(theme => {
            const row = document.createElement('div');
            row.className = 'theme-item-row';
            row.style.display = "flex"; 
            row.style.alignItems = "center";

            const themeBtn = buildMenuItem(theme); // Your original button
            themeBtn.style.flex = "1";

            const removeBtn = document.createElement('button');
            removeBtn.textContent = "×"; // asked gemini for support here
            removeBtn.className = 'remove-item-btn';
            // Calls your new function at the bottom
            removeBtn.onclick = () => handleRemoveTheme(theme.id, groupName);

            row.appendChild(themeBtn);
            row.appendChild(removeBtn);
            contentArea.appendChild(row);
        });

        // Click to Toggle Logic
        header.addEventListener('click', () => {
            if (contentArea.style.display === "none") {
                contentArea.style.display = "block";
                header.textContent = groupName; 
            } else {
                contentArea.style.display = "none";
                header.textContent = groupName + " (" + themeGroups[groupName].length + ")";
            }
        });

        headerContainer.appendChild(header);
        headerContainer.appendChild(delGroupBtn);
        groupWrapper.appendChild(headerContainer);
        groupWrapper.appendChild(contentArea);
        currentDiv.appendChild(groupWrapper);
    }

    // 5. Add "Ungrouped" themes at the bottom
    const otherHeader = document.createElement('h3');
    otherHeader.textContent = "Ungrouped Themes";
    currentDiv.appendChild(otherHeader);

    installedThemes.forEach(theme => {
        const isAlreadySaved = savedThemes.some(s => s.id === theme.id);
        if (!isAlreadySaved) {
            currentDiv.appendChild(buildMenuItem(theme));
        }
    });
}

/**
 * BUILD MENU ITEM
 * Creates the individual buttons for each theme with hover-preview logic.
 */
function buildMenuItem(theme) {
    const btn = document.createElement('button');
    btn.textContent = theme.name;
    btn.className = 'theme-button';

    // HOVER: Show a quick preview without changing settings permanently
    btn.addEventListener('mouseenter', async () => {
        const allAddons = await browser.management.getAll();
        const currentActive = allAddons.find(a => a.type === 'theme' && a.enabled);
        
        if (currentActive && currentActive.id !== theme.id) {
            originalThemeId = currentActive.id; // Remember where we started
        }
        await browser.management.setEnabled(theme.id, true);
    });

    // LEAVE: Put back the original theme unless the user clicked
    btn.addEventListener('mouseleave', async () => {
        if (originalThemeId) {
            await browser.management.setEnabled(originalThemeId, true);
        }
    });

    // CLICK: Lock it in permanently
    btn.addEventListener('click', async () => {
        originalThemeId = null; // Clear the memory so 'mouseleave' doesn't undo the click
        lockedInTheme = theme;   
        
        await browser.management.setEnabled(theme.id, true);

        // Autofill the name box for easy saving
        document.getElementById('theme-name').value = theme.name;
    });

    return btn;
}

/**
 * SAVE THEME
 * Saves the currently "Locked In" theme to a group in storage.
 */
async function saveTheme() {
    const groupInput = document.getElementById('group-name').value;
    const groupName = groupInput || "General";
    const statusMsg = document.querySelector('.status');

    if (!lockedInTheme) {
        statusMsg.textContent = "Click a theme button first!";
        return;
    }

    const data = await browser.storage.local.get('userThemes');
    const savedList = data.userThemes || [];

    const newEntry = {
        id: lockedInTheme.id,
        name: lockedInTheme.name,
        group: groupName
    };

    savedList.push(newEntry);
    await browser.storage.local.set({ userThemes: savedList }); //
    
    statusMsg.textContent = "Saved to " + groupName + "!";
    initializePopup(); // Refresh the list immediately
}

/**
 * EVENT LISTENERS
 * Connects the buttons in your HTML to the JS logic above.
 */
document.addEventListener('DOMContentLoaded', initializePopup);

const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
    saveBtn.addEventListener('click', saveTheme);
}

const shutdown = document.getElementById('shutdown');
if (shutdown) {
    shutdown.addEventListener('click', () => window.close());
}

/**
 * Function 1: Deletes an ENTIRE category
 */
async function handleDeleteGroup(groupName) {
    // A simple pop-up to make sure you don't delete your hard work by accident
    const check = confirm("Delete the " + groupName + " group?");
    
    if (check) {
        // Step 1: Get the current list from Firefox storage
        const data = await browser.storage.local.get('userThemes');
        const savedThemes = data.userThemes || [];
        
        // Step 2: Sift through the list and keep only the themes in OTHER groups
        // This effectively "deletes" the group you clicked
        const updatedList = savedThemes.filter(function(theme) {
            return theme.group.toUpperCase() !== groupName.toUpperCase();
        });
        
        // Step 3: Save the new, smaller list back to storage
        await browser.storage.local.set({ userThemes: updatedList });
        
        // Step 4: Redraw the popup so the group disappears instantly
        initializePopup(); 
    }
}

/**
 * Function 2: Removes just ONE theme from a specific group
 */
async function handleRemoveTheme(themeId, groupName) {
    // Step 1: Grab the saved list
    const data = await browser.storage.local.get('userThemes');
    const savedThemes = data.userThemes || [];
    
    // Step 2: Use .filter to remove ONLY the match for this ID and this Group
    // It says: "Keep the theme if it's a different ID OR in a different group"
    const updatedList = savedThemes.filter(function(theme) {
        const sameId = (theme.id === themeId);
        const sameGroup = (theme.group.toUpperCase() === groupName.toUpperCase());
        
        // Only return true if it's NOT the exact one we want to remove
        return !(sameId && sameGroup);
    });
    
    // Step 3: Save and refresh the UI
    await browser.storage.local.set({ userThemes: updatedList });
    initializePopup();
}