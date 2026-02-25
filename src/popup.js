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
    // This turns our flat list into: { "SOULS": [theme1], "JUNGLE": [theme2] }
    const themeGroups = {};

    savedThemes.forEach(savedItem => {
        const groupName = savedItem.group.toUpperCase(); // Force uppercase for the "Pro" look
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

        const header = document.createElement('button');
        header.className = 'group-header';
        header.textContent = groupName + " (" + themeGroups[groupName].length + ")";

        const contentArea = document.createElement('div');
        contentArea.className = 'group-content';
        contentArea.style.display = "none"; // Hidden by default

        // Add the theme buttons into the group
        themeGroups[groupName].forEach(theme => {
            contentArea.appendChild(buildMenuItem(theme, true));
        });

        // Click to Toggle: Opens or closes the group
        header.addEventListener('click', () => {
            if (contentArea.style.display === "none") {
                contentArea.style.display = "block";
                header.textContent = groupName; // Minimalist text when open
            } else {
                contentArea.style.display = "none";
                header.textContent = groupName + " (" + themeGroups[groupName].length + ")";
            }
        });

        groupWrapper.appendChild(header);
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
            currentDiv.appendChild(buildMenuItem(theme, false));
        }
    });
}

/**
 * BUILD MENU ITEM
 * Creates the individual buttons for each theme with hover-preview logic.
 */
function buildMenuItem(theme, isSaved) {
    const wrapper = document.createElement('div');
    wrapper.className = 'theme-item-wrapper';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = theme.name;
    nameSpan.className = 'theme-name';

    // HOVER: Show a quick preview without changing settings permanently
    wrapper.addEventListener('mouseenter', async () => {
        const allAddons = await browser.management.getAll();
        const currentActive = allAddons.find(a => a.type === 'theme' && a.enabled);
        
        if (currentActive && currentActive.id !== theme.id) {
            originalThemeId = currentActive.id; // Remember where we started
        }
        await browser.management.setEnabled(theme.id, true);
    });

    // LEAVE: Put back the original theme unless the user clicked
    wrapper.addEventListener('mouseleave', async () => {
        if (originalThemeId) {
            await browser.management.setEnabled(originalThemeId, true);
        }
    });

    // CLICK: Lock it in permanently
    wrapper.addEventListener('click', async () => {
        originalThemeId = null; // Clear the memory so 'mouseleave' doesn't undo the click
        lockedInTheme = theme;   
        
        await browser.management.setEnabled(theme.id, true);

        // Autofill the name box for easy saving
        document.getElementById('theme-name').value = theme.name;
    });

    wrapper.appendChild(nameSpan);

    if (isSaved) {
        const delBtn = document.createElement('span');
        delBtn.className = 'delete-btn';
        delBtn.textContent = '✕';
        
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); 
            const data = await browser.storage.local.get('userThemes');
            const list = data.userThemes || [];
            const updated = list.filter(item => item.id !== theme.id);
            await browser.storage.local.set({ userThemes: updated });
            initializePopup();
        });

        delBtn.addEventListener('mouseenter', () => {
            wrapper.classList.add('no-hover');
        });
        delBtn.addEventListener('mouseleave', () => {
            wrapper.classList.remove('no-hover');
        });

        wrapper.appendChild(delBtn);
    }

    return wrapper;
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
    await browser.storage.local.set({ userThemes: savedList }); 
    
    // Refresh the list immediately
    statusMsg.textContent = "Saved to " + groupName + "!";
    initializePopup(); 
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