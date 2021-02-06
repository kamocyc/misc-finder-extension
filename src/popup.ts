import { browser } from 'webextension-polyfill-ts';

type SearchResult = {
  url?: string,
  description: string,
  type: string
}

const extractHostname = (url: string) => {
  try {
    return (new URL(url)).hostname;
  } catch (e) { return ''; }
};

// https://scrapbox.io/scrapboxlab/API
const scrapboxFinder = async (project_name: string, query: string): Promise<SearchResult[]> => {  
  const url = `https://scrapbox.io/api/pages/${project_name}/search/query?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const data = await res.json();
  
  return !data.pages ? [] : data.pages.map((row: any) => {
    return {
      url: `https://scrapbox.io/${project_name}/${encodeURIComponent(row.title)}`,
      description: row.title + '\n\n' + row.lines.join('\n'),
      type: 'scrapbox'
    }
  });
};

// http://developer.hatena.ne.jp/ja/documents/bookmark/apis/fulltext_search
const hatenaBookmarkFinder = async (query: string): Promise<SearchResult[]> => {
  const url = `https://b.hatena.ne.jp/my/search/json?q=${encodeURIComponent(query)}&limit=100`;
  const res = await fetch(url);
  const data = await res.json();
  
  return !data.bookmarks ? [] : data.bookmarks.map((bookmark: any) => {
    return {
      url: bookmark.entry.url,
      description: bookmark.entry.title + '\n' + extractHostname(bookmark.entry.url),
      type: 'hatebu'
    };
  });
};

const isNotSpecificDomains = (url: string): boolean => {
  const ngDomains = ['https://scrapbox.io/', 'https://b.hatena.ne.jp/'];
  return ngDomains.every(domain => 
    url.substr(0, domain.length) !== domain
  );
};

// https://developer.chrome.com/docs/extensions/reference/history/#method-search
const historyFinder = async (query: string): Promise<SearchResult[]> => {
  const historyItems = await browser.history.search({
      'text': query,
      'startTime': 1000 * 60 * 60 * 24 * 356 * 20 // 20 years
    });
    
  return historyItems
    .filter(h => h.url !== undefined && isNotSpecificDomains(h.url))
    .map(history => {
      return {
        url: history.url,
        description: history.title + '\n' + extractHostname(history.url ?? ""),
        type: 'history'
      };
    });
};

// https://developer.chrome.com/docs/extensions/reference/bookmarks/
const bookmarkFinder = async (query: string): Promise<SearchResult[]> => {
  const bookmarks = await browser.bookmarks.search(query);
  return bookmarks.map(bookmark => {
    return {
      url: bookmark.url,
      description: bookmark.title + (bookmark.url === undefined ? "" : ('\n' + extractHostname(bookmark.url))),
      type: 'bookmark'
    };
  });
};

const clearListView = () => {
  const list = document.getElementById('listView');
  list!.innerHTML = '';
};

const appendToListView = (results: SearchResult[]) => {
  const list = document.getElementById('listView');
  results.forEach(result => {
    const aElem = document.createElement('a');
    if(result.url !== undefined) {
      aElem.setAttribute('href', result.url);
    }
    aElem.innerText = result.description;
    aElem.onclick = e => {
      // open a link in a new tab in background
      e.preventDefault();
      browser.tabs.create({url: aElem.href, active: false});
    };
    
    const liElement = document.createElement("li");
    liElement.appendChild(aElem);
    liElement.className = 'result-body ' + 'item-' + result.type;
    
    list?.appendChild(liElement);
  });
};

const addWaitingIcon = () => {
  const list = document.getElementById('listView');
  const elm = document.createElement('li');
  elm.id = 'waitingIcon';
  elm.innerText = 'Loading ...';
  list?.appendChild(elm);
}

const removeWaitingIcon = () => {
  const elm = document.getElementById('waitingIcon');
  if (elm !== null) {
    elm.remove();
  }
}

const projects: string[] = [];

const init = async () => {
  const data = await browser.storage.sync.get(['projects', 'search_hatebu']);
  (data.projects === undefined ? [] : data.projects).forEach((project: string) => {
    //TODO: should check stored data is valid for security
    projects.push(project);
  });
    
  (document.getElementById('search-hatebu') as HTMLInputElement).checked =
    data.search_hatebu === undefined ? false : true;
  
  document.getElementById('searchForm')!.onsubmit = async (e) => {
    e.preventDefault();
    
    clearListView();
    
    addWaitingIcon();
    
    const searchQuery = document.getElementById('searchQuery') as HTMLInputElement;
    
    const scrapboxResults =
      projects.map(async project => {
        //TODO: refactor
        const results = await scrapboxFinder(project, searchQuery.value);
        appendToListView(results);
      });
    
    if((document.getElementById('search-hatebu') as HTMLInputElement).checked) {
      scrapboxResults.push((async () => {
        const results = await hatenaBookmarkFinder(searchQuery.value);
        appendToListView(results);
      })());
      scrapboxResults.push((async () => {
        const results = await historyFinder(searchQuery.value);
        appendToListView(results);
      })());
      scrapboxResults.concat((async () => {
        const results = await bookmarkFinder(searchQuery.value);
        appendToListView(results);
      })());
    }
    
    await Promise.all(scrapboxResults);
    
    removeWaitingIcon();
  };

  document.getElementById('search-hatebu')!.onchange = async (e: Event) => {
    await browser.storage.sync.set({ 'search_hatebu': (e.target as HTMLInputElement).checked});
  };
};

init();
