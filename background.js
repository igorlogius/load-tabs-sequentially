
let queuedTabs = [];
let wakingTab = -1;

const filter = {
	properties: ["status"]
}

function handleCreated(tab) {
	if(!tab.active) {
		queuedTabs.push(tab.id);
	}
}

function delFromQedTabs(id) {
	if(queuedTabs.includes(id)) {
		queuedTabs.splice(queuedTabs.indexOf(id), 1);
	}
}


function handleUpdated(tabId, changeInfo, tabInfo){
	if(changeInfo.url !== undefined 
		&& queuedTabs.includes(tabId) 
		&& !changeInfo.url.startsWith("moz-extension://") 
		&& !changeInfo.url.startsWith("about:") 
		&& !changeInfo.url.startsWith(browser.extension.getURL("/tab.html?url=")) 
	){
		browser.tabs.update(tabId, { url: "tab.html?url=" + changeInfo.url });
	}
}

async function handleActivated(activeInfo){
	const tab = await browser.tabs.get(activeInfo.tabId);
	if(tab.url.startsWith(browser.extension.getURL("/tab.html?url="))){

		delFromQedTabs(activeInfo.tabId);
		browser.tabs.update(activeInfo.tabId, {
			url: tab.url.split("/tab.html?url=")[1]
		});

	}
}


function handleRemoved(tabId, removeInfo) {
	delFromQedTabs(tabId);
	if(wakingTab === tabId) {
		wakingTab = -1;
		//console.log('released lock on wakingTab ', tabId);
	}
}

function onCompleted (details) {
	if(!details.url.startsWith(browser.extension.getURL("/tab.html?url="))){
		handleRemoved(details.tabId,null);
		//console.log('finished loading ', details.url);
	}
}

async function checkManagedTabs() {

	if(queuedTabs.length < 1) {
		return
	}
	const tid = queuedTabs[0];

	if(wakingTab === tid){
		//console.log('blocking lock on wakingTab ', tabId);
		return;
	}
	const tab = await browser.tabs.get(tid);

	if(!tab.url.startsWith(browser.extension.getURL("/tab.html?url="))){
		return;
	}
	wakingTab = tid;
	//console.log('set lock on wakingTab ', tid);
	delFromQedTabs(tid);
	//console.log('started loading ', tab.url.split("/tab.html?url=")[1]);
	browser.tabs.update(tid, { url: tab.url.split("/tab.html?url=")[1] });
}



browser.tabs.onCreated.addListener(handleCreated);
browser.tabs.onActivated.addListener(handleActivated);
browser.tabs.onUpdated.addListener(handleUpdated, filter);
browser.webNavigation.onCompleted.addListener(onCompleted);
browser.tabs.onRemoved.addListener(handleRemoved);

setInterval(checkManagedTabs, 1700);
