
var queuedTabs = [];
var wakingTab = -1;

const filter = {
  properties: ["status"]
}

async function handleCreated(tab){
	if(!tab.active) {
		queuedTabs.push(tab.id);
	}
}


async function handleUpdated(tabId, changeInfo, tabInfo){
	if(changeInfo.url !== undefined 
		&& queuedTabs.includes(tabId) 
		&& !changeInfo.url.startsWith("moz-extension://") 
		&& !changeInfo.url.startsWith("about:") 
		&& !changeInfo.url.startsWith(browser.extension.getURL("/tab.html?url=")) 
	){
		await browser.tabs.update(tabId, {
			url: "tab.html?url=" + changeInfo.url
		});
	}
}

async function handleActivated(activeInfo){
	const tab = await browser.tabs.get(activeInfo.tabId);
	if(tab.url.startsWith(browser.extension.getURL("/tab.html?url="))){

		if(queuedTabs.includes(activeInfo.tabId)) {
			queuedTabs.splice(queuedTabs.indexOf(activeInfo.tabId), 1);
		}
		await browser.tabs.update(activeInfo.tabId, {
			url: tab.url.split("/tab.html?url=")[1]
		});

	}
}


function handleRemoved(tabId, removeInfo) {
	if(queuedTabs.includes(tabId)) {
		queuedTabs.splice(queuedTabs.indexOf(tabId), 1);
	}
	if(wakingTab === tabId) {
		wakingTab = -1;
		//console.log('released lock on wakingTab ', tabId);
	}
}

function onCompleted (details) {
	if(!details.url.startsWith(browser.extension.getURL("/tab.html?url="))){
		handleRemoved(details.tabId,null);
		//console.log('finished loading ', details.url);
		return;
	}
}

async function checkManagedTabs() {

	if(queuedTabs.length > 0) {
		const tid = queuedTabs[0];

		if(wakingTab === tid){
			//console.log('blocking lock on wakingTab ', tabId);
			return;
		}
		const tab = await browser.tabs.get(tid);

		if(tab.url.startsWith(browser.extension.getURL("/tab.html?url="))){

			wakingTab = tid;
			//console.log('set lock on wakingTab ', tid);

			if(queuedTabs.includes(tid)) {
				queuedTabs.splice(queuedTabs.indexOf(tid), 1);
			}
			//console.log('started loading ', tab.url.split("/tab.html?url=")[1]);
			await browser.tabs.update(tid, {
				url: tab.url.split("/tab.html?url=")[1]
			});
		}
	}
}


setInterval(checkManagedTabs, 1500);


browser.tabs.onCreated.addListener(handleCreated);
browser.tabs.onActivated.addListener(handleActivated);
browser.tabs.onUpdated.addListener(handleUpdated, filter );
browser.webNavigation.onCompleted.addListener(onCompleted);
browser.tabs.onRemoved.addListener(handleRemoved);
