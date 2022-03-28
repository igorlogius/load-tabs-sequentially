
(async () => {
    const proxyURL = browser.runtime.getURL("/tab.html?url=");
	const manifest = browser.runtime.getManifest();
	const extname = manifest.name;

	const filter = (await (async  () => {
		const info = await browser.runtime.getBrowserInfo();
		const major_version = info.version.split(".")[0];
		return { properties: ((major_version < 88)?['status']:['status','url']) };
	})());

    // identify the currently loading tab
    let tabCurrentlyLoading = -1;

	function handleUpdated(tabId, changeInfo, tabInfo){
        if( tabId === tabCurrentlyLoading
            && changeInfo.status === 'complete'){
            // reset currently loading tab, when it completed its loading state
            // will let sequencialLoad know that it can release the next tab if there is any
            tabCurrentlyLoading = -1;
        }else
		if(
			!tabInfo.active
			&& changeInfo.url !== undefined
            && tabId !== tabCurrentlyLoading
			&& !changeInfo.url.startsWith("moz-extension://")
			&& !changeInfo.url.startsWith("about:")
			&& !changeInfo.url.startsWith(proxyURL)
		){
			browser.tabs.update(tabId, { url: "tab.html?url=" + changeInfo.url });
		}
	}

    async function handleActivated(activeInfo){
        const tab = await browser.tabs.get(parseInt(activeInfo.tabId));
        if(tab.url.startsWith(proxyURL)){
            browser.tabs.update(activeInfo.tabId, {
                url: tab.url.split("/tab.html?url=")[1]
            });
        }
    }

    // to not block forever if a tab get closed while it is still loading
    function handleRemoved(tabId, removeInfo) {
        if(tabId === tabCurrentlyLoading){
            tabCurrentlyLoading = -1;
        }
    }

    // load tab(s) sequencialy
    async function sequencialLoad() {
        if(tabCurrentlyLoading !== -1){
            return;
        }
        const queryObj = {
            active: false,
            discarded: false,
            hidden:false,
        };
        const tabsToBeLoaded = (await browser.tabs.query(queryObj)).sort((a,b) => { return a.index-b.index;});
        for(const tab of tabsToBeLoaded){
            if(tab.url.startsWith(proxyURL)){
                tabCurrentlyLoading = tab.id;
                browser.tabs.update(tab.id, { url: tab.url.split("/tab.html?url=")[1] });
                break;
            }
        }
    }

	const delaytime = (await (async () => {
		try {
			let tmp = await getFromStorage('number','delay', 2500);
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
		return 2500;

	})());

	console.log('delaytime: ', delaytime);
	setInterval(sequencialLoad,delaytime);

	browser.tabs.onActivated.addListener(handleActivated);
	browser.tabs.onUpdated.addListener(handleUpdated, filter);
    browser.tabs.onRemoved.addListener(handleRemoved);


	async function getFromStorage(type,id,fallback) {
		let tmp = await browser.storage.local.get(id);
		return (typeof tmp[id] === type) ? tmp[id] : fallback;
	}

	sequencialLoad();

})();
