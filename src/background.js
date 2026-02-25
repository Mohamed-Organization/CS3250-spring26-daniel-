// Background service worker skeleton for Thematic Backgrounds
const STORAGE_KEYS = {
	GROUPS: 'groups',
	ACTIVE_GROUP: 'activeGroupId',
	CURRENT_INDEX: 'currentIndex'
};

// Helpers: storage wrappers
async function getStorage(keys) {
	const res = await browser.storage.local.get(keys);
	return res;
}

async function setStorage(obj) {
	await browser.storage.local.set(obj);
}

// Default sample data (used on install)
const DEFAULT_GROUPS = [
	{ id: 'g-default', name: 'Sample', images: [], intervalMs: 60000 }
];

// Choose next index for a group
function nextIndex(current, length) {
	if (length === 0) return 0;
	return (current + 1) % length;
}

// Broadcast a message to all tabs to set background
async function broadcastSetBackground(url) {
	const tabs = await browser.tabs.query({});
	for (const t of tabs) {
		try {
			await browser.tabs.sendMessage(t.id, { type: 'setBackground', url });
		} catch (err) {
			// ignore tabs that don't have the content script
		}
	}
}

// Handle alarms - cycle active group's image
browser.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm && alarm.name === 'cycle') {
		const store = await getStorage([STORAGE_KEYS.GROUPS, STORAGE_KEYS.ACTIVE_GROUP, STORAGE_KEYS.CURRENT_INDEX]);
		const groups = store[STORAGE_KEYS.GROUPS] || [];
		const activeId = store[STORAGE_KEYS.ACTIVE_GROUP];
		const idxMap = store[STORAGE_KEYS.CURRENT_INDEX] || {};
		const group = groups.find(g => g.id === activeId);
		if (!group || !group.images || group.images.length === 0) return;
		const cur = idxMap[activeId] || 0;
		const next = nextIndex(cur, group.images.length);
		idxMap[activeId] = next;
		await setStorage({ [STORAGE_KEYS.CURRENT_INDEX]: idxMap });
		const url = group.images[next];
		await broadcastSetBackground(url);
	}
});

// Message handling from popup/options/content
browser.runtime.onMessage.addListener(async (msg, sender) => {
	if (!msg || !msg.type) return;
	if (msg.type === 'getState') {
		const store = await getStorage([STORAGE_KEYS.GROUPS, STORAGE_KEYS.ACTIVE_GROUP, STORAGE_KEYS.CURRENT_INDEX]);
		return store;
	}

	if (msg.type === 'setActiveGroup') {
		const { groupId } = msg;
		await setStorage({ [STORAGE_KEYS.ACTIVE_GROUP]: groupId });
		// reset index for new group
		const map = (await getStorage([STORAGE_KEYS.CURRENT_INDEX]))[STORAGE_KEYS.CURRENT_INDEX] || {};
		map[groupId] = map[groupId] || 0;
		await setStorage({ [STORAGE_KEYS.CURRENT_INDEX]: map });
		// set an alarm according to group's interval
		const groups = (await getStorage([STORAGE_KEYS.GROUPS]))[STORAGE_KEYS.GROUPS] || [];
		const group = groups.find(g => g.id === groupId);
		if (group && group.intervalMs && group.intervalMs >= 60000) {
			// use minutes for alarms API
			const minutes = Math.max(1, Math.floor(group.intervalMs / 60000));
			browser.alarms.create('cycle', { periodInMinutes: minutes });
		}
		return { ok: true };
	}

	if (msg.type === 'next') {
		const store = await getStorage([STORAGE_KEYS.GROUPS, STORAGE_KEYS.ACTIVE_GROUP, STORAGE_KEYS.CURRENT_INDEX]);
		const groups = store[STORAGE_KEYS.GROUPS] || [];
		const activeId = store[STORAGE_KEYS.ACTIVE_GROUP];
		const idxMap = store[STORAGE_KEYS.CURRENT_INDEX] || {};
		const group = groups.find(g => g.id === activeId);
		if (!group || !group.images || group.images.length === 0) return { ok: false };
		const cur = idxMap[activeId] || 0;
		const next = nextIndex(cur, group.images.length);
		idxMap[activeId] = next;
		await setStorage({ [STORAGE_KEYS.CURRENT_INDEX]: idxMap });
		await broadcastSetBackground(group.images[next]);
		return { ok: true };
	}
});

// On install populate defaults if needed
browser.runtime.onInstalled.addListener(async (details) => {
	const store = await getStorage([STORAGE_KEYS.GROUPS, STORAGE_KEYS.ACTIVE_GROUP]);
	if (!store[STORAGE_KEYS.GROUPS]) {
		await setStorage({ [STORAGE_KEYS.GROUPS]: DEFAULT_GROUPS, [STORAGE_KEYS.ACTIVE_GROUP]: DEFAULT_GROUPS[0].id });
	}
});

