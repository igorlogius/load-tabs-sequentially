
(async () => {
	const manifest = browser.runtime.getManifest();
	const extname = manifest.name;

	let queuedTabs = [];
	let wakingTab = -1;

	const filter = (await (async  () => {
		const info = await browser.runtime.getBrowserInfo();
		const major_version = info.version.split(".")[0];
		return { properties: [((major_version < 88)?'status':'url')] };
	})());

	function handleCreated(tab) {
		//console.log('handleCreated');
		//if(!tab.active) {
			queuedTabs.push(tab.id);
		//}
	}

	/*
	function handleCreatedNavigationTarget(){
		console.log('handleCreatedNavigationTarget');
	}
	*/

	function delFromQedTabs(id) {
		if(queuedTabs.includes(id)) {
			queuedTabs.splice(queuedTabs.indexOf(id), 1);
		}
	}


	function handleUpdated(tabId, changeInfo, tabInfo){
		if(
			!tabInfo.active
			&& changeInfo.url !== undefined 
			&& queuedTabs.includes(tabId) 
			&& !changeInfo.url.startsWith("moz-extension://") 
			&& !changeInfo.url.startsWith("about:") 
			&& !changeInfo.url.startsWith(browser.runtime.getURL("/tab.html?url=")) 
		){
			browser.tabs.update(tabId, { url: "tab.html?url=" + changeInfo.url });
		}
	}

	async function handleActivated(activeInfo){
		const tab = await browser.tabs.get(activeInfo.tabId);
		if(tab.url.startsWith(browser.runtime.getURL("/tab.html?url="))){

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
		if(!details.url.startsWith(browser.runtime.getURL("/tab.html?url="))){
			handleRemoved(details.tabId,null);
			//console.log('finished loading ', details.url);
		}
	}

	async function checkManagedTabs() {

		if(queuedTabs.length > 0) {
			const tid = queuedTabs[0];

			if(wakingTab !== tid){
				//console.log('blocking lock on wakingTab ', tabId);
				const tab = await browser.tabs.get(tid);

				if(tab.url.startsWith(browser.runtime.getURL("/tab.html?url="))){
					wakingTab = tid;
					//console.log('set lock on wakingTab ', tid);
					delFromQedTabs(tid);
					//console.log('started loading ', tab.url.split("/tab.html?url=")[1]);
					browser.tabs.update(tid, { url: tab.url.split("/tab.html?url=")[1] });


				}
			}
		}


	const delaytime = (await (async () => {
		try {
			let tmp = await getFromStorage('number','delay', 1500);
			//console.log('tmp ', typeof tmp);

			tmp = parseInt(tmp);
			if(typeof tmp === 'number') {
				if(tmp > 999){
					return tmp;
				}
			}
		}catch(e){
			console.error(e);
		}
		return 1500;

	})());
		console.log(delaytime);
		setTimeout(checkManagedTabs,delaytime);
	}



	browser.tabs.onCreated.addListener(handleCreated);
	browser.tabs.onActivated.addListener(handleActivated);
	browser.tabs.onUpdated.addListener(handleUpdated, filter);
	browser.webNavigation.onCompleted.addListener(onCompleted);
	browser.tabs.onRemoved.addListener(handleRemoved);

	async function getFromStorage(type,id,fallback) {
		let tmp = await browser.storage.local.get(id);
		return (typeof tmp[id] === type) ? tmp[id] : fallback;
	}

	checkManagedTabs();

})();
